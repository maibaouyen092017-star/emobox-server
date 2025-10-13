import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import VoiceMessage from "../models/VoiceMessage.js";

const router = express.Router();

// Định nghĩa __dirname cho ES Module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cấu hình nơi lưu file ghi âm
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// 🟢 Upload voice (ESP gửi file lên)
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  console.log("📥 Voice received:", req.file.filename);
  res.json({ message: "Voice uploaded", file: req.file.filename });
});

// 🟢 Người dùng gửi voice tới thiết bị
router.post("/send", upload.single("voice"), async (req, res) => {
  try {
    const { sender, device_id, message } = req.body;
    const file_url = `${process.env.BASE_URL}/uploads/${req.file.filename}`;
    const voiceMsg = new VoiceMessage({ sender, device_id, message, file_url });
    await voiceMsg.save();
    res.json({ msg: "Gửi voice thành công", file_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Lỗi khi gửi voice" });
  }
});

// 🟢 Voice realtime (gửi nhanh, chưa phát)
router.post("/realtime", upload.single("voice"), async (req, res) => {
  try {
    const { sender, device_id, message } = req.body;
    const file_url = `${process.env.BASE_URL}/uploads/${req.file.filename}`;

    const voiceMsg = new VoiceMessage({
      sender,
      device_id,
      message,
      file_url,
      played: false,
    });
    await voiceMsg.save();

    res.json({ msg: "Voice realtime đã gửi", file_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Lỗi khi gửi voice realtime" });
  }
});

// 🟢 ESP long-poll nhận voice realtime
router.get("/wait-voice", async (req, res) => {
  const { device_id } = req.query;
  let attempts = 0;

  const checkVoice = async () => {
    const msg = await VoiceMessage.findOne({ device_id, played: false });
    if (msg) {
      msg.played = true;
      await msg.save();
      return res.json({
        has_voice: true,
        file_url: msg.file_url,
        message: msg.message,
      });
    } else if (attempts++ < 20) {
      setTimeout(checkVoice, 1000);
    } else {
      res.json({ has_voice: false });
    }
  };

  checkVoice();
});
import { mixAudio } from "../utils/mixAudio.js";  // thêm dòng này trên đầu file

// Trong đoạn POST /api/alarms:
const voiceFilePath = path.join(process.cwd(), "uploads", req.file.filename);
const musicFilePath = path.join(process.cwd(), "music", "alarm.mp3");

// Gọi mixAudio
const mixedUrl = await mixAudio(
  voiceFilePath,
  musicFilePath,
  `mixed_${newAlarm._id}`
);

// Gửi MQTT cho ESP32
const payload = JSON.stringify({
  id: newAlarm._id.toString(),
  title,
  mixedUrl: `${process.env.SERVER_URL}${mixedUrl}`
});
client.publish("emobox/alarm", payload);

export default router;
