
import express from "express";
import User from "../models/User.js";
const router = express.Router();

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  const exists = await User.findOne({ email });
  if (exists) return res.status(400).json({ msg: "Email đã tồn tại" });
  const user = new User({ name, email, password });
  await user.save();
  res.json({ msg: "Đăng ký thành công" });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  if (!user) return res.status(400).json({ msg: "Sai thông tin đăng nhập" });
  res.json({ msg: "Đăng nhập thành công", user });
});

export default router;
