const employeeState = {
  items: [],
  monthlyTrend: [],
  summary: {
    total: 0,
    activeCount: 0,
    workingHeadcount: 0,
    resignedCount: 0,
    attendanceRate: 0,
    roleCounts: {
      engineer: 0,
      sales: 0,
      sales_manager: 0,
      admin: 0
    }
  }
};

const roleMeta = {
  engineer: { label: "工程师", color: "bg-cyan-100 text-cyan-700" },
  sales: { label: "销售", color: "bg-amber-100 text-amber-700" },
  sales_manager: { label: "销售经理", color: "bg-indigo-100 text-indigo-700" },
  admin: { label: "管理员", color: "bg-slate-200 text-slate-700" }
};

const statusMeta = {
  active: { label: "在岗", color: "bg-emerald-100 text-emerald-700" },
  training: { label: "培训中", color: "bg-sky-100 text-sky-700" },
  leave: { label: "休假", color: "bg-amber-100 text-amber-700" },
  resigned: { label: "离职", color: "bg-rose-100 text-rose-700" }
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value) {
  return `VT ${new Intl.NumberFormat("en-US").format(Number(value || 0))}`;
}

function formatRole(role) {
  return roleMeta[role]?.label || "员工";
}

function formatStatus(status) {
  return statusMeta[status]?.label || "在岗";
}

