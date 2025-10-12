// models/VoiceMessage.js
import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  title: String,
  type: { type: String, enum: ['message','alarm'], default: 'message' },
  filePath: String, // local path in uploads
  date: String,
  time: String,
  targetDevice: { type: String, default: 'broadcast' },
  heard: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const VoiceMessage = mongoose.model('VoiceMessage', schema);
export default VoiceMessage;
