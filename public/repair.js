const state = {
  order: null,
  statusPhotoDataUrl: "",
  feedbackPhotoDataUrl: "",
  feedbackPhotoName: "",
  orderId: new URLSearchParams(window.location.search).get("id") || ""
};

const STATUS_LABELS = {
  pending: "待处理",
  in_progress: "维修中",
  completed: "已完工"
};

const PRIORITY_LABELS = {
  P1: "紧急 (P1)",
  P2: "高优先级 (P2)",
  P3: "普通 (P3)"
};

const ROLE_LABELS = {
  engineer: "工程师",
  technician: "工程师",
  "field engineer": "现场工程师",
  "sales rep": "销售",
  "sales manager": "销售经理",
  admin: "管理员"
};

const PART_STATUS_LABELS = {
  pending: "待发放",
  issued: "已发放",
  used: "已使用",
  installed: "已安装"
};

const STATIC_TEXT_MAP = [
  ["Engineer reassigned", "重新派单"],
  ["In Progress: Internal cleaning and component replacement", "维修中：内部清洁与部件更换"],
  ["On-site diagnosis completed: confirmed blown fuse", "现场诊断完成：确认保险丝熔断"],
  ["Work order assigned", "工单已分派"],
  ["Customer submitted repair request", "客户提交维修申请"],
  ["Assigned engineer:", "派单工程师："],
  ["Technician:", "维修工程师："],
  ["Initial conclusion:", "初步结论："],
  ["Dispatcher:", "派单方式："],
  ["Submitted via app", "通过系统提交"],
  ["system auto assignment", "系统自动派单"],
  ["transient voltage fluctuation", "瞬时电压波动"],
  ["Today", "今天"],
  ["Yesterday", "昨天"]
];

function setHealth(ok) {
  const dot = document.getElementById("health-dot");
  const text = document.getElementById("health-text");
  if (!dot || !text) return;
  dot.className = `inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`;
  text.textContent = ok ? "服务在线" : "服务异常";
}

function renderMessage(message, success = true) {
  const node = document.getElementById("repair-message");
  if (!node) return;
  node.classList.remove("hidden");
  node.className = `rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`;
  node.textContent = message;
}

function replaceStaticText(value = "") {
  let text = String(value || "");
  STATIC_TEXT_MAP.forEach(([from, to]) => {
    text = text.replace(from, to);
  });
  return text;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return replaceStaticText(String(value));
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function localizeStatus(value, label) {
  return STATUS_LABELS[value] || label || value || "-";
}

function localizePriority(value, label) {
  return PRIORITY_LABELS[value] || label || value || "-";
}

function localizeRole(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "-";
  return ROLE_LABELS[raw.toLowerCase()] || raw;
}

function localizePartStatus(value, label) {
  return PART_STATUS_LABELS[value] || label || value || "-";
}

function localizeDescription(value = "") {
  if (!value) return "-";
  if (/Customer reported/i.test(value)) {
    return "客户反馈逆变器第 03 组在日照峰值时段自动断开。初步检查发现母线电压异常，疑似 100A 直流保险丝熔断或接触器碳化导致。";
  }
  return replaceStaticText(value);
}

function localizeFeedback(value = "") {
  if (!value) return "-";
  if (/Cooling fan bearing/i.test(value)) {
    return "03 号机组冷却风扇轴承也有异响，建议在本次维修周期内完成润滑与复检，避免后续因过热再次跳闸。";
  }
  return replaceStaticText(value);
}

function parseCoordinates(order) {
  const lat = Number(order?.assetLocation?.latitude);
  const lng = Number(order?.assetLocation?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng };
  }
  const text = String(order?.assetLocation?.coordinates || "").replace(/[^\dNSEW\.\-, ]/gi, " ").trim();
  const numbers = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (numbers.length >= 2 && numbers.every(Number.isFinite)) {
    return {
      latitude: /S/i.test(text) ? -Math.abs(numbers[0]) : numbers[0],
      longitude: /W/i.test(text) ? -Math.abs(numbers[1]) : numbers[1]
    };
  }
  return null;
}

