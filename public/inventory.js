const state = {
  locale: localStorage.getItem("smart_sizing_locale") || "zh-CN",
  translations: {},
  inventory: {
    shipment: {},
    stockItems: [],
    purchaseOrders: [],
    transactions: [],
    summary: { inventoryValue: 0, availableLiquidity: 0, alertCount: 0 }
  },
  selectedCategory: "all",
  stocktakeRows: [],
  operators: [],
  vendors: {
    items: [],
    purchaseOptions: {}
  }
};

const formatter = new Intl.NumberFormat("en-US");
const inventoryContentKeys = {
  itemName: {
    "inv-panel-550": "inventory.item.panel550",
    "inv-battery-5kwh": "inventory.item.battery5kwh",
    "inv-inverter-8kw": "inventory.item.inverter8kw",
    "inv-cable-6mm": "inventory.item.dcCable6mm",
    "inv-pv-cable-4mm": "inventory.item.pvCable4mm",
    "inv-mc4-pair": "inventory.item.mc4Pair",
    "inv-ac-cable-3c6": "inventory.item.acCable3c6",
    "inv-earth-cable-16": "inventory.item.earthCable16",
    "inv-battery-cable-25": "inventory.item.batteryCable25"
  },
  itemModel: {
    "inv-panel-550": "inventory.model.panel550",
    "inv-battery-5kwh": "inventory.model.battery5kwh",
    "inv-inverter-8kw": "inventory.model.inverter8kw",
    "inv-cable-6mm": "inventory.model.dcCable6mm",
    "inv-pv-cable-4mm": "inventory.model.pvCable4mm",
    "inv-mc4-pair": "inventory.model.mc4Pair",
    "inv-ac-cable-3c6": "inventory.model.acCable3c6",
    "inv-earth-cable-16": "inventory.model.earthCable16",
    "inv-battery-cable-25": "inventory.model.batteryCable25"
  },
  category: {
    all: "inventory.category.all",
    solar: "inventory.category.solar",
    battery: "inventory.category.battery",
    inverter: "inventory.category.inverter",
    cable: "inventory.category.cable",
    accessory: "inventory.category.accessory"
  }
};

function interpolate(template, params = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function t(key, params = {}) {
  return interpolate(state.translations[key] ?? key, params);
}

function localizeInventoryItem(item) {
  const itemId = item.id || item.itemId;
  return {
    ...item,
    name: t(inventoryContentKeys.itemName[itemId] || item.name),
    model: t(inventoryContentKeys.itemModel[itemId] || item.model),
    categoryLabel: t(inventoryContentKeys.category[item.category] || item.category)
  };
}

function money(value) {
  return `VT ${formatter.format(value || 0)}`;
}

async function loadTranslations(locale) {
  const response = await fetch(`/locales/${locale}.json`);
  state.translations = await response.json();
  state.locale = locale;
  localStorage.setItem("smart_sizing_locale", locale);
}

function applyTranslations() {
  document.documentElement.lang = state.locale;
  document.title = t("inventory.metaTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((node) => {
    const [attr, key] = node.dataset.i18nAttr.split(":");
    node.setAttribute(attr, t(key));
  });
  renderAll();
}

function setHealth(ok) {
  const dot = document.getElementById("health-dot");
  const text = document.getElementById("health-text");
  if (!dot || !text) return;
  dot.className = `inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`;
  text.textContent = ok ? t("status.online") : t("status.error");
}

function renderMessage(message, success = true) {
  const node = document.getElementById("inventory-message");
  node.classList.remove("hidden");
  node.className = `rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`;
  node.textContent = message;
}

function renderShipment() {
  const shipment = state.inventory.shipment || {};
  document.getElementById("shipment-route-label").textContent = shipment.routeLabel || "-";
  document.getElementById("shipment-status-badge").textContent = shipment.statusLabel || "-";
  document.getElementById("shipment-tracking").textContent = shipment.trackingNo || "-";
  document.getElementById("shipment-cargo").textContent = shipment.cargoSummary || "-";
  document.getElementById("shipment-origin-date").textContent = shipment.originDate || "-";
  document.getElementById("shipment-transit-port").textContent = shipment.transitPort || "-";
  document.getElementById("shipment-transit-date").textContent = shipment.transitDate || "-";
  document.getElementById("shipment-current-zone").textContent = shipment.currentZone || "-";
  document.getElementById("shipment-eta-date").textContent = shipment.etaDate || "-";
  document.getElementById("shipment-destination-port").textContent = shipment.destinationPort || "-";
  document.getElementById("shipment-destination-date").textContent = shipment.destinationDate || t("inventory.pending");
}

