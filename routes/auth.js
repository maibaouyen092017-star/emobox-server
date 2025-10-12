// routes/auth.js
import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = express.Router();

// ============================
// 🔧 Mongoose User Schema
// ============================
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
});

const User = mongoose.model("User", userSchema);

// ============================
// 📝 Đăng ký tài khoản
// ============================
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: "Thiếu thông tin!" });

    const existing = await User.findOne({ username });
    if (existing)
      return res.status(400).json({ success: false, message: "Tài khoản đã tồn tại!" });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashed });

    res.status(200).json({ success: true, message: "Đăng ký thành công!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Lỗi server!" });
  }
});

// ============================
// 🔑 Đăng nhập tài khoản
// ============================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: "Thiếu thông tin!" });

    const user = await User.findOne({ username });
    if (!user)
      return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu!" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ success: false, message: "Sai tài khoản hoặc mật khẩu
