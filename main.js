let rec = null, chunks = [];
let mode = "", user = "user1";

function showTab(tab) {
  document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
  document.getElementById(tab).classList.add("active");
}

function startRecord(m) {
  mode = m;
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    rec = new MediaRecorder(stream);
    chunks = [];
    rec.ondataavailable = e => chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      document.getElementById(`audio${capitalize(m)}`).src = URL.createObjectURL(blob);
      document.getElementById(`upload${capitalize(m)}`).disabled = false;
    };
    rec.start();
    document.getElementById(`start${capitalize(m)}`).disabled = true;
    document.getElementById(`stop${capitalize(m)}`).disabled = false;
  });
}

function stopRecord(m) {
  rec.stop();
  document.getElementById(`start${capitalize(m)}`).disabled = false;
  document.getElementById(`stop${capitalize(m)}`).disabled = true;
}

async function uploadFile(m) {
  const blob = new Blob(chunks, { type: "audio/webm" });
  const fd = new FormData();
  fd.append("file", blob, `${m}.webm`);

  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  const filename = data.filename;

  if (m === "voice") {
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, voiceFile: filename }),
    });
    alert("✅ Đã gửi giọng nói!");
  } else if (m === "alarm") {
    const time = document.getElementById("alarmTime").value;
    if (!time) return alert("⏰ Chưa chọn thời gian!");
    await fetch("/api/alarms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, time, voiceFile: filename }),
    });
    alert("✅ Đặt báo thức thành công!");
  }

  document.getElementById(`upload${capitalize(m)}`).disabled = true;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
