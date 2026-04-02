const mobileState = {
  activeTab: "home",
  dashboard: { items: [], summary: {}, installmentRecords: [] },
  customers: [],
  repairs: [],
  invoices: [],
  employees: [],
  filteredQuotes: [],
  filteredCustomers: [],
  token: localStorage.getItem("field_token") || "",
  userId: localStorage.getItem("field_user_id") || "",
  userName: localStorage.getItem("field_user_name") || "",
  role: localStorage.getItem("field_user_role") || "",
  roleLabel: localStorage.getItem("field_user_role_label") || "",
  currentUserId: "",
  currentUserName: "",
  currentUserRole: "",
  tracking: false,
  trackTimer: null,
  audioRecorder: null,
  audioChunks: [],
  audioUrl: "",
  photoUrls: [],
  visitItems: [],
  payrollSummary: null,
  installPromptEvent: null,
  overviewShown: false
};

const OVERVIEW_DISMISS_KEY = "mobile_overview_dismiss_date";
const numberFormatter = new Intl.NumberFormat("en-US");

function $(id) {
  return document.getElementById(id);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function shouldSkipOverviewModal() {
  return localStorage.getItem(OVERVIEW_DISMISS_KEY) === getTodayKey();
}

function money(value) {
  return `VT ${numberFormatter.format(Number(value || 0))}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
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

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("zh-CN");
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

function customerTypeLabel(item) {
  if (item.customerTypeLabel) return item.customerTypeLabel;
  return item.customerType === "local_wholesale" ? "批发客户" : "终端客户";
}

function getCustomerDetailLink(source = {}) {
  const directId = String(source.customerId || "").trim();
  if (directId) {
    return `/mobile-customer-detail.html?id=${encodeURIComponent(directId)}`;
  }

  const sourcePhone = String(source.customerPhone || source.phone || "").trim();
  const sourceName = String(source.customerName || source.name || "").trim().toLowerCase();
  const matched = mobileState.customers.find((item) => {
    const itemPhone = String(item.phone || "").trim();
    const itemName = String(item.name || item.contactName || "").trim().toLowerCase();
    return (sourcePhone && itemPhone && itemPhone === sourcePhone) || (sourceName && itemName && itemName === sourceName);
  });

  return matched
    ? `/mobile-customer-detail.html?id=${encodeURIComponent(matched.id)}`
    : "/mobile-app.html?v=20260402";
}

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (mobileState.token) headers.Authorization = `Bearer ${mobileState.token}`;
  return headers;
}

function getEffectiveCheckinUserId() {
  return String(mobileState.userId || mobileState.currentUserId || "").trim();
}

function hasEffectiveFieldUser() {
  return Boolean(getEffectiveCheckinUserId());
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}

function setActiveTab(tab) {
  mobileState.activeTab = tab;
  document.querySelectorAll(".section").forEach((node) => {
    node.classList.toggle("active", node.id === `section-${tab}`);
  });
  document.querySelectorAll(".tab-btn").forEach((node) => {
    node.classList.toggle("active", node.dataset.tab === tab);
  });
  const focusMap = {
    home: "今日业务总览",
    quotes: "报价与方案推进",
    customers: "客户跟进与详情",
    field: "现场打卡与拜访",
    more: "更多业务模块"
  };
  if ($("hero-focus")) {
    $("hero-focus").textContent = focusMap[tab] || "今日业务总览";
  }
}

function openOverviewModal() {
  const modal = $("overview-modal");
  if (!modal || mobileState.overviewShown || shouldSkipOverviewModal()) return;
  if ($("overview-dismiss-today")) $("overview-dismiss-today").checked = false;
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  mobileState.overviewShown = true;
}

function closeOverviewModal() {
  const modal = $("overview-modal");
  if (!modal) return;
  if ($("overview-dismiss-today")?.checked) {
    localStorage.setItem(OVERVIEW_DISMISS_KEY, getTodayKey());
  }
  modal.classList.remove("open");
  document.body.style.overflow = "";
}

function updateFieldUi() {
  const fieldLoggedIn = Boolean(mobileState.userId);
  const effectiveLoggedIn = hasEffectiveFieldUser();
  const displayName = mobileState.userName || mobileState.currentUserName || mobileState.userId || mobileState.currentUserId || "未登录";
  const displayRole = mobileState.roleLabel || mobileState.role || mobileState.currentUserRole || "当前账号";
  if ($("field-user-badge")) $("field-user-badge").textContent = effectiveLoggedIn ? `${displayName}` : "未登录";
  if ($("field-login-btn")) $("field-login-btn").textContent = fieldLoggedIn ? "已登录" : "切换身份";
  if ($("field-login-btn")) $("field-login-btn").disabled = fieldLoggedIn;
  if ($("field-login-pin")) $("field-login-pin").disabled = fieldLoggedIn;
  if ($("field-login-employee")) $("field-login-employee").disabled = fieldLoggedIn;

  if ($("field-session-card")) $("field-session-card").classList.toggle("hidden", !effectiveLoggedIn);
  if ($("field-ops-card")) {
    $("field-ops-card").classList.toggle("locked", !effectiveLoggedIn);
    $("field-ops-card").classList.toggle("ready", effectiveLoggedIn);
  }
  if ($("field-visit-card")) {
    $("field-visit-card").classList.toggle("locked", !effectiveLoggedIn);
    $("field-visit-card").classList.toggle("ready", effectiveLoggedIn);
  }

  if ($("field-session-meta")) {
    $("field-session-meta").textContent = effectiveLoggedIn
      ? `${displayName} / ${displayRole} 已就绪，现在可以处理打卡、轨迹和拜访。`
      : "登录当前账号后可处理打卡、轨迹和拜访。";
  }
  if ($("home-checkin-status")) {
    $("home-checkin-status").textContent = effectiveLoggedIn
      ? "当前账号可直接在首页打卡"
      : mobileState.currentUserId
        ? `${mobileState.currentUserName || "当前账号"}可直接首页打卡`
        : "登录当前账号后可直接在首页打卡";
  }
  if ($("hero-field-status")) {
    $("hero-field-status").textContent = effectiveLoggedIn
      ? `${mobileState.userName || mobileState.userId} 已上线`
      : (mobileState.currentUserId ? `${mobileState.currentUserName || mobileState.currentUserId} 已登录` : "未登录");
  }
  if ($("hero-subtitle")) {
    $("hero-subtitle").textContent = effectiveLoggedIn
      ? "当前账号已就绪，可以直接打卡、记录轨迹、提交拜访，并继续处理客户与报价。"
      : "把报价、客户、现场、考勤和维修入口整合到一页，手机上打开就能直接处理当天工作。";
  }
}

function renderFieldAttendance() {
  return;
}

function renderHome() {
  const summary = mobileState.dashboard.summary || {};
  $("kpi-total-sales").textContent = numberFormatter.format(summary.totalSales || 0);
  $("kpi-active-quotes").textContent = numberFormatter.format(summary.activeQuotes || 0);
  $("kpi-customers").textContent = numberFormatter.format(mobileState.customers.length || 0);
  $("kpi-sales-team").textContent = numberFormatter.format(
    mobileState.employees.filter((item) => item.role === "sales" || item.role === "sales_manager").length
  );
  $("home-updated-at").textContent = summary.updatedAt ? formatDateTime(summary.updatedAt) : "暂无更新";
  if ($("hero-date")) {
    $("hero-date").textContent = summary.updatedAt ? formatDateTime(summary.updatedAt) : formatDateTime(new Date());
  }

  const overdueCustomers = mobileState.customers.filter((item) => Number(item.payment?.balanceAmount || 0) > 0).length;
  const activeRepairs = mobileState.repairs.filter((item) => item.status !== "completed").length;
  const issuedInvoices = mobileState.invoices.filter((item) => item.status !== "paid").length;

  $("home-task-cards").innerHTML = [
    {
      label: "客户",
      title: "客户待跟进",
      count: overdueCustomers,
      badge: overdueCustomers > 0 ? "需回访" : "正常",
      badgeCls: overdueCustomers > 0 ? "warning" : "success",
      desc: overdueCustomers > 0 ? "存在未结清分期或尾款的客户，建议尽快跟进收款。" : "当前没有待收款客户。",
      actionText: "进入客户列表",
      type: "tab",
      target: "customers"
    },
    {
      label: "维修",
      title: "维修待处理",
      count: activeRepairs,
      badge: activeRepairs > 0 ? "处理中" : "完成",
      badgeCls: activeRepairs > 0 ? "info" : "success",
      desc: activeRepairs > 0 ? "存在未完成工单，可直接进入手机维修页更新状态。" : "当前没有待处理维修工单。",
      actionText: "打开维修工单",
      type: "link",
      target: "/mobile-repair.html"
    },
    {
      label: "发票",
      title: "发票待跟进",
      count: issuedInvoices,
      badge: issuedInvoices > 0 ? "待收款" : "正常",
      badgeCls: issuedInvoices > 0 ? "warning" : "success",
      desc: issuedInvoices > 0 ? "已开票但未完成付款的发票仍需继续跟进。" : "当前没有待处理发票。",
      actionText: "查看发票收款",
      type: "link",
      target: "/mobile-invoices.html"
    }
  ]
    .map((item) => `
      ${
        item.type === "tab"
          ? `<button class="task-card" type="button" data-home-tab="${escapeHtml(item.target)}" style="width:100%;text-align:left;cursor:pointer;">`
          : `<a class="task-card" href="${escapeHtml(item.target)}">`
      }
        <div class="task-top">
          <span class="task-label">${escapeHtml(item.label)}</span>
          <span class="pill ${escapeHtml(item.badgeCls)}">${escapeHtml(item.badge)}</span>
        </div>
        <div class="task-title">${escapeHtml(item.title)}</div>
        <div class="task-count">${escapeHtml(item.count)}</div>
        <div class="task-desc">${escapeHtml(item.desc)}</div>
        <div class="task-action"><span class="material-symbols-outlined">arrow_forward</span><span>${escapeHtml(item.actionText)}</span></div>
      ${item.type === "tab" ? "</button>" : "</a>"}
    `)
    .join("");

  const recent = mobileState.dashboard.items.slice(0, 3);
  $("home-recent-quotes").innerHTML = recent.length
    ? recent
        .map((item) => {
          const status = quoteStatusMeta(item.status);
          const customerDetailLink = getCustomerDetailLink(item);
          return `
            <div class="list-item">
              <div class="list-head">
                <div>
                  <div class="list-title">${escapeHtml(item.customerName || "未命名客户")}</div>
                  <div class="list-meta">${escapeHtml(item.packageName || "-")} / ${escapeHtml(item.location || "-")}</div>
                </div>
                <span class="pill ${status.cls}">${escapeHtml(status.label)}</span>
              </div>
              <div class="list-grid">
                <div class="metric"><label>金额</label><strong>${money(item.total)}</strong></div>
                <div class="metric"><label>销售</label><strong>${escapeHtml(item.salesPersonName || "-")}</strong></div>
                <div class="metric"><label>创建时间</label><strong>${escapeHtml(formatDate(item.createdAt))}</strong></div>
                <div class="metric"><label>分期</label><strong>${escapeHtml(item.installmentPlan?.cycleLabel || "未设置")}</strong></div>
              </div>
              <div class="btn-row" style="margin-top:12px;">
                <a class="btn secondary" href="${customerDetailLink}">客户详情</a>
                <a class="btn primary" href="/mobile-quote.html?v=20260402">继续报价</a>
              </div>
            </div>
          `;
        })
        .join("")
    : `<div class="empty">暂无报价数据</div>`;
}

function renderQuotes() {
  const search = $("quotes-search").value.trim().toLowerCase();
  const status = $("quotes-status-filter").value;
  mobileState.filteredQuotes = mobileState.dashboard.items.filter((item) => {
    const matchStatus = status === "all" || item.status === status;
    const haystack = [item.customerName, item.packageName, item.location, item.customerPhone, item.salesPersonName]
      .join(" ")
      .toLowerCase();
    return matchStatus && (!search || haystack.includes(search));
  });

  $("quotes-count").textContent = `${mobileState.filteredQuotes.length} 条`;
  $("quotes-list").innerHTML = mobileState.filteredQuotes.length
    ? mobileState.filteredQuotes
        .map((item) => {
          const statusMeta = quoteStatusMeta(item.status);
          const customerDetailLink = getCustomerDetailLink(item);
          return `
            <div class="list-item">
              <div class="list-head">
                <div>
                  <div class="list-title">${escapeHtml(item.customerName || "未命名客户")}</div>
                  <div class="list-meta">${escapeHtml(item.customerPhone || "-")} / ${escapeHtml(formatDate(item.createdAt))}</div>
                </div>
                <span class="pill ${statusMeta.cls}">${escapeHtml(statusMeta.label)}</span>
              </div>
              <div class="list-grid">
                <div class="metric"><label>套装</label><strong>${escapeHtml(item.packageName || "-")}</strong></div>
                <div class="metric"><label>金额</label><strong>${money(item.total)}</strong></div>
                <div class="metric"><label>地区</label><strong>${escapeHtml(item.location || "-")}</strong></div>
                <div class="metric"><label>分期</label><strong>${escapeHtml(item.installmentPlan?.cycleLabel || "未设置")}</strong></div>
              </div>
              <div class="btn-row" style="margin-top:12px;">
                <a class="btn secondary" href="${customerDetailLink}">客户详情</a>
                <a class="btn primary" href="/mobile-quote.html?v=20260402">继续报价</a>
              </div>
            </div>
          `;
        })
        .join("")
    : `<div class="empty">没有匹配的报价</div>`;
}

function renderCustomers() {
  const search = $("customers-search").value.trim().toLowerCase();
  mobileState.filteredCustomers = mobileState.customers.filter((item) => {
    const haystack = [item.name, item.contactName, item.phone, item.location, item.address, item.salesPersonName, item.archiveNo]
      .join(" ")
      .toLowerCase();
    return !search || haystack.includes(search);
  });

  $("customers-count").textContent = `${mobileState.filteredCustomers.length} 位`;
  $("customers-list").innerHTML = mobileState.filteredCustomers.length
    ? mobileState.filteredCustomers
        .map((item) => `
          <div class="list-item">
            <div class="list-head">
              <div>
                <div class="list-title">${escapeHtml(item.name || item.contactName || "未命名客户")}</div>
                <div class="list-meta">${escapeHtml(item.phone || "-")} / ${escapeHtml(item.location || item.province || "-")}</div>
              </div>
              <span class="pill success">${escapeHtml(customerTypeLabel(item))}</span>
            </div>
            <div class="list-grid">
              <div class="metric"><label>销售</label><strong>${escapeHtml(item.salesPersonName || "-")}</strong></div>
              <div class="metric"><label>分期</label><strong>${escapeHtml(item.payment?.cycleLabel || "-")}</strong></div>
              <div class="metric"><label>已付</label><strong>${money(item.payment?.paidAmount || 0)}</strong></div>
              <div class="metric"><label>未付</label><strong>${money(item.payment?.balanceAmount || 0)}</strong></div>
            </div>
            <div class="subtle" style="margin-top:10px;">${escapeHtml(item.address || "暂无详细地址")}</div>
            <div class="btn-row" style="margin-top:12px;">
              <a class="btn primary" href="${getCustomerDetailLink(item)}">客户详情</a>
              <a class="btn secondary" href="${item.phone ? `tel:${escapeHtml(item.phone)}` : getCustomerDetailLink(item)}">${item.phone ? "拨打电话" : "打开详情"}</a>
            </div>
          </div>
        `)
        .join("")
    : `<div class="empty">没有匹配的客户</div>`;
}

function setFieldStatus(id, text) {
  $(id).textContent = text;
  if (id === "field-checkin-status" && $("home-checkin-status")) {
    $("home-checkin-status").textContent = text;
  }
}

function setInstallStatus(text) {
  const node = $("install-app-status");
  if (node) node.textContent = text;
}

function clearFieldLogin() {
  mobileState.token = "";
  mobileState.userId = "";
  mobileState.userName = "";
  mobileState.role = "";
  mobileState.roleLabel = "";
  localStorage.removeItem("field_token");
  localStorage.removeItem("field_user_id");
  localStorage.removeItem("field_user_name");
  localStorage.removeItem("field_user_role");
  localStorage.removeItem("field_user_role_label");
}

async function getPosition() {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  if (!window.isSecureContext && !isLocalhost) {
    throw new Error("当前浏览器定位只支持 HTTPS 或 localhost，请改用 https 地址打开后再打卡");
  }
  if (!navigator.geolocation) {
    throw new Error("当前浏览器不支持定位，请更换浏览器后再试");
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) => {
        if (error?.code === 1) {
          reject(new Error("定位权限被拒绝，请允许定位后再打卡"));
          return;
        }
        if (error?.code === 2) {
          reject(new Error("当前无法获取定位，请检查网络和定位服务后再试"));
          return;
        }
        if (error?.code === 3) {
          reject(new Error("定位超时，请稍后再试"));
          return;
        }
        reject(new Error(error?.message || "定位获取失败"));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function loadFieldEmployees() {
  const result = await fetchJson("/api/auth/options");
  mobileState.employees = Array.isArray(result.items) ? result.items : [];
  if (!$("field-login-employee")) return;
  $("field-login-employee").innerHTML = [`<option value="">选择员工</option>`]
    .concat(
      mobileState.employees
        .filter((item) => item.status === "active")
        .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} / ${escapeHtml(item.roleLabel || item.role)}</option>`)
    )
    .join("");
}

