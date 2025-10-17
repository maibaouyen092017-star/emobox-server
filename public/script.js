// ============================
// 🎙️ EmoBox Frontend Script (Fixed)
// ============================
console.log("✅ EmoBox script.js loaded");

// ⚡ Kết nối socket.io tới backend
const socket = io("https://emobox-server.onrender.com"); // chỉnh nếu backend URL khác
const API_BASE = "https://emobox-server.onrender.com"; 

// -----------------------------
// 🔔 Realtime: Nhận sự kiện từ ESP
// -----------------------------
socket.on("voiceHeard", (data) => {
  console.log("✅ Voice heard:", data);
  const el = document.querySelector(`[data-id="${data.id}"] .alarm-status`);
  if (el) {
    el.textContent = "✅ Đã nhận";
    el.classList.remove("pending");
    el.classList.add("heard");
  }
});

socket.on("alarmHeard", (data) => {
  console.log("⏰ Alarm heard:", data);
  const el = document.querySelector(`[data-id="${data.id}"] .alarm-status`);
  if (el) {
    el.textContent = "✅ Đã nhận";
    el.classList.remove("pending");
    el.classList.add("heard");
  }
});

// --- Refs
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const sendBtn = document.getElementById("sendBtn");
const msgTitle = document.getElementById("msgTitle");
const audioPlayer = document.getElementById("audioPlayer");

const alarmRecordBtn = document.getElementById("alarmRecordBtn");
const alarmStopBtn = document.getElementById("alarmStopBtn");
const saveAlarmBtn = document.getElementById("saveAlarmBtn");
const alarmAudio = document.getElementById("alarmAudio");
const alarmDate = document.getElementById("alarmDate");
const alarmTime = document.getElementById("alarmTime");
const alarmTitle = document.getElementById("alarmTitle");
const alarmList = document.getElementById("alarmList");

// --- States
let mediaRecorder, audioChunks = [];
let alarmRecorder, alarmChunks = [];
let voiceBlob, alarmBlob;

// -----------------------------
// 🔊 Helper: MIME phù hợp
// -----------------------------
function getSupportedMime() {
  const list = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const t of list) if (MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

// -----------------------------
// 🎤 Ghi realtime
// -----------------------------
recordBtn?.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream, { mimeType: getSupportedMime() });
    audioChunks = [];
    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = () => {
      voiceBlob = new Blob(audioChunks, { type: "audio/webm" });
      audioPlayer.src = URL.createObjectURL(voiceBlob);
      console.log("✅ Ghi xong tin nhắn realtime");
    };
    mediaRecorder.start();
    recordBtn.disabled = true;
    stopBtn.disabled = false;
    console.log("🎙️ Bắt đầu ghi realtime...");
  } catch (err) {
    alert("Không truy cập được micro!");
    console.error(err);
  }
});

stopBtn?.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    recordBtn.disabled = false;
    stopBtn.disabled = true;
  }
});

// 📤 Gửi tin nhắn realtime
sendBtn?.addEventListener("click", async () => {
  if (!voiceBlob) return alert("Bạn chưa ghi âm tin nhắn!");
  sendBtn.disabled = true;

  const fd = new FormData();
  fd.append("voice", voiceBlob, "message.webm");
  fd.append("title", msgTitle.value || "Tin nhắn mới");

  try {
    const res = await fetch(`${API_BASE}/api/upload-voice`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.success) {
      alert("📨 Gửi tin nhắn thành công!");
      console.log("📢 MQTT realtime:", data);
      voiceBlob = null;
      audioPlayer.src = "";
      msgTitle.value = "";
    } else alert("Gửi thất bại!");
  } catch (err) {
    console.error(err);
    alert("Không thể gửi đến server!");
  } finally {
    sendBtn.disabled = false;
  }
});

// -----------------------------
// ⏰ Báo thức
// -----------------------------
alarmRecordBtn?.addEventListener("click", async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    alarmRecorder = new MediaRecorder(stream, { mimeType: getSupportedMime() });
    alarmChunks = [];
    alarmRecorder.ondataavailable = e => alarmChunks.push(e.data);
    alarmRecorder.onstop = () => {
      alarmBlob = new Blob(alarmChunks, { type: "audio/webm" });
      alarmAudio.src = URL.createObjectURL(alarmBlob);
      console.log("✅ Ghi âm báo thức xong");
    };
    alarmRecorder.start();
    alarmRecordBtn.disabled = true;
    alarmStopBtn.disabled = false;
  } catch (err) {
    alert("Không truy cập được micro!");
    console.error(err);
  }
});

alarmStopBtn?.addEventListener("click", () => {
  if (alarmRecorder && alarmRecorder.state === "recording") {
    alarmRecorder.stop();
    alarmRecordBtn.disabled = false;
    alarmStopBtn.disabled = true;
  }
});

// 💾 Lưu báo thức
saveAlarmBtn?.addEventListener("click", async () => {
  if (!alarmBlob) return alert("Bạn chưa ghi âm báo thức!");
  if (!alarmDate.value || !alarmTime.value) return alert("Nhập ngày & giờ!");

  const fd = new FormData();
  fd.append("voice", alarmBlob, "alarm.webm");
  fd.append("title", alarmTitle.value || "Báo thức");
  fd.append("date", alarmDate.value);
  fd.append("time", alarmTime.value);

  try {
    const res = await fetch(`${API_BASE}/api/alarms`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.success) {
      alert("⏰ Đã lưu báo thức!");
      alarmBlob = null;
      alarmAudio.src = "";
      alarmTitle.value = "";
      loadAlarms();
    } else alert("Không thể lưu báo thức!");
  } catch (err) {
    console.error(err);
    alert("Lỗi khi lưu báo thức!");
  }
});

// -----------------------------
// 📋 Danh sách báo thức
// -----------------------------
async function loadAlarms() {
  try {
    const res = await fetch(`${API_BASE}/api/alarms`);
    const list = await res.json();
    alarmList.innerHTML = list.map(a => `
      <div class="alarm" data-id="${a._id}">
        <b>${a.title}</b> — ${a.date} ${a.time}
        ${a.fileUrl ? `<audio controls src="${API_BASE}${a.fileUrl}"></audio>` : ""}
        <span class="alarm-status pending">⏳ Chờ ESP</span>
        <button onclick="deleteAlarm('${a._id}')">🗑️ Xóa</button>
      </div>
    `).join("");
  } catch (err) {
    alarmList.innerHTML = "<i>Không thể tải danh sách</i>";
    console.error(err);
  }
}

window.deleteAlarm = async (id) => {
  if (!confirm("Xóa báo thức này?")) return;
  await fetch(`${API_BASE}/api/alarms/${id}`, { method: "DELETE" });
  loadAlarms();
};

// -----------------------------
// 🚀 Khi trang tải xong
// -----------------------------
window.addEventListener("load", () => {
  stopBtn.disabled = true;
  alarmStopBtn.disabled = true;
  loadAlarms();
  console.log("🎉 UI đã sẵn sàng");
});
