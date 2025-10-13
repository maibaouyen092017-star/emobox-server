// =============================
// 🎙️ EMOBOX CLIENT (Web) — Thu âm, gửi trực tiếp, hẹn giờ
// =============================

const API_BASE = "https://emobox-server.onrender.com"; // 🔗 URL server backend
let mediaRecorder, audioChunks = [], audioBlob = null;

// =============================
// 🎧 Ghi âm & xem trước
// =============================
document.getElementById("recordBtn").addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      const url = URL.createObjectURL(audioBlob);
      const audio = document.getElementById("audioPreview");
      audio.src = url;
      audio.controls = true;
      document.getElementById("status").innerText = "🎧 Ghi âm xong!";
    };

    mediaRecorder.start();
    document.getElementById("status").innerText = "🎙️ Đang ghi âm...";
  } catch (err) {
    alert("❌ Không thể truy cập micro: " + err.message);
  }
});

document.getElementById("stopBtn").addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    document.getElementById("status").innerText = "🛑 Dừng ghi âm...";
  }
});

// =============================
// ⚡ Gửi ngay (realtime tới ESP32 qua server)
// =============================
document.getElementById("sendNowBtn").addEventListener("click", async () => {
  if (!audioBlob) return alert("⚠️ Bạn cần ghi âm trước khi gửi!");

  const fd = new FormData();
  fd.append("file", audioBlob, "voice.webm");

  document.getElementById("status").innerText = "🚀 Đang gửi âm thanh...";

  try {
    const res = await fetch(`${API_BASE}/api/upload-voice`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("status").innerText = "✅ Gửi thành công!";
    } else {
      document.getElementById("status").innerText =
        "❌ Gửi thất bại: " + data.message;
    }
  } catch (err) {
    console.error(err);
    document.getElementById("status").innerText = "⚠️ Lỗi kết nối server!";
  }
});

// =============================
// ⏰ Hẹn giờ gửi báo thức (voice + MQTT)
// =============================
document.getElementById("scheduleBtn").addEventListener("click", async () => {
  const title = document.getElementById("title").value || "Báo thức không tên";
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;

  if (!date || !time) return alert("⚠️ Vui lòng chọn ngày và giờ!");
  if (!audioBlob) return alert("⚠️ Hãy ghi âm trước khi hẹn giờ!");

  const fd = new FormData();
  fd.append("title", title);
  fd.append("date", date);
  fd.append("time", time);
  fd.append("file", audioBlob, "voice.webm");

  document.getElementById("status").innerText = "🕒 Đang tạo báo thức...";

  try {
    const res = await fetch(`${API_BASE}/api/alarms`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json();

    if (data.success) {
      document.getElementById("status").innerText =
        "✅ Đặt báo thức thành công!";
    } else {
      document.getElementById("status").innerText =
        "❌ Lỗi: " + (data.message || "Không thể tạo báo thức!");
    }
  } catch (err) {
    document.getElementById("status").innerText = "⚠️ Lỗi kết nối server!";
  }
});
