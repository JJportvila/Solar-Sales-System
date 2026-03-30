const state = {
  categories: [],
  presets: [],
  salesPeople: [],
  selectedSalesPersonId: "",
  latestResult: null,
  previewResult: null,
  previewDocType: "quotation",
  selectedPackageName: "",
  activeCategoryKey: "",
  rawCalculationResult: null,
  installmentPlanType: "none",
  installmentTermCount: 6,
  installmentDeposit: 0,
  installmentDepositDate: new Date().toISOString().slice(0, 10),
  installmentPaymentDates: {},
  includeInstallFee: true,
  includeLogisticsFee: true,
  customInstallFee: null,
  customLogisticsFee: null,
  feeSignature: "",
  locale: localStorage.getItem("smart_sizing_locale") || "zh-CN",
  translations: {},
  customer: { name: "", phone: "", email: "", address: "" },
  calculatorExpression: "",
  settings: {
    audToVuv: 80,
    nzdToVuv: 72,
    vatRate: 15,
    quoteDisplayMode: "tax_inclusive",
    company: {
      name: "Solar Sales System",
      tin: "",
      bankName: "",
      bankAccountName: "",
      bankAccountNumber: "",
      address: "",
      phone: "",
      email: "",
      logoUrl: ""
    }
  }
};

const defaultDevices = [
  { applianceKey: "led_bulb", power: 10, hours: 6, quantity: 4 },
  { applianceKey: "fridge", power: 150, hours: 24, quantity: 1 },
  { applianceKey: "fan", power: 45, hours: 8, quantity: 2 },
  { applianceKey: "tv", power: 120, hours: 5, quantity: 1 }
];

const numberFormatter = new Intl.NumberFormat("en-US");

function money(value) {
  return `VT ${numberFormatter.format(value || 0)}`;
}

function getCompanyProfile(result = null) {
  const localCompany = JSON.parse(localStorage.getItem("smart_sizing_company_profile") || "{}");
  const source = result?.settings?.company || localCompany || state.settings.company || {};
  return {
    name: source.name || "Solar Sales System",
    tin: source.tin || "",
    bankName: source.bankName || "",
    bankAccountName: source.bankAccountName || "",
    bankAccountNumber: source.bankAccountNumber || "",
    address: source.address || "",
    phone: source.phone || "",
    email: source.email || "",
    logoUrl: source.logoUrl || ""
  };
}

function ceilToThousand(value) {
  return Math.ceil(Math.max(0, Number(value || 0)) / 1000) * 1000;
}

function shiftDate(dateString, planType, count) {
  const base = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  if (planType === "weekly") {
    base.setDate(base.getDate() + (7 * count));
  } else if (planType === "biweekly") {
    base.setDate(base.getDate() + (14 * count));
  } else if (planType === "monthly") {
    base.setMonth(base.getMonth() + count);
  }
  return base.toISOString().slice(0, 10);
}

function getInstallmentPlan(total = 0) {
  const planType = String(state.installmentPlanType || "none");
  const normalizedTotal = Math.max(0, Number(total || 0));
  const deposit = Math.min(Math.max(0, Math.round(Number(state.installmentDeposit || 0))), normalizedTotal);
  const depositDate = state.installmentDepositDate || new Date().toISOString().slice(0, 10);
  const cycleMap = {
    weekly: { label: "1星期一期", nextDue: "1周后" },
    biweekly: { label: "2星期一期", nextDue: "2周后" },
    monthly: { label: "1个月一期", nextDue: "1个月后" }
  };
  const cycle = cycleMap[planType];

  if (!cycle) {
    return {
      enabled: false,
      termWeeks: 0,
      termCount: 0,
      downPayment: 0,
      financedAmount: 0,
      weeklyAmount: 0,
      installments: [],
      cycleLabel: "全额付款",
      nextDueLabel: "-",
      depositDate
    };
  }

  const termCount = [3, 6].includes(Number(state.installmentTermCount)) ? Number(state.installmentTermCount) : 6;
  const downPayment = deposit;
  const financedAmount = Math.max(0, normalizedTotal - downPayment);
  const roundedAmount = ceilToThousand(financedAmount / termCount);
  const installments = [];
  let remaining = financedAmount;

  for (let index = 0; index < termCount; index += 1) {
    const isLast = index === termCount - 1;
    const amount = isLast ? remaining : Math.min(remaining, roundedAmount);
    remaining = Math.max(0, remaining - amount);
    installments.push({
      index: index + 1,
      label: `第${index + 1}期`,
      amount,
      dueDate: state.installmentPaymentDates[index + 1] || shiftDate(depositDate, planType, index + 1)
    });
  }

  return {
    enabled: true,
    termWeeks: termCount,
    termCount,
    downPayment,
    financedAmount,
    weeklyAmount: installments[0]?.amount || 0,
    installments,
    cycleLabel: `${cycle.label} / 共${termCount}期`,
    nextDueLabel: cycle.nextDue,
    depositDate
  };
}

function installmentCycleLabelEnglish(plan = {}) {
  const type = String(plan.planType || state.installmentPlanType || "");
  const termCount = Number(plan.termCount || plan.termWeeks || 0);
  const cycleMap = {
    weekly: "1 week per payment",
    biweekly: "2 weeks per payment",
    monthly: "1 month per payment"
  };
  if (!type || !cycleMap[type]) return "Full Payment";
  return `${cycleMap[type]} / ${termCount || 0} terms`;
}

function installmentItemLabelEnglish(entry = {}, index = 0) {
  const seq = Number(entry.index || index + 1);
  return `Installment ${seq}`;
}

function includedTaxAmount(quote = {}) {
  const storedVat = Number(quote.vat || 0);
  if (storedVat > 0) return storedVat;
  const total = Math.max(0, Number(quote.displayTotal || quote.total || quote.totalInclTax || 0));
  const vatRate = Math.max(0, Number(quote.vatRate ?? state.settings.vatRate ?? 15));
  if (!total || vatRate <= 0) return 0;
  const divisor = 1 + vatRate / 100;
  const net = Math.round(total / divisor);
  return Math.max(0, total - net);
}

