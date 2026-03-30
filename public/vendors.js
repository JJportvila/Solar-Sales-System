const vendorsState = {
  data: null,
  selectedVendorId: "",
  submitting: false,
  orderLines: [],
  allowedRequesters: [],
  filters: {
    keyword: "",
    region: "all",
    category: "all",
    orderStatus: "all",
    currency: "all"
  }
};

const vendorPhoneFallback = {
  "vendor-shenzhen-solar": "+86 138 1100 2201",
  "vendor-ningbo-battery": "+86 139 4400 1808",
  "vendor-guangzhou-cable": "+86 137 2660 8812",
  "vendor-pacific-green": "+678 555 1042",
  "vendor-vse-local": "+678 555 0196",
  "vendor-shanghai-logistics": "+86 136 7177 6205"
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value, currency = "VT") {
  return `${currency} ${Math.max(0, Number(value || 0)).toLocaleString("en-US")}`;
}

function getVendorPhone(item) {
  return item?.contactPhone || vendorPhoneFallback[item?.id] || "-";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getSelectedVendor(items = vendorsState.data?.items || []) {
  return items.find((item) => item.id === vendorsState.selectedVendorId) || null;
}

function getVendorOptions(vendorId) {
  return vendorsState.data?.purchaseOptions?.[vendorId] || [];
}

function renderRequesterOptions() {
  const select = document.getElementById("vendor-order-requested-by");
  if (!select) return;
  const current = select.value;
  select.innerHTML = vendorsState.allowedRequesters.map((item) => (
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel)}</option>`
  )).join("") || `<option value="">暂无可下单人员</option>`;
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
  if (!select.value && select.options.length) {
    select.value = select.options[0].value;
  }
}

function getFilteredData() {
  const data = vendorsState.data || { items: [], orders: [], sections: { chinaVendors: [], localVendors: [] } };
  const keyword = vendorsState.filters.keyword.trim().toLowerCase();
  const matchesKeyword = (vendor) => {
    if (!keyword) return true;
    const haystack = [
      vendor.name,
      vendor.contactName,
      vendor.contactRole,
      getVendorPhone(vendor),
      vendor.category,
      vendor.secondaryCategory,
      ...(vendor.supportedItems || [])
    ].join(" ").toLowerCase();
    return haystack.includes(keyword);
  };
  const matchesRegion = (vendor) => {
    if (vendorsState.filters.region === "china") return vendor.region.includes("中国");
    if (vendorsState.filters.region === "local") return vendor.region.includes("维拉") || vendor.region.includes("本地");
    return true;
  };
  const matchesCategory = (vendor) => vendorsState.filters.category === "all" || vendor.category === vendorsState.filters.category;

  const filteredItems = (data.items || []).filter((vendor) => matchesKeyword(vendor) && matchesRegion(vendor) && matchesCategory(vendor));
  const vendorIds = new Set(filteredItems.map((item) => item.id));
  const filteredOrders = (data.orders || []).filter((order) => {
    if (!vendorIds.has(order.vendorId)) return false;
    if (vendorsState.filters.orderStatus !== "all" && order.status !== vendorsState.filters.orderStatus) return false;
    if (vendorsState.filters.currency !== "all" && order.currency !== vendorsState.filters.currency) return false;
    if (keyword) {
      const orderText = [order.vendorName, order.itemSummary, ...(order.lines || []).map((line) => line.itemName)].join(" ").toLowerCase();
      if (!orderText.includes(keyword)) return false;
    }
    return true;
  });

  return {
    items: filteredItems,
    orders: filteredOrders,
    chinaVendors: filteredItems.filter((item) => item.region.includes("中国")),
    localVendors: filteredItems.filter((item) => item.region.includes("维拉") || item.region.includes("本地"))
  };
}

function vendorCard(item, local = false) {
  const buttonLabel = local ? "服务采购" : "采购下单";
  const imageStyle = local
    ? "bg-[linear-gradient(135deg,#0f172a,#334155)]"
    : "bg-[linear-gradient(135deg,#111827,#6b7280)]";
  return `
    <button class="w-full rounded-[2rem] border ${vendorsState.selectedVendorId === item.id ? "border-primary shadow-lg shadow-blue-900/10 ring-2 ring-primary/10" : "border-outline-variant/10 shadow-sm"} bg-white p-6 text-left transition hover:shadow-lg" type="button" data-vendor-detail="${escapeHtml(item.id)}">
      <div class="flex flex-col gap-6 md:flex-row">
        <div class="flex h-44 w-full items-center justify-center rounded-xl ${imageStyle} text-white md:w-44">
          <span class="material-symbols-outlined text-6xl">${local ? "warehouse" : "solar_power"}</span>
        </div>
        <div class="flex flex-1 flex-col justify-between">
          <div>
            <div class="flex items-start justify-between gap-4">
              <div>
                <h3 class="text-xl font-bold text-primary">${escapeHtml(item.name)}</h3>
                <p class="mt-2 text-sm text-slate-500">${escapeHtml(item.locationTag || item.region)}</p>
              </div>
              <div class="rounded-xl bg-surface-container-low px-3 py-2 text-right">
                <div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">可靠度</div>
                <div class="mt-1 text-lg font-black text-primary">${escapeHtml(item.reliabilityScore)}%</div>
              </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <span class="rounded bg-surface-container-low px-2 py-1 text-[11px] font-semibold text-primary">${escapeHtml(item.category)}</span>
              <span class="rounded bg-surface-container-low px-2 py-1 text-[11px] font-semibold text-primary">${escapeHtml(item.secondaryCategory)}</span>
            </div>
            <div class="mt-5 grid grid-cols-1 gap-3 text-sm text-slate-500 md:grid-cols-2">
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-lg">person</span>
                <span>${escapeHtml(item.contactName)} / ${escapeHtml(item.contactRole)}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-lg">schedule</span>
                <span>交期约 ${item.leadTimeDays} 天</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-lg">receipt_long</span>
                <span>待执行订单 ${item.pendingOrders}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary text-lg">sell</span>
                <span>最低起订 ${money(item.minOrderVt)}</span>
              </div>
            </div>
          </div>
          <div class="mt-6 flex gap-2">
            <button class="flex-1 rounded-lg bg-primary py-2 text-sm font-bold text-white" type="button" data-vendor-order="${escapeHtml(item.id)}">${buttonLabel}</button>
            <span class="rounded-lg bg-surface-container-low px-4 py-2 text-sm font-bold text-primary">查看详情</span>
          </div>
        </div>
      </div>
    </button>
  `;
}

function renderTable(items = []) {
  const tbody = document.getElementById("vendors-table-body");
  tbody.innerHTML = items.map((item) => `
    <tr class="transition-colors hover:bg-slate-50">
      <td class="px-6 py-5">
        <div class="font-bold text-sm text-primary">${escapeHtml(item.name)}</div>
        <div class="text-[10px] uppercase text-slate-400">${escapeHtml(item.region)}</div>
      </td>
      <td class="px-6 py-5">
        <span class="rounded bg-surface-container-low px-2 py-1 text-[10px] font-bold text-primary">${escapeHtml(item.category)}</span>
      </td>
      <td class="px-6 py-5 font-mono text-sm">${item.reliabilityScore}</td>
      <td class="px-6 py-5 text-sm text-slate-600">${item.inTransitOrders}</td>
      <td class="px-6 py-5 text-right">
        <button class="rounded-lg bg-surface-container-low px-3 py-2 text-xs font-bold text-primary" type="button" data-vendor-order="${escapeHtml(item.id)}">下单</button>
      </td>
    </tr>
  `).join("");
}

function renderOrders(items = []) {
  const tbody = document.getElementById("vendors-orders-body");
  tbody.innerHTML = items.map((item) => `
    <tr class="transition-colors hover:bg-slate-50">
      <td class="px-6 py-4 font-bold text-primary">${escapeHtml(item.id)}</td>
      <td class="px-6 py-4">${escapeHtml(item.vendorName)}</td>
      <td class="px-6 py-4">${escapeHtml(item.itemSummary || "-")}</td>
      <td class="px-6 py-4">${escapeHtml(item.currency)}</td>
      <td class="px-6 py-4">${money(item.totalAmount, item.currency)}</td>
      <td class="px-6 py-4">
        <span class="rounded-full px-3 py-1 text-xs font-bold ${item.status === "in_transit" ? "bg-cyan-100 text-cyan-700" : item.status === "received" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-secondary"}">${escapeHtml(item.statusLabel)}</span>
      </td>
      <td class="px-6 py-4 text-sm text-slate-500">${formatDate(item.createdAt)}</td>
    </tr>
  `).join("");
}

function renderVendorDetail(item) {
  const panel = document.getElementById("vendors-detail-panel");
  if (!item) {
    panel.innerHTML = `<div class="rounded-[2rem] border border-outline-variant/10 bg-white p-6 shadow-sm text-sm text-slate-500">当前筛选条件下没有可查看的供应商。</div>`;
    return;
  }
  panel.innerHTML = `
    <div class="rounded-[2rem] border border-outline-variant/10 bg-white p-6 shadow-sm">
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.28em] text-secondary">供应商详情</div>
          <h3 class="mt-3 text-2xl font-extrabold text-primary">${escapeHtml(item.name)}</h3>
          <p class="mt-2 text-sm text-slate-500">${escapeHtml(item.region)} / ${escapeHtml(item.locationTag)}</p>
        </div>
        <button class="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white" type="button" data-vendor-order="${escapeHtml(item.id)}">立即下单</button>
      </div>
      <div class="mt-6 grid grid-cols-1 gap-4">
        <div class="rounded-2xl bg-surface-container-low p-4">
          <div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">联系人</div>
          <div class="mt-2 text-lg font-black text-primary">${escapeHtml(item.contactName || "-")}</div>
          <div class="mt-1 text-sm text-slate-500">${escapeHtml(item.contactRole || "-")}</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low p-4">
          <div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">联系电话</div>
          <div class="mt-2 text-lg font-black text-primary">${escapeHtml(getVendorPhone(item))}</div>
          <div class="mt-1 text-sm text-slate-500">采购沟通电话</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low p-4">
          <div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">最低起订</div>
          <div class="mt-2 text-lg font-black text-primary">${money(item.minOrderVt)}</div>
          <div class="mt-1 text-sm text-slate-500">采购单金额建议不低于此值</div>
        </div>
        <div class="rounded-2xl bg-surface-container-low p-4">
          <div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">交付周期</div>
          <div class="mt-2 text-lg font-black text-primary">${item.leadTimeDays} 天</div>
          <div class="mt-1 text-sm text-slate-500">${escapeHtml(item.transitMode)}</div>
        </div>
      </div>
      <div class="mt-6">
        <div class="text-sm font-bold text-primary">该供应商可供商品</div>
        <div class="mt-3 flex flex-wrap gap-2">
          ${(item.supportedItems || []).map((entry) => `<span class="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-primary">${escapeHtml(entry)}</span>`).join("")}
        </div>
      </div>
    </div>
  `;
}

function createLine(itemName = "", quantity = 1, unit = "pcs", unitPrice = 0) {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    itemName,
    quantity,
    unit,
    unitPrice
  };
}

function syncLineDefaults(line, option) {
  if (!option) return line;
  line.itemName = option.value;
  line.unit = option.unit || line.unit || "pcs";
  line.unitPrice = Number(option.defaultPrice || 0);
  return line;
}

function getCurrentCurrency() {
  return document.getElementById("vendor-order-currency").value || "CNY";
}

function renderOrderLines() {
  const wrap = document.getElementById("vendor-order-lines");
  const options = getVendorOptions(vendorsState.selectedVendorId);
  wrap.innerHTML = vendorsState.orderLines.map((line, index) => `
    <div class="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-[1.8fr_0.7fr_0.7fr_0.9fr_auto]">
        <label class="block">
          <span class="mb-2 block text-xs font-bold text-slate-500">商品</span>
          <select class="vendor-line-item w-full rounded-xl border border-outline-variant/20 px-3 py-3 text-sm" data-line-index="${index}">
            ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === line.itemName ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
          </select>
        </label>
        <label class="block">
          <span class="mb-2 block text-xs font-bold text-slate-500">数量</span>
          <input class="vendor-line-qty w-full rounded-xl border border-outline-variant/20 px-3 py-3 text-sm" data-line-index="${index}" min="1" type="number" value="${line.quantity}" />
        </label>
        <label class="block">
          <span class="mb-2 block text-xs font-bold text-slate-500">单位</span>
          <input class="vendor-line-unit w-full rounded-xl border border-outline-variant/20 px-3 py-3 text-sm" data-line-index="${index}" type="text" value="${escapeHtml(line.unit)}" />
        </label>
        <label class="block">
          <span class="mb-2 block text-xs font-bold text-slate-500">单价</span>
          <input class="vendor-line-price w-full rounded-xl border border-outline-variant/20 px-3 py-3 text-sm" data-line-index="${index}" min="0" type="number" value="${line.unitPrice}" />
        </label>
        <div class="flex items-end">
          <button class="vendor-line-remove rounded-xl bg-white px-4 py-3 text-sm font-bold text-red-600" type="button" data-line-index="${index}" ${vendorsState.orderLines.length === 1 ? "disabled" : ""}>删除</button>
        </div>
      </div>
      <div class="mt-3 text-sm font-bold text-primary">小计：${money(line.quantity * line.unitPrice, getCurrentCurrency())}</div>
    </div>
  `).join("");
  updateOrderSummary();
}

function rebuildLinesForVendor(vendorId) {
  const options = getVendorOptions(vendorId);
  if (!options.length) {
    vendorsState.orderLines = [createLine("", 1, "pcs", 0)];
    renderOrderLines();
    return;
  }
  vendorsState.orderLines = vendorsState.orderLines
    .filter((line) => options.some((option) => option.value === line.itemName))
    .map((line) => syncLineDefaults(line, options.find((option) => option.value === line.itemName)));
  if (!vendorsState.orderLines.length) {
    vendorsState.orderLines = [syncLineDefaults(createLine(), options[0])];
  }
  renderOrderLines();
}

function updateOrderSummary() {
  const currency = getCurrentCurrency();
  const total = vendorsState.orderLines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0), 0);
  document.getElementById("vendor-order-amount").textContent = money(total, currency);
}

function populateCategoryOptions(items = []) {
  const select = document.getElementById("vendors-filter-category");
  const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
  select.innerHTML = `<option value="all">全部类别</option>${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}`;
  select.value = vendorsState.filters.category;
}

function updateFilterSummary(filteredItems, filteredOrders) {
  document.getElementById("vendors-filter-result").textContent = `${filteredItems.length} 家供应商 / ${filteredOrders.length} 张采购单`;
}

function renderSummaryDetail(kicker, title, summary, headers, rows) {
  document.getElementById("vendors-summary-detail-kicker").textContent = kicker;
  document.getElementById("vendors-summary-detail-title").textContent = title;
  document.getElementById("vendors-summary-detail-summary").textContent = summary;
  const tableWrap = document.getElementById("vendors-summary-detail-table");
  if (!rows.length) {
    tableWrap.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-4 py-6 text-center text-sm text-slate-500">暂无明细数据</div>`;
  } else {
    tableWrap.innerHTML = `
      <table class="w-full min-w-[760px] border-separate border-spacing-y-3 text-left">
        <thead>
          <tr class="text-xs uppercase tracking-wider text-slate-400">
            ${headers.map((header) => `<th class="px-4 pb-2">${escapeHtml(header)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr class="bg-surface-container-low">
              ${row.map((cell, index) => `<td class="${index === 0 ? "rounded-l-2xl" : ""} ${index === row.length - 1 ? "rounded-r-2xl" : ""} px-4 py-4 text-sm text-slate-700">${cell}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }
  const panel = document.getElementById("vendors-summary-detail");
  panel.classList.remove("hidden");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openActiveVendorsDetail() {
  const filtered = getFilteredData();
  const activeItems = filtered.items.filter((item) => item.isActive);
  renderSummaryDetail(
    "活跃供应商",
    "活跃供应商总数详情",
    `当前筛选条件下共有 ${activeItems.length} 家活跃供应商。`,
    ["供应商", "区域", "联系人", "电话", "类别"],
    activeItems.map((item) => [
      escapeHtml(item.name),
      escapeHtml(item.region),
      escapeHtml(item.contactName),
      escapeHtml(getVendorPhone(item)),
      escapeHtml(item.category)
    ])
  );
}

function openPendingOrdersDetail() {
  const filtered = getFilteredData();
  const pendingOrders = filtered.orders.filter((item) => item.status === "pending" || item.status === "approved");
  renderSummaryDetail(
    "待执行订单",
    "待执行采购单详情",
    `当前筛选条件下共有 ${pendingOrders.length} 张待执行采购单。`,
    ["订单号", "供应商", "采购明细", "币种", "总金额", "状态"],
    pendingOrders.map((item) => [
      escapeHtml(item.id),
      escapeHtml(item.vendorName),
      escapeHtml(item.itemSummary || "-"),
      escapeHtml(item.currency),
      money(item.totalAmount, item.currency),
      escapeHtml(item.statusLabel)
    ])
  );
}

function openTransitOrdersDetail() {
  const filtered = getFilteredData();
  const transitOrders = filtered.orders.filter((item) => item.status === "in_transit");
  renderSummaryDetail(
    "海运在途",
    "海运在途批次详情",
    `当前筛选条件下共有 ${transitOrders.length} 个海运在途批次。`,
    ["订单号", "供应商", "采购明细", "币种", "总金额", "创建时间"],
    transitOrders.map((item) => [
      escapeHtml(item.id),
      escapeHtml(item.vendorName),
      escapeHtml(item.itemSummary || "-"),
      escapeHtml(item.currency),
      money(item.totalAmount, item.currency),
      formatDate(item.createdAt)
    ])
  );
}

function openReliabilityDetail() {
  const filtered = getFilteredData();
  const sorted = [...filtered.items].sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  const avg = sorted.length ? (sorted.reduce((sum, item) => sum + item.reliabilityScore, 0) / sorted.length).toFixed(1) : "0.0";
  renderSummaryDetail(
    "供应商评分",
    "平均供应商评分详情",
    `当前筛选条件下平均评分为 ${avg}%。`,
    ["供应商", "评分", "联系人", "电话", "待执行订单"],
    sorted.map((item) => [
      escapeHtml(item.name),
      `${item.reliabilityScore}%`,
      escapeHtml(item.contactName),
      escapeHtml(getVendorPhone(item)),
      String(item.pendingOrders)
    ])
  );
}

function render(data) {
  vendorsState.data = data;
  populateCategoryOptions(data.items || []);
  const filtered = getFilteredData();

  document.getElementById("vendors-active-count").textContent = String(filtered.items.filter((item) => item.isActive).length);
  document.getElementById("vendors-orders-pending").textContent = String(filtered.orders.filter((item) => item.status === "pending" || item.status === "approved").length);
  const avg = filtered.items.length ? (filtered.items.reduce((sum, item) => sum + item.reliabilityScore, 0) / filtered.items.length).toFixed(1) : "0.0";
  document.getElementById("vendors-reliability").textContent = `${avg}%`;
  document.getElementById("vendors-transit-count").textContent = String(filtered.orders.filter((item) => item.status === "in_transit").length);
  document.getElementById("vendors-china-grid").innerHTML = filtered.chinaVendors.map((item) => vendorCard(item, false)).join("");
  document.getElementById("vendors-local-grid").innerHTML = filtered.localVendors.map((item) => vendorCard(item, true)).join("");
  renderTable(filtered.items);
  renderOrders(filtered.orders);
  updateFilterSummary(filtered.items, filtered.orders);

  if (!filtered.items.some((item) => item.id === vendorsState.selectedVendorId)) {
    vendorsState.selectedVendorId = filtered.items[0]?.id || "";
  }

  document.getElementById("vendor-order-vendor").innerHTML = (filtered.items.length ? filtered.items : (data.items || [])).map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  if (vendorsState.selectedVendorId) {
    document.getElementById("vendor-order-vendor").value = vendorsState.selectedVendorId;
  }
  renderVendorDetail(getSelectedVendor(filtered.items));
  if (vendorsState.selectedVendorId) {
    rebuildLinesForVendor(vendorsState.selectedVendorId);
  }
}

function openOrderModal(vendorId = "") {
  const sourceItems = getFilteredData().items.length ? getFilteredData().items : (vendorsState.data?.items || []);
  if (vendorId) vendorsState.selectedVendorId = vendorId;
  if (!vendorsState.selectedVendorId && sourceItems.length) vendorsState.selectedVendorId = sourceItems[0].id;
  document.getElementById("vendor-order-vendor").innerHTML = sourceItems.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
  document.getElementById("vendor-order-vendor").value = vendorsState.selectedVendorId;
  document.getElementById("vendor-order-currency").value = "CNY";
  renderRequesterOptions();
  document.getElementById("vendor-order-notes").value = "";
  rebuildLinesForVendor(vendorsState.selectedVendorId);
  renderVendorDetail(getSelectedVendor(sourceItems));
  document.getElementById("vendors-order-modal").classList.remove("hidden");
}

function closeOrderModal() {
  document.getElementById("vendors-order-modal").classList.add("hidden");
}

function addOrderLine() {
  const options = getVendorOptions(vendorsState.selectedVendorId);
  if (!options.length) return;
  vendorsState.orderLines.push(syncLineDefaults(createLine(), options[0]));
  renderOrderLines();
}

function resetFilters() {
  vendorsState.filters = {
    keyword: "",
    region: "all",
    category: "all",
    orderStatus: "all",
    currency: "all"
  };
  document.getElementById("vendors-filter-keyword").value = "";
  document.getElementById("vendors-filter-region").value = "all";
  document.getElementById("vendors-filter-category").value = "all";
  document.getElementById("vendors-filter-order-status").value = "all";
  document.getElementById("vendors-filter-currency").value = "all";
  render(vendorsState.data);
}

async function submitOrder() {
  if (vendorsState.submitting) return;
  vendorsState.submitting = true;
  const payload = {
    vendorId: document.getElementById("vendor-order-vendor").value,
    currency: getCurrentCurrency(),
    requestedById: document.getElementById("vendor-order-requested-by").value,
    notes: document.getElementById("vendor-order-notes").value,
    lines: vendorsState.orderLines.map((line) => ({
      itemName: line.itemName,
      quantity: Number(line.quantity || 1),
      unit: line.unit,
      unitPrice: Number(line.unitPrice || 0)
    }))
  };

  try {
    const response = await fetch("/api/vendors/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "下单失败");
    closeOrderModal();
    render(result.data);
  } catch (error) {
    window.alert(error.message || "下单失败");
  } finally {
    vendorsState.submitting = false;
  }
}

async function loadAllowedRequesters() {
  const response = await fetch("/api/employees");
  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];
  vendorsState.allowedRequesters = items.filter((item) => (
    item.status !== "resigned" && (item.role === "admin" || item.role === "sales_manager")
  ));
  renderRequesterOptions();
}

async function loadVendors() {
  const response = await fetch("/api/vendors");
  const data = await response.json();
  render(data);
}

function bindEvents() {
  document.getElementById("vendors-filter-toggle").addEventListener("click", () => {
    document.getElementById("vendors-filter-panel").classList.toggle("hidden");
  });
  document.getElementById("vendors-filter-reset").addEventListener("click", resetFilters);
  document.getElementById("vendors-summary-active").addEventListener("click", openActiveVendorsDetail);
  document.getElementById("vendors-summary-pending").addEventListener("click", openPendingOrdersDetail);
  document.getElementById("vendors-summary-transit").addEventListener("click", openTransitOrdersDetail);
  document.getElementById("vendors-summary-reliability").addEventListener("click", openReliabilityDetail);
  document.getElementById("vendors-summary-detail-close").addEventListener("click", () => {
    document.getElementById("vendors-summary-detail").classList.add("hidden");
  });

  document.getElementById("vendors-filter-keyword").addEventListener("input", (event) => {
    vendorsState.filters.keyword = event.target.value;
    render(vendorsState.data);
  });
  document.getElementById("vendors-filter-region").addEventListener("change", (event) => {
    vendorsState.filters.region = event.target.value;
    render(vendorsState.data);
  });
  document.getElementById("vendors-filter-category").addEventListener("change", (event) => {
    vendorsState.filters.category = event.target.value;
    render(vendorsState.data);
  });
  document.getElementById("vendors-filter-order-status").addEventListener("change", (event) => {
    vendorsState.filters.orderStatus = event.target.value;
    render(vendorsState.data);
  });
  document.getElementById("vendors-filter-currency").addEventListener("change", (event) => {
    vendorsState.filters.currency = event.target.value;
    render(vendorsState.data);
  });

  document.getElementById("vendors-quick-create").addEventListener("click", () => openOrderModal(vendorsState.selectedVendorId));
  document.getElementById("vendor-order-close").addEventListener("click", closeOrderModal);
  document.getElementById("vendor-order-cancel").addEventListener("click", closeOrderModal);
  document.getElementById("vendor-order-submit").addEventListener("click", submitOrder);
  document.getElementById("vendor-order-add-line").addEventListener("click", addOrderLine);
  document.getElementById("vendor-order-currency").addEventListener("change", updateOrderSummary);
  document.getElementById("vendor-order-vendor").addEventListener("change", (event) => {
    vendorsState.selectedVendorId = event.target.value;
    rebuildLinesForVendor(vendorsState.selectedVendorId);
    renderVendorDetail(getSelectedVendor(getFilteredData().items));
  });

  document.getElementById("vendor-order-lines").addEventListener("input", (event) => {
    const index = Number(event.target.dataset.lineIndex);
    if (!Number.isInteger(index) || !vendorsState.orderLines[index]) return;
    const line = vendorsState.orderLines[index];
    if (event.target.classList.contains("vendor-line-qty")) line.quantity = Math.max(1, Number(event.target.value || 1));
    if (event.target.classList.contains("vendor-line-unit")) line.unit = event.target.value || "pcs";
    if (event.target.classList.contains("vendor-line-price")) line.unitPrice = Math.max(0, Number(event.target.value || 0));
    renderOrderLines();
  });

  document.getElementById("vendor-order-lines").addEventListener("change", (event) => {
    const index = Number(event.target.dataset.lineIndex);
    if (!Number.isInteger(index) || !vendorsState.orderLines[index]) return;
    if (event.target.classList.contains("vendor-line-item")) {
      const options = getVendorOptions(vendorsState.selectedVendorId);
      const option = options.find((entry) => entry.value === event.target.value);
      if (option) {
        syncLineDefaults(vendorsState.orderLines[index], option);
        renderOrderLines();
      }
    }
  });

  document.getElementById("vendor-order-lines").addEventListener("click", (event) => {
    const button = event.target.closest(".vendor-line-remove");
    if (!button) return;
    const index = Number(button.dataset.lineIndex);
    if (!Number.isInteger(index)) return;
    vendorsState.orderLines.splice(index, 1);
    if (!vendorsState.orderLines.length) addOrderLine();
    renderOrderLines();
  });

  document.addEventListener("click", (event) => {
    const orderButton = event.target.closest("[data-vendor-order]");
    if (orderButton) {
      event.stopPropagation();
      openOrderModal(orderButton.getAttribute("data-vendor-order"));
      return;
    }
    const detailButton = event.target.closest("[data-vendor-detail]");
    if (detailButton) {
      vendorsState.selectedVendorId = detailButton.getAttribute("data-vendor-detail");
      render(vendorsState.data);
    }
  });
}

bindEvents();
loadAllowedRequesters()
  .then(() => loadVendors())
  .catch((error) => console.error(error));
