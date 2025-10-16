// ============================
// 🎧 EmoBox Server - Bản gốc hoàn chỉnh
// ============================

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { Server } from "socket.io";
import http from "http";
import mqtt from "mqtt";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ------------------------------
// ⚙️ Middlewares
// ------------------------------
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

// ------------------------------
// 📡 MQTT Broker setup
// ------------------------------
const mqttClient = mqtt.connect("mqtt://broker.hivemq.com");
mqttClient.on("connect", () => console.log("✅ MQTT connected to HiveMQ broker!"));

// ------------------------------
// 💾 Multer setup (upload)
// ------------------------------
const upload = multer({ dest: "uploads/" });

// ------------------------------
// 🧱 MongoDB Schema
// ------------------------------
const alarmSchema = new mongoose.Schema({
  title: String,
  voiceUrl: String,
  date: String,
  time: String,
  heard: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Alarm = mongoose.model("Alarm", alarmSchema);

// ------------------------------
// 🎵 Convert WebM → MP3 helper
// ------------------------------
function convertToMp3(inputPath) {
  const outputPath = inputPath.replace(path.extname(inputPath), ".mp3");
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec("libmp3lame")
      .audioBitrate("128k")
      .save(outputPath)
      .on("end", () => {
        fs.unlinkSync(inputPath); // xoá file gốc .webm
        resolve(outputPath);
      })
      .on("error", (err) => reject(err));
  });
}

// ------------------------------
// 🌐 ROUTES
// ------------------------------

// ✅ Ghi âm / gửi tin nhắn
app.post("/api/upload-voice", upload.single("voice"), async (req, res) => {
  try {
    const { title } = req.body;
    const inputPath = req.file.path;

    // 🔊 Chuyển sang mp3
    const mp3Path = await convertToMp3(inputPath);
    const fileName = path.basename(mp3Path);
    const voiceUrl = `/uploads/${fileName}`;

    // 💾 Lưu DB
    const alarm = new Alarm({ title, voiceUrl });
    await alarm.save();

    // 🚀 Gửi MQTT & Socket realtime
    const payload = {
      id: alarm._id.toString(),
      title,
      voiceUrl: `https://emobox-server.onrender.com${voiceUrl}`
    };
    mqttClient.publish("emobox/voice", JSON.stringify(payload));
    io.emit("new_alarm", alarm);

    console.log("📢 Voice message sent:", payload);
    res.json({ success: true, alarm });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ success: false });
  }
});

// ✅ Lưu báo thức thủ công
app.post("/api/alarms", upload.single("voice"), async (req, res) => {
  try {
    const { title, date, time } = req.body;
    const inputPath = req.file.path;

    const mp3Path = await convertToMp3(inputPath);
    const fileName = path.basename(mp3Path);
    const voiceUrl = `/uploads/${fileName}`;

    const alarm = new Alarm({ title, date, time, voiceUrl });
    await alarm.save();

    // 🔔 Gửi MQTT báo thức mới
    const payload = {
      id: alarm._id.toString(),
      title,
      date,
      time,
      voiceUrl: `https://emobox-server.onrender.com${voiceUrl}`
    };
    mqttClient.publish("emobox/alarm", JSON.stringify(payload));
    io.emit("new_alarm", alarm);

    console.log("⏰ New alarm saved:", payload);
    res.json({ success: true, alarm });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ✅ Đánh dấu "đã nghe"
app.post("/api/alarms/heard/:id", async (req, res) => {
  try {
    const alarm = await Alarm.findByIdAndUpdate(
      req.params.id,
      { heard: true },
      { new: true }
    );
    if (!alarm) return res.status(404).json({ success: false, message: "Không tìm thấy báo thức" });

    console.log(`✅ Báo thức ${req.params.id} đã nghe!`);

    io.emit("alarm_heard", alarm);
    mqttClient.publish("emobox/alarm_heard", JSON.stringify(alarm));

    res.json({ success: true, alarm });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ✅ Lấy danh sách báo thức
app.get("/api/alarms", async (req, res) => {
  const alarms = await Alarm.find().sort({ createdAt: -1 });
  res.json(alarms);
});

// ✅ Kiểm tra hoạt động server
app.get("/", (req, res) => {
  res.send("✅ EmoBox Server đang hoạt động — có hỗ trợ upload + nén MP3 + MQTT!");
});

// ------------------------------
// 🔌 Socket.io setup
// ------------------------------
io.on("connection", (socket) => {
  console.log("📡 Client connected!");
  socket.on("disconnect", () => console.log("❌ Client disconnected"));
});

// ------------------------------
// 🚀 Start server
// ------------------------------
const PORT = process.env.PORT || 3000;
const MONGO = process.env.MONGO_URI || "mongodb://localhost:27017/emobox";

mongoose.connect(MONGO)
  .then(() => {
    console.log("✅ MongoDB connected!");
    server.listen(PORT, () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));
