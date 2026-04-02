const mobileRepairState = {
  items: [],
  filtered: [],
  bound: false,
  previewUrls: {},
  activeItem: null
};

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

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "璇锋眰澶辫触");
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
    throw new Error(data.error || "鎻愪氦澶辫触");
  }
  return data;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("璇诲彇鏂囦欢澶辫触"));
    reader.readAsDataURL(file);
  });
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

function summaryRow(label, value) {
  return `
    <div style="border-radius:18px;background:#f8fbff;border:1px solid rgba(15,59,102,.08);padding:12px 14px;">
      <div style="font-size:12px;color:#64748b;">${escapeHtml(label)}</div>
      <div style="margin-top:4px;font-size:14px;font-weight:700;color:#0f172a;line-height:1.5;">${escapeHtml(value || "-")}</div>
    </div>
  `;
}

function timelineTypeStyle(type) {
  if (type === "current") return { dot: "#0f3b66", line: "rgba(15,59,102,.22)", bg: "#eef4fb" };
  if (type === "start") return { dot: "#0ea5e9", line: "rgba(14,165,233,.2)", bg: "#f0f9ff" };
  return { dot: "#16a34a", line: "rgba(22,163,74,.16)", bg: "#f6fef8" };
}

function renderTimeline(items, notes) {
  const timeline = Array.isArray(items) ? items : [];
  const extraNotes = Array.isArray(notes) ? notes : [];

  if (!timeline.length && !extraNotes.length) {
    return `
      <div style="border-radius:18px;border:1px dashed rgba(15,59,102,.16);padding:14px;color:#64748b;text-align:center;">
        鏆傛棤缁翠慨鍘嗗彶
      </div>
    `;
  }

  const timelineHtml = timeline
    .map((entry, index) => {
      const style = timelineTypeStyle(entry.type);
      return `
        <div style="display:grid;grid-template-columns:18px 1fr;gap:12px;align-items:flex-start;">
          <div style="display:grid;justify-items:center;">
            <span style="width:12px;height:12px;border-radius:999px;background:${style.dot};margin-top:6px;"></span>
            ${index === timeline.length - 1 ? "" : `<span style="width:2px;min-height:44px;background:${style.line};display:block;"></span>`}
          </div>
          <div style="border-radius:18px;background:${style.bg};border:1px solid rgba(15,59,102,.08);padding:12px 14px;">
            <div style="font-size:12px;color:#64748b;">${escapeHtml(entry.timeLabel || "-")}</div>
            <div style="margin-top:4px;font-size:14px;font-weight:700;color:#0f172a;">${escapeHtml(entry.title || "-")}</div>
            <div style="margin-top:4px;font-size:13px;line-height:1.6;color:#334155;">${escapeHtml(entry.detail || "-")}</div>
          </div>
        </div>
      `;
    })
    .join("");

  const notesHtml = extraNotes.length
    ? `
      <div style="margin-top:14px;display:grid;gap:8px;">
        <div style="font-size:12px;color:#64748b;font-weight:700;">现场备注</div>
        ${extraNotes
          .map(
            (note) => `
              <div style="border-radius:16px;background:#fff;border:1px solid rgba(15,59,102,.08);padding:12px 14px;">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                  <div style="font-size:13px;line-height:1.6;color:#0f172a;">${escapeHtml(note.text || "无备注")}</div>
                  <span class="tag ${escapeHtml(note.status || "pending")}" style="min-height:24px;">${escapeHtml(note.status || "note")}</span>
                </div>
                <div style="margin-top:6px;font-size:12px;color:#64748b;">${escapeHtml(formatDate(note.createdAt))}</div>
              </div>
            `
          )
          .join("")}
      </div>
    `
    : "";

  return `<div style="display:grid;gap:10px;">${timelineHtml}</div>${notesHtml}`;
}

function renderSummary(items) {
  if (!$("repair-summary")) return;
  const pending = items.filter((item) => item.status === "pending").length;
  const inProgress = items.filter((item) => item.status === "in_progress").length;
  const completed = items.filter((item) => item.status === "completed").length;

  $("repair-summary").innerHTML = [
    ["工单总数", items.length],
    ["待处理", pending],
    ["维修中", inProgress],
    ["已完成", completed]
  ]
    .map(
      ([label, value]) => `
        <div class="metric">
          <label>${label}</label>
          <strong>${escapeHtml(value)}</strong>
        </div>
      `
    )
    .join("");
}

function renderPreview(id) {
  const previewUrl = mobileRepairState.previewUrls[id];
  if (!previewUrl) return "";

  return `
    <div class="repair-status-preview" data-id="${escapeHtml(id)}">
      <img
        src="${previewUrl}"
        alt="preview"
        style="width:100%;max-width:180px;border-radius:14px;border:1px solid rgba(15,59,102,.12);display:block;"
      />
    </div>
  `;
}

