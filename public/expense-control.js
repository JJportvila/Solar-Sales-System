const expenseState = {
  data: null,
  filteredTransactions: [],
  pendingAttachment: null
};

function money(value) {
  return `VT ${Math.abs(Number(value || 0)).toLocaleString("en-US")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("zh-CN");
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error || "保存失败");
  render(data);
  return data;
}

function statusBadge(status) {
  const current = String(status || "").trim();
  if (["已核销", "已支付", "已入账", "已申报", "已开票"].includes(current)) return "bg-emerald-100 text-emerald-700";
  if (["待审核", "待支付", "待申报", "待开票", "待核销", "处理中"].includes(current)) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-700";
}

function attachmentActions(item, section) {
  const hasImage = Boolean(item.attachmentUrl);
  return `
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button class="expense-upload rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-primary" data-section="${section}" data-id="${escapeHtml(item.id)}">
        上传原图
      </button>
      <button class="expense-preview rounded-xl px-3 py-2 text-xs font-bold ${hasImage ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}" data-url="${escapeHtml(item.attachmentUrl || "")}" data-name="${escapeHtml(item.attachmentName || item.id)}" ${hasImage ? "" : "disabled"}>
        预览原图
      </button>
      <span class="text-xs text-muted">${hasImage ? `已备份：${escapeHtml(item.attachmentName || "发票图片")}` : "未上传原图"}</span>
    </div>
  `;
}

function renderQueue(items = []) {
  const wrap = document.getElementById("expense-payment-queue");
  document.getElementById("expense-queue-count").textContent = `${items.filter((item) => item.status !== "已核销").length} 条待处理`;
  if (!items.length) {
    wrap.innerHTML = `<div class="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">暂无支付审核记录</div>`;
    return;
  }
  wrap.innerHTML = items.map((item) => `
    <div class="rounded-2xl border border-line/70 bg-slate-50 p-4">
      <div class="flex gap-4">
        <div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-primary shadow-sm">
          <span class="material-symbols-outlined text-4xl">receipt_long</span>
        </div>
        <div class="flex-1">
          <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="text-[11px] font-bold uppercase tracking-[0.24em] text-secondary">${escapeHtml(item.id)}</div>
              <div class="mt-1 text-base font-bold text-primary">${escapeHtml(item.customer)}</div>
              <div class="mt-1 text-xs text-muted">${escapeHtml(formatDate(item.createdAt))}</div>
            </div>
            <div class="text-xl font-black text-primary">${money(item.amount)}</div>
          </div>
          <div class="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <span class="inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${statusBadge(item.status)}">${escapeHtml(item.status)}</span>
            <div class="flex flex-wrap gap-2">
              <button class="expense-queue-action rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white" data-id="${escapeHtml(item.id)}" data-status="已核销" data-customer="${escapeHtml(item.customer)}" data-amount="${item.amount}">标记已核销</button>
              <button class="expense-queue-action rounded-xl border border-line px-4 py-2 text-xs font-bold text-primary" data-id="${escapeHtml(item.id)}" data-status="待审核" data-customer="${escapeHtml(item.customer)}" data-amount="${item.amount}">退回待审核</button>
            </div>
          </div>
          ${attachmentActions(item, "paymentQueue")}
        </div>
      </div>
    </div>
  `).join("");
}

function renderEditableList({ items, wrapId, totalId, titleField, titleLabel, subtitle, statusOptions, updateClass, section }) {
  document.getElementById(totalId).textContent = money(items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const wrap = document.getElementById(wrapId);
  if (!items.length) {
    wrap.innerHTML = `<div class="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">暂无记录</div>`;
    return;
  }
  wrap.innerHTML = items.map((item) => `
    <div class="rounded-2xl border border-line/70 bg-slate-50 px-4 py-4">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div class="text-sm font-bold text-primary">${escapeHtml(item[titleField])}</div>
          <div class="mt-1 text-xs text-muted">${escapeHtml(subtitle(item))}</div>
        </div>
        <div class="text-right">
          <div class="text-base font-black text-primary">${money(item.amount)}</div>
          <div class="mt-1 text-xs text-muted">${escapeHtml(titleLabel)}</div>
        </div>
      </div>
      <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span class="inline-flex w-fit rounded-full px-3 py-1 text-xs font-bold ${statusBadge(item.status)}">${escapeHtml(item.status)}</span>
        <div class="flex flex-wrap items-center gap-2">
          <select class="${updateClass} rounded-xl border border-line bg-white px-4 py-2 text-sm" data-id="${escapeHtml(item.id)}">
            ${statusOptions.map((status) => `<option value="${status}" ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}
          </select>
          <button class="${updateClass}-save rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white" data-id="${escapeHtml(item.id)}">保存</button>
        </div>
      </div>
      ${attachmentActions(item, section)}
    </div>
  `).join("");
}

function renderTransactions(items = []) {
  const tbody = document.getElementById("expense-transactions-body");
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-4 py-8 text-center text-sm text-muted">暂无匹配流水</td></tr>`;
    return;
  }
  tbody.innerHTML = items.map((item) => `
    <tr class="border-b border-line/50 last:border-b-0 hover:bg-slate-50">
      <td class="py-4 pl-4 text-xs font-bold text-primary">${escapeHtml(item.id)}</td>
      <td class="py-4 text-sm">${escapeHtml(item.type)}</td>
      <td class="py-4 font-semibold">${escapeHtml(item.customer)}</td>
      <td class="py-4 font-black ${Number(item.amount || 0) < 0 ? "text-red-500" : "text-slate-900"}">${Number(item.amount || 0) < 0 ? "- " : ""}${money(item.amount)}</td>
      <td class="py-4"><span class="rounded-full px-3 py-1 text-xs font-bold ${statusBadge(item.status)}">${escapeHtml(item.status)}</span></td>
      <td class="py-4 pr-4 text-right text-xs text-muted">${escapeHtml(item.type)}记录</td>
    </tr>
  `).join("");
}