async function loadCurrentUser() {
  try {
    const result = await fetchJson("/api/auth/me");
    const user = result.user || {};
    mobileState.currentUserId = user.id || "";
    mobileState.currentUserName = user.name || "";
    mobileState.currentUserRole = user.role || "";
  } catch (_error) {
    mobileState.currentUserId = "";
    mobileState.currentUserName = "";
    mobileState.currentUserRole = "";
  }
}

async function tryRestoreFieldLogin() {
  if (!mobileState.token) {
    updateFieldUi();
    return;
  }
  try {
    const result = await fetchJson("/api/field-auth/me", {
      headers: { Authorization: `Bearer ${mobileState.token}` }
    });
    const user = result.user || {};
    mobileState.userId = user.id || mobileState.userId;
    mobileState.userName = user.name || mobileState.userName;
    mobileState.role = user.role || mobileState.role;
    mobileState.roleLabel = user.roleLabel || mobileState.roleLabel;
    updateFieldUi();
    await loadFieldAttendance();
    await loadFieldVisits();
  } catch (_) {
    clearFieldLogin();
    mobileState.payrollSummary = null;
    renderFieldAttendance();
    updateFieldUi();
  }
}

async function loginField() {
  if (!$("field-login-employee") || !$("field-login-pin")) return;
  const employeeId = $("field-login-employee").value;
  const pin = $("field-login-pin").value.trim();
  if (!employeeId || !pin) {
    setFieldStatus("field-login-status", "请选择员工并输入 PIN");
    return;
  }
  try {
    const result = await fetchJson("/api/field-auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, pin })
    });
    const user = result.user || {};
    mobileState.token = result.token || "";
    mobileState.userId = user.id || "";
    mobileState.userName = user.name || "";
    mobileState.role = user.role || "";
    mobileState.roleLabel = user.roleLabel || "";
    localStorage.setItem("field_token", mobileState.token);
    localStorage.setItem("field_user_id", mobileState.userId);
    localStorage.setItem("field_user_name", mobileState.userName);
    localStorage.setItem("field_user_role", mobileState.role);
    localStorage.setItem("field_user_role_label", mobileState.roleLabel);
    $("field-login-pin").value = "";
    updateFieldUi();
    setFieldStatus("field-login-status", "身份切换成功");
    setActiveTab("field");
    await loadFieldAttendance();
    await loadFieldVisits();
  } catch (error) {
    setFieldStatus("field-login-status", error.message || "身份切换失败");
  }
}

