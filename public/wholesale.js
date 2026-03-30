const wholesaleState = {
  merchants: [],
  salesPeople: [],
  packages: [],
  orders: [],
  summary: {
    merchantCount: 0,
    orderCount: 0,
    pendingAmount: 0,
    wholesaleRevenue: 0
  },
  currentMerchantId: "",
  search: ""
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
  return `VT ${Math.max(0, Number(value || 0)).toLocaleString("en-US")}`;
}

function setHealth(ok) {
  const dot = document.getElementById("health-dot");
  const text = document.getElementById("health-text");
  if (!dot || !text) return;
  dot.className = `inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`;
  text.textContent = ok ? "系统在线" : "服务异常";
}

function getFilteredMerchants() {
  const search = wholesaleState.search.trim().toLowerCase();
  if (!search) return wholesaleState.merchants;
  return wholesaleState.merchants.filter((item) => [
    item.name,
    item.contactName,
    item.phone,
    item.location,
    item.address
  ].join(" ").toLowerCase().includes(search));
}

function getSelectedMerchant() {
  return wholesaleState.merchants.find((item) => item.id === wholesaleState.currentMerchantId) || getFilteredMerchants()[0] || null;
}

function renderSummary() {
  document.getElementById("wholesale-summary-merchant-count").textContent = String(wholesaleState.summary.merchantCount || 0);
  document.getElementById("wholesale-summary-order-count").textContent = String(wholesaleState.summary.orderCount || 0);
  document.getElementById("wholesale-summary-pending-amount").textContent = formatMoney(wholesaleState.summary.pendingAmount || 0);
  document.getElementById("wholesale-summary-revenue-amount").textContent = formatMoney(wholesaleState.summary.wholesaleRevenue || 0);
}

function renderMerchantOptions() {
  const merchantSelect = document.getElementById("wholesale-merchant-select");
  const options = wholesaleState.merchants.map((item) => `
    <option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.location || "-")}</option>
  `).join("");
  merchantSelect.innerHTML = options;
  if (!wholesaleState.currentMerchantId && wholesaleState.merchants[0]) {
    wholesaleState.currentMerchantId = wholesaleState.merchants[0].id;
  }
  merchantSelect.value = wholesaleState.currentMerchantId;
}

function renderSalesOptions() {
  const options = wholesaleState.salesPeople.map((item) => `
    <option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel || "")}</option>
  `).join("");
  document.getElementById("wholesale-sales-select").innerHTML = options;
  document.getElementById("merchant-sales-select").innerHTML = `<option value="">未分配</option>${options}`;
}

function renderPackageOptions() {
  const select = document.getElementById("wholesale-package-select");
  select.innerHTML = wholesaleState.packages.map((item) => `
    <option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / 批发 ${formatMoney(item.wholesaleVt)} / 库存 ${item.stock}</option>
  `).join("");
}

function renderMerchantList() {
  const list = document.getElementById("wholesale-merchant-list");
  const merchants = getFilteredMerchants();
  if (merchants.length && !merchants.some((item) => item.id === wholesaleState.currentMerchantId)) {
    wholesaleState.currentMerchantId = merchants[0].id;
  }
  list.innerHTML = merchants.map((item) => {
    const active = item.id === wholesaleState.currentMerchantId;
    return `
      <button class="wholesale-merchant-card w-full rounded-[1.5rem] border px-5 py-4 text-left transition-all ${active ? "border-secondary bg-white shadow-lg shadow-secondary/10" : "border-transparent bg-surface-container-low hover:bg-white"}" data-id="${escapeHtml(item.id)}" type="button">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-lg font-extrabold text-primary">${escapeHtml(item.name)}</div>
            <div class="mt-1 text-sm text-slate-500">${escapeHtml(item.contactName || "-")} / ${escapeHtml(item.phone || "-")}</div>
            <div class="mt-2 text-xs font-bold text-slate-400">${escapeHtml(item.location || "-")}</div>
          </div>
          <div class="text-right">
            <div class="text-xs text-slate-400">批发单</div>
            <div class="mt-1 text-xl font-black text-primary">${item.wholesaleStats?.orderCount || 0}</div>
          </div>
        </div>
      </button>
    `;
  }).join("") || `<div class="rounded-2xl bg-surface-container-low px-4 py-6 text-sm text-slate-500">暂无本地商家</div>`;
}

