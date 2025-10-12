// main.js
const socket = io(); // assume same origin
let token = localStorage.getItem("emobox_token") || null;
let user = null;

// UI elements
const btnLogin = document.getElementById("btnLogin");
const btnSignup = document.getElementById("btnSignup");
const btnLogout = document.getElementById("btnLogout");
const navAuth = document.getElementById("navAuth");
const navUser = document.getElementById("navUser");
const navUserName = document.getElementById("navUserName");
const authModalEl = document.getElementById("authModal");
const authModal = new bootstrap.Modal(authModalEl);
let authMode = "login";

// recorder now
let mediaRecorderNow, chunksNow = [];
const btnStartNow = document.getElementById("btnStartNow");
const btnStopNow = document.getElementById("btnStopNow");
const btnSendNow = document.getElementById("btnSendNow");
const audioNow = document.getElementById("audioNow");

// recorder alarm
let mediaRecorderAlarm, chunksAlarm = [];
const btnStartAlarm = document.getElementById("btnStartAlarm");
const btnStopAlarm = document.getElementById("btnStopAlarm");
const btnSetAlarm = document.getElementById("btnSetAlarm");
const audioAlarm = document.getElementById("audioAlarm");

// messages list
const messagesList = document.getElementById("messagesList");

// ---- Auth UI helpers
function showLoggedIn(u) {
  navAuth.classList.add("d-none");
  navUser.classList.remove("d-none");
  navUserName.innerText = u.name || u.email;
}
function showLoggedOut() {
  navAuth.classList.remove("d-none");
  navUser.classList.add("d-none");
  navUserName.innerText = "";
}

// ---- Auth functions
async function signup(name, email, password) {
  const r = await fetch("/api/signup", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name, email, password })
  });
  return r.json();
}
async function login(email, password) {
  const r = await fetch("/api/login", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ email, password })
  });
  return r.json();
}

// show modal handlers
btnSignup.onclick = () => { authMode = "signup"; document.getElementById("authTitle").innerText = "Đăng ký"; document.getElementById("authName").style.display = "block"; authModal.show(); };
btnLogin.onclick = () => { authMode = "login"; document.getElementById("authTitle").innerText = "Đăng nhập"; document.getElementById("authName").style.display = "none"; authModal.show(); };

document.getElementById("authSubmit").onclick = async () => {
  const name = document.getElementById("authName").value;
  const email = document.getElementById("authEmail").value;
  const pwd = document.getElementById("authPassword").value;
  if (authMode === "signup") {
    const res = await signup(name, email, pwd);
    if (res.token) {
      localStorage.setItem("emobox_token", res.token);
      token = res.token; user = res.user;
      authModal.hide();
      showLoggedIn(res.user);
      socket.emit("join-user", res.user.id);
      fetchMessages();
    } else alert(res.error || "Lỗi đăng ký");
  } else {
    const res = await login(email, pwd);
    if (res.token) {
      localStorage.setItem("emobox_token", res.token);
      token = res.token; user = res.user;
      authModal.hide();
      showLoggedIn(res.user);
      socket.emit("join-user", res.user.id);
      fetchMessages();
    } else alert(res.error || "Lỗi đăng nhập");
  }
};

btnLogout.onclick = () => {
  localStorage.removeItem("emobox_token"); token = null; user = null;
  showLoggedOut();
};

// ---- Recorder NOW (realtime)
btnStartNow.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderNow = new MediaRecorder(stream);
    chunksNow = [];
    mediaRecorderNow.ondataavailable = e => chunksNow.push(e.data);
    mediaRecorderNow.onstop = () => {
      const blob = new Blob(chunksNow, { type: "audio/webm" });
      audioNow.src = URL.createObjectURL(blob);
      audioNow.style.display = "block";
      btnSendNow.disabled = false;
    };
    mediaRecorderNow.start();
    btnStartNow.disabled = true; btnStopNow.disabled = false;
  } catch (e) { alert("Không thể truy cập micro: " + e.message); }
};

btnStopNow.onclick = () => {
  if (mediaRecorderNow && mediaRecorderNow.state !== "inactive") mediaRecorderNow.stop();
  btnStartNow.disabled = false; btnStopNow.disabled = true;
};

btnSendNow.onclick = async () => {
  if (!token) return alert("Vui lòng đăng nhập!");
  if (!chunksNow.length) return alert("Chưa có bản ghi!");
  const blob = new Blob(chunksNow, { type: "audio/webm" });
  const fd = new FormData();
  fd.append("voice", blob, "now.webm");
  fd.append("deviceId", document.getElementById("nowDevice").value);
  fd.append("title", document.getElementById("nowTitle").value || "Lời nhắn");
  const res = await fetch("/api/send-now", { method: "POST", headers: { "Authorization": "Bearer " + token }, body: fd });
  const j = await res.json();
  if (j.ok) { alert("Đã gửi realtime!"); fetchMessages(); }
  else alert(j.error || "Gửi thất bại");
};

