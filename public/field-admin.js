const adminState = {
  users: [],
  userId: "",
  date: new Date().toISOString().slice(0, 10),
  checkins: [],
  visits: [],
  tracks: [],
  payroll: null,
  companyAttendance: { summary: {}, items: [] }
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

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function loadUsers() {
  const data = await fetchJson("/api/employees");
  adminState.users = (data.items || []).filter((item) => item.status !== "resigned");
  $("admin-user-select").innerHTML = adminState.users
    .map((item) => `<option value="${item.id}">${item.name} / ${item.roleLabel || item.role}</option>`)
    .join("");
  adminState.userId = adminState.users[0]?.id || "";
  $("admin-user-select").value = adminState.userId;
}

async function loadData() {
  const { userId, date } = adminState;
  if (!userId) return;
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
  adminState.payroll = payrollRes || null;
  adminState.companyAttendance = companyRes || { summary: {}, items: [] };
  renderAll();
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
        ${items
          .map(
            (item) => `
              <tr>
                <td class="py-2 pr-4 font-bold text-primary">${item.employeeName}</td>
                <td class="py-2 pr-4">${item.roleLabel || item.role || "-"}</td>
                <td class="py-2 pr-4">${item.attendanceStatus || "-"}</td>
                <td class="py-2 pr-4">${item.firstCheckInLabel || "-"} / ${item.lastCheckOutLabel || "-"}</td>
                <td class="py-2 pr-4">${item.visitCount || 0}</td>
                <td class="py-2 pr-4">VT ${Number(item.attendancePay || 0).toLocaleString("en-US")}</td>
                <td class="py-2 pr-4">
                  <a class="inline-flex rounded-lg bg-slate-100 px-3 py-1 font-bold text-primary" href="/mobile-attendance-detail.html?v=20260402&user=${encodeURIComponent(item.employeeId || "")}&date=${encodeURIComponent(adminState.date)}&name=${encodeURIComponent(item.employeeName || "")}">
                    GPS详情
                  </a>
                </td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderCheckins() {
  const wrap = $("checkin-table");
  if (!adminState.checkins.length) {
    wrap.textContent = "当日暂无打卡记录";
    return;
  }
  wrap.innerHTML = `
    <table class="w-full border-collapse text-left">
      <thead class="text-[11px] uppercase text-slate-500">
        <tr>
          <th class="py-2 pr-4">时间</th>
          <th class="py-2 pr-4">动作</th>
          <th class="py-2 pr-4">GPS坐标</th>
          <th class="py-2 pr-4">精度</th>
          <th class="py-2 pr-4">地图</th>
          <th class="py-2 pr-4">备注</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 text-xs">
        ${adminState.checkins
          .map(
            (item) => `
              <tr>
                <td class="py-2 pr-4">${new Date(item.ts).toLocaleTimeString()}</td>
                <td class="py-2 pr-4">${item.action === "in" ? "上班" : "下班"}</td>
                <td class="py-2 pr-4">${item.lat?.toFixed?.(5) || "-"}, ${item.lng?.toFixed?.(5) || "-"}</td>
                <td class="py-2 pr-4">${Math.round(item.accuracy || 0)}m</td>
                <td class="py-2 pr-4">
                  ${formatMapLink(item.lat, item.lng) ? `<a class="font-bold text-primary" href="${formatMapLink(item.lat, item.lng)}" target="_blank" rel="noreferrer">查看地图</a>` : "-"}
                </td>
                <td class="py-2 pr-4">${item.note || "-"}</td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function renderVisits() {
  const wrap = $("visit-table");
  if (!adminState.visits.length) {
    wrap.textContent = "当日暂无拜访记录";
    return;
  }
  wrap.innerHTML = adminState.visits
    .map(
      (visit) => `
        <div class="mb-2 rounded-xl border border-slate-200 p-3 text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold text-primary">${visit.customer}</span>
            <span class="text-slate-500">${new Date(visit.recordedAt).toLocaleTimeString()}</span>
          </div>
          <div class="mt-1 text-slate-600">${visit.address || "-"}</div>
          <div class="mt-1 text-slate-500">${visit.note || ""}</div>
          ${(Number.isFinite(Number(visit.lat)) && Number.isFinite(Number(visit.lng)))
            ? `<div class="mt-1 text-slate-500">GPS: ${escapeHtml(Number(visit.lat).toFixed(5))}, ${escapeHtml(Number(visit.lng).toFixed(5))} / 精度 ${escapeHtml(Math.round(visit.accuracy || 0))}m / <a class="font-bold text-primary" href="${formatMapLink(visit.lat, visit.lng)}" target="_blank" rel="noreferrer">查看地图</a></div>`
            : ""}
          ${visit.photoUrls?.length ? `<div class="mt-2 flex flex-wrap gap-2">${visit.photoUrls.map((url) => `<img src="${url}" class="h-14 w-14 rounded-lg border object-cover" />`).join("")}</div>` : ""}
          ${visit.audioUrl ? `<a class="mt-2 inline-block font-bold text-primary" href="${visit.audioUrl}" target="_blank" rel="noreferrer">播放录音</a>` : ""}
        </div>
      `
    )
    .join("");
}

function renderTracks() {
  const wrap = $("track-table");
  const points = adminState.tracks.flatMap((track) => track.points || []).sort((a, b) => new Date(b.ts) - new Date(a.ts));
  if (!points.length) {
    wrap.textContent = "当日暂无轨迹";
    return;
  }
  wrap.innerHTML = `
    <table class="w-full border-collapse text-left">
      <thead class="text-[11px] uppercase text-slate-500">
        <tr>
          <th class="py-2 pr-4">时间</th>
          <th class="py-2 pr-4">坐标</th>
          <th class="py-2 pr-4">精度</th>
          <th class="py-2 pr-4">地图</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 text-xs">
        ${points
          .slice(0, 80)
          .map(
            (point) => `
              <tr>
                <td class="py-2 pr-4">${new Date(point.ts).toLocaleTimeString()}</td>
                <td class="py-2 pr-4">${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</td>
                <td class="py-2 pr-4">${Math.round(point.accuracy || 0)}m</td>
                <td class="py-2 pr-4"><a class="font-bold text-primary" href="${formatMapLink(point.lat, point.lng)}" target="_blank" rel="noreferrer">查看地图</a></td>
              </tr>
            `
          )
          .join("")}
      </tbody>
    </table>
  `;
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
      <p class="mt-1 font-bold text-primary">${payroll.employeeName}</p>
      <p class="mt-1 text-xs text-slate-500">${payroll.roleLabel}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p class="text-xs text-slate-500">出勤日薪</p>
      <p class="mt-1 font-bold text-primary">VT ${Number(payroll.dailyRate || 0).toLocaleString("en-US")}</p>
      <p class="mt-1 text-xs text-slate-500">${payroll.attendanceStatus}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p class="text-xs text-slate-500">工作时长</p>
      <p class="mt-1 font-bold text-primary">${payroll.workHoursLabel}</p>
      <p class="mt-1 text-xs text-slate-500">首卡 ${payroll.firstCheckInLabel} / 末卡 ${payroll.lastCheckOutLabel}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p class="text-xs text-slate-500">净工资</p>
      <p class="mt-1 font-bold text-primary">VT ${Number(payroll.attendancePay || 0).toLocaleString("en-US")}</p>
      <p class="mt-1 text-xs text-slate-500">拜访 ${payroll.visitCount} 次 / 轨迹 ${payroll.trackPointCount} 点</p>
    </div>
  `;
}

function renderKpi() {
  const payroll = adminState.payroll || {};
  $("kpi-checkins").textContent = `${adminState.checkins.length} 次`;
  $("kpi-visits").textContent = String(adminState.visits.length);
  $("kpi-payroll").textContent = `VT ${Number(payroll.attendancePay || 0).toLocaleString("en-US")}`;
  $("kpi-attendance").textContent = payroll.attendanceStatus || "未出勤";
  $("kpi-work-hours").textContent = `工时：${payroll.workHoursLabel || "0 小时"}`;
}

function renderAll() {
  renderKpi();
  renderPayroll();
  renderCompanyOverview();
  renderCheckins();
  renderVisits();
  renderTracks();
}

function bind() {
  $("admin-user-select").onchange = (event) => {
    adminState.userId = event.target.value;
    loadData();
  };
  $("admin-date").value = adminState.date;
  $("admin-date").onchange = (event) => {
    adminState.date = event.target.value;
    loadData();
  };
  $("admin-refresh").onclick = loadData;
}

async function init() {
  await loadUsers();
  bind();
  await loadData();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    console.error(error);
  });
});
