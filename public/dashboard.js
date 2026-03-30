const state = {
  locale: localStorage.getItem("smart_sizing_locale") || "zh-CN",
  translations: {},
  items: [],
  installmentItems: [],
  filteredItems: [],
  showAll: false,
  previewItem: null
};

const numberFormatter = new Intl.NumberFormat("en-US");

function money(value) {
  return `VT ${numberFormatter.format(value || 0)}`;
}

function interpolate(template, params = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function t(key, params = {}) {
  return interpolate(state.translations[key] ?? key, params);
}

function normalizeQuote(item = {}) {
  const customer = item.customer || {};
  const payload = item.payload || {};
  return {
    ...item,
    status: item.status || "draft",
    customerName: customer.name || item.customerName || payload.customer?.name || t("saved.customerFallback"),
    customerEmail: customer.email || payload.customer?.email || "-",
    customerPhone: customer.phone || payload.customer?.phone || "-",
    customerAddress: customer.address || payload.customer?.address || "-",
    packageName: item.packageName || payload.recommendation?.packageName || "-",
    total: item.total || payload.quote?.displayTotal || payload.quote?.total || 0,
    dailyWh: item.dailyWh || payload.metrics?.dailyWh || 0,
    location: item.location || payload.location || "-",
    createdAt: item.createdAt || new Date().toISOString(),
    installmentPlan: item.installmentPlan || payload.installmentPlan || null,
    payload
  };
}

function includedTaxAmount(quote = {}) {
  const storedVat = Number(quote.vat || 0);
  if (storedVat > 0) return storedVat;
  const total = Math.max(0, Number(quote.displayTotal || quote.total || 0));
  const vatRate = Math.max(0, Number(quote.vatRate || 15));
  if (!total || vatRate <= 0) return 0;
  const divisor = 1 + vatRate / 100;
  const net = Math.round(total / divisor);
  return Math.max(0, total - net);
}

async function loadTranslations(locale) {
  const response = await fetch(`/locales/${locale}.json`);
  state.translations = await response.json();
  state.locale = locale;
  localStorage.setItem("smart_sizing_locale", locale);
}

function applyTranslations() {
  document.documentElement.lang = state.locale;
  document.title = t("dashboard.metaTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-attr]").forEach((node) => {
    const [attr, key] = node.dataset.i18nAttr.split(":");
    node.setAttribute(attr, t(key));
  });
}

function setHealth(ok) {
  const dot = document.getElementById("health-dot");
  const text = document.getElementById("health-text");
  if (!dot || !text) return;
  dot.className = `inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`;
  text.textContent = ok ? t("status.online") : t("status.error");
}

function renderMessage(message, success = true) {
  const node = document.getElementById("dashboard-message");
  node.classList.remove("hidden");
  node.className = `mt-8 rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`;
  node.textContent = message;
}

function getStatusMeta(status) {
  const map = {
    draft: { label: t("dashboard.filter.draft"), badge: "bg-slate-100 text-slate-600" },
    in_progress: { label: t("dashboard.status.inProgress"), badge: "bg-emerald-100 text-emerald-700" },
    sent: { label: t("dashboard.filter.sent"), badge: "bg-blue-100 text-blue-700" },
    paid: { label: t("dashboard.filter.paid"), badge: "bg-amber-100 text-amber-700" }
  };
  return map[status] || map.draft;
}

function getProjectLabel(item) {
  if ((item.dailyWh || 0) >= 5000) return t("dashboard.project.solarCold");
  if ((item.dailyWh || 0) >= 2500) return t("dashboard.project.resort");
  return t("dashboard.project.home");
}

function getStatusOptions(currentStatus) {
  return ["draft", "in_progress", "sent", "paid"].map((status) => `
    <option value="${status}" ${status === currentStatus ? "selected" : ""}>${getStatusMeta(status).label}</option>
  `).join("");
}

function renderSummary(items) {
  const totalSales = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const activeQuotes = items.filter((item) => item.status !== "paid").length;
  const paidThisWeek = items
    .filter((item) => item.status === "paid" && Date.now() - new Date(item.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000)
    .reduce((sum, item) => sum + (item.total || 0), 0);
  const progress = totalSales ? Math.min(100, Math.round((paidThisWeek / totalSales) * 100)) : 0;

  document.getElementById("sales-balance").textContent = numberFormatter.format(totalSales);
  document.getElementById("sales-balance-trend").textContent = `${activeQuotes ? "+" : ""}${Math.min(99, activeQuotes * 4)}%`;
  document.getElementById("active-quotes-count").textContent = numberFormatter.format(activeQuotes);
  document.getElementById("active-quotes-line").textContent = `${t("dashboard.kpi.activeQuotes")}: ${numberFormatter.format(items.length)}`;
  document.getElementById("paid-this-week").textContent = numberFormatter.format(paidThisWeek);
  document.getElementById("paid-progress-bar").style.width = `${progress}%`;
  document.getElementById("paid-progress-line").textContent = t("dashboard.progressLine", { value: progress });
  document.getElementById("dashboard-total-badge").textContent = `${items.length} Total`;

  const latest = items[0]?.createdAt ? new Date(items[0].createdAt).toLocaleString() : t("status.checking");
  document.getElementById("sales-updated-line").textContent = `${t("dashboard.lastUpdated")}: ${latest}`;
}

function applyFilters() {
  const search = document.getElementById("dashboard-search")?.value.trim().toLowerCase() || "";
  const statusFilter = document.getElementById("dashboard-status-filter")?.value || "all";
  state.filteredItems = state.items.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const haystack = [item.customerName, item.customerEmail, item.packageName, item.location].join(" ").toLowerCase();
    const matchesSearch = !search || haystack.includes(search);
    return matchesStatus && matchesSearch;
  });
  renderSummary(state.filteredItems);
  renderTable();
  const visibleIds = new Set(state.filteredItems.map((item) => item.id));
  renderInstallmentRecords(state.installmentItems.filter((item) => visibleIds.has(item.id)));
}