async function loadFieldAttendance() {
  const effectiveUserId = getEffectiveCheckinUserId();
  if (!effectiveUserId) {
    mobileState.payrollSummary = null;
    renderFieldAttendance();
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  const result = await fetchJson(`/api/field-payroll?user=${encodeURIComponent(effectiveUserId)}&date=${encodeURIComponent(date)}`);
  mobileState.payrollSummary = result || null;
  renderFieldAttendance();
}

async function fieldCheckin(action) {
  const effectiveUserId = getEffectiveCheckinUserId();
  if (!effectiveUserId) {
    setFieldStatus("field-checkin-status", "请先登录当前账号");
    return;
  }
  try {
    const coords = await getPosition();
    const result = await fetchJson("/api/field-checkin", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        userId: effectiveUserId,
        action,
        lat: coords.latitude,
        lng: coords.longitude,
        accuracy: coords.accuracy
      })
    });
    const companySummary = result.companyAttendance || {};
    setFieldStatus(
      "field-checkin-status",
      `${action === "in" ? "上班" : "下班"}打卡成功，可到全员考勤或工资结算页面查看结果。当前已出勤 ${companySummary.presentCount || 0} 人，在岗中 ${companySummary.onDutyCount || 0} 人`
    );
    mobileState.payrollSummary = result.payroll || mobileState.payrollSummary;
    renderFieldAttendance();
    await loadFieldVisits();
  } catch (error) {
    setFieldStatus("field-checkin-status", error.message || "打卡失败");
  }
}

