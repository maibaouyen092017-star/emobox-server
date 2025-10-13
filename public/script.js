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

// ==================== LOGIN / REGISTER (Final Clean) ====================
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginModal = document.getElementById("login-modal");
const registerModal = document.getElementById("register-modal");
const userInfo = document.getElementById("user-info");

function checkLogin() {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (user) {
    userInfo.innerHTML = `
      <span>Xin chào, <b>${user.username}</b></span>
      <button id="logoutBtn" class="btn">Đăng xuất</button>
    `;
    loginBtn.classList.add("hidden");
    registerBtn.classList.add("hidden");
    document.getElementById("logoutBtn").onclick = () => {
      localStorage.removeItem("user");
      location.reload();
    };
  } else {
    loginBtn.classList.remove("hidden");
    registerBtn.classList.remove("hidden");
  }
}

loginBtn.onclick = () => {
  loginModal.classList.remove("hidden");
  registerModal.classList.add("hidden");
};
registerBtn.onclick = () => {
  registerModal.classList.remove("hidden");
  loginModal.classList.add("hidden");
};

document.getElementById("switchToRegister").onclick = () => {
  loginModal.classList.add("hidden");
  registerModal.classList.remove("hidden");
};
document.getElementById("switchToLogin").onclick = () => {
  registerModal.classList.add("hidden");
  loginModal.classList.remove("hidden");
};

document.getElementById("doLogin").onclick = async () => {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  if (!username || !password) return alert("Vui lòng nhập đủ thông tin!");

  const res = await fetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem("user", JSON.stringify({ username }));
    loginModal.classList.add("hidden");
    checkLogin();
  } else {
    alert(data.message || "Sai tài khoản hoặc mật khẩu!");
  }
};

document.getElementById("doRegister").onclick = async () => {
  const username = document.getElementById("reg-username").value.trim();
  const password = document.getElementById("reg-password").value.trim();
  if (!username || !password) return alert("Vui lòng nhập đủ thông tin!");

  const res = await fetch("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.success) {
    alert("Đăng ký thành công! Hãy đăng nhập.");
    registerModal.classList.add("hidden");
    loginModal.classList.remove("hidden");
  } else {
    alert(data.message || "Tên tài khoản đã tồn tại");
  }
};

checkLogin();
console.log("✅ EmoBox frontend loaded");
