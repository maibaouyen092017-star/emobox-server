// ==============================
// 📡 Cấu hình chung
// ==============================
const API_URL = "https://emobox-server.onrender.com";
const MQTT_TOPIC = "emobox/alarm";

// ==============================
// 🎙️ Biến ghi âm & xử lý
// ==============================
let mediaRecorder;
let audioChunks = [];
let currentBlob = null;

// 🎤 Ghi âm realtime
const recordBtn = document.getElementById("recordBtn");
const stopBtn = document.getElementById("stopBtn");
const sendBtn = document.getElementById("sendBtn");
const audioPlayer = document.getElementById("audioPlayer");
const msgTitle = document.getElementById("msgTitle");

// ⏰ Ghi âm báo thức
const alarmRecordBtn = document.getElementById("alarmRecordBtn");
const alarmStopBtn = document.getElementById("alarmStopBtn");
const alarmAudio = document.getElementById("alarmAudio");
const saveAlarmBtn = document.getElementById("saveAlarmBtn");
const alarmDate = document.getElementById("alarmDate");
const alarmTime = document.getElementById("alarmTime");
const alarmTitle = document.getElementById("alarmTitle");

// ==============================
// 🔊 Hàm bắt đầu ghi âm
// ==============================
async function startRecording(type = "message") {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

    mediaRecorder.onstop = () => {
      currentBlob = new Blob(audioChunks, { type: "audio/webm" });
      const audioURL = URL.createObjectURL(currentBlob);
      if (type === "message") audioPlayer.src = audioURL;
      else alarmAudio.src = audioURL;
    };

    mediaRecorder.start();
    console.log("🎙️ Bắt đầu ghi âm...");
  } catch (err) {
    alert("Không thể truy cập micro!");
    console.error(err);
  }
}

// 🛑 Dừng ghi âm
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
    console.log("⏹️ Dừng ghi âm.");
  }
}

// ==============================
// 📤 Gửi tin nhắn realtime
// ==============================
sendBtn.addEventListener("click", async () => {
  if (!currentBlob) return alert("Bạn chưa ghi âm!");
  const token = localStorage.getItem("token");
  if (!token) return alert("Vui lòng đăng nhập trước!");

  const formData = new FormData();
  formData.append("voice", currentBlob, "message.webm");
  formData.append("title", msgTitle.value || "Tin nhắn mới");

  try {
    const res = await fetch(`${API_URL}/api/upload-voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();

    if (data.success) {
      alert("✅ Gửi thành công!");
      currentBlob = null;
      msgTitle.value = "";
      audioPlayer.src = "";
    } else {
      alert("⚠️ Lỗi khi gửi tin nhắn!");
    }
  } catch (err) {
    alert("❌ Không thể kết nối server!");
    console.error(err);
  }
});

// ==============================
// 💾 Lưu báo thức giọng nói
// ==============================
saveAlarmBtn.addEventListener("click", async () => {
  if (!currentBlob) return alert("Bạn chưa ghi âm cho báo thức!");
  const token = localStorage.getItem("token");
  if (!token) return alert("Vui lòng đăng nhập!");

  const formData = new FormData();
  formData.append("voice", currentBlob, "alarm.webm");
  formData.append("title", alarmTitle.value || "Báo thức");
  formData.append("date", alarmDate.value);
  formData.append("time", alarmTime.value);

  try {
    const res = await fetch(`${API_URL}/api/alarms`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();

    if (data.success) {
      alert("✅ Đã lưu báo thức!");
      alarmTitle.value = "";
      alarmDate.value = "";
      alarmTime.value = "";
      alarmAudio.src = "";
    } else {
      alert("⚠️ Không thể lưu báo thức!");
    }
  } catch (err) {
    alert("❌ Lỗi kết nối server!");
    console.error(err);
  }
});

// ==============================
// 🔗 Gán sự kiện nút
// ==============================
recordBtn.onclick = () => startRecording("message");
stopBtn.onclick = stopRecording;
alarmRecordBtn.onclick = () => startRecording("alarm");
alarmStopBtn.onclick = stopRecording;

// ==============================
// 🔔 Tự động tải danh sách báo thức
// ==============================
async function loadAlarms() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const res = await fetch(`${API_URL}/api/alarms`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();

    const list = document.getElementById("alarmList");
    list.innerHTML = "";
    data.forEach((a) => {
      const div = document.createElement("div");
      div.innerHTML = `
        <p>🕒 <b>${a.title}</b> - ${a.date} ${a.time}</p>
        <audio controls src="${a.voiceUrl}"></audio>
      `;
      list.appendChild(div);
    });
  } catch (err) {
    console.error("Không thể tải báo thức:", err);
  }
}

window.addEventListener("load", loadAlarms);
