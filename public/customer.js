const customerState = {
  items: [],
  currentDetail: null,
  summary: {
    total: 0,
    totalPaid: 0,
    totalBalance: 0,
    activeWarranty: 0
  },
  currentId: "",
  salesPeople: []
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

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function getCustomerUserType(customer) {
  const usageType = String(customer?.usageType || "").trim();
  if (usageType === "分期客户" || usageType === "本地批发商") return usageType;
  return String(customer?.customerTypeLabel || "-").trim() || "-";
}

function getCustomerPowerUsageType(customer) {
  const usageType = String(customer?.usageType || "").trim();
  if (!usageType) return "-";
  if (usageType === "分期客户") return "住宅用电";
  if (usageType === "本地批发商") return "批发业务";
  return usageType;
}

function getSelectedCustomer() {
  return customerState.currentDetail
    || customerState.items.find((item) => item.id === customerState.currentId)
    || customerState.items[0]
    || null;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

function renderSummary() {
  document.getElementById("customer-total").textContent = String(customerState.summary.total || 0);
  document.getElementById("customer-paid-total").textContent = formatMoney(customerState.summary.totalPaid || 0);
  document.getElementById("customer-balance-total").textContent = formatMoney(customerState.summary.totalBalance || 0);
  document.getElementById("customer-warranty-total").textContent = String(customerState.summary.activeWarranty || 0);
}

function getFilteredCustomers() {
  const keyword = (document.getElementById("customer-search").value || "").trim().toLowerCase();
  return customerState.items.filter((item) => {
    if (!keyword) return true;
    return [
      item.name,
      item.contactName,
      item.phone,
      item.archiveNo,
      item.location,
      item.salesPersonName
    ].join(" ").toLowerCase().includes(keyword);
  });
}

function renderCustomerSelect() {
  const select = document.getElementById("customer-select");
  const filtered = getFilteredCustomers();
  if (filtered.length && !filtered.some((item) => item.id === customerState.currentId)) {
    customerState.currentId = filtered[0].id;
  }
  select.innerHTML = filtered.map((item) => `
    <option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.archiveNo)}</option>
  `).join("");
  select.value = customerState.currentId;
}

function renderHeader(customer) {
  document.getElementById("customer-page-title").textContent = `客户档案：${customer.name}`;
  document.getElementById("customer-page-subtitle").textContent = `${customer.location || "-"} / 档案编号：${customer.archiveNo || "-"}`;
}

function renderBasicInfo(customer) {
  const rows = [
    ["主要联系人", customer.contactName || "-"],
    ["电话", customer.phone || "-"],
    ["閭", customer.email || "-"],
    ["瀹㈡埛绫诲瀷", customer.customerTypeLabel || "-"],
    ["用电类型", customer.usageType || "-"],
    ["瀹夎鏃ユ湡", customer.installDate || "-"],
    ["所属销售", customer.salesPersonName || "-"],
    ["地址", customer.address || "-"]
  ];
  document.getElementById("customer-basic-info").innerHTML = rows.map(([label, value]) => `
    <div class="flex items-start justify-between gap-4 border-b border-outline-variant/15 pb-3">
      <span class="text-sm text-slate-500">${label}</span>
      <span class="text-right font-semibold text-slate-800">${escapeHtml(value)}</span>
    </div>
  `).join("");
  const infoLabels = Array.from(document.querySelectorAll("#customer-basic-info .text-sm.text-slate-500"));
  if (infoLabels[3]) infoLabels[3].textContent = "用户类型";
  if (infoLabels[4]) infoLabels[4].textContent = "用电类型";
  const infoValues = Array.from(document.querySelectorAll("#customer-basic-info .text-right.font-semibold.text-slate-800"));
  const userType = getCustomerUserType(customer);
  const usageType = getCustomerPowerUsageType(customer);
  if (infoValues[3]) infoValues[3].textContent = userType;
  if (infoValues[4]) infoValues[4].textContent = usageType;
}

function renderOrders(customer) {
  const wrap = document.getElementById("customer-orders");
  const archivedWrap = document.getElementById("customer-archived-orders");
  const archivedCount = document.getElementById("customer-archived-order-count");
  const allRows = Array.isArray(customer.orders) ? customer.orders : [];
  const rows = allRows.filter((item) => !item.archived && !item.archivedAt);
  const archivedRows = allRows.filter((item) => item.archived || item.archivedAt);
  wrap.innerHTML = rows.length ? rows.map((item) => `
    <div class="rounded-2xl bg-surface-container-low px-4 py-4 flex items-center justify-between gap-4">
      <div>
        <div class="font-bold text-primary">${escapeHtml(item.name)}</div>
        <div class="mt-1 text-xs text-slate-500">#${escapeHtml(item.id)}${item.date ? ` / ${escapeHtml(item.date)}` : ""}</div>
      </div>
      <div class="flex items-center gap-3">
        <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">${escapeHtml(item.status || "-")}</span>
        <button
          type="button"
          class="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700"
          data-archive-order="${escapeHtml(item.id)}"
          data-order-name="${escapeHtml(item.name)}"
        >归档订单</button>
      </div>
    </div>
  `).join("") : `<div class="rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-slate-500">暂无订单记录</div>`;
  if (archivedCount) {
    archivedCount.textContent = String(archivedRows.length);
  }
  if (archivedWrap) {
    archivedWrap.innerHTML = archivedRows.length ? archivedRows.map((item) => `
      <div class="rounded-2xl bg-white px-4 py-4 border border-outline-variant/10 flex items-center justify-between gap-4">
        <div>
          <div class="font-bold text-primary">${escapeHtml(item.name || "-")}</div>
          <div class="mt-1 text-xs text-slate-500">#${escapeHtml(item.id || "-")}${item.date ? ` / ${escapeHtml(item.date)}` : ""}</div>
          <div class="mt-2 text-xs text-slate-400">归档时间：${escapeHtml(item.archivedAt || "-")}</div>
        </div>
        <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">已归档</span>
      </div>
    `).join("") : `<div class="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500 border border-outline-variant/10">暂无归档订单历史</div>`;
  }
}

function renderRelatedQuotes(customer) {
  const wrap = document.getElementById("customer-related-quotes");
  const rows = Array.isArray(customer.relatedQuotes) ? customer.relatedQuotes : [];
  wrap.innerHTML = rows.length ? rows.map((item) => `
    <div class="rounded-2xl bg-surface-container-low px-4 py-4 flex items-center justify-between gap-4">
      <div>
        <div class="font-bold text-primary">${escapeHtml(item.packageName || "-")}</div>
        <div class="mt-1 text-xs text-slate-500">#${escapeHtml(item.id)} / ${escapeHtml(item.createdAt || "-")}</div>
      </div>
      <div class="text-right">
        <div class="font-black text-primary">${formatMoney(item.total || 0)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.status || "-")}</div>
      </div>
    </div>
  `).join("") : `<div class="rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-slate-500">暂无关联报价单</div>`;
}

function renderRelatedRepairs(customer) {
  const wrap = document.getElementById("customer-related-repairs");
  const rows = Array.isArray(customer.relatedRepairs) ? customer.relatedRepairs : [];
  wrap.innerHTML = rows.length ? rows.map((item) => `
    <div class="rounded-2xl bg-surface-container-low px-4 py-4 flex items-center justify-between gap-4">
      <div>
        <div class="font-bold text-primary">${escapeHtml(item.title || "-")}</div>
        <div class="mt-1 text-xs text-slate-500">#${escapeHtml(item.id)} / ${escapeHtml(item.assignedEngineer || "-")}</div>
      </div>
      <div class="text-right">
        <div class="font-semibold text-primary">${escapeHtml(item.status || "-")}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.etaLabel || "-")}</div>
      </div>
    </div>
  `).join("") : `<div class="rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-slate-500">暂无关联维修单</div>`;
}

function renderPayment(customer) {
  const payment = customer.payment || {};
  const percent = Math.max(0, Math.min(100, payment.totalWeeks ? Math.round((payment.completedWeeks / payment.totalWeeks) * 100) : 0));
  document.getElementById("customer-payment-cycle").textContent = payment.cycleLabel || "-";
  document.getElementById("customer-payment-percent").textContent = `${percent}%`;
  document.getElementById("customer-payment-weeks").textContent = `${payment.completedWeeks || 0} / ${payment.totalWeeks || 0} 期`;
  document.getElementById("customer-payment-bar").style.width = `${percent}%`;
  document.getElementById("customer-paid-amount").textContent = formatMoney(payment.paidAmount || 0);
  document.getElementById("customer-balance-amount").textContent = formatMoney(payment.balanceAmount || 0);
  document.getElementById("customer-next-due").textContent = payment.nextDueLabel || "-";
}

function renderPaymentHistory(customer) {
  const wrap = document.getElementById("customer-payment-history");
  const rows = Array.isArray(customer.paymentHistory) ? customer.paymentHistory : [];
  wrap.innerHTML = rows.length ? rows.map((item) => `
    <div class="rounded-2xl bg-white px-4 py-4 border border-outline-variant/10 flex items-center justify-between gap-4">
      <div>
        <div class="font-bold text-primary">${escapeHtml(item.receiptNo || item.id || "-")}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.paidAt || "-")} / ${escapeHtml(item.collectorName || "-")}</div>
      </div>
      <div class="text-right">
        <div class="font-black text-primary">${formatMoney(item.amount || 0)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.note || "-")}</div>
      </div>
    </div>
  `).join("") : `<div class="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500 border border-outline-variant/10">暂无收款记录</div>`;
}

function iconForDevice(type = "") {
  if (type.includes("太阳能")) return "solar_power";
  if (type.includes("电池")) return "battery_full";
  return "settings_input_component";
}

function renderDevices(customer) {
  const allDevices = Array.isArray(customer.devices) ? customer.devices : [];
  const wrap = document.getElementById("customer-devices");
  const archivedWrap = document.getElementById("customer-archived-devices");
  const archivedCount = document.getElementById("customer-archived-device-count");
  const rows = allDevices.filter((item) => !item.archived && !item.archivedAt);
  const archivedRows = allDevices.filter((item) => item.archived || item.archivedAt);
  wrap.innerHTML = rows.length ? rows.map((item) => `
    <div class="rounded-[1.5rem] border border-white/10 bg-white/10 px-4 py-5">
      <div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
        <span class="material-symbols-outlined text-3xl">${iconForDevice(item.type)}</span>
      </div>
      <div class="mt-4 text-sm font-bold">${escapeHtml(item.name)}</div>
      <div class="mt-1 text-xs text-blue-100">${escapeHtml(item.type)}</div>
      <div class="mt-3 text-[11px] uppercase tracking-widest text-blue-200">SN: ${escapeHtml(item.sn || "-")}</div>
      <div class="mt-4 flex gap-2">
        <button
          type="button"
          class="rounded-xl bg-white/90 px-3 py-2 text-xs font-bold text-primary"
          data-unbind-device="${escapeHtml(item.id)}"
        >解绑设备</button>
        <button
          type="button"
          class="rounded-xl bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800"
          data-archive-device="${escapeHtml(item.id)}"
        >归档设备</button>
      </div>
    </div>
  `).join("") : `<div class="rounded-2xl bg-white/10 px-4 py-4 text-sm text-white/70 md:col-span-2 xl:col-span-4">暂无设备 SN 绑定信息</div>`;
  if (archivedCount) {
    archivedCount.textContent = String(archivedRows.length);
  }
  if (archivedWrap) {
    archivedWrap.innerHTML = archivedRows.length ? archivedRows.map((item) => `
      <div class="rounded-2xl border border-white/10 bg-slate-950/10 px-4 py-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-sm font-bold text-white">${escapeHtml(item.name || "-")}</div>
            <div class="mt-1 text-xs text-blue-100">${escapeHtml(item.type || "-")}</div>
          </div>
          <span class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">已归档</span>
        </div>
        <div class="mt-3 text-[11px] uppercase tracking-widest text-blue-200">SN: ${escapeHtml(item.sn || "-")}</div>
        <div class="mt-2 text-xs text-white/70">归档时间：${escapeHtml(item.archivedAt || "-")}</div>
        <div class="mt-1 text-xs text-white/60">归档原因：${escapeHtml(item.archiveReason || "manual_archive")}</div>
      </div>
    `).join("") : `<div class="rounded-2xl bg-white/5 px-4 py-4 text-sm text-white/60">暂无归档设备历史</div>`;
  }
}

function renderPhotos(customer) {
  const wrap = document.getElementById("customer-photos");
  const rows = Array.isArray(customer.photos) ? customer.photos : [];
  wrap.innerHTML = rows.length ? rows.map((item) => `
    <div class="group relative overflow-hidden rounded-[1.5rem] aspect-video bg-slate-100">
      <img class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title)}" />
      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-4 text-white">
        <div class="text-sm font-bold">${escapeHtml(item.title)}</div>
        <div class="mt-1 text-xs text-white/70">${escapeHtml(item.takenAt || "-")}</div>
      </div>
    </div>
  `).join("") : `<div class="rounded-2xl bg-surface-container-low px-4 py-6 text-sm text-slate-500 md:col-span-2">暂无现场照片</div>`;
}

function renderWarranty(customer) {
  const wrap = document.getElementById("customer-warranty-history");
  const rows = Array.isArray(customer.warrantyHistory) ? customer.warrantyHistory : [];
  wrap.innerHTML = rows.length ? rows.map((item) => `
    <div class="flex items-start gap-3">
      <div class="mt-2 h-2 w-2 rounded-full bg-secondary shrink-0"></div>
      <div>
        <div class="text-sm font-bold text-slate-800">${escapeHtml(item.title)}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.detail || item.date || "-")}</div>
        <div class="mt-1 text-[11px] text-slate-400">${escapeHtml(item.serialNo ? `SN: ${item.serialNo}` : item.date || "-")}</div>
      </div>
    </div>
  `).join("") : `<div class="rounded-2xl bg-surface-container-low px-4 py-6 text-sm text-slate-500">暂无保修记录</div>`;
  document.getElementById("customer-warranty-ends").textContent = customer.warrantyEndsAt || "-";
  if (document.getElementById("customer-warranty-ends-input")) {
    document.getElementById("customer-warranty-ends-input").value = customer.warrantyEndsAt || "";
  }
}

function renderWarrantySearchResults(items = []) {
  const wrap = document.getElementById("customer-warranty-search-results");
  if (!wrap) return;
  wrap.innerHTML = items.length ? items.map((item) => `
    <button class="w-full rounded-2xl bg-white px-4 py-4 border border-outline-variant/10 text-left" type="button" data-serial-no="${escapeHtml(item.serialNo || "")}" data-device-name="${escapeHtml(item.deviceName || "")}" data-warranty-ends="${escapeHtml(item.warrantyEndsAt || "")}">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="font-bold text-primary">${escapeHtml(item.customerName || "-")}</div>
          <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.deviceName || "-")} / ${escapeHtml(item.serialNo || "-")}</div>
          <div class="mt-1 text-xs text-slate-400">${escapeHtml(item.phone || "-")}</div>
        </div>
        <div class="text-right text-xs text-slate-500">保修到期：${escapeHtml(item.warrantyEndsAt || "-")}</div>
      </div>
      <div class="mt-3 space-y-2">
        ${(Array.isArray(item.history) && item.history.length ? item.history : [{ title: "暂无保修记录", detail: "", date: "" }]).map((history) => `
          <div class="rounded-xl bg-surface-container-low px-3 py-3">
            <div class="text-sm font-bold text-slate-800">${escapeHtml(history.title || "-")}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(history.detail || "-")}</div>
            <div class="mt-1 text-[11px] text-slate-400">${escapeHtml(history.serialNo ? `SN: ${history.serialNo}` : history.date || "-")}</div>
          </div>
        `).join("")}
      </div>
    </button>
  `).join("") : `<div class="rounded-2xl bg-white px-4 py-4 text-sm text-slate-500 border border-outline-variant/10">输入序列号后可查询保修记录</div>`;
}

function ensureCustomerActionDefaults(customer = null) {
  const paymentDate = document.getElementById("customer-payment-date-input");
  if (paymentDate && !paymentDate.value) paymentDate.value = todayValue();

  const warrantyDate = document.getElementById("customer-warranty-date-input");
  if (warrantyDate && !warrantyDate.value) warrantyDate.value = todayValue();

  const warrantyEnds = document.getElementById("customer-warranty-ends-input");
  if (warrantyEnds && !warrantyEnds.value && customer?.warrantyEndsAt) {
    warrantyEnds.value = customer.warrantyEndsAt;
  }

  const collector = document.getElementById("customer-payment-collector-select");
  if (collector && !collector.value && collector.options.length > 1) {
    const preferred = customerState.salesPeople.find((item) => item.role === "admin")
      || customerState.salesPeople.find((item) => item.role === "sales_manager")
      || customerState.salesPeople[0];
    collector.value = preferred?.name || collector.options[1]?.value || "";
  }
}

function renderCustomerDetail() {
  const customer = getSelectedCustomer();
  if (!customer) return;
  renderHeader(customer);
  renderBasicInfo(customer);
  renderOrders(customer);
  renderRelatedQuotes(customer);
  renderRelatedRepairs(customer);
  renderPayment(customer);
  renderPaymentHistory(customer);
  renderDevices(customer);
  renderPhotos(customer);
  renderWarranty(customer);
  renderWarrantySearchResults([]);
  ensureCustomerActionDefaults(customer);
}

function fillSalesOptions() {
  const salesSelect = document.getElementById("form-customer-sales");
  salesSelect.innerHTML = `<option value="">未分配</option>` + customerState.salesPeople.map((item) => `
    <option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel || "")}</option>
  `).join("");

  const collectorSelect = document.getElementById("customer-payment-collector-select");
  collectorSelect.innerHTML = `<option value="">选择收款人</option>` + customerState.salesPeople
    .filter((item) => ["sales", "sales_manager", "admin"].includes(item.role))
    .map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel || "")}</option>`)
    .join("");
  ensureCustomerActionDefaults(getSelectedCustomer());
}

function openModal(customer) {
  const modal = document.getElementById("customer-modal");
  document.getElementById("customer-modal-title").textContent = customer ? "编辑客户" : "新增客户";
  document.getElementById("customer-id").value = customer?.id || "";
  document.getElementById("form-customer-name").value = customer?.name || "";
  document.getElementById("form-customer-archive").value = customer?.archiveNo || "";
  document.getElementById("form-customer-contact").value = customer?.contactName || "";
  document.getElementById("form-customer-phone").value = customer?.phone || "";
  document.getElementById("form-customer-email").value = customer?.email || "";
  document.getElementById("form-customer-province").value = customer?.province || "";
  document.getElementById("form-customer-location").value = customer?.location || "";
  document.getElementById("form-customer-usage").value = getCustomerPowerUsageType(customer || {});
  document.getElementById("form-customer-install").value = customer?.installDate || "";
  document.getElementById("form-customer-sales").value = customer?.salesPersonId || "";
  document.getElementById("form-customer-paid").value = customer?.payment?.paidAmount || 0;
  document.getElementById("form-customer-balance").value = customer?.payment?.balanceAmount || 0;
  document.getElementById("form-customer-cycle").value = customer?.payment?.cycleLabel || "";
  document.getElementById("form-customer-completed").value = customer?.payment?.completedWeeks || 0;
  document.getElementById("form-customer-total-weeks").value = customer?.payment?.totalWeeks || 1;
  document.getElementById("form-customer-next-due").value = customer?.payment?.nextDueLabel || "";
  document.getElementById("form-customer-address").value = customer?.address || "";
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeModal() {
  const modal = document.getElementById("customer-modal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function collectFormPayload() {
  const selectedSalesId = document.getElementById("form-customer-sales").value;
  const sales = customerState.salesPeople.find((item) => item.id === selectedSalesId);
  const current = getSelectedCustomer();
  return {
    id: document.getElementById("customer-id").value.trim(),
    archiveNo: document.getElementById("form-customer-archive").value.trim(),
    name: document.getElementById("form-customer-name").value.trim(),
    contactName: document.getElementById("form-customer-contact").value.trim(),
    phone: document.getElementById("form-customer-phone").value.trim(),
    email: document.getElementById("form-customer-email").value.trim(),
    province: document.getElementById("form-customer-province").value.trim(),
    location: document.getElementById("form-customer-location").value.trim(),
    usageType: document.getElementById("form-customer-usage").value.trim(),
    installDate: document.getElementById("form-customer-install").value.trim(),
    address: document.getElementById("form-customer-address").value.trim(),
    salesPersonId: sales?.id || "",
    salesPersonName: sales?.name || "",
    payment: {
      cycleLabel: document.getElementById("form-customer-cycle").value.trim(),
      completedWeeks: Number(document.getElementById("form-customer-completed").value || 0),
      totalWeeks: Number(document.getElementById("form-customer-total-weeks").value || 1),
      paidAmount: Number(document.getElementById("form-customer-paid").value || 0),
      balanceAmount: Number(document.getElementById("form-customer-balance").value || 0),
      nextDueLabel: document.getElementById("form-customer-next-due").value.trim()
    },
    paymentHistory: current?.paymentHistory || [],
    orders: current?.orders || [],
    devices: current?.devices || [],
    photos: current?.photos || [],
    warrantyHistory: current?.warrantyHistory || [],
    warrantyEndsAt: current?.warrantyEndsAt || ""
  };
}

async function loadSalesPeople() {
  const response = await fetch("/api/employees");
  const result = await response.json();
  customerState.salesPeople = (Array.isArray(result.items) ? result.items : []).filter((item) => item.role === "sales" || item.role === "sales_manager" || item.role === "admin");
  fillSalesOptions();
}

async function loadCustomerDetail(id) {
  if (!id) {
    customerState.currentDetail = null;
    renderCustomerDetail();
    return;
  }
  const response = await fetch(`/api/customers/detail?id=${encodeURIComponent(id)}`);
  const result = await response.json();
  if (!response.ok || result?.error) throw new Error(result?.error || "客户详情加载失败");
  customerState.currentDetail = result.customer || null;
  renderCustomerDetail();
}

async function saveCustomerDevices() {
  const customer = getSelectedCustomer();
  if (!customer) return;
  const type = document.getElementById("customer-device-type-input").value.trim();
  const name = document.getElementById("customer-device-name-input").value.trim();
  const sn = document.getElementById("customer-device-sn-input").value.trim();
  if (!type || !name || !sn) {
    window.alert("请填写设备类型、设备名称和序列号");
    return;
  }
  const currentDevices = Array.isArray(customer.devices) ? customer.devices : [];
  const nextDevices = [
    {
      id: `customer-device-${Date.now()}`,
      type,
      name,
      sn
    },
    ...currentDevices.filter((item) => String(item.sn || "").trim() !== sn)
  ];
  const result = await postJson("/api/customers/update", {
    id: customer.id,
    customer: {
      devices: nextDevices,
      warrantyEndsAt: document.getElementById("customer-warranty-ends-input").value || customer.warrantyEndsAt || ""
    }
  });
  if (!result.ok) {
    window.alert(result.error || "保存设备绑定失败");
    return;
  }
  document.getElementById("customer-device-type-input").value = "";
  document.getElementById("customer-device-name-input").value = "";
  document.getElementById("customer-device-sn-input").value = "";
  await loadCustomers();
}

async function updateCustomerDevices(nextDevices, errorText) {
  const customer = getSelectedCustomer();
  if (!customer) return;
  const result = await postJson("/api/customers/update", {
    id: customer.id,
    customer: {
      devices: nextDevices
    }
  });
  if (!result.ok) {
    window.alert(result.error || errorText);
    return;
  }
  await loadCustomers();
}

async function unbindCustomerDevice(deviceId) {
  const customer = getSelectedCustomer();
  if (!customer) return;
  const currentDevices = Array.isArray(customer.devices) ? customer.devices : [];
  const device = currentDevices.find((item) => item.id === deviceId);
  if (!device) return;
  if (!window.confirm(`确认解绑设备 ${device.name} 吗？`)) return;
  const nextDevices = currentDevices.filter((item) => item.id !== deviceId);
  await updateCustomerDevices(nextDevices, "解绑设备失败");
}

async function archiveCustomerDevice(deviceId) {
  const customer = getSelectedCustomer();
  if (!customer) return;
  const currentDevices = Array.isArray(customer.devices) ? customer.devices : [];
  const device = currentDevices.find((item) => item.id === deviceId);
  if (!device) return;
  if (!window.confirm(`确认归档设备 ${device.name} 吗？归档后默认不再显示。`)) return;
  const nextDevices = currentDevices.map((item) => item.id === deviceId ? {
    ...item,
    archived: true,
    archivedAt: new Date().toISOString(),
    archiveReason: "manual_archive"
  } : item);
  await updateCustomerDevices(nextDevices, "归档设备失败");
}

async function saveWarrantyEndsAt() {
  const customer = getSelectedCustomer();
  if (!customer) return;
  const warrantyEndsAt = document.getElementById("customer-warranty-ends-input").value || "";
  const result = await postJson("/api/customers/update", {
    id: customer.id,
    customer: {
      warrantyEndsAt
    }
  });
  if (!result.ok) {
    window.alert(result.error || "保存保修到期日失败");
    return;
  }
  await loadCustomers();
}

async function loadCustomers() {
  const response = await fetch("/api/customers");
  const result = await response.json();
  customerState.items = Array.isArray(result.items) ? result.items : [];
  customerState.summary = result.summary || customerState.summary;
  if (!customerState.currentId && customerState.items.length) {
    customerState.currentId = customerState.items[0].id;
  }
  renderSummary();
  renderCustomerSelect();
  await loadCustomerDetail(customerState.currentId);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

function bindEvents() {
  document.getElementById("customer-search").addEventListener("input", () => {
    renderCustomerSelect();
    loadCustomerDetail(customerState.currentId).catch(console.error);
  });

  document.getElementById("customer-select").addEventListener("change", (event) => {
    customerState.currentId = event.target.value;
    loadCustomerDetail(customerState.currentId).catch(console.error);
  });

  document.getElementById("customer-orders").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-archive-order]");
    if (!button) return;
    const customer = getSelectedCustomer();
    if (!customer) return;
    const orderId = button.getAttribute("data-archive-order") || "";
    const orderName = button.getAttribute("data-order-name") || orderId;
    if (!orderId) return;
    if (!window.confirm(`确认归档订单 ${orderName} 吗？归档后将不会显示在默认订单列表中。`)) return;
    const result = await postJson("/api/customers/order/archive", {
      customerId: customer.id,
      orderId
    });
    if (!result.ok) {
      window.alert(result.error || "归档订单失败");
      return;
    }
    await loadCustomers();
  });

  document.getElementById("customer-add-btn").addEventListener("click", () => openModal());
  document.getElementById("customer-edit-btn").addEventListener("click", () => {
    const customer = getSelectedCustomer();
    if (customer) openModal(customer);
  });

  document.getElementById("customer-delete-btn").addEventListener("click", async () => {
    const customer = getSelectedCustomer();
    if (!customer) return;
    if (!window.confirm(`确认归档客户 ${customer.name} 吗？归档后不会出现在默认列表中。`)) return;
    const result = await postJson("/api/customers/delete", { id: customer.id });
    if (!result.ok) {
      window.alert(result.error || "归档失败");
      return;
    }
    customerState.currentId = "";
    customerState.currentDetail = null;
    await loadCustomers();
  });

  document.getElementById("customer-payment-add-btn").addEventListener("click", async () => {
    const customer = getSelectedCustomer();
    if (!customer) return;
    const result = await postJson("/api/customers/payment", {
      id: customer.id,
      amount: Number(document.getElementById("customer-payment-amount-input").value || 0),
      paidAt: document.getElementById("customer-payment-date-input").value || "",
      collectorName: document.getElementById("customer-payment-collector-select").value || "",
      note: document.getElementById("customer-payment-note-input").value.trim()
    });
    if (!result.ok) {
      window.alert(result.error || "登记收款失败");
      return;
    }
    document.getElementById("customer-payment-amount-input").value = "";
    document.getElementById("customer-payment-date-input").value = todayValue();
    document.getElementById("customer-payment-note-input").value = "";
    await loadCustomers();
  });

  document.getElementById("customer-device-add-btn").addEventListener("click", saveCustomerDevices);
  document.getElementById("customer-warranty-ends-save-btn").addEventListener("click", saveWarrantyEndsAt);
  document.getElementById("customer-devices").addEventListener("click", async (event) => {
    const unbindButton = event.target.closest("[data-unbind-device]");
    if (unbindButton) {
      await unbindCustomerDevice(unbindButton.getAttribute("data-unbind-device") || "");
      return;
    }
    const archiveButton = event.target.closest("[data-archive-device]");
    if (archiveButton) {
      await archiveCustomerDevice(archiveButton.getAttribute("data-archive-device") || "");
    }
  });

  document.getElementById("customer-warranty-add-btn").addEventListener("click", async () => {
    const customer = getSelectedCustomer();
    if (!customer) return;
    const result = await postJson("/api/customers/warranty", {
      id: customer.id,
      serialNo: document.getElementById("customer-warranty-serial-input").value.trim(),
      title: document.getElementById("customer-warranty-title-input").value.trim(),
      date: document.getElementById("customer-warranty-date-input").value || "",
      detail: document.getElementById("customer-warranty-detail-input").value.trim(),
      warrantyEndsAt: document.getElementById("customer-warranty-ends-input").value || customer.warrantyEndsAt || ""
    });
    if (!result.ok) {
      window.alert(result.error || "新增保修失败");
      return;
    }
    document.getElementById("customer-warranty-serial-input").value = "";
    document.getElementById("customer-warranty-title-input").value = "";
    document.getElementById("customer-warranty-date-input").value = todayValue();
    document.getElementById("customer-warranty-detail-input").value = "";
    await loadCustomers();
  });

  document.getElementById("customer-warranty-search-btn").addEventListener("click", async () => {
    const serial = document.getElementById("customer-warranty-serial-search").value.trim();
    if (!serial) {
      renderWarrantySearchResults([]);
      return;
    }
    const response = await fetch(`/api/customers/warranty-search?serial=${encodeURIComponent(serial)}`);
    const result = await response.json();
    if (!response.ok || !result.ok) {
      window.alert(result.error || "序列号查询失败");
      return;
    }
    renderWarrantySearchResults(Array.isArray(result.items) ? result.items : []);
  });

  document.getElementById("customer-warranty-search-results").addEventListener("click", (event) => {
    const card = event.target.closest("[data-serial-no]");
    if (!card) return;
    const serialNo = card.getAttribute("data-serial-no") || "";
    const deviceName = card.getAttribute("data-device-name") || "";
    const warrantyEndsAt = card.getAttribute("data-warranty-ends") || "";
    document.getElementById("customer-warranty-serial-input").value = serialNo;
    if (!document.getElementById("customer-warranty-title-input").value.trim()) {
      document.getElementById("customer-warranty-title-input").value = deviceName ? `${deviceName} 保修` : "设备保修";
    }
    if (warrantyEndsAt) {
      document.getElementById("customer-warranty-ends-input").value = warrantyEndsAt;
    }
  });

  document.getElementById("customer-photo-add-btn").addEventListener("click", () => {
    document.getElementById("customer-photo-file-input").click();
  });

  document.getElementById("customer-photo-file-input").addEventListener("change", async (event) => {
    const customer = getSelectedCustomer();
    const [file] = Array.from(event.target.files || []);
    if (!customer || !file) return;
    const title = window.prompt("请输入照片标题", "安装现场照片");
    if (!title) {
      event.target.value = "";
      return;
    }
    const dataUrl = await readFileAsDataUrl(file);
    const result = await postJson("/api/customers/photo", {
      id: customer.id,
      title,
      takenAt: new Date().toLocaleString("zh-CN"),
      dataUrl
    });
    if (!result.ok) {
      window.alert(result.error || "上传照片失败");
      event.target.value = "";
      return;
    }
    event.target.value = "";
    await loadCustomers();
  });

  document.getElementById("customer-modal-close").addEventListener("click", closeModal);
  document.getElementById("customer-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("customer-modal").addEventListener("click", (event) => {
    if (event.target.id === "customer-modal") closeModal();
  });

  document.getElementById("customer-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = collectFormPayload();
    if (!payload.name || !payload.archiveNo) {
      window.alert("请先填写客户名称和档案编号");
      return;
    }
    const isEdit = Boolean(payload.id);
    const result = await postJson(
      isEdit ? "/api/customers/update" : "/api/customers",
      isEdit ? { id: payload.id, customer: payload } : { customer: payload }
    );
    if (!result.ok) {
      window.alert(result.error || "保存失败");
      return;
    }
    customerState.currentId = result.customer?.id || payload.id || customerState.currentId;
    customerState.currentDetail = null;
    closeModal();
    await loadCustomers();
  });
}

bindEvents();
Promise.all([loadSalesPeople(), loadCustomers()]).catch((error) => {
  console.error(error);
  document.getElementById("customer-basic-info").innerHTML = `<div class="rounded-2xl bg-red-50 px-4 py-4 text-sm text-red-700">客户数据加载失败。</div>`;
});

