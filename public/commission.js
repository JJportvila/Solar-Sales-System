const commissionState = { items: [], activeId: "" };

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(value) {
  return `VT ${Math.abs(Number(value || 0)).toLocaleString("en-US")}`;
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error || "保存失败");
  renderCommission(data.commissionPool || []);
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function printTable(title, headers, rows) {
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:24px;}h1{font-size:24px;}table{width:100%;border-collapse:collapse;margin-top:16px;}th,td{border:1px solid #cfd6e4;padding:10px;text-align:left;font-size:12px;}th{background:#eef2f8;}</style></head><body><h1>${title}</h1><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
  win.document.close();
  win.focus();
  win.print();
}

function renderModal(item) {
  if (!item) return;
  document.getElementById("commission-modal-subtitle").textContent = `${item.name} / ${item.role}`;
  document.getElementById("commission-modal-body").innerHTML = `
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="rounded-2xl bg-slate-50 p-4"><div class="text-xs text-muted">总佣金</div><div class="mt-1 text-lg font-extrabold text-primary">${money(item.amount)}</div></div>
      <div class="rounded-2xl bg-slate-50 p-4"><div class="text-xs text-muted">释放率</div><div class="mt-1 text-lg font-extrabold text-primary">${Number(item.releaseRate || 0)}%</div></div>
      <div class="rounded-2xl bg-slate-50 p-4"><div class="text-xs text-muted">已释放</div><div class="mt-1 text-lg font-extrabold text-primary">${money(item.releasedAmount)}</div></div>
      <div class="rounded-2xl bg-slate-50 p-4"><div class="text-xs text-muted">锁定金额</div><div class="mt-1 text-lg font-extrabold text-primary">${money(item.lockedAmount)}</div></div>
    </div>
    <div class="mt-5 rounded-2xl border border-line bg-white p-4">
      <div class="text-sm font-bold text-primary">释放说明</div>
      <div class="mt-2 text-sm text-muted">当前状态为 ${escapeHtml(item.releaseStatus)}。当释放率提高时，系统会同步调整已释放金额和锁定金额。</div>
    </div>
  `;
  document.getElementById("commission-modal").classList.remove("hidden");
  document.getElementById("commission-modal").classList.add("flex");
}

function renderCommission(items = []) {
  commissionState.items = items;
  document.getElementById("commission-total").textContent = money(items.reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const wrap = document.getElementById("commission-list");
  if (!items.length) {
    wrap.innerHTML = `<div class="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center text-sm text-blue-100">暂无佣金记录</div>`;
    return;
  }
  wrap.innerHTML = items.map((item) => `
    <div class="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 font-black text-accent">${escapeHtml(item.name.slice(0, 2).toUpperCase())}</div>
        <div class="flex-1">
          <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div class="text-sm font-bold">${escapeHtml(item.name)} / ${escapeHtml(item.role)}</div>
            <div class="text-xs font-bold text-accent">释放率 ${Number(item.releaseRate || 0)}%</div>
          </div>
          <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
            <div class="h-full rounded-full bg-accent" style="width:${Math.max(2, Number(item.releaseRate || 0))}%"></div>
          </div>
          <div class="mt-3 flex flex-wrap gap-3 text-xs text-blue-100">
            <span>总佣金 ${money(item.amount)}</span>
            <span>已释放 ${money(item.releasedAmount)}</span>
            <span>锁定 ${money(item.lockedAmount)}</span>
          </div>
        </div>
        <div class="grid grid-cols-[100px_120px] gap-2">
          <input class="commission-rate rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" data-id="${escapeHtml(item.id)}" max="100" min="0" type="number" value="${Number(item.releaseRate || 0)}" />
          <select class="commission-status rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white" data-id="${escapeHtml(item.id)}">
            ${["申请释放", "锁定中", "已释放"].map((status) => `<option value="${status}" ${status === item.releaseStatus ? "selected" : ""}>${status}</option>`).join("")}
          </select>
        </div>
        <div class="flex gap-2">
          <button class="commission-detail rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white" data-id="${escapeHtml(item.id)}">详情</button>
          <button class="commission-save rounded-xl bg-accent px-4 py-2 text-xs font-bold text-primary" data-id="${escapeHtml(item.id)}">保存</button>
        </div>
      </div>
    </div>
  `).join("");

  if (commissionState.activeId) {
    const active = commissionState.items.find((item) => item.id === commissionState.activeId);
    if (active) renderModal(active);
  }
}

async function loadCommission() {
  const response = await fetch("/api/expense-control");
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error || "加载失败");
  renderCommission(data.commissionPool || []);
}

document.body.addEventListener("click", async (event) => {
  const detailButton = event.target.closest(".commission-detail");
  if (detailButton) {
    const item = commissionState.items.find((entry) => entry.id === detailButton.dataset.id);
    commissionState.activeId = item?.id || "";
    renderModal(item);
    return;
  }

  const saveButton = event.target.closest(".commission-save");
  if (saveButton) {
    const id = saveButton.dataset.id;
    const rate = document.querySelector(`.commission-rate[data-id="${CSS.escape(id)}"]`);
    const status = document.querySelector(`.commission-status[data-id="${CSS.escape(id)}"]`);
    await postJson("/api/expense-control/commission/update", {
      id,
      releaseRate: Number(rate?.value || 0),
      releaseStatus: status?.value || "锁定中"
    });
  }
});

document.getElementById("commission-modal-close").addEventListener("click", () => {
  document.getElementById("commission-modal").classList.add("hidden");
  document.getElementById("commission-modal").classList.remove("flex");
  commissionState.activeId = "";
});

document.getElementById("commission-export").addEventListener("click", () => {
  downloadCsv("commissions.csv", [
    ["姓名", "角色", "总佣金", "释放率", "已释放", "锁定金额", "状态"],
    ...commissionState.items.map((item) => [item.name, item.role, item.amount, `${item.releaseRate}%`, item.releasedAmount, item.lockedAmount, item.releaseStatus])
  ]);
});

document.getElementById("commission-print").addEventListener("click", () => {
  printTable("佣金管理报表", ["姓名", "角色", "总佣金", "释放率", "已释放", "锁定金额", "状态"], commissionState.items.map((item) => [
    item.name,
    item.role,
    money(item.amount),
    `${item.releaseRate}%`,
    money(item.releasedAmount),
    money(item.lockedAmount),
    item.releaseStatus
  ]));
});

loadCommission().catch((error) => {
  console.error(error);
  document.getElementById("commission-list").innerHTML = `<div class="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700">${escapeHtml(error.message || "佣金管理加载失败")}</div>`;
});
