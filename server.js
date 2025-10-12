import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import dotenv from "dotenv";
import path from "path";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("."));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

const alarmSchema = new mongoose.Schema({
  date: String,
  time: String,
  voicePath: String,
  alarmPath: String,
});
const Alarm = mongoose.model("Alarm", alarmSchema);

const upload = multer({ dest: "uploads/" });

app.post("/api/uploadAlarm", upload.single("voice"), async (req, res) => {
  const { date, time } = req.body;
  const voicePath = `/uploads/${req.file.filename}`;
  const alarmPath = "/music/alarrm.mp3";

  const newAlarm = new Alarm({ date, time, voicePath, alarmPath });
  await newAlarm.save();

  res.json({ success: true, message: "✅ Báo thức đã lưu!", alarm: newAlarm });
});

app.get("/api/alarms", async (req, res) => {
  const alarms = await Alarm.find();
  res.json(alarms);
});

app.listen(process.env.PORT, () => console.log(`🚀 Server running on port ${process.env.PORT}`));
