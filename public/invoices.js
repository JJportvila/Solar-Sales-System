const invoiceState = {
  items: [],
  filteredItems: [],
  activeItem: null,
  editingItem: null,
  previewDocType: "invoice",
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
};

const invoiceFormatter = new Intl.NumberFormat("en-US");

function invoiceMoney(value) {
  return `VT ${invoiceFormatter.format(Number(value || 0))}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getInvoiceDocStyle(docType) {
  if (docType === "quotation") {
    return {
      title: "QUOTATION",
      subtitle: "正式销售报价单",
      codeLabel: "报价单号",
      accent: "#0f766e",
      light: "#ecfeff"
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
    title: "INVOICE",
    subtitle: "正式销售发票",
    codeLabel: "发票编号",
      accent: "#001d44",
      light: "#f8fafc"
    };
  }

function buildInvoiceHtml(item = {}, docType = invoiceState.previewDocType || "invoice") {
  const payload = item.payload || {};
  const customer = item.customer || payload.customer || {};
  const recommendation = payload.recommendation || {};
  const quote = payload.quote || {};
  const installment = payload.installmentPlan || {};
  const company = payload.settings?.company || invoiceState.company || {};
  const note = item.note || payload.note || "";
  const style = getInvoiceDocStyle(docType);
  const rows = [
    {
      description: item.packageName || recommendation.packageName || "太阳能套装",
      details: [recommendation.solarPanels, recommendation.battery, recommendation.inverter].filter(Boolean).join(" / "),
      amount: Number(quote.equipmentPrice || item.amount || 0)
    },
    Number(quote.installFee || 0) > 0 ? { description: "安装费", details: "安装服务", amount: Number(quote.installFee || 0) } : null,
    Number(quote.logisticsFee || 0) > 0 ? { description: "物流费", details: payload.location || "瓦努阿图", amount: Number(quote.logisticsFee || 0) } : null
  ].filter(Boolean);

  const rowHtml = rows.map((row, index) => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">${index + 1}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">
        <div style="font-weight:700;color:#0f172a;">${escapeHtml(row.description)}</div>
        <div style="margin-top:4px;font-size:12px;color:#64748b;">${escapeHtml(row.details || "-")}</div>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${invoiceMoney(row.amount)}</td>
    </tr>
  `).join("");

  const installmentHtml = installment.enabled && Array.isArray(installment.installments)
    ? `
      <div style="margin-top:18px;border-top:1px solid #dbe4f0;padding-top:14px;">
        <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">分期计划</div>
        <div style="margin-top:10px;font-size:13px;color:#475569;">定金日期：${escapeHtml(installment.depositDate || "-")}</div>
        <div style="margin-top:8px;font-size:13px;color:#475569;">周期：${escapeHtml(installment.cycleLabel || "-")} / 总分期：${escapeHtml(installment.termCount || installment.termWeeks || 0)}</div>
        <div style="margin-top:12px;">
          ${installment.installments.map((plan) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed #dbe4f0;font-size:13px;"><span>${escapeHtml(plan.label)} / ${escapeHtml(plan.dueDate || "-")}</span><strong>${invoiceMoney(plan.amount)}</strong></div>`).join("")}
        </div>
      </div>
    `
    : "";

  return `
    <div style="font-family:Inter,sans-serif;color:#0f172a;background:#ffffff;padding:14px 16px;max-width:186mm;margin:0 auto;">
      <div style="display:grid;grid-template-columns:0.66fr 1.34fr;gap:16px;padding-bottom:14px;border-bottom:3px solid ${style.accent};">
        <div>
          <div style="font-family:Manrope,sans-serif;font-size:28px;font-weight:800;letter-spacing:0.08em;color:${style.accent};">${style.title}</div>
          <div style="margin-top:4px;font-size:12px;color:#64748b;">${style.subtitle}</div>
          <div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:${style.light};">
            <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">客户信息</div>
            <div style="margin-top:8px;font-size:18px;font-weight:800;color:#0f172a;">${escapeHtml(item.customerName || customer.name || "-")}</div>
            <div style="margin-top:4px;font-size:12px;color:#475569;">${escapeHtml(item.customerPhone || customer.phone || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${escapeHtml(item.customerEmail || customer.email || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${escapeHtml(item.customerAddress || customer.address || "-")}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;align-items:flex-start;gap:${company.logoUrl ? "12px" : "0"};">
          ${company.logoUrl ? `<img alt="company logo" src="${escapeHtml(company.logoUrl)}" style="width:72px;height:72px;object-fit:contain;border-radius:14px;border:1px solid #e2e8f0;padding:8px;background:#fff;" />` : ""}
          <div style="text-align:right;">
            <div style="font-family:Manrope,sans-serif;font-size:23px;font-weight:800;color:${style.accent};">${escapeHtml(company.name || "VSLM Solar & Logistics")}</div>
            <div style="margin-top:4px;font-size:12px;color:#475569;">TIN: ${escapeHtml(company.tin || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${escapeHtml(company.address || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${escapeHtml(company.phone || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${escapeHtml(company.email || "-")}</div>
            <div style="margin-top:8px;font-size:12px;color:#64748b;">${style.codeLabel}: ${escapeHtml(item.invoiceNo || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#64748b;">开具日期: ${escapeHtml((item.issuedAt || "").slice(0, 10) || "-")}</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:18px;margin-top:18px;">
        <div style="border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:${style.light};">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">银行信息</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:8px 16px;margin-top:10px;font-size:13px;">
            <span style="color:#64748b;">银行名称</span><strong>${escapeHtml(company.bankName || "-")}</strong>
            <span style="color:#64748b;">账户名称</span><strong>${escapeHtml(company.bankAccountName || "-")}</strong>
            <span style="color:#64748b;">账号</span><strong>${escapeHtml(company.bankAccountNumber || "-")}</strong>
            <span style="color:#64748b;">销售人员</span><strong>${escapeHtml(item.salesPersonName || "-")}</strong>
          </div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:24px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <thead>
          <tr style="background:${style.accent};color:#ffffff;">
            <th style="text-align:left;padding:12px 10px;">#</th>
            <th style="text-align:left;padding:12px 10px;">项目说明</th>
            <th style="text-align:right;padding:12px 10px;">金额</th>
          </tr>
        </thead>
        <tbody>${rowHtml}</tbody>
      </table>

      <div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:${style.light};">
          <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">付款汇总</div>
          <div style="display:grid;grid-template-columns:1fr auto;gap:10px 16px;margin-top:12px;font-size:14px;">
            <span style="color:#64748b;">小计</span><strong>${invoiceMoney(quote.subtotalExclTax || item.amount || 0)}</strong>
            <span style="color:#64748b;">税额</span><strong>${invoiceMoney(quote.vat || 0)}</strong>
            ${installment.enabled ? `<span style="color:#64748b;">定金</span><strong>${invoiceMoney(installment.downPayment)}</strong>` : ""}
            <span style="font-family:Manrope,sans-serif;font-size:18px;font-weight:800;color:${style.accent};">${docType === "inquiry" ? "预估总额" : "应付总额"}</span><strong style="font-family:Manrope,sans-serif;font-size:22px;color:${style.accent};">${invoiceMoney(item.amount || quote.displayTotal || quote.total || 0)}</strong>
          </div>
          ${installmentHtml}
          ${note ? `<div style="margin-top:12px;font-size:13px;color:#475569;">备注：${escapeHtml(note)}</div>` : ""}
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:18px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <tbody>
          <tr>
            <td style="width:50%;padding:18px;border-right:1px solid #e2e8f0;">
              <div style="font-size:12px;color:#64748b;">销售签名</div>
              <div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div>
            </td>
            <td style="width:50%;padding:18px;">
              <div style="font-size:12px;color:#64748b;">客户签名</div>
              <div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function installmentCycleLabelEnglish(plan = {}) {
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
}

function installmentItemLabelEnglish(entry = {}, index = 0) {
  const seq = Number(entry.index || index + 1);
  return `Installment ${seq}`;
}

function includedTaxAmount(quote = {}) {
  const storedVat = Number(quote.vat || 0);
  if (storedVat > 0) return storedVat;
  const total = Math.max(0, Number(quote.displayTotal || quote.total || quote.totalInclTax || 0));
  const vatRate = Math.max(0, Number(quote.vatRate || 15));
  if (!total || vatRate <= 0) return 0;
  const divisor = 1 + vatRate / 100;
  const net = Math.round(total / divisor);
  return Math.max(0, total - net);
}

function openModal(id) {
  const node = document.getElementById(id);
  node.classList.remove("hidden");
  node.classList.add("flex");
}

function closeModal(id) {
  const node = document.getElementById(id);
  node.classList.add("hidden");
  node.classList.remove("flex");
}

function updateInvoiceDocTypeButtons() {
  document.querySelectorAll(".invoice-doc-type-button").forEach((button) => {
    const active = button.dataset.docType === invoiceState.previewDocType;
    button.classList.toggle("bg-primary", active);
    button.classList.toggle("text-white", active);
    button.classList.toggle("bg-slate-100", !active);
    button.classList.toggle("text-primary", !active);
  });
}

function setInvoicePreviewDocType(docType) {
  invoiceState.previewDocType = ["invoice", "quotation", "inquiry"].includes(docType) ? docType : "invoice";
  updateInvoiceDocTypeButtons();
  if (invoiceState.activeItem) {
    document.getElementById("invoice-preview-content").innerHTML = buildInvoiceHtml(invoiceState.activeItem, invoiceState.previewDocType);
  }
}

function openPreview(item) {
  invoiceState.activeItem = item;
  updateInvoiceDocTypeButtons();
  document.getElementById("invoice-preview-content").innerHTML = buildInvoiceHtml(item, invoiceState.previewDocType);
  openModal("invoice-preview-modal");
}

function closePreview() {
  closeModal("invoice-preview-modal");
}

function printInvoice() {
  if (!invoiceState.activeItem) return;
  const node = document.getElementById("printable-invoice");
  node.innerHTML = buildInvoiceHtml(invoiceState.activeItem, invoiceState.previewDocType);
  node.classList.remove("hidden");
  window.print();
  node.classList.add("hidden");
}

function openDetail(title, items) {
  const rows = (Array.isArray(items) ? items : []).map((item) => `
    <tr class="border-b border-slate-100">
      <td class="px-4 py-3 font-bold text-primary">${escapeHtml(item.invoiceNo || "-")}</td>
      <td class="px-4 py-3">${escapeHtml(item.customerName || "-")}</td>
      <td class="px-4 py-3">${escapeHtml(item.packageName || "-")}</td>
      <td class="px-4 py-3">${escapeHtml(item.customerPhone || "-")}</td>
      <td class="px-4 py-3">${escapeHtml(item.customerEmail || "-")}</td>
      <td class="px-4 py-3 font-bold text-primary">${invoiceMoney(item.amount || 0)}</td>
      <td class="px-4 py-3">${escapeHtml((item.issuedAt || "").slice(0, 10) || "-")}</td>
      <td class="px-4 py-3">${escapeHtml(item.status || "-")}</td>
    </tr>
  `).join("");

  document.getElementById("invoice-detail-content").innerHTML = `
    <div class="mb-5">
      <h4 class="text-xl font-extrabold text-primary">${escapeHtml(title)}</h4>
      <p class="mt-2 text-sm text-slate-500">共 ${items.length} 条记录</p>
    </div>
    <div class="overflow-x-auto rounded-[1.5rem] border border-outline-variant/15">
      <table class="min-w-full text-sm">
        <thead class="bg-surface-container-low text-left text-xs uppercase tracking-widest text-slate-500">
          <tr>
            <th class="px-4 py-3">发票编号</th>
            <th class="px-4 py-3">客户</th>
            <th class="px-4 py-3">套装</th>
            <th class="px-4 py-3">电话</th>
            <th class="px-4 py-3">邮箱</th>
            <th class="px-4 py-3">金额</th>
            <th class="px-4 py-3">开票日期</th>
            <th class="px-4 py-3">状态</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td class="px-4 py-6 text-slate-500" colspan="8">暂无记录</td></tr>`}</tbody>
      </table>
    </div>
  `;
  openModal("invoice-detail-modal");
}

function closeDetail() {
  closeModal("invoice-detail-modal");
}

function syncEditedItem(updatedItem) {
  const index = invoiceState.items.findIndex((item) => item.id === updatedItem.id);
  if (index >= 0) {
    invoiceState.items[index] = updatedItem;
  }
  if (invoiceState.activeItem && invoiceState.activeItem.id === updatedItem.id) {
    invoiceState.activeItem = updatedItem;
  }
  applyFilter();
}

function openEdit(item) {
  invoiceState.editingItem = item;
  document.getElementById("invoice-edit-no").value = item.invoiceNo || "";
  document.getElementById("invoice-edit-status").value = item.status || "issued";
  document.getElementById("invoice-edit-customer-name").value = item.customerName || "";
  document.getElementById("invoice-edit-customer-phone").value = item.customerPhone || "";
  document.getElementById("invoice-edit-customer-email").value = item.customerEmail || "";
  document.getElementById("invoice-edit-customer-address").value = item.customerAddress || "";
  document.getElementById("invoice-edit-package-name").value = item.packageName || "";
  document.getElementById("invoice-edit-sales-person").value = item.salesPersonName || "";
  document.getElementById("invoice-edit-amount").value = Number(item.amount || 0);
  document.getElementById("invoice-edit-issued-at").value = (item.issuedAt || "").slice(0, 10);
  document.getElementById("invoice-edit-note").value = item.note || item.payload?.note || "";
  openModal("invoice-edit-modal");
}

function closeEdit() {
  invoiceState.editingItem = null;
  closeModal("invoice-edit-modal");
}

function renderTable(items) {
  const body = document.getElementById("invoice-table-body");
  body.innerHTML = "";
  if (!items.length) {
    body.innerHTML = `<tr><td class="px-4 py-6 text-slate-500" colspan="8">暂无 INVOICE 记录</td></tr>`;
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("tr");
    row.className = "border-b border-slate-100";
    row.innerHTML = `
      <td class="px-4 py-4 font-bold text-primary">${escapeHtml(item.invoiceNo || "-")}</td>
      <td class="px-4 py-4">
        <div class="font-bold text-primary">${escapeHtml(item.customerName || "-")}</div>
        <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.customerPhone || "-")}</div>
      </td>
      <td class="px-4 py-4">${escapeHtml(item.packageName || "-")}</td>
      <td class="px-4 py-4">${escapeHtml(item.salesPersonName || "-")}</td>
      <td class="px-4 py-4 font-bold text-primary">${invoiceMoney(item.amount || 0)}</td>
      <td class="px-4 py-4">${escapeHtml((item.issuedAt || "").slice(0, 10) || "-")}</td>
      <td class="px-4 py-4"><span class="rounded-full bg-surface-container-low px-3 py-1 text-xs font-bold text-primary">${escapeHtml(item.status || "-")}</span></td>
      <td class="px-4 py-4">
        <div class="flex justify-end gap-2">
          <button class="invoice-preview rounded-full bg-primary px-4 py-2 text-xs font-bold text-white">预览</button>
          <button class="invoice-edit rounded-full bg-amber-100 px-4 py-2 text-xs font-bold text-amber-900">修改</button>
          <button class="invoice-print rounded-full bg-slate-200 px-4 py-2 text-xs font-bold text-primary">打印</button>
        </div>
      </td>
    `;
    row.querySelector(".invoice-preview").addEventListener("click", () => openPreview(item));
    row.querySelector(".invoice-edit").addEventListener("click", () => openEdit(item));
    row.querySelector(".invoice-print").addEventListener("click", () => {
      invoiceState.activeItem = item;
      printInvoice();
    });
    body.appendChild(row);
  });
}

function updateSummary(items) {
  document.getElementById("invoice-count").textContent = items.length;
  document.getElementById("invoice-total-amount").textContent = invoiceMoney(items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  document.getElementById("invoice-issued-count").textContent = items.filter((item) => item.status === "issued").length;
}

function applyFilter() {
  const keyword = String(document.getElementById("invoice-search").value || "").trim().toLowerCase();
  invoiceState.filteredItems = invoiceState.items.filter((item) => {
    if (!keyword) return true;
    return [
      item.invoiceNo,
      item.customerName,
      item.customerPhone,
      item.packageName,
      item.salesPersonName,
      item.note
    ].some((value) => String(value || "").toLowerCase().includes(keyword));
  });
  renderTable(invoiceState.filteredItems);
  updateSummary(invoiceState.filteredItems);
}

async function loadInvoices() {
  const [invoiceResponse, settingsResponse] = await Promise.all([
    fetch("/api/invoices"),
    fetch("/api/system-settings")
  ]);
  const data = await invoiceResponse.json();
  const settingsData = await settingsResponse.json();
  const localCompany = JSON.parse(localStorage.getItem("smart_sizing_company_profile") || "{}");
  invoiceState.items = Array.isArray(data.items) ? data.items : [];
  invoiceState.company = localCompany?.name ? localCompany : (settingsData.settings?.company || invoiceState.company);
  applyFilter();
}

async function saveInvoiceEdit(event) {
  event.preventDefault();
  if (!invoiceState.editingItem) return;

  const payload = {
    id: invoiceState.editingItem.id,
    invoiceNo: document.getElementById("invoice-edit-no").value.trim(),
    status: document.getElementById("invoice-edit-status").value,
    customerName: document.getElementById("invoice-edit-customer-name").value.trim(),
    customerPhone: document.getElementById("invoice-edit-customer-phone").value.trim(),
    customerEmail: document.getElementById("invoice-edit-customer-email").value.trim(),
    customerAddress: document.getElementById("invoice-edit-customer-address").value.trim(),
    packageName: document.getElementById("invoice-edit-package-name").value.trim(),
    salesPersonName: document.getElementById("invoice-edit-sales-person").value.trim(),
    amount: Number(document.getElementById("invoice-edit-amount").value || 0),
    issuedAt: document.getElementById("invoice-edit-issued-at").value,
    note: document.getElementById("invoice-edit-note").value.trim()
  };

  const response = await fetch("/api/invoices/update", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    alert(data.error || "发票保存失败");
    return;
  }

  syncEditedItem(data.item);
  closeEdit();
}

document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("invoice-search").addEventListener("input", applyFilter);
  document.getElementById("invoice-preview-close").addEventListener("click", closePreview);
  document.getElementById("invoice-print-button").addEventListener("click", printInvoice);
  document.querySelectorAll(".invoice-doc-type-button").forEach((button) => {
    button.addEventListener("click", () => setInvoicePreviewDocType(button.dataset.docType));
  });
  document.getElementById("invoice-detail-close").addEventListener("click", closeDetail);
  document.getElementById("invoice-edit-close").addEventListener("click", closeEdit);
  document.getElementById("invoice-edit-cancel").addEventListener("click", closeEdit);
  document.getElementById("invoice-edit-form").addEventListener("submit", saveInvoiceEdit);
  document.getElementById("invoice-kpi-total").addEventListener("click", () => openDetail("全部发票", invoiceState.filteredItems));
  document.getElementById("invoice-kpi-amount").addEventListener("click", () => openDetail("金额明细", invoiceState.filteredItems));
  document.getElementById("invoice-kpi-issued").addEventListener("click", () => openDetail("已开票记录", invoiceState.filteredItems.filter((item) => item.status === "issued")));
  await loadInvoices();
});

function getInvoiceDocStyle(docType) {
  if (docType === "quotation") return { title: "QUOTATION", subtitle: "Sales Quotation", codeLabel: "Quotation No", dateLabel: "Quotation Date", totalLabel: "Total Quoted", accent: "#0f766e", light: "#ecfeff" };
  if (docType === "inquiry") return { title: "INQUIRY SHEET", subtitle: "Customer Inquiry Sheet", codeLabel: "Inquiry No", dateLabel: "Inquiry Date", totalLabel: "Estimated Total", accent: "#7f5700", light: "#fff7e6" };
  return { title: "INVOICE", subtitle: "Commercial Invoice", codeLabel: "Invoice No", dateLabel: "Invoice Date", totalLabel: "Total Due", accent: "#001d44", light: "#f8fafc" };
}

function buildInvoiceHtml(item = {}, docType = invoiceState.previewDocType || "invoice") {
  const payload = item.payload || {};
  const customer = item.customer || payload.customer || {};
  const recommendation = payload.recommendation || {};
  const quote = payload.quote || {};
  const installment = payload.installmentPlan || {};
  const company = payload.settings?.company || invoiceState.company || {};
  const note = item.note || payload.note || "";
  const style = getInvoiceDocStyle(docType);
  const rows = [
    { description: item.packageName || recommendation.packageName || "Solar Package", details: [recommendation.solarPanels, recommendation.battery, recommendation.inverter].filter(Boolean).join(" / "), amount: Number(quote.equipmentPrice || item.amount || 0) },
    Number(quote.installFee || 0) > 0 ? { description: "Installation", details: "Installation Service", amount: Number(quote.installFee || 0) } : null,
    Number(quote.logisticsFee || 0) > 0 ? { description: "Logistics", details: payload.location || "Vanuatu", amount: Number(quote.logisticsFee || 0) } : null
  ].filter(Boolean);
  const rowHtml = rows.map((row, index) => `
    <tr>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">${index + 1}</td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;">
        <div style="font-weight:700;color:#0f172a;">${escapeHtml(row.description)}</div>
        <div style="margin-top:4px;font-size:12px;color:#64748b;">${escapeHtml(row.details || "-")}</div>
      </td>
      <td style="padding:12px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${invoiceMoney(row.amount)}</td>
    </tr>
  `).join("");
  const installmentHtml = installment.enabled && Array.isArray(installment.installments)
    ? `<div style="margin-top:18px;border-top:1px solid #dbe4f0;padding-top:14px;"><div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">INSTALLMENT PLAN</div><div style="margin-top:10px;font-size:13px;color:#475569;">Deposit Date: ${escapeHtml(installment.depositDate || "-")}</div><div style="margin-top:8px;font-size:13px;color:#475569;">Cycle: ${escapeHtml(installmentCycleLabelEnglish(installment))}</div><div style="margin-top:12px;">${installment.installments.map((plan, index) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px dashed #dbe4f0;font-size:13px;"><span>${escapeHtml(installmentItemLabelEnglish(plan, index))} / ${escapeHtml(plan.dueDate || "-")}</span><strong>${invoiceMoney(plan.amount)}</strong></div>`).join("")}</div></div>`
    : "";
  return `
    <div style="font-family:Inter,sans-serif;color:#0f172a;background:#ffffff;padding:14px 16px;max-width:186mm;margin:0 auto;">
      <div style="display:grid;grid-template-columns:0.66fr 1.34fr;gap:16px;padding-bottom:14px;border-bottom:3px solid ${style.accent};">
        <div>
          <div style="font-family:Manrope,sans-serif;font-size:28px;font-weight:800;letter-spacing:0.08em;color:${style.accent};">${style.title}</div>
          <div style="margin-top:4px;font-size:12px;color:#64748b;">${style.subtitle}</div>
          <div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:16px;padding:12px;background:${style.light};">
            <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">BILL TO</div>
            <div style="margin-top:8px;font-size:18px;font-weight:800;color:#0f172a;">${escapeHtml(item.customerName || customer.name || "-")}</div>
            <div style="margin-top:4px;font-size:12px;color:#475569;">${escapeHtml(item.customerPhone || customer.phone || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${escapeHtml(item.customerEmail || customer.email || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${escapeHtml(item.customerAddress || customer.address || "-")}</div>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;align-items:flex-start;gap:${company.logoUrl ? "12px" : "0"};">
          ${company.logoUrl ? `<img alt="company logo" src="${escapeHtml(company.logoUrl)}" style="width:72px;height:72px;object-fit:contain;border-radius:14px;border:1px solid #e2e8f0;padding:8px;background:#fff;" />` : ""}
          <div style="text-align:right;">
            <div style="font-family:Manrope,sans-serif;font-size:23px;font-weight:800;color:${style.accent};">${escapeHtml(company.name || "VSLM Solar & Logistics")}</div>
            <div style="margin-top:4px;font-size:12px;color:#475569;">TIN: ${escapeHtml(company.tin || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${escapeHtml(company.address || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${escapeHtml(company.phone || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#475569;">${escapeHtml(company.email || "-")}</div>
            <div style="margin-top:8px;font-size:12px;color:#64748b;">${style.codeLabel}: ${escapeHtml(item.invoiceNo || "-")}</div>
            <div style="margin-top:2px;font-size:12px;color:#64748b;">${style.dateLabel}: ${escapeHtml((item.issuedAt || "").slice(0, 10) || "-")}</div>
          </div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:24px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <thead>
          <tr style="background:${style.accent};color:#ffffff;">
            <th style="text-align:left;padding:12px 10px;">#</th>
            <th style="text-align:left;padding:12px 10px;">Description</th>
            <th style="text-align:right;padding:12px 10px;">Amount</th>
          </tr>
        </thead>
        <tbody>${rowHtml}</tbody>
      </table>
      <div style="margin-top:20px;border:1px solid #e2e8f0;border-radius:18px;padding:16px;background:${style.light};">
        <div style="font-family:Manrope,sans-serif;font-size:13px;font-weight:800;letter-spacing:0.08em;color:#64748b;">PAYMENT SUMMARY</div>
        <div style="display:grid;grid-template-columns:1fr auto;gap:10px 16px;margin-top:12px;font-size:14px;">
          <span style="color:#64748b;">Subtotal</span><strong>${invoiceMoney(quote.subtotalExclTax || item.amount || 0)}</strong>
          <span style="color:#64748b;">Included Tax</span><strong>${invoiceMoney(includedTaxAmount(quote))}</strong>
          ${installment.enabled ? `<span style="color:#64748b;">Deposit</span><strong>${invoiceMoney(installment.downPayment)}</strong>` : ""}
          <span style="font-family:Manrope,sans-serif;font-size:18px;font-weight:800;color:${style.accent};">${style.totalLabel}</span><strong style="font-family:Manrope,sans-serif;font-size:22px;color:${style.accent};">${invoiceMoney(item.amount || quote.displayTotal || quote.total || 0)}</strong>
        </div>
        <div style="margin-top:8px;font-size:12px;font-weight:700;color:${style.accent};text-align:right;">Tax Inclusive</div>
        ${installmentHtml}
        ${note ? `<div style="margin-top:12px;font-size:13px;color:#475569;">Remark: ${escapeHtml(note)}</div>` : ""}
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:18px;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;">
        <tbody><tr><td style="width:50%;padding:18px;border-right:1px solid #e2e8f0;"><div style="font-size:12px;color:#64748b;">Sales Signature</div><div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div></td><td style="width:50%;padding:18px;"><div style="font-size:12px;color:#64748b;">Customer Signature</div><div style="height:60px;border-bottom:1px solid #94a3b8;margin-top:18px;"></div></td></tr></tbody>
      </table>
    </div>
  `;
}