function renderMerchantDetail() {
  const merchant = getSelectedMerchant();
  if (!merchant) return;
  document.getElementById("wholesale-merchant-title").textContent = merchant.name;
  document.getElementById("wholesale-merchant-subtitle").textContent = `${merchant.location || "-"} / 档案号 ${merchant.archiveNo || "-"}`;
  document.getElementById("wholesale-merchant-contact").textContent = merchant.contactName || "-";
  document.getElementById("wholesale-merchant-phone").textContent = merchant.phone || "-";
  document.getElementById("wholesale-merchant-sales").textContent = merchant.salesPersonName || "未分配";
  document.getElementById("wholesale-merchant-type").textContent = merchant.customerTypeLabel || "本地商家";
  document.getElementById("wholesale-merchant-address").textContent = merchant.address || "-";
  document.getElementById("wholesale-merchant-order-count").textContent = String(merchant.wholesaleStats?.orderCount || 0);
  document.getElementById("wholesale-merchant-lifetime").textContent = formatMoney(merchant.wholesaleStats?.lifetimeTotal || 0);
  document.getElementById("wholesale-merchant-pending").textContent = formatMoney(merchant.wholesaleStats?.pendingBalance || 0);
  document.getElementById("wholesale-merchant-select").value = merchant.id;
}

function renderOrderPricing() {
  const packageId = document.getElementById("wholesale-package-select").value;
  const quantity = Math.max(1, Number(document.getElementById("wholesale-quantity-input").value || 1));
  const item = wholesaleState.packages.find((pkg) => pkg.id === packageId) || wholesaleState.packages[0];
  if (!item) return;
  document.getElementById("wholesale-unit-price").textContent = formatMoney(item.wholesaleVt || 0);
  document.getElementById("wholesale-package-stock").textContent = String(item.stock || 0);
  document.getElementById("wholesale-total-price").textContent = formatMoney((item.wholesaleVt || 0) * quantity);
}

