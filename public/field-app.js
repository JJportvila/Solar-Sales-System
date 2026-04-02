const state = {
  userId: localStorage.getItem("field_user_id") || "",
  userName: localStorage.getItem("field_user_name") || "",
  role: localStorage.getItem("field_user_role") || "sales",
  tracking: false,
  trackTimer: null,
  lastPoint: null,
  audioRecorder: null,
  audioChunks: [],
  audioUrl: "",
  visits: [],
  tracks: [],
  checkins: []
};

function $(id) { return document.getElementById(id); }

function renderUser() {
  const name = state.userName || "未登录";
  $("current-user").textContent = name;
  $("login-btn").classList.toggle("hidden", !!state.userId);
  $("logout-btn").classList.toggle("hidden", !state.userId);
  $("login-form").classList.add("hidden");
}

function showStatus(id, text) {
  $(id).textContent = text;
}

function toast(msg, ok = true) {
  showStatus("visit-status", msg);
  showStatus("trip-status", msg);
  showStatus("checkin-status", msg);
}

function buildDateOptions(selectId) {
  const sel = $(selectId);
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const s = d.toISOString().slice(0, 10);
    dates.push(s);
  }
  sel.innerHTML = dates.map((d) => `<option value="${d}">${d}</option>`).join("");
  return dates[0];
}

async function getPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function sendPoint() {
  try {
    const coords = await getPosition();
    const body = {
      userId: state.userId,
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy
    };
    const res = await fetch("/api/field-tracks/point", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const data = await res.json();
      state.lastPoint = data.track?.points?.slice(-1)[0] || null;
      showStatus("trip-status", `采点成功 ${new Date().toLocaleTimeString()}`);
      await loadTracks();
    }
  } catch (e) {
    showStatus("trip-status", "采点失败，请检查定位权限");
  }
}

async function startTrip() {
  if (!state.userId) { $("login-form").classList.remove("hidden"); return; }
  state.tracking = true;
  $("start-trip-btn").setAttribute("disabled", "true");
  $("stop-trip-btn").removeAttribute("disabled");
  showStatus("trip-status", "行程进行中，60 秒自动采点");
  await sendPoint();
  state.trackTimer = setInterval(sendPoint, 60_000);
}

async function stopTrip() {
  state.tracking = false;
  $("start-trip-btn").removeAttribute("disabled");
  $("stop-trip-btn").setAttribute("disabled", "true");
  if (state.trackTimer) clearInterval(state.trackTimer);
  state.trackTimer = null;
  await fetch("/api/field-tracks/close", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: state.userId })
  });
  showStatus("trip-status", "行程已结束");
  await loadTracks();
}

async function checkin(action) {
  if (!state.userId) { $("login-form").classList.remove("hidden"); return; }
  try {
    const coords = await getPosition();
    const res = await fetch("/api/field-checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: state.userId,
        action,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy
      })
    });
    if (res.ok) {
      const data = await res.json();
      showStatus("checkin-status", `${action === "in" ? "上班" : "下班"} 打卡成功 ${new Date().toLocaleTimeString()}`);
      await loadCheckins();
    }
  } catch (e) {
    showStatus("checkin-status", "打卡失败，请检查定位权限");
  }
}

async function saveVisit() {
  if (!state.userId) { $("login-form").classList.remove("hidden"); return; }
  const customer = $("visit-customer").value.trim();
  if (!customer) { showStatus("visit-status", "客户名称必填"); return; }
  const note = $("visit-note").value.trim();
  const address = $("visit-address").value.trim();
  let lat = null, lng = null, accuracy = 0;
  try {
    const coords = await getPosition();
    lat = coords.latitude; lng = coords.longitude; accuracy = coords.accuracy;
  } catch {}
  const res = await fetch("/api/field-visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: state.userId,
      customer,
      note,
      address,
      lat,
      lng,
      accuracy,
      audioUrl: state.audioUrl
    })
  });
  if (res.ok) {
    showStatus("visit-status", "拜访已保存");
    $("visit-customer").value = "";
    $("visit-address").value = "";
    $("visit-note").value = "";
    state.audioUrl = "";
    $("record-status").textContent = "未录音";
    await loadVisits();
  } else {
    showStatus("visit-status", "保存失败");
  }
}

function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showStatus("record-status", "浏览器不支持录音");
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    state.audioChunks = [];
    state.audioRecorder = new MediaRecorder(stream);
    state.audioRecorder.ondataavailable = (e) => state.audioChunks.push(e.data);
    state.audioRecorder.onstop = async () => {
      const blob = new Blob(state.audioChunks, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result;
        const res = await fetch("/api/uploads/field-audio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl })
        });
        if (res.ok) {
          const data = await res.json();
          state.audioUrl = data.url;
          $("record-status").textContent = "录音已上传";
        } else {
          $("record-status").textContent = "上传录音失败";
        }
      };
      reader.readAsDataURL(blob);
    };
    state.audioRecorder.start();
    $("record-status").textContent = "录音中...";
    $("record-btn").setAttribute("disabled", "true");
    $("stop-record-btn").removeAttribute("disabled");
  }).catch(() => {
    $("record-status").textContent = "无法获取麦克风权限";
  });
}

