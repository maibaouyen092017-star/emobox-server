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
const FFMPEG_PATH = ffmpegInstaller.path;
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
// 🔑 Routes
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
// 🎙️ Upload + nén file
// =========================
const upload = multer({ dest: path.join(__dirname, "uploads/") });

async function compressAudio(inputPath) {
  return new Promise((resolve, reject) => {
    const outputPath = inputPath.replace(/\.mp3$/, "_small.mp3");
    const cmd = `"${FFMPEG_PATH}" -y -i "${inputPath}" -ac 1 -ar 16000 -b:a 64k "${outputPath}"`;

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Lỗi nén âm thanh:", stderr);
        reject(error);
      } else {
        console.log("✅ Đã nén âm thanh:", outputPath);
        resolve(outputPath);
      }
    });
  });
}

// ✅ Gửi realtime
app.post("/api/upload-voice", upload.single("voice"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "Không có file ghi âm!" });

    const inputPath = path.join(__dirname, "uploads", req.file.filename);
    const outputPath = await compressAudio(inputPath);
    const fileUrl = `${process.env.SERVER_URL}/uploads/${path.basename(outputPath)}`;

    const payload = JSON.stringify({
      id: Date.now().toString(),
      voiceUrl: fileUrl,
      title: req.body.title || "Tin nhắn mới",
    });

    if (client.connected) {
      client.publish("emobox/alarm", payload);
      console.log("📢 Gửi MQTT realtime:", payload);
    } else {
      console.warn("⚠️ MQTT chưa sẵn sàng, bỏ qua gửi realtime!");
    }

    res.json({ success: true, voiceUrl: fileUrl });
  } catch (err) {
    console.error("❌ Lỗi upload voice:", err);
    res.status(500).json({ success: false, message: "Lỗi server khi upload!" });
  }
});

// ✅ Hẹn giờ báo thức
app.post("/api/alarms", upload.single("voice"), async (req, res) => {
  try {
    const { title, date, time } = req.body;
    if (!date || !time)
      return res.status(400).json({ success: false, message: "Thiếu ngày giờ!" });

    let fileUrl = null;
    if (req.file) {
      const inputPath = path.join(__dirname, "uploads", req.file.filename);
      const outputPath = await compressAudio(inputPath);
      fileUrl = `${process.env.SERVER_URL}/uploads/${path.basename(outputPath)}`;
    }

    const newAlarm = await Alarm.create({ title, date, time, fileUrl, heard: false });

    const fullTime = new Date(`${date}T${time}:00`);
    schedule.scheduleJob(fullTime, () => {
      console.log(`⏰ Báo thức đến giờ: ${title}`);
      const payload = JSON.stringify({
        id: newAlarm._id.toString(),
        title,
        voiceUrl: fileUrl,
      });
      if (client.connected) client.publish("emobox/alarm", payload);
    });

    res.json({ success: true, alarm: newAlarm });
  } catch (err) {
    console.error("❌ Lỗi lưu báo thức:", err.message);
    res.status(500).json({ success: false, message: "Lỗi server khi lưu báo thức!" });
  }
});

// ✅ API khác
app.get("/api/alarms", async (_, res) => res.json(await Alarm.find().sort({ date: -1, time: -1 })));
app.delete("/api/alarms/:id", async (req, res) => {
  await Alarm.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});
app.post("/api/alarms/heard/:id", async (req, res) => {
  await Alarm.findByIdAndUpdate(req.params.id, { heard: true });
  res.json({ success: true });
});

// 🚀 Start
const PORT = process.env.PORT || 3000;
mongoose.connection.once("open", () => {
  app.listen(PORT, () => console.log(`🚀 EmoBox Server chạy tại cổng ${PORT}`));
});