function renderList(items) {
  $("repair-list").innerHTML = items.length
    ? items
        .map(
          (item) => `
            <div class="item">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                <div>
                  <div class="item-title">${escapeHtml(item.title || "-")}</div>
                  <div class="item-meta">#${escapeHtml(item.id || "-")} / ${escapeHtml(item.assetLocation?.name || "-")}</div>
                </div>
                <div style="display:grid;gap:6px;justify-items:end;">
                  <span class="tag ${escapeHtml(item.priority || "P2")}">${escapeHtml(item.priorityLabel || item.priority || "-")}</span>
                  <span class="tag ${escapeHtml(item.status || "pending")}">${escapeHtml(item.statusLabel || item.status || "-")}</span>
                </div>
              </div>
              <div class="item-meta" style="margin-top:8px;">
                客户: ${escapeHtml(item.customer?.name || "未填写")} / 工程师: ${escapeHtml(item.assignedEngineer?.name || "待派单")}
              </div>
              <div class="item-meta" style="margin-top:4px;">
                预计时间: ${escapeHtml(item.etaLabel || formatDate(item.eta) || "-")}
              </div>
              <div style="display:grid;gap:8px;margin-top:12px;">
                <select class="input repair-status-update" data-id="${escapeHtml(item.id)}" style="min-height:38px;">
                  <option value="pending" ${item.status === "pending" ? "selected" : ""}>待处理</option>
                  <option value="in_progress" ${item.status === "in_progress" ? "selected" : ""}>维修中</option>
                  <option value="completed" ${item.status === "completed" ? "selected" : ""}>已完成</option>
                </select>
                <input class="input repair-status-note" data-id="${escapeHtml(item.id)}" placeholder="状态备注（可选）" style="min-height:38px;" />
                <input
                  class="input repair-status-photo"
                  data-id="${escapeHtml(item.id)}"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  style="min-height:38px;padding:8px 12px;background:#fff;"
                />
                ${renderPreview(item.id)}
                <button
                  class="btn secondary repair-status-submit"
                  data-id="${escapeHtml(item.id)}"
                  type="button"
                  style="background:#eef4fb;color:#0f3b66;border:1px solid rgba(15,59,102,.12);"
                >
                  更新状态</button>
                <div class="item-meta repair-status-message" data-id="${escapeHtml(item.id)}">完成工单时需要上传完工照片。</div>
              </div>
              <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px;">
                <button
                  class="btn secondary repair-summary-open"
                  data-id="${escapeHtml(item.id)}"
                  type="button"
                  style="min-height:38px;background:#eef4fb;color:#0f3b66;border:1px solid rgba(15,59,102,.12);"
                >
                  宸ュ崟鎽樿
                </button>
                <a class="btn primary" href="tel:${escapeHtml(item.customer?.phone || "")}" style="min-height:38px;">鑱旂郴瀹㈡埛</a>
                <a
                  class="btn secondary"
                  href="/mobile-repair-detail.html?id=${encodeURIComponent(item.id)}"
                  style="min-height:38px;background:#eef4fb;color:#0f3b66;border:1px solid rgba(15,59,102,.12);"
                >
                  鏌ョ湅璇︽儏
                </a>
              </div>
            </div>
          `
        )
        .join("")
    : `<div class="empty">褰撳墠娌℃湁鍖归厤鐨勭淮淇伐鍗?/div>`;
}

function applyFilters() {
  const keyword = $("repair-search").value.trim().toLowerCase();
  const status = $("repair-status").value;

  mobileRepairState.filtered = mobileRepairState.items.filter((item) => {
    const haystack = [
      item.id,
      item.title,
      item.description,
      item.assetLocation?.name,
      item.customer?.name,
      item.customer?.phone,
      item.assignedEngineer?.name
    ]
      .join(" ")
      .toLowerCase();

    const matchKeyword = !keyword || haystack.includes(keyword);
    const matchStatus = status === "all" || item.status === status;
    return matchKeyword && matchStatus;
  });

  renderSummary(mobileRepairState.filtered);
  renderList(mobileRepairState.filtered);
}

