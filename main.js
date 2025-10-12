/* main.js - Emobox UI logic */
let currentUser = "";
let recorder = null;
let chunks = [];         // for general voice
let chunksAlarm = [];    // for alarm voice
let mode = "";           // "voice" or "alarm"
let voiceFilenameForAlarm = ""; // uploaded filename reference

// ---- UI helpers ----
function showTab(id){
  document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
  document.getElementById(id).style.display = 'block';
}
function el(id){ return document.getElementById(id); }

// ---- AUTH ----
async function signup(){
  const email = el('email').value.trim();
  const password = el('password').value.trim();
  if(!email||!password) return alert('Nhập email và mật khẩu');
  const res = await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const j = await res.json(); alert(j.msg || 'Đã đăng ký');
}
async function login(){
  const email = el('email').value.trim();
  const password = el('password').value.trim();
  if(!email||!password) return alert('Nhập email và mật khẩu');
  const res = await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const j = await res.json();
  if(j.user){
    currentUser = j.user;
    el('userName').innerText = currentUser;
    el('userBadge').style.display = 'flex';
    el('authForm').style.display = 'none';
    refreshFiles();
  } else alert(j.msg || 'Đăng nhập thất bại');
}
function logout(){
  currentUser = "";
  el('userBadge').style.display = 'none';
  el('authForm').style.display = 'flex';
}

// ---- RECORDING (shared function) ----
function startRecord(which){
  if(!currentUser){
    if(!confirm('Bạn chưa đăng nhập. Bạn cần đăng nhập để lưu/upload. Muốn tiếp tục chỉ để thử nghiệm?')) return;
  }
  mode = which; // 'voice' or 'alarm'
  navigator.mediaDevices.getUserMedia({audio:true}).then(stream=>{
    recorder = new MediaRecorder(stream, { mimeType: 'audio/mp4' });
    recorder.ondataavailable = e => {
      if(mode==='voice') chunks.push(e.data);
      else chunksAlarm.push(e.data);
    };
    recorder.onstop = ()=>{
      if(mode==='voice'){
        const blob = new Blob(chunks,{type:'audio/webm'});
        el('audioVoice').src = URL.createObjectURL(blob);
        el('sendVoice').disabled = false;
      } else {
        const blob = new Blob(chunksAlarm,{type:'audio/webm'});
        el('audioAlarm').src = URL.createObjectURL(blob);
        el('uploadAlarm').disabled = false;
      }
    };
    recorder.start();
    el(mode==='voice'?'startVoice':'startAlarm').disabled = true;
    el(mode==='voice'?'stopVoice':'stopAlarm').disabled = false;
  }).catch(()=> alert('Không thể truy cập micro. Vui lòng cho phép quyền micro.'));
}
function stopRecord(which){
  if(recorder) recorder.stop();
  el(which==='voice'?'startVoice':'startAlarm').disabled = false;
  el(which==='voice'?'stopVoice':'stopAlarm').disabled = true;
}

// ---- UPLOAD / SEND ----
async function sendVoiceNow(){
  if(!currentUser) return alert('Bạn phải đăng nhập để gửi giọng nói');
  const blob = new Blob(chunks,{type:'audio/webm'});
  const fd = new FormData(); fd.append('file', blob, 'voice-now.webm');
  const res = await fetch('/api/upload',{method:'POST',body:fd});
  const j = await res.json();
  if(!j.filename) return alert('Upload thất bại');
  // create message entry
  await fetch('/api/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:currentUser,voiceFile:j.filename})});
  alert('Đã gửi giọng nói đến thiết bị (nếu thiết bị đang online sẽ phát ngay).');
  chunks = []; el('sendVoice').disabled = true; refreshFiles();
}

async function createAlarm(){
  if(!currentUser) return alert('Bạn phải đăng nhập để đặt báo thức');
  const t = el('alarmTime').value;
  if(!t) return alert('Chọn thời gian báo thức');
  // upload alarm voice if present
  if(chunksAlarm.length===0 && !voiceFilenameForAlarm) return alert('Bạn chưa ghi âm tên báo thức');
  // if not uploaded yet, upload now
  if(!voiceFilenameForAlarm){
    const blob = new Blob(chunksAlarm,{type:'audio/webm'});
    const fd = new FormData(); fd.append('file', blob, 'alarm-voice.webm');
    const up = await fetch('/api/upload',{method:'POST',body:fd});
    const uj = await up.json();
    if(!uj.filename) return alert('Upload giọng nói thất bại');
    voiceFilenameForAlarm = uj.filename;
  }
  // create alarm
  const res = await fetch('/api/alarms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user:currentUser,time:t,voiceFile:voiceFilenameForAlarm})});
  const j = await res.json();
  if(j.msg) alert(j.msg);
  else alert('Đặt báo thức xong');
  // reset
  chunksAlarm = []; voiceFilenameForAlarm = ""; el('uploadAlarm').disabled = true;
  el('audioAlarm').src = '';
  refreshAlarms();
  refreshFiles();
}

// ---- refresh files & alarms
async function refreshFiles(){
  if(!currentUser) return;
  const res = await fetch(`/api/files/${encodeURIComponent(currentUser)}`);
  const arr = await res.json();
  const ul = el('fileList');
  ul.innerHTML = '';
  arr.forEach(f=>{
    const li = document.createElement('li');
    li.innerHTML = `<span>${new Date(f.createdAt||Date.now()).toLocaleString()}</span>
                    <div><a href="/uploads/${f.filename}" target="_blank">🎧 ${f.filename}</a></div>`;
    ul.appendChild(li);
  });
}

async function refreshAlarms(){
  // optionally implement: GET /api/alarms/:user and show
}

// ---- WIFI modal
function openWifiModal(){ el('wifiModal').style.display = 'flex'; }
function closeWifiModal(){ el('wifiModal').style.display = 'none'; }
async function saveEspWifi(){
  const id = el('espId').value.trim();
  const ssid = el('ssid').value;
  const pass = el('spass').value;
  if(!id || !ssid) return alert('Nhập ID và SSID');
  await fetch('/api/esp/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,ssid,pass})});
  alert('Đã lưu Wi-Fi cho ESP (ESP sẽ lấy khi poll).');
  closeWifiModal();
}

// ---- init
(function(){
  // try to show logged-in state if persisted (optional)
})();
