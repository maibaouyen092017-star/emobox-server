import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
const router = express.Router();

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
});
const User = mongoose.model("User", userSchema);

// Đăng ký
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: "Thiếu thông tin!" });

    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: "Tài khoản đã tồn tại!" });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashed });
    res.status(200).json({ message: "Đăng ký thành công!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server!" });
  }
});

// Đăng nhập
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu!" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu!" });

    res.status(200).json({ message: "Đăng nhập thành công!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi server!" });
  }
});

export default router;