function interpolate(template, params = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function t(key, params = {}) {
  return interpolate(state.translations[key] ?? key, params);
}

function relocateInstallmentControls() {
  const summary = document.getElementById("installment-summary");
  const title = document.getElementById("installment-title");
  if (!summary || !title) return;

  const controlsCard = summary.parentElement;
  const titleRow = title.parentElement;
  const planCard = titleRow?.parentElement;
  if (!controlsCard || !titleRow || !planCard || controlsCard.parentElement === planCard) return;

  controlsCard.classList.add("mb-4");
  planCard.insertBefore(controlsCard, titleRow);
}

function getEffectiveResult(result) {
  if (!result) return result;
  const sourceQuote = result.quote || {};
  const equipmentPrice = Math.max(0, Number(sourceQuote.equipmentPrice || 0));
  const baseInstallFee = Math.max(0, Number(sourceQuote.installFee || 0));
  const baseLogisticsFee = Math.max(0, Number(sourceQuote.logisticsFee || 0));
  const installFeeValue = state.customInstallFee == null ? baseInstallFee : Math.max(0, Number(state.customInstallFee || 0));
  const logisticsFeeValue = state.customLogisticsFee == null ? baseLogisticsFee : Math.max(0, Number(state.customLogisticsFee || 0));
  const installFee = state.includeInstallFee ? installFeeValue : 0;
  const logisticsFee = state.includeLogisticsFee ? logisticsFeeValue : 0;
  const totalInclTax = equipmentPrice + installFee + logisticsFee;
  const configuredVatRate = Math.max(0, Number(sourceQuote.vatRate ?? state.settings.vatRate ?? 15));
  const divisor = configuredVatRate > 0 ? 1 + configuredVatRate / 100 : 1;
  const subtotalExclTax = divisor > 1 ? Math.round(totalInclTax / divisor) : totalInclTax;
  const vat = Math.max(0, totalInclTax - subtotalExclTax);
  const vatRate = configuredVatRate;
  const displayMode = "tax_inclusive";
  const displayTotal = totalInclTax;

  return {
    ...result,
    quote: {
      ...sourceQuote,
      equipmentPrice,
      installFee,
      logisticsFee,
      subtotalExclTax,
      vatRate,
      vat,
      totalInclTax,
      displayMode,
      displayTotal,
      total: displayTotal
    }
  };
}

async function loadTranslations(locale) {
  const response = await fetch(`/locales/${locale}.json`);
  state.translations = await response.json();
  state.locale = locale;
  localStorage.setItem("smart_sizing_locale", locale);
}

function applyTranslations() {
  document.documentElement.lang = state.locale;
  document.title = t("meta.title");
  document.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
  document.querySelectorAll("[data-i18n-attr]").forEach((node) => {
    const [attr, key] = node.dataset.i18nAttr.split(":");
    node.setAttribute(attr, t(key));
  });
  const languageSelect = document.getElementById("language-select");
  if (languageSelect) languageSelect.value = state.locale;
  syncCustomerSummary();
  renderPresetCategories();
  renderInstallment(state.latestResult?.quote?.displayTotal || 0);
  if (state.latestResult) renderCalculation(state.latestResult);
}

function setHealth(ok) {
  const dot = document.getElementById("health-dot");
  const text = document.getElementById("health-text");
  dot.className = `inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`;
  text.textContent = ok ? t("status.online") : t("status.error");
}

function fillSettings(settings) {
  state.settings = { ...state.settings, ...(settings || {}) };
  const audRateLine = document.getElementById("aud-rate-line");
  const nzdRateLine = document.getElementById("nzd-rate-line");
  const audRateInput = document.getElementById("aud-rate-input");
  const nzdRateInput = document.getElementById("nzd-rate-input");
  const quoteDisplayMode = document.getElementById("quote-display-mode");

  if (audRateLine) audRateLine.textContent = t("rates.aud", { value: state.settings.audToVuv });
  if (nzdRateLine) nzdRateLine.textContent = t("rates.nzd", { value: state.settings.nzdToVuv });
  if (audRateInput) audRateInput.value = state.settings.audToVuv;
  if (nzdRateInput) nzdRateInput.value = state.settings.nzdToVuv;
  if (quoteDisplayMode) quoteDisplayMode.value = "tax_inclusive";
}

function renderInstallment(total = 0) {
  const plan = getInstallmentPlan(total);
  const select = document.getElementById("installment-plan-select");
  if (select) select.value = state.installmentPlanType || "none";
  const termSelect = document.getElementById("installment-term-select");
  if (termSelect) termSelect.value = String(state.installmentTermCount || 6);
  const depositInput = document.getElementById("installment-deposit-input");
  if (depositInput) depositInput.value = state.installmentDeposit || 0;
  const depositDateInput = document.getElementById("installment-deposit-date-input");
  if (depositDateInput) depositDateInput.value = state.installmentDepositDate || new Date().toISOString().slice(0, 10);

  const summary = document.getElementById("installment-summary");
  const badge = document.getElementById("installment-badge");
  const downPayment = document.getElementById("installment-down-payment");
  const weekly = document.getElementById("installment-weekly");
  const balance = document.getElementById("installment-balance");
  const schedule = document.getElementById("installment-schedule");

  if (summary) {
    summary.textContent = plan.enabled
      ? `总额减定金后按 ${plan.termCount} 期计算，前 ${Math.max(plan.termCount - 1, 1)} 期按千位进位，最后 1 期收尾款。定金 ${money(plan.downPayment)}，余款 ${money(plan.financedAmount)}。`
      : "未启用分期付款";
  }
  if (badge) badge.textContent = plan.enabled ? `${plan.termCount}期` : "未启用";
  if (downPayment) downPayment.textContent = money(plan.downPayment);
  if (weekly) weekly.textContent = money(plan.weeklyAmount);
  if (balance) balance.textContent = money(plan.financedAmount);
  if (summary) {
    summary.textContent = plan.enabled
      ? `总额减定金后按 ${plan.termCount} 期计算，前 ${Math.max(plan.termCount - 1, 1)} 期按千位进位，最后 1 期收尾款。定金 ${money(plan.downPayment)}，余款 ${money(plan.financedAmount)}。`
      : "未启用分期付款";
  }
  if (badge) badge.textContent = plan.enabled ? `${plan.termCount}期` : "未启用";
  if (schedule) {
    schedule.innerHTML = plan.enabled
      ? plan.installments.map((item) => `
        <div class="rounded-xl bg-white px-4 py-3 text-sm">
          <div class="flex items-center justify-between gap-4">
            <span class="font-semibold text-slate-600">${item.label}</span>
            <span class="font-black text-primary">${money(item.amount)}</span>
          </div>
          <div class="mt-3 flex items-center gap-3">
            <div class="min-w-[60px] text-xs text-slate-500">支付日期</div>
            <input class="installment-date-input h-11 flex-1 rounded-xl bg-surface-container-low border-none px-4 text-sm font-bold text-primary focus:ring-0" data-index="${item.index}" type="date" value="${item.dueDate || ""}" />
          </div>
        </div>
      `).join("")
      : "";
    schedule.querySelectorAll(".installment-date-input").forEach((input) => {
      input.addEventListener("change", (event) => {
        state.installmentPaymentDates[Number(event.target.dataset.index)] = event.target.value || "";
      });
    });
  }
}

function syncCustomerSummary() {
  const summary = document.getElementById("customer-summary");
  if (!summary) return;
  summary.textContent = state.customer.name
    ? `${state.customer.name} / ${state.customer.phone || "-"} / ${state.customer.email || "-"}`
    : t("customer.empty");
}

function getSelectedSalesPerson() {
  return state.salesPeople.find((item) => item.id === state.selectedSalesPersonId) || null;
}

function renderSalesPeople() {
  const select = document.getElementById("sales-person-select");
  if (!select) return;
  const options = ['<option value="">请选择销售</option>']
    .concat(state.salesPeople.map((item) => `<option value="${item.id}">${item.name} / ${item.branch}</option>`));
  select.innerHTML = options.join("");
  select.value = state.selectedSalesPersonId || "";
}

async function loadSalesPeople() {
  const response = await fetch("/api/employees?role=sales");
  const result = await response.json();
  state.salesPeople = Array.isArray(result.items) ? result.items : [];
  if (!state.selectedSalesPersonId && state.salesPeople[0]) {
    state.selectedSalesPersonId = state.salesPeople[0].id;
  }
  renderSalesPeople();
}

function openCustomerModal() {
  document.getElementById("modal-customer-name").value = state.customer.name;
  document.getElementById("modal-customer-phone").value = state.customer.phone;
  document.getElementById("modal-customer-email").value = state.customer.email;
  document.getElementById("modal-customer-address").value = state.customer.address;
  document.getElementById("customer-modal").classList.remove("hidden");
  document.getElementById("customer-modal").classList.add("flex");
}

function closeCustomerModal() {
  document.getElementById("customer-modal").classList.add("hidden");
  document.getElementById("customer-modal").classList.remove("flex");
}

function saveCustomerFromModal() {
  state.customer = {
    name: document.getElementById("modal-customer-name").value.trim(),
    phone: document.getElementById("modal-customer-phone").value.trim(),
    email: document.getElementById("modal-customer-email").value.trim(),
    address: document.getElementById("modal-customer-address").value.trim()
  };
  syncCustomerSummary();
  closeCustomerModal();
  runCalculation();
}

function createDeviceRow(device = {}) {
  const template = document.getElementById("device-row-template");
  const row = template.content.firstElementChild.cloneNode(true);
  const resolvedName = device.applianceKey ? t(`appliance.${device.applianceKey}`) : (device.name || "");
  row.querySelector(".device-name").value = resolvedName;
  row.querySelector(".device-power").value = device.power ?? 0;
  row.querySelector(".device-hours").value = device.hours ?? 0;
  row.querySelector(".device-quantity").value = device.quantity ?? 0;
  row.querySelector(".device-name").placeholder = t("device.placeholder.name");

  row.querySelector(".quantity-minus").addEventListener("click", () => {
    const input = row.querySelector(".device-quantity");
    input.value = Math.max(0, Number(input.value || 0) - 1);
    runCalculation();
  });

  row.querySelector(".quantity-plus").addEventListener("click", () => {
    const input = row.querySelector(".device-quantity");
    input.value = Number(input.value || 0) + 1;
    runCalculation();
  });

  row.querySelectorAll("input").forEach((input) => input.addEventListener("input", runCalculation));
  row.querySelector(".remove-device").addEventListener("click", () => {
    row.remove();
    runCalculation();
  });
  return row;
}

function addBlankRow() {
  document.getElementById("device-list").appendChild(createDeviceRow({ name: "", power: 0, hours: 0, quantity: 0 }));
}

function getDevices() {
  return [...document.querySelectorAll(".device-row")].map((row) => ({
    name: row.querySelector(".device-name").value.trim(),
    power: Number(row.querySelector(".device-power").value || 0),
    hours: Number(row.querySelector(".device-hours").value || 0),
    quantity: Number(row.querySelector(".device-quantity").value || 0)
  }));
}

function renderPresetCategories() {
  const container = document.getElementById("preset-categories");
  if (!container) return;
  container.innerHTML = "";
  container.className = "space-y-3";
  if (!state.categories.length) return;
  if (!state.categories.some((category) => category.key === state.activeCategoryKey)) {
    state.activeCategoryKey = state.categories[0].key;
  }

  const categoryBar = document.createElement("div");
  categoryBar.className = "flex flex-wrap gap-2";

  const activeCategory = state.categories.find((category) => category.key === state.activeCategoryKey) || state.categories[0];

  state.categories.forEach((category) => {
    const isActive = category.key === activeCategory.key;
    const categoryButton = document.createElement("button");
    categoryButton.type = "button";
    categoryButton.className = `rounded-full px-4 py-2 text-sm font-bold transition-colors ${isActive ? "bg-primary text-white" : "bg-white text-primary border border-slate-200 hover:border-primary/30 hover:bg-surface-container-low"}`;
    categoryButton.textContent = t(`category.${category.key}`);
    categoryButton.addEventListener("click", () => {
      state.activeCategoryKey = category.key;
      renderPresetCategories();
    });
    categoryBar.appendChild(categoryButton);
  });

  const panel = document.createElement("div");
  panel.className = "rounded-2xl bg-white p-4 shadow-sm border border-slate-100";

  const title = document.createElement("p");
  title.className = "text-xs font-bold text-outline mb-3 uppercase";
  title.textContent = t(`category.${activeCategory.key}`);

  const buttons = document.createElement("div");
  buttons.className = "flex flex-wrap gap-2 content-start";

  activeCategory.items.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rounded-full bg-surface-container-low px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary hover:text-white transition-colors";
    button.textContent = t(`appliance.${item.key}`);
    button.addEventListener("click", () => {
      document.getElementById("device-list").appendChild(createDeviceRow({ name: t(`appliance.${item.key}`), power: item.power, hours: item.hours, quantity: item.quantity }));
      runCalculation();
    });
    buttons.appendChild(button);
  });

  panel.appendChild(title);
  panel.appendChild(buttons);
  container.appendChild(categoryBar);
  container.appendChild(panel);
}