function renderTable() {
  const tbody = document.getElementById("dashboard-table-body");
  tbody.innerHTML = "";

  const visibleItems = state.showAll ? state.filteredItems : state.filteredItems.slice(0, 6);
  document.getElementById("dashboard-view-all").textContent = state.showAll ? t("dashboard.viewLess") : t("dashboard.viewAll");

  if (!visibleItems.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-8 py-8 text-center text-slate-400">${t("empty.savedPlans")}</td>
      </tr>
    `;
    return;
  }

  visibleItems.forEach((item) => {
    const meta = getStatusMeta(item.status);
    const row = document.createElement("tr");
    row.className = "bg-white";
    row.innerHTML = `
      <td class="pl-8 py-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-slate-100 text-primary font-bold flex items-center justify-center">${item.customerName.slice(0, 2).toUpperCase()}</div>
          <div>
            <p class="font-bold text-primary">${item.customerName}</p>
            <p class="text-xs text-slate-500">${item.customerEmail}</p>
          </div>
        </div>
      </td>
      <td class="py-3"><span class="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">${getProjectLabel(item)}</span></td>
      <td class="py-3 text-sm text-slate-500">${new Date(item.createdAt).toLocaleDateString()}</td>
      <td class="py-3 font-bold text-primary">${numberFormatter.format(item.total)}</td>
      <td class="py-3">
        <div class="flex items-center gap-2">
          <span class="rounded-full px-3 py-1 text-xs font-bold ${meta.badge}">${meta.label}</span>
          <select class="dashboard-status-select rounded-lg bg-surface-container-low px-2 py-1 text-xs font-bold text-primary" data-id="${item.id}">
            ${getStatusOptions(item.status)}
          </select>
        </div>
      </td>
      <td class="py-3 pr-8">
        <div class="flex items-center justify-end gap-2">
          <button class="dashboard-preview rounded-full bg-primary px-3 py-2 text-xs font-bold text-white" data-id="${item.id}">${t("action.preview")}</button>
          <button class="dashboard-print rounded-full bg-surface-container-low px-3 py-2 text-xs font-bold text-primary" data-id="${item.id}">${t("action.print")}</button>
        </div>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderInstallmentRecords(items) {
  const tbody = document.getElementById("dashboard-installment-body");
  if (!tbody) return;
  const rows = items.filter((item) => item.installmentPlan?.enabled);
  if (!rows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-8 py-8 text-center text-slate-400">暂无分期付款记录</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = rows.map((item) => {
    const plan = item.installmentPlan || {};
    const scheduleText = Array.isArray(plan.installments)
      ? plan.installments.map((entry) => `${entry.label} ${money(entry.amount)} / ${entry.dueDate || "-"}`).join("<br />")
      : "-";
    return `
      <tr class="border-b border-slate-100 align-top">
        <td class="px-8 py-4 font-semibold text-primary">${item.customerName}</td>
        <td class="px-4 py-4">${item.packageName}</td>
        <td class="px-4 py-4 font-bold text-primary">${money(plan.downPayment || 0)}</td>
        <td class="px-4 py-4 text-slate-500">${plan.depositDate || "-"}</td>
        <td class="px-4 py-4 text-slate-500">${plan.cycleLabel || "-"}</td>
        <td class="px-4 py-4 text-xs leading-6 text-slate-600">
          ${scheduleText}
          <div class="mt-3 flex flex-wrap gap-2">
            ${item.customerId ? `<a class="inline-flex items-center rounded-full bg-surface-container-low px-3 py-1 font-bold text-primary" href="/customer.html?id=${item.customerId}">客户档案</a>` : ""}
            <a class="inline-flex items-center rounded-full bg-primary px-3 py-1 font-bold text-white" href="/installment.html">分期管理</a>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function buildPreviewHtml(item) {
  const payload = item.payload || {};
  const customerName = item.customerName || "-";
  const phone = item.customerPhone || "-";
  const email = item.customerEmail || "-";
  const address = item.customerAddress || "-";
  const recommendation = payload.recommendation || {};
  const metrics = payload.metrics || {};
  const quote = payload.quote || {};
  const installment = item.installmentPlan || payload.installmentPlan || {};
  const invoiceNo = `INV-${String(item.id || Date.now()).slice(-8)}`;
  const issueDate = new Date(item.createdAt || Date.now()).toISOString().slice(0, 10);
  const rows = [
    {
      description: item.packageName || recommendation.packageName || "-",
      details: [recommendation.solarPanels, recommendation.battery, recommendation.inverter].filter(Boolean).join(" / "),
      amount: Number(quote.equipmentPrice || item.total || 0)
    },
    Number(quote.installFee || 0) > 0 ? {
      description: t("quote.install"),
      details: "安装服务",
      amount: Number(quote.installFee || 0)
    } : null,
    Number(quote.logisticsFee || 0) > 0 ? {
      description: t("quote.logistics"),
      details: item.location || payload.location || "-",
      amount: Number(quote.logisticsFee || 0)
    } : null
  ].filter(Boolean).map((entry, index) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${index + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;">
        <div style="font-weight:700;color:#0f172a;">${entry.description}</div>
        <div style="margin-top:4px;font-size:12px;color:#64748b;">${entry.details || "-"}</div>
      </td>
      <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;font-weight:700;">${money(entry.amount)}</td>
    </tr>
  `).join("");

  const installmentCycleLabelEnglish = (plan = {}) => {
    const type = String(plan.planType || "");
    const termCount = Number(plan.termCount || plan.termWeeks || 0);
    const cycleMap = {
      weekly: "1 week per payment",
      biweekly: "2 weeks per payment",
      monthly: "1 month per payment"
    };
    if (type && cycleMap[type]) return `${cycleMap[type]} / ${termCount || 0} terms`;
    const fallback = String(plan.cycleLabel || "");
    if (!fallback) return "Full Payment";
    if (fallback.toLowerCase().includes("full")) return "Full Payment";
    return `${fallback} / ${termCount || 0} terms`;
  };
  const installmentItemLabelEnglish = (entry = {}, index = 0) => `Installment ${Number(entry.index || index + 1)}`;
  return `
    <div style="font-family:Inter,sans-serif;color:#0f172a;background:#ffffff;padding:14px 16px;max-width:186mm;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:20px;border-bottom:3px solid #001d44;">
        <div>
          <div style="font-family:Manrope,sans-serif;font-size:34px;font-weight:800;letter-spacing:0.08em;color:#001d44;">INVOICE</div>
          <div style="margin-top:8px;font-size:13px;color:#64748b;">Professional Sales Invoice</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:Manrope,sans-serif;font-size:26px;font-weight:800;color:#001d44;">${t("app.name")}</div>
          <div style="margin-top:8px;font-size:13px;color:#475569;">${t("app.subtitle")}</div>
          <div style="margin-top:10px;font-size:12px;color:#64748b;">Invoice No: ${invoiceNo}</div>
          <div style="margin-top:4px;font-size:12px;color:#64748b;">Invoice Date: ${issueDate}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:0.66fr 1.34fr;gap:18px;margin-top:22px;">
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:#f8fafc;">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">客户信息</div>
          <div style="margin-top:10px;font-size:22px;font-weight:800;color:#0f172a;">${customerName}</div>
          <div style="margin-top:8px;font-size:13px;color:#475569;">${phone}</div>
          <div style="margin-top:4px;font-size:13px;color:#475569;">${email}</div>
          <div style="margin-top:4px;font-size:13px;color:#475569;">${address}</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:#ffffff;">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">银行信息</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px 16px;margin-top:10px;font-size:13px;">
            <span style="color:#64748b;">销售人员</span><strong>${item.salesPersonName || "-"}</strong>
            <span style="color:#64748b;">套装功率</span><strong>${numberFormatter.format(recommendation.loadCapacityW || 0)} W</strong>
            <span style="color:#64748b;">所需功率</span><strong>${numberFormatter.format(metrics.peakPower || 0)} W</strong>
            <span style="color:#64748b;">发票编号</span><strong>${invoiceNo}</strong>
          </div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:24px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">#</th>
            <th style="text-align:left;padding:8px;border-bottom:2px solid #333;">项目说明</th>
            <th style="text-align:right;padding:8px;border-bottom:2px solid #333;">金额</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:18px;margin-top:24px;">
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:16px;">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">INSTALLMENT DETAILS</div>
          ${installment.enabled ? `
            <div style="margin-top:10px;font-size:13px;color:#475569;">Deposit: ${money(installment.downPayment || 0)} | Date: ${installment.depositDate || "-"}</div>
            <div style="margin-top:6px;font-size:13px;color:#475569;">Cycle: ${installment.cycleLabel || "-"} | Standard: ${money(installment.weeklyAmount || 0)}</div>
            <div style="margin-top:10px;">
              ${(Array.isArray(installment.installments) ? installment.installments : []).map((entry) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:13px;border-bottom:1px dashed #dbe4f0;"><span>${entry.label} / ${entry.dueDate || "-"}</span><strong>${money(entry.amount || 0)}</strong></div>`).join("")}
            </div>
          ` : `<div style="margin-top:10px;font-size:13px;color:#64748b;">未启用分期付款</div>`}
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:#f8fafc;">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">TOTAL SUMMARY</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px 16px;margin-top:12px;font-size:14px;">
            <span style="color:#64748b;">${t("quote.equipment")}</span><strong>${money(quote.equipmentPrice || 0)}</strong>
            <span style="color:#64748b;">${t("quote.install")}</span><strong>${money(quote.installFee || 0)}</strong>
            <span style="color:#64748b;">${t("quote.logistics")}</span><strong>${money(quote.logisticsFee || 0)}</strong>
            <span style="font-family:Manrope,sans-serif;font-size:18px;font-weight:800;color:#001d44;">TOTAL DUE</span><strong style="font-family:Manrope,sans-serif;font-size:22px;color:#001d44;">${money(item.total)}</strong>
          </div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:24px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <tbody>
          <tr>
            <td style="width:50%;padding:18px;border-right:1px solid #e2e8f0;">
              <div style="font-size:12px;color:#64748b;">Sales Signature</div>
              <div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div>
            </td>
            <td style="width:50%;padding:18px;">
              <div style="font-size:12px;color:#64748b;">Customer Signature</div>
              <div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function openPreview(itemId) {
  const item = state.items.find((quote) => quote.id === itemId);
  if (!item) return;
  state.previewItem = item;
  document.getElementById("dashboard-preview-content").innerHTML = buildPreviewHtml(item);
  document.getElementById("dashboard-preview-modal").classList.remove("hidden");
  document.getElementById("dashboard-preview-modal").classList.add("flex");
}

function closePreview() {
  state.previewItem = null;
  document.getElementById("dashboard-preview-modal").classList.add("hidden");
  document.getElementById("dashboard-preview-modal").classList.remove("flex");
}

function printPreview(itemId = state.previewItem?.id) {
  const item = state.items.find((quote) => quote.id === itemId);
  if (!item) return;
  const printable = document.getElementById("printable-dashboard-quote");
  printable.innerHTML = buildPreviewHtml(item);
  printable.classList.remove("hidden");
  window.print();
  printable.classList.add("hidden");
}

async function updateStatus(itemId, status) {
  const response = await fetch("/api/saved-quotes/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: itemId, status })
  });
  const data = await response.json();
  if (!data.ok) {
    renderMessage(t("status.error"), false);
    return;
  }
  await loadDashboard();
  renderMessage(t("dashboard.statusSaved"), true);
}

function exportCsv() {
  const header = ["Customer", "Email", "Package", "Location", "DailyWh", "Total", "Status", "CreatedAt"];
  const rows = state.filteredItems.map((item) => [
    item.customerName,
    item.customerEmail,
    item.packageName,
    item.location,
    item.dailyWh,
    item.total,
    item.status,
    item.createdAt
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dashboard-report.csv";
  link.click();
  URL.revokeObjectURL(url);
  renderMessage(t("dashboard.exported"), true);
}

async function loadDashboard() {
  const response = await fetch("/api/dashboard");
  const data = await response.json();
  state.items = (data.items || []).map(normalizeQuote);
  state.installmentItems = Array.isArray(data.installmentRecords) ? data.installmentRecords : [];
  applyFilters();
}

function bindEvents() {
  document.getElementById("dashboard-search").addEventListener("input", applyFilters);
  document.getElementById("dashboard-status-filter").addEventListener("change", applyFilters);
  document.getElementById("dashboard-refresh-button").addEventListener("click", loadDashboard);
  document.getElementById("dashboard-export-button").addEventListener("click", exportCsv);
  document.getElementById("dashboard-view-all").addEventListener("click", () => {
    state.showAll = !state.showAll;
    renderTable();
  });
  document.getElementById("dashboard-close-preview").addEventListener("click", closePreview);
  document.getElementById("dashboard-print-preview").addEventListener("click", () => printPreview());

  document.getElementById("dashboard-table-body").addEventListener("click", (event) => {
    const previewButton = event.target.closest(".dashboard-preview");
    if (previewButton) openPreview(previewButton.dataset.id);
    const printButton = event.target.closest(".dashboard-print");
    if (printButton) printPreview(printButton.dataset.id);
  });

  document.getElementById("dashboard-table-body").addEventListener("change", (event) => {
    const select = event.target.closest(".dashboard-status-select");
    if (select) updateStatus(select.dataset.id, select.value);
  });
}

async function init() {
  await loadTranslations(state.locale);
  applyTranslations();
  bindEvents();
  const health = await fetch("/api/health");
  setHealth(health.ok);
  await loadDashboard();
}

init().catch((error) => {
  console.error(error);
  setHealth(false);
  renderMessage(t("status.error"), false);
});

function buildPreviewHtml(item) {
  const payload = item.payload || {};
  const customerName = item.customerName || "-";
  const phone = item.customerPhone || "-";
  const email = item.customerEmail || "-";
  const address = item.customerAddress || "-";
  const recommendation = payload.recommendation || {};
  const metrics = payload.metrics || {};
  const quote = payload.quote || {};
  const installment = item.installmentPlan || payload.installmentPlan || {};
  const invoiceNo = `INV-${String(item.id || Date.now()).slice(-8)}`;
  const issueDate = new Date(item.createdAt || Date.now()).toISOString().slice(0, 10);
  const rows = [
    { description: item.packageName || recommendation.packageName || "-", details: [recommendation.solarPanels, recommendation.battery, recommendation.inverter].filter(Boolean).join(" / "), amount: Number(quote.equipmentPrice || item.total || 0) },
    Number(quote.installFee || 0) > 0 ? { description: "Installation", details: "Installation Service", amount: Number(quote.installFee || 0) } : null,
    Number(quote.logisticsFee || 0) > 0 ? { description: "Logistics", details: item.location || payload.location || "-", amount: Number(quote.logisticsFee || 0) } : null
  ].filter(Boolean).map((entry, index) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #ddd;">${index + 1}</td>
      <td style="padding:8px;border-bottom:1px solid #ddd;">
        <div style="font-weight:700;color:#0f172a;">${entry.description}</div>
        <div style="margin-top:4px;font-size:12px;color:#64748b;">${entry.details || "-"}</div>
      </td>
      <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right;font-weight:700;">${money(entry.amount)}</td>
    </tr>
  `).join("");
  return `
    <div style="font-family:Inter,sans-serif;color:#0f172a;background:#ffffff;padding:14px 16px;max-width:186mm;margin:0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:20px;border-bottom:3px solid #001d44;">
        <div>
          <div style="font-family:Manrope,sans-serif;font-size:34px;font-weight:800;letter-spacing:0.08em;color:#001d44;">INVOICE</div>
          <div style="margin-top:8px;font-size:13px;color:#64748b;">Commercial Invoice</div>
        </div>
        <div style="text-align:right;">
          <div style="font-family:Manrope,sans-serif;font-size:26px;font-weight:800;color:#001d44;">Solar Sales System</div>
          <div style="margin-top:10px;font-size:12px;color:#64748b;">Invoice No: ${invoiceNo}</div>
          <div style="margin-top:4px;font-size:12px;color:#64748b;">Issue Date: ${issueDate}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:0.66fr 1.34fr;gap:18px;margin-top:22px;">
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:#f8fafc;">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">BILL TO</div>
          <div style="margin-top:10px;font-size:22px;font-weight:800;color:#0f172a;">${customerName}</div>
          <div style="margin-top:8px;font-size:13px;color:#475569;">${phone}</div>
          <div style="margin-top:4px;font-size:13px;color:#475569;">${email}</div>
          <div style="margin-top:4px;font-size:13px;color:#475569;">${address}</div>
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:#ffffff;">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">COMMERCIAL DETAILS</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px 16px;margin-top:10px;font-size:13px;">
            <span style="color:#64748b;">Package Load</span><strong>${numberFormatter.format(recommendation.loadCapacityW || 0)} W</strong>
            <span style="color:#64748b;">Required Load</span><strong>${numberFormatter.format(metrics.peakPower || 0)} W</strong>
            <span style="color:#64748b;">Invoice No</span><strong>${invoiceNo}</strong>
          </div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:24px;">
        <thead><tr><th style="text-align:left;padding:8px;border-bottom:2px solid #333;">#</th><th style="text-align:left;padding:8px;border-bottom:2px solid #333;">Description</th><th style="text-align:right;padding:8px;border-bottom:2px solid #333;">Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="display:grid;grid-template-columns:1.1fr 0.9fr;gap:18px;margin-top:24px;">
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:16px;">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">INSTALLMENT PLAN</div>
          ${installment.enabled ? `<div style="margin-top:10px;font-size:13px;color:#475569;">Deposit: ${money(installment.downPayment || 0)} | Date: ${installment.depositDate || "-"}</div><div style="margin-top:6px;font-size:13px;color:#475569;">Cycle: ${installmentCycleLabelEnglish(installment)} | Standard: ${money(installment.weeklyAmount || 0)}</div><div style="margin-top:10px;">${(Array.isArray(installment.installments) ? installment.installments : []).map((entry, index) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:13px;border-bottom:1px dashed #dbe4f0;"><span>${installmentItemLabelEnglish(entry, index)} / ${entry.dueDate || "-"}</span><strong>${money(entry.amount || 0)}</strong></div>`).join("")}</div>` : `<div style="margin-top:10px;font-size:13px;color:#64748b;">Installment payment is not enabled.</div>`}
        </div>
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:#f8fafc;">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">PAYMENT SUMMARY</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px 16px;margin-top:12px;font-size:14px;">
            <span style="color:#64748b;">Equipment</span><strong>${money(quote.equipmentPrice || 0)}</strong>
            <span style="color:#64748b;">Installation</span><strong>${money(quote.installFee || 0)}</strong>
            <span style="color:#64748b;">Logistics</span><strong>${money(quote.logisticsFee || 0)}</strong>
            <span style="color:#64748b;">Included Tax</span><strong>${money(includedTaxAmount(quote))}</strong>
            <span style="font-family:Manrope,sans-serif;font-size:18px;font-weight:800;color:#001d44;">TOTAL DUE</span><strong style="font-family:Manrope,sans-serif;font-size:22px;color:#001d44;">${money(item.total)}</strong>
          </div>
          <div style="margin-top:8px;font-size:12px;font-weight:700;color:#001d44;text-align:right;">Tax Inclusive</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:24px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <tbody><tr><td style="width:50%;padding:18px;border-right:1px solid #e2e8f0;"><div style="font-size:12px;color:#64748b;">Sales Signature</div><div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div></td><td style="width:50%;padding:18px;"><div style="font-size:12px;color:#64748b;">Customer Signature</div><div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div></td></tr></tbody>
      </table>
    </div>
  `;
}
