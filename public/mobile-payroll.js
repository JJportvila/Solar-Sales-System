const payrollState = {
  users: [],
  userId: "",
  date: new Date().toISOString().slice(0, 10),
  company: { summary: {}, items: [] },
  payroll: null
};

const formatter = new Intl.NumberFormat("en-US");

function $(id) {
  return document.getElementById(id);
}

function money(value) {
  return `VT ${formatter.format(Math.round(Number(value || 0)))}`;
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
  node.style.color = isError ? "#b91c1c" : "#6b7a90";
}

function formatDateText(value) {
  const date = new Date(`${String(value || "").slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value || "-");
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
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
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel || item.role || "-")}</option>`)
    .join("");
  payrollState.userId = payrollState.users[0]?.id || "";
  $("payroll-user").value = payrollState.userId;
}

function renderPayroll() {
  const payroll = payrollState.payroll || {};
  const selectedUser = payrollState.users.find((item) => item.id === payrollState.userId);
  $("payroll-user-title").textContent = selectedUser ? `${selectedUser.name} 的工资` : "个人工资";
  $("payroll-period-label").textContent = payroll.settlementLabel
    ? `${payroll.settlementLabel}，已自动汇总 VNPF 与预支流水。`
    : "按最近 15 天自动汇总出勤工资、VNPF 和预支扣回。";
  $("payroll-window-text").textContent = payroll.settlementLabel || "最近 15 天工资结算";
  $("payroll-attendance-status").textContent = payroll.attendanceStatus || "未出勤";
  $("payroll-total").textContent = money(payroll.netPay || payroll.attendancePay || 0);
  $("payroll-net-note").textContent = `结算区间：${formatDateText(payroll.startDate)} - ${formatDateText(payroll.endDate)}`;
  $("payroll-worked-days").textContent = `${payroll.workedDays || 0} / ${payroll.daysInPeriod || 0} 天`;
  $("payroll-hours").textContent = payroll.workHoursLabel || "0 小时";
  $("payroll-gross").textContent = money(payroll.grossPay || 0);
  $("payroll-vnpf").textContent = `${money(payroll.vnpfDeduction || 0)} (${Number(payroll.vnpfRate || 0).toFixed(2)}%)`;
  $("payroll-advance").textContent = money(payroll.advanceDeduction || 0);
  $("payroll-outstanding").textContent = money(payroll.advanceOutstanding || 0);
  $("payroll-visits").textContent = `${payroll.visitCount || 0} 次`;
  $("payroll-tracks").textContent = `${payroll.trackPointCount || 0} 点`;
}

function renderCompanyPayroll() {
  const summary = payrollState.company.summary || {};
  $("payroll-present").textContent = String(summary.presentCount || 0);
  $("payroll-company-days").textContent = `${summary.totalWorkedDays || 0} 天`;
  $("payroll-company-gross").textContent = money(summary.totalGrossPay || 0);
  $("payroll-company-total").textContent = money(summary.totalAttendancePay || 0);
  $("payroll-company-vnpf").textContent = money(summary.totalVnpfDeduction || 0);
  $("payroll-company-advance").textContent = money(summary.totalAdvanceDeduction || 0);

  const items = Array.isArray(payrollState.company.items) ? payrollState.company.items : [];
  $("payroll-list").innerHTML = items.length
    ? items.map((item) => `
        <div class="list-item">
          <div class="list-item-title">${escapeHtml(item.employeeName || "-")}</div>
          <div class="meta">${escapeHtml(item.roleLabel || item.role || "-")} / ${escapeHtml(item.settlementLabel || "-")}</div>
          <div class="list-item-row"><span class="meta">出勤</span><strong>${escapeHtml(String(item.workedDays || 0))} 天</strong></div>
          <div class="list-item-row"><span class="meta">应发</span><strong>${money(item.grossPay || 0)}</strong></div>
          <div class="list-item-row"><span class="meta">实发</span><strong class="good">${money(item.netPay || 0)}</strong></div>
        </div>
      `).join("")
    : `<div class="empty">当前区间还没有工资结算数据。</div>`;
}