function renderPackages(packages, requiredLoad) {
  const list = document.getElementById("package-list");
  list.innerHTML = "";
  packages.forEach((pkg) => {
    const selected = pkg.packageName === state.selectedPackageName;
    const disabled = !pkg.compatible;
    const item = document.createElement("button");
    item.type = "button";
    item.disabled = disabled;
    item.className = `w-full rounded-2xl border p-4 text-left ${selected ? "border-primary bg-primary/5" : "border-slate-200 bg-white"} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`;
    item.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="font-black text-primary">${pkg.packageName}</p>
          <p class="mt-1 text-sm text-slate-500">${pkg.inverter}</p>
          <p class="mt-1 text-xs text-slate-400">${t("package.matchInfo", { required: numberFormatter.format(requiredLoad), supported: numberFormatter.format(pkg.loadCapacityW) })}</p>
        </div>
        <div class="text-right">
          <p class="text-sm font-bold ${disabled ? "text-red-600" : "text-secondary"}">${disabled ? t("package.insufficient") : t("package.compatible")}</p>
          <p class="mt-1 font-black text-primary">${money(pkg.estimatedPrice)}</p>
        </div>
      </div>
    `;
    if (!disabled) {
      item.addEventListener("click", () => {
        state.selectedPackageName = pkg.packageName;
        runCalculation();
      });
    }
    list.appendChild(item);
  });
}

function getDocumentStyle(docType) {
  if (docType === "invoice") {
    return {
      title: "INVOICE",
      subtitle: "正式销售发票",
      codeLabel: "发票编号",
      accent: "#001d44",
      light: "#f8fafc"
    };
  }
  if (docType === "inquiry") {
    return {
      title: "INQUIRY SHEET",
      subtitle: "客户询价单",
      codeLabel: "询价单号",
      accent: "#7f5700",
      light: "#fff7e6"
    };
  }
  return {
    title: "QUOTATION",
    subtitle: "正式销售报价单",
    codeLabel: "报价单号",
    accent: "#0f766e",
    light: "#ecfeff"
  };
}

function buildPrintableHtml(result, docType = "invoice") {
  const customer = result.customer || {};
  const metrics = result.metrics || {};
  const recommendation = result.recommendation || {};
  const quote = result.quote || {};
  const installment = result.installmentPlan || getInstallmentPlan(quote.displayTotal || quote.total || 0);
  const company = getCompanyProfile(result);
  const style = getDocumentStyle(docType);
  const invoiceNo = `${style.title === "INVOICE" ? "INV" : style.title === "INQUIRY SHEET" ? "INQ" : "QTN"}-${String(result.id || Date.now()).slice(-8)}`;
  const issueDate = new Date(result.createdAt || Date.now()).toISOString().slice(0, 10);
  const subtotal = Number(quote.subtotalExclTax || 0);
  const grandTotal = Number(quote.displayTotal || quote.total || 0);
  const invoiceRows = [
    {
      description: recommendation.packageName || result.packageName || "Solar Package",
      details: [recommendation.solarPanels, recommendation.battery, recommendation.inverter].filter(Boolean).join(" / "),
      qty: 1,
      amount: Number(quote.equipmentPrice || 0)
    },
    {
      description: t("quote.install"),
      details: "瀹夎鏈嶅姟",
      qty: 1,
      amount: Number(quote.installFee || 0)
    },
    {
      description: t("quote.logistics"),
      details: result.location || "鐡﹀姫闃垮浘",
      qty: 1,
      amount: Number(quote.logisticsFee || 0)
    }
  ].filter((item) => item.amount > 0);
  const invoiceRowsHtml = invoiceRows.map((item, index) => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">${index + 1}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">
        <div style="font-weight:700;color:#0f172a;">${item.description}</div>
        <div style="margin-top:4px;font-size:12px;color:#64748b;">${item.details || "-"}</div>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${item.qty}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${money(item.amount)}</td>
    </tr>
  `).join("");
  return `
    <div style="font-family:Inter,sans-serif;color:#0f172a;background:#ffffff;padding:14px 16px;max-width:186mm;margin:0 auto;">
      <div style="display:grid;grid-template-columns:0.66fr 1.34fr;gap:16px;padding-bottom:14px;border-bottom:3px solid ${style.accent};">
        <div>
          <div style="font-family:Manrope,sans-serif;font-size:28px;font-weight:800;letter-spacing:0.08em;color:${style.accent};">${style.title}</div>
          <div style="margin-top:4px;font-size:12px;color:#64748b;">${style.subtitle}</div>
          <div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:${style.light};">
            <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">瀹㈡埛淇℃伅</div>
            <div style="margin-top:8px;font-size:18px;font-weight:800;color:#0f172a;">${customer.name || result.customerName || "-"}</div>
            <div style="margin-top:4px;font-size:12px;color:#475569;">${customer.phone || "-"}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${customer.email || "-"}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${customer.address || "-"}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;align-items:flex-start;gap:${company.logoUrl ? "12px" : "0"};">
          ${company.logoUrl ? `<img alt="company logo" src="${company.logoUrl}" style="width:72px;height:72px;object-fit:contain;border-radius:14px;border:1px solid #e2e8f0;padding:8px;background:#fff;" />` : ""}
          <div style="text-align:right;">
            <div style="font-family:Manrope,sans-serif;font-size:23px;font-weight:800;color:${style.accent};">${company.name}</div>
            <div style="margin-top:4px;font-size:12px;color:#475569;">TIN: ${company.tin || "-"}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${company.address || "-"}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${company.phone || "-"}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${company.email || "-"}</div>
            <div style="margin-top:8px;font-size:12px;color:#64748b;">${style.codeLabel}: ${invoiceNo}</div>
            <div style="margin-top:2px;font-size:12px;color:#64748b;">寮€鍏锋棩鏈? ${issueDate}</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:18px;margin-top:18px;">
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:14px;background:${style.light};">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">閾惰淇℃伅</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px 16px;margin-top:10px;font-size:13px;">
            <span style="color:#64748b;">閾惰鍚嶇О</span><strong>${company.bankName || "-"}</strong>
            <span style="color:#64748b;">璐︽埛鍚嶇О</span><strong>${company.bankAccountName || "-"}</strong>
            <span style="color:#64748b;">璐﹀彿</span><strong>${company.bankAccountNumber || "-"}</strong>
            <span style="color:#64748b;">閿€鍞汉鍛?/span><strong>${result.salesPersonName || "-"}</strong>
          </div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:18px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <thead>
          <tr style="background:${style.accent};color:#ffffff;">
            <th style="text-align:left;padding:12px 10px;">#</th>
            <th style="text-align:left;padding:12px 10px;">椤圭洰璇存槑</th>
            <th style="text-align:center;padding:12px 10px;">鏁伴噺</th>
            <th style="text-align:right;padding:12px 10px;">閲戦</th>
          </tr>
        </thead>
        <tbody>${invoiceRowsHtml}</tbody>
      </table>

      <div style="margin-top:16px;border:1px solid #e2e8f0;border-radius:18px;padding:14px;background:${style.light};">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">浠樻姹囨€?/div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px 16px;margin-top:12px;font-size:14px;">
            <span style="color:#64748b;">灏忚</span><strong>${money(subtotal)}</strong>
            <span style="color:#64748b;">绋庨</span><strong>${money(quote.vat || 0)}</strong>
            ${installment.enabled ? `<span style="color:#64748b;">瀹氶噾</span><strong>${money(installment.downPayment)}</strong>` : ""}
            <span style="font-family:Manrope,sans-serif;font-size:18px;font-weight:800;color:${style.accent};">${docType === "inquiry" ? "棰勪及鎬婚" : "搴斾粯鎬婚"}</span><strong style="font-family:Manrope,sans-serif;font-size:22px;color:${style.accent};">${money(grandTotal)}</strong>
          </div>

          ${installment.enabled ? `
            <div style="margin-top:14px;border-top:1px solid #dbe4f0;padding-top:12px;">
              <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">鍒嗘湡璁″垝</div>
              <div style="margin-top:10px;font-size:13px;color:#475569;">瀹氶噾鏃ユ湡: ${installment.depositDate || "-"}</div>
              <div style="margin-top:6px;font-size:13px;color:#475569;">鍛ㄦ湡: ${installment.cycleLabel} | 鏍囧噯姣忔湡: ${money(installment.weeklyAmount)}</div>
              <div style="margin-top:10px;">
                ${installment.installments.map((item) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:13px;border-bottom:1px dashed #dbe4f0;"><span>${item.label} / ${item.dueDate || "-"}</span><strong>${money(item.amount)}</strong></div>`).join("")}
              </div>
            </div>
          ` : ""}
      </div>

      <div style="margin-top:14px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:12px;color:#64748b;">
        ${docType === "invoice" ? "This invoice is generated by the system for payment confirmation." : docType === "inquiry" ? "This inquiry sheet summarizes customer demand, package scope, and the estimated payment plan." : "This quotation summarizes the solution scope, customer information, and installment arrangement."}
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:14px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <tbody>
          <tr>
            <td style="width:50%;padding:18px;border-right:1px solid #e2e8f0;">
              <div style="font-size:12px;color:#64748b;">閿€鍞鍚?/div>
              <div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div>
            </td>
            <td style="width:50%;padding:18px;">
              <div style="font-size:12px;color:#64748b;">瀹㈡埛绛惧悕</div>
              <div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    `;
  }

function renderCalculation(result) {
  const nextFeeSignature = `${result?.recommendation?.packageName || ""}::${result?.location || ""}`;
  if (state.feeSignature !== nextFeeSignature) {
    state.feeSignature = nextFeeSignature;
    state.customInstallFee = null;
    state.customLogisticsFee = null;
  }
  state.rawCalculationResult = result;
  const effectiveResult = getEffectiveResult(result);
  state.latestResult = effectiveResult;
  state.selectedPackageName = effectiveResult.recommendation.packageName;
  fillSettings(effectiveResult.settings);

  document.getElementById("daily-wh").textContent = numberFormatter.format(effectiveResult.metrics.dailyWh);
  document.getElementById("daily-kwh-line").textContent = t("metric.dailyKwh", { value: effectiveResult.metrics.dailyKwh.toFixed(2) });
  document.getElementById("autonomy-days").textContent = effectiveResult.metrics.autonomyDays;
  document.getElementById("peak-power-line").textContent = t("metric.peakPower", { value: numberFormatter.format(effectiveResult.metrics.peakPower) });
  document.getElementById("fit-line").textContent = t("label.fit", { value: effectiveResult.recommendation.fitScore });
  document.getElementById("package-name").textContent = effectiveResult.recommendation.packageName || t("package.waiting");
  document.getElementById("solar-panels").textContent = effectiveResult.recommendation.solarPanels;
  document.getElementById("battery").textContent = effectiveResult.recommendation.battery;
  document.getElementById("inverter").textContent = effectiveResult.recommendation.inverter;
  document.getElementById("equipment-price").textContent = money(effectiveResult.quote.equipmentPrice);
  document.getElementById("package-load").textContent = `${numberFormatter.format(effectiveResult.recommendation.loadCapacityW)} W`;
  document.getElementById("required-load").textContent = `${numberFormatter.format(effectiveResult.metrics.peakPower)} W`;

  document.getElementById("quote-customer").textContent = effectiveResult.customer.name || "-";
  document.getElementById("quote-phone").textContent = effectiveResult.customer.phone || "-";
  document.getElementById("quote-email").textContent = effectiveResult.customer.email || "-";
  document.getElementById("quote-address").textContent = effectiveResult.customer.address || "-";
  document.getElementById("quote-equipment").textContent = money(effectiveResult.quote.equipmentPrice);
  document.getElementById("install-fee").textContent = money(effectiveResult.quote.installFee);
  document.getElementById("logistics-fee").textContent = money(effectiveResult.quote.logisticsFee);
  document.getElementById("quote-subtotal").textContent = money(effectiveResult.quote.subtotalExclTax);
  const quoteVatLabel = document.querySelector('[data-i18n="quote.vat"]');
  if (quoteVatLabel) {
    quoteVatLabel.textContent = t("quote.vatDynamic", { value: Number(effectiveResult.quote.vatRate ?? state.settings.vatRate ?? 15).toFixed(2) });
  }
  document.getElementById("quote-vat").textContent = `+ ${money(effectiveResult.quote.vat)}`;
  document.getElementById("quote-total").textContent = money(effectiveResult.quote.displayTotal);
  document.getElementById("quote-display-mode-text").textContent = t("settings.taxInclusive");
  const company = getCompanyProfile(effectiveResult);
  const companyLogo = document.getElementById("company-logo");
  if (companyLogo) {
    companyLogo.src = company.logoUrl || "";
    companyLogo.classList.toggle("hidden", !company.logoUrl);
  }
  const companyName = document.getElementById("company-name");
  if (companyName) companyName.textContent = company.name || "-";
  const companyTin = document.getElementById("company-tin");
  if (companyTin) companyTin.textContent = company.tin || "-";
  const companyBank = document.getElementById("company-bank");
  if (companyBank) {
    companyBank.textContent = [company.bankName, company.bankAccountName, company.bankAccountNumber].filter(Boolean).join(" / ") || "-";
  }
  const companyAddress = document.getElementById("company-address");
  if (companyAddress) companyAddress.textContent = company.address || "-";
  const companyPhone = document.getElementById("company-phone");
  if (companyPhone) companyPhone.textContent = company.phone || "-";
  const companyEmail = document.getElementById("company-email");
  if (companyEmail) companyEmail.textContent = company.email || "-";
  const installToggle = document.getElementById("include-install-fee");
  if (installToggle) installToggle.checked = state.includeInstallFee;
  const installFeeInput = document.getElementById("install-fee-input");
  if (installFeeInput) {
    installFeeInput.value = state.customInstallFee == null ? Number(result.quote?.installFee || 0) : Number(state.customInstallFee || 0);
    installFeeInput.disabled = !state.includeInstallFee;
  }
  const logisticsToggle = document.getElementById("include-logistics-fee");
  if (logisticsToggle) logisticsToggle.checked = state.includeLogisticsFee;
  const logisticsFeeInput = document.getElementById("logistics-fee-input");
  if (logisticsFeeInput) {
    logisticsFeeInput.value = state.customLogisticsFee == null ? Number(result.quote?.logisticsFee || 0) : Number(state.customLogisticsFee || 0);
    logisticsFeeInput.disabled = !state.includeLogisticsFee;
  }
  renderInstallment(effectiveResult.quote.displayTotal);

  renderPackages(effectiveResult.packages || [], effectiveResult.metrics.peakPower);
}

function renderQuoteOutput(message, success = false) {
  const node = document.getElementById("quote-output");
  node.classList.remove("hidden");
  node.className = `mt-6 rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-surface-container-low text-slate-700"}`;
  node.innerHTML = message;
}

function renderQrOutput() {
  if (!state.latestResult) return;
  const qrOutput = document.getElementById("qr-output");
  const encoded = encodeURIComponent(state.latestResult.qrPayload);
  qrOutput.classList.remove("hidden");
  qrOutput.innerHTML = `
    <p class="mb-3 text-sm font-bold text-primary">${t("quote.qrPreview")}</p>
    <img alt="quote qr" class="h-40 w-40 rounded-2xl bg-white p-2 ring-1 ring-slate-200" src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encoded}" />
    <p class="mt-3 break-all text-xs text-slate-500">${state.latestResult.qrPayload}</p>
  `;
}

function getActivePreviewResult() {
  return state.previewResult || state.latestResult;
}

function updatePreviewDocTypeButtons() {
  document.querySelectorAll(".doc-type-button").forEach((button) => {
    const active = button.dataset.docType === state.previewDocType;
    button.classList.toggle("bg-primary", active);
    button.classList.toggle("text-white", active);
    button.classList.toggle("bg-slate-100", !active);
    button.classList.toggle("text-primary", !active);
  });
}

function setPreviewDocType(docType) {
  state.previewDocType = "quotation";
  updatePreviewDocTypeButtons();
  const result = getActivePreviewResult();
  if (result) {
    document.getElementById("preview-content").innerHTML = buildPrintableHtml(result, state.previewDocType);
  }
}

function showPreviewModal(result = state.latestResult) {
  if (!result) return;
  state.previewResult = result;
  updatePreviewDocTypeButtons();
  document.getElementById("preview-content").innerHTML = buildPrintableHtml(result, state.previewDocType);
  document.getElementById("preview-modal").classList.remove("hidden");
  document.getElementById("preview-modal").classList.add("flex");
}

function closePreviewModal() {
  state.previewResult = null;
  document.getElementById("preview-modal").classList.add("hidden");
  document.getElementById("preview-modal").classList.remove("flex");
}

function printOrExportPdf() {
  const result = getActivePreviewResult();
  if (!result) return;
  const html = buildPrintableHtml(result, state.previewDocType);
  const printable = document.getElementById("printable-quote");
  printable.innerHTML = html;
  printable.classList.remove("hidden");
  window.print();
  printable.classList.add("hidden");
}

function getSavedQuotePreviewPayload(item = {}) {
  const payload = item.payload && typeof item.payload === "object" ? item.payload : {};
  return {
    ...payload,
    id: item.id || payload.id || `${Date.now()}`,
    createdAt: item.createdAt || payload.createdAt || new Date().toISOString(),
    customer: item.customer || payload.customer || {},
    location: item.location || payload.location || "Port Vila",
    packageName: item.packageName || payload.packageName || payload.recommendation?.packageName || "",
    installmentPlan: item.installmentPlan || payload.installmentPlan || getInstallmentPlan(item.total || payload.quote?.displayTotal || payload.quote?.total || 0),
    salesPersonName: item.salesPersonName || payload.salesPersonName || payload.salesPerson?.name || "",
    quote: {
      ...(payload.quote || {}),
      displayTotal: item.total || payload.quote?.displayTotal || payload.quote?.total || 0,
      total: item.total || payload.quote?.total || payload.quote?.displayTotal || 0
    }
  };
}

function printSavedQuote(item) {
  const previewPayload = getSavedQuotePreviewPayload(item);
  state.previewResult = previewPayload;
  printOrExportPdf();
}

async function convertSavedQuoteToInvoice(item) {
  const previewPayload = getSavedQuotePreviewPayload(item);
  const response = await fetch("/api/invoices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteId: item.id,
      customer: item.customer || previewPayload.customer || {},
      packageName: item.packageName || previewPayload.packageName || previewPayload.recommendation?.packageName || "",
      amount: item.total || previewPayload.quote?.displayTotal || previewPayload.quote?.total || 0,
      salesPersonName: item.salesPersonName || previewPayload.salesPersonName || "",
      payload: previewPayload
    })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "INVOICE generation failed");
  }
  renderQuoteOutput(`INVOICE ${data.item.invoiceNo} 已生成，可前往 <a class="font-bold underline" href="/invoices.html">INVOICE 管理</a> 查看。`, true);
}

