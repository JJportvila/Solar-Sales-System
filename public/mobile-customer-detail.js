function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value) {
  return `VT ${Math.max(0, Number(value || 0)).toLocaleString("en-US")}`;
}

function emptyHtml(text) {
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

const detailState = {
  customerId: "",
  customer: null,
  collectors: [],
  photoPreviewUrl: "",
  warrantySearchItems: []
};

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || "提交失败");
  }
  return data;
}

function renderInfoGrid(customer) {
  const items = [
    { label: "档案编号", value: customer.archiveNo || "-", full: false },
    { label: "联系人", value: customer.contactName || "-", full: false },
    { label: "电话", value: customer.phone || "-", full: false },
    { label: "地区", value: customer.location || customer.province || "-", full: false },
    { label: "客户类型", value: customer.customerTypeLabel || "-", full: false },
    { label: "销售", value: customer.salesPersonName || "-", full: false },
    { label: "邮箱", value: customer.email || "-", full: true },
    { label: "地址", value: customer.address || "-", full: true }
  ];
  $("basic-grid").innerHTML = items.map((item) => `
    <div class="metric${item.full ? " span-full" : ""}">
      <label>${item.label}</label>
      <strong>${escapeHtml(item.value)}</strong>
    </div>
  `).join("");
}

function renderPayment(customer) {
  const payment = customer.payment || {};
  const percent = Math.max(0, Math.min(100, payment.totalWeeks ? Math.round((payment.completedWeeks / payment.totalWeeks) * 100) : 0));
  const totalAmount = Number(payment.totalAmount || 0) || (Number(payment.paidAmount || 0) + Number(payment.balanceAmount || 0));
  const warrantyValue = customer.warrantyEndsAt
    ? `到期 ${customer.warrantyEndsAt}`
    : `${Array.isArray(customer.warrantyHistory) ? customer.warrantyHistory.length : 0} 条记录`;

  $("payment-grid").innerHTML = [
    { label: "合同总额", value: money(totalAmount), full: false, amount: true },
    { label: "保修", value: warrantyValue, full: false, amount: false },
    { label: "累计已收", value: money(payment.paidAmount || 0), full: true, amount: true },
    { label: "未收余额", value: money(payment.balanceAmount || 0), full: true, amount: true },
    { label: "付款进度", value: `${payment.completedWeeks || 0} / ${payment.totalWeeks || 0}`, full: false, amount: false },
    { label: "分期周期", value: payment.cycleLabel || "-", full: false, amount: false },
    { label: "下次收款", value: payment.nextDueLabel || "-", full: false, amount: false },
    { label: "安装日期", value: customer.installDate || "-", full: false, amount: false }
  ].map((item) => `
    <div class="metric${item.full ? " span-full" : ""}">
      <label>${item.label}</label>
      <strong class="${item.amount ? "metric-amount" : ""}">${escapeHtml(item.value)}</strong>
    </div>
  `).join("");

  $("payment-progress").style.width = `${percent}%`;
}

function renderPaymentHistory(customer) {
  const items = Array.isArray(customer.paymentHistory) ? customer.paymentHistory : [];
  $("payment-history").innerHTML = items.length
    ? items.map((item) => `
      <div class="item">
        <div style="display:flex;justify-content:space-between;gap:10px;">
          <div>
            <div class="item-title">${escapeHtml(item.receiptNo || item.id || "-")}</div>
            <div class="item-meta">${escapeHtml(item.paidAt || "-")} / ${escapeHtml(item.collectorName || "-")}</div>
          </div>
          <div style="text-align:right;">
            <div class="item-title">${money(item.amount || 0)}</div>
            <div class="item-meta">${escapeHtml(item.note || "-")}</div>
          </div>
        </div>
      </div>
    `).join("")
    : emptyHtml("暂无收款记录");
}

