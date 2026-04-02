const payrollState = {
  users: [],
  userId: "",
  date: new Date().toISOString().slice(0, 10),
  company: { summary: {}, items: [] },
  payroll: null
};

const payrollFormatter = new Intl.NumberFormat("en-US");

function $(id) {
  return document.getElementById(id);
}

function money(value) {
  return `VT ${payrollFormatter.format(Number(value || 0))}`;
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
  const node = $("payroll-status-text");
  node.textContent = text || "";
  node.style.color = isError ? "#b91c1c" : "#64748b";
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

async function loadUsers() {
  const result = await fetchJson("/api/employees");
  payrollState.users = Array.isArray(result.items)
    ? result.items.filter((item) => item.status !== "resigned")
    : [];
  $("payroll-user").innerHTML = payrollState.users
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel || item.role)}</option>`)
    .join("");
  payrollState.userId = payrollState.users[0]?.id || "";
  $("payroll-user").value = payrollState.userId;
}

function renderPayroll() {
  const payroll = payrollState.payroll || {};
  $("payroll-status").textContent = payroll.attendanceStatus || "未出勤";
  $("payroll-total").textContent = money(payroll.attendancePay || 0);
  $("payroll-first").textContent = payroll.firstCheckInLabel || "-";
  $("payroll-last").textContent = payroll.lastCheckOutLabel || "-";
  $("payroll-hours").textContent = payroll.workHoursLabel || "0 小时";
  $("payroll-visits").textContent = String(payroll.visitCount || 0);
}

function renderCompanyPayroll() {
  const summary = payrollState.company.summary || {};
  $("payroll-present").textContent = String(summary.presentCount || 0);
  $("payroll-onduty").textContent = String(summary.onDutyCount || 0);
  $("payroll-absent").textContent = String(summary.absentCount || 0);
  $("payroll-company-total").textContent = money(summary.totalAttendancePay || 0);

  const items = Array.isArray(payrollState.company.items) ? payrollState.company.items : [];
  $("payroll-list").innerHTML = items.length
    ? items.map((item) => `
        <div class="employee-card">
          <div class="employee-title">${escapeHtml(item.employeeName || "-")}</div>
          <div class="employee-meta">${escapeHtml(item.roleLabel || item.role || "-")} / ${escapeHtml(item.attendanceStatus || "-")}</div>
          <div class="grid two" style="margin-top:10px;">
            <div class="metric"><label>净工资</label><strong>${money(item.attendancePay || 0)}</strong></div>
            <div class="metric"><label>工时</label><strong>${escapeHtml(item.workHoursLabel || "0 小时")}</strong></div>
          </div>
        </div>
      `).join("")
    : `<div class="empty">当天还没有工资结算数据。</div>`;
}

async function loadData() {
  if (!payrollState.userId) return;
  setStatus("正在加载工资结算...");
  const [company, payroll] = await Promise.all([
    fetchJson(`/api/attendance-overview?date=${encodeURIComponent(payrollState.date)}`),
    fetchJson(`/api/field-payroll?user=${encodeURIComponent(payrollState.userId)}&date=${encodeURIComponent(payrollState.date)}`)
  ]);
  payrollState.company = company || { summary: {}, items: [] };
  payrollState.payroll = payroll || null;
  renderPayroll();
  renderCompanyPayroll();
  setStatus("工资结算已更新。");
}

function bindEvents() {
  $("payroll-date").value = payrollState.date;
  $("payroll-date").addEventListener("change", async (event) => {
    payrollState.date = event.target.value;
    try {
      await loadData();
    } catch (error) {
      setStatus(error.message || "加载工资结算失败", true);
    }
  });
  $("payroll-user").addEventListener("change", async (event) => {
    payrollState.userId = event.target.value;
    try {
      await loadData();
    } catch (error) {
      setStatus(error.message || "加载工资结算失败", true);
    }
  });
}

async function init() {
  await loadUsers();
  bindEvents();
  await loadData();
}

init().catch((error) => {
  setStatus(error.message || "工资结算页初始化失败", true);
});
