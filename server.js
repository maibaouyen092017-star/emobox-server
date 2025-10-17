// server.js - EmoBox (Render + MQTT + Audio Compress + Realtime)
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
import http from "http";
import Alarm from "./models/Alarm.js";
import authRoutes from "./routes/auth.js";
import voiceRoutes from "./routes/voice.js";

dotenv.config();

const FFMPEG_PATH = ffmpegInstaller.path || "ffmpeg";
const app = express();

// ===== Middleware & Basic Config =====
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:3000"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// __dirname fix for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Ensure folders exist =====
["uploads", "music", "public"].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// ===== Static Routes =====
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/music", express.static(path.join(__dirname, "music")));
app.use(express.static(path.join(__dirname, "public")));

// ✅ Root route
app.get("/", (req, res) => res.send("✅ EmoBox server online & ready."));

// ===== SERVER_URL =====
const SERVER_URL = (process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");

// ===== MongoDB =====
const MONGO = process.env.MONGO_URL || "mongodb://127.0.0.1:27017/emobox";
mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Error:", err));

// ===== Routes =====
app.use("/auth", authRoutes);
app.use("/api", voiceRoutes);

// ===== MQTT =====
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://test.mosquitto.org";
const client = mqtt.connect(MQTT_BROKER, { family: 4 });

client.on("connect", () => console.log("✅ MQTT Connected"));
client.on("error", (err) => console.error("❌ MQTT Error:", err));
client.on("close", () => {
  console.log("⚠️ MQTT disconnected, reconnecting...");
  client.reconnect();
});

// ===== MULTER Storage =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `${Date.now()}${ext}`);
  },
});
const upload = multer({ storage });

// ===== Audio Compression =====
async function compressAudio(inputPath) {
  return new Promise((resolve, reject) => {
    try {
      const outBase = inputPath.replace(path.extname(inputPath), "") + "_small.mp3";
      const cmd = `"${FFMPEG_PATH}" -y -i "${inputPath}" -vn -ac 1 -ar 16000 -b:a 64k "${outBase}"`;
      exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          console.error("❌ ffmpeg error:", stderr || error.message);
          return reject(error);
        }
        if (!fs.existsSync(outBase)) return reject(new Error("ffmpeg output missing"));
        console.log("✅ compressAudio ->", outBase);
        resolve(outBase);
      });
    } catch (err) { reject(err); }
  });
}

// ===== Socket.IO setup =====
import { Server } from "socket.io";
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

io.on("connection", (socket) => {
  console.log("🔗 Socket connected:", socket.id);
  socket.on("disconnect", () => console.log("❌ Socket disconnected:", socket.id));
});

// ===== Upload Voice (Realtime) =====
app.post("/api/upload-voice", upload.single("voice"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Không có file!" });

    const inputPath = path.join(__dirname, "uploads", req.file.filename);
    const outputPath = await compressAudio(inputPath);
    const fileUrl = `${SERVER_URL}/uploads/${path.basename(outputPath)}`;

    const payload = {
      id: Date.now().toString(),
      title: req.body.title || "Tin nhắn mới",
      voiceUrl: fileUrl,
    };

    // ✅ Đẩy tới ESP32
    if (client.connected) client.publish("emobox/alarm", JSON.stringify(payload));
    else console.warn("⚠️ MQTT not connected.");

    // ✅ Đẩy tới Web/PC realtime
    io.emit("newAlarm", payload);

    res.json({ success: true, voiceUrl: fileUrl });
  } catch (err) {
    console.error("❌ upload-voice error:", err);
    res.status(500).json({ success: false, message: "Lỗi server upload-voice" });
  }
});

// ===== Alarm Creation =====
app.post("/api/alarms", upload.single("voice"), async (req, res) => {
  try {
    const { title, date, time } = req.body;
    if (!date || !time) return res.status(400).json({ success: false, message: "Thiếu ngày hoặc giờ" });

    let fileUrl = null;
    if (req.file) {
      const inputPath = path.join(__dirname, "uploads", req.file.filename);
      const outputPath = await compressAudio(inputPath);
      fileUrl = `${SERVER_URL}/uploads/${path.basename(outputPath)}`;
    }

    const newAlarm = await Alarm.create({ title, date, time, fileUrl, heard: false });

    const fullTime = new Date(`${date}T${time}:00+07:00`);
    schedule.scheduleJob(fullTime, () => {
      const payload = JSON.stringify({
        id: newAlarm._id.toString(),
        title: newAlarm.title,
        voiceUrl: fileUrl,
      });
      if (client.connected) client.publish("emobox/alarm", payload);
      io.emit("newAlarm", { id: newAlarm._id.toString(), title: newAlarm.title, voiceUrl: fileUrl });
    });

    res.json({ success: true, alarm: newAlarm });
  } catch (err) {
    console.error("❌ /api/alarms error:", err);
    res.status(500).json({ success: false, message: "Lỗi khi lưu báo thức" });
  }
});

// ===== Alarm APIs =====
app.get("/api/alarms", async (req, res) => {
  try {
    const alarms = await Alarm.find().sort({ date: -1, time: -1 });
    res.json(alarms);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.delete("/api/alarms/:id", async (req, res) => {
  try {
    await Alarm.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

app.post("/api/alarms/heard/:id", async (req, res) => {
  try {
    await Alarm.findByIdAndUpdate(req.params.id, { heard: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ===== Start Server =====
const PORT = process.env.PORT || 3000;
mongoose.connection.once("open", () => {
  httpServer.listen(PORT, () =>
    console.log(`🚀 EmoBox Server (HTTP+Socket.IO) chạy tại ${PORT} (SERVER_URL=${SERVER_URL})`)
  );
});
