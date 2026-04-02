const adminState = {
  users: [],
  userId: "",
  date: new Date().toISOString().slice(0, 10),
  checkins: [],
  visits: [],
  tracks: [],
  payroll: null,
  companyAttendance: { summary: {}, items: [] },
  trackPoints: [],
  playbackIndex: 0,
  playbackTimer: null
};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMapLink(lat, lng) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return "";
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
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

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
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
    return { totalPoints: 0, distanceMeters: 0, averageAccuracy: 0, durationMs: 0 };
  }
  let distanceMeters = 0;
  for (let index = 1; index < points.length; index += 1) {
    distanceMeters += haversineMeters(points[index - 1], points[index]);
  }
  const accuracies = points.map((point) => Number(point.accuracy || 0)).filter((value) => Number.isFinite(value) && value > 0);
  const start = new Date(points[0].ts).getTime();
  const end = new Date(points[points.length - 1].ts).getTime();
  return {
    totalPoints: points.length,
    distanceMeters,
    averageAccuracy: accuracies.length ? accuracies.reduce((sum, value) => sum + value, 0) / accuracies.length : 0,
    durationMs: Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0
  };
}

function buildTrackGeometry(points = []) {
  if (!points.length) return { polyline: "", markers: [] };
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

function stopPlayback() {
  if (adminState.playbackTimer) {
    clearInterval(adminState.playbackTimer);
    adminState.playbackTimer = null;
  }
  $("track-play").textContent = "播放回放";
}

function setPlaybackIndex(index) {
  const points = adminState.trackPoints;
  if (!points.length) {
    adminState.playbackIndex = 0;
    return;
  }
  adminState.playbackIndex = Math.max(0, Math.min(points.length - 1, Number(index) || 0));
  renderTrackPlayback();
  renderTracks();
}

function renderCompanyOverview() {
  const summary = adminState.companyAttendance.summary || {};
  $("company-kpi-present").textContent = String(summary.presentCount || 0);
  $("company-kpi-onduty").textContent = String(summary.onDutyCount || 0);
  $("company-kpi-absent").textContent = String(summary.absentCount || 0);
  $("company-kpi-payroll").textContent = `VT ${Number(summary.totalAttendancePay || 0).toLocaleString("en-US")}`;

  const wrap = $("company-attendance-table");
  const items = Array.isArray(adminState.companyAttendance.items) ? adminState.companyAttendance.items : [];
  if (!items.length) {
    wrap.textContent = "当天暂无公司考勤数据";
    return;
  }

  wrap.innerHTML = `
    <table class="w-full border-collapse text-left">
      <thead class="text-[11px] uppercase text-slate-500">
        <tr>
          <th class="py-2 pr-4">员工</th>
          <th class="py-2 pr-4">角色</th>
          <th class="py-2 pr-4">考勤状态</th>
          <th class="py-2 pr-4">首卡 / 末卡</th>
          <th class="py-2 pr-4">拜访</th>
          <th class="py-2 pr-4">净工资</th>
          <th class="py-2 pr-4">详情</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 text-xs">
        ${items.map((item) => `
          <tr>
            <td class="py-2 pr-4 font-bold text-primary">${escapeHtml(item.employeeName || "-")}</td>
            <td class="py-2 pr-4">${escapeHtml(item.roleLabel || item.role || "-")}</td>
            <td class="py-2 pr-4">${escapeHtml(item.attendanceStatus || "-")}</td>
            <td class="py-2 pr-4">${escapeHtml(item.firstCheckInLabel || "-")} / ${escapeHtml(item.lastCheckOutLabel || "-")}</td>
            <td class="py-2 pr-4">${Number(item.visitCount || 0)}</td>
            <td class="py-2 pr-4">VT ${Number(item.attendancePay || 0).toLocaleString("en-US")}</td>
            <td class="py-2 pr-4">
              <a class="inline-flex rounded-lg bg-slate-100 px-3 py-1 font-bold text-primary" href="/mobile-attendance-detail.html?v=20260403&user=${encodeURIComponent(item.employeeId || "")}&date=${encodeURIComponent(adminState.date)}&name=${encodeURIComponent(item.employeeName || "")}">
                GPS 详情
              </a>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderCheckins() {
  const wrap = $("checkin-table");
  if (!adminState.checkins.length) {
    wrap.textContent = "当天暂无打卡记录";
    return;
  }
  wrap.innerHTML = `
    <table class="w-full border-collapse text-left">
      <thead class="text-[11px] uppercase text-slate-500">
        <tr>
          <th class="py-2 pr-4">时间</th>
          <th class="py-2 pr-4">动作</th>
          <th class="py-2 pr-4">GPS 坐标</th>
          <th class="py-2 pr-4">精度</th>
          <th class="py-2 pr-4">地图</th>
          <th class="py-2 pr-4">备注</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 text-xs">
        ${adminState.checkins.map((item) => `
          <tr>
            <td class="py-2 pr-4">${formatTime(item.ts)}</td>
            <td class="py-2 pr-4">${item.action === "in" ? "上班" : "下班"}</td>
            <td class="py-2 pr-4">${Number.isFinite(Number(item.lat)) ? Number(item.lat).toFixed(5) : "-"}, ${Number.isFinite(Number(item.lng)) ? Number(item.lng).toFixed(5) : "-"}</td>
            <td class="py-2 pr-4">${Math.round(item.accuracy || 0)} m</td>
            <td class="py-2 pr-4">${formatMapLink(item.lat, item.lng) ? `<a class="font-bold text-cyanbrand" href="${formatMapLink(item.lat, item.lng)}" target="_blank" rel="noreferrer">查看地图</a>` : "-"}</td>
            <td class="py-2 pr-4">${escapeHtml(item.note || "-")}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderVisits() {
  const wrap = $("visit-table");
  if (!adminState.visits.length) {
    wrap.textContent = "当天暂无拜访记录";
    return;
  }
  wrap.innerHTML = adminState.visits.map((visit) => `
    <div class="mb-2 rounded-xl border border-slate-200 p-3 text-xs">
      <div class="flex items-center justify-between gap-3">
        <span class="font-bold text-primary">${escapeHtml(visit.customer || "未命名客户")}</span>
        <span class="text-slate-500">${formatTime(visit.recordedAt)}</span>
      </div>
      <div class="mt-1 text-slate-600">${escapeHtml(visit.address || "-")}</div>
      ${visit.note ? `<div class="mt-1 text-slate-500">${escapeHtml(visit.note)}</div>` : ""}
      ${(Number.isFinite(Number(visit.lat)) && Number.isFinite(Number(visit.lng))) ? `<div class="mt-1 text-slate-500">GPS: ${escapeHtml(Number(visit.lat).toFixed(5))}, ${escapeHtml(Number(visit.lng).toFixed(5))} / 精度 ${escapeHtml(Math.round(visit.accuracy || 0))} m / <a class="font-bold text-cyanbrand" href="${formatMapLink(visit.lat, visit.lng)}" target="_blank" rel="noreferrer">查看地图</a></div>` : ""}
      ${visit.photoUrls?.length ? `<div class="mt-2 flex flex-wrap gap-2">${visit.photoUrls.map((url) => `<img src="${url}" class="h-14 w-14 rounded-lg border object-cover" />`).join("")}</div>` : ""}
      ${visit.audioUrl ? `<a class="mt-2 inline-block font-bold text-cyanbrand" href="${visit.audioUrl}" target="_blank" rel="noreferrer">播放录音</a>` : ""}
    </div>
  `).join("");
}

function renderTrackMap() {
  const svg = $("admin-track-map");
  const badge = $("admin-track-map-badge");
  const startNode = $("admin-track-start");
  const endNode = $("admin-track-end");
  const geometry = buildTrackGeometry(adminState.trackPoints);
  const currentMarker = geometry.markers[adminState.playbackIndex];

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

  svg.innerHTML = `
    <rect x="0" y="0" width="100" height="100" rx="6" fill="#f8fbfe"></rect>
    <path d="M10 20H90M10 40H90M10 60H90M10 80H90M20 10V90M40 10V90M60 10V90M80 10V90" stroke="rgba(15,59,102,.08)" stroke-width="0.6"></path>
    <polyline fill="none" stroke="rgba(14,165,233,.35)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" points="${geometry.polyline}"></polyline>
    <polyline fill="none" stroke="#0ea5e9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" points="${geometry.markers.slice(0, adminState.playbackIndex + 1).map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}"></polyline>
    ${geometry.markers.map((point, index) => `
      <circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="${index === adminState.playbackIndex ? 2.2 : 1.1}" fill="${index === adminState.playbackIndex ? "#001d44" : "rgba(15,59,102,.34)"}"></circle>
    `).join("")}
    <circle cx="${geometry.markers[0].x.toFixed(2)}" cy="${geometry.markers[0].y.toFixed(2)}" r="2" fill="#16a34a"></circle>
    <circle cx="${geometry.markers[geometry.markers.length - 1].x.toFixed(2)}" cy="${geometry.markers[geometry.markers.length - 1].y.toFixed(2)}" r="2" fill="#ea580c"></circle>
    ${currentMarker ? `<circle cx="${currentMarker.x.toFixed(2)}" cy="${currentMarker.y.toFixed(2)}" r="3.2" fill="rgba(0,29,68,.18)"></circle>` : ""}
  `;

  badge.textContent = `当前点 ${adminState.trackPoints.length ? adminState.playbackIndex + 1 : 0} / ${adminState.trackPoints.length}`;
  startNode.textContent = `起点: ${formatTime(adminState.trackPoints[0]?.ts)}`;
  endNode.textContent = `终点: ${formatTime(adminState.trackPoints[adminState.trackPoints.length - 1]?.ts)}`;
}

function renderTrackPlayback() {
  const points = adminState.trackPoints;
  const summary = getTrackSummary(points);
  const current = points[adminState.playbackIndex] || null;

  $("admin-track-total").textContent = String(summary.totalPoints || 0);
  $("admin-track-distance").textContent = formatDistance(summary.distanceMeters || 0);
  $("admin-track-duration").textContent = summary.durationMs ? formatDuration(summary.durationMs) : "-";
  $("admin-track-accuracy").textContent = summary.averageAccuracy ? `${Math.round(summary.averageAccuracy)} m` : "-";

  const progress = $("admin-track-progress");
  progress.max = String(Math.max(0, points.length - 1));
  progress.value = String(Math.max(0, adminState.playbackIndex));

  if (!current) {
    $("admin-track-progress-label").textContent = "第 0 / 0 点";
    $("admin-track-progress-time").textContent = "--:--:--";
    $("admin-track-current-title").textContent = "暂无轨迹点";
    $("admin-track-current-coords").textContent = "坐标: -";
    $("admin-track-current-accuracy").textContent = "精度: -";
    $("admin-track-current-extra").textContent = "等待轨迹数据";
    renderTrackMap();
    return;
  }

  const previous = points[Math.max(0, adminState.playbackIndex - 1)];
  const hopDistance = adminState.playbackIndex > 0 ? haversineMeters(previous, current) : 0;

  $("admin-track-progress-label").textContent = `第 ${adminState.playbackIndex + 1} / ${points.length} 点`;
  $("admin-track-progress-time").textContent = formatTime(current.ts);
  $("admin-track-current-title").textContent = `轨迹点 ${adminState.playbackIndex + 1}`;
  $("admin-track-current-coords").textContent = `坐标: ${current.lat.toFixed(5)}, ${current.lng.toFixed(5)}`;
  $("admin-track-current-accuracy").textContent = `精度: ${Math.round(current.accuracy || 0)} m`;
  $("admin-track-current-extra").innerHTML = `
    与上一点距离: ${escapeHtml(formatDistance(hopDistance))}
    ${formatMapLink(current.lat, current.lng) ? ` / <a href="${formatMapLink(current.lat, current.lng)}" target="_blank" rel="noreferrer">查看地图</a>` : ""}
  `;

  renderTrackMap();
}

function renderTracks() {
  const wrap = $("track-table");
  if (!adminState.trackPoints.length) {
    wrap.textContent = "当天暂无轨迹";
    renderTrackPlayback();
    return;
  }

  wrap.innerHTML = adminState.trackPoints.map((point, index) => `
    <button type="button" class="track-row active:scale-[0.998] w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition ${index === adminState.playbackIndex ? "active" : ""}" data-track-index="${index}">
      <div class="flex items-center justify-between gap-3">
        <span class="font-bold text-primary">轨迹点 ${index + 1}</span>
        <span class="text-xs text-slate-500">${formatTime(point.ts)}</span>
      </div>
      <div class="mt-2 text-xs text-slate-600">坐标: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</div>
      <div class="mt-1 text-xs text-slate-500">精度: ${Math.round(point.accuracy || 0)} m</div>
      ${formatMapLink(point.lat, point.lng) ? `<div class="mt-1 text-xs font-bold text-cyanbrand">查看地图</div>` : ""}
    </button>
  `).join("");

  wrap.querySelectorAll("[data-track-index]").forEach((node) => {
    node.addEventListener("click", () => {
      stopPlayback();
      setPlaybackIndex(Number(node.getAttribute("data-track-index")));
    });
  });

  renderTrackPlayback();
}

function renderPayroll() {
  const panel = $("payroll-panel");
  const payroll = adminState.payroll;
  if (!payroll) {
    panel.textContent = "暂无工资数据";
    return;
  }
  panel.innerHTML = `
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p class="text-xs text-slate-500">员工</p>
      <p class="mt-1 font-bold text-primary">${escapeHtml(payroll.employeeName || "-")}</p>
      <p class="mt-1 text-xs text-slate-500">${escapeHtml(payroll.roleLabel || "-")}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p class="text-xs text-slate-500">出勤日薪</p>
      <p class="mt-1 font-bold text-primary">VT ${Number(payroll.dailyRate || 0).toLocaleString("en-US")}</p>
      <p class="mt-1 text-xs text-slate-500">${escapeHtml(payroll.attendanceStatus || "-")}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p class="text-xs text-slate-500">工作时长</p>
      <p class="mt-1 font-bold text-primary">${escapeHtml(payroll.workHoursLabel || "-")}</p>
      <p class="mt-1 text-xs text-slate-500">首卡 ${escapeHtml(payroll.firstCheckInLabel || "-")} / 末卡 ${escapeHtml(payroll.lastCheckOutLabel || "-")}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p class="text-xs text-slate-500">净工资</p>
      <p class="mt-1 font-bold text-primary">VT ${Number(payroll.attendancePay || 0).toLocaleString("en-US")}</p>
      <p class="mt-1 text-xs text-slate-500">拜访 ${Number(payroll.visitCount || 0)} 次 / 轨迹 ${Number(payroll.trackPointCount || 0)} 点</p>
    </div>
  `;
}

function renderKpi() {
  const payroll = adminState.payroll || {};
  $("kpi-checkins").textContent = `${adminState.checkins.length} 次`;
  $("kpi-visits").textContent = String(adminState.visits.length);
  $("kpi-payroll").textContent = `VT ${Number(payroll.attendancePay || 0).toLocaleString("en-US")}`;
  $("kpi-attendance").textContent = payroll.attendanceStatus || "未出勤";
  $("kpi-work-hours").textContent = `工时: ${payroll.workHoursLabel || "0 小时"}`;
}

function updateMobileDetailLink() {
  const currentUser = adminState.users.find((item) => item.id === adminState.userId);
  $("admin-mobile-detail-link").href = `/mobile-attendance-detail.html?v=20260403&user=${encodeURIComponent(adminState.userId || "")}&date=${encodeURIComponent(adminState.date)}&name=${encodeURIComponent(currentUser?.name || "")}`;
}

function renderAll() {
  renderKpi();
  renderPayroll();
  renderCompanyOverview();
  renderCheckins();
  renderVisits();
  renderTracks();
  updateMobileDetailLink();
}

async function loadUsers() {
  const data = await fetchJson("/api/employees");
  adminState.users = (data.items || []).filter((item) => item.status !== "resigned");
  $("admin-user-select").innerHTML = adminState.users
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel || item.role)}</option>`)
    .join("");
  adminState.userId = adminState.users[0]?.id || "";
  $("admin-user-select").value = adminState.userId;
}

async function loadData() {
  const { userId, date } = adminState;
  if (!userId) return;
  stopPlayback();
  const [checkinsRes, visitsRes, tracksRes, payrollRes, companyRes] = await Promise.all([
    fetchJson(`/api/field-checkins?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`),
    fetchJson(`/api/field-visits?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`),
    fetchJson(`/api/field-tracks?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`),
    fetchJson(`/api/field-payroll?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`),
    fetchJson(`/api/attendance-overview?date=${encodeURIComponent(date)}`)
  ]);
  adminState.checkins = checkinsRes.items || [];
  adminState.visits = visitsRes.items || [];
  adminState.tracks = tracksRes.items || [];
  adminState.trackPoints = normalizeTrackPoints(adminState.tracks);
  adminState.playbackIndex = 0;
  adminState.payroll = payrollRes || null;
  adminState.companyAttendance = companyRes || { summary: {}, items: [] };
  renderAll();
}

function playPlayback() {
  if (!adminState.trackPoints.length) return;
  if (adminState.playbackTimer) {
    stopPlayback();
    return;
  }
  $("track-play").textContent = "暂停回放";
  adminState.playbackTimer = setInterval(() => {
    if (adminState.playbackIndex >= adminState.trackPoints.length - 1) {
      stopPlayback();
      return;
    }
    setPlaybackIndex(adminState.playbackIndex + 1);
  }, 700);
}

function bind() {
  $("admin-user-select").addEventListener("change", (event) => {
    adminState.userId = event.target.value;
    loadData().catch(console.error);
  });
  $("admin-date").value = adminState.date;
  $("admin-date").addEventListener("change", (event) => {
    adminState.date = event.target.value;
    loadData().catch(console.error);
  });
  $("admin-refresh").addEventListener("click", () => {
    loadData().catch(console.error);
  });
  $("track-play").addEventListener("click", () => {
    playPlayback();
  });
  $("track-reset").addEventListener("click", () => {
    stopPlayback();
    setPlaybackIndex(0);
  });
  $("admin-track-progress").addEventListener("input", (event) => {
    stopPlayback();
    setPlaybackIndex(Number(event.target.value));
  });
}

async function init() {
  await loadUsers();
  bind();
  await loadData();
}

window.addEventListener("beforeunload", stopPlayback);
document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
  });
});
