import express from "express";
import cors from "cors";
import multer from "multer";
import mongoose from "mongoose";
import fetch from "node-fetch";
import VoiceMessage from "./models/VoiceMessage.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/music", express.static(path.join(__dirname, "music")));

// MongoDB connect
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// setup multer upload
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// GỬI VOICE TRỰC TIẾP
app.post("/api/voice/realtime", upload.single("file"), async (req, res) => {
  console.log("🎤 Voice realtime:", req.file.filename);
  try {
    await fetch("http://ESP32_IP/voice", {   // ⚠️ Thay ESP32_IP bằng IP thật
      method: "POST",
      body: JSON.stringify({
        url: `${process.env.DOMAIN}/uploads/${req.file.filename}`
      }),
      headers: { "Content-Type": "application/json" },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ĐẶT BÁO THỨC
app.post("/api/voice/alarm", upload.single("file"), async (req, res) => {
  const newAlarm = await VoiceMessage.create({
    title: req.body.title,
    time: req.body.time,
    file: req.file.filename,
    sent: false
  });
  res.json({ success: true, alarm: newAlarm });
});

// KIỂM TRA BÁO THỨC MỖI PHÚT
setInterval(async () => {
  const now = new Date();
  const alarms = await VoiceMessage.find({ time: { $lte: now }, sent: false });
  for (let alarm of alarms) {
    console.log("⏰ Gửi báo thức:", alarm.title);
    try {
      await fetch("http://ESP32_IP/alarm", {
        method: "POST",
        body: JSON.stringify({
          url: `${process.env.DOMAIN}/uploads/${alarm.file}`,
          music: `${process.env.DOMAIN}/music/alarm.mp3`
        }),
        headers: { "Content-Type": "application/json" },
      });
      alarm.sent = true;
      await alarm.save();
    } catch (err) {
      console.error("ESP gửi lỗi:", err.message);
    }
  }
}, 60000);

// TRẢ FILE GIAO DIỆN
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
