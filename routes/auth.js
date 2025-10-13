import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js"; // đã định nghĩa trong models/User.js

const router = express.Router();

// 📝 Đăng ký tài khoản
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!",
      });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Tên đăng nhập đã tồn tại! Hãy chọn tên khác.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({ username, password: hashedPassword });

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công! Bạn có thể đăng nhập ngay.",
    });
  } catch (error) {
    console.error("❌ Lỗi đăng ký:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message, // in ra cho debug
    });
  }
});

// 🔑 Đăng nhập tài khoản
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập tên đăng nhập và mật khẩu!",
      });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản không tồn tại. Vui lòng đăng ký trước!",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Sai mật khẩu. Vui lòng thử lại!",
      });
    }

    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET || "emobox_secret",
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công!",
      token,
    });
  } catch (error) {
    console.error("❌ Lỗi đăng nhập:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
      error: error.message,
    });
  }
});

// 🚪 Đăng xuất
router.post("/logout", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Đã đăng xuất thành công!",
  });
});

export default router;
