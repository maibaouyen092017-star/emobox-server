import mongoose from "mongoose";

const alarmSchema = new mongoose.Schema({
  title: String,
  date: String,
  time: String,
  fileUrl: String,
});

export default mongoose.model("Alarm", alarmSchema);
