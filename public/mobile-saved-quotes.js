const savedQuotesState = {
  items: [],
  filtered: [],
  customers: []
};

const savedQuotesFormatter = new Intl.NumberFormat("en-US");

function $(id) {
  return document.getElementById(id);
}

function money(value) {
  return `VT ${savedQuotesFormatter.format(Number(value || 0))}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(text, isError = false) {
  const node = $("saved-quotes-status-text");
  node.textContent = text || "";
  node.style.color = isError ? "#b91c1c" : "#64748b";
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function quoteStatusMeta(status) {
  const map = {
    draft: { label: "草稿", cls: "warning" },
    in_progress: { label: "进行中", cls: "info" },
    sent: { label: "已发送", cls: "info" },
    paid: { label: "已付款", cls: "success" }
  };
  return map[status] || { label: status || "草稿", cls: "warning" };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "请求失败");
  }
  return data;
}

async function updateQuoteStatus(id, status) {
  await fetchJson("/api/saved-quotes/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status })
  });
}

function getCustomerDetailLink(item = {}) {
  const directId = String(item.customerId || "").trim();
  if (directId) {
    return `/mobile-customer-detail.html?id=${encodeURIComponent(directId)}`;
  }

  const sourcePhone = String(item.customer?.phone || item.customerPhone || "").trim();
  const sourceName = String(item.customer?.name || item.customerName || "").trim().toLowerCase();
  const matched = savedQuotesState.customers.find((customer) => {
    const customerPhone = String(customer.phone || "").trim();
    const customerName = String(customer.name || customer.contactName || "").trim().toLowerCase();
    return (sourcePhone && customerPhone && customerPhone === sourcePhone)
      || (sourceName && customerName && customerName === sourceName);
  });

  return matched
    ? `/mobile-customer-detail.html?id=${encodeURIComponent(matched.id)}`
    : "/mobile-app.html?v=20260402";
}

function applyFilters() {
  const search = $("saved-quotes-search").value.trim().toLowerCase();
  const status = $("saved-quotes-status").value;
  savedQuotesState.filtered = savedQuotesState.items.filter((item) => {
    const haystack = [
      item.customer?.name,
      item.customerName,
      item.customer?.phone,
      item.customerPhone,
      item.packageName,
      item.location,
      item.salesPersonName
    ]
      .join(" ")
      .toLowerCase();
    const statusMatch = status === "all" || item.status === status;
    return statusMatch && (!search || haystack.includes(search));
  });
}

function renderList() {
  applyFilters();
  if ($("saved-kpi-count")) {
    $("saved-kpi-count").textContent = String(savedQuotesState.filtered.length);
  }
  if ($("saved-kpi-total")) {
    $("saved-kpi-total").textContent = money(
      savedQuotesState.filtered.reduce((sum, item) => sum + Number(item.total || 0), 0)
    );
  }

  const list = $("saved-quotes-list");
  if (!savedQuotesState.filtered.length) {
    list.innerHTML = `<div class="empty">没有匹配的已保存报价。</div>`;
    return;
  }

  list.innerHTML = savedQuotesState.filtered
    .map((item) => {
      const status = quoteStatusMeta(item.status);
      const customerDetailLink = getCustomerDetailLink(item);
      const quoteDetailLink = `/mobile-quote-detail.html?v=20260402&id=${encodeURIComponent(item.id || "")}`;
      return `
        <div class="quote-card">
          <div class="quote-head">
            <div>
              <div class="quote-title">${escapeHtml(item.customer?.name || item.customerName || "未命名客户")}</div>
              <div class="quote-meta">${escapeHtml(item.packageName || "-")} / ${escapeHtml(item.location || "-")} / ${escapeHtml(formatDate(item.createdAt))}</div>
            </div>
            <span class="status-tag ${status.cls}">${escapeHtml(status.label)}</span>
          </div>
          <div class="grid two" style="margin-top:10px;">
            <div class="metric"><label>金额</label><strong>${money(item.total || 0)}</strong></div>
            <div class="metric"><label>销售</label><strong>${escapeHtml(item.salesPersonName || "-")}</strong></div>
            <div class="metric"><label>日耗电</label><strong>${escapeHtml(item.dailyWh || 0)} Wh</strong></div>
            <div class="metric"><label>电话</label><strong>${escapeHtml(item.customer?.phone || item.customerPhone || "-")}</strong></div>
          </div>
          <div class="grid" style="margin-top:10px;">
            <select class="select quote-status-select" data-id="${escapeHtml(item.id)}">
              <option value="draft" ${item.status === "draft" ? "selected" : ""}>草稿</option>
              <option value="in_progress" ${item.status === "in_progress" ? "selected" : ""}>进行中</option>
              <option value="sent" ${item.status === "sent" ? "selected" : ""}>已发送</option>
              <option value="paid" ${item.status === "paid" ? "selected" : ""}>已付款</option>
            </select>
          </div>
          <div class="btn-row" style="margin-top:12px;">
            <a class="btn secondary" href="${quoteDetailLink}">报价详情</a>
            <a class="btn primary" href="/mobile-quote.html?v=20260402">继续报价</a>
          </div>
          <div class="btn-row">
            <a class="btn secondary" href="${customerDetailLink}">客户详情</a>
            <a class="btn secondary" href="${item.customer?.phone || item.customerPhone ? `tel:${escapeHtml(item.customer?.phone || item.customerPhone)}` : customerDetailLink}">${item.customer?.phone || item.customerPhone ? "拨打电话" : "打开客户"}</a>
          </div>
        </div>
      `;
    })
    .join("");

  list.querySelectorAll(".quote-status-select").forEach((node) => {
    node.addEventListener("change", async (event) => {
      const id = event.target.dataset.id;
      const status = event.target.value;
      try {
        setStatus("正在更新报价状态...");
        await updateQuoteStatus(id, status);
        const target = savedQuotesState.items.find((item) => item.id === id);
        if (target) target.status = status;
        renderList();
        setStatus("报价状态已更新。");
      } catch (error) {
        setStatus(error.message || "更新报价状态失败", true);
      }
    });
  });
}

async function loadSavedQuotes() {
  setStatus("正在加载已保存报价...");
  const result = await fetchJson("/api/saved-quotes");
  const customerResult = await fetchJson("/api/customers");
  savedQuotesState.items = Array.isArray(result.items) ? result.items : [];
  savedQuotesState.customers = Array.isArray(customerResult.items) ? customerResult.items : [];
  renderList();
  setStatus("已保存报价已更新。");
}

function bindEvents() {
  $("saved-quotes-search").addEventListener("input", renderList);
  $("saved-quotes-status").addEventListener("change", renderList);
}

async function init() {
  bindEvents();
  await loadSavedQuotes();
}

init().catch((error) => {
  setStatus(error.message || "加载已保存报价失败", true);
});
