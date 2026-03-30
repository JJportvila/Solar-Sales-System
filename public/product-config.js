const state = {
  locale: localStorage.getItem("smart_sizing_locale") || "zh-CN",
  translations: {},
  config: { vatRate: 15, packages: [], discounts: [] },
  selectedPackageId: "",
  editingDiscountId: ""
};

const moneyFormatter = new Intl.NumberFormat("en-US");

function interpolate(template, params = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function t(key, params = {}) {
  return interpolate(state.translations[key] ?? key, params);
}

function money(value) {
  return `VT ${moneyFormatter.format(value || 0)}`;
}

function ensureWholesaleEditorFields() {
  if (document.getElementById("pkg-wholesale")) return;
  const retailInput = document.getElementById("pkg-retail");
  if (!retailInput) return;
  const retailGroup = retailInput.parentElement;
  const retailGrid = retailGroup?.parentElement;
  if (retailGrid) {
    retailGrid.className = "grid grid-cols-1 gap-4 md:grid-cols-3";
    retailGrid.insertAdjacentHTML("beforeend", `
      <div>
        <label class="block text-xs font-bold uppercase text-outline mb-2">批发价 (VT)</label>
        <input id="pkg-wholesale" class="w-full rounded-xl border-none bg-primary/5 h-12 px-4 text-sm font-bold text-primary" min="0" step="1000" type="number" />
      </div>
    `);
  }

  const marginCard = document.getElementById("pkg-margin")?.parentElement;
  const metricsGrid = marginCard?.parentElement;
  if (metricsGrid && !document.getElementById("pkg-wholesale-margin")) {
    metricsGrid.className = "grid grid-cols-1 gap-4 md:grid-cols-3";
    metricsGrid.insertAdjacentHTML("beforeend", `
      <div class="rounded-2xl bg-surface-container-low p-4">
        <p class="text-[10px] uppercase text-outline font-bold">批发毛利</p>
        <p id="pkg-wholesale-margin" class="mt-2 text-2xl font-black text-primary">0%</p>
      </div>
    `);
  }
}

async function loadTranslations(locale) {
  const response = await fetch(`/locales/${locale}.json`);
  state.translations = await response.json();
  state.locale = locale;
  localStorage.setItem("smart_sizing_locale", locale);
}

function applyTranslations() {
  document.documentElement.lang = state.locale;
  document.title = t("productConfig.metaTitle");
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
  const node = document.getElementById("product-config-message");
  node.classList.remove("hidden");
  node.className = `rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`;
  node.textContent = message;
}

function getSelectedPackage() {
  return state.config.packages.find((item) => item.id === state.selectedPackageId) || state.config.packages[0] || null;
}

function buildPackagePayloadFromForm() {
  const current = getSelectedPackage();
  return {
    id: current?.id || "",
    sku: document.getElementById("pkg-sku").value.trim(),
    name: document.getElementById("pkg-name").value.trim(),
    status: document.getElementById("pkg-status").value,
    storageKwh: Number(document.getElementById("pkg-storage").value || 0),
    panelCount: Number(document.getElementById("pkg-panel-count").value || 0),
    panelWatts: Number(document.getElementById("pkg-panel-watts").value || 0),
    loadCapacityW: Number(document.getElementById("pkg-load-capacity").value || 0),
    inverterModel: document.getElementById("pkg-inverter").value.trim(),
    stock: Number(document.getElementById("pkg-stock").value || 0),
    costVt: Number(document.getElementById("pkg-cost").value || 0),
    retailVt: Number(document.getElementById("pkg-retail").value || 0),
    wholesaleVt: Number(document.getElementById("pkg-wholesale")?.value || 0),
    featured: document.getElementById("pkg-featured").checked,
    sortOrder: current?.sortOrder || state.config.packages.length + 1
  };
}

function renderPackageList() {
  const list = document.getElementById("product-package-list");
  list.innerHTML = "";
  state.config.packages.forEach((item) => {
    const active = item.id === state.selectedPackageId;
    const statusClass = item.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600";
    const card = document.createElement("button");
    card.type = "button";
    card.className = `w-full rounded-[1.75rem] border p-6 text-left transition-all ${active ? "border-secondary shadow-lg shadow-secondary/10 bg-white" : "border-transparent bg-surface-container-low hover:bg-white hover:shadow-xl hover:shadow-primary/5"}`;
    card.innerHTML = `
      <div class="flex justify-between items-start gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">${item.sku}</span>
            <span class="text-xs font-bold px-2 py-0.5 rounded ${statusClass}">${item.status === "active" ? t("productConfig.statusActive") : t("productConfig.statusDraft")}</span>
          </div>
          <h4 class="text-2xl font-extrabold text-primary">${item.name}</h4>
        </div>
        <div class="text-right">
          <p class="text-[10px] uppercase font-bold text-outline">${t("productConfig.retailLabel")}</p>
          <p class="text-2xl font-black text-secondary">${money(item.retailVt)}</p>
          <p class="mt-2 text-xs font-bold text-primary">批发 ${money(item.wholesaleVt || 0)}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-4 border-t border-primary/5">
        <div>
          <p class="text-[10px] uppercase font-medium text-outline">${t("productConfig.fieldStorageShort")}</p>
          <p class="font-bold text-primary">${item.storageKwh} kWh</p>
        </div>
        <div>
          <p class="text-[10px] uppercase font-medium text-outline">${t("productConfig.fieldPanelShort")}</p>
          <p class="font-bold text-primary">${item.panelCount} x ${item.panelWatts}W</p>
        </div>
        <div>
          <p class="text-[10px] uppercase font-medium text-outline">${t("productConfig.fieldInverterShort")}</p>
          <p class="font-bold text-primary">${item.inverterModel}</p>
        </div>
        <div>
          <p class="text-[10px] uppercase font-medium text-outline">${t("productConfig.fieldStockShort")}</p>
          <p class="font-bold text-primary">${item.stock}</p>
        </div>
      </div>
    `;
    card.addEventListener("click", () => {
      state.selectedPackageId = item.id;
      renderAll();
    });
    list.appendChild(card);
  });
}

function renderEditor() {
  const current = getSelectedPackage();
  if (!current) return;
  document.getElementById("editor-title").textContent = t("productConfig.editorTitleWithName", { name: current.name });
  document.getElementById("pkg-sku").value = current.sku;
  document.getElementById("pkg-status").value = current.status;
  document.getElementById("pkg-name").value = current.name;
  document.getElementById("pkg-storage").value = current.storageKwh;
  document.getElementById("pkg-load-capacity").value = current.loadCapacityW;
  document.getElementById("pkg-panel-count").value = current.panelCount;
  document.getElementById("pkg-panel-watts").value = current.panelWatts;
  document.getElementById("pkg-inverter").value = current.inverterModel;
  document.getElementById("pkg-stock").value = current.stock;
  document.getElementById("pkg-cost").value = current.costVt;
  document.getElementById("pkg-retail").value = current.retailVt;
  const wholesaleInput = document.getElementById("pkg-wholesale");
  if (wholesaleInput) wholesaleInput.value = current.wholesaleVt || 0;
  document.getElementById("pkg-featured").checked = Boolean(current.featured);
  renderMargin();
}

function renderMargin() {
  const cost = Number(document.getElementById("pkg-cost").value || 0);
  const retail = Number(document.getElementById("pkg-retail").value || 0);
  const wholesale = Number(document.getElementById("pkg-wholesale")?.value || 0);
  const margin = retail > 0 ? (((retail - cost) / retail) * 100).toFixed(1) : "0.0";
  document.getElementById("pkg-margin").textContent = `${margin}%`;
  const wholesaleMargin = wholesale > 0 ? (((wholesale - cost) / wholesale) * 100).toFixed(1) : "0.0";
  if (document.getElementById("pkg-wholesale-margin")) {
    document.getElementById("pkg-wholesale-margin").textContent = `${wholesaleMargin}%`;
  }
}

function renderVat() {
  document.getElementById("vat-rate-input").value = state.config.vatRate;
  const vatBadge = document.getElementById("product-config-vat-badge");
  if (vatBadge) vatBadge.textContent = `${Number(state.config.vatRate || 0).toFixed(2)}%`;
}

function renderDiscounts() {
  const list = document.getElementById("discount-list");
  list.innerHTML = "";
  state.config.discounts.forEach((item) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between p-3 bg-surface-container-low rounded-xl";
    row.innerHTML = `
      <div>
        <p class="text-sm font-bold text-primary">${item.name}</p>
        <p class="text-[11px] text-slate-500 mt-1">${item.description || "-"}</p>
      </div>
      <div class="flex items-center gap-2">
        <button class="discount-toggle inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${item.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}" data-id="${item.id}" data-active="${item.active ? "0" : "1"}">
          <span class="inline-block w-2 h-2 rounded-full ${item.active ? "bg-emerald-500" : "bg-slate-400"}"></span>
          <span>${item.active ? t("productConfig.discountOn") : t("productConfig.discountOff")}</span>
        </button>
        <button class="discount-edit rounded-full bg-white px-3 py-1 text-xs font-bold text-primary" data-id="${item.id}">${t("productConfig.editDiscount")}</button>
      </div>
    `;
    list.appendChild(row);
  });
}

