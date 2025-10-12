// server.js
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();
const PORT = process.env.PORT || 3000;
const MONGO = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!MONGO) {
  console.error("MONGO_URI is required in env");
  process.exit(1);
}

/* ===== Mongoose models (inline for single-file) ===== */
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: String,
  name: String,
});
const User = mongoose.model("User", userSchema);

const messageSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // user tạo
  createdAt: { type: Date, default: Date.now },
  deviceId: String, // device target (or "all")
  title: String,
  audioPath: String, // public path: /uploads/xxx.mp3 or /music/alarrm.mp3
  alarmAt: Date, // optional scheduled time
  listened: { type: Boolean, default: false },
  listenedAt: Date
});
const Message = mongoose.model("Message", messageSchema);

/* ===== Init ===== */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public"))); // serve index, css, music, uploads

// Multer for file uploads (public/uploads)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "public/uploads")),
  filename: (req, file, cb) => {
    const name = Date.now() + "-" + file.originalname.replace(/\s+/g, "_");
    cb(null, name);
  }
});
const upload = multer({ storage });

/* ===== Connect MongoDB ===== */
mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Mongo connected"))
  .catch(err => {
    console.error("Mongo connect error:", err);
    process.exit(1);
  });

/* ===== Auth helpers ===== */
function signToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
}
async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: "No auth" });
  const token = h.split(" ")[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(data.id);
    if (!req.user) return res.status(401).json({ error: "User not found" });
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ===== Routes ===== */

// Signup
app.post("/api/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email+password required" });
  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ error: "User exists" });
  const hash = await bcrypt.hash(password, 10);
  const u = new User({ email, passwordHash: hash, name });
  await u.save();
  const token = signToken(u);
  res.json({ token, user: { id: u._id, email: u.email, name: u.name } });
});

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const u = await User.findOne({ email });
  if (!u) return res.status(400).json({ error: "Invalid" });
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(400).json({ error: "Invalid" });
  const token = signToken(u);
  res.json({ token, user: { id: u._id, email: u.email, name: u.name } });
});

// Upload recorded audio (user)
app.post("/api/upload", authMiddleware, upload.single("voice"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file required" });
  const filePathPublic = "/uploads/" + req.file.filename;
  res.json({ path: filePathPublic });
});

// Create message / alarm (user)
app.post("/api/set-alarm", authMiddleware, async (req, res) => {
  // expected: { deviceId, title, audioPath, alarmAt }
  const { deviceId = "all", title = "Lời nhắn", audioPath, alarmAt } = req.body;
  if (!audioPath) return res.status(400).json({ error: "audioPath required" });
  const msg = new Message({
    owner: req.user._id,
    deviceId,
    title,
    audioPath,
    alarmAt: alarmAt ? new Date(alarmAt) : null
  });
  await msg.save();
  res.json({ ok: true, message: msg });
});

// List messages for logged user
app.get("/api/messages", authMiddleware, async (req, res) => {
  const list = await Message.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json(list);
});

// ESP polling endpoint
// GET /api/esp/poll/:deviceId
// returns { hasMessage: bool, message: {...} }
app.get("/api/esp/poll/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  // find latest not-listened message for that device (or for "all")
  const msg = await Message.findOne({
    listened: false,
    $or: [{ deviceId }, { deviceId: "all" }]
  }).sort({ createdAt: -1 });
  if (!msg) return res.json({ hasMessage: false });
  // return minimal fields
  return res.json({
    hasMessage: true,
    message: {
      id: msg._id,
      title: msg.title,
      voice: msg.audioPath,    // e.g. /uploads/xyz.mp3 or /music/alarrm.mp3
      alarmAt: msg.alarmAt
    }
  });
});

// ESP confirmation when button pressed
app.post("/api/listened", express.json(), async (req, res) => {
  const { messageId, deviceId } = req.body || {};
  if (!messageId) return res.status(400).json({ error: "messageId required" });
  const msg = await Message.findById(messageId);
  if (!msg) return res.status(404).json({ error: "msg not found" });
  msg.listened = true;
  msg.listenedAt = new Date();
  await msg.save();
  // optionally notify owner via DB or push - we just return success
  res.json({ ok: true });
});

/* ===== Fallback: serve index.html for SPA routes ===== */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

/* ===== Start server ===== */
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