function renderMap(order) {
  const frame = document.getElementById("repair-map-frame");
  const link = document.getElementById("repair-map-link");
  const fallback = document.getElementById("repair-map-fallback");
  if (!frame || !link || !fallback) return;
  const parsed = parseCoordinates(order);
  if (!parsed) {
    frame.src = "about:blank";
    fallback.classList.remove("hidden");
    fallback.classList.add("flex");
    link.href = "#";
    link.classList.add("pointer-events-none", "opacity-50");
    return;
  }
  const { latitude, longitude } = parsed;
  const bbox = `${longitude - 0.02}%2C${latitude - 0.02}%2C${longitude + 0.02}%2C${latitude + 0.02}`;
  frame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  link.href = `https://www.google.com/maps?q=${latitude},${longitude}`;
  link.classList.remove("pointer-events-none", "opacity-50");
  fallback.classList.add("hidden");
  fallback.classList.remove("flex");
}

function buildPrintableHtml() {
  const order = state.order || {};
  return `
    <div style="font-family:Inter,sans-serif;color:#0f172a;">
      <h1 style="font-family:Manrope,sans-serif;font-size:28px;margin-bottom:6px;">光伏管理系统 维修工单详情</h1>
      <p style="margin:0 0 18px 0;color:#475569;">${order.id || "-"}</p>
      <h2 style="font-family:Manrope,sans-serif;font-size:24px;">${order.title || "-"}</h2>
      <p>状态：${localizeStatus(order.status, order.statusLabel)}</p>
      <p>优先级：${localizePriority(order.priority, order.priorityLabel)}</p>
      <p>预计时间：${replaceStaticText(order.etaLabel || "-")}</p>
      <p>客户：${order.customer?.name || "-"}</p>
      <p>工程师：${order.assignedEngineer?.name || "-"}</p>
      <div style="margin-top:20px;padding:16px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc;">
        <strong>故障描述</strong>
        <p style="margin-top:10px;">${localizeDescription(order.description)}</p>
      </div>
    </div>
  `;
}

