const quoteDetailState = {
  id: "",
  item: null
};

const quoteDetailFormatter = new Intl.NumberFormat("en-US");

function $(id) {
  return document.getElementById(id);
}

function money(value) {
  return `VT ${quoteDetailFormatter.format(Number(value || 0))}`;
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
  const node = document.getElementById("quote-detail-subtitle");
  if (!node) return;
  node.textContent = text || "";
  node.style.color = isError ? "#fecaca" : "rgba(255,255,255,.82)";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function quoteStatusLabel(status) {
  const map = {
    draft: "草稿",
    in_progress: "进行中",
    sent: "已发送",
    paid: "已付款"
  };
  return map[status] || status || "-";
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function getPayload(item) {
  return item?.payload && typeof item.payload === "object" ? item.payload : {};
}

function getCustomer(item) {
  const payload = getPayload(item);
  return item.customer || payload.customer || {
    name: item.customerName || payload.customerName || "",
    phone: item.customerPhone || "",
    email: "",
    address: ""
  };
}

function getRecommendation(item) {
  const payload = getPayload(item);
  return payload.recommendation || {};
}

function getQuote(item) {
  const payload = getPayload(item);
  return item.quote || payload.quote || {};
}

function getDevices(item) {
  const payload = getPayload(item);
  return Array.isArray(payload.devices) ? payload.devices : [];
}

function render() {
  const item = quoteDetailState.item;
  const payload = getPayload(item);
  const customer = getCustomer(item);
  const recommendation = getRecommendation(item);
  const quote = getQuote(item);
  const devices = getDevices(item);

  $("quote-detail-title").textContent = customer.name || item.customerName || "报价详情";
  $("quote-detail-subtitle").textContent = `${item.packageName || recommendation.packageName || "-"} / ${formatDate(item.createdAt)}`;

  $("detail-customer-name").textContent = customer.name || item.customerName || "-";
  $("detail-customer-phone").textContent = customer.phone || item.customerPhone || "-";
  $("detail-customer-email").textContent = customer.email || "-";
  $("detail-location").textContent = item.location || payload.location || "-";
  $("detail-customer-address").textContent = customer.address || "-";

  $("detail-package-name").textContent = item.packageName || recommendation.packageName || "-";
  $("detail-status-label").textContent = quoteStatusLabel(item.status);
  $("detail-total-price").textContent = money(item.total || quote.displayTotal || quote.total || 0);
  $("detail-daily-wh").textContent = `${item.dailyWh || payload.metrics?.dailyWh || 0} Wh`;
  $("detail-sales-person").textContent = item.salesPersonName || payload.salesPersonName || "-";
  $("detail-created-at").textContent = formatDate(item.createdAt);

  $("detail-equipment-price").textContent = money(quote.equipmentPrice || 0);
  $("detail-install-fee").textContent = money(quote.installFee || 0);
  $("detail-logistics-fee").textContent = money(quote.logisticsFee || 0);
  $("detail-vat-price").textContent = money(quote.vat || 0);

  $("detail-package-card").innerHTML = [
    `<div class="row-title">${escapeHtml(recommendation.packageName || item.packageName || "-")}</div>`,
    `<div class="row-meta">太阳能板: ${escapeHtml(recommendation.solarPanels || "-")}</div>`,
    `<div class="row-meta">电池: ${escapeHtml(recommendation.battery || "-")}</div>`,
    `<div class="row-meta">逆变器: ${escapeHtml(recommendation.inverter || "-")}</div>`,
    `<div class="row-meta">负载能力: ${escapeHtml(recommendation.loadCapacityW || 0)} W</div>`
  ].join("");

  $("detail-devices-list").innerHTML = devices.length
    ? devices.map((device) => `
        <div class="card">
          <div class="row-title">${escapeHtml(device.name || "-")}</div>
          <div class="row-meta">功率: ${escapeHtml(device.power || 0)} W</div>
          <div class="row-meta">时长: ${escapeHtml(device.hours || 0)} 小时</div>
          <div class="row-meta">数量: ${escapeHtml(device.quantity || 0)}</div>
          <div class="row-meta">日耗电: ${escapeHtml(device.dailyWh || 0)} Wh</div>
        </div>
      `).join("")
    : `<div class="empty">这条报价没有保存设备清单。</div>`;
}

async function loadQuote() {
  if (!quoteDetailState.id) {
    setStatus("缺少报价参数。", true);
    return;
  }
  setStatus("正在加载报价详情...");
  const result = await fetchJson("/api/saved-quotes");
  const items = Array.isArray(result.items) ? result.items : [];
  const item = items.find((entry) => entry.id === quoteDetailState.id);
  if (!item) {
    throw new Error("未找到这条报价记录");
  }
  quoteDetailState.item = item;
  render();
}

function init() {
  const params = new URLSearchParams(window.location.search);
  quoteDetailState.id = params.get("id") || "";
  loadQuote().catch((error) => {
    setStatus(error.message || "加载报价详情失败", true);
    $("detail-devices-list").innerHTML = `<div class="empty">无法打开这条报价详情。</div>`;
  });
}

init();