function applyTransactionFilter() {
  const keyword = (document.getElementById("expense-search").value || "").trim().toLowerCase();
  const source = expenseState.data?.transactionLogs || [];
  expenseState.filteredTransactions = source.filter((item) => {
    if (!keyword) return true;
    return [item.id, item.type, item.customer, item.status].join(" ").toLowerCase().includes(keyword);
  });
  renderTransactions(expenseState.filteredTransactions);
}

function render(data) {
  expenseState.data = data;
  renderQueue(data.paymentQueue || []);
  renderEditableList({
    items: data.livingCosts || [],
    wrapId: "expense-living-list",
    totalId: "expense-living-total",
    titleField: "name",
    titleLabel: "生活成本",
    subtitle: (item) => item.note || item.category || "生活成本支出",
    statusOptions: ["待支付", "已入账"],
    updateClass: "expense-living-status",
    section: "livingCosts"
  });
  renderEditableList({
    items: data.taxes || [],
    wrapId: "expense-tax-list",
    totalId: "expense-tax-total",
    titleField: "name",
    titleLabel: "税项金额",
    subtitle: (item) => item.period || "税务期间",
    statusOptions: ["待申报", "处理中", "已申报"],
    updateClass: "expense-tax-status",
    section: "taxes"
  });
  renderEditableList({
    items: data.invoices || [],
    wrapId: "expense-invoice-list",
    totalId: "expense-invoice-total",
    titleField: "id",
    titleLabel: "发票金额",
    subtitle: (item) => `${item.customer || "未命名客户"} / ${formatDate(item.issuedAt)}`,
    statusOptions: ["待开票", "已开票"],
    updateClass: "expense-invoice-status",
    section: "invoices"
  });
  renderEditableList({
    items: data.rentLedger || [],
    wrapId: "expense-rent-list",
    totalId: "expense-rent-total",
    titleField: "location",
    titleLabel: "房租金额",
    subtitle: (item) => item.month || "租期",
    statusOptions: ["待支付", "已支付"],
    updateClass: "expense-rent-status",
    section: "rentLedger"
  });
  applyTransactionFilter();
}

async function loadExpenseControl() {
  const response = await fetch("/api/expense-control");
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error || "加载失败");
  render(data);
}

function getSelectValue(selector, id) {
  const element = document.querySelector(`${selector}[data-id="${CSS.escape(id)}"]`);
  return element ? element.value : "";
}

function previewImage(url, name) {
  if (!url) return;
  document.getElementById("expense-image-preview").src = url;
  document.getElementById("expense-image-caption").textContent = name || "票据原图";
  document.getElementById("expense-image-modal").classList.remove("hidden");
  document.getElementById("expense-image-modal").classList.add("flex");
}