async function sendTrackPoint() {
  const effectiveUserId = getEffectiveCheckinUserId();
  if (!effectiveUserId) return;
  const coords = await getPosition();
  await fetchJson("/api/field-tracks/point", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      userId: effectiveUserId,
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy
    })
  });
}

async function startTrack() {
  if (!hasEffectiveFieldUser()) {
    setFieldStatus("field-checkin-status", "请先登录当前账号");
    return;
  }
  try {
    mobileState.tracking = true;
    $("field-track-state").textContent = "轨迹中";
    await sendTrackPoint();
    if (mobileState.trackTimer) clearInterval(mobileState.trackTimer);
    mobileState.trackTimer = setInterval(() => {
      sendTrackPoint().catch(() => {});
    }, 60000);
    setFieldStatus("field-checkin-status", "轨迹已开始，系统每 60 秒记录一次位置");
  } catch (error) {
    setFieldStatus("field-checkin-status", error.message || "轨迹开启失败");
  }
}

async function stopTrack() {
  const effectiveUserId = getEffectiveCheckinUserId();
  if (!effectiveUserId) return;
  mobileState.tracking = false;
  $("field-track-state").textContent = "待命";
  if (mobileState.trackTimer) {
    clearInterval(mobileState.trackTimer);
    mobileState.trackTimer = null;
  }
  try {
    await fetchJson("/api/field-tracks/close", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId: effectiveUserId })
    });
    setFieldStatus("field-checkin-status", "轨迹已结束");
  } catch (error) {
    setFieldStatus("field-checkin-status", error.message || "结束轨迹失败");
  }
}

