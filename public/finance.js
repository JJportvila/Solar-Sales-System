const financeState = {
  data: null,
  filteredLedger: []
};

function formatMoney(value) {
  return `VUV ${Math.max(0, Number(value || 0)).toLocaleString("en-US")}`;
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
    draft: "处理中",
    sent: "待支付",
    paid: "已结清"
  };
  return map[String(value || "").toLowerCase()] || value || "-";
}

function renderDistribution(items = []) {
  const wrap = document.getElementById("finance-distribution");
  wrap.innerHTML = items.map((item) => `
    <button class="block w-full text-left" type="button" data-finance-detail="distribution" data-finance-key="${escapeHtml(item.key)}">
      <div class="mb-2 flex items-center justify-between text-sm font-bold">
        <span>${escapeHtml(item.label)}</span>
        <span>${formatMoney(item.amount)} (${item.percent}%)</span>
      </div>
      <div class="h-4 w-full overflow-hidden rounded-full bg-surface-container-low">
        <div class="h-full ${item.color}" style="width:${Math.max(2, item.percent)}%"></div>
      </div>
    </button>
  `).join("");
}

function renderLedger(items = []) {
  const tbody = document.getElementById("finance-ledger-body");
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-8 py-8 text-center text-sm text-slate-500">暂无匹配的财务记录</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((item) => `
    <tr>
      <td class="px-8 py-5 font-mono text-xs font-bold text-primary">
        <button class="hover:underline" type="button" data-finance-detail="ledger" data-finance-key="${escapeHtml(item.id)}">${escapeHtml(item.id)}</button>
      </td>
      <td class="px-4 py-5">
        <span class="rounded px-2 py-1 text-[10px] font-bold ${item.category.includes("销售") ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}">${escapeHtml(item.category)}</span>
      </td>
      <td class="px-4 py-5 font-bold text-slate-800">${escapeHtml(item.customer)}</td>
      <td class="px-4 py-5 text-right font-black text-primary">${Number(item.amount || 0).toLocaleString("en-US")}</td>
      <td class="px-4 py-5 text-sm ${item.state === "已结清" ? "text-emerald-600" : item.state === "待支付" ? "text-amber-600" : "text-slate-500"}">${escapeHtml(item.state)}</td>
      <td class="px-8 py-5 text-right text-sm font-bold text-primary">${escapeHtml(item.action)}</td>
    </tr>
  `).join("");
}

function applyLedgerFilter() {
  const keyword = (document.getElementById("finance-search").value || "").trim().toLowerCase();
  const source = financeState.data?.ledger || [];
  financeState.filteredLedger = source.filter((item) => {
    if (!keyword) return true;
    return [item.id, item.category, item.customer, item.state].join(" ").toLowerCase().includes(keyword);
  });
  renderLedger(financeState.filteredLedger);
}

function buildPrintableHtml(data) {
  return `
    <div style="font-family:Inter,sans-serif;color:#0f172a;padding:24px;">
      <h1 style="font-family:Manrope,sans-serif;font-size:28px;margin:0 0 8px;">财务收支报表</h1>
      <p style="margin:0 0 24px;color:#475569;">${escapeHtml(data.periodLabel)}</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;border:1px solid #cbd5e1;">
        <thead><tr><th colspan="6" style="text-align:left;padding:12px;background:#001d44;color:#fff;">汇总指标</th></tr></thead>
        <tbody>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">月度总收入</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${formatMoney(data.summary.monthlyRevenue)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">应收余额</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${formatMoney(data.summary.arBalance)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">净利润率</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${data.summary.netProfitMargin}%</td>
          </tr>
        </tbody>
      </table>
      <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;">
        <thead>
          <tr><th colspan="6" style="text-align:left;padding:12px;background:#001d44;color:#fff;">近期财务明细</th></tr>
          <tr>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">流水号</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">客户</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">套装</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">金额</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">状态</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">销售</th>
          </tr>
        </thead>
        <tbody>
          ${data.ledger.map((item) => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.id)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.customer)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.packageName || "-")}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${Number(item.amount || 0).toLocaleString("en-US")}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.state)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.salesPersonName || "未分配销售")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function exportLedgerCsv() {
  const rows = financeState.filteredLedger.length ? financeState.filteredLedger : (financeState.data?.ledger || []);
  const headers = ["流水号", "类别", "客户", "金额(VUV)", "状态", "操作"];
  const csv = [headers, ...rows.map((item) => [item.id, item.category, item.customer, item.amount, item.state, item.action])]
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "financial-ledger.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function printFinanceReport() {
  if (!financeState.data) return;
  const printable = document.getElementById("finance-printable");
  printable.innerHTML = buildPrintableHtml(financeState.data);
  printable.classList.remove("hidden");
  window.print();
  printable.classList.add("hidden");
}