function stopRecording() {
  if (state.audioRecorder && state.audioRecorder.state === "recording") {
    state.audioRecorder.stop();
    $("record-btn").removeAttribute("disabled");
    $("stop-record-btn").setAttribute("disabled", "true");
  }
}

async function loadTracks() {
  const date = $("track-date").value;
  const res = await fetch(`/api/field-tracks?user=${encodeURIComponent(state.userId)}&date=${encodeURIComponent(date)}`);
  if (res.ok) {
    const data = await res.json();
    state.tracks = data.items || [];
    renderTracks();
  }
}

async function loadVisits() {
  const date = $("visit-date").value;
  const res = await fetch(`/api/field-visits?user=${encodeURIComponent(state.userId)}&date=${encodeURIComponent(date)}`);
  if (res.ok) {
    const data = await res.json();
    state.visits = data.items || [];
    renderVisits();
  }
}

async function loadCheckins() {
  const date = $("track-date").value;
  const res = await fetch(`/api/field-checkins?user=${encodeURIComponent(state.userId)}&date=${encodeURIComponent(date)}`);
  if (res.ok) {
    const data = await res.json();
    state.checkins = data.items || [];
    const last = state.checkins[0];
    showStatus("checkin-status", last ? `最近打卡：${last.action === "in" ? "上班" : "下班"} ${new Date(last.ts).toLocaleTimeString()}` : "尚未打卡");
  }
}

function renderTracks() {
  const wrap = $("track-list");
  if (!state.tracks.length) {
    wrap.textContent = "暂无轨迹";
    return;
  }
  const items = state.tracks.flatMap((t) => t.points || []).sort((a, b) => new Date(b.ts) - new Date(a.ts));
  wrap.innerHTML = items.slice(0, 50).map((p) =>
    `<div class="rounded-xl border border-outline-variant/40 bg-slate-50 px-3 py-2 flex justify-between text-xs">
      <span>${new Date(p.ts).toLocaleTimeString()}</span>
      <span>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</span>
      <span>${Math.round(p.accuracy || 0)}m</span>
    </div>`
  ).join("");
}

function renderVisits() {
  const wrap = $("visit-list");
  if (!state.visits.length) {
    wrap.textContent = "暂无拜访";
    return;
  }
  wrap.innerHTML = state.visits.map((v) =>
    `<div class="rounded-xl border border-outline-variant/40 bg-slate-50 px-3 py-2 text-xs space-y-1">
      <div class="flex justify-between">
        <span class="font-bold text-primary">${v.customer}</span>
        <span class="text-slate-500">${(v.recordedAt || "").slice(11,16)}</span>
      </div>
      <div class="text-slate-600">${v.address || "-"}</div>
      <div class="text-slate-500">${v.note || ""}</div>
      ${v.audioUrl ? `<a class="text-primary font-bold" href="${v.audioUrl}" target="_blank" rel="noreferrer">播放录音</a>` : ""}
    </div>`
  ).join("");
}

function bindEvents() {
  $("login-btn").onclick = () => $("login-form").classList.toggle("hidden");
  $("logout-btn").onclick = () => {
    state.userId = "";
    state.userName = "";
    localStorage.removeItem("field_user_id");
    localStorage.removeItem("field_user_name");
    renderUser();
  };
  $("login-submit").onclick = () => {
    const name = $("login-name").value.trim();
    const role = $("login-role").value;
    if (!name) return;
    state.userName = name;
    state.userId = `sales-${name.replace(/\\s+/g, "-").toLowerCase()}`;
    state.role = role;
    localStorage.setItem("field_user_id", state.userId);
    localStorage.setItem("field_user_name", state.userName);
    localStorage.setItem("field_user_role", state.role);
    renderUser();
    loadTracks();
    loadVisits();
    loadCheckins();
  };
  $("start-trip-btn").onclick = startTrip;
  $("stop-trip-btn").onclick = stopTrip;
  $("checkin-btn").onclick = () => checkin("in");
  $("checkout-btn").onclick = () => checkin("out");
  $("visit-save-btn").onclick = saveVisit;
  $("record-btn").onclick = startRecording;
  $("stop-record-btn").onclick = stopRecording;
  $("track-date").onchange = () => { loadTracks(); loadCheckins(); };
  $("visit-date").onchange = () => loadVisits();
}

function init() {
  renderUser();
  const today = buildDateOptions("track-date");
  $("visit-date").innerHTML = $("track-date").innerHTML;
  $("visit-date").value = today;
  if (state.userId) {
    loadTracks();
    loadVisits();
    loadCheckins();
  }
  bindEvents();
}

document.addEventListener("DOMContentLoaded", init);