function resetVisitComposer() {
  $("field-visit-customer").value = "";
  $("field-visit-address").value = "";
  $("field-visit-note").value = "";
  $("field-visit-photos").value = "";
  $("field-photo-preview").innerHTML = "";
  mobileState.photoUrls = [];
  mobileState.audioChunks = [];
  mobileState.audioUrl = "";
  $("field-audio-preview").classList.add("hidden");
  $("field-audio-preview").src = "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handlePhotoSelect(event) {
  if (!hasEffectiveFieldUser()) {
    setFieldStatus("field-visit-status", "请先登录当前账号");
    event.target.value = "";
    return;
  }
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    mobileState.photoUrls = [];
    $("field-photo-preview").innerHTML = "";
    return;
  }
  setFieldStatus("field-visit-status", "正在上传照片...");
  try {
    const urls = [];
    for (const file of files) {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await fetchJson("/api/uploads/field-photo", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ dataUrl })
      });
      if (result.url) urls.push(result.url);
    }
    mobileState.photoUrls = urls;
    $("field-photo-preview").innerHTML = urls.map((url) => `<img src="${escapeHtml(url)}" alt="visit photo" />`).join("");
    setFieldStatus("field-visit-status", `已上传 ${urls.length} 张照片`);
  } catch (error) {
    mobileState.photoUrls = [];
    $("field-photo-preview").innerHTML = "";
    setFieldStatus("field-visit-status", error.message || "照片上传失败");
  }
}

