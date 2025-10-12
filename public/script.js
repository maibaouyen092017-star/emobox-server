// script.js - EmoBox frontend
const API_BASE = window.location.origin; // nếu deploy cùng server
let mediaRecorder, alarmRecorder;
let chunks = [], alarmChunks = [];
let audioBlob = null, alarmBlob = null;

// ---------- mime helper (Safari fix) ----------
function getSupportedMimeType() {
  const types = ["audio/mp4", "audio/aac", "audio/mpeg", "audio/webm"];
  for (let t of types) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
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
    // stop tracks
    stream.getTracks().forEach(t => t.stop());
  };
  mr.start();
  return mr;
}

// ---------- Realtime message ----------
document.getElementById('recordBtn').onclick = async () => {
  chunks = [];
  mediaRecorder = await startRecording(b => {
    audioBlob = b;
    const p = document.getElementById('audioPlayer');
    p.src = URL.createObjectURL(b); p.load();
  }, chunks);
};
document.getElementById('stopBtn').onclick = () => mediaRecorder?.stop();

document.getElementById('sendNowBtn').onclick = async () => {
  if (!audioBlob) return alert('Chưa ghi âm!');
  const title = document.getElementById('msgTitle').value || 'Lời nhắn';
  const fd = new FormData();
  fd.append('title', title);
  fd.append('type', 'message'); // realtime
  fd.append('file', audioBlob, 'voice.webm');

  const res = await fetch(`${API_BASE}/api/messages/realtime`, { method: 'POST', body: fd });
  if (res.ok) { alert('Đã gửi realtime'); loadMessages(); audioBlob=null; document.getElementById('audioPlayer').src=''; }
  else alert('Gửi thất bại');
};

// ---------- Alarm record ----------
document.getElementById('alarmRecordBtn').onclick = async () => {
  alarmChunks = [];
  alarmRecorder = await startRecording(b => {
    alarmBlob = b;
    const p = document.getElementById('alarmAudio');
    p.src = URL.createObjectURL(b); p.load();
  }, alarmChunks);
};
document.getElementById('alarmStopBtn').onclick = () => alarmRecorder?.stop();

document.getElementById('saveAlarmBtn').onclick = async () => {
  if (!alarmBlob) return alert('Chưa ghi âm báo thức');
  const date = document.getElementById('alarmDate').value;
  const time = document.getElementById('alarmTime').value;
  if (!date || !time) return alert('Chọn ngày giờ');
  const title = document.getElementById('alarmTitle').value || 'Báo thức';
  const fd = new FormData();
  fd.append('title', title);
  fd.append('date', date);
  fd.append('time', time);
  fd.append('type', 'alarm');
  fd.append('file', alarmBlob, 'alarm.webm');

  const res = await fetch(`${API_BASE}/api/alarms`, { method: 'POST', body: fd });
  if (res.ok) { alert('Đã lưu báo thức'); loadMessages(); alarmBlob=null; document.getElementById('alarmAudio').src=''; }
  else alert('Lưu thất bại');
};

// ---------- Load messages list ----------
async function loadMessages() {
  const res = await fetch(`${API_BASE}/api/messages`);
  if (!res.ok) return;
  const data = await res.json();
  const list = document.getElementById('messageList');
  list.innerHTML = '';
  data.forEach(m => {
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = `
      <b>${escapeHtml(m.title)}</b>
      <div class="meta">${new Date(m.createdAt).toLocaleString()} • ${m.type}</div>
      ${m.fileUrl ? `<audio controls src="${m.fileUrl}"></audio>` : ''}
      ${m.type === 'alarm' ? `<div style="margin-top:8px"><button onclick="deleteAlarm('${m._id}')">❌ Xóa</button></div>` : ''}
      <div style="margin-top:8px"><small>Trạng thái: ${m.heard? 'Đã nghe':'Chưa nghe'}</small></div>
    `;
    list.appendChild(div);
  });
}
function escapeHtml(s){ return (s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]); }
window.onload = loadMessages;

