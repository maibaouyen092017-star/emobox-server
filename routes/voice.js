import express from "express";
import multer from "multer";
import VoiceMessage from "../models/VoiceMessage.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

router.post("/send", upload.single("voice"), async (req, res) => {
  const { sender, device_id, message } = req.body;
  const file_url = `${process.env.BASE_URL}/uploads/${req.file.filename}`;
  const voiceMsg = new VoiceMessage({ sender, device_id, message, file_url });
  await voiceMsg.save();
  res.json({ msg: "Gửi voice thành công", file_url });
});

export default router;