async function openSummary(id) {
  const basicItem = mobileRepairState.items.find((entry) => String(entry.id) === String(id));
  if (!basicItem) return;

  $("repair-summary-title").textContent = basicItem.title || `宸ュ崟 ${basicItem.id || ""}`;
  $("repair-summary-content").innerHTML = `
    <div style="border-radius:18px;border:1px dashed rgba(15,59,102,.16);padding:14px;color:#64748b;text-align:center;">
      姝ｅ湪鍔犺浇缁翠慨鍘嗗彶...
    </div>
  `;
  $("repair-summary-call").href = basicItem.customer?.phone ? `tel:${basicItem.customer.phone}` : "#";
  $("repair-summary-open").href = `/mobile-repair-detail.html?id=${encodeURIComponent(basicItem.id || "")}`;
  $("repair-summary-modal").style.display = "flex";
  document.body.style.overflow = "hidden";

  try {
    const result = await fetchJson(`/api/repair-order?id=${encodeURIComponent(id)}`);
    const item = result.order || basicItem;
    mobileRepairState.activeItem = item;
    $("repair-summary-title").textContent = item.title || `宸ュ崟 ${item.id || ""}`;
    $("repair-summary-call").href = item.customer?.phone ? `tel:${item.customer.phone}` : "#";
    $("repair-summary-open").href = `/mobile-repair-detail.html?id=${encodeURIComponent(item.id || "")}`;
    $("repair-summary-content").innerHTML = [
      summaryRow("工单编号", item.id || "-"),
      summaryRow("客户", item.customer?.name || "-"),
      summaryRow("联系电话", item.customer?.phone || "-"),
      summaryRow("站点", item.assetLocation?.name || "-"),
      summaryRow("状态", item.statusLabel || item.status || "-"),
      summaryRow("优先级", item.priorityLabel || item.priority || "-"),
      summaryRow("工程师", item.assignedEngineer?.name || "-"),
      summaryRow("预计时间", item.etaLabel || formatDate(item.eta)),
      summaryRow("报修描述", item.description || item.issueDescription || item.technicianFeedback || "-"),
      summaryRow("创建时间", formatDate(item.createdAt)),
      summaryRow("最近更新", formatDate(item.updatedAt)),
      `
        <div style="display:grid;gap:10px;">
          <div style="font-size:12px;color:#64748b;font-weight:700;">维修历史时间线</div>
          ${renderTimeline(item.timeline, item.notes)}
        </div>
      `
    ].join("");
  } catch (error) {
    $("repair-summary-content").innerHTML = `
      <div style="border-radius:18px;border:1px dashed rgba(239,68,68,.25);padding:14px;color:#b91c1c;text-align:center;">
        缁翠慨鍘嗗彶鍔犺浇澶辫触: ${escapeHtml(error.message || "unknown")}
      </div>
    `;
  }
}

function closeSummary() {
  mobileRepairState.activeItem = null;
  $("repair-summary-modal").style.display = "none";
  document.body.style.overflow = "";
}

async function updateRepairStatus(id) {
  const statusSelect = document.querySelector(`.repair-status-update[data-id="${CSS.escape(id)}"]`);
  const noteInput = document.querySelector(`.repair-status-note[data-id="${CSS.escape(id)}"]`);
  const photoInput = document.querySelector(`.repair-status-photo[data-id="${CSS.escape(id)}"]`);
  const message = document.querySelector(`.repair-status-message[data-id="${CSS.escape(id)}"]`);
  if (!statusSelect || !message) return;

  const status = statusSelect.value;
  const note = noteInput?.value.trim() || "";
  const file = photoInput?.files?.[0];
  let photoDataUrl = "";

  if (status === "completed") {
    if (!file) {
      message.textContent = "瀹屾垚宸ュ崟蹇呴』涓婁紶瀹屽伐鐓х墖";
      return;
    }
    photoDataUrl = await readFileAsDataUrl(file);
  } else if (file) {
    photoDataUrl = await readFileAsDataUrl(file);
  }

  try {
    await postJson("/api/repair-order/status", {
      id,
      status,
      text: note,
      photoDataUrl
    });

    if (mobileRepairState.previewUrls[id]) {
      URL.revokeObjectURL(mobileRepairState.previewUrls[id]);
      delete mobileRepairState.previewUrls[id];
    }

    message.textContent = "状态更新成功";
    await init(true);
  } catch (error) {
    message.textContent = error.message || "状态更新失败";
  }
}

function updatePreview(id, file) {
  const previewUrl = mobileRepairState.previewUrls[id];
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    delete mobileRepairState.previewUrls[id];
  }

  if (!file) {
    applyFilters();
    return;
  }

  mobileRepairState.previewUrls[id] = URL.createObjectURL(file);
  applyFilters();
}

async function init(skipBind = false) {
  const result = await fetchJson("/api/repair-orders");
  mobileRepairState.items = Array.isArray(result.items) ? result.items : [];

  if (!mobileRepairState.bound && !skipBind) {
    $("repair-search").addEventListener("input", applyFilters);
    $("repair-status").addEventListener("change", applyFilters);

    $("repair-list").addEventListener("click", (event) => {
      const statusButton = event.target.closest(".repair-status-submit");
      if (statusButton) {
        updateRepairStatus(statusButton.dataset.id).catch((error) => {
          const message = document.querySelector(
            `.repair-status-message[data-id="${CSS.escape(statusButton.dataset.id)}"]`
          );
          if (message) message.textContent = error.message || "状态更新失败";
        });
        return;
      }

      const summaryButton = event.target.closest(".repair-summary-open");
      if (summaryButton) {
        openSummary(summaryButton.dataset.id).catch(() => {});
      }
    });

    $("repair-list").addEventListener("change", (event) => {
      const input = event.target.closest(".repair-status-photo");
      if (!input) return;
      updatePreview(input.dataset.id, input.files?.[0] || null);
    });

    $("repair-summary-close").addEventListener("click", closeSummary);
    $("repair-summary-modal").addEventListener("click", (event) => {
      if (event.target === $("repair-summary-modal")) closeSummary();
    });

    mobileRepairState.bound = true;
  }

  applyFilters();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((error) => {
    document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif;">鎵嬫満缁翠慨椤靛姞杞藉け璐? ${escapeHtml(error.message || "unknown")}</div>`;
  });
});

