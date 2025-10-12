// =========================
// 📦 EMOBOX SERVER (Hoàn chỉnh)
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
import authRoutes from "./routes/auth.js"; // router đăng nhập / đăng ký

// =========================
// 🔧 Cấu hình cơ bản
// =========================
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =========================
// 📂 Cấu hình đường dẫn tuyệt đối
// =========================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// 🖼️ Cho phép truy cập logo và thư mục public
// =========================
app.use("/logo.jpg", express.static(path.join(__dirname, "logo.jpg")));
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
const client = mqtt.connect(process.env.MQTT_BROKER || "mqtt://test.mosquitto.org");

client.on("connect", () => console.log("✅ MQTT Connected"));
client.on("error", (err) => console.error("❌ MQTT Error:", err));

// =========================
// 🎙️ Upload file âm thanh
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
// ⏰ Đặt báo thức bằng giọng nói
// =========================
app.post("/api/alarm", (req, res) => {
  const { time, message } = req.body;

  if (!time) return res.status(400).json({ success: false, message: "Thiếu thời gian báo thức!" });

  const date = new Date(time);
  schedule.scheduleJob(date, () => {
    client.publish("emobox/alarm", message || "Báo thức!");
    console.log("⏰ Đã gửi báo thức đến ESP32!");
  });

  res.json({ success: true, message: "Đặt báo thức thành công!" });
});

// =========================
// 🚀 Chạy server
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 EmoBox Server đang chạy trên cổng ${PORT}`));
