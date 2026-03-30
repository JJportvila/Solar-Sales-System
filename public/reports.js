const reportsState = {
  data: null
};

function money(value) {
  return `VT ${Math.max(0, Number(value || 0)).toLocaleString("en-US")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatQuoteStatus(value = "") {
  const map = {
    draft: "草稿待跟进",
    sent: "已发送待付款",
    paid: "已完成收款",
    in_progress: "处理中"
  };
  return map[String(value || "").toLowerCase()] || value || "-";
}

function getHistoryDownloadUrl(item) {
  const id = String(item?.id || "").trim();
  const format = String(item?.format || "").trim().toUpperCase();
  if (id === "report-sales-month" || format === "PDF") return "/api/reports/export.pdf";
  if (id === "report-finance-q1" || format === "EXCEL" || format === "CSV") return "/api/reports/export.csv";
  return "";
}

function renderMonthlySales(items = []) {
  const wrap = document.getElementById("reports-monthly-sales");
  const max = Math.max(1, ...items.map((item) => Number(item.total || 0)));
  wrap.innerHTML = items.map((item, index) => {
    const height = Math.max(36, Math.round(((Number(item.total || 0)) / max) * 150));
    const color = index === items.length - 1 ? "bg-primary" : "bg-slate-200";
    return `
      <button class="flex h-full flex-1 flex-col items-center justify-end gap-2 text-center" type="button" data-report-detail="monthly" data-report-key="${escapeHtml(item.key)}">
        <div class="w-full rounded-t-xl ${color}" style="height:${height}px"></div>
        <div class="text-[11px] font-bold text-slate-400">${escapeHtml(item.label)}</div>
      </button>
    `;
  }).join("");
}

function renderCommission(items = []) {
  const wrap = document.getElementById("reports-commission-list");
  if (!items.length) {
    wrap.innerHTML = `<div class="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500">暂无佣金数据</div>`;
    return;
  }

  wrap.innerHTML = items.map((item) => `
    <button class="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-left" type="button" data-report-detail="commission" data-report-key="${escapeHtml(item.id)}">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-full ${item.type === "sales" ? "bg-amber-100 text-secondary" : "bg-cyan-100 text-cyan-700"} font-black">
          ${escapeHtml(String(item.name || "").slice(0, 2).toUpperCase())}
        </div>
        <div>
          <div class="font-bold text-primary">${escapeHtml(item.name)}</div>
          <div class="text-xs text-slate-500">${escapeHtml(item.role)}</div>
        </div>
      </div>
      <div class="text-sm font-black text-primary">${money(item.amount)}</div>
    </button>
  `).join("");
}

function buildHistoryAction(item) {
  const status = String(item?.status || "").trim();
  const action = String(item?.action || "").trim() || "下载";
  const downloadUrl = getHistoryDownloadUrl(item);
  if (status !== "已完成" || !downloadUrl) {
    return `<span class="text-slate-400">${escapeHtml(action || "暂不可下载")}</span>`;
  }
  return `
    <button
      class="rounded-lg bg-surface-container-low px-3 py-2 text-xs font-bold text-primary hover:bg-slate-200"
      type="button"
      data-report-download="${escapeHtml(item.id)}"
      data-report-url="${escapeHtml(downloadUrl)}"
    >
      ${escapeHtml(action)}
    </button>
  `;
}

function renderHistory(items = []) {
  const tbody = document.getElementById("reports-history-body");
  tbody.innerHTML = items.map((item) => `
    <tr>
      <td class="py-4 pr-4 font-bold text-primary">
        <button class="hover:underline" type="button" data-report-detail="history" data-report-key="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>
      </td>
      <td class="py-4 pr-4 text-sm text-slate-500">${escapeHtml(item.exportedAt)}</td>
      <td class="py-4 pr-4">
        <span class="rounded px-2 py-1 text-[10px] font-black ${item.format === "PDF" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}">${escapeHtml(item.format)}</span>
      </td>
      <td class="py-4 pr-4 text-sm ${item.status === "已完成" ? "text-emerald-600" : "text-secondary"}">${escapeHtml(item.status)}</td>
      <td class="py-4 text-right text-sm font-bold text-primary">${buildHistoryAction(item)}</td>
    </tr>
  `).join("");
}

function exportCsv() {
  window.location.href = "/api/reports/export.csv";
}

function downloadPdf() {
  window.location.href = "/api/reports/export.pdf";
}

function render(data) {
  reportsState.data = data;
  document.getElementById("reports-finance-total").textContent = money(data.summary.financeTotal);
  document.getElementById("reports-pending-count").textContent = String(data.summary.pendingCount);
  document.getElementById("reports-settlement-rate").textContent = `${data.summary.settlementRate}%`;
  document.getElementById("reports-inventory-turnover").textContent = `${data.summary.inventoryTurnover}x`;
  document.getElementById("reports-commission-total").textContent = money(data.summary.commissionTotal);
  renderMonthlySales(data.monthlySales || []);
  renderCommission(data.commissionItems || []);
  renderHistory(data.exportHistory || []);
}

function renderDetailStats(items = []) {
  const wrap = document.getElementById("reports-detail-stats");
  wrap.innerHTML = items.map((item) => `
    <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4">
      <div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">${escapeHtml(item.label)}</div>
      <div class="mt-2 text-2xl font-black text-primary">${escapeHtml(item.value)}</div>
    </div>
  `).join("");
}

function renderDetailTable(headers, rows) {
  const wrap = document.getElementById("reports-detail-table-wrap");
  if (!rows.length) {
    wrap.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-4 py-6 text-center text-sm text-slate-500">暂无详细数据</div>`;
    return;
  }

  wrap.innerHTML = `
    <table class="w-full min-w-[760px] border-separate border-spacing-y-3 text-left">
      <thead>
        <tr class="text-xs uppercase tracking-wider text-slate-400">
          ${headers.map((header) => `<th class="px-4 pb-2">${escapeHtml(header)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr class="bg-surface-container-low">
            ${row.map((cell, index) => `<td class="${index === 0 ? "rounded-l-2xl" : ""} ${index === row.length - 1 ? "rounded-r-2xl" : ""} px-4 py-4 text-sm text-slate-700">${cell}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function showDetailPanel(kicker, title, summary, stats, headers, rows) {
  document.getElementById("reports-detail-kicker").textContent = kicker;
  document.getElementById("reports-detail-title").textContent = title;
  document.getElementById("reports-detail-summary").textContent = summary;
  renderDetailStats(stats);
  renderDetailTable(headers, rows);
  document.getElementById("reports-detail-panel").classList.remove("hidden");
  document.getElementById("reports-detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function openFinanceDetail() {
  const detail = reportsState.data?.details?.finance;
  if (!detail) return;
  showDetailPanel(
    "财务明细",
    "财务对账清单",
    `当前共有 ${detail.items.length} 条财务对账记录，待结算 ${detail.pendingCount} 条。`,
    [
      { label: "总金额", value: money(detail.totalAmount) },
      { label: "待结算", value: String(detail.pendingCount) },
      { label: "结算进度", value: `${detail.settlementRate}%` }
    ],
    ["客户", "电话", "邮箱", "套装", "金额", "状态", "销售"],
    detail.items.map((item) => [
      escapeHtml(item.customerName || "-"),
      escapeHtml(item.customerPhone || "-"),
      escapeHtml(item.customerEmail || "-"),
      escapeHtml(item.packageName || "-"),
      money(item.total),
      escapeHtml(formatQuoteStatus(item.status)),
      escapeHtml(item.salesPersonName || "未分配销售")
    ])
  );
}

function openInventoryDetail() {
  const detail = reportsState.data?.details?.inventory;
  if (!detail) return;
  showDetailPanel(
    "库存明细",
    "库存周转明细",
    "展示当前周转影响较高的库存物料。",
    [
      { label: "周转率", value: `${detail.turnover}x` },
      { label: "物料数", value: String(detail.items.length) },
      { label: "统计维度", value: "月耗用" }
    ],
    ["物料", "分类", "库存数量", "月耗用", "库存值"],
    detail.items.map((item) => [
      escapeHtml(item.name || "-"),
      escapeHtml(item.category || "-"),
      String(item.quantity || 0),
      String(item.monthlyUsage || 0),
      money(item.valueVt || 0)
    ])
  );
}

function openMonthlyDetail(key) {
  const item = (reportsState.data?.monthlySales || []).find((entry) => entry.key === key);
  if (!item) return;
  showDetailPanel(
    "销售明细",
    `${item.label} 销售报告`,
    `${item.label} 共计 ${money(item.total)}，点击柱条查看该月详细报价。`,
    [
      { label: "月份", value: item.label },
      { label: "签约总额", value: money(item.total) },
      { label: "报价数", value: String((item.items || []).length) }
    ],
    ["客户", "电话", "邮箱", "套装", "金额", "状态", "销售"],
    (item.items || []).map((row) => [
      escapeHtml(row.customerName || "-"),
      escapeHtml(row.customerPhone || "-"),
      escapeHtml(row.customerEmail || "-"),
      escapeHtml(row.packageName || "-"),
      money(row.total),
      escapeHtml(formatQuoteStatus(row.status)),
      escapeHtml(row.salesPersonName || "未分配销售")
    ])
  );
}

function openCommissionDetail(id) {
  const item = (reportsState.data?.commissionItems || []).find((entry) => entry.id === id);
  if (!item) return;
  const isSales = item.type === "sales";
  showDetailPanel(
    "佣金明细",
    `${item.name} 佣金详情`,
    isSales ? "按签约报价计算销售佣金。" : "按维修工单完成情况计算工程师佣金。",
    [
      { label: "姓名", value: item.name },
      { label: "角色", value: item.role },
      { label: "佣金", value: money(item.amount) }
    ],
    isSales ? ["客户", "电话", "邮箱", "套装", "金额", "状态"] : ["工单号", "标题", "客户", "状态", "创建时间"],
    (item.relatedItems || []).map((row) => isSales ? [
      escapeHtml(row.customerName || "-"),
      escapeHtml(row.customerPhone || "-"),
      escapeHtml(row.customerEmail || "-"),
      escapeHtml(row.packageName || "-"),
      money(row.total || 0),
      escapeHtml(formatQuoteStatus(row.status))
    ] : [
      escapeHtml(row.id || "-"),
      escapeHtml(row.title || "-"),
      escapeHtml(row.customerName || "-"),
      escapeHtml(row.statusLabel || row.status || "-"),
      escapeHtml(new Date(row.createdAt).toLocaleDateString("zh-CN"))
    ])
  );
}

function openHistoryDetail(id) {
  const item = (reportsState.data?.details?.exportHistory || []).find((entry) => entry.id === id);
  if (!item) return;
  const downloadUrl = getHistoryDownloadUrl(item);
  const actionCell = item.status === "已完成" && downloadUrl
    ? `<a class="font-bold text-primary underline" href="${escapeHtml(downloadUrl)}">点击下载</a>`
    : escapeHtml(item.action);

  showDetailPanel(
    "导出详情",
    item.name,
    `导出时间 ${item.exportedAt}，当前状态为 ${item.status}。`,
    [
      { label: "格式", value: item.format },
      { label: "状态", value: item.status },
      { label: "操作", value: item.action }
    ],
    ["报告名称", "导出时间", "格式", "状态", "操作"],
    [[
      escapeHtml(item.name),
      escapeHtml(item.exportedAt),
      escapeHtml(item.format),
      escapeHtml(item.status),
      actionCell
    ]]
  );
}

async function loadReports() {
  const response = await fetch("/api/reports");
  const data = await response.json();
  render(data);
}

function bindEvents() {
  document.getElementById("reports-refresh-btn").addEventListener("click", loadReports);
  document.getElementById("reports-export-pdf").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    downloadPdf();
  });
  document.getElementById("reports-export-excel").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    exportCsv();
  });
  document.getElementById("reports-export-commission").addEventListener("click", () => {
    showDetailPanel(
      "佣金汇总",
      "全部佣金明细",
      "展示当前已计算的全部佣金项目。",
      [
        { label: "人数", value: String((reportsState.data?.commissionItems || []).length) },
        { label: "佣金总额", value: money(reportsState.data?.summary?.commissionTotal || 0) },
        { label: "类型", value: "销售 / 工程师" }
      ],
      ["姓名", "角色", "类型", "佣金"],
      (reportsState.data?.commissionItems || []).map((item) => [
        escapeHtml(item.name),
        escapeHtml(item.role),
        escapeHtml(item.type),
        money(item.amount)
      ])
    );
  });
  document.getElementById("reports-finance-card").addEventListener("click", openFinanceDetail);
  document.getElementById("reports-inventory-card").addEventListener("click", openInventoryDetail);
  document.getElementById("reports-detail-close").addEventListener("click", () => {
    document.getElementById("reports-detail-panel").classList.add("hidden");
  });

  document.addEventListener("click", (event) => {
    const downloadButton = event.target.closest("[data-report-download]");
    if (downloadButton) {
      event.preventDefault();
      event.stopPropagation();
      const url = downloadButton.getAttribute("data-report-url");
      if (url) {
        window.location.href = url;
      }
      return;
    }

    const target = event.target.closest("[data-report-detail]");
    if (!target) return;
    const type = target.getAttribute("data-report-detail");
    const key = target.getAttribute("data-report-key");
    if (type === "monthly") openMonthlyDetail(key);
    if (type === "commission") openCommissionDetail(key);
    if (type === "history") openHistoryDetail(key);
  });
}

bindEvents();
loadReports().catch((error) => {
  console.error(error);
});
