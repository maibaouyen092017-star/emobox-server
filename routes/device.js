import express from "express";
import Device from "../models/Device.js";
import VoiceMessage from "../models/VoiceMessage.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { device_id, wifi_ssid } = req.body;
  await Device.findOneAndUpdate(
    { device_id },
    { wifi_ssid, online: true, last_seen: new Date() },
    { upsert: true }
  );
  res.json({ status: "ok" });
});

router.get("/get-voice", async (req, res) => {
  const { device_id } = req.query;
  const msg = await VoiceMessage.findOne({ device_id, played: false });
  if (!msg) return res.json({ has_alarm: false });
  msg.played = true;
  await msg.save();
  res.json({
    has_alarm: true,
    file_url: msg.file_url,
    message: msg.message
  });
});

router.post("/ack", async (req, res) => {
  console.log("ESP đã xác nhận nhận báo thức:", req.body.device_id);
  res.json({ status: "ok", msg: "Đã nhận tín hiệu từ ESP" });
});

export default router;
