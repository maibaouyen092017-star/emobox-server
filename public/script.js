// ================== EmoBox Frontend ==================
const API_BASE = window.location.origin;
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
    loadAlarms();
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
    alert("✅ Đã lưu báo thức");
    alarmBlob = null;
    document.getElementById("alarmAudio").src = "";
    loadAlarms();
  } else alert("❌ Lưu thất bại");
};

// ---------- Hiển thị danh sách báo thức ----------
async function loadAlarms() {
  const listContainer = document.getElementById("alarmList");
  if (!listContainer) return;

  const res = await fetch(`${API_BASE}/api/alarms`);
  if (!res.ok) return;

  const alarms = await res.json();
  listContainer.innerHTML = "";

  alarms.forEach(a => {
    const div = document.createElement("div");
    div.className = "alarm-item";
    div.innerHTML = `
      <div>
        <b>${a.title}</b> - 📅 ${a.date} 🕒 ${a.time}<br>
        🔊 ${a.fileUrl ? `<audio controls src="${a.fileUrl}" style="width:200px"></audio>` : ""}
        <br>Trạng thái: ${a.heard ? "✅ Đã nghe" : "⏰ Chưa nghe"}
      </div>
      <button class="delete-btn" data-id="${a._id}">❌ Xóa</button>
    `;
    listContainer.appendChild(div);
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (!confirm("Xóa báo thức này?")) return;
      await fetch(`${API_BASE}/api/alarms/${id}`, { method: "DELETE" });
      loadAlarms();
    };
  });
}

window.addEventListener("load", loadAlarms);
console.log("✅ EmoBox frontend loaded");
