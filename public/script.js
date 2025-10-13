console.log("🎧 EmoBox script loaded!");

const API_URL = "https://emobox-server.onrender.com";
let mediaRecorder;
let audioChunks = [];
let recordedBlob = null;

// ==========================
// 🎤 GHI ÂM TIN NHẮN NGAY
// ==========================
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const sendBtn = document.getElementById("sendBtn");
const msgTitle = document.getElementById("msgTitle");
const audioPlayer = document.getElementById("audioPlayer");

// bắt đầu ghi âm
recordBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      recordedBlob = new Blob(audioChunks, { type: "audio/webm" });
      audioPlayer.src = URL.createObjectURL(recordedBlob);
      console.log("✅ Ghi âm xong, có thể nghe lại hoặc gửi.");
    };

    mediaRecorder.start();
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    console.log("🎙️ Đang ghi âm...");
  } catch (err) {
    alert("Không thể truy cập micro! Kiểm tra quyền truy cập.");
    console.error(err);
  }
});

// dừng ghi âm
stopBtn.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  }
});

// gửi voice realtime đến server
sendBtn.addEventListener("click", async () => {
  if (!recordedBlob) return alert("Bạn chưa ghi âm!");
  const title = msgTitle.value.trim() || "Tin nhắn không tiêu đề";

  const formData = new FormData();
  formData.append("file", recordedBlob, `${Date.now()}.webm`);
  formData.append("title", title);

  try {
    const res = await fetch(`${API_URL}/api/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      alert("✅ Đã gửi thành công!");
      console.log("📡 Server response:", data);
    } else {
      alert("❌ Gửi thất bại!");
    }
  } catch (err) {
    alert("Lỗi kết nối server!");
    console.error(err);
  }
});

// ==========================
// ⏰ GHI ÂM & LƯU BÁO THỨC
// ==========================
const alarmRecordBtn = document.getElementById("alarmRecordBtn");
const alarmStopBtn = document.getElementById("alarmStopBtn");
const saveAlarmBtn = document.getElementById("saveAlarmBtn");
const alarmDate = document.getElementById("alarmDate");
const alarmTime = document.getElementById("alarmTime");
const alarmTitle = document.getElementById("alarmTitle");
const alarmAudio = document.getElementById("alarmAudio");

let alarmRecorder, alarmChunks = [], alarmBlob = null;

alarmRecordBtn.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    alarmRecorder = new MediaRecorder(stream);
    alarmChunks = [];

    alarmRecorder.ondataavailable = (e) => alarmChunks.push(e.data);
    alarmRecorder.onstop = () => {
      alarmBlob = new Blob(alarmChunks, { type: "audio/webm" });
      alarmAudio.src = URL.createObjectURL(alarmBlob);
      console.log("✅ Đã thu âm báo thức.");
    };

    alarmRecorder.start();
    alarmRecordBtn.disabled = true;
    alarmStopBtn.disabled = false;
  } catch (err) {
    alert("Không thể bật micro cho báo thức!");
  }
});

alarmStopBtn.addEventListener("click", () => {
  if (alarmRecorder && alarmRecorder.state === "recording") {
    alarmRecorder.stop();
    alarmRecordBtn.disabled = false;
    alarmStopBtn.disabled = true;
  }
});

saveAlarmBtn.addEventListener("click", async () => {
  if (!alarmBlob) return alert("Chưa có file ghi âm!");
  if (!alarmDate.value || !alarmTime.value) return alert("Thiếu ngày hoặc giờ!");

  const formData = new FormData();
  formData.append("title", alarmTitle.value.trim() || "Báo thức không tên");
  formData.append("date", alarmDate.value);
  formData.append("time", alarmTime.value);
  formData.append("file", alarmBlob, `${Date.now()}_alarm.webm`);

  try {
    const res = await fetch(`${API_URL}/api/alarms`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      alert("✅ Đã lưu báo thức!");
      loadAlarms();
    } else {
      alert("❌ Lỗi khi lưu báo thức!");
    }
  } catch (err) {
    console.error(err);
    alert("Lỗi server khi lưu báo thức!");
  }
});

// ==========================
// 📋 HIỂN THỊ DANH SÁCH
// ==========================
async function loadAlarms() {
  try {
    const res = await fetch(`${API_URL}/api/alarms`);
    const alarms = await res.json();
    const list = document.getElementById("alarmList");
    list.innerHTML = alarms.map(a => `
      <div class="alarm">
        <b>${a.title}</b> - ${a.date} ${a.time}
        ${a.fileUrl ? `<audio controls src="${API_URL + a.fileUrl}"></audio>` : ""}
      </div>
    `).join("");
  } catch (err) {
    console.error("Lỗi tải báo thức:", err);
  }
}
window.addEventListener("load", loadAlarms);