// ---------- Delete alarm ----------
async function deleteAlarm(id) {
  if (!confirm('Xóa báo thức?')) return;
  const res = await fetch(`${API_BASE}/api/alarms/${id}`, { method: 'DELETE' });
  if (res.ok) loadMessages();
  else alert('Xóa thất bại');
}
window.deleteAlarm = deleteAlarm;

// ---------- Polling info for debugging ----------
console.log('EmoBox frontend ready');
// ==========================
// 🔐 Đăng nhập / Đăng ký User
// ==========================

// Nếu có token -> hiển thị giao diện chính, ẩn khung đăng nhập
const token = localStorage.getItem('token');
const authBox = document.getElementById('auth-container');
const mainUI = document.querySelector('.main-ui'); // bao khung EmoBox

if (!token) {
  authBox.style.display = 'block';
  mainUI.style.display = 'none';
} else {
  authBox.style.display = 'none';
  mainUI.style.display = 'block';
}

// Xử lý đăng nhập
document.getElementById('login-btn').addEventListener('click', async () => {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (data.token) {
    localStorage.setItem('token', data.token);
    alert('Đăng nhập thành công!');
    authBox.style.display = 'none';
    mainUI.style.display = 'block';
  } else {
    alert(data.error || 'Sai tài khoản hoặc mật khẩu!');
  }
});

// Chuyển qua giao diện đăng ký
document.getElementById('register-link').addEventListener('click', () => {
  document.getElementById('register-box').style.display = 'block';
});

// Xử lý đăng ký
document.getElementById('register-btn').addEventListener('click', async () => {
  const username = document.getElementById('reg-username').value;
  const password = document.getElementById('reg-password').value;

  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();

  if (data.success) {
    alert('Đăng ký thành công! Hãy đăng nhập lại.');
    document.getElementById('register-box').style.display = 'none';
  } else {
    alert(data.error || 'Lỗi khi đăng ký');
  }
});

// Nút đăng xuất
document.getElementById('logout-btn')?.addEventListener('click', () => {
  localStorage.removeItem('token');
  location.reload();
});
// ==================== LOGIN / REGISTER ====================

const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const userInfo = document.getElementById('user-info');

function checkLogin() {
  const user = localStorage.getItem('user');
  if (user) {
    const name = JSON.parse(user).username;
    userInfo.innerHTML = `
      <span>Xin chào, <b>${name}</b></span>
      <button id="logoutBtn">Đăng xuất</button>
    `;
    document.getElementById('logoutBtn').onclick = () => {
      localStorage.removeItem('user');
      location.reload();
    };
  }
}

loginBtn.onclick = () => {
  loginModal.classList.remove('hidden');
  registerModal.classList.add('hidden');
};
registerBtn.onclick = () => {
  registerModal.classList.remove('hidden');
  loginModal.classList.add('hidden');
};

document.getElementById('switchToRegister').onclick = () => {
  loginModal.classList.add('hidden');
  registerModal.classList.remove('hidden');
};
document.getElementById('switchToLogin').onclick = () => {
  registerModal.classList.add('hidden');
  loginModal.classList.remove('hidden');
};

// Gửi yêu cầu đăng nhập
document.getElementById('doLogin').onclick = async () => {
  const username = document.getElementById('login-username').value;
  const password = document.getElementById('login-password').value;

  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.success) {
    localStorage.setItem('user', JSON.stringify({ username }));
    loginModal.classList.add('hidden');
    checkLogin();
  } else {
    alert('Sai tài khoản hoặc mật khẩu!');
  }
};

// Gửi yêu cầu đăng ký
document.getElementById('doRegister').onclick = async () => {
  const username = document.getElementById('reg-username').value;
  const password = document.getElementById('reg-password').value;

  const res = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.success) {
    alert('Đăng ký thành công! Hãy đăng nhập.');
    registerModal.classList.add('hidden');
    loginModal.classList.remove('hidden');
  } else {
    alert(data.message);
  }
};

checkLogin();

