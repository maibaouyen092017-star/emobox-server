import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import http from "http";

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(bodyParser.json());

// =============================
// 📦 MongoDB Schema
// =============================
const alarmSchema = new mongoose.Schema({
  title: String,
  voiceUrl: String,
  heard: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const Alarm = mongoose.model("Alarm", alarmSchema);

// =============================
// 🌐 Routes
// =============================

// ✅ Gửi báo thức mới
app.post("/api/alarms", async (req, res) => {
  try {
    const alarm = new Alarm(req.body);
    await alarm.save();
    io.emit("new_alarm", alarm);
    res.json({ success: true, alarm });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ✅ Đánh dấu "ĐÃ NGHE"
app.post("/api/alarms/heard/:id", async (req, res) => {
  try {
    const alarm = await Alarm.findByIdAndUpdate(req.params.id, { heard: true }, { new: true });
    if (!alarm) return res.status(404).json({ success: false, message: "Không tìm thấy báo thức" });
    console.log(`✅ Báo thức ${req.params.id} đã được xác nhận!`);
    io.emit("alarm_heard", alarm); // 🔔 Gửi realtime tới client
    res.json({ success: true, alarm });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ✅ Lấy danh sách
app.get("/api/alarms", async (req, res) => {
  const alarms = await Alarm.find().sort({ createdAt: -1 });
  res.json(alarms);
});

// =============================
// 🔌 Socket.io
// =============================
io.on("connection", (socket) => {
  console.log("📡 Client connected!");
  socket.on("disconnect", () => console.log("❌ Client disconnected"));
});

// =============================
// 🚀 Start server
// =============================
const PORT = process.env.PORT || 3000;
const MONGO = process.env.MONGO_URI || "mongodb://localhost:27017/emobox";

mongoose.connect(MONGO)
  .then(() => {
    console.log("✅ MongoDB connected!");
    server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
  })
  .catch((err) => console.error("❌ MongoDB error:", err));