function renderDiscountForm() {
  const current = state.config.discounts.find((item) => item.id === state.editingDiscountId);
  document.getElementById("discount-name").value = current?.name || "";
  document.getElementById("discount-description").value = current?.description || "";
  document.getElementById("discount-active").checked = Boolean(current?.active);
}

function renderAll() {
  if (!state.config.packages.length) return;
  if (!state.config.packages.some((item) => item.id === state.selectedPackageId)) {
    state.selectedPackageId = state.config.packages[0].id;
  }
  renderPackageList();
  renderEditor();
  renderVat();
  renderDiscounts();
  renderDiscountForm();
}

async function loadConfig() {
  const response = await fetch("/api/product-config");
  const data = await response.json();
  state.config = {
    vatRate: data.vatRate ?? 15,
    packages: data.packages || [],
    discounts: data.discounts || []
  };
  renderAll();
}

async function savePackage() {
  const payload = buildPackagePayloadFromForm();
  const response = await fetch("/api/product-config/package", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ package: payload })
  });
  const data = await response.json();
  if (!data.ok) {
    renderMessage(t("status.error"), false);
    return;
  }
  state.config = data.config;
  state.selectedPackageId = data.item.id;
  renderAll();
  renderMessage(t("productConfig.savedPackage"), true);
}

