import mongoose from "mongoose";

const voiceSchema = new mongoose.Schema({
  sender: String,
  device_id: String,
  message: String,
  file_url: String,
  timestamp: { type: Date, default: Date.now },
  played: { type: Boolean, default: false }
});

export default mongoose.model("VoiceMessage", voiceSchema);
