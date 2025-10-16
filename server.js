import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import http from "http";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(bodyParser.json());

// =============================
// 📁 Đường dẫn thực tế
// =============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================
// 🎧 Cấu hình thư mục public + upload
// =============================
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =============================
// 🎤 Cấu hình Multer (upload âm thanh)
// =============================
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${safeName}`);
  },
});
const upload = multer({ storage });

// =============================
// 📦 MongoDB Schema
// =============================
const alarmSchema = new mongoose.Schema({
  title: String,
  voiceUrl: String, // 🔊 Đường dẫn file audio (.mp3 / .webm)
  heard: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const Alarm = mongoose.model("Alarm", alarmSchema);

// =============================
// 🌐 ROUTES
// =============================

// ✅ Gửi báo thức (kèm âm thanh)
app.post("/api/alarms", upload.single("voice"), async (req, res) => {
  try {
    const voiceUrl = req.file ? `/uploads/${req.file.filename}` : "";
    const alarm = new Alarm({
      title: req.body.title || "Báo thức mới",
      voiceUrl,
    });
    await alarm.save();

    console.log("📢 Báo thức mới:", alarm);
    io.emit("new_alarm", alarm);
    res.json({ success: true, alarm });
  } catch (err) {
    console.error("❌ Lỗi khi lưu báo thức:", err);
    res.status(500).json({ success: false });
  }
});

// ✅ Đánh dấu đã nghe
app.post("/api/alarms/heard/:id", async (req, res) => {
  try {
    const alarm = await Alarm.findByIdAndUpdate(
      req.params.id,
      { heard: true },
      { new: true }
    );
    if (!alarm)
      return res.status(404).json({ success: false, message: "Không tìm thấy báo thức" });

    console.log(`✅ Báo thức ${req.params.id} đã được xác nhận!`);
    io.emit("alarm_heard", alarm); // 🔔 realtime cập nhật
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

// ✅ API kiểm tra server (Render test)
app.get("/", (req, res) => {
  res.send("✅ EmoBox Server đang hoạt động và hỗ trợ upload MP3/WebM!");
});

// =============================
// 🔌 SOCKET.IO (Realtime cập nhật)
// =============================
io.on("connection", (socket) => {
  console.log("📡 Client connected!");
  socket.on("disconnect", () => console.log("❌ Client disconnected"));
});

// =============================
// 🚀 KHỞI ĐỘNG SERVER + MONGODB
// =============================
const PORT = process.env.PORT || 3000;
const MONGO =
  process.env.MONGO_URI ||
  "mongodb+srv://<username>:<password>@cluster0.mongodb.net/emobox";

mongoose
  .connect(MONGO)
  .then(() => {
    console.log("✅ MongoDB connected!");
    server.listen(PORT, () =>
      console.log(`🚀 Server chạy tại http://localhost:${PORT}`)
    );
  })
  .catch((err) => console.error("❌ MongoDB error:", err));
