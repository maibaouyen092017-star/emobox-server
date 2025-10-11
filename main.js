let recorder, chunks = [];
let currentUser = "";

async function signup() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return alert("Vui lòng nhập đầy đủ thông tin!");

  const res = await fetch("/api/signup", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  alert(data.msg);
}

async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const res = await fetch("/api/login", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.user) {
    currentUser = data.user;
    document.getElementById("user").textContent = data.user;
    document.getElementById("auth").style.display = "none";
    document.getElementById("recorder").style.display = "block";
    loadFiles();
  } else {
    alert(data.msg);
  }
}

function startRec() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    recorder = new MediaRecorder(stream);
    chunks = [];
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "audio/webm" });
      document.getElementById("audio").src = URL.createObjectURL(blob);
      document.getElementById("uploadBtn").disabled = false;
    };
    recorder.start();
    document.getElementById("startBtn").disabled = true;
    document.getElementById("stopBtn").disabled = false;
  }).catch(() => alert("Trình duyệt không hỗ trợ ghi âm hoặc chưa cho phép mic!"));
}

function stopRec() {
  recorder.stop();
  document.getElementById("startBtn").disabled = false;
  document.getElementById("stopBtn").disabled = true;
}

async function upload() {
  const blob = new Blob(chunks, { type: "audio/webm" });
  const formData = new FormData();
  formData.append("file", blob, "recording.webm");
  formData.append("user", currentUser);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await res.json();
  alert(data.msg);
  document.getElementById("uploadBtn").disabled = true;
  loadFiles();
}

async function loadFiles() {
  const res = await fetch(`/api/files/${currentUser}`);
  const files = await res.json();
  const list = document.getElementById("fileList");
  list.innerHTML = "";
  files.forEach(f => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="/uploads/${f.filename}" target="_blank">🎧 ${f.filename}</a>`;
    list.appendChild(li);
  });
}
