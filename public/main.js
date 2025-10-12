// main.js
const API = ""; // empty -> same origin (server serves static + api)
let token = localStorage.getItem("emobox_token") || null;
let currentBlob = null;
let mediaRecorder = null;
let audioPlayer = document.getElementById("player");

function setAuthUI(user) {
  if (user) {
    document.getElementById("authArea").classList.add("d-none");
    document.getElementById("userArea").classList.remove("d-none");
    document.getElementById("userName").innerText = user.name || user.email;
  } else {
    document.getElementById("authArea").classList.remove("d-none");
    document.getElementById("userArea").classList.add("d-none");
  }
}

async function signup(name, email, pass) {
  const r = await fetch("/api/signup", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({name, email, password: pass})
  });
  return r.json();
}
async function login(email, pass) {
  const r = await fetch("/api/login", {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({email, password: pass})
  });
  return r.json();
}

document.getElementById("btnSignup").onclick = () => {
  showAuthModal("signup");
}
document.getElementById("btnLogin").onclick = () => {
  showAuthModal("login");
}
document.getElementById("btnLogout").onclick = () => {
  localStorage.removeItem("emobox_token");
  token = null;
  setAuthUI(null);
};

function showAuthModal(mode="login") {
  const authModal = new bootstrap.Modal(document.getElementById("authModal"));
  document.getElementById("authTitle").innerText = mode==="login"?"Đăng nhập":"Đăng ký";
  document.getElementById("authName").style.display = mode==="login" ? "none":"block";
  document.getElementById("authSubmit").onclick = async () => {
    const name = document.getElementById("authName").value;
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPassword").value;
    if (mode==="signup") {
      const res = await signup(name, email, pass);
      if (res.token) { token = res.token; localStorage.setItem("emobox_token", token); setAuthUI(res.user); authModal.hide(); fetchMessages(); }
      else alert(res.error||"Lỗi");
    } else {
      const res = await login(email, pass);
      if (res.token) { token = res.token; localStorage.setItem("emobox_token", token); setAuthUI(res.user); authModal.hide(); fetchMessages(); }
      else alert(res.error||"Lỗi đăng nhập");
    }
  };
  authModal.show();
}

/* ---------- recorder ---------- */
const btnRecord = document.getElementById("btnRecord");
const btnStop = document.getElementById("btnStop");
const btnSend = document.getElementById("btnSend");

btnRecord.onclick = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    const chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
      currentBlob = new Blob(chunks, { type: "audio/webm" });
      audioPlayer.src = URL.createObjectURL(currentBlob);
      btnSend.disabled = false;
    };
    mediaRecorder.start();
    btnRecord.disabled = true; btnStop.disabled = false;
  } catch (e) { alert("Không thể truy cập micro: " + e.message); }
};
btnStop.onclick = () => {
  if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
  btnRecord.disabled = false; btnStop.disabled = true;
};

btnSend.onclick = async () => {
  if (!token) return alert("Vui lòng đăng nhập để gửi.");
  if (!currentBlob) return alert("Không có file ghi âm.");
  const form = new FormData();
  form.append("voice", currentBlob, "voice.webm");
  const res = await fetch("/api/upload", { method: "POST", headers: { "Authorization": "Bearer " + token }, body: form });
  const j = await res.json();
  if (j.path) {
    // create message
    const deviceId = "all"; // or choose a device id input if you have
    const title = document.getElementById("alarmTitle").value || "Lời nhắn";
    const alarmAtVal = document.getElementById("alarmTime").value;
    const body = { deviceId, title, audioPath: j.path, alarmAt: alarmAtVal || null };
    const create = await fetch("/api/set-alarm", { method:"POST", headers: {"Content-Type":"application/json","Authorization":"Bearer " + token}, body: JSON.stringify(body) });
    const result = await create.json();
    if (result.ok) { alert("Gửi thành công"); fetchMessages(); currentBlob = null; audioPlayer.src = ""; btnSend.disabled = true; }
    else alert("Lỗi gửi: " + (result.error||""));
  } else alert("Upload thất bại");
};

/* ---------- show messages list ---------- */
async function fetchMessages() {
  if (!token) return;
  const r = await fetch("/api/messages", { headers: { "Authorization": "Bearer " + token } });
  const arr = await r.json();
  const list = document.getElementById("messagesList");
  list.innerHTML = "";
  arr.forEach(m => {
    const el = document.createElement("div");
    el.className = "list-group-item";
    el.innerHTML = `<div class="d-flex justify-content-between">
      <div><strong>${m.title}</strong><div class="small text-muted">${new Date(m.createdAt).toLocaleString()}</div></div>
      <div>
        <audio controls src="${m.audioPath}" style="width:160px"></audio>
        <div class="small mt-1">${m.listened ? '<span class="badge bg-success">Đã nghe</span>' : '<span class="badge bg-warning">Chưa nghe</span>'}</div>
      </div>
    </div>`;
    list.appendChild(el);
  });
}

/* ---------- set alarm default (using existing alarrm.mp3) ---------- */
document.getElementById("btnSetAlarm").onclick = async () => {
  if (!token) return alert("Đăng nhập đi!");
  const deviceId = "all";
  const title = document.getElementById("alarmTitle").value || "Chuông báo";
  const alarmAt = document.getElementById("alarmTime").value || null;
  // use default alarm in /music/alarrm.mp3
  const body = { deviceId, title, audioPath: "/music/alarrm.mp3", alarmAt };
  const res = await fetch("/api/set-alarm", { method: "POST", headers: {"Content-Type":"application/json","Authorization":"Bearer " + token}, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.ok) { alert("Đặt báo thức thành công!"); fetchMessages(); } else alert("Lỗi");
};

/* ---------- init ---------- */
setAuthUI(token ? {name:"Bạn"}: null);
if (token) fetchMessages();
