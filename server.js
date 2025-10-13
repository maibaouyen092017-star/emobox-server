// =========================
// 📦 EMOBOX SERVER (Hoàn chỉnh cho Render + ESP32)
// =========================
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

import Alarm from "./models/Alarm.js";
import authRoutes from "./routes/auth.js";
import voiceRoutes from "./routes/voice.js";

dotenv.config();

const app = express();

// =========================
// ⚙️ Cấu hình cơ bản
// =========================
app.use(cors({
  origin: ["https://emobox.onrender.com", "http://localhost:3000"],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// 📂 Đường dẫn tuyệt đối
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// 📁 Thư mục public
// =========================
["uploads", "music", "public"].forEach((dir) => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p);
});

// =========================
// 🖼️ Cấp quyền truy cập file tĩnh
// =========================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/music", express.static(path.join(__dirname, "music")));
app.use(express.static(path.join(__dirname, "public")));

// =========================
// 🌐 Kết nối MongoDB
// =========================
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// =========================
// 🔑 Routes đăng nhập / giọng nói
// =========================
app.use("/auth", authRoutes);
app.use("/api", voiceRoutes);

// =========================
// 📡 MQTT
// =========================
const client = mqtt.connect(process.env.MQTT_BROKER || "mqtt://test.mosquitto.org", {
  family: 4,
});
client.on("connect", () => console.log("✅ MQTT Connected"));
client.on("error", (err) => console.error("❌ MQTT Error:", err));

// =========================
// 🎙️ Upload voice realtime
// =========================
const upload = multer({ dest: path.join(__dirname, "uploads/") });

// ✅ Upload file realtime (tin nhắn gửi ngay)
app.post("/api/upload-voice", upload.single("voice"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "Không có file ghi âm!" });

    const fileUrl = `${process.env.SERVER_URL}/uploads/${req.file.filename}`;
    const payload = JSON.stringify({
      id: new Date().getTime().toString(),
      voiceUrl: fileUrl,
      title: req.body.title || "Tin nhắn mới",
    });

    // ✅ Gửi tới ESP32 qua MQTT
    client.publish("emobox/alarm", payload);
    console.log("📢 Gửi MQTT realtime:", payload);

    res.json({ success: true, voiceUrl: fileUrl });
  } catch (err) {
    console.error("❌ Lỗi upload voice:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi upload!" });
  }
});

// =========================
// ⏰ Đặt báo thức bằng voice
// =========================
app.post("/api/alarms", upload.single("voice"), async (req, res) => {
  try {
    const { title, date, time } = req.body;
    if (!date || !time)
      return res.status(400).json({ success: false, message: "Thiếu ngày giờ!" });

    const fileUrl = req.file
      ? `${process.env.SERVER_URL}/uploads/${req.file.filename}`
      : null;

    const newAlarm = await Alarm.create({
      title,
      date,
      time,
      fileUrl,
      heard: false,
    });

    // 🕒 Lên lịch gửi MQTT tới ESP32
    const fullTime = new Date(`${date}T${time}:00`);
    schedule.scheduleJob(fullTime, () => {
      console.log(`⏰ Báo thức đến giờ: ${title}`);
      const payload = JSON.stringify({
        id: newAlarm._id.toString(),
        title,
        voiceUrl: fileUrl,
      });
      client.publish("emobox/alarm", payload);
    });

    res.json({ success: true, alarm: newAlarm });
  } catch (err) {
    console.error("❌ Lỗi lưu báo thức:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi lưu báo thức!" });
  }
});

// 🧾 Lấy danh sách báo thức
app.get("/api/alarms", async (req, res) => {
  try {
    const alarms = await Alarm.find().sort({ date: -1, time: -1 });
    res.json(alarms);
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// 🗑️ Xóa báo thức
app.delete("/api/alarms/:id", async (req, res) => {
  try {
    await Alarm.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// ✅ ESP32 gửi phản hồi “đã nghe”
app.post("/api/alarms/heard/:id", async (req, res) => {
  try {
    await Alarm.findByIdAndUpdate(req.params.id, { heard: true });
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// =========================
// 🚀 Khởi động server
// =========================
const PORT = process.env.PORT || 3000;
mongoose.connection.once("open", () => {
  app.listen(PORT, () =>
    console.log(`🚀 EmoBox Server chạy tại cổng ${PORT}`)
  );
});
