const invoiceMobileState = {
  items: [],
  filtered: []
};

const invoiceStatusText = {
  draft: "草稿",
  issued: "已开票",
  paid: "已付款",
  cancelled: "已取消"
};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value) {
  return `VT ${Math.max(0, Number(value || 0)).toLocaleString("en-US")}`;
}

function statusText(status) {
  return invoiceStatusText[status] || status || "-";
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function renderSummary(items) {
  if (!$("invoice-summary")) return;
  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const issuedCount = items.filter((item) => item.status === "issued").length;
  const paidCount = items.filter((item) => item.status === "paid").length;
  $("invoice-summary").innerHTML = [
    ["发票数量", items.length],
    ["总金额", money(totalAmount)],
    ["已开票", issuedCount],
    ["已付款", paidCount]
  ].map(([label, value]) => `
    <div class="metric">
      <label>${label}</label>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function renderList(items) {
  $("invoice-list").innerHTML = items.length ? items.map((item) => `
    <div class="item">
      <div style="display:flex;justify-content:space-between;gap:10px;">
        <div>
          <div class="item-title">${escapeHtml(item.invoiceNo || "-")}</div>
          <div class="item-meta">${escapeHtml(item.customerName || "-")} / ${escapeHtml(item.customerPhone || "-")}</div>
        </div>
        <span class="tag ${escapeHtml(item.status || "draft")}">${escapeHtml(statusText(item.status))}</span>
      </div>
      <div class="item-meta" style="margin-top:8px;">${escapeHtml(item.packageName || "-")} / ${escapeHtml((item.issuedAt || "").slice(0, 10) || "-")}</div>
      <div style="display:flex;justify-content:space-between;gap:10px;margin-top:10px;align-items:flex-end;">
        <div>
          <div class="item-title">${money(item.amount || 0)}</div>
          <div class="item-meta">${escapeHtml(item.salesPersonName || "-")}</div>
        </div>
        <div style="display:grid;gap:8px;">
          <a class="btn primary" href="tel:${escapeHtml(item.customerPhone || "")}" style="min-height:38px;">拨打客户</a>
          <a class="btn secondary" href="/mobile-invoice-detail.html?id=${encodeURIComponent(item.id || item.invoiceNo || "")}" style="min-height:38px;background:#eef4fb;color:#0f3b66;border:1px solid rgba(15,59,102,.12);">发票详情</a>
        </div>
      </div>
    </div>
  `).join("") : `<div class="empty">没有匹配的发票</div>`;
}

function applyFilters() {
  const keyword = $("invoice-search").value.trim().toLowerCase();
  const status = $("invoice-status").value;
  invoiceMobileState.filtered = invoiceMobileState.items.filter((item) => {
    const matchStatus = status === "all" || item.status === status;
    const haystack = [item.invoiceNo, item.customerName, item.customerPhone, item.packageName, item.salesPersonName].join(" ").toLowerCase();
    const matchKeyword = !keyword || haystack.includes(keyword);
    return matchStatus && matchKeyword;
  });
  renderSummary(invoiceMobileState.filtered);
  renderList(invoiceMobileState.filtered);
}

async function init() {
  const result = await fetchJson("/api/invoices");
  invoiceMobileState.items = Array.isArray(result.items) ? result.items : [];
  $("invoice-search").addEventListener("input", applyFilters);
  $("invoice-status").addEventListener("change", applyFilters);
  applyFilters();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif;">手机发票页加载失败: ${escapeHtml(error.message || "unknown")}</div>`;
  });
});
