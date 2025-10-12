// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import mqtt from "mqtt";
import schedule from "node-schedule";
import authRoutes from "./routes/auth.js"; // ✅ router đăng nhập / đăng ký

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRoutes);
app.use(express.urlencoded({ extended: true }));

// 🧠 Xác định đường dẫn gốc (dành cho ES module)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 📁 Cấu hình lưu file upload
const upload = multer({ dest: path.join(__dirname, "uploads/") });

// 🧩 Kết nối MongoDB
mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// 🔑 Routes xác thực
app.use("/api/auth", authRoutes);

// 🔊 Route ghi âm gửi lên
app.post("/api/upload", upload.single("audio"), async (req, res) => {
  try {
    console.log("🎤 File ghi âm nhận được:", req.file.filename);
    // Gửi thông tin qua MQTT để ESP32 nhận
    client.publish("emobox/audio", req.file.filename);
    res.json({ success: true, message: "Đã nhận file ghi âm" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Không thể xử lý file âm thanh" });
  }
});

// 🕒 Route đặt báo thức
app.post("/api/alarm", (req, res) => {
  const { time, message } = req.body;
  console.log(`🕒 Đặt báo thức lúc ${time} - ${message}`);
  schedule.scheduleJob(new Date(time), () => {
    client.publish("emobox/alarm", message);
    console.log("🔔 Gửi báo thức đến ESP32!");
  });
  res.json({ success: true });
});

// 📦 Cấu hình MQTT (kênh liên lạc với ESP32)
const MQTT_BROKER = process.env.MQTT_BROKER || "mqtt://test.mosquitto.org";
const client = mqtt.connect(MQTT_BROKER);

client.on("connect", () => console.log("📡 Kết nối MQTT thành công:", MQTT_BROKER));
client.on("error", (err) => console.error("⚠️ Lỗi MQTT:", err));

// 🌐 Public giao diện (frontend)
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🚀 Khởi động server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server chạy tại cổng ${PORT}`));

