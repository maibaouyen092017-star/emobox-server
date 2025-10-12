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
