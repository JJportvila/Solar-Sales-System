function $(id) { return document.getElementById(id); }

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("zh-CN", { year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function renderMetrics(id, items) {
  $(id).innerHTML = items.map(([label, value]) => `
    <div class="metric">
      <label>${escapeHtml(label)}</label>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

async function init() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    $("repair-subtitle").textContent = "缺少工单 ID";
    return;
  }

  const result = await fetchJson(`/api/repair-order?id=${encodeURIComponent(id)}`);
  const item = result.order;
  if (!item) {
    $("repair-subtitle").textContent = "未找到对应工单";
    return;
  }

  $("repair-title").textContent = item.title || item.id || "维修详情";
  $("repair-subtitle").textContent = `${item.customer?.name || "-"} / ${item.assetLocation?.name || "-"}`;
  $("repair-call").href = item.customer?.phone ? `tel:${item.customer.phone}` : "#";

  renderMetrics("repair-summary", [
    ["工单编号", item.id || "-"],
    ["工单状态", item.statusLabel || item.status || "-"],
    ["优先级", item.priorityLabel || item.priority || "-"],
    ["预计时间", item.etaLabel || formatDate(item.eta)]
  ]);

  renderMetrics("repair-customer", [
    ["客户", item.customer?.name || "-"],
    ["电话", item.customer?.phone || "-"],
    ["工程师", item.assignedEngineer?.name || "-"],
    ["站点", item.assetLocation?.name || "-"],
    ["站点地址", item.assetLocation?.address || "-"],
    ["坐标", item.assetLocation?.coordinates || "-"]
  ]);

  $("repair-description").innerHTML = `
    <div class="item-title">${escapeHtml(item.description || item.issueDescription || "-")}</div>
    <div class="item-meta" style="margin-top:8px;">${escapeHtml(item.technicianFeedback || "暂无工程反馈")}</div>
  `;

  const timeline = Array.isArray(item.timeline) ? item.timeline : [];
  $("repair-timeline").innerHTML = timeline.length ? timeline.map((entry) => `
    <div class="item">
      <div class="item-meta">${escapeHtml(entry.timeLabel || "-")}</div>
      <div class="item-title">${escapeHtml(entry.title || "-")}</div>
      <div class="item-meta" style="margin-top:6px;">${escapeHtml(entry.detail || "-")}</div>
    </div>
  `).join("") : `<div class="empty">暂无维修时间线</div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif;">手机维修详情加载失败: ${escapeHtml(error.message || "unknown")}</div>`;
  });
});