function render(data) {
  financeState.data = data;
  document.getElementById("finance-period-label").textContent = data.periodLabel || "本月";
  document.getElementById("finance-revenue").textContent = formatMoney(data.summary.monthlyRevenue);
  document.getElementById("finance-ar").textContent = formatMoney(data.summary.arBalance);
  document.getElementById("finance-margin").textContent = `${data.summary.netProfitMargin}%`;
  document.getElementById("finance-short-efficiency").textContent = `${data.collection.shortCycleEfficiency}%`;
  document.getElementById("finance-long-efficiency").textContent = `${data.collection.longCycleEfficiency}%`;
  renderDistribution(data.distribution || []);
  applyLedgerFilter();
}

function renderDetailStats(items = []) {
  const wrap = document.getElementById("finance-detail-stats");
  wrap.innerHTML = items.map((item) => `
    <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4">
      <div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">${escapeHtml(item.label)}</div>
      <div class="mt-2 text-2xl font-black text-primary">${escapeHtml(item.value)}</div>
    </div>
  `).join("");
}

function renderDetailTable(headers, rows) {
  const wrap = document.getElementById("finance-detail-table-wrap");
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
  document.getElementById("finance-detail-kicker").textContent = kicker;
  document.getElementById("finance-detail-title").textContent = title;
  document.getElementById("finance-detail-summary").textContent = summary;
  renderDetailStats(stats);
  renderDetailTable(headers, rows);
  document.getElementById("finance-detail-panel").classList.remove("hidden");
  document.getElementById("finance-detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function openRevenueDetail() {
  const detail = financeState.data?.details?.revenue;
  if (!detail) return;
  showDetailPanel(
    "收入明细",
    "月度总收入明细",
    `当前共 ${detail.items.length} 条收入记录。`,
    [
      { label: "总收入", value: formatMoney(detail.total) },
      { label: "记录数", value: String(detail.items.length) },
      { label: "币种", value: "VUV" }
    ],
    ["客户", "电话", "邮箱", "套装", "金额", "状态", "销售"],
    detail.items.map((item) => [
      escapeHtml(item.customerName || "-"),
      escapeHtml(item.customerPhone || "-"),
      escapeHtml(item.customerEmail || "-"),
      escapeHtml(item.packageName || "-"),
      formatMoney(item.total),
      escapeHtml(formatQuoteStatus(item.status)),
      escapeHtml(item.salesPersonName || "未分配销售")
    ])
  );
}

function openArDetail() {
  const detail = financeState.data?.details?.ar;
  if (!detail) return;
  showDetailPanel(
    "应收明细",
    "AR 应收账款明细",
    `当前共有 ${detail.items.length} 条待回款记录。`,
    [
      { label: "应收余额", value: formatMoney(detail.total) },
      { label: "待回款数", value: String(detail.items.length) },
      { label: "重点", value: "待支付跟进" }
    ],
    ["客户", "电话", "邮箱", "套装", "金额", "状态", "销售"],
    detail.items.map((item) => [
      escapeHtml(item.customerName || "-"),
      escapeHtml(item.customerPhone || "-"),
      escapeHtml(item.customerEmail || "-"),
      escapeHtml(item.packageName || "-"),
      formatMoney(item.total),
      escapeHtml(formatQuoteStatus(item.status)),
      escapeHtml(item.salesPersonName || "未分配销售")
    ])
  );
}

function openMarginDetail() {
  const detail = financeState.data?.details?.margin;
  if (!detail) return;
  showDetailPanel(
    "利润构成",
    "净利润率构成详情",
    "净利润率由收入、估算成本和净利润共同计算得出。",
    [
      { label: "总收入", value: formatMoney(detail.monthlyRevenue) },
      { label: "估算成本", value: formatMoney(detail.estimatedCost) },
      { label: "净利润", value: formatMoney(detail.profit) }
    ],
    ["指标", "数值"],
    [
      ["净利润率", `${detail.netProfitMargin}%`],
      ["总收入", formatMoney(detail.monthlyRevenue)],
      ["估算成本", formatMoney(detail.estimatedCost)],
      ["净利润", formatMoney(detail.profit)]
    ]
  );
}

function openDistributionDetail(key) {
  const item = (financeState.data?.details?.distribution || []).find((entry) => entry.key === key);
  if (!item) return;
  showDetailPanel(
    "销售分布",
    `${item.label} 销售分布详情`,
    "查看该套装类型在总销售中的占比情况。",
    [
      { label: "分类", value: item.label },
      { label: "金额", value: formatMoney(item.amount) },
      { label: "占比", value: `${item.percent}%` }
    ],
    ["分类", "金额", "占比"],
    [[escapeHtml(item.label), formatMoney(item.amount), `${item.percent}%`]]
  );
}

function openCollectionDetail() {
  const detail = financeState.data?.details?.collection;
  if (!detail) return;
  showDetailPanel(
    "回款明细",
    "回款周期效率详情",
    "展示短周期和长周期回款对应的业务记录。",
    [
      { label: "26周效率", value: `${detail.shortCycleEfficiency}%` },
      { label: "52周效率", value: `${detail.longCycleEfficiency}%` },
      { label: "记录数", value: String(detail.items.length) }
    ],
    ["客户", "套装", "金额", "状态", "周期分类", "创建时间"],
    detail.items.map((item) => [
      escapeHtml(item.customerName || "-"),
      escapeHtml(item.packageName || "-"),
      formatMoney(item.total),
      escapeHtml(formatQuoteStatus(item.status)),
      escapeHtml(item.cycleType || "-"),
      escapeHtml(new Date(item.createdAt).toLocaleDateString("zh-CN"))
    ])
  );
}

function openLedgerDetail(id) {
  const item = (financeState.data?.details?.ledger || []).find((entry) => entry.id === id);
  if (!item) return;
  showDetailPanel(
    "流水详情",
    item.id,
    "查看该笔财务流水的客户与销售信息。",
    [
      { label: "金额", value: formatMoney(item.amount) },
      { label: "状态", value: item.state },
      { label: "类别", value: item.category }
    ],
    ["客户", "电话", "邮箱", "地址", "套装", "销售"],
    [[
      escapeHtml(item.customer || "-"),
      escapeHtml(item.customerPhone || "-"),
      escapeHtml(item.customerEmail || "-"),
      escapeHtml(item.customerAddress || "-"),
      escapeHtml(item.packageName || "-"),
      escapeHtml(item.salesPersonName || "未分配销售")
    ]]
  );
}

async function loadFinance() {
  const response = await fetch("/api/financial-report");
  const data = await response.json();
  render(data);
}

function bindEvents() {
  document.getElementById("finance-search").addEventListener("input", applyLedgerFilter);
  document.getElementById("finance-export-btn").addEventListener("click", exportLedgerCsv);
  document.getElementById("finance-period-btn").addEventListener("click", loadFinance);
  document.getElementById("finance-revenue-card").addEventListener("click", openRevenueDetail);
  document.getElementById("finance-ar-card").addEventListener("click", openArDetail);
  document.getElementById("finance-margin-card").addEventListener("click", openMarginDetail);
  document.getElementById("finance-collection-card").addEventListener("click", openCollectionDetail);
  document.getElementById("finance-detail-close").addEventListener("click", () => {
    document.getElementById("finance-detail-panel").classList.add("hidden");
  });
  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-finance-detail]");
    if (!target) return;
    const type = target.getAttribute("data-finance-detail");
    const key = target.getAttribute("data-finance-key");
    if (type === "distribution") openDistributionDetail(key);
    if (type === "ledger") openLedgerDetail(key);
  });
}

bindEvents();
loadFinance().catch((error) => {
  console.error(error);
});
