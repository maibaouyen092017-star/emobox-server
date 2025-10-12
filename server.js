import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("."));

// ✅ Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// === Mô hình dữ liệu ===
const User = mongoose.model("User", new mongoose.Schema({
  username: String,
  password: String,
  wifiSSID: String,
  wifiPass: String
}));

const Alarm = mongoose.model("Alarm", new mongoose.Schema({
  user: String,
  time: Date,
  voiceFile: String,
  musicFile: { type: String, default: "alarm.mp3" },
  triggered: { type: Boolean, default: false }
}));

const Message = mongoose.model("Message", new mongoose.Schema({
  user: String,
  voiceFile: String,
  createdAt: { type: Date, default: Date.now }
}));

// === Upload file ghi âm ===
const upload = multer({ dest: "uploads/" });
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ msg: "Không có file" });
  res.json({ filename: req.file.filename });
});

// === Tạo báo thức ===
app.post("/api/alarms", async (req, res) => {
  const { user, time, voiceFile } = req.body;
  if (!user || !time || !voiceFile)
    return res.status(400).json({ msg: "Thiếu dữ liệu" });
  const a = await Alarm.create({ user, time: new Date(time), voiceFile });
  res.json({ msg: "Đặt báo thức thành công", alarm: a });
});

// === Gửi giọng nói trực tiếp ===
app.post("/api/messages", async (req, res) => {
  const { user, voiceFile } = req.body;
  if (!user || !voiceFile) return res.status(400).json({ msg: "Thiếu dữ liệu" });
  const m = await Message.create({ user, voiceFile });
  res.json({ msg: "Đã gửi giọng nói", message: m });
});

// === ESP32 poll ===
app.get("/api/esp/poll/:user", async (req, res) => {
  const alarm = await Alarm.findOne({ triggered: false }).sort({ time: 1 });
  const msg = await Message.findOne({}).sort({ createdAt: -1 });

  res.json({
    hasAlarm: !!alarm,
    alarm: alarm
      ? {
          id: alarm._id,
          time: alarm.time,
          voice: `/uploads/${alarm.voiceFile}`,
          music: `/music/${alarm.musicFile}`,
        }
      : null,
    hasMessage: !!msg,
    message: msg ? { voice: `/uploads/${msg.voiceFile}` } : null,
  });
});

// === Public thư mục upload & nhạc ===
app.use("/uploads", express.static("uploads"));
app.use("/music", express.static("music"));
app.post("/api/listened", async (req, res) => {
  const { messageId } = req.body;
  await Message.findByIdAndUpdate(messageId, { listened: true });
  res.json({ success: true });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Server chạy tại cổng", PORT));


