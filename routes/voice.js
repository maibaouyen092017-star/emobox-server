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
// --- Voice Realtime ---
router.post("/realtime", upload.single("voice"), async (req, res) => {
  const { sender, device_id, message } = req.body;
  const file_url = `${process.env.BASE_URL}/uploads/${req.file.filename}`;

  const voiceMsg = new VoiceMessage({
    sender,
    device_id,
    message,
    file_url,
    played: false
  });
  await voiceMsg.save();

  res.json({ msg: "Voice realtime đã gửi", file_url });
});

// --- ESP long-poll nhận voice realtime ---
router.get("/wait-voice", async (req, res) => {
  const { device_id } = req.query;
  let attempts = 0;
  const checkVoice = async () => {
    const msg = await VoiceMessage.findOne({ device_id, played: false });
    if (msg) {
      msg.played = true;
      await msg.save();
      return res.json({
        has_voice: true,
        file_url: msg.file_url,
        message: msg.message
      });
    } else if (attempts++ < 20) {
      setTimeout(checkVoice, 1000);
    } else {
      res.json({ has_voice: false });
    }
  };
  checkVoice();
});

export default router;
