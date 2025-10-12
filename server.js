// server.js
import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();
const PORT = process.env.PORT || 3000;
const MONGO = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "devsecret";

const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*" }
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// === Static and middlewares ===
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));         // serve index.html, style.css, main.js
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/music", express.static(path.join(__dirname, "music")));

// === MongoDB connect ===
if (!MONGO) {
  console.error("MONGO_URI missing in .env");
  process.exit(1);
}
mongoose.connect(MONGO).then(() => console.log("✅ MongoDB connected"))
  .catch(err => { console.error("Mongo err", err); process.exit(1); });

// === Schemas ===
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  passwordHash: String,
  name: String
});
const User = mongoose.model("User", userSchema);

const messageSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  deviceId: { type: String, default: "all" }, // target device or "all"
  title: String,
  audioPath: String,   // /uploads/xxx or /music/alarrm.mp3
  type: { type: String, enum: ["realtime","scheduled"], default: "realtime" },
  alarmAt: Date,       // for scheduled alarms
  listened: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
const Message = mongoose.model("Message", messageSchema);

// === Multer ===
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, "uploads")),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g,"_"))
});
const upload = multer({ storage });

// === Auth helpers ===
function signToken(user) {
  return jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: "30d" });
}
async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ error: "No auth" });
  const token = h.split(" ")[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(data.id);
    if (!user) return res.status(401).json({ error: "Invalid user" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// === Routes: Auth ===
app.post("/api/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password) return res.status(400).json({ error: "email+password required" });
  if (await User.findOne({ email })) return res.status(400).json({ error: "Email exists" });
  const hash = await bcrypt.hash(password, 10);
  const u = new User({ email, passwordHash: hash, name });
  await u.save();
  const token = signToken(u);
  res.json({ token, user: { id: u._id, email: u.email, name: u.name } });
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const u = await User.findOne({ email });
  if (!u) return res.status(400).json({ error: "Invalid credentials" });
  const ok = await bcrypt.compare(password, u.passwordHash);
  if (!ok) return res.status(400).json({ error: "Invalid credentials" });
  const token = signToken(u);
  res.json({ token, user: { id: u._id, email: u.email, name: u.name } });
});

// === Routes: Realtime send-now (upload voice + emit to device) ===
// Client posts multipart/form-data: file field "voice", fields: deviceId (optional), title
app.post("/api/send-now", authMiddleware, upload.single("voice"), async (req, res) => {
  try {
    const deviceId = req.body.deviceId || "all";
    const title = req.body.title || "Lời nhắn ngay";
    const audioPath = req.file ? "/uploads/" + req.file.filename : null;
    if (!audioPath) return res.status(400).json({ error: "voice required" });

    const msg = new Message({
      owner: req.user._id,
      deviceId,
      title,
      audioPath,
      type: "realtime"
    });
    await msg.save();

    // Emit via socket.io to device room
    io.to(deviceId).emit("realtime-message", {
      id: msg._id.toString(),
      title: msg.title,
      voice: msg.audioPath
    });

    res.json({ ok: true, message: msg });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "upload failed" });
  }
});

// === Routes: Set scheduled alarm (upload voice + date-time) ===
app.post("/api/set-alarm", authMiddleware, upload.single("voice"), async (req, res) => {
  try {
    const { deviceId = "all", title = "Báo thức", alarmAt } = req.body;
    if (!req.file) return res.status(400).json({ error: "voice required" });
    if (!alarmAt) return res.status(400).json({ error: "alarmAt required" }); // ISO string or css datetime-local
    const audioPath = "/uploads/" + req.file.filename;
    const msg = new Message({
      owner: req.user._id,
      deviceId,
      title,
      audioPath,
      type: "scheduled",
      alarmAt: new Date(alarmAt)
    });
    await msg.save();
    res.json({ ok: true, message: msg });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "set alarm failed" });
  }
});

// === Route: list messages for user ===
app.get("/api/messages", authMiddleware, async (req, res) => {
  const msgs = await Message.find({ owner: req.user._id }).sort({ createdAt: -1 });
  res.json(msgs);
});

// === ESP Polling: GET latest scheduled or realtime not-listened for device ===
app.get("/api/esp/poll/:deviceId", async (req, res) => {
  const deviceId = req.params.deviceId;
  // First: find any realtime message not listened (type realtime)
  let msg = await Message.findOne({ deviceId: { $in: [deviceId, "all"] }, type: "realtime", listened: false }).sort({ createdAt: -1 });
  if (!msg) {
    // Next: find scheduled messages that are due or past and not listened
    const now = new Date();
    msg = await Message.findOne({
      deviceId: { $in: [deviceId, "all"] },
      type: "scheduled",
      listened: false,
      alarmAt: { $lte: now }
    }).sort({ alarmAt: 1 });
  }
  if (!msg) return res.json({ hasMessage: false });
  return res.json({
    hasMessage: true,
    message: {
      id: msg._id.toString(),
      title: msg.title,
      voice: msg.audioPath,
      alarmAt: msg.alarmAt
    }
  });
});

// === ESP confirm listened ===
app.post("/api/listened", async (req, res) => {
  const { messageId, deviceId } = req.body || {};
  if (!messageId) return res.status(400).json({ error: "messageId required" });
  const msg = await Message.findById(messageId);
  if (!msg) return res.status(404).json({ error: "message not found" });
  msg.listened = true;
  await msg.save();

  // Optionally notify owner via socket (owner room = owner id string)
  if (msg.owner) io.to(msg.owner.toString()).emit("message-listened", { id: msg._id.toString(), deviceId });

  res.json({ ok: true });
});

// === Socket.IO connections ===
// Two kinds of sockets: devices and web users. We use rooms:
// - Device connects and joins room = its deviceId
// - Web user after login can join room = userId to receive notifications (message-listened)
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);
  socket.on("join-device", (deviceId) => {
    socket.join(deviceId);
    console.log("device joined:", deviceId);
  });
  socket.on("join-user", (userId) => {
    socket.join(userId);
    console.log("user joined:", userId);
  });
  socket.on("disconnect", () => {
    // console.log("socket disconnected", socket.id);
  });
});

// fallback SPA route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// start server
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
