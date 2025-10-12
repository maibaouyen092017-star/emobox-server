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

    // Kiểm tra dữ liệu đầu vào
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!",
      });
    }

    // Kiểm tra tài khoản đã tồn tại chưa
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Tên đăng nhập đã tồn tại! Hãy chọn tên khác.",
      });
    }

    // Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tạo người dùng mới
    const newUser = await User.create({
      username,
      password: hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: "Đăng ký thành công! Bạn có thể đăng nhập ngay.",
    });
  } catch (error) {
    console.error("Lỗi đăng ký:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
    });
  }
});

// ============================
// 🔑 Đăng nhập tài khoản
// ============================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng nhập tên đăng nhập và mật khẩu!",
      });
    }

    // Tìm người dùng trong DB
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản không tồn tại. Vui lòng đăng ký trước!",
      });
    }

    // So sánh mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Sai mật khẩu. Vui lòng thử lại!",
      });
    }

    // Tạo JWT token
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
    console.error("Lỗi đăng nhập:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi máy chủ. Vui lòng thử lại sau.",
    });
  }
});

// ============================
// 🚪 Đăng xuất (client tự xoá token)
// ============================
router.post("/logout", (req, res) => {
  // Ở phía client chỉ cần xóa token khỏi localStorage là được
  res.status(200).json({
    success: true,
    message: "Đã đăng xuất thành công!",
  });
});

export default router;