function renderSummary() {
  const summary = state.inventory.summary || {};
  document.getElementById("inventory-total-value").textContent = money(summary.inventoryValue);
  document.getElementById("inventory-liquidity").textContent = money(summary.availableLiquidity);
  const ratio = summary.inventoryValue ? Math.min(100, Math.round((summary.availableLiquidity / summary.inventoryValue) * 100)) : 0;
  document.getElementById("inventory-liquidity-bar").style.width = `${ratio}%`;
  document.getElementById("inventory-alert-line").textContent = t("inventory.alertLine", { value: summary.alertCount || 0 });
  document.getElementById("inventory-alert-badge").textContent = t("inventory.alertBadge", { value: summary.alertCount || 0 });
  const countNode = document.getElementById("inventory-total-skus");
  if (countNode) countNode.textContent = t("inventory.totalSkus", { value: state.inventory.stockItems.length || 0 });
}

function renderAlertPanel() {
  const body = document.getElementById("inventory-alert-body");
  if (!body) return;
  const rows = (state.inventory.stockItems || []).filter((item) => item.quantity <= item.threshold);
  body.innerHTML = rows.map((item, index) => {
    const localized = localizeInventoryItem(item);
    return `
      <tr class="${index % 2 ? "bg-surface-container-low/40 hover:bg-slate-50" : "hover:bg-slate-50"}">
        <td class="px-8 py-5 text-sm font-bold text-primary">${localized.name}</td>
        <td class="px-6 py-5 text-sm text-slate-600">${localized.categoryLabel}</td>
        <td class="px-6 py-5 text-sm font-bold text-error">${formatter.format(item.quantity)}</td>
        <td class="px-6 py-5 text-sm text-slate-600">${formatter.format(item.threshold)}</td>
        <td class="px-8 py-5 text-sm text-slate-500">${item.unit}</td>
      </tr>
    `;
  }).join("") || `<tr><td class="px-8 py-6 text-sm text-slate-500" colspan="5">当前没有库存预警</td></tr>`;
}

function iconForCategory(category) {
  return {
    package: "deployed_code",
    solar: "solar_power",
    battery: "battery_charging_full",
    inverter: "settings_input_component",
    cable: "cable",
    accessory: "conversion_path",
    mounting: "construction",
    lighting: "lightbulb"
  }[category] || "inventory_2";
}

function getFilteredStockItems() {
  return state.selectedCategory === "all"
    ? state.inventory.stockItems
    : state.inventory.stockItems.filter((item) => item.category === state.selectedCategory);
}

function renderCategoryFilters() {
  const wrap = document.getElementById("inventory-category-filters");
  if (!wrap) return;
  const categories = ["all", ...new Set(state.inventory.stockItems.map((item) => item.category))];
  wrap.innerHTML = "";
  categories.forEach((category) => {
    const count = category === "all"
      ? state.inventory.stockItems.length
      : state.inventory.stockItems.filter((item) => item.category === category).length;
    const button = document.createElement("button");
    const active = state.selectedCategory === category;
    button.type = "button";
    button.className = `rounded-full px-4 py-2 text-sm font-bold transition ${active ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white border border-outline-variant/20 text-primary"}`;
    button.textContent = `${t(inventoryContentKeys.category[category] || category)} (${count})`;
    button.addEventListener("click", () => {
      state.selectedCategory = category;
      renderStockItems();
      renderCategoryFilters();
      renderItemSelect();
    });
    wrap.appendChild(button);
  });
}

