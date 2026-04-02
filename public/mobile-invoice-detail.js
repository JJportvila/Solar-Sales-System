const invoiceStatusText = {
  draft: "草稿",
  issued: "已开票",
  paid: "已付款",
  cancelled: "已取消"
};

function $(id) { return document.getElementById(id); }

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

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
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

function renderMetrics(id, items) {
  $(id).innerHTML = items.map(([label, value]) => `
    <div class="metric">
      <label>${escapeHtml(label)}</label>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function findInvoice(items, id) {
  const requested = String(id || "").trim();
  return (Array.isArray(items) ? items : []).find((item) =>
    String(item.id || "") === requested || String(item.invoiceNo || "") === requested
  ) || null;
}

async function init() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    $("invoice-subtitle").textContent = "缺少发票 ID";
    return;
  }

  const result = await fetchJson("/api/invoices");
  const invoice = findInvoice(result.items, id);
  if (!invoice) {
    $("invoice-subtitle").textContent = "未找到对应发票";
    return;
  }

  $("invoice-title").textContent = invoice.invoiceNo || "发票详情";
  $("invoice-subtitle").textContent = `${invoice.customerName || "-"} / ${invoice.packageName || "-"}`;
  $("invoice-call").href = invoice.customerPhone ? `tel:${invoice.customerPhone}` : "#";

  renderMetrics("invoice-summary", [
    ["发票状态", statusText(invoice.status)],
    ["发票金额", money(invoice.amount || 0)],
    ["开票时间", formatDate(invoice.issuedAt || invoice.createdAt)],
    ["销售", invoice.salesPersonName || "-"]
  ]);

  renderMetrics("invoice-customer", [
    ["客户姓名", invoice.customerName || invoice.customer?.name || "-"],
    ["联系电话", invoice.customerPhone || invoice.customer?.phone || "-"],
    ["邮箱", invoice.customerEmail || invoice.customer?.email || "-"],
    ["地址", invoice.customerAddress || invoice.customer?.address || "-"]
  ]);

  const quote = invoice.payload?.quote || {};
  const installment = invoice.payload?.installmentPlan || {};
  renderMetrics("invoice-quote", [
    ["套餐", invoice.packageName || invoice.payload?.packageName || "-"],
    ["设备费", money(quote.equipmentPrice || invoice.amount || 0)],
    ["安装费", money(quote.installFee || 0)],
    ["物流费", money(quote.logisticsFee || 0)],
    ["税费", money(quote.vat || 0)],
    ["分期方案", installment.cycleLabel || "未设置"]
  ]);

  const devices = Array.isArray(invoice.payload?.devices) ? invoice.payload.devices : [];
  $("invoice-devices").innerHTML = devices.length ? devices.map((item) => `
    <div class="item">
      <div class="item-title">${escapeHtml(item.name || "-")}</div>
      <div class="item-meta">${escapeHtml(`${item.quantity || 0} 台 / ${item.power || 0}W / ${item.hours || 0}h`)}</div>
      <div class="item-meta" style="margin-top:6px;">日耗电：${escapeHtml(`${item.dailyWh || 0} Wh`)}</div>
    </div>
  `).join("") : `<div class="empty">暂无设备清单</div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif;">手机发票详情加载失败: ${escapeHtml(error.message || "unknown")}</div>`;
  });
});
