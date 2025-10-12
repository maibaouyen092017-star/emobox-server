let recorder, audioChunks = [];

const startBtn = document.getElementById("startRecord");
const stopBtn = document.getElementById("stopRecord");
const playBtn = document.getElementById("playAudio");
const sendBtn = document.getElementById("sendAlarm");
const preview = document.getElementById("preview");

startBtn.onclick = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  recorder = new MediaRecorder(stream);
  audioChunks = [];

  recorder.ondataavailable = e => audioChunks.push(e.data);
  recorder.onstop = () => {
    const blob = new Blob(audioChunks, { type: "audio/mp3" });
    preview.src = URL.createObjectURL(blob);
    preview.style.display = "block";
    playBtn.disabled = false;
    sendBtn.disabled = false;
  };

  recorder.start();
  startBtn.disabled = true;
  stopBtn.disabled = false;
};

stopBtn.onclick = () => {
  recorder.stop();
  startBtn.disabled = false;
  stopBtn.disabled = true;
};

playBtn.onclick = () => preview.play();

sendBtn.onclick = async () => {
  const blob = new Blob(audioChunks, { type: "audio/mp3" });
  const formData = new FormData();
  formData.append("voice", blob, "voice.mp3");
  formData.append("date", document.getElementById("alarm-date").value);
  formData.append("time", document.getElementById("alarm-time").value);

  const res = await fetch("/api/uploadAlarm", { method: "POST", body: formData });
  const data = await res.json();
  alert(data.message);
};
