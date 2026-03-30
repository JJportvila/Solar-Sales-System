function getEmployeeId() {
  return new URLSearchParams(window.location.search).get("id") || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMoney(value) {
  return `VT ${Number(value || 0).toLocaleString()}`;
}

function renderSkills(skills = []) {
  const wrap = document.getElementById("employee-detail-skills");
  wrap.innerHTML = skills.length
    ? skills.map((skill) => `<span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">${escapeHtml(skill)}</span>`).join("")
    : `<span class="text-sm text-slate-400">暂无技能标签</span>`;
}

function renderMetrics(metrics = {}) {
  const wrap = document.getElementById("employee-detail-metrics");
  const rows = [
    [metrics.primaryLabel || "主指标", metrics.primaryValue || "-"],
    [metrics.secondaryLabel || "第二指标", metrics.secondaryValue || "-"],
    [metrics.ratingLabel || "评分", metrics.ratingValue || "-"]
  ];

  wrap.innerHTML = rows.map(([label, value]) => `
    <div class="rounded-2xl bg-surface-container-low px-5 py-4">
      <div class="text-xs uppercase tracking-[0.22em] text-slate-400">${escapeHtml(label)}</div>
      <div class="mt-2 text-2xl font-black text-primary">${escapeHtml(value)}</div>
    </div>
  `).join("");
}

function renderRepairs(items = [], summary = {}) {
  const wrap = document.getElementById("employee-detail-repairs");
  if (!items.length) {
    wrap.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-5 py-4 text-sm text-slate-500">当前没有直接关联的维修单。</div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="grid grid-cols-4 gap-3">
      <div class="rounded-2xl bg-surface-container-low px-4 py-3"><div class="text-[11px] text-slate-400">总数</div><div class="mt-1 text-xl font-black text-primary">${summary.total || 0}</div></div>
      <div class="rounded-2xl bg-surface-container-low px-4 py-3"><div class="text-[11px] text-slate-400">待处理</div><div class="mt-1 text-xl font-black text-primary">${summary.pending || 0}</div></div>
      <div class="rounded-2xl bg-surface-container-low px-4 py-3"><div class="text-[11px] text-slate-400">维修中</div><div class="mt-1 text-xl font-black text-primary">${summary.inProgress || 0}</div></div>
      <div class="rounded-2xl bg-surface-container-low px-4 py-3"><div class="text-[11px] text-slate-400">已完成</div><div class="mt-1 text-xl font-black text-primary">${summary.completed || 0}</div></div>
    </div>
    <div class="space-y-3 mt-4">
      ${items.map((item) => `
        <a href="/repair.html?id=${encodeURIComponent(item.id)}" class="block rounded-2xl bg-surface-container-low px-5 py-4 hover:bg-slate-100">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">${escapeHtml(item.id)}</span>
            <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">${escapeHtml(item.priorityLabel || "-")}</span>
            <span class="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700">${escapeHtml(item.statusLabel || "-")}</span>
          </div>
          <div class="mt-3 text-lg font-black text-primary">${escapeHtml(item.title || "-")}</div>
          <div class="mt-1 text-sm text-slate-500">预计时间：${escapeHtml(item.etaLabel || "-")}</div>
        </a>
      `).join("")}
    </div>
  `;
}

function renderQuotes(items = [], summary = {}) {
  const wrap = document.getElementById("employee-detail-quotes");
  if (!items.length) {
    wrap.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-5 py-4 text-sm text-slate-500">当前没有直接关联的报价单。</div>`;
    return;
  }

  wrap.innerHTML = `
    <div class="grid grid-cols-4 gap-3">
      <div class="rounded-2xl bg-surface-container-low px-4 py-3"><div class="text-[11px] text-slate-400">总数</div><div class="mt-1 text-xl font-black text-primary">${summary.total || 0}</div></div>
      <div class="rounded-2xl bg-surface-container-low px-4 py-3"><div class="text-[11px] text-slate-400">草稿</div><div class="mt-1 text-xl font-black text-primary">${summary.draft || 0}</div></div>
      <div class="rounded-2xl bg-surface-container-low px-4 py-3"><div class="text-[11px] text-slate-400">已发送</div><div class="mt-1 text-xl font-black text-primary">${summary.sent || 0}</div></div>
      <div class="rounded-2xl bg-surface-container-low px-4 py-3"><div class="text-[11px] text-slate-400">总金额</div><div class="mt-1 text-xl font-black text-primary">${formatMoney(summary.totalAmount || 0)}</div></div>
    </div>
    <div class="space-y-3 mt-4">
      ${items.map((item) => `
        <div class="rounded-2xl bg-surface-container-low px-5 py-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">${escapeHtml(item.id)}</span>
            <span class="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">${escapeHtml(item.status || "draft")}</span>
          </div>
          <div class="mt-3 text-lg font-black text-primary">${escapeHtml(item.customerName || "-")}</div>
          <div class="mt-1 text-sm text-slate-500">${escapeHtml(item.packageName || "-")} / ${formatMoney(item.total || 0)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDetail(payload) {
  const employee = payload.employee || {};
  const related = payload.related || {};

  document.getElementById("employee-detail-name").textContent = employee.name || "员工详情";
  document.getElementById("employee-detail-subtitle").textContent = `${employee.roleLabel || "-"} / ${employee.branch || "-"} / ${employee.email || "-"}`;
  document.getElementById("employee-detail-no").textContent = employee.employeeNo || "-";
  document.getElementById("employee-detail-role").textContent = employee.roleLabel || "-";
  document.getElementById("employee-detail-status").textContent = employee.statusLabel || "-";
  document.getElementById("employee-detail-hire-date").textContent = employee.hireDate || "-";
  document.getElementById("employee-detail-branch").textContent = employee.branch || "-";
  document.getElementById("employee-detail-contact").textContent = `${employee.phone || "-"} / ${employee.email || "-"}`;

  renderSkills(employee.skills || []);
  renderMetrics(employee.metrics || {});
  renderRepairs(related.repairOrders || [], related.repairSummary || {});
  renderQuotes(related.quoteItems || [], related.quoteSummary || {});

  const repairTotal = related.repairSummary?.total || 0;
  const quoteTotal = related.quoteSummary?.total || 0;
  document.getElementById("employee-detail-relation-title").textContent = `${repairTotal} 张维修单 / ${quoteTotal} 张报价单`;
  document.getElementById("employee-detail-relation-text").textContent = employee.role === "engineer"
    ? "这位工程师的关联工单会优先显示在左侧，便于查看处理状态。"
    : "销售、经理和管理员可在这里查看与自己相关的报价摘要。";
}

async function loadDetail() {
  const id = getEmployeeId();
  if (!id) {
    throw new Error("Missing employee id");
  }
  const response = await fetch(`/api/employees/detail?id=${encodeURIComponent(id)}`);
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Load failed");
  }
  renderDetail(result);
}

loadDetail().catch((error) => {
  console.error(error);
  document.getElementById("employee-detail-name").textContent = "员工详情加载失败";
  document.getElementById("employee-detail-subtitle").textContent = "请返回员工管理列表重新进入。";
});