function bindEvents() {
  document.getElementById("expense-search").addEventListener("input", applyTransactionFilter);

  document.body.addEventListener("click", async (event) => {
    const queueButton = event.target.closest(".expense-queue-action");
    if (queueButton) {
      await postJson("/api/expense-control/payment-queue/update", {
        id: queueButton.dataset.id,
        status: queueButton.dataset.status,
        customer: queueButton.dataset.customer,
        amount: Number(queueButton.dataset.amount || 0)
      });
      return;
    }

    const uploadButton = event.target.closest(".expense-upload");
    if (uploadButton) {
      expenseState.pendingAttachment = {
        section: uploadButton.dataset.section,
        id: uploadButton.dataset.id
      };
      document.getElementById("expense-attachment-input").click();
      return;
    }

    const previewButton = event.target.closest(".expense-preview");
    if (previewButton && previewButton.dataset.url) {
      previewImage(previewButton.dataset.url, previewButton.dataset.name);
      return;
    }

    const livingButton = event.target.closest(".expense-living-status-save");
    if (livingButton) {
      const id = livingButton.dataset.id;
      await postJson("/api/expense-control/living-cost/update", { id, status: getSelectValue(".expense-living-status", id) });
      return;
    }

    const taxButton = event.target.closest(".expense-tax-status-save");
    if (taxButton) {
      const id = taxButton.dataset.id;
      await postJson("/api/expense-control/tax/update", { id, status: getSelectValue(".expense-tax-status", id) });
      return;
    }

    const invoiceButton = event.target.closest(".expense-invoice-status-save");
    if (invoiceButton) {
      const id = invoiceButton.dataset.id;
      await postJson("/api/expense-control/invoice/update", { id, status: getSelectValue(".expense-invoice-status", id) });
      return;
    }

    const rentButton = event.target.closest(".expense-rent-status-save");
    if (rentButton) {
      const id = rentButton.dataset.id;
      await postJson("/api/expense-control/rent/update", { id, status: getSelectValue(".expense-rent-status", id) });
    }
  });

  document.getElementById("expense-attachment-input").addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    const pending = expenseState.pendingAttachment;
    if (!file || !pending) return;

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("读取图片失败"));
      reader.readAsDataURL(file);
    });

    await postJson("/api/expense-control/attachment/upload", {
      section: pending.section,
      id: pending.id,
      filename: file.name,
      dataUrl
    });

    expenseState.pendingAttachment = null;
    event.target.value = "";
  });

  document.getElementById("expense-image-close").addEventListener("click", () => {
    document.getElementById("expense-image-modal").classList.add("hidden");
    document.getElementById("expense-image-modal").classList.remove("flex");
    document.getElementById("expense-image-preview").src = "";
  });

  document.getElementById("expense-living-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await postJson("/api/expense-control/living-cost/update", {
      name: document.getElementById("expense-living-name").value.trim(),
      amount: Number(document.getElementById("expense-living-amount").value || 0),
      status: "待支付",
      note: "手工新增"
    });
    event.target.reset();
  });

  document.getElementById("expense-tax-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await postJson("/api/expense-control/tax/update", {
      name: document.getElementById("expense-tax-name").value.trim(),
      period: document.getElementById("expense-tax-period").value.trim(),
      amount: Number(document.getElementById("expense-tax-amount").value || 0),
      status: "待申报"
    });
    event.target.reset();
  });

  document.getElementById("expense-invoice-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await postJson("/api/expense-control/invoice/update", {
      customer: document.getElementById("expense-invoice-customer").value.trim(),
      amount: Number(document.getElementById("expense-invoice-amount").value || 0),
      status: "待开票",
      issuedAt: new Date().toISOString()
    });
    event.target.reset();
  });

  document.getElementById("expense-rent-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    await postJson("/api/expense-control/rent/update", {
      location: document.getElementById("expense-rent-location").value.trim(),
      month: document.getElementById("expense-rent-month").value.trim(),
      amount: Number(document.getElementById("expense-rent-amount").value || 0),
      status: "待支付"
    });
    event.target.reset();
  });
}

bindEvents();
loadExpenseControl().catch((error) => {
  console.error(error);
  alert(error.message || "费用管理加载失败");
});