function startRecording() {
  if (!hasEffectiveFieldUser()) {
    setFieldStatus("field-visit-status", "请先登录当前账号");
    return;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setFieldStatus("field-visit-status", "当前浏览器不支持录音");
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      mobileState.audioChunks = [];
      mobileState.audioRecorder = new MediaRecorder(stream);
      mobileState.audioRecorder.ondataavailable = (event) => mobileState.audioChunks.push(event.data);
      mobileState.audioRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(mobileState.audioChunks, { type: "audio/webm" });
        const dataUrl = await readFileAsDataUrl(blob);
        try {
          const result = await fetchJson("/api/uploads/field-audio", {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ dataUrl })
          });
          mobileState.audioUrl = result.url || "";
          const preview = $("field-audio-preview");
          preview.src = URL.createObjectURL(blob);
          preview.classList.remove("hidden");
          setFieldStatus("field-visit-status", "录音已上传");
        } catch (error) {
          setFieldStatus("field-visit-status", error.message || "录音上传失败");
        }
      };
      mobileState.audioRecorder.start();
      setFieldStatus("field-visit-status", "录音中...");
    })
    .catch(() => {
      setFieldStatus("field-visit-status", "无法访问麦克风");
    });
}

function stopRecording() {
  if (mobileState.audioRecorder && mobileState.audioRecorder.state === "recording") {
    mobileState.audioRecorder.stop();
  }
}

