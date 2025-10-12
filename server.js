const express = require("express");
const multer = require("multer");
const path = require("path");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = express();

dotenv.config();
const PORT = process.env.PORT || 3000;

// ======= MongoDB setup =======
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// Schema người dùng
const UserSchema = new mongoose.Schema({
  username: String,
  password: String
});
const User = mongoose.model("User", UserSchema);

// Schema báo thức
const AlarmSchema = new mongoose.Schema({
  user: String,
  name: String,
  time: String,
  voicePath: String
});
const Alarm = mongoose.model("Alarm", AlarmSchema);

// ======= Middlewares =======
app.use(express.static("."));
app.use("/music", express.static("music"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======= Ghi âm upload =======
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ======= API =======

// Đăng ký tài khoản
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  if (await User.findOne({ username })) return res.status(400).json({ msg: "Tài khoản đã tồn tại" });
  await User.create({ username, password });
  res.json({ msg: "Đăng ký thành công" });
});

// Đăng nhập
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (!user) return res.status(401).json({ msg: "Sai tài khoản hoặc mật khẩu" });
  res.json({ msg: "Đăng nhập thành công", username });
});

// Upload file ghi âm
app.post("/upload", upload.single("audio"), (req, res) => {
  res.json({ path: req.file.path });
});

// Tạo báo thức
app.post("/alarm", async (req, res) => {
  const { user, name, time, voicePath } = req.body;
  await Alarm.create({ user, name, time, voicePath });
  res.json({ msg: "Báo thức đã lưu!" });
});

// Lấy danh sách báo thức
app.get("/alarms/:user", async (req, res) => {
  const alarms = await Alarm.find({ user: req.params.user });
  res.json(alarms);
});

app.listen(PORT, () => console.log(`🚀 Server chạy tại http://localhost:${PORT}`));