async function loadCatalog() {
  const response = await fetch("/api/catalog");
  const data = await response.json();
  state.categories = data.categories || [];
  state.presets = data.presets || [];
  fillSettings(data.settings);
  renderPresetCategories();
}

async function runCalculation() {
  const response = await fetch("/api/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      devices: getDevices(),
      location: document.getElementById("location-select").value,
      customer: state.customer,
      selectedPackageName: state.selectedPackageName
    })
  });
  const result = await response.json();
  renderCalculation(result);
}

async function saveQuote() {
  if (!state.latestResult) return;
    const salesPerson = getSelectedSalesPerson();
  const installmentPlan = getInstallmentPlan(state.latestResult.quote?.displayTotal || 0);
  if (!salesPerson) {
    renderQuoteOutput("请先选择所属销售。");
    return;
  }
  const response = await fetch("/api/save-quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
        ...state.latestResult,
        installmentPlan,
        salesPerson,
      salesPersonId: salesPerson.id,
      salesPersonName: salesPerson.name,
      salesPersonRole: salesPerson.roleLabel || salesPerson.role
    })
  });
  const data = await response.json();
  if (data.ok) {
    renderQuoteOutput(t("message.planSaved", { value: data.item.customer.name || t("fallback.unnamed") }), true);
    await loadSavedQuotes();
  }
}

