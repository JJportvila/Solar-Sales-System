const detailState = {
  userId: "",
  date: new Date().toISOString().slice(0, 10),
  employeeName: "",
  payroll: null,
  checkins: [],
  visits: [],
  tracks: [],
  trackPoints: [],
  playbackIndex: 0,
  playbackTimer: null
};

const detailFormatter = new Intl.NumberFormat("en-US");

function $(id) {
  return document.getElementById(id);
}

function money(value) {
  return `VT ${detailFormatter.format(Number(value || 0))}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getMapLink(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return "";
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function setStatus(text, isError = false) {
  const node = $("detail-status-text");
  node.textContent = text || "";
  node.style.color = isError ? "#b91c1c" : "#64748b";
}

function formatDateText(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDuration(ms) {
  const totalMinutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours && !minutes) return "少于 1 分钟";
  if (!hours) return `${minutes} 分钟`;
  if (!minutes) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分钟`;
}

function formatDistance(meters) {
  const value = Number(meters) || 0;
  if (value >= 1000) return `${(value / 1000).toFixed(2)} km`;
  return `${Math.round(value)} m`;
}

function toTrackPoint(point = {}, trackIndex = 0, pointIndex = 0) {
  return {
    id: `${trackIndex}-${pointIndex}-${String(point.ts || "")}`,
    lat: Number(point.lat),
    lng: Number(point.lng),
    accuracy: Number(point.accuracy || 0),
    ts: String(point.ts || "").trim(),
    trackIndex,
    pointIndex
  };
}

function normalizeTrackPoints(tracks = []) {
  return (Array.isArray(tracks) ? tracks : [])
    .flatMap((track, trackIndex) => (Array.isArray(track.points) ? track.points : []).map((point, pointIndex) => toTrackPoint(point, trackIndex, pointIndex)))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng) && point.ts)
    .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

function haversineMeters(a, b) {
  const lat1 = Number(a?.lat);
  const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat);
  const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every((value) => Number.isFinite(value))) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const aa = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
  return 6371000 * c;
}

function getTrackSummary(points = []) {
  if (!points.length) {
    return {
      totalPoints: 0,
      distanceMeters: 0,
      averageAccuracy: 0,
      durationMs: 0,
      start: null,
      end: null
    };
  }

  let distanceMeters = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceMeters += haversineMeters(points[index - 1], points[index]);
  }

  const accuracies = points.map((point) => Number(point.accuracy || 0)).filter((value) => Number.isFinite(value) && value > 0);
  const startTime = new Date(points[0].ts).getTime();
  const endTime = new Date(points[points.length - 1].ts).getTime();

  return {
    totalPoints: points.length,
    distanceMeters,
    averageAccuracy: accuracies.length ? accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length : 0,
    durationMs: Number.isFinite(startTime) && Number.isFinite(endTime) ? Math.max(0, endTime - startTime) : 0,
    start: points[0],
    end: points[points.length - 1]
  };
}