function renderTrend() {
  const wrap = document.getElementById("employee-trend");
  const items = employeeState.monthlyTrend;
  const maxValue = Math.max(1, ...items.map((item) => Math.max(item.completed || 0, item.target || 0)));
  wrap.innerHTML = items.map((item) => {
    const targetHeight = Math.max(18, Math.round(((item.target || 0) / maxValue) * 180));
    const completedHeight = Math.max(18, Math.round(((item.completed || 0) / maxValue) * 180));
    return `
      <div class="flex h-full flex-col items-center justify-end gap-3">
        <div class="flex h-[200px] w-full items-end justify-center gap-2">
          <div class="w-1/2 rounded-t-2xl bg-slate-200" style="height:${targetHeight}px"></div>
          <div class="w-1/2 rounded-t-2xl bg-secondary-container" style="height:${completedHeight}px"></div>
        </div>
        <div class="text-center">
          <div class="text-xs font-bold text-slate-500">${escapeHtml(item.label || "-")}</div>
          <div class="mt-1 text-[11px] text-slate-400">目标 ${item.target || 0} / 完成 ${item.completed || 0}</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderSummary() {
  const roleSummary = document.getElementById("employee-role-summary");
  const total = document.getElementById("employee-total");
  const resigned = document.getElementById("employee-resigned");
  const attendance = document.getElementById("employee-attendance");
  const attendanceBar = document.getElementById("employee-attendance-bar");
  const summary = employeeState.summary;

  const rows = [
    ["engineer", "工程师", summary.roleCounts.engineer],
    ["sales", "销售", summary.roleCounts.sales],
    ["sales_manager", "销售经理", summary.roleCounts.sales_manager],
    ["admin", "管理员", summary.roleCounts.admin]
  ];

  roleSummary.innerHTML = rows.map(([key, label, value]) => `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <span class="inline-block h-3 w-3 rounded-full ${key === "engineer" ? "bg-cyan-500" : key === "sales" ? "bg-amber-500" : key === "sales_manager" ? "bg-indigo-500" : "bg-slate-500"}"></span>
        <span class="text-sm font-medium text-slate-700">${label}</span>
      </div>
      <span class="text-base font-black text-primary">${value || 0}</span>
    </div>
  `).join("");

  total.textContent = String(summary.total || 0);
  resigned.textContent = String(summary.resignedCount || 0);
  attendance.textContent = `${summary.attendanceRate || 0}%`;
  attendanceBar.style.width = `${Math.max(0, Math.min(100, summary.attendanceRate || 0))}%`;
}

function getFilteredEmployees() {
  const keyword = (document.getElementById("employee-search").value || "").trim().toLowerCase();
  const role = document.getElementById("employee-role-filter").value;
  const status = document.getElementById("employee-status-filter").value;

  return employeeState.items.filter((item) => {
    const haystack = [
      item.name,
      item.employeeNo,
      item.branch,
      item.email,
      item.phone,
      item.roleLabel,
      ...(Array.isArray(item.skills) ? item.skills : [])
    ].join(" ").toLowerCase();
    return (!keyword || haystack.includes(keyword))
      && (role === "all" || item.role === role)
      && (status === "all" || item.status === status);
  });
}

function renderEmployeeList() {
  const wrap = document.getElementById("employee-list");
  const rows = getFilteredEmployees();

  if (!rows.length) {
    wrap.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-5 py-4 text-sm text-slate-500">当前没有匹配的员工记录。</div>`;
    return;
  }

  wrap.innerHTML = rows.map((item) => {
    const roleChip = roleMeta[item.role]?.color || "bg-slate-200 text-slate-700";
    const statusChip = statusMeta[item.status]?.color || "bg-slate-200 text-slate-700";
    const skills = (item.skills || []).map((skill) => `<span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">${escapeHtml(skill)}</span>`).join("");
    const payroll = item.payrollSummary || {};
    const commissionRate = Number(payroll.commissionRate || 0) * 100;
    return `
      <div class="rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-low p-5 transition hover:shadow-sm">
        <div class="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div class="grid flex-1 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)_minmax(300px,0.7fr)]">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">${escapeHtml(item.employeeNo)}</span>
                <span class="rounded-full px-3 py-1 text-xs font-bold ${roleChip}">${escapeHtml(item.roleLabel || formatRole(item.role))}</span>
                <span class="rounded-full px-3 py-1 text-xs font-bold ${statusChip}">${escapeHtml(item.statusLabel || formatStatus(item.status))}</span>
              </div>
              <a href="/employee-detail.html?id=${encodeURIComponent(item.id)}" class="mt-3 block text-xl font-black text-primary hover:text-secondary">${escapeHtml(item.name)}</a>
              <div class="mt-1 text-sm text-slate-500">${escapeHtml(item.branch || "-")}${item.hireDate ? ` / 入职 ${escapeHtml(item.hireDate)}` : ""}${item.resignedAt ? ` / 离职 ${escapeHtml(item.resignedAt)}` : ""}</div>
              <div class="mt-2 text-sm text-slate-500">${escapeHtml(item.phone || "-")} / ${escapeHtml(item.email || "-")}</div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="rounded-2xl bg-white px-4 py-3">
                <div class="text-[11px] uppercase tracking-widest text-slate-400">工资合计</div>
                <div class="mt-1 text-lg font-black text-primary">${formatMoney(payroll.total)}</div>
              </div>
              <div class="rounded-2xl bg-white px-4 py-3">
                <div class="text-[11px] uppercase tracking-widest text-slate-400">佣金</div>
                <div class="mt-1 text-lg font-black text-secondary">${formatMoney(payroll.commission)}</div>
              </div>
              <div class="rounded-2xl bg-white px-4 py-3">
                <div class="text-[11px] uppercase tracking-widest text-slate-400">${escapeHtml(item.metrics?.primaryLabel || "主指标")}</div>
                <div class="mt-1 text-lg font-black text-primary">${escapeHtml(item.metrics?.primaryValue || "-")}</div>
              </div>
              <div class="rounded-2xl bg-white px-4 py-3">
                <div class="text-[11px] uppercase tracking-widest text-slate-400">${escapeHtml(item.metrics?.secondaryLabel || "第二指标")}</div>
                <div class="mt-1 text-lg font-black text-primary">${escapeHtml(item.metrics?.secondaryValue || "-")}</div>
              </div>
            </div>
            <div>
              <div class="text-[11px] uppercase tracking-widest text-slate-400">工资规则</div>
              <div class="mt-3 space-y-2 text-sm text-slate-600">
                <div>工时工资：${formatMoney(payroll.workSalary)}</div>
                <div>基本工资：${formatMoney(payroll.baseSalary)}</div>
                <div>绩效工资：${formatMoney(payroll.performanceSalary)}</div>
                <div>销售提成：${commissionRate.toFixed(commissionRate % 1 ? 1 : 0)}%</div>
                <div>出勤日薪：${formatMoney(item.baseDailyRate || 0)}</div>
                <div>预支工资：${formatMoney(item.advanceBalance || 0)}</div>
                <div>欠款：${formatMoney(item.debtBalance || 0)}</div>
                <div>VNPF：${Number(item.vnpfRate || 0).toFixed(2)}%</div>
              </div>
              <div class="mt-4 text-[11px] uppercase tracking-widest text-slate-400">技能标签</div>
              <div class="mt-2 flex flex-wrap gap-2">${skills || '<span class="text-sm text-slate-400">暂无技能标签</span>'}</div>
            </div>
          </div>
          <div class="flex shrink-0 flex-wrap gap-3 xl:w-[280px] xl:justify-end">
            <a href="/employee-detail.html?id=${encodeURIComponent(item.id)}" class="rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary">详情</a>
            <button class="rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary" data-action="edit" data-id="${escapeHtml(item.id)}">编辑</button>
            <button class="rounded-xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700" data-action="retire" data-id="${escapeHtml(item.id)}">${item.status === "resigned" ? "已离职" : "办理离职"}</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function getDefaultPayroll(role) {
  if (role === "sales") {
    return { hourlyRate: 850, workHours: 176, baseSalary: 0, performanceSalary: 0, commissionRate: 3 };
  }
  if (role === "sales_manager") {
    return { hourlyRate: 0, workHours: 0, baseSalary: 185000, performanceSalary: 42000, commissionRate: 1.8 };
  }
  if (role === "engineer") {
    return { hourlyRate: 780, workHours: 184, baseSalary: 0, performanceSalary: 12000, commissionRate: 0 };
  }
  return { hourlyRate: 0, workHours: 0, baseSalary: 165000, performanceSalary: 18000, commissionRate: 0 };
}

function syncPayrollFields(role) {
  const current = getDefaultPayroll(role);
  const map = [
    ["employee-hourly-rate", current.hourlyRate],
    ["employee-work-hours", current.workHours],
    ["employee-base-salary", current.baseSalary],
    ["employee-performance-salary", current.performanceSalary],
    ["employee-commission-rate", current.commissionRate]
  ];
  map.forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input && !input.dataset.dirty) {
      input.value = value;
    }
  });
}

function openModal(employee) {
  const modal = document.getElementById("employee-modal");
  const title = document.getElementById("employee-modal-title");
  const item = employee || null;
  const rawPayroll = item?.payroll || {};
  const payroll = {
    ...getDefaultPayroll(item?.role || "engineer"),
    ...rawPayroll,
    commissionRate: rawPayroll.commissionRate != null
      ? Number((Number(rawPayroll.commissionRate || 0) * 100).toFixed(2))
      : getDefaultPayroll(item?.role || "engineer").commissionRate
  };

  document.getElementById("employee-id").value = item?.id || "";
  document.getElementById("employee-name").value = item?.name || "";
  document.getElementById("employee-no").value = item?.employeeNo || "";
  document.getElementById("employee-role").value = item?.role || "engineer";
  document.getElementById("employee-status").value = item?.status || "active";
  document.getElementById("employee-branch").value = item?.branch || "";
  document.getElementById("employee-phone").value = item?.phone || "";
  document.getElementById("employee-email").value = item?.email || "";
  document.getElementById("employee-hire-date").value = item?.hireDate || "";
  document.getElementById("employee-skills").value = Array.isArray(item?.skills) ? item.skills.join(", ") : "";
  document.getElementById("employee-primary-label").value = item?.metrics?.primaryLabel || "";
  document.getElementById("employee-primary-value").value = item?.metrics?.primaryValue || "";
  document.getElementById("employee-secondary-label").value = item?.metrics?.secondaryLabel || "";
  document.getElementById("employee-secondary-value").value = item?.metrics?.secondaryValue || "";
  document.getElementById("employee-rating-label").value = item?.metrics?.ratingLabel || "";
  document.getElementById("employee-rating-value").value = item?.metrics?.ratingValue || "";
  document.getElementById("employee-hourly-rate").value = payroll.hourlyRate;
  document.getElementById("employee-work-hours").value = payroll.workHours;
  document.getElementById("employee-base-salary").value = payroll.baseSalary;
  document.getElementById("employee-performance-salary").value = payroll.performanceSalary;
  document.getElementById("employee-commission-rate").value = payroll.commissionRate;
  document.getElementById("employee-pin").value = item?.pin || "0000";
  document.getElementById("employee-base-daily-rate").value = item?.baseDailyRate || 0;
  document.getElementById("employee-advance-balance").value = item?.advanceBalance || 0;
  document.getElementById("employee-debt-balance").value = item?.debtBalance || 0;
  document.getElementById("employee-vnpf-rate").value = item?.vnpfRate || 4;

  ["employee-hourly-rate", "employee-work-hours", "employee-base-salary", "employee-performance-salary", "employee-commission-rate"].forEach((id) => {
    const input = document.getElementById(id);
    input.dataset.dirty = "";
  });

  title.textContent = item ? "编辑员工" : "新增员工";
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeModal() {
  const modal = document.getElementById("employee-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function collectFormPayload() {
  const role = document.getElementById("employee-role").value;
  const status = document.getElementById("employee-status").value;
  return {
    id: document.getElementById("employee-id").value.trim(),
    name: document.getElementById("employee-name").value.trim(),
    employeeNo: document.getElementById("employee-no").value.trim(),
    role,
    roleLabel: formatRole(role),
    status,
    statusLabel: formatStatus(status),
    branch: document.getElementById("employee-branch").value.trim(),
    phone: document.getElementById("employee-phone").value.trim(),
    email: document.getElementById("employee-email").value.trim(),
    hireDate: document.getElementById("employee-hire-date").value.trim(),
    skills: document.getElementById("employee-skills").value.split(",").map((item) => item.trim()).filter(Boolean),
    payroll: {
      hourlyRate: Number(document.getElementById("employee-hourly-rate").value || 0),
      workHours: Number(document.getElementById("employee-work-hours").value || 0),
      baseSalary: Number(document.getElementById("employee-base-salary").value || 0),
      performanceSalary: Number(document.getElementById("employee-performance-salary").value || 0),
      commissionRate: Number(document.getElementById("employee-commission-rate").value || 0) / 100
    },
    pin: document.getElementById("employee-pin").value.trim() || "0000",
    baseDailyRate: Number(document.getElementById("employee-base-daily-rate").value || 0),
    advanceBalance: Number(document.getElementById("employee-advance-balance").value || 0),
    debtBalance: Number(document.getElementById("employee-debt-balance").value || 0),
    vnpfRate: Number(document.getElementById("employee-vnpf-rate").value || 0),
    metrics: {
      primaryLabel: document.getElementById("employee-primary-label").value.trim(),
      primaryValue: document.getElementById("employee-primary-value").value.trim(),
      secondaryLabel: document.getElementById("employee-secondary-label").value.trim(),
      secondaryValue: document.getElementById("employee-secondary-value").value.trim(),
      ratingLabel: document.getElementById("employee-rating-label").value.trim(),
      ratingValue: document.getElementById("employee-rating-value").value.trim()
    }
  };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

async function loadEmployees() {
  const response = await fetch("/api/employees");
  const result = await response.json();
  employeeState.items = Array.isArray(result.items) ? result.items : [];
  employeeState.monthlyTrend = Array.isArray(result.monthlyTrend) ? result.monthlyTrend : [];
  employeeState.summary = result.summary || employeeState.summary;
  renderTrend();
  renderSummary();
  renderEmployeeList();
}

function exportEmployees() {
  const rows = getFilteredEmployees();
  const headers = ["姓名", "员工编号", "角色", "状态", "机构", "工资合计", "佣金", "销售提成%", "电话", "邮箱"];
  const csvRows = [
    headers.join(","),
    ...rows.map((item) => [
      item.name,
      item.employeeNo,
      item.roleLabel || formatRole(item.role),
      item.statusLabel || formatStatus(item.status),
      item.branch,
      item.payrollSummary?.total || 0,
      item.payrollSummary?.commission || 0,
      ((Number(item.payrollSummary?.commissionRate || 0) * 100).toFixed(2)).replace(/\.00$/, ""),
      item.phone,
      item.email
    ].map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","))
  ];
  const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "employees.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function bindEvents() {
  document.getElementById("employee-add-btn").addEventListener("click", () => openModal());
  document.getElementById("employee-modal-close").addEventListener("click", closeModal);
  document.getElementById("employee-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("employee-export-btn").addEventListener("click", exportEmployees);
  document.getElementById("employee-search").addEventListener("input", renderEmployeeList);
  document.getElementById("employee-role-filter").addEventListener("change", renderEmployeeList);
  document.getElementById("employee-status-filter").addEventListener("change", renderEmployeeList);
  document.getElementById("employee-role").addEventListener("change", (event) => syncPayrollFields(event.target.value));

  ["employee-hourly-rate", "employee-work-hours", "employee-base-salary", "employee-performance-salary", "employee-commission-rate"].forEach((id) => {
    document.getElementById(id).addEventListener("input", (event) => {
      event.target.dataset.dirty = "true";
    });
  });

  document.getElementById("employee-modal").addEventListener("click", (event) => {
    if (event.target.id === "employee-modal") closeModal();
  });

  document.getElementById("employee-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const employee = collectFormPayload();
    if (!employee.name || !employee.employeeNo) {
      window.alert("请先填写姓名和员工编号。");
      return;
    }
    const isEdit = Boolean(employee.id);
    const result = await postJson(isEdit ? "/api/employees/update" : "/api/employees", isEdit ? { id: employee.id, employee } : { employee });
    if (!result.ok) {
      window.alert(result.error || "保存失败");
      return;
    }
    closeModal();
    await loadEmployees();
  });

  document.getElementById("employee-list").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    const employee = employeeState.items.find((item) => item.id === id);
    if (!employee) return;

    if (button.dataset.action === "edit") {
      openModal(employee);
      return;
    }

    if (button.dataset.action === "retire") {
      if (employee.status === "resigned") {
        window.alert("这名员工已经办理离职。");
        return;
      }
      if (!window.confirm(`确认将 ${employee.name} 办理离职并保留历史档案吗？`)) return;
      const result = await postJson("/api/employees/delete", { id, resignedAt: new Date().toISOString().slice(0, 10) });
      if (!result.ok) {
        window.alert(result.error || "离职处理失败");
        return;
      }
      await loadEmployees();
    }
  });
}

bindEvents();
loadEmployees().catch((error) => {
  console.error(error);
  document.getElementById("employee-list").innerHTML = `<div class="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">员工数据加载失败。</div>`;
});
