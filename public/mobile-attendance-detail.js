const detailState = {
  userId: "",
  date: new Date().toISOString().slice(0, 10),
  employeeName: "",
  payroll: null,
  checkins: [],
  visits: [],
  tracks: []
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

function setStatus(text, isError = false) {
  const node = $("detail-status-text");
  node.textContent = text || "";
  node.style.color = isError ? "#b91c1c" : "#64748b";
}

function formatDateText(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleDateString("zh-CN");
}

function formatTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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
  $("detail-date-text").textContent = `${formatDateText(detailState.date)} 的详细打卡、拜访和轨迹记录`;
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
      <div class="list-item-meta">时间: ${escapeHtml(formatTime(item.ts))}</div>
      <div class="list-item-meta">坐标: ${escapeHtml(item.lat ?? "-")}, ${escapeHtml(item.lng ?? "-")}</div>
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
    </div>
  `).join("");
}

function renderTracks() {
  const wrap = $("detail-tracks");
  const points = detailState.tracks.flatMap((item) => item.points || []).sort((a, b) => new Date(b.ts) - new Date(a.ts));
  if (!points.length) {
    wrap.innerHTML = `<div class="empty">当天没有轨迹记录。</div>`;
    return;
  }
  wrap.innerHTML = points.slice(0, 100).map((point) => `
    <div class="list-item">
      <div class="list-item-title">${escapeHtml(formatTime(point.ts))}</div>
      <div class="list-item-meta">坐标: ${escapeHtml(point.lat)}, ${escapeHtml(point.lng)}</div>
      <div class="list-item-meta">精度: ${escapeHtml(Math.round(point.accuracy || 0))}m</div>
    </div>
  `).join("");
}

async function loadData() {
  if (!detailState.userId) {
    setStatus("缺少员工参数。", true);
    return;
  }
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
  renderPayroll();
  renderCheckins();
  renderVisits();
  renderTracks();
  setStatus("考勤详情已更新。");
}

function initFromQuery() {
  const params = new URLSearchParams(window.location.search);
  detailState.userId = params.get("user") || "";
  detailState.date = params.get("date") || detailState.date;
  detailState.employeeName = params.get("name") || "";
}

function bindEvents() {
  $("detail-refresh").addEventListener("click", () => {
    loadData().catch((error) => setStatus(error.message || "刷新失败", true));
  });
}

function init() {
  initFromQuery();
  bindEvents();
  loadData().catch((error) => setStatus(error.message || "加载考勤详情失败", true));
}

init();
