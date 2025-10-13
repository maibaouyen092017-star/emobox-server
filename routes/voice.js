import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import VoiceMessage from "../models/VoiceMessage.js";
import { mixAudio } from "../utils/mixAudio.js"; // ✅ Thêm đúng vị trí này
import mqtt from "mqtt";

const router = express.Router();

// MQTT Client
const client = mqtt.connect(process.env.MQTT_BROKER || "mqtt://test.mosquitto.org", {
  family: 4,
});

// ====================
// Cấu hình Multer Upload
// ====================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// ====================
// 1️⃣ ESP gửi voice lên server
// ====================
router.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  console.log("📥 Voice received:", req.file.filename);
  res.json({ message: "Voice uploaded", file: req.file.filename });
});

// ====================
// 2️⃣ Người dùng gửi voice tới thiết bị
// ====================
router.post("/send", upload.single("voice"), async (req, res) => {
  try {
    const { sender, device_id, message } = req.body;
    const file_url = `${process.env.BASE_URL}/uploads/${req.file.filename}`;
    const voiceMsg = new VoiceMessage({ sender, device_id, message, file_url });
    await voiceMsg.save();

    // 🟢 Tạo file mix voice + nhạc
    const voiceFilePath = path.join(process.cwd(), "uploads", req.file.filename);
    const musicFilePath = path.join(process.cwd(), "music", "alarm.mp3");

    const mixedUrl = await mixAudio(
      voiceFilePath,
      musicFilePath,
      `mixed_${voiceMsg._id}`
    );

    // 🟢 Gửi MQTT đến ESP32
    const payload = JSON.stringify({
      id: voiceMsg._id.toString(),
      title: message,
      mixedUrl: `${process.env.SERVER_URL}${mixedUrl}`,
    });
    client.publish("emobox/alarm", payload);

    res.json({ msg: "Gửi voice thành công", file_url, mixedUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: "Lỗi khi gửi voice" });
  }
});

// ====================
// 3️⃣ Voice realtime (gửi nhanh, chưa phát)
// ====================
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

// ====================
// 4️⃣ ESP long-poll nhận voice realtime
// ====================
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

export default router;
