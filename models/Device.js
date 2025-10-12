import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema({
  device_id: String,
  wifi_ssid: String,
  online: Boolean,
  last_seen: Date
});

export default mongoose.model("Device", deviceSchema);
