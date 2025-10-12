let mediaRecorder;
let recordedChunks = [];

document.getElementById("btnRecord").addEventListener("click", startRecording);
document.getElementById("btnStop").addEventListener("click", stopRecording);
document.getElementById("btnSend").addEventListener("click", sendRealtime);
document.getElementById("btnAlarm").addEventListener("click", saveAlarm);

async function startRecording() {
  recordedChunks = [];
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
  mediaRecorder.start();
  alert("🎙️ Bắt đầu ghi âm...");
}

function stopRecording() {
  mediaRecorder.stop();
  alert("🛑 Dừng ghi âm");
}

async function sendRealtime() {
  const blob = new Blob(recordedChunks, { type: "audio/webm" });
  const formData = new FormData();
  formData.append("file", blob, "realtime.webm");
  formData.append("title", "Voice realtime");

  await fetch("/api/voice/realtime", { method: "POST", body: formData });
  alert("✅ Đã gửi voice trực tiếp!");
}

async function saveAlarm() {
  const blob = new Blob(recordedChunks, { type: "audio/webm" });
  const formData = new FormData();
  formData.append("file", blob, "alarm.webm");
  formData.append("title", document.getElementById("alarmTitle").value);
  formData.append("time", document.getElementById("alarmTime").value);

  await fetch("/api/voice/alarm", { method: "POST", body: formData });
  alert("⏰ Đã lưu báo thức!");
}