function renderCollectors() {
  const roleLabels = {
    admin: "管理员",
    sales_manager: "销售经理",
    sales: "销售"
  };
  $("payment-collector").innerHTML = [`<option value="">选择收款人</option>`]
    .concat(
      detailState.collectors.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)} / ${escapeHtml(roleLabels[item.role] || item.roleLabel || item.role)}</option>`)
    )
    .join("");
}

function renderWarrantySearchResults(items = []) {
  $("warranty-search-results").innerHTML = items.length
    ? items.map((item) => `
      <button class="item" type="button" data-serial-select="${escapeHtml(item.serialNo || "")}" data-device-name="${escapeHtml(item.deviceName || "")}" style="text-align:left;cursor:pointer;">
        <div class="item-title">${escapeHtml(item.customerName || "-")}</div>
        <div class="item-meta">${escapeHtml(item.deviceName || "-")} / ${escapeHtml(item.serialNo || "-")}</div>
        <div class="item-meta" style="margin-top:4px;">${escapeHtml(item.phone || "-")} / 到期 ${escapeHtml(item.warrantyEndsAt || "-")}</div>
      </button>
    `).join("")
    : "";
}

function renderPhotoPreview(file) {
  if (detailState.photoPreviewUrl) {
    URL.revokeObjectURL(detailState.photoPreviewUrl);
    detailState.photoPreviewUrl = "";
  }
  if (!file) {
    $("photo-preview").innerHTML = "";
    return;
  }
  detailState.photoPreviewUrl = URL.createObjectURL(file);
  $("photo-preview").innerHTML = `<img src="${detailState.photoPreviewUrl}" alt="preview" />`;
}

function renderCardList(id, items, renderer, emptyText) {
  $(id).innerHTML = items.length ? items.map(renderer).join("") : emptyHtml(emptyText);
}

function renderCustomer(customer) {
  detailState.customer = customer;
  if ($("customer-name")) $("customer-name").textContent = customer.name || "客户详情";
  if ($("customer-subtitle")) $("customer-subtitle").textContent = `${customer.location || "-"} / ${customer.archiveNo || "-"}`;
  if ($("call-link")) $("call-link").href = customer.phone ? `tel:${customer.phone}` : "#";
  renderInfoGrid(customer);
  renderPayment(customer);
  renderPaymentHistory(customer);

  renderCardList("orders-list", Array.isArray(customer.orders) ? customer.orders : [], (item) => `
    <div class="item">
      <div style="display:flex;justify-content:space-between;gap:10px;">
        <div>
          <div class="item-title">${escapeHtml(item.name || "-")}</div>
          <div class="item-meta">#${escapeHtml(item.id || "-")} / ${escapeHtml(item.date || "-")}</div>
        </div>
        <span class="tag warn">${escapeHtml(item.status || "-")}</span>
      </div>
    </div>
  `, "暂无订单");

  renderCardList("quotes-list", Array.isArray(customer.relatedQuotes) ? customer.relatedQuotes : [], (item) => `
    <div class="item">
      <div style="display:flex;justify-content:space-between;gap:10px;">
        <div>
          <div class="item-title">${escapeHtml(item.packageName || "-")}</div>
          <div class="item-meta">${escapeHtml(item.createdAt || "-")} / ${escapeHtml(item.salesPersonName || "-")}</div>
        </div>
        <div style="text-align:right;">
          <div class="item-title">${money(item.total || 0)}</div>
          <div class="item-meta">${escapeHtml(item.status || "-")}</div>
        </div>
      </div>
    </div>
  `, "暂无关联报价");

  renderCardList("repairs-list", Array.isArray(customer.relatedRepairs) ? customer.relatedRepairs : [], (item) => `
    <div class="item">
      <div class="item-title">${escapeHtml(item.title || "-")}</div>
      <div class="item-meta">#${escapeHtml(item.id || "-")} / ${escapeHtml(item.assignedEngineer || "-")}</div>
      <div class="item-meta" style="margin-top:6px;">${escapeHtml(item.status || "-")} 路 ${escapeHtml(item.etaLabel || "-")}</div>
    </div>
  `, "暂无维修记录");

  renderCardList("warranty-list", Array.isArray(customer.warrantyHistory) ? customer.warrantyHistory : [], (item) => `
    <div class="item">
      <div class="item-title">${escapeHtml(item.title || "-")}</div>
      <div class="item-meta">${escapeHtml(item.date || "-")} ${item.serialNo ? `/ SN ${escapeHtml(item.serialNo)}` : ""}</div>
      <div class="item-meta" style="margin-top:6px;">${escapeHtml(item.detail || "-")}</div>
    </div>
  `, "暂无保修记录");

  $("photos-grid").innerHTML = Array.isArray(customer.photos) && customer.photos.length
    ? customer.photos.map((item) => `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.title || "photo")}" />`).join("")
    : emptyHtml("暂无现场照片");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

async function loadCustomerDetail(id) {
  const result = await fetchJson(`/api/customers/detail?id=${encodeURIComponent(id)}`);
  renderCustomer(result.customer || {});
}

async function submitPayment() {
  if (!detailState.customerId) return;
  const amount = Number($("payment-amount").value || 0);
  if (amount <= 0) {
    $("payment-status").textContent = "请输入有效收款金额";
    return;
  }
  try {
    await postJson("/api/customers/payment", {
      id: detailState.customerId,
      amount,
      paidAt: $("payment-date").value || "",
      collectorName: $("payment-collector").value || "",
      note: $("payment-note").value.trim()
    });
    $("payment-amount").value = "";
    $("payment-date").value = "";
    $("payment-collector").value = "";
    $("payment-note").value = "";
    $("payment-status").textContent = "收款登记成功";
    await loadCustomerDetail(detailState.customerId);
  } catch (error) {
    $("payment-status").textContent = error.message || "收款登记失败";
  }
}