function renderStockItems() {
  const grid = document.getElementById("inventory-stock-grid");
  grid.innerHTML = "";
  getFilteredStockItems().forEach((rawItem) => {
    const item = localizeInventoryItem(rawItem);
    const low = item.status === "low";
    const card = document.createElement("div");
    card.className = `rounded-[1.75rem] p-6 shadow-[0_12px_32px_rgba(25,28,29,0.04)] transition-all ${low ? "bg-white border-2 border-secondary/30" : "bg-white border border-outline-variant/10"}`;
    card.innerHTML = `
      <div class="flex justify-between mb-4">
        <div class="w-12 h-12 rounded-2xl flex items-center justify-center ${low ? "bg-secondary/10" : "bg-surface-container-low"}">
          <span class="material-symbols-outlined text-2xl ${low ? "text-secondary" : "text-primary"}">${iconForCategory(item.category)}</span>
        </div>
        <span class="rounded-lg px-2 py-1 text-[10px] font-bold ${low ? "bg-secondary-container/30 text-secondary" : "bg-cyan-100 text-cyan-700"}">${low ? t("inventory.lowStock") : t("inventory.healthy")}</span>
      </div>
      <h4 class="font-bold text-primary mb-1">${item.name}</h4>
      <p class="text-xs text-slate-400 mb-4">${item.model || item.sku}</p>
      <div class="mb-4">
        <span class="rounded-full bg-surface-container-low px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">${item.categoryLabel}</span>
      </div>
      <div class="flex items-baseline gap-1 mb-2">
        <span class="text-3xl font-black ${low ? "text-secondary" : "text-primary"}">${formatter.format(item.quantity)}</span>
        <span class="text-xs text-slate-500">${item.unit}</span>
      </div>
      <div class="flex items-center justify-between text-[10px] font-bold">
        <span class="text-slate-500">${t("inventory.monthlyUsage", { value: formatter.format(item.monthlyUsage) })}</span>
        <span class="${item.trendPct >= 0 ? "text-primary" : "text-slate-500"}">${item.trendPct >= 0 ? "+" : ""}${item.trendPct}%</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

function renderTransactions() {
  const body = document.getElementById("inventory-transaction-body");
  body.innerHTML = "";
  state.inventory.transactions.slice(0, 20).forEach((item, index) => {
    const localizedItem = localizeInventoryItem(item);
    const typeClass = item.type === "inbound"
      ? "bg-cyan-100 text-cyan-700"
      : item.type === "stocktake"
        ? "bg-secondary-container/30 text-secondary"
        : "bg-primary/10 text-primary";
    const row = document.createElement("tr");
    row.className = index % 2 ? "bg-surface-container-low/40 hover:bg-slate-50" : "hover:bg-slate-50";
    row.innerHTML = `
      <td class="px-8 py-5 text-sm font-bold text-primary">${item.id}</td>
      <td class="px-6 py-5">
        <div class="flex flex-col">
          <span class="text-sm font-medium text-primary">${localizedItem.name}</span>
          <span class="text-[10px] text-slate-400">${item.sku}${item.referenceNo ? ` / ${item.referenceNo}` : ""}</span>
        </div>
      </td>
      <td class="px-6 py-5">
        <span class="rounded-lg px-3 py-1 text-[10px] font-bold uppercase ${typeClass}">${item.typeLabel}</span>
      </td>
      <td class="px-6 py-5 text-sm font-bold ${item.quantityChange >= 0 ? "text-primary" : "text-error"}">${item.quantityText}</td>
      <td class="px-6 py-5 text-sm text-slate-600">${item.operator}${item.notes ? `<div class="mt-1 text-[10px] text-slate-400">${item.notes}</div>` : ""}</td>
      <td class="px-8 py-5 text-sm text-slate-400">${new Date(item.timestamp).toLocaleString()}</td>
    `;
    body.appendChild(row);
  });
}

function renderStocktakeRecords() {
  const body = document.getElementById("inventory-stocktake-body");
  if (!body) return;
  const rows = (state.inventory.transactions || []).filter((item) => item.type === "stocktake").slice(0, 20);
  body.innerHTML = rows.map((item, index) => {
    const localizedItem = localizeInventoryItem(item);
    return `
      <tr class="${index % 2 ? "bg-surface-container-low/40 hover:bg-slate-50" : "hover:bg-slate-50"}">
        <td class="px-8 py-5 text-sm font-bold text-primary">${item.id}</td>
        <td class="px-6 py-5">
          <div class="flex flex-col">
            <span class="text-sm font-medium text-primary">${localizedItem.name}</span>
            <span class="text-[10px] text-slate-400">${item.sku}</span>
          </div>
        </td>
        <td class="px-6 py-5 text-sm font-bold ${item.quantityChange >= 0 ? "text-emerald-700" : "text-error"}">${item.quantityText}</td>
        <td class="px-6 py-5 text-sm text-slate-600">${item.operator}</td>
        <td class="px-8 py-5 text-sm text-slate-400">${new Date(item.timestamp).toLocaleString()}</td>
      </tr>
    `;
  }).join("") || `<tr><td class="px-8 py-6 text-sm text-slate-500" colspan="5">暂无盘点记录</td></tr>`;
}

function renderOperatorOptions() {
  const generalOptions = state.operators.map((item) => `<option value="${item.name}">${item.name} / ${item.roleLabel}</option>`).join("");
  const stocktakeOperators = state.operators.filter((item) => item.role === "admin" || item.role === "sales_manager");
  const stocktakeOptions = stocktakeOperators.map((item) => `<option value="${item.name}">${item.name} / ${item.roleLabel}</option>`).join("");

  const generalSelect = document.getElementById("inventory-operator-select");
  if (generalSelect) {
    const current = generalSelect.value;
    generalSelect.innerHTML = generalOptions || `<option value="System">System</option>`;
    if ([...generalSelect.options].some((option) => option.value === current)) {
      generalSelect.value = current;
    }
  }

  const stocktakeSelect = document.getElementById("inventory-stocktake-operator-select");
  if (stocktakeSelect) {
    const current = stocktakeSelect.value;
    stocktakeSelect.innerHTML = stocktakeOptions || `<option value="">暂无有权限人员</option>`;
    if ([...stocktakeSelect.options].some((option) => option.value === current)) {
      stocktakeSelect.value = current;
    }
  }
}

function ensureStocktakeRows() {
  const items = state.inventory.stockItems || [];
  const validIds = new Set(items.map((item) => item.id));
  state.stocktakeRows = state.stocktakeRows
    .filter((row) => !row.itemId || validIds.has(row.itemId))
    .map((row) => ({ ...row }));
}

function getAvailableStocktakeItemIds(excludeRowIndex) {
  const usedIds = new Set(
    state.stocktakeRows
      .filter((_, index) => index !== excludeRowIndex)
      .map((row) => row.itemId)
  );
  return (state.inventory.stockItems || []).filter((item) => !usedIds.has(item.id)).map((item) => item.id);
}

function getStocktakeCategories() {
  return [...new Set((state.inventory.stockItems || []).map((item) => item.category).filter(Boolean))];
}

function addStocktakeRow() {
  state.stocktakeRows.push({
    itemId: "",
    actualQuantity: ""
  });
  renderStocktakePanel();
}

function addStocktakeCategory(category) {
  const usedIds = new Set(state.stocktakeRows.map((row) => row.itemId));
  const items = (state.inventory.stockItems || []).filter((item) => item.category === category && !usedIds.has(item.id));
  if (!items.length) return;
  items.forEach((item) => {
    state.stocktakeRows.push({
      itemId: item.id,
      actualQuantity: item.quantity
    });
  });
  renderStocktakePanel();
}

function removeStocktakeRow(index) {
  state.stocktakeRows.splice(index, 1);
  renderStocktakePanel();
}

function renderStocktakeCategoryActions() {
  const wrap = document.getElementById("inventory-stocktake-category-actions");
  if (!wrap) return;
  const categories = getStocktakeCategories();
  wrap.innerHTML = categories.map((category) => {
    const availableCount = (state.inventory.stockItems || []).filter((item) => (
      item.category === category && !state.stocktakeRows.some((row) => row.itemId === item.id)
    )).length;
    return `
      <button
        class="inventory-stocktake-category rounded-full border border-outline-variant/20 bg-white px-3 py-2 text-xs font-bold text-primary ${availableCount ? "" : "opacity-50"}"
        data-category="${category}"
        type="button"
        ${availableCount ? "" : "disabled"}
      >
        ${t(inventoryContentKeys.category[category] || category)} (${availableCount})
      </button>
    `;
  }).join("");
}

function renderStocktakePanel() {
  ensureStocktakeRows();
  const rowsNode = document.getElementById("inventory-stocktake-rows");
  const modalSummary = document.getElementById("inventory-stocktake-modal-summary");
  if (!rowsNode || !modalSummary) return;
  const items = state.inventory.stockItems || [];
  if (!state.stocktakeRows.length) {
    rowsNode.innerHTML = `<tr><td class="py-6 pr-4 text-sm text-slate-500" colspan="5">请先添加产品或按分类加入后再盘点</td></tr>`;
    modalSummary.textContent = "当前未选择盘点产品";
    renderStocktakeCategoryActions();
    return;
  }

  let deltaTotal = 0;
  rowsNode.innerHTML = state.stocktakeRows.map((row, index) => {
    const item = items.find((entry) => entry.id === row.itemId) || null;
    const actualQuantity = row.actualQuantity === "" ? "" : Number(row.actualQuantity ?? item?.quantity ?? 0);
    const delta = item && actualQuantity !== "" ? actualQuantity - Number(item.quantity || 0) : null;
    if (delta !== null) deltaTotal += delta;
    const availableIds = getAvailableStocktakeItemIds(index);
    const selectableIds = row.itemId
      ? [row.itemId, ...availableIds.filter((id) => id !== row.itemId)]
      : availableIds;
    const options = [`<option value="">请选择产品</option>`, ...selectableIds.map((id) => {
      const optionItem = items.find((entry) => entry.id === id);
      if (!optionItem) return "";
      return `<option value="${optionItem.id}" ${optionItem.id === row.itemId ? "selected" : ""}>${localizeInventoryItem(optionItem).name}</option>`;
    })].join("");
    return `
      <tr class="align-top">
        <td class="py-3 pr-4">
          <select class="inventory-stocktake-item w-full rounded-xl border border-outline-variant/20 bg-white px-3 py-2 text-sm" data-index="${index}">
            ${options}
          </select>
        </td>
        <td class="py-3 pr-4 text-sm font-semibold text-primary">${item ? `${formatter.format(item.quantity)} ${item.unit}` : "-"}</td>
        <td class="py-3 pr-4">
          <input class="inventory-stocktake-qty w-32 rounded-xl border border-outline-variant/20 px-3 py-2 text-sm" data-index="${index}" min="0" step="1" type="number" value="${actualQuantity}" ${item ? "" : "disabled"} />
        </td>
        <td class="py-3 pr-4 text-sm font-bold ${delta === null || delta === 0 ? "text-slate-500" : delta > 0 ? "text-emerald-700" : "text-error"}">
          ${delta === null ? "-" : `${delta > 0 ? "+" : ""}${formatter.format(delta)}`}
        </td>
        <td class="py-3 pr-4">
          <button class="inventory-stocktake-remove rounded-xl border border-outline-variant/20 px-3 py-2 text-xs font-bold text-slate-600" data-index="${index}" type="button">删除</button>
        </td>
      </tr>
    `;
  }).join("");
  const selectedCount = state.stocktakeRows.filter((row) => row.itemId).length;
  modalSummary.textContent = `当前待盘点 ${selectedCount} 个产品，合计差异 ${deltaTotal > 0 ? "+" : ""}${formatter.format(deltaTotal)}`;
  renderStocktakeCategoryActions();
}

function openStocktakeModal() {
  ensureStocktakeRows();
  renderStocktakePanel();
  const modal = document.getElementById("inventory-stocktake-modal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeStocktakeModal() {
  const modal = document.getElementById("inventory-stocktake-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function syncStocktakeRowItem(index, itemId) {
  if (!state.stocktakeRows[index]) return;
  if (!itemId) {
    state.stocktakeRows[index].itemId = "";
    state.stocktakeRows[index].actualQuantity = "";
    renderStocktakePanel();
    return;
  }
  const item = (state.inventory.stockItems || []).find((entry) => entry.id === itemId);
  if (!item) return;
  state.stocktakeRows[index].itemId = itemId;
  state.stocktakeRows[index].actualQuantity = item.quantity;
  renderStocktakePanel();
}

function syncStocktakeRowQuantity(index, quantity) {
  if (!state.stocktakeRows[index]) return;
  state.stocktakeRows[index].actualQuantity = Math.max(0, Number(quantity || 0));
  renderStocktakePanel();
}

async function saveStocktake() {
  const operator = document.getElementById("inventory-stocktake-operator-select").value || "System";
  if (!operator) {
    renderMessage("只有管理员和销售经理可以盘点", false);
    return;
  }
  const rows = state.stocktakeRows.filter((row) => row.itemId && Number(row.actualQuantity) >= 0);
  if (!rows.length) {
    renderMessage(t("inventory.invalidStocktake"), false);
    return;
  }
  const response = await fetch("/api/inventory/stocktake/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      operator,
      rows: rows.map((row) => ({
        itemId: row.itemId,
        actualQuantity: Number(row.actualQuantity)
      }))
    })
  });
  const data = await response.json();
  if (!data.ok) {
    renderMessage(data.error || t("status.error"), false);
    return;
  }
  state.inventory = data.inventory;
  state.stocktakeRows = [];
  closeStocktakeModal();
  renderAll();
  renderMessage("库存盘点已保存", true);
}

function renderItemSelect() {
  const select = document.getElementById("inventory-item-select");
  const current = select.value;
  const availableItems = getFilteredStockItems();
  select.innerHTML = availableItems.map((item) => `<option value="${item.id}">${localizeInventoryItem(item).name}</option>`).join("");
  if (availableItems.some((item) => item.id === current)) {
    select.value = current;
  }
}

function renderAll() {
  renderShipment();
  renderSummary();
  renderAlertPanel();
  renderCategoryFilters();
  renderStockItems();
  renderTransactions();
  renderStocktakeRecords();
  renderItemSelect();
  renderOperatorOptions();
}

async function loadOperators() {
  const response = await fetch("/api/employees");
  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];
  state.operators = items
    .filter((item) => item.status !== "resigned" && (item.role === "admin" || item.role === "sales_manager"))
    .map((item) => ({
      id: item.id,
      name: item.name,
      role: item.role,
      roleLabel: item.roleLabel || item.role
    }));
}

async function loadInventory() {
  const response = await fetch("/api/inventory");
  const data = await response.json();
  state.inventory = {
    shipment: data.shipment || {},
    stockItems: data.stockItems || [],
    purchaseOrders: data.purchaseOrders || [],
    transactions: data.transactions || [],
    summary: data.summary || { inventoryValue: 0, availableLiquidity: 0, alertCount: 0 }
  };
  renderAll();
}

async function saveTransaction(typeLabel) {
  const itemId = document.getElementById("inventory-item-select").value;
  const type = document.getElementById("inventory-type-select").value;
  const quantity = Number(document.getElementById("inventory-qty-input").value || 0);
  const operator = document.getElementById("inventory-operator-select").value || "System";
  if (!operator) {
    renderMessage("只有管理员和销售经理可以出入库", false);
    return;
  }
  if (!itemId || quantity <= 0) {
    renderMessage(t("inventory.invalidTransaction"), false);
    return;
  }
  const response = await fetch("/api/inventory/transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      itemId,
      type,
      quantity,
      operator,
      typeLabel
    })
  });
  const data = await response.json();
  if (!data.ok) {
    renderMessage(data.error || t("status.error"), false);
    return;
  }
  state.inventory = data.inventory;
  renderAll();
  renderMessage(t("inventory.savedTransaction"), true);
}

function bindEvents() {
  document.getElementById("inventory-save-transaction").addEventListener("click", () => {
    const type = document.getElementById("inventory-type-select").value;
    saveTransaction(type === "inbound" ? t("inventory.typeInboundManual") : t("inventory.typeOutboundManual"));
  });
  document.getElementById("inventory-alert-badge").addEventListener("click", () => {
    document.getElementById("inventory-alert-panel").classList.remove("hidden");
  });
  document.getElementById("inventory-alert-close").addEventListener("click", () => {
    document.getElementById("inventory-alert-panel").classList.add("hidden");
  });
  document.getElementById("inventory-open-stocktake-modal").addEventListener("click", openStocktakeModal);
  document.getElementById("inventory-stocktake-modal-close").addEventListener("click", closeStocktakeModal);
  document.getElementById("inventory-cancel-stocktake").addEventListener("click", closeStocktakeModal);
  document.getElementById("inventory-add-stocktake-row").addEventListener("click", addStocktakeRow);
  document.getElementById("inventory-save-stocktake").addEventListener("click", saveStocktake);
  document.getElementById("inventory-stocktake-rows").addEventListener("click", (event) => {
    const removeButton = event.target.closest(".inventory-stocktake-remove");
    if (!removeButton) return;
    removeStocktakeRow(Number(removeButton.dataset.index));
  });
  document.getElementById("inventory-stocktake-rows").addEventListener("change", (event) => {
    const itemSelect = event.target.closest(".inventory-stocktake-item");
    if (itemSelect) {
      syncStocktakeRowItem(Number(itemSelect.dataset.index), itemSelect.value);
      return;
    }
    const qtyInput = event.target.closest(".inventory-stocktake-qty");
    if (qtyInput) {
      syncStocktakeRowQuantity(Number(qtyInput.dataset.index), qtyInput.value);
    }
  });
  document.getElementById("inventory-stocktake-category-actions").addEventListener("click", (event) => {
    const button = event.target.closest(".inventory-stocktake-category");
    if (!button) return;
    addStocktakeCategory(button.dataset.category);
  });
}

async function init() {
  await loadTranslations(state.locale);
  applyTranslations();
  await loadOperators();
  bindEvents();
  const health = await fetch("/api/health");
  setHealth(health.ok);
  await loadInventory();
}

init().catch((error) => {
  console.error(error);
  setHealth(false);
  renderMessage(t("status.error"), false);
});