async function saveVisit() {
  const effectiveUserId = getEffectiveCheckinUserId();
  if (!effectiveUserId) {
    setFieldStatus("field-visit-status", "请先登录当前账号");
    return;
  }
  const customer = $("field-visit-customer").value.trim();
  if (!customer) {
    setFieldStatus("field-visit-status", "客户名称必填");
    return;
  }
  let lat = null;
  let lng = null;
  let accuracy = 0;
  try {
    const coords = await getPosition();
    lat = coords.latitude;
    lng = coords.longitude;
    accuracy = coords.accuracy;
  } catch (_) {
    setFieldStatus("field-visit-status", "未获取到定位，将按空定位保存");
  }
  try {
    await fetchJson("/api/field-visits", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        userId: effectiveUserId,
        customer,
        address: $("field-visit-address").value.trim(),
        note: $("field-visit-note").value.trim(),
        lat,
        lng,
        accuracy,
        audioUrl: mobileState.audioUrl,
        photoUrls: mobileState.photoUrls
      })
    });
    setFieldStatus("field-visit-status", "拜访记录已保存");
    resetVisitComposer();
    await loadFieldAttendance();
    await loadFieldVisits();
  } catch (error) {
    setFieldStatus("field-visit-status", error.message || "保存拜访失败");
  }
}

function renderFieldVisits() {
  $("field-visit-count").textContent = `${mobileState.visitItems.length} 条`;
  $("field-visit-list").innerHTML = mobileState.visitItems.length
    ? mobileState.visitItems
        .map((visit) => `
          <div class="list-item">
            <div class="list-head">
              <div>
                <div class="list-title">${escapeHtml(visit.customer || "未命名客户")}</div>
                <div class="list-meta">${escapeHtml(formatDateTime(visit.recordedAt))}</div>
              </div>
              <span class="pill success">已记录</span>
            </div>
            <div class="subtle">${escapeHtml(visit.address || "暂无地址")}</div>
            ${visit.note ? `<div class="subtle" style="margin-top:8px;">${escapeHtml(visit.note)}</div>` : ""}
            ${
              Array.isArray(visit.photoUrls) && visit.photoUrls.length
                ? `<div class="gallery" style="margin-top:10px;">${visit.photoUrls.map((url) => `<img src="${escapeHtml(url)}" alt="photo" />`).join("")}</div>`
                : ""
            }
            ${
              visit.audioUrl
                ? `<div style="margin-top:10px;"><a class="btn secondary" href="${escapeHtml(visit.audioUrl)}" target="_blank" rel="noreferrer">播放录音</a></div>`
                : ""
            }
          </div>
        `)
        .join("")
    : `<div class="empty">今天还没有现场拜访记录</div>`;
}

async function loadFieldVisits() {
  const effectiveUserId = getEffectiveCheckinUserId();
  if (!effectiveUserId) {
    mobileState.visitItems = [];
    renderFieldVisits();
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  const result = await fetchJson(`/api/field-visits?user=${encodeURIComponent(effectiveUserId)}&date=${encodeURIComponent(date)}`);
  mobileState.visitItems = Array.isArray(result.items) ? result.items.slice().reverse() : [];
  renderFieldVisits();
}

async function loadCoreData() {
  const [dashboardResult, customersResult, repairsResult, invoicesResult] = await Promise.all([
    fetchJson("/api/dashboard"),
    fetchJson("/api/customers"),
    fetchJson("/api/repair-orders"),
    fetchJson("/api/invoices")
  ]);
  mobileState.dashboard = dashboardResult || { items: [], summary: {} };
  mobileState.customers = Array.isArray(customersResult.items) ? customersResult.items : [];
  mobileState.repairs = Array.isArray(repairsResult.items) ? repairsResult.items : [];
  mobileState.invoices = Array.isArray(invoicesResult.items) ? invoicesResult.items : [];
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    setInstallStatus("当前浏览器不支持离线安装");
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw.js");
    setInstallStatus("已启用离线缓存，可用于安装");
  } catch (_) {
    setInstallStatus("离线缓存注册失败");
  }
}

