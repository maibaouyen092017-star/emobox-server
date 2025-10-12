import mongoose from "mongoose";

const VoiceMessageSchema = new mongoose.Schema({
  title: String,
  time: Date,
  file: String,
  sent: { type: Boolean, default: false }
});

export default mongoose.model("VoiceMessage", VoiceMessageSchema);
