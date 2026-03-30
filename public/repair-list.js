const repairListState = {
  items: [],
  engineers: []
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEngineerOptions(selectedId = "", selectedName = "") {
  const selected = String(selectedId || "").trim();
  const fallbackName = String(selectedName || "").trim();
  const engineers = Array.isArray(repairListState.engineers) ? repairListState.engineers : [];
  const hasSelected = selected && engineers.some((item) => item.id === selected);
  const options = engineers.map((item) => `
    <option value="${escapeHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.name)}</option>
  `).join("");
  const fallback = hasSelected
    ? `<option value="">请选择工程师</option>`
    : `<option value="" ${selected ? "" : "selected"}>${escapeHtml(fallbackName || "请选择工程师")}</option>`;
  return `${fallback}${options}`;
}

function renderRepairList() {
  const wrap = document.getElementById("repair-list-wrap");
  const keyword = (document.getElementById("repair-list-search").value || "").trim().toLowerCase();
  const status = document.getElementById("repair-list-status").value;
  const rows = repairListState.items.filter((item) => {
    const haystack = [
      item.id,
      item.title,
      item.assetLocation?.name,
      item.customer?.name,
      item.assignedEngineer?.name
    ].join(" ").toLowerCase();
    const matchesKeyword = !keyword || haystack.includes(keyword);
    const matchesStatus = status === "all" || item.status === status;
    return matchesKeyword && matchesStatus;
  });

  if (!rows.length) {
    wrap.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-5 py-4 text-sm text-slate-500">当前没有匹配的维修单。</div>`;
    return;
  }

  wrap.innerHTML = rows.map((item) => `
    <div class="rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-low p-5">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <a href="/repair.html?id=${encodeURIComponent(item.id)}" class="block min-w-0 flex-1 space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">${escapeHtml(item.id)}</span>
            <span class="rounded-full bg-secondary-container/30 px-3 py-1 text-xs font-bold text-secondary">${escapeHtml(item.priorityLabel || item.priority || "-")}</span>
            <span class="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700">${escapeHtml(item.statusLabel || item.status || "-")}</span>
          </div>
          <div class="text-xl font-bold text-primary">${escapeHtml(item.title || "-")}</div>
          <div class="text-sm text-slate-500">${escapeHtml(item.assetLocation?.name || "-")} / ${escapeHtml(item.customer?.name || "未填写客户")}</div>
          <div class="grid grid-cols-1 gap-3 text-sm lg:max-w-[420px] md:grid-cols-2">
            <div class="rounded-2xl bg-white px-4 py-3">
              <div class="text-[11px] uppercase tracking-widest text-slate-400">预计时间</div>
              <div class="mt-1 font-bold text-slate-800">${escapeHtml(item.etaLabel || "-")}</div>
            </div>
            <div class="rounded-2xl bg-white px-4 py-3">
              <div class="text-[11px] uppercase tracking-widest text-slate-400">工程师</div>
              <div class="mt-1 font-bold text-slate-800">${escapeHtml(item.assignedEngineer?.name || "待派单")}</div>
            </div>
          </div>
        </a>
        <div class="flex flex-wrap gap-3 lg:w-[420px] lg:justify-end">
          <button class="rounded-xl bg-white px-4 py-2 text-sm font-bold text-primary" data-action="edit" data-id="${escapeHtml(item.id)}">编辑</button>
          <div class="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
            <select class="repair-reassign-select rounded-lg border border-outline-variant/25 bg-surface-container-low px-3 py-2 text-sm" data-id="${escapeHtml(item.id)}">
              ${renderEngineerOptions(item.assignedEngineer?.id, item.assignedEngineer?.name)}
            </select>
            <button class="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white" data-action="reassign" data-id="${escapeHtml(item.id)}">派单</button>
          </div>
          <button class="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700" data-action="delete" data-id="${escapeHtml(item.id)}">删除</button>
        </div>
      </div>
    </div>
  `).join("");
}

async function loadEngineers() {
  const response = await fetch("/api/employees?role=engineer");
  const result = await response.json();
  repairListState.engineers = Array.isArray(result.items)
    ? result.items.filter((item) => item.status !== "resigned")
    : [];
}

async function loadRepairOrders() {
  const response = await fetch("/api/repair-orders");
  const result = await response.json();
  repairListState.items = Array.isArray(result.items) ? result.items : [];
  renderRepairList();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

function bindRepairListEvents() {
  document.getElementById("repair-list-search").addEventListener("input", renderRepairList);
  document.getElementById("repair-list-status").addEventListener("change", renderRepairList);
  document.getElementById("repair-list-wrap").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    event.preventDefault();
    const id = button.dataset.id;
    const action = button.dataset.action;

    if (action === "delete") {
      if (!window.confirm("确认删除这张维修单吗？")) return;
      const result = await postJson("/api/repair-orders/delete", { id });
      if (!result.ok) {
        window.alert(result.error || "删除失败");
        return;
      }
      await loadRepairOrders();
      return;
    }

    if (action === "reassign") {
      const select = document.querySelector(`.repair-reassign-select[data-id="${CSS.escape(id)}"]`);
      const engineerId = select?.value || "";
      if (!engineerId) {
        window.alert("请选择工程师");
        return;
      }
      const result = await postJson("/api/repair-orders/reassign", { id, engineerId });
      if (!result.ok) {
        window.alert(result.error || "重新派单失败");
        return;
      }
      await loadRepairOrders();
      return;
    }

    if (action === "edit") {
      const current = repairListState.items.find((item) => item.id === id);
      if (!current) return;
      const nextTitle = window.prompt("修改故障标题", current.title || "");
      if (!nextTitle) return;
      const result = await postJson("/api/repair-orders/update", { id, title: nextTitle });
      if (!result.ok) {
        window.alert(result.error || "编辑失败");
        return;
      }
      await loadRepairOrders();
    }
  });
}

bindRepairListEvents();
Promise.all([loadEngineers(), loadRepairOrders()]).catch((error) => {
  console.error(error);
  document.getElementById("repair-list-wrap").innerHTML = `<div class="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">维修单列表加载失败。</div>`;
});