function renderDailyItems() {
  const items = Array.isArray(payrollState.payroll?.dailyItems) ? payrollState.payroll.dailyItems : [];
  $("payroll-daily-list").innerHTML = items.length
    ? items.map((item) => `
        <div class="list-item">
          <div class="list-item-title">${escapeHtml(formatDateText(item.date))}</div>
          <div class="meta">${escapeHtml(item.attendanceStatus || "-")} / ${escapeHtml(item.workHoursLabel || "0 小时")}</div>
          <div class="list-item-row"><span class="meta">应发</span><strong>${money(item.grossPay || 0)}</strong></div>
          <div class="list-item-row"><span class="meta">VNPF</span><strong>${money(item.vnpfDeduction || 0)}</strong></div>
          <div class="list-item-row"><span class="meta">预支扣回</span><strong class="${item.advanceDeduction ? "warn" : ""}">${money(item.advanceDeduction || 0)}</strong></div>
          <div class="list-item-row"><span class="meta">净工资</span><strong class="good">${money(item.attendancePay || 0)}</strong></div>
        </div>
      `).join("")
    : `<div class="empty">当前区间没有打卡记录。</div>`;
}

function renderAdvanceItems() {
  const items = Array.isArray(payrollState.payroll?.advanceRecords) ? payrollState.payroll.advanceRecords : [];
  $("payroll-advance-list").innerHTML = items.length
    ? items.map((item) => `
        <div class="list-item">
          <div class="list-item-title">${item.type === "repayment" ? "工资扣回" : "预支发放"}</div>
          <div class="meta">${escapeHtml(formatDateText(item.date))} / ${escapeHtml(item.status || "-")}</div>
          <div class="list-item-row"><span class="meta">金额</span><strong class="${item.type === "repayment" ? "warn" : ""}">${money(item.amount || 0)}</strong></div>
          <div class="list-item-row"><span class="meta">审批人</span><strong>${escapeHtml(item.approvedBy || "-")}</strong></div>
          <div class="meta" style="margin-top:8px;">${escapeHtml(item.note || "-")}</div>
        </div>
      `).join("")
    : `<div class="empty">当前区间没有预支或扣回记录。</div>`;
}

function renderHistoryItems() {
  const items = Array.isArray(payrollState.payroll?.settlementHistory) ? payrollState.payroll.settlementHistory : [];
  $("payroll-history-list").innerHTML = items.length
    ? items.map((item) => `
        <div class="list-item">
          <div class="list-item-title">${escapeHtml(formatDateText(item.startDate))} - ${escapeHtml(formatDateText(item.endDate))}</div>
          <div class="meta">${escapeHtml(item.status || "-")} ${item.paidAt ? `/ 发薪 ${escapeHtml(formatDateText(item.paidAt))}` : ""}</div>
          <div class="list-item-row"><span class="meta">应发</span><strong>${money(item.grossPay || 0)}</strong></div>
          <div class="list-item-row"><span class="meta">实发</span><strong class="good">${money(item.netPay || 0)}</strong></div>
          ${item.note ? `<div class="meta" style="margin-top:8px;">${escapeHtml(item.note)}</div>` : ""}
        </div>
      `).join("")
    : `<div class="empty">还没有更早的结算记录。</div>`;
}

async function loadData() {
  if (!payrollState.userId) return;
  setStatus("正在加载工资结算...");
  const query = `date=${encodeURIComponent(payrollState.date)}&period=half_month`;
  const [company, payroll] = await Promise.all([
    fetchJson(`/api/attendance-overview?${query}`),
    fetchJson(`/api/field-payroll?user=${encodeURIComponent(payrollState.userId)}&${query}`)
  ]);
  payrollState.company = company || { summary: {}, items: [] };
  payrollState.payroll = payroll || null;
  renderPayroll();
  renderCompanyPayroll();
  renderDailyItems();
  renderAdvanceItems();
  renderHistoryItems();
  setStatus("工资结算已更新。");
}

function bindEvents() {
  $("payroll-date").value = payrollState.date;
  $("payroll-date").addEventListener("change", async (event) => {
    payrollState.date = event.target.value;
    try {
      await loadData();
    } catch (error) {
      setStatus(error.message || "工资结算加载失败", true);
    }
  });
  $("payroll-user").addEventListener("change", async (event) => {
    payrollState.userId = event.target.value;
    try {
      await loadData();
    } catch (error) {
      setStatus(error.message || "工资结算加载失败", true);
    }
  });
}

async function init() {
  await loadUsers();
  bindEvents();
  await loadData();
}

init().catch((error) => {
  setStatus(error.message || "工资结算页面初始化失败", true);
});