// ---- Recorder ALARM (scheduled)
btnStartAlarm.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderAlarm = new MediaRecorder(stream);
    chunksAlarm = [];
    mediaRecorderAlarm.ondataavailable = e => chunksAlarm.push(e.data);
    mediaRecorderAlarm.onstop = () => {
      const blob = new Blob(chunksAlarm, { type: "audio/webm" });
      audioAlarm.src = URL.createObjectURL(blob);
      audioAlarm.style.display = "block";
      btnSetAlarm.disabled = false;
    };
    mediaRecorderAlarm.start();
    btnStartAlarm.disabled = true; btnStopAlarm.disabled = false;
  } catch (e) { alert("Không thể truy cập micro: " + e.message); }
};
btnStopAlarm.onclick = () => {
  if (mediaRecorderAlarm && mediaRecorderAlarm.state !== "inactive") mediaRecorderAlarm.stop();
  btnStartAlarm.disabled = false; btnStopAlarm.disabled = true;
};

btnSetAlarm.onclick = async () => {
  if (!token) return alert("Đăng nhập trước");
  if (!chunksAlarm.length) return alert("Chưa ghi âm");
  const date = document.getElementById("alarmDate").value;
  const time = document.getElementById("alarmTime").value;
  if (!date || !time) return alert("Chọn ngày và giờ");
  const alarmAt = new Date(date + "T" + time + ":00").toISOString();

  const blob = new Blob(chunksAlarm, { type: "audio/webm" });
  const fd = new FormData();
  fd.append("voice", blob, "alarm.webm");
  fd.append("deviceId", "all");
  fd.append("title", document.getElementById("alarmTitle").value || "Báo thức");
  fd.append("alarmAt", alarmAt);

  const res = await fetch("/api/set-alarm", { method: "POST", headers: { "Authorization": "Bearer " + token }, body: fd });
  const j = await res.json();
  if (j.ok) { alert("Đã lưu báo thức!"); fetchMessages(); }
  else alert(j.error || "Lưu thất bại");
};

// ---- fetch messages for logged user
async function fetchMessages() {
  if (!token) return;
  const r = await fetch("/api/messages", { headers: { "Authorization": "Bearer " + token } });
  if (!r.ok) return;
  const arr = await r.json();
  messagesList.innerHTML = "";
  arr.forEach(m => {
    const div = document.createElement("div");
    div.className = "mb-2 p-2 bg-white rounded shadow-sm";
    div.innerHTML = `
      <div class="d-flex justify-content-between">
        <div><strong>${m.title}</strong><div class="small text-muted">${new Date(m.createdAt).toLocaleString()}</div></div>
        <div>${m.type === 'scheduled' ? `<div class="small">Alarm: ${m.alarmAt ? new Date(m.alarmAt).toLocaleString() : '-'}</div>` : '<div class="small">Realtime</div>'}
        ${m.listened ? '<span class="badge bg-success">Đã nghe</span>' : '<span class="badge bg-warning">Chưa nghe</span>'}
        </div>
      </div>
      <div class="mt-2"><audio controls src="${m.audioPath}" style="width:100%"></audio></div>
    `;
    messagesList.appendChild(div);
  });
}

// ---- socket.io events
socket.on("connect", () => console.log("socket connected"));
socket.on("realtime-message", (msg) => {
  // show notification to web user and play audio in browser
  console.log("Realtime message", msg);
  alert("Thiết bị nhận lời nhắn realtime (device): " + msg.title);
  const audioUrl = msg.voice;
  const a = new Audio(audioUrl);
  a.play().catch(()=>{ console.log("Autoplay blocked"); });
});
socket.on("message-listened", (d) => {
  // update UI
  fetchMessages();
});

// if token exists, get user info by verifying token decode? We stored user on login returned.
if (token) {
  // try to fetch messages to validate
  fetchMessages();
  // optionally join user room if server will send notifications: decode token not implemented here; after login we store user id returned
  // but we kept user on login response, so join after login.
}

// initial UI state
if (!token) showLoggedOut(); else showLoggedIn({ name: "Bạn" });
// 🧹 Xóa báo thức cũ
document.getElementById("btnClearAlarms")?.addEventListener("click", async () => {
  await fetch("/api/clear-alarms", { method: "DELETE" });
  alert("✅ Đã xóa toàn bộ báo thức cũ!");
  location.reload();
});

// ⚙️ Gửi WiFi config
document.getElementById("btnSendWiFi")?.addEventListener("click", async () => {
  const ssid = document.getElementById("wifiName").value.trim();
  const pass = document.getElementById("wifiPass").value.trim();
  if (!ssid || !pass) return alert("⚠️ Nhập đầy đủ tên và mật khẩu WiFi!");

  await fetch("/api/wifi-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ssid, pass })
  });
  alert("📡 Cấu hình WiFi đã được gửi đến ESP!");
});

// 🔔 Khi ESP gửi xác nhận
async function checkESPStatus() {
  const res = await fetch("/api/esp-status");
  const data = await res.json();
  if (data.heard === true) {
    const notify = document.getElementById("notify");
    notify.classList.remove("d-none");
    setTimeout(() => notify.classList.add("d-none"), 5000);
  }
}
setInterval(checkESPStatus, 5000);

