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
// ==================== LOGIN / REGISTER (Final clean version) ====================

// --- Elements ---
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const userInfo = document.getElementById('user-info');

// --- Modal Tạo bằng JS (hoặc HTML sẵn) ---
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');

// --- Kiểm tra trạng thái đăng nhập ---
function checkLogin() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user) {
    // Hiện tên + nút đăng xuất
    userInfo.classList.remove('hidden');
    userInfo.innerHTML = `
      <span>Xin chào, <b>${user.username}</b></span>
      <button id="logoutBtn" class="btn">Đăng xuất</button>
    `;
    loginBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    document.getElementById('logoutBtn').onclick = () => {
      localStorage.removeItem('user');
      location.reload();
    };
  } else {
    // Chưa đăng nhập
    userInfo.classList.add('hidden');
    loginBtn.style.display = 'inline-block';
    registerBtn.style.display = 'inline-block';
  }
}

// --- Mở modal ---
loginBtn.onclick = () => {
  loginModal.classList.remove('hidden');
  registerModal.classList.add('hidden');
};
registerBtn.onclick = () => {
  registerModal.classList.remove('hidden');
  loginModal.classList.add('hidden');
};

// --- Chuyển qua lại ---
document.getElementById('switchToRegister').onclick = () => {
  loginModal.classList.add('hidden');
  registerModal.classList.remove('hidden');
};
document.getElementById('switchToLogin').onclick = () => {
  registerModal.classList.add('hidden');
  loginModal.classList.remove('hidden');
};

// --- Gửi đăng nhập ---
document.getElementById('doLogin').onclick = async () => {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  if (!username || !password) return alert('Vui lòng nhập đủ thông tin');

  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (data.success) {
    localStorage.setItem('user', JSON.stringify({ username }));
    loginModal.classList.add('hidden');
    checkLogin();
  } else {
    alert(data.message || 'Sai tài khoản hoặc mật khẩu');
  }
};

// --- Gửi đăng ký ---
document.getElementById('doRegister').onclick = async () => {
  const username = document.getElementById('reg-username').value.trim();
  const password = document.getElementById('reg-password').value.trim();
  if (!username || !password) return alert('Vui lòng nhập đủ thông tin');

  const res = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (data.success) {
    alert('Đăng ký thành công! Hãy đăng nhập.');
    registerModal.classList.add('hidden');
    loginModal.classList.remove('hidden');
  } else {
    alert(data.message || 'Tên tài khoản đã tồn tại');
  }
};

// --- Gọi khi tải trang ---
checkLogin();

