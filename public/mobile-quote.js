const quoteState = {
  employees: [],
  lastQuote: null,
  categories: [],
  activeCategoryKey: ""
};

const quoteFormatter = new Intl.NumberFormat("en-US");

function $(id) {
  return document.getElementById(id);
}

function money(value) {
  return `VT ${quoteFormatter.format(Number(value || 0))}`;
}

function setStatus(text, isError = false) {
  const node = $("quote-status");
  node.textContent = text || "";
  node.style.color = isError ? "#b91c1c" : "#64748b";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

function categoryLabel(key) {
  const map = {
    lighting: "照明",
    kitchen: "厨房",
    comfort: "舒适",
    entertainment: "娱乐",
    office: "办公",
    cleaning: "清洁",
    water: "用水"
  };
  return map[key] || key || "分类";
}

function syncDeviceInputs(container) {
  const desktopName = container.querySelector(".device-grid .device-name");
  const desktopPower = container.querySelector(".device-grid .device-power");
  const desktopHours = container.querySelector(".device-grid .device-hours");
  const desktopQuantity = container.querySelector(".device-grid .device-quantity");
  const mobileName = container.querySelector(".device-stack .device-name");
  const mobilePower = container.querySelector(".device-stack .device-power");
  const mobileHours = container.querySelector(".device-stack .device-hours");
  const mobileQuantity = container.querySelector(".device-stack .device-quantity");

  const bindPair = (a, b) => {
    a.addEventListener("input", () => {
      b.value = a.value;
    });
    b.addEventListener("input", () => {
      a.value = b.value;
    });
  };

  bindPair(desktopName, mobileName);
  bindPair(desktopPower, mobilePower);
  bindPair(desktopHours, mobileHours);
  bindPair(desktopQuantity, mobileQuantity);
}

function renderDeviceEmpty() {
  $("device-empty").style.display = $("device-list").children.length ? "none" : "block";
}

function addDeviceRow(device = { name: "", power: "", hours: "", quantity: 1 }) {
  const template = $("device-row-template");
  const node = template.content.firstElementChild.cloneNode(true);

  node.querySelectorAll(".device-name").forEach((input) => {
    input.value = device.name || "";
  });
  node.querySelectorAll(".device-power").forEach((input) => {
    input.value = device.power ?? "";
  });
  node.querySelectorAll(".device-hours").forEach((input) => {
    input.value = device.hours ?? "";
  });
  node.querySelectorAll(".device-quantity").forEach((input) => {
    input.value = device.quantity ?? 1;
  });

  syncDeviceInputs(node);
  node.querySelectorAll(".device-remove").forEach((button) => {
    button.addEventListener("click", () => {
      node.remove();
      renderDeviceEmpty();
    });
  });

  $("device-list").appendChild(node);
  renderDeviceEmpty();
}

function renderPresetCategories() {
  const categoryWrap = $("preset-categories");
  const panel = $("preset-panel");
  const categories = Array.isArray(quoteState.categories) ? quoteState.categories : [];
  if (!categoryWrap || !panel) return;
  if (!categories.length) {
    categoryWrap.innerHTML = "";
    panel.innerHTML = `<div class="muted">默认电器加载中...</div>`;
    return;
  }

  if (!categories.some((item) => item.key === quoteState.activeCategoryKey)) {
    quoteState.activeCategoryKey = categories[0].key;
  }

  categoryWrap.innerHTML = categories
    .map((category) => `
      <button class="preset-category ${category.key === quoteState.activeCategoryKey ? "active" : ""}" type="button" data-category="${escapeHtml(category.key)}">
        ${escapeHtml(categoryLabel(category.key))}
      </button>
    `)
    .join("");

  const activeCategory = categories.find((item) => item.key === quoteState.activeCategoryKey) || categories[0];
  panel.innerHTML = activeCategory.items.length
    ? activeCategory.items
        .map((item) => `
          <button class="preset-chip" type="button" data-name="${escapeHtml(item.name)}" data-power="${escapeHtml(item.power)}" data-hours="${escapeHtml(item.hours)}" data-quantity="${escapeHtml(item.quantity)}">
            ${escapeHtml(item.name)} / ${escapeHtml(item.power)}W
          </button>
        `)
        .join("")
    : `<div class="muted">当前分类没有默认电器。</div>`;

  categoryWrap.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      quoteState.activeCategoryKey = button.dataset.category || "";
      renderPresetCategories();
    });
  });

  panel.querySelectorAll("[data-name]").forEach((button) => {
    button.addEventListener("click", () => {
      addDeviceRow({
        name: button.dataset.name || "",
        power: Number(button.dataset.power || 0),
        hours: Number(button.dataset.hours || 0),
        quantity: Number(button.dataset.quantity || 1)
      });
      setStatus(`已添加默认电器: ${button.dataset.name || "设备"}`);
    });
  });
}

function collectCustomer() {
  return {
    name: $("quote-customer-name").value.trim(),
    phone: $("quote-customer-phone").value.trim(),
    email: $("quote-customer-email").value.trim(),
    address: $("quote-customer-address").value.trim()
  };
}

function collectDevices() {
  return Array.from($("device-list").children)
    .map((row) => ({
      name: row.querySelector(".device-grid .device-name").value.trim(),
      power: Number(row.querySelector(".device-grid .device-power").value || 0),
      hours: Number(row.querySelector(".device-grid .device-hours").value || 0),
      quantity: Number(row.querySelector(".device-grid .device-quantity").value || 0)
    }))
    .filter((item) => item.name || item.power > 0 || item.hours > 0 || item.quantity > 0);
}

