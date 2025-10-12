let mediaRecorder;
let recordedChunks = [];

// Bắt đầu ghi âm
document.getElementById("recordBtn").addEventListener("click", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  recordedChunks = [];

  mediaRecorder.ondataavailable = e => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(recordedChunks, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    document.getElementById("audioPreview").src = url;

    // Gửi lên server
    const formData = new FormData();
    formData.append("audio", blob, "message.webm");

    await fetch("/upload", { method: "POST", body: formData });
    alert("🎉 Đã gửi lời nhắn thành công!");
  };

  mediaRecorder.start();
  document.getElementById("recordBtn").disabled = true;
  document.getElementById("stopBtn").disabled = false;
});

// Dừng ghi âm
document.getElementById("stopBtn").addEventListener("click", () => {
  mediaRecorder.stop();
  document.getElementById("recordBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
});

// Báo thức bằng giọng nói
document.getElementById("recordAlarmBtn").addEventListener("click", async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream);
  let alarmChunks = [];

  recorder.ondataavailable = e => alarmChunks.push(e.data);
  recorder.onstop = async () => {
    const blob = new Blob(alarmChunks, { type: "audio/webm" });
    const time = document.getElementById("alarmTime").value;

    const formData = new FormData();
    formData.append("audio", blob, "alarm.webm");
    formData.append("time", time);

    await fetch("/uploadAlarm", { method: "POST", body: formData });
    alert("⏰ Báo thức đã được lưu!");
    document.getElementById("saveAlarmBtn").disabled = false;
  };

  recorder.start();
  setTimeout(() => recorder.stop(), 5000);
});