function renderOrdersTable() {
  const selectedMerchant = getSelectedMerchant();
  const rows = (selectedMerchant
    ? wholesaleState.orders.filter((item) => item.merchantId === selectedMerchant.id)
    : wholesaleState.orders
  ).slice(0, 12);
  document.getElementById("wholesale-orders-table").innerHTML = rows.map((item) => `
    <tr class="align-top">
      <td class="py-3 pr-4 font-bold text-primary">${escapeHtml(item.id)}</td>
      <td class="py-3 pr-4">${escapeHtml(item.merchantName)}</td>
      <td class="py-3 pr-4">${escapeHtml(item.packageName)} x ${item.quantity}</td>
      <td class="py-3 pr-4">${escapeHtml(item.salesPersonName || "-")}</td>
      <td class="py-3 pr-4 font-bold text-primary">${formatMoney(item.totalVt)}</td>
      <td class="py-3 pr-4">
        <div class="font-semibold text-emerald-700">${formatMoney(item.paidAmountVt || 0)}</div>
        <div class="mt-1 text-xs text-slate-500">未收 ${formatMoney(item.balanceAmountVt || 0)}</div>
      </td>
      <td class="py-3 pr-4">
        <select class="wholesale-order-status w-full rounded-xl border border-outline-variant/20 px-3 py-2 text-xs font-bold" data-id="${escapeHtml(item.id)}">
          <option value="pending_payment" ${item.status === "pending_payment" ? "selected" : ""}>待付款</option>
          <option value="partial_paid" ${item.status === "partial_paid" ? "selected" : ""}>部分收款</option>
          <option value="paid" ${item.status === "paid" ? "selected" : ""}>已付款</option>
          <option value="delivered" ${item.status === "delivered" ? "selected" : ""}>已交付</option>
          <option value="cancelled" ${item.status === "cancelled" ? "selected" : ""}>已取消</option>
        </select>
      </td>
      <td class="py-3 pr-4">
        <div class="flex flex-col gap-2">
          <input class="wholesale-order-paid w-28 rounded-xl border border-outline-variant/20 px-3 py-2 text-xs" data-id="${escapeHtml(item.id)}" min="0" max="${item.totalVt}" type="number" value="${item.paidAmountVt || 0}" />
          <button class="wholesale-order-save rounded-xl bg-secondary-container px-3 py-2 text-xs font-bold text-primary" data-id="${escapeHtml(item.id)}" type="button">更新付款</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td class="py-6 text-sm text-slate-500" colspan="8">暂无批发订单</td></tr>`;
}

function openDetailPanel(kicker, title, summary, headers, rows) {
  document.getElementById("wholesale-detail-panel").classList.remove("hidden");
  document.getElementById("wholesale-detail-kicker").textContent = kicker;
  document.getElementById("wholesale-detail-title").textContent = title;
  document.getElementById("wholesale-detail-summary").textContent = summary;
  document.getElementById("wholesale-detail-head").innerHTML = `
    <tr>${headers.map((item) => `<th class="py-3 pr-4">${escapeHtml(item)}</th>`).join("")}</tr>
  `;
  document.getElementById("wholesale-detail-body").innerHTML = rows.map((row) => `
    <tr>${row.map((cell) => `<td class="py-3 pr-4">${cell}</td>`).join("")}</tr>
  `).join("") || `<tr><td class="py-6 text-sm text-slate-500" colspan="${headers.length}">暂无数据</td></tr>`;
}

function bindSummaryClicks() {
document.getElementById("wholesale-summary-merchants").onclick = () => {
  openDetailPanel(
    "本地商家",
      "本地商家名单",
      `当前共有 ${wholesaleState.summary.merchantCount || 0} 家本地商家`,
      ["商家", "联系人", "电话", "城市", "累计批发额"],
      wholesaleState.merchants.map((item) => [
        escapeHtml(item.name),
        escapeHtml(item.contactName || "-"),
        escapeHtml(item.phone || "-"),
        escapeHtml(item.location || "-"),
        formatMoney(item.wholesaleStats?.lifetimeTotal || 0)
      ])
    );
  };

document.getElementById("wholesale-summary-orders").onclick = () => {
  openDetailPanel(
    "批发订单",
      "批发订单明细",
      `已生成 ${wholesaleState.summary.orderCount || 0} 张批发订单`,
      ["订单号", "商家", "套装", "销售", "金额", "状态"],
      wholesaleState.orders.map((item) => [
        escapeHtml(item.id),
        escapeHtml(item.merchantName),
        `${escapeHtml(item.packageName)} x ${item.quantity}`,
        escapeHtml(item.salesPersonName || "-"),
        formatMoney(item.totalVt),
        escapeHtml(item.statusLabel)
      ])
    );
  };

document.getElementById("wholesale-summary-pending").onclick = () => {
  openDetailPanel(
    "待收账款",
      "待收批发订单",
      `待收总额 ${formatMoney(wholesaleState.summary.pendingAmount || 0)}`,
      ["订单号", "商家", "金额", "销售", "备注"],
      wholesaleState.orders
        .filter((item) => item.status === "pending_payment" || item.status === "partial_paid")
        .map((item) => [
          escapeHtml(item.id),
          escapeHtml(item.merchantName),
          formatMoney(item.totalVt),
          escapeHtml(item.salesPersonName || "-"),
          escapeHtml(item.notes || "-")
        ])
    );
  };

document.getElementById("wholesale-summary-revenue").onclick = () => {
  openDetailPanel(
    "销售收入",
      "累计批发成交",
      `累计批发销售额 ${formatMoney(wholesaleState.summary.wholesaleRevenue || 0)}`,
      ["商家", "套装", "数量", "单价", "总额", "日期"],
      wholesaleState.orders
        .filter((item) => item.status !== "cancelled")
        .map((item) => [
          escapeHtml(item.merchantName),
          escapeHtml(item.packageName),
          String(item.quantity),
          formatMoney(item.unitPriceVt),
          formatMoney(item.totalVt),
          escapeHtml(String(item.createdAt || "").slice(0, 10))
        ])
    );
  };
}

function openMerchantModal() {
  document.getElementById("wholesale-merchant-modal").classList.remove("hidden");
  document.getElementById("wholesale-merchant-modal").classList.add("flex");
}

function closeMerchantModal() {
  document.getElementById("wholesale-merchant-modal").classList.add("hidden");
  document.getElementById("wholesale-merchant-modal").classList.remove("flex");
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

function renderAll() {
  renderSummary();
  renderMerchantOptions();
  renderSalesOptions();
  renderPackageOptions();
  renderMerchantList();
  renderMerchantDetail();
  renderOrderPricing();
  renderOrdersTable();
}

async function loadWholesale() {
  const response = await fetch("/api/wholesale");
  const data = await response.json();
  wholesaleState.merchants = data.merchants || [];
  wholesaleState.salesPeople = data.salesPeople || [];
  wholesaleState.packages = data.packages || [];
  wholesaleState.orders = data.orders || [];
  wholesaleState.summary = data.summary || wholesaleState.summary;
  if (!wholesaleState.currentMerchantId && wholesaleState.merchants[0]) {
    wholesaleState.currentMerchantId = wholesaleState.merchants[0].id;
  }
  renderAll();
}

async function submitMerchant(event) {
  event.preventDefault();
  const result = await postJson("/api/wholesale/merchant", {
    name: document.getElementById("merchant-name").value.trim(),
    contactName: document.getElementById("merchant-contact").value.trim(),
    phone: document.getElementById("merchant-phone").value.trim(),
    email: document.getElementById("merchant-email").value.trim(),
    location: document.getElementById("merchant-location").value.trim(),
    address: document.getElementById("merchant-address").value.trim(),
    salesPersonId: document.getElementById("merchant-sales-select").value
  });
  if (!result.ok) {
    alert(result.error || "保存失败");
    return;
  }
  document.getElementById("wholesale-merchant-form").reset();
  closeMerchantModal();
  await loadWholesale();
}

async function submitOrder(event) {
  event.preventDefault();
  const packageId = document.getElementById("wholesale-package-select").value;
  const quantity = Math.max(1, Number(document.getElementById("wholesale-quantity-input").value || 1));
  const item = wholesaleState.packages.find((pkg) => pkg.id === packageId);
  const result = await postJson("/api/wholesale/orders", {
    merchantId: document.getElementById("wholesale-merchant-select").value,
    salesPersonId: document.getElementById("wholesale-sales-select").value,
    packageId,
    quantity,
    unitPriceVt: item?.wholesaleVt || 0,
    notes: document.getElementById("wholesale-order-notes").value.trim()
  });
  if (!result.ok) {
    alert(result.error || "下单失败");
    return;
  }
  document.getElementById("wholesale-order-notes").value = "";
  document.getElementById("wholesale-quantity-input").value = 1;
  await loadWholesale();
  alert(`批发订单已创建：${result.order.id}`);
}

async function updateOrderPayment(orderId) {
  const paidInput = document.querySelector(`.wholesale-order-paid[data-id="${orderId}"]`);
  const statusSelect = document.querySelector(`.wholesale-order-status[data-id="${orderId}"]`);
  const result = await postJson("/api/wholesale/orders/payment", {
    id: orderId,
    paidAmountVt: Number(paidInput?.value || 0),
    status: statusSelect?.value || "pending_payment"
  });
  if (!result.ok) {
    alert(result.error || "更新付款失败");
    return;
  }
  await loadWholesale();
}

function bindEvents() {
  document.getElementById("wholesale-refresh-btn").addEventListener("click", loadWholesale);
  document.getElementById("wholesale-add-merchant-btn").addEventListener("click", openMerchantModal);
  document.getElementById("wholesale-merchant-modal-close").addEventListener("click", closeMerchantModal);
  document.getElementById("wholesale-detail-close").addEventListener("click", () => {
    document.getElementById("wholesale-detail-panel").classList.add("hidden");
  });
  document.getElementById("wholesale-merchant-search").addEventListener("input", (event) => {
    wholesaleState.search = event.target.value || "";
    renderMerchantList();
    renderMerchantDetail();
    renderOrdersTable();
  });
  document.getElementById("wholesale-merchant-list").addEventListener("click", (event) => {
    const card = event.target.closest(".wholesale-merchant-card");
    if (!card) return;
    wholesaleState.currentMerchantId = card.dataset.id;
    renderMerchantList();
    renderMerchantDetail();
    renderOrdersTable();
  });
  document.getElementById("wholesale-merchant-select").addEventListener("change", (event) => {
    wholesaleState.currentMerchantId = event.target.value;
    renderMerchantList();
    renderMerchantDetail();
    renderOrdersTable();
  });
  document.getElementById("wholesale-package-select").addEventListener("change", renderOrderPricing);
  document.getElementById("wholesale-quantity-input").addEventListener("input", renderOrderPricing);
  document.getElementById("wholesale-order-form").addEventListener("submit", submitOrder);
  document.getElementById("wholesale-merchant-form").addEventListener("submit", submitMerchant);
  document.getElementById("wholesale-orders-table").addEventListener("click", (event) => {
    const saveButton = event.target.closest(".wholesale-order-save");
    if (!saveButton) return;
    updateOrderPayment(saveButton.dataset.id);
  });
  bindSummaryClicks();
}

async function init() {
  bindEvents();
  const health = await fetch("/api/health");
  setHealth(health.ok);
  await loadWholesale();
}

init().catch((error) => {
  console.error(error);
  setHealth(false);
});