function bindInstallPrompt() {
  const installBtn = $("install-app-btn");
  if (!installBtn) return;
  installBtn.addEventListener("click", async () => {
    if (!mobileState.installPromptEvent) {
      setInstallStatus("请使用浏览器菜单中的“添加到主屏幕”");
      return;
    }
    mobileState.installPromptEvent.prompt();
    const choice = await mobileState.installPromptEvent.userChoice;
    setInstallStatus(choice.outcome === "accepted" ? "安装请求已接受" : "已取消安装");
    mobileState.installPromptEvent = null;
  });
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    mobileState.installPromptEvent = event;
    setInstallStatus("可以直接安装到手机");
  });
  window.addEventListener("appinstalled", () => {
    mobileState.installPromptEvent = null;
    setInstallStatus("应用已安装到设备");
  });
}

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((node) => {
    node.addEventListener("click", () => setActiveTab(node.dataset.tab));
  });
  document.querySelectorAll("[data-tab-target]").forEach((node) => {
    node.addEventListener("click", () => setActiveTab(node.dataset.tabTarget));
  });
  $("home-task-cards").addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-home-tab]");
    if (!trigger) return;
    setActiveTab(trigger.dataset.homeTab);
  });
  if ($("overview-modal-close")) {
    $("overview-modal-close").addEventListener("click", closeOverviewModal);
  }
  if ($("overview-modal")) {
    $("overview-modal").addEventListener("click", (event) => {
      if (event.target === $("overview-modal")) closeOverviewModal();
    });
  }
  $("quotes-search").addEventListener("input", renderQuotes);
  $("quotes-status-filter").addEventListener("change", renderQuotes);
  $("customers-search").addEventListener("input", renderCustomers);
  if ($("field-login-btn")) {
    $("field-login-btn").addEventListener("click", loginField);
  }
  if ($("field-logout-btn")) {
    $("field-logout-btn").addEventListener("click", () => {
      clearFieldLogin();
      mobileState.visitItems = [];
      mobileState.payrollSummary = null;
      renderFieldVisits();
      renderFieldAttendance();
      updateFieldUi();
      setFieldStatus("field-login-status", "已退出现场身份切换");
      setFieldStatus("field-checkin-status", "尚未打卡");
      setFieldStatus("field-visit-status", "当前账号可上传照片和录音");
    });
  }
  $("field-checkin-in").addEventListener("click", () => fieldCheckin("in"));
  $("field-checkin-out").addEventListener("click", () => fieldCheckin("out"));
  $("home-checkin-in").addEventListener("click", () => fieldCheckin("in"));
  $("home-checkin-out").addEventListener("click", () => fieldCheckin("out"));
  $("field-trip-start").addEventListener("click", startTrack);
  $("field-trip-stop").addEventListener("click", stopTrack);
  $("field-visit-photos").addEventListener("change", handlePhotoSelect);
  $("field-record-start").addEventListener("click", startRecording);
  $("field-record-stop").addEventListener("click", stopRecording);
  $("field-save-visit").addEventListener("click", saveVisit);
  bindInstallPrompt();
}

async function initMobileApp() {
  bindEvents();
  updateFieldUi();
  renderFieldAttendance();
  renderFieldVisits();
  await Promise.all([loadCurrentUser(), loadFieldEmployees(), loadCoreData(), tryRestoreFieldLogin(), registerServiceWorker()]);
  updateFieldUi();
  renderHome();
  renderQuotes();
  renderCustomers();
  openOverviewModal();
}

document.addEventListener("DOMContentLoaded", () => {
  initMobileApp().catch((error) => {
    console.error(error);
    document.body.innerHTML = `<div style="padding:24px;font-family:sans-serif;">手机工作台初始化失败: ${escapeHtml(error.message || "unknown error")}</div>`;
  });
});
