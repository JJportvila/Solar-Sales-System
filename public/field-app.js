const state = {
  token: localStorage.getItem("field_token") || "",
  userId: localStorage.getItem("field_user_id") || "",
  userName: localStorage.getItem("field_user_name") || "",
  role: localStorage.getItem("field_user_role") || "",
  roleLabel: localStorage.getItem("field_user_role_label") || "",
  employees: [],
  tracking: false,
  trackTimer: null,
  audioRecorder: null,
  audioChunks: [],
  audioUrl: "",
  audioBlobUrl: "",
  recordStartTs: 0,
  visits: [],
  tracks: [],
  checkins: [],
  photoUrls: [],
  timelineType: "all"
};

function $(id) {
  return document.getElementById(id);
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  return headers;
}

function showStatus(id, text) {
  const node = $(id);
  if (node) node.textContent = text;
}

function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString() : "-";
}

function updateSummary() {
  const points = state.tracks.flatMap((track) => track.points || []);
  if ($("summary-checkins")) $("summary-checkins").textContent = String(state.checkins.length || 0);
  if ($("summary-tracks")) $("summary-tracks").textContent = String(points.length || 0);
  if ($("summary-visits")) $("summary-visits").textContent = String(state.visits.length || 0);
}

function renderTimeline() {
  const wrap = $("day-timeline");
  const pointItems = state.tracks
    .flatMap((track) => track.points || [])
    .map((point) => ({
      ts: point.ts,
      type: "track",
      title: "轨迹采点",
      detail: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)} · 精度 ${Math.round(point.accuracy || 0)}m`,
      extra: ""
    }));
  const checkinItems = state.checkins.map((item) => ({
    ts: item.ts,
    type: "checkin",
    title: item.action === "in" ? "上班打卡" : "下班打卡",
    detail: `${item.lat?.toFixed?.(5) || "-"}, ${item.lng?.toFixed?.(5) || "-"}`,
    extra: `定位精度 ${Math.round(item.accuracy || 0)}m`
  }));
  const visitItems = state.visits.map((visit) => ({
    ts: visit.recordedAt,
    type: "visit",
    title: `拜访 ${visit.customer || "-"}`,
    detail: visit.address || visit.note || "已保存拜访记录",
    extra: `
      <div class="mt-3 space-y-3 rounded-2xl bg-white px-4 py-4">
        <div class="text-xs text-slate-500">${visit.note || "没有填写备注"}</div>
        ${visit.photoUrls?.length ? `<div class="flex flex-wrap gap-2">${visit.photoUrls.map((url) => `<img src="${url}" class="h-16 w-16 rounded-lg border object-cover" />`).join("")}</div>` : `<div class="text-xs text-slate-400">没有上传照片</div>`}
        ${visit.audioUrl ? `<a class="inline-flex rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-primary" href="${visit.audioUrl}" target="_blank" rel="noreferrer">播放录音</a>` : `<div class="text-xs text-slate-400">没有录音</div>`}
      </div>
    `
  }));
  const items = [...checkinItems, ...pointItems, ...visitItems]
    .filter((item) => item.ts)
    .filter((item) => state.timelineType === "all" || item.type === state.timelineType)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));

  if (!items.length) {
    wrap.textContent = "暂无时间线记录";
    return;
  }

  wrap.innerHTML = items.map((item, index) => {
    const tone = item.type === "checkin"
      ? "#0f3d78"
      : item.type === "visit"
        ? "#ffb703"
        : "#cbd5e1";
    return `
      <button class="timeline-item flex w-full gap-4 rounded-2xl border border-line bg-slate-50 px-4 py-4 text-left" data-index="${index}" type="button">
        <div class="flex flex-col items-center">
          <span class="h-3 w-3 rounded-full" style="background:${tone};"></span>
          <span class="mt-2 h-full w-px bg-slate-200"></span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-3">
            <div class="font-bold text-primary">${item.title}</div>
            <div class="text-xs text-slate-500">${formatTime(item.ts)}</div>
          </div>
          <div class="mt-1 text-xs text-slate-500">${item.detail}</div>
          <div class="timeline-extra ${item.type === "visit" ? "hidden" : "hidden"}">${item.extra || ""}</div>
        </div>
      </button>
    `;
  }).join("");

  wrap.querySelectorAll(".timeline-item").forEach((button) => {
    button.addEventListener("click", () => {
      const extra = button.querySelector(".timeline-extra");
      if (!extra || !extra.innerHTML.trim()) return;
      extra.classList.toggle("hidden");
    });
  });
}

function updateTimelineFilters() {
  document.querySelectorAll(".timeline-filter").forEach((button) => {
    const active = button.dataset.type === state.timelineType;
    button.classList.toggle("bg-primary", active);
    button.classList.toggle("text-white", active);
    button.classList.toggle("bg-slate-100", !active);
    button.classList.toggle("text-slate-600", !active);
  });
}

function renderLatestCards() {
  const latestCheckin = state.checkins[0];
  $("latest-checkin-card").innerHTML = latestCheckin
    ? `
      <div class="font-bold text-primary">${latestCheckin.action === "in" ? "上班打卡" : "下班打卡"}</div>
      <div class="mt-1">${formatTime(latestCheckin.ts)}</div>
      <div class="mt-1 text-xs text-slate-500">${latestCheckin.lat?.toFixed?.(5) || "-"}, ${latestCheckin.lng?.toFixed?.(5) || "-"}</div>
    `
    : "暂无打卡记录";

  const latestVisit = state.visits[0];
  $("latest-visit-card").innerHTML = latestVisit
    ? `
      <div class="font-bold text-primary">${latestVisit.customer || "-"}</div>
      <div class="mt-1">${formatTime(latestVisit.recordedAt)}</div>
      <div class="mt-1 text-xs text-slate-500">${latestVisit.address || "未填写地址"}</div>
    `
    : "暂无拜访记录";

  const points = state.tracks.flatMap((track) => track.points || []).sort((a, b) => new Date(b.ts) - new Date(a.ts));
  const latestPoint = points[0];
  $("latest-location-card").innerHTML = latestPoint
    ? `
      <div class="font-bold text-primary">${formatTime(latestPoint.ts)}</div>
      <div class="mt-1">${latestPoint.lat.toFixed(5)}, ${latestPoint.lng.toFixed(5)}</div>
      <div class="mt-1 text-xs text-slate-500">定位精度 ${Math.round(latestPoint.accuracy || 0)}m</div>
    `
    : "暂无定位记录";
}

function clearLoginState() {
  state.token = "";
  state.userId = "";
  state.userName = "";
  state.role = "";
  state.roleLabel = "";
  localStorage.removeItem("field_token");
  localStorage.removeItem("field_user_id");
  localStorage.removeItem("field_user_name");
  localStorage.removeItem("field_user_role");
  localStorage.removeItem("field_user_role_label");
}

function renderUser() {
  $("current-user").textContent = state.userName || "未登录";
  $("current-role").textContent = state.userId
    ? `${state.roleLabel || state.role} / ${state.userId}`
    : "请先登录后再使用打卡、轨迹和拜访功能。";
  if ($("login-btn")) $("login-btn").classList.toggle("hidden", Boolean(state.userId));
  $("logout-btn").classList.toggle("hidden", !state.userId);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "请求失败");
    error.status = response.status;
    throw error;
  }
  return data;
}

function buildDateOptions(selectId) {
  const select = $(selectId);
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }
  select.innerHTML = dates.map((value) => `<option value="${value}">${value}</option>`).join("");
}

async function getPosition() {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  if (!window.isSecureContext && !isLocalhost) {
    throw new Error("当前浏览器定位只支持 HTTPS 或 localhost，请改用 https 地址打开后再打卡");
  }
  if (!navigator.geolocation) {
    throw new Error("当前浏览器不支持定位，请更换浏览器后再试");
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) => {
        if (error?.code === 1) {
          reject(new Error("定位权限被拒绝，请允许定位后再打卡"));
          return;
        }
        if (error?.code === 2) {
          reject(new Error("当前无法获取定位，请检查网络和定位服务后再试"));
          return;
        }
        if (error?.code === 3) {
          reject(new Error("定位超时，请稍后再试"));
          return;
        }
        reject(new Error(error?.message || "定位获取失败"));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function loadLoginEmployees() {
  const data = await fetchJson("/api/auth/options");
  state.employees = (data.items || []).filter((item) => item.status === "active");
  $("login-employee").innerHTML = [`<option value="">选择员工</option>`]
    .concat(state.employees.map((item) => `<option value="${item.id}">${item.name} / ${item.roleLabel || item.role}</option>`))
    .join("");
}

async function tryRestoreLogin() {
  if (!state.token) return;
  try {
    const data = await fetchJson("/api/field-auth/me", {
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const user = data.user || {};
    state.userId = user.id || state.userId;
    state.userName = user.name || state.userName;
    state.role = user.role || state.role;
    state.roleLabel = user.roleLabel || state.roleLabel;
    renderUser();
  } catch (_) {
    clearLoginState();
    renderUser();
  }
}

async function login() {
  const employeeId = $("login-employee").value;
  const pin = $("login-pin").value.trim();
  if (!employeeId || !pin) {
    showStatus("login-status", "请选择员工并输入 PIN");
    return;
  }
  try {
    const data = await fetchJson("/api/field-auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, pin })
    });
    const user = data.user || {};
    state.token = data.token || "";
    state.userId = user.id || "";
    state.userName = user.name || "";
    state.role = user.role || "";
    state.roleLabel = user.roleLabel || "";
    localStorage.setItem("field_token", state.token);
    localStorage.setItem("field_user_id", state.userId);
    localStorage.setItem("field_user_name", state.userName);
    localStorage.setItem("field_user_role", state.role);
    localStorage.setItem("field_user_role_label", state.roleLabel);
    $("login-pin").value = "";
    $("login-form").classList.add("hidden");
    showStatus("login-status", "登录成功");
    renderUser();
    await Promise.all([loadTracks(), loadVisits(), loadCheckins()]);
  } catch (error) {
    showStatus("login-status", error.message || "登录失败");
  }
}

async function sendPoint() {
  if (!state.userId) return;
  try {
    const coords = await getPosition();
    await fetchJson("/api/field-tracks/point", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        userId: state.userId,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy
      })
    });
    showStatus("trip-status", `轨迹采点成功 ${new Date().toLocaleTimeString()}`);
    await loadTracks();
  } catch (error) {
    showStatus("trip-status", error.message || "轨迹采点失败，请检查定位和登录状态");
  }
}

async function startTrip() {
  if (!state.userId) {
    $("login-form").classList.remove("hidden");
    return;
  }
  state.tracking = true;
  $("start-trip-btn").setAttribute("disabled", "true");
  $("stop-trip-btn").removeAttribute("disabled");
  showStatus("trip-status", "行程进行中，系统每 60 秒自动采点");
  await sendPoint();
  state.trackTimer = setInterval(sendPoint, 60000);
}

async function stopTrip() {
  state.tracking = false;
  $("start-trip-btn").removeAttribute("disabled");
  $("stop-trip-btn").setAttribute("disabled", "true");
  if (state.trackTimer) {
    clearInterval(state.trackTimer);
    state.trackTimer = null;
  }
  try {
    await fetchJson("/api/field-tracks/close", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId: state.userId })
    });
    showStatus("trip-status", "行程已结束");
  } catch (error) {
    showStatus("trip-status", error.message || "结束行程失败");
  }
  await loadTracks();
}

async function checkin(action) {
  if (!state.userId) {
    $("login-form").classList.remove("hidden");
    return;
  }
  try {
    const coords = await getPosition();
    await fetchJson("/api/field-checkin", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        userId: state.userId,
        action,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy
      })
    });
    showStatus("checkin-status", `${action === "in" ? "上班" : "下班"}打卡成功 ${new Date().toLocaleTimeString()}`);
    await loadCheckins();
  } catch (error) {
    showStatus("checkin-status", error.message || "打卡失败");
  }
}

async function saveVisit() {
  if (!state.userId) {
    $("login-form").classList.remove("hidden");
    return;
  }
  const customer = $("visit-customer").value.trim();
  if (!customer) {
    showStatus("visit-status", "客户名称必填");
    return;
  }
  const note = $("visit-note").value.trim();
  const address = $("visit-address").value.trim();
  let lat = null;
  let lng = null;
  let accuracy = 0;
  try {
    const coords = await getPosition();
    lat = coords.latitude;
    lng = coords.longitude;
    accuracy = coords.accuracy;
    $("visit-location").textContent = `当前坐标：${lat.toFixed(5)}, ${lng.toFixed(5)} (±${Math.round(accuracy)}m)`;
  } catch (_) {
    $("visit-location").textContent = "当前坐标：未获取";
  }
  try {
    await fetchJson("/api/field-visits", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        userId: state.userId,
        customer,
        note,
        address,
        lat,
        lng,
        accuracy,
        audioUrl: state.audioUrl,
        photoUrls: state.photoUrls
      })
    });
    showStatus("visit-status", "拜访已保存");
    $("visit-customer").value = "";
    $("visit-address").value = "";
    $("visit-note").value = "";
    $("visit-location").textContent = "当前坐标：未获取";
    state.audioUrl = "";
    state.audioBlobUrl = "";
    state.photoUrls = [];
    $("record-audio").classList.add("hidden");
    $("record-audio").src = "";
    $("record-progress").style.width = "0%";
    $("record-status").textContent = "未录音";
    $("visit-photo-preview").textContent = "未选择照片";
    await loadVisits();
  } catch (error) {
    showStatus("visit-status", error.message || "保存失败");
  }
}

function startRecording() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showStatus("record-status", "当前浏览器不支持录音");
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      state.audioChunks = [];
      state.audioRecorder = new MediaRecorder(stream);
      state.audioRecorder.ondataavailable = (event) => state.audioChunks.push(event.data);
      state.audioRecorder.onstop = async () => {
        const blob = new Blob(state.audioChunks, { type: "audio/webm" });
        state.audioBlobUrl = URL.createObjectURL(blob);
        $("record-audio").classList.remove("hidden");
        $("record-audio").src = state.audioBlobUrl;
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        try {
          const data = await fetchJson("/api/uploads/field-audio", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ dataUrl })
          });
          state.audioUrl = data.url || "";
          showStatus("record-status", "录音已上传，可回放");
        } catch (error) {
          showStatus("record-status", error.message || "录音上传失败");
        }
      };
      state.audioRecorder.start();
      state.recordStartTs = Date.now();
      $("record-btn").setAttribute("disabled", "true");
      $("stop-record-btn").removeAttribute("disabled");
      showStatus("record-status", "录音中...");
      const timer = setInterval(() => {
        if (!state.audioRecorder || state.audioRecorder.state !== "recording") {
          clearInterval(timer);
          return;
        }
        const duration = Math.min(120, (Date.now() - state.recordStartTs) / 1000);
        $("record-progress").style.width = `${(duration / 120) * 100}%`;
      }, 500);
    })
    .catch(() => {
      showStatus("record-status", "无法获取麦克风权限");
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
  if (!state.userId) {
    state.tracks = [];
    $("track-list").textContent = "暂无轨迹";
    updateSummary();
    renderLatestCards();
    return;
  }
  const date = $("track-date").value;
  const data = await fetchJson(`/api/field-tracks?user=${encodeURIComponent(state.userId)}&date=${encodeURIComponent(date)}`);
  state.tracks = data.items || [];
  renderTracks();
  updateSummary();
  renderLatestCards();
  renderTimeline();
}

async function loadVisits() {
  if (!state.userId) {
    state.visits = [];
    $("visit-list").textContent = "暂无拜访";
    updateSummary();
    renderLatestCards();
    return;
  }
  const date = $("visit-date").value;
  const data = await fetchJson(`/api/field-visits?user=${encodeURIComponent(state.userId)}&date=${encodeURIComponent(date)}`);
  state.visits = data.items || [];
  renderVisits();
  updateSummary();
  renderLatestCards();
  renderTimeline();
}

async function loadCheckins() {
  if (!state.userId) {
    state.checkins = [];
    showStatus("checkin-status", "尚未打卡");
    updateSummary();
    renderLatestCards();
    return;
  }
  const date = $("track-date").value;
  const data = await fetchJson(`/api/field-checkins?user=${encodeURIComponent(state.userId)}&date=${encodeURIComponent(date)}`);
  state.checkins = data.items || [];
  const last = state.checkins[0];
  showStatus(
    "checkin-status",
    last ? `最近打卡：${last.action === "in" ? "上班" : "下班"} ${new Date(last.ts).toLocaleTimeString()}` : "尚未打卡"
  );
  updateSummary();
  renderLatestCards();
  renderTimeline();
}

function renderTracks() {
  const wrap = $("track-list");
  const points = state.tracks.flatMap((track) => track.points || []).sort((a, b) => new Date(b.ts) - new Date(a.ts));
  if (!points.length) {
    wrap.textContent = "暂无轨迹";
    return;
  }
  wrap.innerHTML = points.slice(0, 50).map((point) => `
    <div class="flex items-center justify-between rounded-2xl border border-line bg-slate-50 px-4 py-3 text-xs">
      <span>${new Date(point.ts).toLocaleTimeString()}</span>
      <span>${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</span>
      <span>${Math.round(point.accuracy || 0)}m</span>
    </div>
  `).join("");
}

function renderVisits() {
  const wrap = $("visit-list");
  if (!state.visits.length) {
    wrap.textContent = "暂无拜访";
    return;
  }
  wrap.innerHTML = state.visits.map((visit) => `
    <div class="space-y-2 rounded-2xl border border-line bg-slate-50 px-4 py-4 text-xs">
      <div class="flex items-center justify-between gap-3">
        <span class="font-bold text-primary">${visit.customer}</span>
        <span class="text-slate-500">${new Date(visit.recordedAt).toLocaleTimeString()}</span>
      </div>
      <div class="text-slate-600">${visit.address || "-"}</div>
      <div class="text-slate-500">${visit.note || ""}</div>
      ${visit.photoUrls?.length ? `<div class="mt-1 flex flex-wrap gap-2">${visit.photoUrls.map((url) => `<img src="${url}" class="h-16 w-16 rounded-lg border object-cover" />`).join("")}</div>` : ""}
      ${visit.audioUrl ? `<a class="inline-block font-bold text-primary" href="${visit.audioUrl}" target="_blank" rel="noreferrer">播放录音</a>` : ""}
    </div>
  `).join("");
}

function handlePhotoSelect(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    $("visit-photo-preview").textContent = "未选择照片";
    return;
  }
  $("visit-photo-preview").innerHTML = files.map((file) => `<span class="rounded-lg bg-slate-100 px-2 py-1">${file.name}</span>`).join("");
  Promise.all(files.map(async (file) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const result = await fetchJson("/api/uploads/field-photo", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ dataUrl })
    });
    return result.url;
  }))
    .then((urls) => {
      state.photoUrls = urls.filter(Boolean);
      $("visit-photo-preview").innerHTML = state.photoUrls.map((url) => `<img src="${url}" class="h-16 w-16 rounded-lg border object-cover" />`).join("");
    })
    .catch((error) => {
      state.photoUrls = [];
      showStatus("visit-status", error.message || "照片上传失败");
      $("visit-photo-preview").textContent = "照片上传失败";
    });
}

function bindEvents() {
  if ($("login-btn")) $("login-btn").onclick = () => $("login-form").classList.toggle("hidden");
  $("logout-btn").onclick = () => {
    clearLoginState();
    state.visits = [];
    state.tracks = [];
    state.checkins = [];
    renderUser();
    updateSummary();
    renderLatestCards();
    $("track-list").textContent = "暂无轨迹";
    $("visit-list").textContent = "暂无拜访";
    $("login-form").classList.remove("hidden");
    showStatus("login-status", "已退出登录");
  };
  $("login-submit").onclick = login;
  $("checkin-btn").onclick = () => checkin("in");
  $("checkout-btn").onclick = () => checkin("out");
  $("start-trip-btn").onclick = startTrip;
  $("stop-trip-btn").onclick = stopTrip;
  $("visit-save-btn").onclick = saveVisit;
  $("record-btn").onclick = startRecording;
  $("stop-record-btn").onclick = stopRecording;
  $("visit-photo-input").addEventListener("change", handlePhotoSelect);
  $("track-date").addEventListener("change", () => {
    loadTracks();
    loadCheckins();
  });
  $("visit-date").addEventListener("change", loadVisits);
  document.querySelectorAll(".timeline-filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.timelineType = button.dataset.type || "all";
      updateTimelineFilters();
      renderTimeline();
    });
  });
}

async function init() {
  buildDateOptions("track-date");
  buildDateOptions("visit-date");
  renderUser();
  updateSummary();
  updateTimelineFilters();
  renderLatestCards();
  renderTimeline();
  bindEvents();
  await loadLoginEmployees();
  await tryRestoreLogin();
  if (state.userId) {
    await Promise.all([loadTracks(), loadVisits(), loadCheckins()]);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
  });
});
