const attendanceState = {
  users: [],
  userId: "",
  date: new Date().toISOString().slice(0, 10),
  company: { summary: {}, items: [] },
  payroll: null
};

const attendanceFormatter = new Intl.NumberFormat("en-US");

function $(id) {
  return document.getElementById(id);
}

function money(value) {
  return `VT ${attendanceFormatter.format(Number(value || 0))}`;
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
  const node = $("attendance-status");
  node.textContent = text || "";
  node.style.color = isError ? "#b91c1c" : "#64748b";
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function statusClass(value) {
  const map = {
    未出勤: "warning",
    在岗中: "info",
    已下班: "success",
    已出勤: "success"
  };
  return map[value] || "info";
}

async function loadUsers() {
  const result = await fetchJson("/api/employees");
  attendanceState.users = Array.isArray(result.items)
    ? result.items.filter((item) => item.status !== "resigned")
    : [];
  const select = $("attendance-user");
  select.innerHTML = attendanceState.users
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel || item.role)}</option>`)
    .join("");
  attendanceState.userId = attendanceState.users[0]?.id || "";
  select.value = attendanceState.userId;
}

function renderCompany() {
  const summary = attendanceState.company.summary || {};
  $("company-present").textContent = String(summary.presentCount || 0);
  $("company-onduty").textContent = String(summary.onDutyCount || 0);
  $("company-absent").textContent = String(summary.absentCount || 0);
  $("company-payroll").textContent = money(summary.totalAttendancePay || 0);

  const list = $("attendance-company-list");
  const items = Array.isArray(attendanceState.company.items) ? attendanceState.company.items : [];
  const filteredItems = attendanceState.userId
    ? items.filter((item) => item.employeeId === attendanceState.userId)
    : items;
  if (!filteredItems.length) {
    list.innerHTML = `<div class="empty">今天还没有公司考勤数据。</div>`;
    return;
  }

  list.innerHTML = filteredItems
    .map((item) => `
      <div class="employee-card">
        <div class="status-row">
          <strong>${escapeHtml(item.employeeName || "-")}</strong>
          <span class="tag ${statusClass(item.attendanceStatus)}">${escapeHtml(item.attendanceStatus || "待定")}</span>
        </div>
        <div class="employee-meta">${escapeHtml(item.roleLabel || item.role || "-")} / 首卡 ${escapeHtml(item.firstCheckInLabel || "-")} / 末卡 ${escapeHtml(item.lastCheckOutLabel || "-")}</div>
        <div class="grid two" style="margin-top:10px;">
          <div class="metric"><label>拜访数</label><strong>${escapeHtml(item.visitCount || 0)}</strong></div>
          <div class="metric"><label>净工资</label><strong>${money(item.attendancePay || 0)}</strong></div>
        </div>
        <div class="grid" style="margin-top:10px;">
      <a class="btn secondary" href="/mobile-attendance-detail.html?v=20260403&user=${encodeURIComponent(item.employeeId || "")}&date=${encodeURIComponent(attendanceState.date)}&name=${encodeURIComponent(item.employeeName || "")}">查看详细打卡记录</a>
        </div>
      </div>
    `)
    .join("");
}


async function loadData() {
  if (!attendanceState.userId) {
    return;
  }

  setStatus("正在加载考勤数据...");
  const date = attendanceState.date;
  const company = await fetchJson(`/api/attendance-overview?date=${encodeURIComponent(date)}`);
  attendanceState.company = company || { summary: {}, items: [] };
  renderCompany();
  setStatus("全员考勤已更新。");
}

function bindEvents() {
  $("attendance-date").value = attendanceState.date;
  $("attendance-date").addEventListener("change", async (event) => {
    attendanceState.date = event.target.value;
    try {
      await loadData();
    } catch (error) {
      setStatus(error.message || "加载考勤失败", true);
    }
  });

  $("attendance-user").addEventListener("change", async (event) => {
    attendanceState.userId = event.target.value;
    try {
      await loadData();
    } catch (error) {
      setStatus(error.message || "加载考勤失败", true);
    }
  });


}

async function init() {
  await loadUsers();
  bindEvents();
  await loadData();
}

init().catch((error) => {
  setStatus(error.message || "手机考勤页初始化失败", true);
});
