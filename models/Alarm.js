// models/Alarm.js
import mongoose from "mongoose";

const alarmSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  fileUrl: { type: String },
  heard: { type: Boolean, default: false },
});

export default mongoose.model("Alarm", alarmSchema);
