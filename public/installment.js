const installmentState = {
  items: [],
  activeId: "",
  collectors: [],
  company: {
    name: "VSLM Solar & Logistics",
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

function getCompanyProfile() {
  const localCompany = JSON.parse(localStorage.getItem("smart_sizing_company_profile") || "{}");
  return {
    ...installmentState.company,
    ...(localCompany || {})
  };
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload || {})
  });
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error || "保存失败");
  renderInstallments(data.installmentPlans || []);
}

async function loadCollectors() {
  const response = await fetch("/api/employees");
  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];
  installmentState.collectors = items
    .filter((item) => item.status !== "resigned" && ["sales", "sales_manager", "admin"].includes(item.role))
    .map((item) => ({ id: item.id, name: item.name, roleLabel: item.roleLabel || item.role || "员工" }));
}

function renderCollectorOptions(selectedName = "") {
  const options = [`<option value="">选择收款人</option>`];
  installmentState.collectors.forEach((item) => {
    const selected = item.name === selectedName ? "selected" : "";
    options.push(`<option value="${escapeHtml(item.name)}" ${selected}>${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel)}</option>`);
  });
  if (selectedName && !installmentState.collectors.some((item) => item.name === selectedName)) {
    options.push(`<option value="${escapeHtml(selectedName)}" selected>${escapeHtml(selectedName)}</option>`);
  }
  return options.join("");
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

function printReceipt(item, record) {
  if (!item || !record) return;
  const win = window.open("", "_blank", "width=900,height=760");
  if (!win) return;
  const printedAt = new Date().toLocaleString("zh-CN");
  const company = getCompanyProfile();
  win.document.write(`<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>收款收据</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; padding: 24px; color: #0f172a; background: #ffffff; }
        .sheet { max-width: 860px; margin: 0 auto; border: 1px solid #d9deea; border-radius: 24px; padding: 24px 28px; }
        .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 20px; border-bottom: 3px solid #001d44; }
        .title { font-family: Manrope, Arial, sans-serif; font-size: 30px; font-weight: 800; color: #001d44; letter-spacing: 0.08em; }
        .subtitle { margin-top: 8px; font-size: 13px; color: #64748b; }
        .meta { font-size: 13px; line-height: 1.8; color: #475569; }
        .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px; }
        .card { border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; background: #f8fafc; }
        .card-title { font-family: Manrope, Arial, sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; color: #64748b; }
        .card-value { margin-top: 10px; font-size: 22px; font-weight: 800; color: #0f172a; }
        .section { margin-top: 20px; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
        th { width: 190px; background: #f8fafc; color: #64748b; font-weight: 700; }
        td.amount { font-family: Manrope, Arial, sans-serif; font-size: 28px; font-weight: 800; color: #001d44; }
        .company { display: flex; gap: 16px; align-items: flex-start; }
        .logo { width: 72px; height: 72px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 14px; padding: 8px; background: #fff; }
        .footer { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .sign { border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; min-height: 92px; }
        .sign-label { font-size: 12px; color: #64748b; }
        .sign-line { height: 40px; border-bottom: 1px solid #94a3b8; margin-top: 18px; }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="top">
          <div class="company">
            ${company.logoUrl ? `<img class="logo" src="${company.logoUrl}" alt="company logo" />` : ""}
            <div>
              <div class="title">收款收据</div>
              <div class="subtitle">正式收款凭证</div>
              <div class="meta" style="font-weight:700;color:#0f172a;">${escapeHtml(company.name || "-")}</div>
              <div class="meta">TIN: ${escapeHtml(company.tin || "-")}</div>
              <div class="meta">地址: ${escapeHtml(company.address || "-")}</div>
              <div class="meta">电话: ${escapeHtml(company.phone || "-")} ${company.email ? `| 邮箱: ${escapeHtml(company.email)}` : ""}</div>
              <div class="meta">银行: ${escapeHtml(company.bankName || "-")} ${company.bankAccountName ? `| 户名: ${escapeHtml(company.bankAccountName)}` : ""} ${company.bankAccountNumber ? `| 账号: ${escapeHtml(company.bankAccountNumber)}` : ""}</div>
            </div>
          </div>
          <div>
            <div class="meta">收据编号: ${escapeHtml(record.receiptNo || record.id || "-")}</div>
            <div class="meta">打印时间: ${escapeHtml(printedAt)}</div>
          </div>
        </div>
        <div class="cards">
          <div class="card">
            <div class="card-title">付款客户</div>
            <div class="card-value">${escapeHtml(item.name || "-")}</div>
            <div class="meta" style="margin-top:8px;">周期: ${escapeHtml(item.cycleLabel || "-")}</div>
            <div class="meta">状态: ${escapeHtml(item.status || "-")}</div>
          </div>
          <div class="card">
            <div class="card-title">付款汇总</div>
            <div class="card-value">${escapeHtml(money(record.amount))}</div>
            <div class="meta" style="margin-top:8px;">付款日期: ${escapeHtml(record.paidAt || "-")}</div>
            <div class="meta">收款人: ${escapeHtml(record.collectorName || "-")}</div>
          </div>
        </div>

        <div class="section">
          <table>
            <tr><th>收款单号</th><td>${escapeHtml(record.receiptNo || record.id || "-")}</td></tr>
            <tr><th>收款金额</th><td class="amount">${escapeHtml(money(record.amount))}</td></tr>
            <tr><th>付款时间</th><td>${escapeHtml(record.paidAt || "-")}</td></tr>
            <tr><th>收款人</th><td>${escapeHtml(record.collectorName || "-")}</td></tr>
            <tr><th>付款说明</th><td>${escapeHtml(record.note || "-")}</td></tr>
          </table>
        </div>

        <div class="footer">
          <div class="sign"><div class="sign-label">客户签名</div><div class="sign-line"></div></div>
          <div class="sign"><div class="sign-label">收款人签名</div><div class="sign-line"></div></div>
        </div>
      </div>
    </body>
  </html>`);
  win.document.close();
  win.focus();
  win.print();
}

function renderPaymentRecords(item) {
  const records = Array.isArray(item.paymentRecords) ? item.paymentRecords : [];
  if (!records.length) {
    return `<div class="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">暂无付款记录</div>`;
  }
  return `
    <div class="overflow-hidden rounded-2xl border border-slate-200">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-left text-xs uppercase tracking-widest text-slate-500">
          <tr>
            <th class="px-4 py-3">收款单号</th>
            <th class="px-4 py-3">付款金额</th>
            <th class="px-4 py-3">付款时间</th>
            <th class="px-4 py-3">收款人</th>
            <th class="px-4 py-3">付款记录</th>
            <th class="px-4 py-3">收据</th>
          </tr>
        </thead>
        <tbody>
          ${records.map((record) => `
            <tr class="border-t border-slate-100">
              <td class="px-4 py-3 font-mono text-xs text-slate-500">${escapeHtml(record.receiptNo || record.id || "-")}</td>
              <td class="px-4 py-3 font-bold text-primary">${money(record.amount)}</td>
              <td class="px-4 py-3">${escapeHtml(record.paidAt || "-")}</td>
              <td class="px-4 py-3">${escapeHtml(record.collectorName || "-")}</td>
              <td class="px-4 py-3">${escapeHtml(record.note || "-")}</td>
              <td class="px-4 py-3">
                <button class="installment-receipt rounded-xl border border-line bg-white px-3 py-2 text-xs font-bold text-primary" data-plan-id="${escapeHtml(item.id)}" data-record-id="${escapeHtml(record.id)}">打印收据</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderModal(item) {
  if (!item) return;
  document.getElementById("installment-modal-subtitle").textContent = `${item.name} / ${item.cycleLabel}`;
  document.getElementById("installment-modal-body").innerHTML = `
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div class="rounded-2xl bg-slate-50 p-4"><div class="text-xs text-slate-500">当前状态</div><div class="mt-1 text-lg font-extrabold text-primary">${escapeHtml(item.status)}</div></div>
      <div class="rounded-2xl bg-slate-50 p-4"><div class="text-xs text-slate-500">总金额</div><div class="mt-1 text-lg font-extrabold text-primary">${money(item.totalAmount)}</div></div>
      <div class="rounded-2xl bg-slate-50 p-4"><div class="text-xs text-slate-500">已完成期数</div><div class="mt-1 text-lg font-extrabold text-primary">${item.completedWeeks} / ${item.totalWeeks}</div></div>
      <div class="rounded-2xl bg-slate-50 p-4"><div class="text-xs text-slate-500">最近收款</div><div class="mt-1 text-lg font-extrabold text-primary">${item.paymentAmount ? money(item.paymentAmount) : "-"}</div><div class="mt-1 text-xs text-slate-500">${escapeHtml(item.paymentDate || "-")} / ${escapeHtml(item.collectorName || "-")}</div></div>
    </div>
    <div class="mt-5">
      <div class="mb-3 text-sm font-bold text-primary">付款记录</div>
      ${renderPaymentRecords(item)}
    </div>
  `;
  document.getElementById("installment-modal").classList.remove("hidden");
  document.getElementById("installment-modal").classList.add("flex");
}

function renderInstallments(items) {
  installmentState.items = items;
  document.getElementById("installment-summary").textContent = `${items.length} 条计划`;
  const wrap = document.getElementById("installment-grid");
  if (!items.length) {
    wrap.innerHTML = `<div class="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted md:col-span-2">暂无分期计划</div>`;
    return;
  }

  wrap.innerHTML = items.map((item) => `
    <div class="rounded-2xl border border-line/70 bg-slate-50 p-5">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="text-sm font-bold text-primary">${escapeHtml(item.name)}</div>
          <div class="mt-1 text-xs text-muted">${escapeHtml(item.cycleLabel)}</div>
        </div>
        <span class="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary">${escapeHtml(item.status)}</span>
      </div>

      <div class="mt-4 h-3 overflow-hidden rounded-full bg-white">
        <div class="h-full rounded-full bg-primary" style="width:${Math.max(4, Number(item.progress || 0))}%"></div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="rounded-xl bg-white px-4 py-3">
          <div class="text-xs text-muted">总金额</div>
          <div class="mt-1 text-sm font-black text-primary">${money(item.totalAmount)}</div>
        </div>
        <div class="rounded-xl bg-white px-4 py-3">
          <div class="text-xs text-muted">已完成期数</div>
          <div class="mt-1 text-sm font-black text-primary">${item.completedWeeks} / ${item.totalWeeks}</div>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="rounded-xl bg-white px-4 py-3">
          <div class="text-xs text-muted">付款金额</div>
          <input class="installment-payment-amount mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm" data-id="${escapeHtml(item.id)}" type="number" min="0" step="100" value="${Number(item.paymentAmount || 0)}" />
        </div>
        <div class="rounded-xl bg-white px-4 py-3">
          <div class="text-xs text-muted">付款时间</div>
          <input class="installment-payment-date mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm" data-id="${escapeHtml(item.id)}" type="date" value="${escapeHtml((item.paymentDate || "").slice(0, 10))}" />
        </div>
        <div class="rounded-xl bg-white px-4 py-3">
          <div class="text-xs text-muted">收款人</div>
          <select class="installment-collector mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm" data-id="${escapeHtml(item.id)}">
            ${renderCollectorOptions(item.collectorName || "")}
          </select>
        </div>
        <div class="rounded-xl bg-white px-4 py-3">
          <div class="text-xs text-muted">付款记录</div>
          <input class="installment-note mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 text-sm" data-id="${escapeHtml(item.id)}" type="text" value="" placeholder="例如：第 4 期已收齐" />
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_110px_140px]">
        <div class="rounded-xl bg-white px-4 py-3">
          <div class="text-xs text-muted">付款记录数</div>
          <div class="mt-1 text-sm font-black text-primary">${(item.paymentRecords || []).length}</div>
        </div>
        <input class="installment-weeks rounded-xl border border-line bg-white px-4 py-3 text-sm" data-id="${escapeHtml(item.id)}" min="0" max="${item.totalWeeks}" type="number" value="${item.completedWeeks}" />
        <select class="installment-status rounded-xl border border-line bg-white px-4 py-3 text-sm" data-id="${escapeHtml(item.id)}">
          ${["履约中", "即将结清", "逾期风险", "已结清"].map((status) => `<option value="${status}" ${status === item.status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </div>

      <div class="mt-3 flex items-center justify-between gap-3">
        <div class="text-xs text-muted">最近收款：${item.paymentAmount ? money(item.paymentAmount) : "-"} / ${escapeHtml(item.paymentDate || "-")} / ${escapeHtml(item.collectorName || "-")}</div>
        <div class="flex gap-2">
          <button class="installment-detail rounded-xl border border-line bg-white px-4 py-2 text-xs font-bold text-primary" data-id="${escapeHtml(item.id)}">详情</button>
          <button class="installment-save rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white" data-id="${escapeHtml(item.id)}" data-total-weeks="${item.totalWeeks}">保存</button>
        </div>
      </div>
    </div>
  `).join("");

  if (installmentState.activeId) {
    const active = installmentState.items.find((item) => item.id === installmentState.activeId);
    if (active) renderModal(active);
  }
}

async function loadInstallments() {
  await loadCollectors();
  try {
    const companyData = await fetch("/api/company-profile").then((response) => response.json());
    if (companyData?.company) {
      installmentState.company = {
        ...installmentState.company,
        ...companyData.company
      };
    }
  } catch (error) {
    console.warn("load company profile failed", error);
  }
  const response = await fetch("/api/expense-control");
  const data = await response.json();
  if (!response.ok || data?.error) throw new Error(data?.error || "加载失败");
  renderInstallments(data.installmentPlans || []);
}

document.body.addEventListener("click", async (event) => {
  const saveButton = event.target.closest(".installment-save");
  if (saveButton) {
    const id = saveButton.dataset.id;
    const weeksInput = document.querySelector(`.installment-weeks[data-id="${CSS.escape(id)}"]`);
    const statusInput = document.querySelector(`.installment-status[data-id="${CSS.escape(id)}"]`);
    const amountInput = document.querySelector(`.installment-payment-amount[data-id="${CSS.escape(id)}"]`);
    const dateInput = document.querySelector(`.installment-payment-date[data-id="${CSS.escape(id)}"]`);
    const collectorInput = document.querySelector(`.installment-collector[data-id="${CSS.escape(id)}"]`);
    const noteInput = document.querySelector(`.installment-note[data-id="${CSS.escape(id)}"]`);
    await postJson("/api/expense-control/installment/update", {
      id,
      completedWeeks: Number(weeksInput?.value || 0),
      totalWeeks: Number(saveButton.dataset.totalWeeks || 52),
      status: statusInput?.value || "履约中",
      paymentAmount: Number(amountInput?.value || 0),
      paymentDate: dateInput?.value || "",
      collectorName: collectorInput?.value || "",
      paymentNote: noteInput?.value || ""
    });
    if (noteInput) noteInput.value = "";
    return;
  }

  const detailButton = event.target.closest(".installment-detail");
  if (detailButton) {
    const item = installmentState.items.find((entry) => entry.id === detailButton.dataset.id);
    installmentState.activeId = item?.id || "";
    renderModal(item);
    return;
  }

  const receiptButton = event.target.closest(".installment-receipt");
  if (receiptButton) {
    const plan = installmentState.items.find((entry) => entry.id === receiptButton.dataset.planId);
    const record = Array.isArray(plan?.paymentRecords)
      ? plan.paymentRecords.find((entry) => entry.id === receiptButton.dataset.recordId)
      : null;
    printReceipt(plan, record);
  }
});

document.getElementById("installment-modal-close").addEventListener("click", () => {
  document.getElementById("installment-modal").classList.add("hidden");
  document.getElementById("installment-modal").classList.remove("flex");
  installmentState.activeId = "";
});

document.getElementById("installment-export").addEventListener("click", () => {
  downloadCsv("installments.csv", [
    ["计划名称", "周期", "状态", "付款金额", "付款时间", "收款人", "付款记录数", "已完成期数", "总期数", "总金额"],
    ...installmentState.items.map((item) => [
      item.name,
      item.cycleLabel,
      item.status,
      item.paymentAmount || 0,
      item.paymentDate || "",
      item.collectorName || "",
      (item.paymentRecords || []).length,
      item.completedWeeks,
      item.totalWeeks,
      item.totalAmount
    ])
  ]);
});

document.getElementById("installment-print").addEventListener("click", () => {
  printTable("分期管理报表", ["计划名称", "周期", "状态", "付款金额", "付款时间", "收款人", "付款记录数", "已完成期数", "总期数", "总金额"], installmentState.items.map((item) => [
    item.name,
    item.cycleLabel,
    item.status,
    money(item.paymentAmount || 0),
    item.paymentDate || "-",
    item.collectorName || "-",
    String((item.paymentRecords || []).length),
    String(item.completedWeeks),
    String(item.totalWeeks),
    money(item.totalAmount)
  ]));
});

loadInstallments().catch((error) => {
  console.error(error);
  document.getElementById("installment-grid").innerHTML = `<div class="rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 md:col-span-2">${escapeHtml(error.message || "分期管理加载失败")}</div>`;
});
function printReceipt(item, record) {
  if (!item || !record) return;
  const win = window.open("", "_blank", "width=900,height=760");
  if (!win) return;
  const printedAt = new Date().toLocaleString("en-US");
  const company = getCompanyProfile();
  win.document.write(`<!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Payment Receipt</title>
      <style>
        body { font-family: Inter, Arial, sans-serif; padding: 24px; color: #0f172a; background: #ffffff; }
        .sheet { max-width: 860px; margin: 0 auto; border: 1px solid #d9deea; border-radius: 24px; padding: 24px 28px; }
        .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 20px; border-bottom: 3px solid #001d44; }
        .title { font-family: Manrope, Arial, sans-serif; font-size: 30px; font-weight: 800; color: #001d44; letter-spacing: 0.08em; }
        .subtitle { margin-top: 8px; font-size: 13px; color: #64748b; }
        .meta { font-size: 13px; line-height: 1.8; color: #475569; }
        .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 18px; }
        .card { border: 1px solid #e2e8f0; border-radius: 18px; padding: 16px; background: #f8fafc; }
        .card-title { font-family: Manrope, Arial, sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; color: #64748b; }
        .card-value { margin-top: 10px; font-size: 22px; font-weight: 800; color: #0f172a; }
        .section { margin-top: 20px; border: 1px solid #e2e8f0; border-radius: 18px; overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 14px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 13px; }
        th { width: 190px; background: #f8fafc; color: #64748b; font-weight: 700; }
        td.amount { font-family: Manrope, Arial, sans-serif; font-size: 28px; font-weight: 800; color: #001d44; }
        .company { display: flex; gap: 16px; align-items: flex-start; }
        .logo { width: 72px; height: 72px; object-fit: contain; border: 1px solid #e2e8f0; border-radius: 14px; padding: 8px; background: #fff; }
        .footer { margin-top: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .sign { border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; min-height: 92px; }
        .sign-label { font-size: 12px; color: #64748b; }
        .sign-line { height: 40px; border-bottom: 1px solid #94a3b8; margin-top: 18px; }
      </style>
    </head>
    <body>
      <div class="sheet">
        <div class="top">
          <div class="company">
            ${company.logoUrl ? `<img class="logo" src="${company.logoUrl}" alt="company logo" />` : ""}
            <div>
              <div class="title">PAYMENT RECEIPT</div>
              <div class="subtitle">Official payment receipt</div>
              <div class="meta" style="font-weight:700;color:#0f172a;">${escapeHtml(company.name || "-")}</div>
              <div class="meta">TIN: ${escapeHtml(company.tin || "-")}</div>
              <div class="meta">Address: ${escapeHtml(company.address || "-")}</div>
              <div class="meta">Phone: ${escapeHtml(company.phone || "-")} ${company.email ? `| Email: ${escapeHtml(company.email)}` : ""}</div>
              <div class="meta">Bank: ${escapeHtml(company.bankName || "-")} ${company.bankAccountName ? `| Account Name: ${escapeHtml(company.bankAccountName)}` : ""} ${company.bankAccountNumber ? `| Account No: ${escapeHtml(company.bankAccountNumber)}` : ""}</div>
            </div>
          </div>
          <div>
            <div class="meta">Receipt No: ${escapeHtml(record.receiptNo || record.id || "-")}</div>
            <div class="meta">Printed At: ${escapeHtml(printedAt)}</div>
          </div>
        </div>
        <div class="cards">
          <div class="card">
            <div class="card-title">CUSTOMER</div>
            <div class="card-value">${escapeHtml(item.name || "-")}</div>
            <div class="meta" style="margin-top:8px;">Cycle: ${escapeHtml(item.cycleLabel || "-")}</div>
            <div class="meta">Status: ${escapeHtml(item.status || "-")}</div>
          </div>
          <div class="card">
            <div class="card-title">PAYMENT SUMMARY</div>
            <div class="card-value">${escapeHtml(money(record.amount))}</div>
            <div class="meta" style="margin-top:8px;">Payment Date: ${escapeHtml(record.paidAt || "-")}</div>
            <div class="meta">Collected By: ${escapeHtml(record.collectorName || "-")}</div>
          </div>
        </div>
        <div class="section">
          <table>
            <tr><th>Receipt No</th><td>${escapeHtml(record.receiptNo || record.id || "-")}</td></tr>
            <tr><th>Amount Received</th><td class="amount">${escapeHtml(money(record.amount))}</td></tr>
            <tr><th>Payment Date</th><td>${escapeHtml(record.paidAt || "-")}</td></tr>
            <tr><th>Collected By</th><td>${escapeHtml(record.collectorName || "-")}</td></tr>
            <tr><th>Remark</th><td>${escapeHtml(record.note || "-")}</td></tr>
          </table>
        </div>
        <div class="footer">
          <div class="sign"><div class="sign-label">Customer Signature</div><div class="sign-line"></div></div>
          <div class="sign"><div class="sign-label">Collector Signature</div><div class="sign-line"></div></div>
        </div>
      </div>
    </body>
  </html>`);
  win.document.close();
  win.focus();
  win.print();
}
