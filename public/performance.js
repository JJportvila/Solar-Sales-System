const performanceState = {
  data: null,
  map: null,
  markers: []
};

function money(value) {
  return `VT ${Math.max(0, Number(value || 0)).toLocaleString("en-US")}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatStatus(value = "") {
  const map = {
    draft: "草稿待跟进",
    sent: "已发送待付款",
    paid: "已付款",
    completed: "已完成"
  };
  return map[String(value || "").toLowerCase()] || value || "-";
}

function badgeMeta(value) {
  if (value === "明星") return "bg-cyan-100 text-cyan-700";
  if (value === "优秀") return "bg-emerald-100 text-emerald-700";
  return "bg-amber-100 text-amber-700";
}

function renderTrend(items = []) {
  const wrap = document.getElementById("performance-trend");
  const maxValue = Math.max(1, ...items.map((item) => item.value || 0));
  wrap.innerHTML = items.map((item, index) => {
    const height = Math.max(28, Math.round(((item.value || 0) / maxValue) * 96));
    const color = index === items.length - 1 ? "bg-secondary" : "bg-primary/20";
    return `
      <button class="group flex h-full flex-col items-center justify-end gap-2 text-center" data-detail-type="month" data-detail-key="${escapeHtml(item.key || item.label)}">
        <div class="w-full rounded-t-2xl ${color} transition group-hover:opacity-80" style="height:${height}px"></div>
        <div class="text-[11px] font-bold text-slate-400">${escapeHtml(item.label)}</div>
      </button>
    `;
  }).join("");
}

function renderTeam(items = []) {
  const tbody = document.getElementById("performance-team-body");
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="rounded-2xl bg-surface-container-low px-4 py-6 text-center text-sm text-slate-500">暂无业绩数据</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((item) => `
    <tr class="bg-surface-container-low">
      <td class="rounded-l-2xl px-4 py-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-white text-primary flex items-center justify-center font-black">${escapeHtml(item.name.slice(0, 2).toUpperCase())}</div>
          <div>
            <button class="font-bold text-primary hover:underline" data-detail-type="employee" data-detail-key="${escapeHtml(item.id)}">${escapeHtml(item.name)}</button>
            <div class="text-xs text-slate-500">${escapeHtml(item.roleLabel)} / ${escapeHtml(item.branch)}</div>
          </div>
        </div>
      </td>
      <td class="px-4 py-4 font-bold text-primary">${money(item.monthlyAmount)}</td>
      <td class="px-4 py-4 text-slate-600">${money(item.targetAmount)}</td>
      <td class="px-4 py-4 font-black ${item.achievementRate >= 100 ? "text-emerald-600" : "text-secondary"}">${item.achievementRate}%</td>
      <td class="px-4 py-4">
        <span class="inline-flex items-center gap-2">
          <span class="inline-block h-2 w-2 rounded-full ${item.collectionStatus === "正常" ? "bg-emerald-500" : "bg-amber-500"}"></span>
          <span>${escapeHtml(item.collectionStatus)}</span>
        </span>
      </td>
      <td class="rounded-r-2xl px-4 py-4">
        <span class="rounded-full px-3 py-1 text-xs font-bold ${badgeMeta(item.badge)}">${escapeHtml(item.badge)}</span>
      </td>
    </tr>
  `).join("");
}

function buildPrintableHtml(data) {
  const overdueItems = data.details?.overdue?.items || [];
  return `
    <div style="font-family:Inter,sans-serif;color:#0f172a;padding:32px 36px;">
      <h1 style="font-family:Manrope,sans-serif;font-size:30px;margin:0 0 8px;">${escapeHtml(data.title)}</h1>
      <p style="margin:0 0 20px;color:#475569;">自动生成的月度业绩报告</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #cbd5e1;">
        <thead>
          <tr>
            <th colspan="6" style="text-align:left;padding:12px 14px;background:#001d44;color:#fff;font-size:14px;">汇总指标</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;background:#f8fafc;">本月销售达成率</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${data.summary.achievementRate}%</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;background:#f8fafc;">未付款报价占比</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${data.summary.collectionOverdueRate}%</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;background:#f8fafc;">在途业务项目</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${data.summary.activeProjects}</td>
          </tr>
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;background:#f8fafc;">本月签约金额</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${money(data.summary.totalActual)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;background:#f8fafc;">本月目标金额</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${money(data.summary.totalTarget)}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;background:#f8fafc;">区域覆盖率</td>
            <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${data.summary.coverageRate}%</td>
          </tr>
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #cbd5e1;">
        <thead>
          <tr>
            <th colspan="5" style="text-align:left;padding:12px 14px;background:#001d44;color:#fff;font-size:14px;">团队绩效表</th>
          </tr>
          <tr>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">姓名</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">角色</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">本月达成</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">目标</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">达成率</th>
          </tr>
        </thead>
        <tbody>
          ${data.team.map((item) => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.name)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.roleLabel)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${money(item.monthlyAmount)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${money(item.targetAmount)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${item.achievementRate}%</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #cbd5e1;">
        <thead>
          <tr>
            <th colspan="6" style="text-align:left;padding:12px 14px;background:#001d44;color:#fff;font-size:14px;">待跟进未付款报价明细</th>
          </tr>
          <tr>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">客户</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">电话</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">邮箱</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">套装</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">金额</th>
            <th style="text-align:left;padding:10px 12px;border-bottom:1px solid #cbd5e1;background:#f8fafc;">状态</th>
          </tr>
        </thead>
        <tbody>
          ${overdueItems.length ? overdueItems.map((item) => `
            <tr>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.customerName || "-")}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.customerPhone || "-")}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.customerEmail || "-")}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(item.packageName || "-")}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${money(item.total)}</td>
              <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(formatStatus(item.status))}</td>
            </tr>
          `).join("") : `
            <tr><td colspan="6" style="padding:12px;border-bottom:1px solid #e2e8f0;">暂无未付款报价</td></tr>
          `}
        </tbody>
      </table>

      <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;">
        <thead>
          <tr>
            <th colspan="1" style="text-align:left;padding:12px 14px;background:#001d44;color:#fff;font-size:14px;">月度业务洞察</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:14px;line-height:1.9;border-bottom:1px solid #e2e8f0;">${escapeHtml(data.insight.text)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function exportCsv() {
  const data = performanceState.data;
  if (!data) return;
  const headers = ["姓名", "角色", "分支", "本月达成", "目标", "达成率", "回款状态", "标签"];
  const rows = data.team.map((item) => [
    item.name,
    item.roleLabel,
    item.branch,
    item.monthlyAmount,
    item.targetAmount,
    item.achievementRate,
    item.collectionStatus,
    item.badge
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "performance-report.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function printReport() {
  const data = performanceState.data;
  if (!data) return;
  const printable = document.getElementById("performance-printable");
  printable.innerHTML = buildPrintableHtml(data);
  printable.classList.remove("hidden");
  window.print();
  printable.classList.add("hidden");
}

function generateReport() {
  openAchievementDetail();
}

function renderMap(region = {}) {
  if (!window.L) return;
  const center = region.mapCenter || { lat: -17.7333, lng: 168.3167 };
  const points = Array.isArray(region.points) ? region.points : [];

  if (!performanceState.map) {
    performanceState.map = window.L.map("performance-map", {
      zoomControl: true,
      attributionControl: true
    }).setView([center.lat, center.lng], 7);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(performanceState.map);
  } else {
    performanceState.map.setView([center.lat, center.lng], 7);
  }

  performanceState.markers.forEach((marker) => marker.remove());
  performanceState.markers = points.map((point) => {
    const marker = window.L.circleMarker([point.lat, point.lng], {
      radius: 8,
      color: "#001d44",
      weight: 2,
      fillColor: point.coverageValue >= 85 ? "#feb316" : point.coverageValue >= 75 ? "#38bdf8" : "#34d399",
      fillOpacity: 0.9
    }).addTo(performanceState.map);
    marker.bindPopup(`
      <div style="min-width:180px;">
        <div style="font-weight:800;color:#001d44;">${escapeHtml(point.name || "覆盖点")}</div>
        <div style="margin-top:4px;font-size:12px;color:#475569;">${escapeHtml(point.location || "")}</div>
        <div style="margin-top:8px;font-size:12px;color:#7f5700;font-weight:700;">覆盖值 ${escapeHtml(point.coverageValue || 0)}%</div>
      </div>
    `);
    return marker;
  });

  if (points.length > 1) {
    const bounds = window.L.latLngBounds(points.map((point) => [point.lat, point.lng]));
    performanceState.map.fitBounds(bounds.pad(0.25));
  }
}

function renderDetailStats(items = []) {
  const wrap = document.getElementById("performance-detail-stats");
  wrap.innerHTML = items.map((item) => `
    <div class="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-4">
      <div class="text-[11px] font-bold uppercase tracking-widest text-slate-400">${escapeHtml(item.label)}</div>
      <div class="mt-2 text-2xl font-black text-primary">${escapeHtml(item.value)}</div>
    </div>
  `).join("");
}

function renderDetailTable(headers, rows) {
  const wrap = document.getElementById("performance-detail-table-wrap");
  if (!rows.length) {
    wrap.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-4 py-6 text-center text-sm text-slate-500">暂无详细数据</div>`;
    return;
  }
  wrap.innerHTML = `
    <table class="w-full min-w-[760px] border-separate border-spacing-y-3 text-left">
      <thead>
        <tr class="text-xs uppercase tracking-wider text-slate-400">
          ${headers.map((header) => `<th class="px-4 pb-2">${escapeHtml(header)}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr class="bg-surface-container-low">
            ${row.map((cell, index) => `<td class="${index === 0 ? "rounded-l-2xl" : ""} ${index === row.length - 1 ? "rounded-r-2xl" : ""} px-4 py-4 text-sm text-slate-700">${cell}</td>`).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function customerInfoCell(item) {
  const lines = [
    `<div class="font-bold text-primary">${escapeHtml(item.customerName || "-")}</div>`,
    `<div class="mt-1 text-xs text-slate-500">${escapeHtml(item.customerPhone || "无电话")}</div>`,
    `<div class="mt-1 text-xs text-slate-500">${escapeHtml(item.customerEmail || "无邮箱")}</div>`
  ];
  return lines.join("");
}

function customerAddressCell(item) {
  return `<div class="text-sm leading-6 text-slate-700">${escapeHtml(item.customerAddress || item.location || "-")}</div>`;
}

function showDetailPanel(kicker, title, summary, stats, headers, rows) {
  document.getElementById("performance-detail-kicker").textContent = kicker;
  document.getElementById("performance-detail-title").textContent = title;
  document.getElementById("performance-detail-summary").textContent = summary;
  renderDetailStats(stats);
  renderDetailTable(headers, rows);
  document.getElementById("performance-detail-panel").classList.remove("hidden");
  document.getElementById("performance-detail-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function openAchievementDetail() {
  const detail = performanceState.data?.details?.achievement;
  if (!detail) return;
  showDetailPanel(
    "达成详情",
    `${detail.periodLabel} 销售达成明细`,
    `本月累计签约 ${money(detail.totalActual)}，目标 ${money(detail.totalTarget)}，距离目标还差 ${money(detail.gapAmount)}。`,
    [
      { label: "本月签约", value: money(detail.totalActual) },
      { label: "本月目标", value: money(detail.totalTarget) },
      { label: "目标差额", value: money(detail.gapAmount) }
    ],
    ["姓名", "角色", "本月达成", "目标", "达成率", "报价数"],
    detail.teamBreakdown.map((item) => [
      escapeHtml(item.name),
      escapeHtml(item.roleLabel),
      money(item.monthlyAmount),
      money(item.targetAmount),
      `${item.achievementRate}%`,
      String(item.quoteCount || 0)
    ])
  );
}

function openEmployeeDetail(employeeId) {
  const item = performanceState.data?.team?.find((entry) => entry.id === employeeId);
  if (!item) return;
  showDetailPanel(
    "员工详情",
    `${item.name} 业绩详情`,
    `${item.roleLabel} / ${item.branch}，本月共关联 ${item.quoteCount || 0} 条报价记录。`,
    [
      { label: "本月达成", value: money(item.monthlyAmount) },
      { label: "达成率", value: `${item.achievementRate}%` },
      { label: "在途项目", value: String(item.activeProjects || 0) }
    ],
    ["客户信息", "地址", "套装", "金额", "状态", "创建时间"],
    (item.quoteDetails || []).map((quote) => [
      customerInfoCell(quote),
      customerAddressCell(quote),
      escapeHtml(quote.packageName || "-"),
      money(quote.total),
      escapeHtml(formatStatus(quote.status)),
      escapeHtml(new Date(quote.createdAt).toLocaleDateString("zh-CN"))
    ])
  );
}

function openMonthDetail(key) {
  const month = performanceState.data?.trend?.find((entry) => entry.key === key);
  if (!month) return;
  showDetailPanel(
    "月份详情",
    `${month.monthLabel} 销售明细`,
    `${month.monthLabel} 共生成 ${month.quotes?.length || 0} 条报价记录。`,
    [
      { label: "月份", value: month.monthLabel },
      { label: "报价数", value: String(month.quotes?.length || 0) },
      { label: "签约金额", value: money(month.value) }
    ],
    ["客户信息", "地址", "套装", "金额", "状态", "销售"],
    (month.quotes || []).map((quote) => [
      customerInfoCell(quote),
      customerAddressCell(quote),
      escapeHtml(quote.packageName || "-"),
      money(quote.total),
      escapeHtml(formatStatus(quote.status)),
      escapeHtml(quote.salesPersonName || "-")
    ])
  );
}

function openOverdueDetail() {
  const detail = performanceState.data?.details?.overdue;
  if (!detail) return;
  showDetailPanel(
    "未付款详情",
    "待跟进未付款报价明细",
    `当前共有 ${detail.count} 条未付款报价，总金额 ${money(detail.totalAmount)}。`,
    [
      { label: "未付款单数", value: String(detail.count || 0) },
      { label: "未付款金额", value: money(detail.totalAmount) },
      { label: "占比", value: `${performanceState.data?.summary?.collectionOverdueRate || 0}%` }
    ],
    ["客户信息", "地址", "套装", "金额", "状态", "销售", "创建时间"],
    (detail.items || []).map((item) => [
      customerInfoCell(item),
      customerAddressCell(item),
      escapeHtml(item.packageName || "-"),
      money(item.total),
      escapeHtml(formatStatus(item.status)),
      escapeHtml(item.salesPersonName || "-"),
      escapeHtml(new Date(item.createdAt).toLocaleDateString("zh-CN"))
    ])
  );
}

function openActiveProjectsDetail() {
  const detail = performanceState.data?.details?.activeProjects;
  if (!detail) return;
  showDetailPanel(
    "项目详情",
    "在途业务项目明细",
    `当前共有 ${detail.count} 个在途业务项目，可继续跟进回款与签约推进。`,
    [
      { label: "项目数", value: String(detail.count || 0) },
      { label: "关联金额", value: money((detail.items || []).reduce((sum, item) => sum + Number(item.total || 0), 0)) },
      { label: "重点状态", value: "跟进中" }
    ],
    ["客户信息", "地址", "套装", "阶段", "金额", "销售"],
    (detail.items || []).map((item) => [
      customerInfoCell(item),
      customerAddressCell(item),
      escapeHtml(item.packageName || "-"),
      escapeHtml(item.stage || "-"),
      money(item.total),
      escapeHtml(item.salesPersonName || "-")
    ])
  );
}

function render(data) {
  performanceState.data = data;
  document.getElementById("performance-title").textContent = data.title || "区域经理业绩报告";
  document.getElementById("performance-achievement").textContent = `${data.summary.achievementRate}%`;
  document.getElementById("performance-achievement-note").textContent = `累计签约 ${money(data.summary.totalActual)}`;
  document.getElementById("performance-overdue").textContent = `${data.summary.collectionOverdueRate}%`;
  document.getElementById("performance-overdue-bar").style.width = `${Math.max(0, Math.min(100, data.summary.collectionOverdueRate || 0))}%`;
  document.getElementById("performance-active-projects").textContent = String(data.summary.activeProjects || 0);
  document.getElementById("performance-total-actual").textContent = `累计业绩 ${money(data.summary.totalActual)}`;
  document.getElementById("performance-region-name").textContent = data.region?.name || "Port Vila 核心区域";
  document.getElementById("performance-coverage").textContent = `${data.region?.coverageRate || 0}%`;
  document.getElementById("performance-insight").textContent = data.insight?.text || "";
  renderTrend(data.trend || []);
  renderTeam(data.team || []);
  renderMap(data.region || {});
}

async function loadPerformance() {
  const response = await fetch("/api/performance");
  const data = await response.json();
  render(data);
}

function bindEvents() {
  document.getElementById("performance-export-csv").addEventListener("click", exportCsv);
  document.getElementById("performance-export-pdf").addEventListener("click", printReport);
  document.getElementById("performance-print-report").addEventListener("click", printReport);
  document.getElementById("performance-generate-report").addEventListener("click", generateReport);
  document.getElementById("performance-achievement-card").addEventListener("click", openAchievementDetail);
  document.getElementById("performance-overdue-card").addEventListener("click", openOverdueDetail);
  document.getElementById("performance-active-projects-card").addEventListener("click", openActiveProjectsDetail);
  document.getElementById("performance-detail-close").addEventListener("click", () => {
    document.getElementById("performance-detail-panel").classList.add("hidden");
  });
  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-detail-type]");
    if (!trigger) return;
    const type = trigger.getAttribute("data-detail-type");
    const key = trigger.getAttribute("data-detail-key");
    if (type === "employee") openEmployeeDetail(key);
    if (type === "month") openMonthDetail(key);
  });
}

bindEvents();
loadPerformance().catch((error) => {
  console.error(error);
});
