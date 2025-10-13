// =========================
// 📦 EMOBOX SERVER (Hoàn chỉnh - Fixed alarms route)
// =========================

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
import path from "path";
import multer from "multer";
import schedule from "node-schedule";
import mqtt from "mqtt";
import { fileURLToPath } from "url";
import fs from "fs";
import Alarm from "./models/Alarm.js";
import authRoutes from "./routes/auth.js"; // router đăng nhập / đăng ký
import voiceRoutes from "./routes/voice.js";

const app = express();

// =========================
// 🔧 Cấu hình cơ bản
// =========================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// 📂 Cấu hình đường dẫn tuyệt đối
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// 🖼️ Cho phép truy cập logo và thư mục public + uploads
// =========================
app.use("/logo.jpg", express.static(path.join(__dirname, "logo.jpg")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

// =========================
// 🌐 Kết nối MongoDB
// =========================
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// =========================
// 🔑 Đăng nhập / Đăng ký
// =========================
app.use("/auth", authRoutes);

// =========================
// 📡 Cấu hình MQTT
// =========================
const client = mqtt.connect(process.env.MQTT_BROKER || "mqtt://test.mosquitto.org", {
  family: 4, // chỉ dùng IPv4
});

client.on("connect", () => console.log("✅ MQTT Connected"));
client.on("error", (err) => console.error("❌ MQTT Error:", err));

// =========================
// 🎙️ Upload file âm thanh Realtime
// =========================
const upload = multer({ dest: path.join(__dirname, "uploads/") });

app.post("/api/upload", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "Không có file được gửi lên!" });

    console.log("📁 File âm thanh nhận:", req.file.filename);
    client.publish("emobox/audio", req.file.filename);

    res.status(200).json({ success: true, message: "Upload thành công!" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Lỗi xử lý file!" });
  }
});

// =========================
// ⏰ Đặt báo thức bằng giọng nói (với file)
// =========================
app.post("/api/alarms", upload.single("file"), async (req, res) => {
  try {
    const { title, date, time } = req.body;
    if (!date || !time) return res.status(400).json({ success: false, message: "Thiếu ngày giờ!" });
    if (!req.file) return res.status(400).json({ success: false, message: "Thiếu file âm thanh!" });

    const fullTime = new Date(`${date}T${time}:00`);
    const alarmFilePath = `/uploads/${req.file.filename}`;

    // Đặt lịch gửi MQTT đến ESP
    schedule.scheduleJob(fullTime, () => {
      client.publish("emobox/alarm", alarmFilePath);
      console.log(`⏰ Báo thức phát: ${alarmFilePath}`);
    });
    // Lưu vào database
const newAlarm = new Alarm({
  title,
  date,
  time,
  fileUrl: alarmFilePath,
});
await newAlarm.save();
    console.log(`💾 Báo thức lưu: ${title} vào ${fullTime.toLocaleString()}`);

    res.json({
      success: true,
      message: "Đã lưu báo thức thành công!",
      data: { title, date, time, fileUrl: alarmFilePath },
    });
  } catch (err) {
    console.error("❌ Lỗi khi lưu báo thức:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi lưu báo thức!" });
  }
});

// =========================
// ✅ API kiểm tra danh sách báo thức (tùy chọn)
// =========================
app.get("/api/alarms", (req, res) => {
  const folder = path.join(__dirname, "uploads");
  const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
  const list = files.map((f) => ({
    file: f,
    url: `/uploads/${f}`,
  }));
  res.json(list);
});

// =========================
// 🚀 Chạy server
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 EmoBox Server đang chạy trên cổng ${PORT}`));

