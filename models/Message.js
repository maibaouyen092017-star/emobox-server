// models/Message.js
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  email: String,               // người gửi
  file: String,                // tên file ghi âm
  time: { type: Date, default: Date.now },
  listened: { type: Boolean, default: false } // trạng thái: đã nghe hay chưa
});

module.exports = mongoose.model("Message", MessageSchema);