async function saveVat() {
  const response = await fetch("/api/product-config/vat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vatRate: Number(document.getElementById("vat-rate-input").value || 0) })
  });
  const data = await response.json();
  if (!data.ok) {
    renderMessage(t("status.error"), false);
    return;
  }
  state.config = data.config;
  renderAll();
  renderMessage(t("productConfig.savedVat"), true);
}

async function saveDiscount() {
  const payload = {
    id: state.editingDiscountId || undefined,
    name: document.getElementById("discount-name").value.trim(),
    description: document.getElementById("discount-description").value.trim(),
    active: document.getElementById("discount-active").checked
  };
  const response = await fetch("/api/product-config/discount", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ discount: payload })
  });
  const data = await response.json();
  if (!data.ok) {
    renderMessage(t("status.error"), false);
    return;
  }
  state.config = data.config;
  state.editingDiscountId = data.item.id;
  renderAll();
  renderMessage(t("productConfig.savedDiscount"), true);
}

async function toggleDiscount(id, active) {
  const response = await fetch("/api/product-config/discount/toggle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, active })
  });
  const data = await response.json();
  if (!data.ok) {
    renderMessage(t("status.error"), false);
    return;
  }
  state.config = data.config;
  renderAll();
  renderMessage(t("productConfig.savedDiscount"), true);
}

function createNewPackage() {
  const id = `custom-${Date.now()}`;
  const sortOrder = state.config.packages.length + 1;
  state.config.packages.unshift({
    id,
    sku: `CUSTOM-${sortOrder}`,
    name: t("productConfig.newPackageName", { value: sortOrder }),
    status: "draft",
    storageKwh: 0,
    panelCount: 0,
    panelWatts: 0,
    loadCapacityW: 0,
    inverterModel: "",
    stock: 0,
    costVt: 0,
    retailVt: 0,
    wholesaleVt: 0,
    featured: false,
    sortOrder,
    marginPct: 0
  });
  state.selectedPackageId = id;
  renderAll();
}

function bindEvents() {
  document.getElementById("save-package-button").addEventListener("click", savePackage);
  document.getElementById("save-package-button-top").addEventListener("click", savePackage);
  document.getElementById("save-vat-button").addEventListener("click", saveVat);
  document.getElementById("save-discount-button").addEventListener("click", saveDiscount);
  document.getElementById("new-package-button").addEventListener("click", createNewPackage);

  ["pkg-cost", "pkg-retail", "pkg-wholesale"].forEach((id) => {
    if (!document.getElementById(id)) return;
    document.getElementById(id).addEventListener("input", renderMargin);
  });

  document.getElementById("discount-list").addEventListener("click", (event) => {
    const toggleButton = event.target.closest(".discount-toggle");
    if (toggleButton) {
      toggleDiscount(toggleButton.dataset.id, toggleButton.dataset.active === "1");
      return;
    }
    const editButton = event.target.closest(".discount-edit");
    if (editButton) {
      state.editingDiscountId = editButton.dataset.id;
      renderDiscountForm();
    }
  });
}

async function init() {
  ensureWholesaleEditorFields();
  await loadTranslations(state.locale);
  applyTranslations();
  bindEvents();
  const health = await fetch("/api/health");
  setHealth(health.ok);
  await loadConfig();
}

init().catch((error) => {
  console.error(error);
  setHealth(false);
  renderMessage(t("status.error"), false);
});