function renderParts() {
  const list = document.getElementById("repair-parts-list");
  if (!list) return;
  const parts = state.order?.spareParts || [];
  if (!parts.length) {
    list.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-slate-500">当前没有预选备件。</div>`;
    return;
  }
  list.innerHTML = parts.map((item) => {
    const pending = item.status === "pending";
    return `
      <div class="flex flex-col gap-4 rounded-2xl bg-surface-container-low p-5 md:flex-row md:items-center md:justify-between">
        <div class="flex items-center gap-5">
          <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <span class="material-symbols-outlined text-primary">${pending ? "settings_input_component" : "electric_bolt"}</span>
          </div>
          <div>
            <div class="font-bold text-slate-900">${item.name || "-"}</div>
            <div class="text-xs text-slate-400">${item.sku || "-"}</div>
          </div>
        </div>
        <div class="flex items-center justify-between gap-6 md:justify-end md:gap-8">
          <div class="text-right">
            <div class="text-xs text-slate-400 mb-1">数量</div>
            <div class="text-lg font-bold">x ${item.quantity || 0}</div>
          </div>
          <div class="text-right w-24">
            <div class="text-xs text-slate-400 mb-1">状态</div>
            <span class="rounded-full px-2 py-0.5 text-[10px] font-bold ${pending ? "bg-secondary-container/40 text-secondary" : "bg-cyan-100 text-cyan-700"}">${localizePartStatus(item.status, item.statusLabel)}</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

function renderTimeline() {
  const wrap = document.getElementById("repair-timeline");
  if (!wrap) return;
  const timeline = state.order?.timeline || [];
  if (!timeline.length) {
    wrap.innerHTML = `<div class="text-sm text-slate-500">暂无维修时间线。</div>`;
    return;
  }
  wrap.innerHTML = "";
  timeline.forEach((item) => {
    const color = item.type === "current" ? "bg-primary" : item.type === "start" ? "bg-secondary" : "bg-slate-300";
    const entry = document.createElement("div");
    entry.className = "relative";
    entry.innerHTML = `
      <span class="absolute -left-[1.8rem] w-6 h-6 rounded-full ${color} border-4 border-white shadow-md z-10"></span>
      <div>
        <div class="text-xs ${item.type === "start" ? "text-secondary font-bold" : "text-slate-400"} mb-1">${replaceStaticText(item.timeLabel || "-")}</div>
        <div class="font-bold text-slate-900">${replaceStaticText(item.title || "-")}</div>
        <div class="text-sm text-slate-400 mt-1">${replaceStaticText(item.detail || "-")}</div>
      </div>
    `;
    wrap.appendChild(entry);
  });
}

function renderNotes() {
  const wrap = document.getElementById("repair-notes-list");
  if (!wrap) return;
  const notes = state.order?.notes || [];
  if (!notes.length) {
    wrap.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-slate-500">暂无维修日志记录。</div>`;
    return;
  }
  wrap.innerHTML = notes.map((note) => `
    <div class="rounded-2xl bg-surface-container-low p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-2">
          <div class="text-sm leading-relaxed text-slate-700">${replaceStaticText(note.text || "-")}</div>
          ${note.status ? `<span class="inline-flex rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-primary">${localizeStatus(note.status, note.status)}</span>` : ""}
        </div>
        <span class="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-bold text-slate-500">${formatDateTime(note.createdAt)}</span>
      </div>
      ${note.imageUrl ? `<img class="h-36 w-full rounded-2xl object-cover" src="${note.imageUrl}" alt="维修照片" />` : ""}
    </div>
  `).join("");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handlePhotoInput(input, kind) {
  const file = input.files?.[0];
  if (!file) {
    if (kind === "status") {
      state.statusPhotoDataUrl = "";
      renderStatusPhotoPreview();
    } else {
      state.feedbackPhotoDataUrl = "";
      state.feedbackPhotoName = "";
      renderFeedbackPhotoName();
    }
    return;
  }
  const dataUrl = await readFileAsDataUrl(file);
  if (kind === "status") {
    state.statusPhotoDataUrl = dataUrl;
    renderStatusPhotoPreview();
  } else {
    state.feedbackPhotoDataUrl = dataUrl;
    state.feedbackPhotoName = file.name;
    renderFeedbackPhotoName();
  }
}

function renderStatusPhotoPreview() {
  const wrap = document.getElementById("repair-photo-preview-wrap");
  const preview = document.getElementById("repair-photo-preview");
  if (!wrap || !preview) return;
  if (!state.statusPhotoDataUrl) {
    wrap.classList.add("hidden");
    preview.removeAttribute("src");
    return;
  }
  wrap.classList.remove("hidden");
  preview.src = state.statusPhotoDataUrl;
}

function renderFeedbackPhotoName() {
  const node = document.getElementById("repair-feedback-photo-name");
  if (!node) return;
  node.textContent = state.feedbackPhotoDataUrl ? state.feedbackPhotoName : "";
}

function renderOrder() {
  if (!state.order) return;
  const order = state.order;
  document.getElementById("repair-breadcrumb-id").textContent = order.id || "-";
  document.getElementById("repair-title").textContent = `工单详情：${order.title || "-"}`;
  document.getElementById("repair-status").textContent = localizeStatus(order.status, order.statusLabel);
  document.getElementById("repair-priority").textContent = localizePriority(order.priority, order.priorityLabel);
  document.getElementById("repair-eta").textContent = replaceStaticText(order.etaLabel || "-");
  document.getElementById("repair-description").textContent = localizeDescription(order.description);
  document.getElementById("repair-feedback-box").textContent = localizeFeedback(order.technicianFeedback);
  document.getElementById("repair-customer-name").textContent = order.customer?.name || "-";
  document.getElementById("repair-customer-phone").textContent = order.customer?.phone || "-";
  document.getElementById("repair-customer-email").textContent = order.customer?.email || "-";
  document.getElementById("repair-customer-address").textContent = order.customer?.address || "-";
  document.getElementById("repair-engineer-name").textContent = order.assignedEngineer?.name || "-";
  document.getElementById("repair-engineer-role").textContent = localizeRole(order.assignedEngineer?.role);
  document.getElementById("repair-asset-name").textContent = order.assetLocation?.name || "-";
  document.getElementById("repair-asset-coordinates").textContent = order.assetLocation?.coordinates || "-";
  document.getElementById("repair-status-select").value = order.status || "in_progress";
  renderMap(order);
  renderParts();
  renderTimeline();
  renderNotes();
}

async function loadOrder() {
  const query = state.orderId ? `?id=${encodeURIComponent(state.orderId)}` : "";
  const response = await fetch(`/api/repair-order${query}`);
  const data = await response.json();
  state.order = data.order;
  state.orderId = data.order?.id || state.orderId;
  renderOrder();
}

async function postRepairUpdate(url, payload, successMessage) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: state.orderId, ...payload })
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    renderMessage(data.error || "保存失败", false);
    return false;
  }
  state.order = data.order;
  renderOrder();
  renderMessage(successMessage, true);
  return true;
}

