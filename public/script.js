// script.js - EmoBox frontend
const API_BASE = window.location.origin; // deploy cùng domain
let mediaRecorder, alarmRecorder;
let chunks = [], alarmChunks = [];
let audioBlob = null, alarmBlob = null;

// ---------- MIME Helper ----------
function getSupportedMimeType() {
  const types = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/aac"];
  for (let t of types)
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t))
      return t;
  return "audio/webm";
}

async function startRecording(onStop, arr) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = getSupportedMimeType();
  const mr = new MediaRecorder(stream, { mimeType: mime });
  mr.ondataavailable = e => arr.push(e.data);
  mr.onstop = () => {
    const blob = new Blob(arr, { type: mime });
    onStop(blob);
    stream.getTracks().forEach(t => t.stop());
  };
  mr.start();
  return mr;
}

// ---------- Realtime message ----------
document.getElementById("recordBtn").onclick = async () => {
  chunks = [];
  mediaRecorder = await startRecording(b => {
    audioBlob = b;
    const p = document.getElementById("audioPlayer");
    p.src = URL.createObjectURL(b);
    p.load();
  }, chunks);
};
document.getElementById("stopBtn").onclick = () => mediaRecorder?.stop();

document.getElementById("sendBtn").onclick = async () => {
  if (!audioBlob) return alert("Chưa ghi âm!");
  const title = document.getElementById("msgTitle").value || "Lời nhắn";
  const fd = new FormData();
  fd.append("title", title);
  fd.append("type", "message");
  fd.append("file", audioBlob, "voice.webm");

  const res = await fetch(`${API_BASE}/api/messages/realtime`, {
    method: "POST",
    body: fd,
  });
  if (res.ok) {
    alert("Đã gửi realtime");
    loadMessages();
    audioBlob = null;
    document.getElementById("audioPlayer").src = "";
  } else alert("Gửi thất bại");
};

// ---------- Alarm ----------
document.getElementById("alarmRecordBtn").onclick = async () => {
  alarmChunks = [];
  alarmRecorder = await startRecording(b => {
    alarmBlob = b;
    const p = document.getElementById("alarmAudio");
    p.src = URL.createObjectURL(b);
    p.load();
  }, alarmChunks);
};
document.getElementById("alarmStopBtn").onclick = () => alarmRecorder?.stop();

document.getElementById("saveAlarmBtn").onclick = async () => {
  if (!alarmBlob) return alert("Chưa ghi âm báo thức");
  const date = document.getElementById("alarmDate").value;
  const time = document.getElementById("alarmTime").value;
  if (!date || !time) return alert("Chọn ngày giờ");
  const title = document.getElementById("alarmTitle").value || "Báo thức";

  const fd = new FormData();
  fd.append("title", title);
  fd.append("date", date);
  fd.append("time", time);
  fd.append("type", "alarm");
  fd.append("file", alarmBlob, "alarm.webm");

  const res = await fetch(`${API_BASE}/api/alarms`, { method: "POST", body: fd });
  if (res.ok) {
    alert("Đã lưu báo thức");
    loadMessages();
    alarmBlob = null;
    document.getElementById("alarmAudio").src = "";
  } else alert("Lưu thất bại");
};

// ---------- Load messages ----------
async function loadMessages() {
  const res = await fetch(`${API_BASE}/api/messages`);
  if (!res.ok) return;
  const data = await res.json();
  const list = document.getElementById("messageList");
  list.innerHTML = "";
  data.forEach(m => {
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `
      <b>${escapeHtml(m.title)}</b>
      <div class="meta">${new Date(m.createdAt).toLocaleString()} • ${m.type}</div>
      ${m.fileUrl ? `<audio controls src="${m.fileUrl}"></audio>` : ""}
      ${m.type === "alarm" ? `<button onclick="deleteAlarm('${m._id}')">❌ Xóa</button>` : ""}
      <div><small>Trạng thái: ${m.heard ? "Đã nghe" : "Chưa nghe"}</small></div>
    `;
    list.appendChild(div);
  });
}
function escapeHtml(s) {
  return (s || "").replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[c]);
}
window.onload = loadMessages;

async function deleteAlarm(id) {
  if (!confirm("Xóa báo thức?")) return;
  const res = await fetch(`${API_BASE}/api/alarms/${id}`, { method: "DELETE" });
  if (res.ok) loadMessages();
  else alert("Xóa thất bại");
}
window.deleteAlarm = deleteAlarm;
// 🔔 Lấy danh sách báo thức đã lưu và hiển thị
async function loadAlarms() {
  const listContainer = document.getElementById("alarmList");
  if (!listContainer) return;

  const res = await fetch("https://emobox-server.onrender.com/api/alarms");
  const alarms = await res.json();

  listContainer.innerHTML = alarms
    .map(
      (a) => `
        <div class="alarm-item">
          <b>${a.title || "Không tiêu đề"}</b><br>
          📅 ${a.date} 🕒 ${a.time}<br>
          🔊 <audio controls src="${a.fileUrl}" style="width: 200px"></audio>
        </div>
      `
    )
    .join("");
}

// Gọi khi load trang
window.addEventListener("load", loadAlarms);

