// server.js
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static("public"));

// Cấu hình lưu file âm thanh
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Upload file âm thanh
app.post("/upload", upload.single("audio"), (req, res) => {
  console.log("Đã nhận file:", req.file.filename);
  res.json({ success: true, filename: req.file.filename });
});

// Lấy file âm thanh mới nhất
app.get("/latest", (req, res) => {
  fs.readdir("./uploads", (err, files) => {
    if (err || files.length === 0) return res.status(404).send("No file");
    const latestFile = files
      .map(f => ({ name: f, time: fs.statSync("./uploads/" + f).mtime.getTime() }))
      .sort((a, b) => b.time - a.time)[0].name;
    res.send(latestFile);
  });
});

// ESP32 tải file
app.get("/audio/:name", (req, res) => {
  const filePath = path.join(__dirname, "uploads", req.params.name);
  res.sendFile(filePath);
});

app.listen(PORT, () => console.log(`✅ Server chạy tại http://localhost:${PORT}`));