function buildTrackGeometry(points = []) {
  if (!points.length) {
    return { polyline: "", markers: [] };
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lngSpan = Math.max(maxLng - minLng, 0.0001);
  const padding = 8;
  const width = 100 - padding * 2;
  const height = 100 - padding * 2;

  const markers = points.map((point) => {
    const x = padding + ((point.lng - minLng) / lngSpan) * width;
    const y = 100 - padding - ((point.lat - minLat) / latSpan) * height;
    return { ...point, x, y };
  });

  return {
    polyline: markers.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" "),
    markers
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function renderPayroll() {
  const payroll = detailState.payroll || {};
  $("detail-employee-name").textContent = detailState.employeeName || payroll.employeeName || "考勤详情";
  $("detail-date-text").textContent = `${formatDateText(detailState.date)} 的打卡、拜访与 GPS 回放`;
  $("detail-status").textContent = payroll.attendanceStatus || "-";
  $("detail-pay").textContent = money(payroll.attendancePay || 0);
  $("detail-first").textContent = payroll.firstCheckInLabel || "-";
  $("detail-last").textContent = payroll.lastCheckOutLabel || "-";
  $("detail-hours").textContent = payroll.workHoursLabel || "0 小时";
  $("detail-visits").textContent = String(payroll.visitCount || 0);
}

function renderCheckins() {
  const wrap = $("detail-checkins");
  if (!detailState.checkins.length) {
    wrap.innerHTML = `<div class="empty">当天没有打卡记录。</div>`;
    return;
  }

  wrap.innerHTML = detailState.checkins.map((item) => `
    <div class="list-item">
      <div class="list-item-title">${item.action === "in" ? "上班打卡" : "下班打卡"}</div>
      <div class="pill-row">
        <span class="pill ${item.action === "in" ? "success" : "warning"}">${item.action === "in" ? "签到" : "签退"}</span>
      </div>
      <div class="list-item-meta">时间: ${escapeHtml(formatTime(item.ts))}</div>
      <div class="list-item-meta">坐标: ${escapeHtml(Number.isFinite(Number(item.lat)) ? Number(item.lat).toFixed(5) : "-")}, ${escapeHtml(Number.isFinite(Number(item.lng)) ? Number(item.lng).toFixed(5) : "-")}</div>
      <div class="list-item-meta">精度: ${escapeHtml(Math.round(item.accuracy || 0))} m</div>
      ${item.note ? `<div class="list-item-meta">备注: ${escapeHtml(item.note)}</div>` : ""}
      ${getMapLink(item.lat, item.lng) ? `<div class="list-item-meta"><a href="${getMapLink(item.lat, item.lng)}" target="_blank" rel="noreferrer">查看地图</a></div>` : ""}
    </div>
  `).join("");
}

function renderVisits() {
  const wrap = $("detail-visits-list");
  if (!detailState.visits.length) {
    wrap.innerHTML = `<div class="empty">当天没有拜访记录。</div>`;
    return;
  }

  wrap.innerHTML = detailState.visits.map((item) => `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(item.customer || "未命名客户")}</div>
      <div class="list-item-meta">时间: ${escapeHtml(formatTime(item.recordedAt))}</div>
      <div class="list-item-meta">地址: ${escapeHtml(item.address || "-")}</div>
      ${item.note ? `<div class="list-item-meta">备注: ${escapeHtml(item.note)}</div>` : ""}
      ${(Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
        ? `<div class="list-item-meta">GPS: ${escapeHtml(Number(item.lat).toFixed(5))}, ${escapeHtml(Number(item.lng).toFixed(5))} / 精度 ${escapeHtml(Math.round(item.accuracy || 0))} m</div>`
        : ""}
      ${getMapLink(item.lat, item.lng) ? `<div class="list-item-meta"><a href="${getMapLink(item.lat, item.lng)}" target="_blank" rel="noreferrer">查看地图</a></div>` : ""}
    </div>
  `).join("");
}

function stopPlayback() {
  if (detailState.playbackTimer) {
    clearInterval(detailState.playbackTimer);
    detailState.playbackTimer = null;
  }
  $("track-play").textContent = "播放回放";
}

function setPlaybackIndex(index) {
  const points = detailState.trackPoints;
  if (!points.length) {
    detailState.playbackIndex = 0;
    return;
  }
  detailState.playbackIndex = Math.max(0, Math.min(points.length - 1, Number(index) || 0));
  renderTrackPlayback();
  renderTrackList();
}

function renderTrackMap() {
  const svg = $("track-map");
  const badge = $("track-map-badge");
  const startNode = $("track-map-start");
  const endNode = $("track-map-end");
  const geometry = buildTrackGeometry(detailState.trackPoints);
  const currentMarker = geometry.markers[detailState.playbackIndex];

  if (!geometry.markers.length) {
    svg.innerHTML = `
      <rect x="0" y="0" width="100" height="100" rx="6" fill="#f8fbfe"></rect>
      <path d="M10 20H90M10 40H90M10 60H90M10 80H90M20 10V90M40 10V90M60 10V90M80 10V90" stroke="rgba(15,59,102,.08)" stroke-width="0.6"></path>
      <text x="50" y="51" text-anchor="middle" font-size="5" fill="#64748b">暂无轨迹数据</text>
    `;
    badge.textContent = "等待轨迹";
    startNode.textContent = "起点: -";
    endNode.textContent = "终点: -";
    return;
  }

  const markerDots = geometry.markers.map((point, index) => `
    <circle
      cx="${point.x.toFixed(2)}"
      cy="${point.y.toFixed(2)}"
      r="${index === detailState.playbackIndex ? 2.2 : 1.1}"
      fill="${index === detailState.playbackIndex ? "#0f3b66" : "rgba(15,59,102,.34)"}"
    ></circle>
  `).join("");

  svg.innerHTML = `
    <rect x="0" y="0" width="100" height="100" rx="6" fill="#f8fbfe"></rect>
    <path d="M10 20H90M10 40H90M10 60H90M10 80H90M20 10V90M40 10V90M60 10V90M80 10V90" stroke="rgba(15,59,102,.08)" stroke-width="0.6"></path>
    <polyline fill="none" stroke="rgba(14,165,233,.35)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" points="${geometry.polyline}"></polyline>
    <polyline fill="none" stroke="#0ea5e9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="${geometry.markers.slice(0, detailState.playbackIndex + 1).map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}"></polyline>
    ${markerDots}
    <circle cx="${geometry.markers[0].x.toFixed(2)}" cy="${geometry.markers[0].y.toFixed(2)}" r="2" fill="#16a34a"></circle>
    <circle cx="${geometry.markers[geometry.markers.length - 1].x.toFixed(2)}" cy="${geometry.markers[geometry.markers.length - 1].y.toFixed(2)}" r="2" fill="#ea580c"></circle>
    ${currentMarker ? `<circle cx="${currentMarker.x.toFixed(2)}" cy="${currentMarker.y.toFixed(2)}" r="3.3" fill="rgba(15,59,102,.18)"></circle>` : ""}
  `;

  const currentPoint = detailState.trackPoints[detailState.playbackIndex];
  badge.textContent = currentPoint ? `当前点 ${detailState.playbackIndex + 1} / ${detailState.trackPoints.length}` : "轨迹已加载";
  startNode.textContent = `起点: ${formatTime(detailState.trackPoints[0]?.ts)}`;
  endNode.textContent = `终点: ${formatTime(detailState.trackPoints[detailState.trackPoints.length - 1]?.ts)}`;
}

function renderTrackPlayback() {
  const points = detailState.trackPoints;
  const summary = getTrackSummary(points);
  const progress = $("track-progress");
  const current = points[detailState.playbackIndex] || null;

  $("track-total-points").textContent = String(summary.totalPoints || 0);
  $("track-distance").textContent = formatDistance(summary.distanceMeters || 0);
  $("track-duration").textContent = summary.durationMs ? formatDuration(summary.durationMs) : "-";
  $("track-accuracy").textContent = summary.averageAccuracy ? `${Math.round(summary.averageAccuracy)} m` : "-";

  progress.max = String(Math.max(0, points.length - 1));
  progress.value = String(Math.max(0, detailState.playbackIndex));

  if (!current) {
    $("track-progress-label").textContent = "第 0 / 0 点";
    $("track-progress-time").textContent = "--:--:--";
    $("track-current-title").textContent = "暂无轨迹点";
    $("track-current-coords").textContent = "坐标: -";
    $("track-current-accuracy").textContent = "精度: -";
    $("track-current-extra").textContent = "等待轨迹数据";
    renderTrackMap();
    return;
  }

  const previous = points[Math.max(0, detailState.playbackIndex - 1)];
  const hopDistance = detailState.playbackIndex > 0 ? haversineMeters(previous, current) : 0;

  $("track-progress-label").textContent = `第 ${detailState.playbackIndex + 1} / ${points.length} 点`;
  $("track-progress-time").textContent = formatTime(current.ts);
  $("track-current-title").textContent = `轨迹点 ${detailState.playbackIndex + 1}`;
  $("track-current-coords").textContent = `坐标: ${current.lat.toFixed(5)}, ${current.lng.toFixed(5)}`;
  $("track-current-accuracy").textContent = `精度: ${Math.round(current.accuracy || 0)} m`;
  $("track-current-extra").innerHTML = `
    与上一点距离: ${escapeHtml(formatDistance(hopDistance))}
    ${getMapLink(current.lat, current.lng) ? ` / <a href="${getMapLink(current.lat, current.lng)}" target="_blank" rel="noreferrer">查看地图</a>` : ""}
  `;

  renderTrackMap();
}

function renderTrackList() {
  const wrap = $("detail-tracks");
  if (!detailState.trackPoints.length) {
    wrap.innerHTML = `<div class="empty">当天没有轨迹记录。</div>`;
    return;
  }

  wrap.innerHTML = detailState.trackPoints.map((point, index) => `
    <div class="list-item ${index === detailState.playbackIndex ? "active" : ""}" data-track-index="${index}">
      <div class="list-item-title">轨迹点 ${index + 1}</div>
      <div class="pill-row">
        ${index === 0 ? '<span class="pill success">起点</span>' : ""}
        ${index === detailState.trackPoints.length - 1 ? '<span class="pill warning">终点</span>' : ""}
        ${index === detailState.playbackIndex ? '<span class="pill info">当前播放</span>' : ""}
      </div>
      <div class="list-item-meta">时间: ${escapeHtml(formatTime(point.ts))}</div>
      <div class="list-item-meta">坐标: ${escapeHtml(point.lat.toFixed(5))}, ${escapeHtml(point.lng.toFixed(5))}</div>
      <div class="list-item-meta">精度: ${escapeHtml(Math.round(point.accuracy || 0))} m</div>
      ${getMapLink(point.lat, point.lng) ? `<div class="list-item-meta"><a href="${getMapLink(point.lat, point.lng)}" target="_blank" rel="noreferrer">查看地图</a></div>` : ""}
    </div>
  `).join("");

  wrap.querySelectorAll("[data-track-index]").forEach((node) => {
    node.addEventListener("click", () => {
      stopPlayback();
      setPlaybackIndex(Number(node.getAttribute("data-track-index")));
    });
  });
}

function playPlayback() {
  if (!detailState.trackPoints.length) return;
  if (detailState.playbackTimer) {
    stopPlayback();
    return;
  }

  $("track-play").textContent = "暂停回放";
  detailState.playbackTimer = setInterval(() => {
    if (detailState.playbackIndex >= detailState.trackPoints.length - 1) {
      stopPlayback();
      return;
    }
    setPlaybackIndex(detailState.playbackIndex + 1);
  }, 700);
}

function renderTracks() {
  renderTrackPlayback();
  renderTrackList();
}

async function loadData() {
  if (!detailState.userId) {
    setStatus("缺少员工参数。", true);
    return;
  }

  stopPlayback();
  setStatus("正在加载考勤详情...");

  const [payroll, checkins, visits, tracks] = await Promise.all([
    fetchJson(`/api/field-payroll?user=${encodeURIComponent(detailState.userId)}&date=${encodeURIComponent(detailState.date)}`),
    fetchJson(`/api/field-checkins?user=${encodeURIComponent(detailState.userId)}&date=${encodeURIComponent(detailState.date)}`),
    fetchJson(`/api/field-visits?user=${encodeURIComponent(detailState.userId)}&date=${encodeURIComponent(detailState.date)}`),
    fetchJson(`/api/field-tracks?user=${encodeURIComponent(detailState.userId)}&date=${encodeURIComponent(detailState.date)}`)
  ]);

  detailState.payroll = payroll || null;
  detailState.checkins = Array.isArray(checkins.items) ? checkins.items : [];
  detailState.visits = Array.isArray(visits.items) ? visits.items : [];
  detailState.tracks = Array.isArray(tracks.items) ? tracks.items : [];
  detailState.trackPoints = normalizeTrackPoints(detailState.tracks);
  detailState.playbackIndex = 0;

  renderPayroll();
  renderCheckins();
  renderVisits();
  renderTracks();

  setStatus(detailState.trackPoints.length
    ? `已加载 ${detailState.trackPoints.length} 个轨迹点，可以播放回放。`
    : "当天暂无轨迹点，仍可查看打卡与拜访记录。");
}

function initFromQuery() {
  const params = new URLSearchParams(window.location.search);
  detailState.userId = params.get("user") || "";
  detailState.date = params.get("date") || detailState.date;
  detailState.employeeName = params.get("name") || "";
}

function bindEvents() {
  $("detail-refresh")?.addEventListener("click", () => {
    loadData().catch((error) => setStatus(error.message || "刷新失败", true));
  });

  $("track-play").addEventListener("click", () => {
    playPlayback();
  });

  $("track-reset").addEventListener("click", () => {
    stopPlayback();
    setPlaybackIndex(0);
  });

  $("track-progress").addEventListener("input", (event) => {
    stopPlayback();
    setPlaybackIndex(Number(event.target.value));
  });
}

function init() {
  initFromQuery();
  bindEvents();
  loadData().catch((error) => setStatus(error.message || "加载考勤详情失败", true));
}

window.addEventListener("beforeunload", stopPlayback);
init();
