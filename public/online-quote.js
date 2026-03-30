const state = {
  locale: localStorage.getItem("smart_sizing_locale") || "zh-CN",
  translations: {}
};

function interpolate(template, params = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function t(key, params = {}) {
  return interpolate(state.translations[key] ?? key, params);
}

async function loadTranslations(locale) {
  const response = await fetch(`/locales/${locale}.json`);
  state.translations = await response.json();
  state.locale = locale;
}

function addDeviceRow(device = { name: "", power: 0, hours: 0, quantity: 1 }) {
  const wrap = document.getElementById("oq-devices");
  const row = document.createElement("div");
  row.className = "grid grid-cols-1 md:grid-cols-[1.2fr_0.7fr_0.7fr_0.7fr_auto] gap-3";
  row.innerHTML = `
    <input class="oq-name rounded-2xl border border-outline-variant/25 bg-surface-container-low px-4 py-3 text-sm" type="text" value="${device.name}" placeholder="${t("device.placeholder.name")}" />
    <input class="oq-power rounded-2xl border border-outline-variant/25 bg-surface-container-low px-4 py-3 text-sm" type="number" value="${device.power}" min="0" />
    <input class="oq-hours rounded-2xl border border-outline-variant/25 bg-surface-container-low px-4 py-3 text-sm" type="number" value="${device.hours}" min="0" step="0.5" />
    <input class="oq-qty rounded-2xl border border-outline-variant/25 bg-surface-container-low px-4 py-3 text-sm" type="number" value="${device.quantity}" min="0" />
    <button class="oq-remove rounded-2xl bg-white px-4 py-3 text-sm font-bold text-red-600">×</button>
  `;
  row.querySelector(".oq-remove").addEventListener("click", () => row.remove());
  wrap.appendChild(row);
}

function collectDevices() {
  return Array.from(document.querySelectorAll("#oq-devices > div")).map((row) => ({
    name: row.querySelector(".oq-name").value.trim(),
    power: Number(row.querySelector(".oq-power").value || 0),
    hours: Number(row.querySelector(".oq-hours").value || 0),
    quantity: Number(row.querySelector(".oq-qty").value || 0)
  }));
}

function applyTranslations() {
  document.documentElement.lang = state.locale;
  document.title = t("onlineQuote.metaTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
}

function renderQuote(data) {
  const recommendation = data.recommendation || {};
  const quote = data.quote || {};
  document.getElementById("oq-output").className = "mt-6 rounded-[1.75rem] bg-surface-container-low p-6";
  document.getElementById("oq-output").innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div class="rounded-2xl bg-white p-5">
        <div class="text-xs font-bold uppercase tracking-[0.24em] text-secondary">${t("preview.packageName")}</div>
        <div class="mt-3 text-2xl font-extrabold text-primary">${recommendation.packageName || "-"}</div>
        <div class="mt-3 space-y-2 text-sm text-slate-600">
          <div>${t("preview.solarPanels")}: ${recommendation.solarPanels || "-"}</div>
          <div>${t("preview.battery")}: ${recommendation.battery || "-"}</div>
          <div>${t("preview.inverter")}: ${recommendation.inverter || "-"}</div>
          <div>${t("package.loadCapacity")}: ${recommendation.loadCapacityW || 0}W</div>
        </div>
      </div>
      <div class="rounded-2xl bg-primary p-5 text-white">
        <div class="text-xs font-bold uppercase tracking-[0.24em] text-secondary-container">${t("section.quote")}</div>
        <div class="mt-3 text-3xl font-extrabold">${quote.displayTotal || 0} ${quote.currency || "VUV"}</div>
        <div class="mt-4 space-y-2 text-sm text-white/80">
          <div>${t("quote.equipment")}: ${quote.equipmentPrice || 0}</div>
          <div>${t("quote.install")}: ${quote.installFee || 0}</div>
          <div>${t("quote.logistics")}: ${quote.logisticsFee || 0}</div>
          <div>${t("quote.vatDynamic", { value: quote.vatRate || 0 })}: ${quote.vat || 0}</div>
        </div>
      </div>
    </div>
  `;
}

async function calculateQuote() {
  const body = {
    location: document.getElementById("oq-location").value,
    customer: {
      name: document.getElementById("oq-name").value.trim(),
      phone: document.getElementById("oq-phone").value.trim()
    },
    devices: collectDevices()
  };
  const response = await fetch("/api/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  renderQuote(data);
}

async function init() {
  await loadTranslations(state.locale);
  applyTranslations();
  addDeviceRow({ name: "LED Light", power: 10, hours: 6, quantity: 4 });
  addDeviceRow({ name: "Fridge", power: 150, hours: 24, quantity: 1 });
  document.getElementById("oq-add-device").addEventListener("click", () => addDeviceRow());
  document.getElementById("oq-calculate").addEventListener("click", calculateQuote);
}

init().catch(console.error);