function getSelectedSalesPerson() {
  const id = $("quote-sales-person").value;
  return quoteState.employees.find((item) => item.id === id) || null;
}

function renderQuoteResult(data) {
  quoteState.lastQuote = data;
  const metrics = data.metrics || {};
  const recommendation = data.recommendation || {};
  const quote = data.quote || {};

  $("result-daily-wh").textContent = `${quoteFormatter.format(Number(metrics.dailyWh || 0))} Wh`;
  $("result-peak-power").textContent = `${quoteFormatter.format(Number(metrics.peakPower || 0))} W`;
  $("result-package-name").textContent = recommendation.packageName || "未匹配";
  $("result-total-price").textContent = money(quote.displayTotal || 0);

  $("package-details").innerHTML = [
    `太阳能板: ${escapeHtml(recommendation.solarPanels || "-")}`,
    `电池: ${escapeHtml(recommendation.battery || "-")}`,
    `逆变器: ${escapeHtml(recommendation.inverter || "-")}`,
    `负载能力: ${quoteFormatter.format(Number(recommendation.loadCapacityW || 0))} W`,
    `安装费: ${money(quote.installFee || 0)}`,
    `物流费: ${money(quote.logisticsFee || 0)}`,
    `增值税: ${money(quote.vat || 0)}`
  ].join("<br />");
}

async function calculateQuote() {
  const customer = collectCustomer();
  const devices = collectDevices();
  if (!customer.name) {
    setStatus("请先填写客户姓名。", true);
    return null;
  }
  if (!devices.length) {
    setStatus("请至少添加一项设备。", true);
    return null;
  }

  setStatus("正在计算报价...");
  const result = await fetchJson("/api/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customer,
      location: $("quote-location").value,
      devices
    })
  });
  renderQuoteResult(result);
  setStatus("报价计算完成，可以继续保存。");
  return result;
}

async function saveQuote() {
  try {
    let quote = quoteState.lastQuote;
    if (!quote) {
      quote = await calculateQuote();
      if (!quote) return;
    }

    const salesPerson = getSelectedSalesPerson();
    const payload = {
      customer: collectCustomer(),
      location: $("quote-location").value,
      devices: collectDevices(),
      recommendation: quote.recommendation || {},
      metrics: quote.metrics || {},
      quote: quote.quote || {},
      salesPerson,
      salesPersonId: salesPerson?.id || "",
      salesPersonName: salesPerson?.name || "",
      salesPersonRole: salesPerson?.roleLabel || salesPerson?.role || "",
      selectedPackageName: quote.recommendation?.packageName || "",
      installmentPlan: {
        cycleLabel: "待确认",
        installmentAmount: 0,
        depositAmount: 0
      }
    };

    setStatus("正在保存报价...");
    const result = await fetchJson("/api/save-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const item = result.item || {};
    setStatus(`报价已保存，草稿编号 ${item.id || "-"}`);
  } catch (error) {
    setStatus(error.message || "保存报价失败", true);
  }
}

function resetQuote() {
  $("quote-customer-name").value = "";
  $("quote-customer-phone").value = "";
  $("quote-customer-email").value = "";
  $("quote-customer-address").value = "";
  $("quote-location").value = "Port Vila";
  $("device-list").innerHTML = "";
  addDeviceRow({ name: "LED Light", power: 10, hours: 6, quantity: 4 });
  addDeviceRow({ name: "Fridge", power: 150, hours: 24, quantity: 1 });
  $("result-daily-wh").textContent = "0 Wh";
  $("result-peak-power").textContent = "0 W";
  $("result-package-name").textContent = "待计算";
  $("result-total-price").textContent = "VT 0";
  $("package-details").textContent = "填写信息后点击“立即报价”。";
  quoteState.lastQuote = null;
  setStatus("已重置报价信息。");
}

async function loadSalesPeople() {
  const result = await fetchJson("/api/employees");
  const items = Array.isArray(result.items) ? result.items : [];
  quoteState.employees = items.filter((item) => item.status === "active");
  const salesPeople = quoteState.employees.filter((item) => item.role === "sales" || item.role === "sales_manager");
  const source = salesPeople.length ? salesPeople : quoteState.employees;
  $("quote-sales-person").innerHTML = source
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel || item.role)}</option>`)
    .join("");
}

async function loadCatalog() {
  const result = await fetchJson("/api/catalog");
  quoteState.categories = Array.isArray(result.categories) ? result.categories : [];
  renderPresetCategories();
}

function bindEvents() {
  $("add-device-btn").addEventListener("click", () => addDeviceRow());
  $("calculate-btn").addEventListener("click", async () => {
    try {
      await calculateQuote();
    } catch (error) {
      setStatus(error.message || "报价计算失败", true);
    }
  });
  $("save-quote-btn").addEventListener("click", saveQuote);
  $("reset-btn").addEventListener("click", resetQuote);
}

async function init() {
  await loadSalesPeople();
  await loadCatalog();
  addDeviceRow({ name: "LED Light", power: 10, hours: 6, quantity: 4 });
  addDeviceRow({ name: "Fridge", power: 150, hours: 24, quantity: 1 });
  bindEvents();
  setStatus("手机报价页已就绪。");
}

init().catch((error) => {
  setStatus(error.message || "手机报价页初始化失败", true);
});

