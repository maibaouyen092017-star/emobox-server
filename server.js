// server.js - EmoBox (fixed, robust)
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import multer from "multer";
import schedule from "node-schedule";
import mqtt from "mqtt";
import { fileURLToPath } from "url";
import fs from "fs";
import { exec } from "child_process";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

import Alarm from "./models/Alarm.js";
import authRoutes from "./routes/auth.js";
import voiceRoutes from "./routes/voice.js";

dotenv.config();

const FFMPEG_PATH = ffmpegInstaller.path || "ffmpeg";
const app = express();

// Basic config
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:3000"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure folders
["uploads", "music", "public"].forEach((dir) => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Static serving
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/music", express.static(path.join(__dirname, "music")));
app.use(express.static(path.join(__dirname, "public")));

// SERVER_URL fallback (important for building full URLs)
const SERVER_URL = (process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");

// Mongo
if (!process.env.MONGO_URL) console.warn("⚠️ MONGO_URL not set in env");
mongoose.connect(process.env.MONGO_URL || "mongodb://127.0.0.1:27017/emobox", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// Routes (auth + other voice routes if any)
app.use("/auth", authRoutes);
app.use("/api", voiceRoutes);

// MQTT
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://test.mosquitto.org";
const client = mqtt.connect(MQTT_BROKER, { family: 4 });
client.on("connect", () => console.log("✅ MQTT Connected"));
client.on("error", (err) => console.error("❌ MQTT Error:", err));

// MULTER storage ensures extension is preserved
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (req, file, cb) => {
    // preserve extension (if missing, default to .webm)
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// compressAudio: convert input to a new _small.mp3 file
async function compressAudio(inputPath) {
  return new Promise((resolve, reject) => {
    try {
      const outBase = inputPath.replace(path.extname(inputPath), "") + "_small.mp3";
      // Build ffmpeg command
      // -vn: no video, -ac 1: mono, -ar 16000: 16kHz, -b:a 64k: bitrate
      const cmd = `"${FFMPEG_PATH}" -y -i "${inputPath}" -vn -ac 1 -ar 16000 -b:a 64k "${outBase}"`;
      exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          console.error("❌ ffmpeg error:", (stderr || error.message).toString().slice(0, 2000));
          return reject(error);
        }
        if (!fs.existsSync(outBase)) {
          return reject(new Error("ffmpeg did not produce output file"));
        }
        console.log("✅ compressAudio ->", outBase);
        resolve(outBase);
      });
    } catch (err) {
      reject(err);
    }
  });
}

// --- Upload realtime voice (compress then publish to MQTT) ---
app.post("/api/upload-voice", upload.single("voice"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Không có file!" });

    const inputPath = path.join(__dirname, "uploads", req.file.filename);
    // Try compress; if it fails, we return error (safer)
    let outputPath;
    try {
      outputPath = await compressAudio(inputPath);
    } catch (err) {
      console.error("❌ Lỗi nén file (realtime):", err.message || err);
      return res.status(500).json({ success: false, message: "Lỗi nén file âm thanh" });
    }

    const fileUrl = `${SERVER_URL}/uploads/${path.basename(outputPath)}`;
    const payload = JSON.stringify({
      id: Date.now().toString(),
      title: req.body.title || "Tin nhắn mới",
      voiceUrl: fileUrl,
    });

    if (client && client.connected) {
      client.publish("emobox/alarm", payload);
      console.log("📢 MQTT publish realtime:", payload);
    } else {
      console.warn("⚠️ MQTT not connected; realtime message not published");
    }

    res.json({ success: true, voiceUrl: fileUrl });
  } catch (err) {
    console.error("❌ upload-voice error:", err);
    res.status(500).json({ success: false, message: "Lỗi server upload-voice" });
  }
});

// --- Create alarm (upload voice optional) ---
app.post("/api/alarms", upload.single("voice"), async (req, res) => {
  try {
    const { title, date, time } = req.body;
    if (!date || !time) return res.status(400).json({ success: false, message: "Thiếu ngày hoặc giờ" });

    let fileUrl = null;
    if (req.file) {
      const inputPath = path.join(__dirname, "uploads", req.file.filename);
      try {
        const outputPath = await compressAudio(inputPath);
        fileUrl = `${SERVER_URL}/uploads/${path.basename(outputPath)}`;
      } catch (err) {
        console.error("❌ Lỗi nén file (alarm):", err.message || err);
        return res.status(500).json({ success: false, message: "Lỗi nén file âm thanh" });
      }
    }

    const newAlarm = await Alarm.create({ title: title || "Báo thức", date, time, fileUrl, heard: false });

    // Schedule MQTT publish
    const fullTime = new Date(`${date}T${time}:00+07:00`);
    schedule.scheduleJob(fullTime, () => {
      const payload = JSON.stringify({
        id: newAlarm._id.toString(),
        title: newAlarm.title,
        voiceUrl: fileUrl,
      });
      if (client && client.connected) {
        client.publish("emobox/alarm", payload);
        console.log("⏰ MQTT publish alarm:", payload);
      } else {
        console.warn("⚠️ MQTT not connected at alarm time; payload:", payload);
      }
    });

    res.json({ success: true, alarm: newAlarm });
  } catch (err) {
    console.error("❌ /api/alarms error:", err);
    res.status(500).json({ success: false, message: "Lỗi khi lưu báo thức" });
  }
});

// --- List / delete / heard (simple) ---
app.get("/api/alarms", async (req, res) => {
  try {
    const alarms = await Alarm.find().sort({ date: -1, time: -1 });
    res.json(alarms);
  } catch (err) {
    console.error("❌ GET /api/alarms:", err);
    res.status(500).json({ success: false });
  }
});

app.delete("/api/alarms/:id", async (req, res) => {
  try {
    await Alarm.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ DELETE /api/alarms/:id", err);
    res.status(500).json({ success: false });
  }
});

app.post("/api/alarms/heard/:id", async (req, res) => {
  try {
    await Alarm.findByIdAndUpdate(req.params.id, { heard: true });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ POST /api/alarms/heard/:id", err);
    res.status(500).json({ success: false });
  }
});

// Start
const PORT = process.env.PORT || 3000;
mongoose.connection.once("open", () => {
  app.listen(PORT, () => console.log(`🚀 EmoBox Server chạy tại ${PORT} (SERVER_URL=${SERVER_URL})`));
});
client.on("close", () => {
  console.log("⚠️ MQTT disconnected, reconnecting...");
  client.reconnect();
});
