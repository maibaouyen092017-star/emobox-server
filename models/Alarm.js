// models/Alarm.js
import mongoose from "mongoose";

const alarmSchema = new mongoose.Schema({
  title: { type: String, default: "" },
  date: { type: String, required: true },
  time: { type: String, required: true },
  fileUrl: { type: String, required: true },
});

const Alarm = mongoose.model("Alarm", alarmSchema);
export default Alarm;
// models/Alarm.js
import mongoose from "mongoose";

const alarmSchema = new mongoose.Schema({
  title: String,
  date: String,
  time: String,
  fileUrl: String,
  heard: { type: Boolean, default: false },
});

export default mongoose.model("Alarm", alarmSchema);