async function submitWarranty() {
  if (!detailState.customerId) return;
  const title = $("warranty-title").value.trim();
  if (!title) {
    $("warranty-status").textContent = "请输入保修标题";
    return;
  }
  try {
    await postJson("/api/customers/warranty", {
      id: detailState.customerId,
      serialNo: $("warranty-serial").value.trim(),
      title,
      date: $("warranty-date").value || "",
      detail: $("warranty-detail").value.trim(),
      warrantyEndsAt: detailState.customer?.warrantyEndsAt || ""
    });
    $("warranty-title").value = "";
    $("warranty-serial").value = "";
    $("warranty-date").value = "";
    $("warranty-detail").value = "";
    $("warranty-status").textContent = "保修记录已新增";
    await loadCustomerDetail(detailState.customerId);
  } catch (error) {
    $("warranty-status").textContent = error.message || "新增保修失败";
  }
}

async function searchWarrantySerial() {
  const keyword = $("warranty-search").value.trim();
  if (!keyword) {
    detailState.warrantySearchItems = [];
    renderWarrantySearchResults([]);
    $("warranty-status").textContent = "请输入序列号后查询";
    return;
  }
  try {
    const result = await fetchJson(`/api/customers/warranty-search?serial=${encodeURIComponent(keyword)}`);
    detailState.warrantySearchItems = Array.isArray(result.items) ? result.items : [];
    renderWarrantySearchResults(detailState.warrantySearchItems);
    $("warranty-status").textContent = detailState.warrantySearchItems.length ? "请选择匹配设备以自动填充" : "未找到匹配序列号";
  } catch (error) {
    $("warranty-status").textContent = error.message || "序列号查询失败";
  }
}

async function submitPhoto() {
  if (!detailState.customerId) return;
  const title = $("photo-title").value.trim();
  const file = $("photo-file").files?.[0];
  if (!title) {
    $("photo-status").textContent = "请输入照片标题";
    return;
  }
  if (!file) {
    $("photo-status").textContent = "请选择照片";
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    await postJson("/api/customers/photo", {
      id: detailState.customerId,
      title,
      takenAt: new Date().toLocaleString("zh-CN"),
      dataUrl
    });
    $("photo-title").value = "";
    $("photo-file").value = "";
    renderPhotoPreview(null);
    $("photo-status").textContent = "现场照片已上传";
    await loadCustomerDetail(detailState.customerId);
  } catch (error) {
    $("photo-status").textContent = error.message || "上传照片失败";
  }
}

async function init() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    if ($("customer-subtitle")) $("customer-subtitle").textContent = "缺少客户 ID";
    return;
  }
  detailState.customerId = id;
  try {
    const detailResult = await fetchJson(`/api/customers/detail?id=${encodeURIComponent(id)}`);
    try {
      const authOptions = await fetchJson("/api/auth/options");
      detailState.collectors = (authOptions.items || []).filter((item) => ["sales", "sales_manager", "admin"].includes(item.role));
    } catch (_error) {
      detailState.collectors = [];
    }
    renderCollectors();
    $("payment-date").value = new Date().toISOString().slice(0, 10);
    $("warranty-date").value = new Date().toISOString().slice(0, 10);
    renderCustomer(detailResult.customer || {});
    $("payment-submit").addEventListener("click", submitPayment);
    $("warranty-submit").addEventListener("click", submitWarranty);
    $("photo-submit").addEventListener("click", submitPhoto);
    $("warranty-search-btn").addEventListener("click", searchWarrantySerial);
    $("photo-file").addEventListener("change", (event) => {
      renderPhotoPreview(event.target.files?.[0] || null);
    });
    $("warranty-search-results").addEventListener("click", (event) => {
      const button = event.target.closest("[data-serial-select]");
      if (!button) return;
      const serialNo = button.getAttribute("data-serial-select") || "";
      const deviceName = button.getAttribute("data-device-name") || "";
      $("warranty-serial").value = serialNo;
      if (!$("warranty-title").value.trim()) {
        $("warranty-title").value = deviceName ? `${deviceName} 保修` : "设备保修";
      }
      $("warranty-status").textContent = "已带入序列号，可继续提交保修记录";
    });
  } catch (error) {
    if ($("customer-subtitle")) $("customer-subtitle").textContent = error.message || "客户详情加载失败";
  }
}

document.addEventListener("DOMContentLoaded", init);

