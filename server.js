const express = require("express");
const multer = require("multer");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 👉 MongoDB Atlas
mongoose.connect(process.env.MONGO_URL || "mongodb+srv://<your_mongo_url>", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const User = mongoose.model("User", new mongoose.Schema({
  email: String,
  password: String
}));

const File = mongoose.model("File", new mongoose.Schema({
  user: String,
  filename: String
}));

// 👉 Tạo thư mục uploads nếu chưa có
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// 👉 Cấu hình lưu file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// 👉 Gửi file tĩnh (html, css, js)
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/style.css", (_, res) => res.sendFile(path.join(__dirname, "style.css")));
app.get("/main.js", (_, res) => res.sendFile(path.join(__dirname, "main.js")));

// 👉 API Đăng ký
app.post("/api/signup", async (req, res) => {
  const { email, password } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.json({ msg: "Email đã tồn tại!" });
  await User.create({ email, password });
  res.json({ msg: "Đăng ký thành công!" });
});

// 👉 API Đăng nhập
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  if (!user) return res.json({ msg: "Sai tài khoản hoặc mật khẩu!" });
  res.json({ msg: "Đăng nhập thành công", user: user.email });
});

// 👉 API Upload file ghi âm
app.post("/api/upload", upload.single("file"), async (req, res) => {
  const { user } = req.body;
  await File.create({ user, filename: req.file.filename });
  res.json({ msg: "Tải lên thành công!" });
});

// 👉 API Lấy danh sách file của user
app.get("/api/files/:user", async (req, res) => {
  const files = await File.find({ user: req.params.user });
  res.json(files);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Emobox server chạy tại cổng ${PORT}`));