async function loadSavedQuotes() {
  const response = await fetch("/api/saved-quotes");
  const data = await response.json();
  const list = document.getElementById("saved-list");
  list.innerHTML = "";
  if (!data.items.length) {
    list.innerHTML = `<div class="rounded-2xl bg-slate-50 px-4 py-3 text-slate-500">${t("empty.savedPlans")}</div>`;
    return;
  }
  data.items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "rounded-2xl bg-slate-50 px-4 py-3";
    const customerName = item.customer?.name || item.customerName || t("saved.customerFallback");
    const salesName = item.salesPersonName || item.salesName || item.payload?.salesPerson?.name || "-";
    row.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="font-bold text-primary">${customerName}</p>
          <p class="mt-1 text-xs text-slate-500">${t("saved.summary", { package: item.packageName, dailyWh: numberFormatter.format(item.dailyWh), location: item.location })}</p>
          <p class="mt-1 text-xs text-slate-400">销售：${salesName}</p>
        </div>
        <div class="text-right">
          <p class="font-black text-primary">${money(item.total)}</p>
          <p class="mt-1 text-xs text-slate-400">${new Date(item.createdAt).toLocaleString()}</p>
        </div>
      </div>
    `;
    const actions = document.createElement("div");
    actions.className = "mt-3 flex flex-wrap justify-end gap-2";

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "rounded-full bg-primary px-4 py-2 text-sm font-bold text-white transition hover:bg-primary/90";
    previewButton.textContent = t("action.preview");
    previewButton.addEventListener("click", () => {
      showPreviewModal(getSavedQuotePreviewPayload(item));
    });

    const printButton = document.createElement("button");
    printButton.type = "button";
    printButton.className = "rounded-full bg-slate-200 px-4 py-2 text-sm font-bold text-primary transition hover:bg-slate-300";
    printButton.textContent = "打印";
    printButton.addEventListener("click", () => {
      printSavedQuote(item);
    });

    const invoiceButton = document.createElement("button");
    invoiceButton.type = "button";
    invoiceButton.className = "rounded-full bg-secondary-container px-4 py-2 text-sm font-bold text-primary transition hover:opacity-90";
    invoiceButton.textContent = "转 INVOICE";
    invoiceButton.addEventListener("click", async () => {
      try {
        await convertSavedQuoteToInvoice(item);
      } catch (error) {
        renderQuoteOutput(error.message || "INVOICE generation failed");
      }
    });

    actions.appendChild(previewButton);
    actions.appendChild(printButton);
    actions.appendChild(invoiceButton);
    row.appendChild(actions);
    list.appendChild(row);
  });
}

function generateQuotePreview() {
  if (!state.latestResult) return;
  renderQuoteOutput(`
    <p class="font-bold text-primary">${t("quote.preview.title")}</p>
    <p class="mt-2">${t("quote.preview.customer", { value: state.latestResult.customer.name || "-" })}</p>
    <p class="mt-2">${t("quote.preview.phone", { value: state.latestResult.customer.phone || "-" })}</p>
    <p class="mt-2">${t("quote.preview.package", { value: state.latestResult.recommendation.packageName })}</p>
    <p class="mt-2">${t("quote.preview.total", { total: money(state.latestResult.quote.displayTotal), mode: t("settings.taxInclusive") })}</p>
  `);
}

function updateCalculatorDisplay(value) {
  document.getElementById("calculator-display").value = value || "0";
}

function toggleMiniCalculator(open) {
  const panel = document.getElementById("mini-calculator");
  panel.classList.toggle("hidden", !open);
}

function setupMiniCalculator() {
  document.querySelectorAll(".calc-key").forEach((button) => {
    button.addEventListener("click", () => {
      state.calculatorExpression += button.dataset.value;
      updateCalculatorDisplay(state.calculatorExpression);
    });
  });
  document.getElementById("calc-clear").addEventListener("click", () => {
    state.calculatorExpression = "";
    updateCalculatorDisplay("0");
  });
  document.getElementById("calc-equals").addEventListener("click", () => {
    try {
      const result = Function(`"use strict"; return (${state.calculatorExpression || 0});`)();
      state.calculatorExpression = String(result);
      updateCalculatorDisplay(state.calculatorExpression);
    } catch {
      updateCalculatorDisplay("ERR");
      state.calculatorExpression = "";
    }
  });
  document.getElementById("calculate-fab-mobile").addEventListener("click", () => toggleMiniCalculator(true));
  document.getElementById("close-mini-calculator").addEventListener("click", () => toggleMiniCalculator(false));
}

function seedDefaultRows() {
  const list = document.getElementById("device-list");
  list.innerHTML = "";
  defaultDevices.forEach((device) => list.appendChild(createDeviceRow(device)));
}

function bindEvents() {
  document.getElementById("add-device-button").addEventListener("click", addBlankRow);
  document.getElementById("preview-plan-button").addEventListener("click", showPreviewModal);
  document.getElementById("print-plan-button").addEventListener("click", printOrExportPdf);
  document.getElementById("export-pdf-button").addEventListener("click", printOrExportPdf);
  document.getElementById("preview-qr-button")?.addEventListener("click", renderQrOutput);
  document.getElementById("save-quote-button").addEventListener("click", saveQuote);
  document.getElementById("refresh-saved-button").addEventListener("click", loadSavedQuotes);
  document.getElementById("location-select").addEventListener("change", runCalculation);
  document.getElementById("sales-person-select")?.addEventListener("change", (event) => {
    state.selectedSalesPersonId = event.target.value;
  });
  document.getElementById("installment-plan-select")?.addEventListener("change", (event) => {
    state.installmentPlanType = event.target.value || "none";
    renderInstallment(state.latestResult?.quote?.displayTotal || 0);
  });
  document.getElementById("installment-term-select")?.addEventListener("change", (event) => {
    state.installmentTermCount = Number(event.target.value || 6);
    renderInstallment(state.latestResult?.quote?.displayTotal || 0);
  });
  document.getElementById("installment-deposit-input")?.addEventListener("input", (event) => {
    state.installmentDeposit = Number(event.target.value || 0);
    renderInstallment(state.latestResult?.quote?.displayTotal || 0);
  });
  document.getElementById("installment-deposit-date-input")?.addEventListener("change", (event) => {
    state.installmentDepositDate = event.target.value || new Date().toISOString().slice(0, 10);
    state.installmentPaymentDates = {};
    renderInstallment(state.latestResult?.quote?.displayTotal || 0);
  });
  document.getElementById("include-install-fee")?.addEventListener("change", (event) => {
    state.includeInstallFee = Boolean(event.target.checked);
    if (state.rawCalculationResult) renderCalculation(state.rawCalculationResult);
  });
  document.getElementById("install-fee-input")?.addEventListener("input", (event) => {
    state.customInstallFee = Number(event.target.value || 0);
    if (state.rawCalculationResult) renderCalculation(state.rawCalculationResult);
  });
  document.getElementById("include-logistics-fee")?.addEventListener("change", (event) => {
    state.includeLogisticsFee = Boolean(event.target.checked);
    if (state.rawCalculationResult) renderCalculation(state.rawCalculationResult);
  });
  document.getElementById("logistics-fee-input")?.addEventListener("input", (event) => {
    state.customLogisticsFee = Number(event.target.value || 0);
    if (state.rawCalculationResult) renderCalculation(state.rawCalculationResult);
  });
  const languageSelect = document.getElementById("language-select");
  if (languageSelect) {
    languageSelect.addEventListener("change", async (event) => {
      await loadTranslations(event.target.value);
      applyTranslations();
      await loadSavedQuotes();
    });
  }

  ["open-customer-modal-inline"].forEach((id) => {
    document.getElementById(id).addEventListener("click", openCustomerModal);
  });
  ["close-customer-modal", "cancel-customer-modal"].forEach((id) => {
    document.getElementById(id).addEventListener("click", closeCustomerModal);
  });
  document.getElementById("save-customer-modal").addEventListener("click", saveCustomerFromModal);
  document.getElementById("close-preview-modal").addEventListener("click", closePreviewModal);
  document.querySelectorAll(".doc-type-button").forEach((button) => {
    button.addEventListener("click", () => setPreviewDocType(button.dataset.docType));
  });
  document.getElementById("generate-quote-button")?.addEventListener("click", generateQuotePreview);
}

async function init() {
  try {
    await loadTranslations(state.locale);
    applyTranslations();
    relocateInstallmentControls();
    setupMiniCalculator();
    const health = await fetch("/api/health");
    setHealth(health.ok);
    await loadCatalog();
    await loadSalesPeople();
    seedDefaultRows();
    bindEvents();
    syncCustomerSummary();
    await runCalculation();
    await loadSavedQuotes();
  } catch (error) {
    console.error(error);
    setHealth(false);
  }
}

init();

function getDocumentStyle(docType) {
  if (docType === "invoice") return { title: "INVOICE", subtitle: "Commercial Invoice", codeLabel: "Invoice No", dateLabel: "Invoice Date", totalLabel: "Total Due", accent: "#001d44", light: "#f8fafc" };
  if (docType === "inquiry") return { title: "INQUIRY SHEET", subtitle: "Customer Inquiry Sheet", codeLabel: "Inquiry No", dateLabel: "Inquiry Date", totalLabel: "Estimated Total", accent: "#7f5700", light: "#fff7e6" };
  return { title: "QUOTATION", subtitle: "Sales Quotation", codeLabel: "Quotation No", dateLabel: "Quotation Date", totalLabel: "Total Quoted", accent: "#0f766e", light: "#ecfeff" };
}

function buildPrintableHtml(result, docType = state.previewDocType || "quotation") {
  const customer = result.customer || {};
  const recommendation = result.recommendation || {};
  const quote = result.quote || {};
  const installment = result.installmentPlan || getInstallmentPlan(quote.displayTotal || quote.total || 0);
  const company = getCompanyProfile(result);
  const style = getDocumentStyle(docType);
  const invoiceNo = `${style.title === "INVOICE" ? "INV" : style.title === "INQUIRY SHEET" ? "INQ" : "QTN"}-${String(result.id || Date.now()).slice(-8)}`;
  const issueDate = new Date(result.createdAt || Date.now()).toISOString().slice(0, 10);
  const rows = [
    { description: recommendation.packageName || result.packageName || "Solar Package", details: [recommendation.solarPanels, recommendation.battery, recommendation.inverter].filter(Boolean).join(" / "), amount: Number(quote.equipmentPrice || 0) },
    Number(quote.installFee || 0) > 0 ? { description: "Installation", details: "Installation Service", amount: Number(quote.installFee || 0) } : null,
    Number(quote.logisticsFee || 0) > 0 ? { description: "Logistics", details: result.location || "Vanuatu", amount: Number(quote.logisticsFee || 0) } : null
  ].filter(Boolean);
  const rowsHtml = rows.map((item, index) => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">${index + 1}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">
        <div style="font-weight:700;color:#0f172a;">${item.description}</div>
        <div style="margin-top:4px;font-size:12px;color:#64748b;">${item.details || "-"}</div>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${money(item.amount)}</td>
    </tr>
  `).join("");
  const note = result.note || "";
  return `
    <div style="font-family:Inter,sans-serif;color:#0f172a;background:#ffffff;padding:14px 16px;max-width:186mm;margin:0 auto;">
      <div style="display:grid;grid-template-columns:0.66fr 1.34fr;gap:16px;padding-bottom:14px;border-bottom:3px solid ${style.accent};">
        <div>
          <div style="font-family:Manrope,sans-serif;font-size:28px;font-weight:800;letter-spacing:0.08em;color:${style.accent};">${style.title}</div>
          <div style="margin-top:4px;font-size:12px;color:#64748b;">${style.subtitle}</div>
          <div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:${style.light};">
            <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">BILL TO</div>
            <div style="margin-top:8px;font-size:18px;font-weight:800;color:#0f172a;">${customer.name || result.customerName || "-"}</div>
            <div style="margin-top:4px;font-size:12px;color:#475569;">${customer.phone || "-"}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${customer.email || "-"}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${customer.address || "-"}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;align-items:flex-start;gap:${company.logoUrl ? "12px" : "0"};">
          ${company.logoUrl ? `<img alt="company logo" src="${company.logoUrl}" style="width:72px;height:72px;object-fit:contain;border-radius:14px;border:1px solid #e2e8f0;padding:8px;background:#fff;" />` : ""}
          <div style="text-align:right;">
            <div style="font-family:Manrope,sans-serif;font-size:23px;font-weight:800;color:${style.accent};">${company.name}</div>
            <div style="margin-top:4px;font-size:12px;color:#475569;">TIN: ${company.tin || "-"}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${company.address || "-"}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${company.phone || "-"}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${company.email || "-"}</div>
            <div style="margin-top:8px;font-size:12px;color:#64748b;">${style.codeLabel}: ${invoiceNo}</div>
            <div style="margin-top:2px;font-size:12px;color:#64748b;">${style.dateLabel}: ${issueDate}</div>
          </div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:18px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <thead>
          <tr style="background:${style.accent};color:#ffffff;">
            <th style="text-align:left;padding:12px 10px;">#</th>
            <th style="text-align:left;padding:12px 10px;">Description</th>
            <th style="text-align:right;padding:12px 10px;">Amount</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:${style.light};">
        <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">PAYMENT SUMMARY</div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px 16px;margin-top:12px;font-size:14px;">
          <span style="color:#64748b;">Subtotal</span><strong>${money(quote.subtotalExclTax || quote.displayTotal || quote.total || 0)}</strong>
          <span style="color:#64748b;">Included Tax</span><strong>${money(includedTaxAmount(quote))}</strong>
          ${installment.enabled ? `<span style="color:#64748b;">Deposit</span><strong>${money(installment.downPayment)}</strong>` : ""}
          <span style="font-family:Manrope,sans-serif;font-size:18px;font-weight:800;color:${style.accent};">${style.totalLabel}</span><strong style="font-family:Manrope,sans-serif;font-size:22px;color:${style.accent};">${money(quote.displayTotal || quote.total || 0)}</strong>
        </div>
        <div style="margin-top:8px;font-size:12px;font-weight:700;color:${style.accent};text-align:right;">Tax Inclusive</div>
        ${installment.enabled ? `<div style="margin-top:18px;border-top:1px solid #dbe4f0;padding-top:14px;"><div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">INSTALLMENT PLAN</div><div style="margin-top:10px;font-size:13px;color:#475569;">Deposit Date: ${installment.depositDate || "-"}</div><div style="margin-top:8px;font-size:13px;color:#475569;">Cycle: ${installmentCycleLabelEnglish(installment)}</div><div style="margin-top:12px;">${installment.installments.map((entry, index) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed #dbe4f0;font-size:13px;"><span>${installmentItemLabelEnglish(entry, index)} / ${entry.dueDate || "-"}</span><strong>${money(entry.amount)}</strong></div>`).join("")}</div></div>` : ""}
        ${note ? `<div style="margin-top:12px;font-size:13px;color:#475569;">Remark: ${note}</div>` : ""}
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:18px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <tbody><tr><td style="width:50%;padding:18px;border-right:1px solid #e2e8f0;"><div style="font-size:12px;color:#64748b;">Sales Signature</div><div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div></td><td style="width:50%;padding:18px;"><div style="font-size:12px;color:#64748b;">Customer Signature</div><div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div></td></tr></tbody>
      </table>
    </div>`;
}