async function submitFeedback() {
  const text = document.getElementById("repair-feedback-input").value.trim();
  if (!text && !state.feedbackPhotoDataUrl) {
    renderMessage("请先输入反馈内容。", false);
    return;
  }
  const ok = await postRepairUpdate("/api/repair-order/feedback", {
    text,
    photoDataUrl: state.feedbackPhotoDataUrl
  }, "维修反馈已保存。");
  if (!ok) return;
  document.getElementById("repair-feedback-input").value = "";
  document.getElementById("repair-feedback-photo-input").value = "";
  state.feedbackPhotoDataUrl = "";
  state.feedbackPhotoName = "";
  renderFeedbackPhotoName();
}

async function saveStatus() {
  const nextStatus = document.getElementById("repair-status-select").value;
  const text = document.getElementById("repair-status-note").value.trim();
  if (nextStatus === "completed" && !state.statusPhotoDataUrl) {
    renderMessage("完工时必须上传维修照片。", false);
    return;
  }
  const ok = await postRepairUpdate("/api/repair-order/status", {
    status: nextStatus,
    text,
    photoDataUrl: state.statusPhotoDataUrl
  }, "维修状态已更新。");
  if (!ok) return;
  document.getElementById("repair-status-note").value = "";
  document.getElementById("repair-photo-input").value = "";
  state.statusPhotoDataUrl = "";
  renderStatusPhotoPreview();
}

async function completeRepair() {
  const text = document.getElementById("repair-status-note").value.trim() || document.getElementById("repair-feedback-input").value.trim();
  if (!state.statusPhotoDataUrl) {
    renderMessage("完工时必须上传维修照片。", false);
    return;
  }
  const ok = await postRepairUpdate("/api/repair-order/complete", {
    text,
    photoDataUrl: state.statusPhotoDataUrl
  }, "工单已更新为完工。");
  if (!ok) return;
  document.getElementById("repair-status-note").value = "";
  document.getElementById("repair-photo-input").value = "";
  state.statusPhotoDataUrl = "";
  renderStatusPhotoPreview();
}

function printOrder() {
  const printable = document.getElementById("repair-printable");
  if (!printable) return;
  printable.innerHTML = buildPrintableHtml();
  printable.classList.remove("hidden");
  window.print();
  printable.classList.add("hidden");
}

function bindEvents() {
  document.getElementById("repair-feedback-submit").addEventListener("click", submitFeedback);
  document.getElementById("repair-complete-button").addEventListener("click", completeRepair);
  document.getElementById("repair-print-button").addEventListener("click", printOrder);
  document.getElementById("repair-status-submit").addEventListener("click", saveStatus);
  document.getElementById("repair-photo-input").addEventListener("change", (event) => {
    handlePhotoInput(event.target, "status").catch(() => renderMessage("上传失败。", false));
  });
  document.getElementById("repair-feedback-photo-input").addEventListener("change", (event) => {
    handlePhotoInput(event.target, "feedback").catch(() => renderMessage("上传失败。", false));
  });
}

async function init() {
  bindEvents();
  try {
    const health = await fetch("/api/health");
    setHealth(health.ok);
  } catch {
    setHealth(false);
  }
  await loadOrder();
}

init().catch((error) => {
  console.error(error);
  setHealth(false);
  renderMessage("维修详情页加载失败。", false);
});
