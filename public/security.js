const securityState = {
  employees: [],
  security: {
    employeeAccess: [],
    moduleMatrix: [],
    ipWhitelist: [],
    emergencyLocked: false,
    auditLogs: []
  },
  editingAccessEmployeeId: "",
  editingIpId: ""
};

const roleLabels = {
  admin: "管理员",
  sales_manager: "销售经理",
  sales: "销售",
  engineer: "工程师"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatSecurityLevel(level) {
  return "—".repeat(Math.max(1, Number(level || 1)));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  return response.json();
}

async function loadEmployees() {
  const result = await fetchJson("/api/employees");
  securityState.employees = Array.isArray(result.items) ? result.items : [];
}

async function loadSecurity() {
  const result = await fetchJson("/api/security");
  securityState.security = {
    employeeAccess: Array.isArray(result.employeeAccess) ? result.employeeAccess : [],
    moduleMatrix: Array.isArray(result.moduleMatrix) ? result.moduleMatrix : [],
    ipWhitelist: Array.isArray(result.ipWhitelist) ? result.ipWhitelist : [],
    emergencyLocked: Boolean(result.emergencyLocked),
    auditLogs: Array.isArray(result.auditLogs) ? result.auditLogs : []
  };
  renderAll();
  bindDynamicEvents();
}

function getFilteredAccessRows() {
  const role = document.getElementById("security-role-filter").value;
  const keyword = (document.getElementById("security-employee-search").value || "").trim().toLowerCase();
  return securityState.security.employeeAccess.filter((item) => {
    const currentRole = item.roleOverride || item.employee?.role || "";
    const haystack = [
      item.employee?.name,
      item.employee?.email,
      item.branchScope,
      roleLabels[currentRole] || currentRole
    ].join(" ").toLowerCase();
    const roleMatch = role === "all" || currentRole === role;
    const keywordMatch = !keyword || haystack.includes(keyword);
    return roleMatch && keywordMatch;
  });
}

function renderEmployeeAccess() {
  const wrap = document.getElementById("security-employee-list");
  const rows = getFilteredAccessRows();
  if (!rows.length) {
    wrap.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-5 py-4 text-sm text-slate-500">当前没有匹配的授权记录。</div>`;
    return;
  }

  wrap.innerHTML = rows.map((item) => {
    const role = item.roleOverride || item.employee?.role || "engineer";
    const activeClass = item.accessEnabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700";
    return `
      <div class="rounded-2xl bg-surface-container-low px-4 py-4">
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_180px_160px_120px_100px] xl:items-center">
          <div class="min-w-0">
            <div class="font-bold text-primary">${escapeHtml(item.employee?.name || "-")}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.employee?.email || "-")}</div>
          </div>
          <div>
            <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">${escapeHtml(item.branchScope || item.employee?.branch || "-")}</span>
          </div>
          <div class="font-semibold text-slate-700">${escapeHtml(roleLabels[role] || role)}</div>
          <div class="font-black text-secondary">${formatSecurityLevel(item.securityLevel)}</div>
          <div class="flex items-center justify-between gap-2">
            <span class="rounded-full px-3 py-1 text-xs font-bold ${activeClass}">${item.accessEnabled ? "已启用" : "已禁用"}</span>
            <button class="rounded-lg bg-white px-3 py-2 text-xs font-bold text-primary" data-action="edit-access" data-id="${escapeHtml(item.employeeId)}">编辑</button>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderModuleMatrix() {
  const wrap = document.getElementById("security-module-list");
  const groups = {
    inventory: "库存与物流控制",
    finance: "财务与数据安全"
  };
  wrap.innerHTML = Object.entries(groups).map(([groupKey, groupLabel]) => {
    const rows = securityState.security.moduleMatrix.filter((item) => item.group === groupKey);
    return `
      <div class="space-y-4">
        <h3 class="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">${groupLabel}</h3>
        ${rows.map((item) => `
          <label class="flex items-center justify-between gap-4">
            <span class="text-sm font-semibold text-primary">${escapeHtml(item.label)}</span>
            <input class="security-module-toggle h-5 w-5 rounded border-slate-300 text-primary" data-key="${escapeHtml(item.key)}" type="checkbox" ${item.enabled ? "checked" : ""} />
          </label>
        `).join("")}
      </div>
    `;
  }).join("");
}

function renderIpWhitelist() {
  const wrap = document.getElementById("security-ip-list");
  wrap.innerHTML = securityState.security.ipWhitelist.map((item) => `
    <div class="rounded-xl border border-white/10 bg-white/10 p-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-bold">${escapeHtml(item.label)}</div>
          <div class="mt-1 text-[11px] text-white/70 font-mono">${escapeHtml(item.cidr)}</div>
        </div>
        <button class="rounded-lg bg-white/10 px-3 py-1 text-[11px] font-bold" data-action="edit-ip" data-id="${escapeHtml(item.id)}">${item.status === "active" ? "ACTIVE" : "草稿"}</button>
      </div>
    </div>
  `).join("");
}

function renderAuditLogs() {
  const wrap = document.getElementById("security-audit-list");
  const logs = securityState.security.auditLogs.slice(0, 6);
  wrap.innerHTML = logs.length
    ? logs.map((item) => `
      <div class="rounded-2xl bg-surface-container-low px-4 py-3">
        <div class="font-semibold text-primary">${escapeHtml(item.action)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.actor)} / ${new Date(item.createdAt).toLocaleString("zh-CN")}</div>
      </div>
    `).join("")
    : `<div class="rounded-2xl bg-surface-container-low px-4 py-3 text-sm text-slate-500">暂无审计日志。</div>`;
}

function renderEmergencyState() {
  const button = document.getElementById("security-emergency-btn");
  const text = document.getElementById("security-emergency-state");
  const locked = securityState.security.emergencyLocked;
  button.textContent = locked ? "解除封锁" : "立即封锁";
  button.className = `mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold text-white ${locked ? "bg-emerald-600" : "bg-error"}`;
  text.textContent = `当前状态：${locked ? "紧急封锁中，仅管理员可访问" : "正常"}`;
}

function renderEmployeeOptions() {
  const select = document.getElementById("security-employee-select");
  select.innerHTML = securityState.employees.map((item) => `
    <option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.branch)} / ${escapeHtml(roleLabels[item.role] || item.role)}</option>
  `).join("");
}

function renderAll() {
  renderEmployeeAccess();
  renderModuleMatrix();
  renderIpWhitelist();
  renderAuditLogs();
  renderEmergencyState();
  renderEmployeeOptions();
}

function openAccessModal(employeeId = "") {
  const modal = document.getElementById("security-modal");
  const access = securityState.security.employeeAccess.find((item) => item.employeeId === employeeId);
  const employee = securityState.employees.find((item) => item.id === employeeId) || securityState.employees[0];
  securityState.editingAccessEmployeeId = employee?.id || "";
  document.getElementById("security-modal-title").textContent = access ? "编辑员工授权" : "新增员工授权";
  document.getElementById("security-employee-select").value = employee?.id || "";
  document.getElementById("security-role-select").value = access?.roleOverride || employee?.role || "engineer";
  document.getElementById("security-level-select").value = String(access?.securityLevel || 1);
  document.getElementById("security-branch-scope").value = access?.branchScope || employee?.branch || "";
  document.getElementById("security-access-enabled").checked = access?.accessEnabled !== false;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeAccessModal() {
  document.getElementById("security-modal").classList.add("hidden");
  document.getElementById("security-modal").classList.remove("flex");
}

function openIpModal(id = "") {
  const modal = document.getElementById("ip-modal");
  const item = securityState.security.ipWhitelist.find((entry) => entry.id === id);
  securityState.editingIpId = item?.id || "";
  document.getElementById("ip-modal-title").textContent = item ? "编辑安全白名单" : "新增安全白名单";
  document.getElementById("ip-id").value = item?.id || "";
  document.getElementById("ip-label").value = item?.label || "";
  document.getElementById("ip-cidr").value = item?.cidr || "";
  document.getElementById("ip-status").value = item?.status || "active";
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeIpModal() {
  document.getElementById("ip-modal").classList.add("hidden");
  document.getElementById("ip-modal").classList.remove("flex");
}

async function saveAccess(event) {
  event.preventDefault();
  const payload = {
    employeeId: document.getElementById("security-employee-select").value,
    roleOverride: document.getElementById("security-role-select").value,
    securityLevel: Number(document.getElementById("security-level-select").value || 1),
    branchScope: document.getElementById("security-branch-scope").value.trim(),
    accessEnabled: document.getElementById("security-access-enabled").checked
  };
  await fetchJson("/api/security/employee", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  closeAccessModal();
  await loadSecurity();
}

async function saveIp(event) {
  event.preventDefault();
  const payload = {
    id: document.getElementById("ip-id").value.trim() || `ip-${Date.now()}`,
    label: document.getElementById("ip-label").value.trim(),
    cidr: document.getElementById("ip-cidr").value.trim(),
    status: document.getElementById("ip-status").value
  };
  await fetchJson("/api/security/ip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  closeIpModal();
  await loadSecurity();
}

function exportAuditLogs() {
  const headers = ["时间", "操作", "执行人"];
  const rows = securityState.security.auditLogs.map((item) => [
    new Date(item.createdAt).toLocaleString("zh-CN"),
    item.action,
    item.actor
  ]);
  const csv = ["\uFEFF" + headers.join(","), ...rows.map((row) => row.map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "security-audit-logs.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function toggleEmergency() {
  await fetchJson("/api/security/emergency", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: !securityState.security.emergencyLocked })
  });
  await loadSecurity();
}

function bindDynamicEvents() {
  document.querySelectorAll(".security-module-toggle").forEach((input) => {
    input.addEventListener("change", async (event) => {
      await fetchJson("/api/security/module", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: event.target.dataset.key, enabled: event.target.checked })
      });
      await loadSecurity();
    });
  });
}

function bindStaticEvents() {
  document.getElementById("security-role-filter").addEventListener("change", renderEmployeeAccess);
  document.getElementById("security-employee-search").addEventListener("input", renderEmployeeAccess);
  document.getElementById("security-add-btn").addEventListener("click", () => openAccessModal());
  document.getElementById("security-export-btn").addEventListener("click", exportAuditLogs);
  document.getElementById("security-emergency-btn").addEventListener("click", toggleEmergency);
  document.getElementById("security-add-ip-btn").addEventListener("click", () => openIpModal());
  document.getElementById("security-modal-close").addEventListener("click", closeAccessModal);
  document.getElementById("security-cancel-btn").addEventListener("click", closeAccessModal);
  document.getElementById("ip-modal-close").addEventListener("click", closeIpModal);
  document.getElementById("ip-cancel-btn").addEventListener("click", closeIpModal);
  document.getElementById("security-form").addEventListener("submit", saveAccess);
  document.getElementById("ip-form").addEventListener("submit", saveIp);

  document.getElementById("security-employee-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='edit-access']");
    if (!button) return;
    openAccessModal(button.dataset.id);
  });

  document.getElementById("security-ip-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='edit-ip']");
    if (!button) return;
    openIpModal(button.dataset.id);
  });

  document.getElementById("security-modal").addEventListener("click", (event) => {
    if (event.target.id === "security-modal") closeAccessModal();
  });
  document.getElementById("ip-modal").addEventListener("click", (event) => {
    if (event.target.id === "ip-modal") closeIpModal();
  });
}

async function init() {
  bindStaticEvents();
  await loadEmployees();
  await loadSecurity();
}

init().catch((error) => {
  console.error(error);
});
