const NAV_GROUPS = [
  {
    key: "overview",
    title: "运营总览",
    icon: "space_dashboard",
    items: [
      { key: "dashboard", href: "/dashboard.html", icon: "dashboard", label: "销售工作台" },
      { key: "mobile-app", href: "/mobile-app.html", icon: "phone_iphone", label: "手机工作台" },
      { key: "analytics", href: "/performance.html", icon: "analytics", label: "业绩分析" },
      { key: "reports", href: "/reports.html", icon: "leaderboard", label: "报告中心" }
    ]
  },
  {
    key: "sales",
    title: "销售业务",
    icon: "point_of_sale",
    items: [
      { key: "calculator", href: "/index.html#calculator", icon: "calculate", label: "报价计算" },
      { key: "customer", href: "/customer.html", icon: "supervisor_account", label: "客户管理" },
      { key: "wholesale", href: "/wholesale.html", icon: "storefront", label: "本地批发" },
      { key: "survey", href: "/survey.html", icon: "rv_hookup", label: "现场勘测" }
    ]
  },
  {
    key: "supply",
    title: "供应链",
    icon: "local_shipping",
    items: [
      { key: "vendors", href: "/vendors.html", icon: "inventory", label: "供应商管理" },
      { key: "inventory", href: "/inventory.html", icon: "inventory_2", label: "库存采购" },
      { key: "product-config", href: "/product-config.html", icon: "sell", label: "产品定价" }
    ]
  },
  {
    key: "finance-service",
    title: "财务与服务",
    icon: "account_balance_wallet",
    items: [
      { key: "finance", href: "/finance.html", icon: "query_stats", label: "财务收支" },
      { key: "invoices", href: "/invoices.html", icon: "receipt_long", label: "发票管理" },
      { key: "expense-control", href: "/expense-control.html", icon: "payments", label: "费用管理" },
      { key: "installment", href: "/installment.html", icon: "calendar_month", label: "分期管理" },
      { key: "commission", href: "/commission.html", icon: "savings", label: "佣金管理" },
      { key: "repair", href: "/repair-list.html", icon: "build", label: "维修工单" }
    ]
  },
  {
    key: "system",
    title: "组织与系统",
    icon: "admin_panel_settings",
    items: [
      { key: "employee", href: "/employee.html", icon: "groups", label: "员工管理" },
      { key: "field", href: "/field-app.html", icon: "near_me", label: "外勤销售" },
      { key: "field-admin", href: "/field-admin.html", icon: "fact_check", label: "考勤结算" },
      { key: "security", href: "/security.html", icon: "shield_person", label: "权限控制" },
      { key: "settings", href: "/settings.html", icon: "tune", label: "后台设置" }
    ]
  }
];

const ROLE_ALLOWED_KEYS = {
  admin: null,
  sales_manager: new Set([
    "dashboard",
    "mobile-app",
    "analytics",
    "reports",
    "calculator",
    "customer",
    "finance",
    "invoices",
    "commission",
    "repair",
    "field",
    "field-admin"
  ]),
  sales: new Set([
    "dashboard",
    "mobile-app",
    "calculator",
    "customer",
    "invoices",
    "repair",
    "field"
  ]),
  engineer: new Set([
    "mobile-app",
    "repair",
    "field"
  ])
};

let navAuth = null;

function getSidebarStorageKey(groupKey) {
  return `smart_sizing_sidebar_group_${groupKey}`;
}

function isGroupOpen(group, activeKey) {
  const hasActive = group.items.some((item) => item.key === activeKey);
  if (hasActive) return true;
  const stored = localStorage.getItem(getSidebarStorageKey(group.key));
  return stored === null ? false : stored === "1";
}

function roleLabel(role) {
  return ({
    admin: "管理员",
    sales_manager: "销售经理",
    sales: "销售员",
    engineer: "工程/维修"
  })[role] || role || "未登录";
}

function getVisibleGroups() {
  const role = navAuth?.user?.role || "sales";
  const allowed = ROLE_ALLOWED_KEYS[role];
  if (!allowed) return NAV_GROUPS;
  return NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => allowed.has(item.key))
    }))
    .filter((group) => group.items.length);
}

function buildSharedSidebar(activeKey = "") {
  const groups = getVisibleGroups();
  const navHtml = groups.map((group) => {
    const open = isGroupOpen(group, activeKey);
    const itemsHtml = group.items.map((item) => {
      const active = item.key === activeKey;
      const classes = active
        ? "bg-white text-primary font-bold shadow-sm"
        : "text-slate-600 hover:text-primary hover:bg-white";
      const fill = active ? " style=\"font-variation-settings:'FILL' 1;\"" : "";
      return `
        <a class="${classes} mx-2 flex items-center gap-3 rounded-xl px-4 py-3 transition-colors" href="${item.href}">
          <span class="material-symbols-outlined"${fill}>${item.icon}</span>
          <span class="text-[15px] font-medium">${item.label}</span>
        </a>
      `;
    }).join("");

    return `
      <section class="mb-3" data-sidebar-group="${group.key}">
        <button
          class="sidebar-group-toggle mx-2 flex w-[calc(100%-1rem)] items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/80"
          data-group-key="${group.key}"
          type="button"
          aria-expanded="${open ? "true" : "false"}"
        >
          <span class="flex items-center gap-3">
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 text-primary">
              <span class="material-symbols-outlined text-[20px]" style="font-variation-settings:'FILL' 1;">${group.icon}</span>
            </span>
            <span class="text-[15px] font-bold text-slate-700">${group.title}</span>
          </span>
          <span class="material-symbols-outlined text-lg text-slate-400 transition-transform ${open ? "rotate-180" : ""}">expand_more</span>
        </button>
        <div class="sidebar-group-items mt-2 space-y-1 overflow-hidden transition-all ${open ? "" : "hidden"}" data-group-panel="${group.key}">
          ${itemsHtml}
        </div>
      </section>
    `;
  }).join("");

  const userName = navAuth?.user?.name || "未登录";
  const role = roleLabel(navAuth?.user?.role);
  return `
    <div class="mb-8 px-6">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <span class="material-symbols-outlined text-secondary-container" style="font-variation-settings:'FILL' 1;">wb_sunny</span>
        </div>
        <div>
          <h1 class="text-xl font-bold tracking-tight text-primary">光伏管理系统</h1>
          <p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Solar Sales System</p>
        </div>
      </div>
      <div class="mt-5 rounded-2xl bg-white px-4 py-4 shadow-sm">
        <div class="text-sm font-bold text-primary">${userName}</div>
        <div class="mt-1 text-xs text-slate-500">${role}</div>
      </div>
    </div>
    <nav class="flex-1 overflow-y-auto pr-1">
      ${navHtml}
    </nav>
    <div class="mt-auto px-4">
      <div class="border-t border-slate-200 pt-4">
        <div class="flex items-center gap-3 px-4 py-2 text-sm text-slate-500">
          <span id="health-dot" class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
          <span id="health-text">权限控制已生效</span>
        </div>
      </div>
    </div>
  `;
}

function buildSharedHeader() {
  const header = document.getElementById("app-header");
  if (!header) return;
  const title = document.body.dataset.headerTitle || document.querySelector("h1, h2")?.textContent?.trim() || "工作台";
  const user = navAuth?.user;
  header.innerHTML = `
    <div>
      <div class="text-lg font-extrabold text-primary">${title}</div>
      <div class="text-xs text-slate-500">${user ? `${user.name} · ${roleLabel(user.role)}` : "未登录"}</div>
    </div>
    <div class="flex items-center gap-3">
      <a class="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700" href="/mobile-app.html">手机端</a>
      <button id="shared-logout-btn" class="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white" type="button">退出登录</button>
    </div>
  `;
}

function bindSidebarGroups() {
  document.querySelectorAll(".sidebar-group-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const groupKey = button.dataset.groupKey;
      const panel = document.querySelector(`[data-group-panel="${groupKey}"]`);
      const icon = button.querySelector(".material-symbols-outlined:last-child");
      if (!panel || !icon) return;
      const isOpen = !panel.classList.contains("hidden");
      panel.classList.toggle("hidden", isOpen);
      icon.classList.toggle("rotate-180", !isOpen);
      button.setAttribute("aria-expanded", isOpen ? "false" : "true");
      localStorage.setItem(getSidebarStorageKey(groupKey), isOpen ? "0" : "1");
    });
  });
}

async function bindLogout() {
  const button = document.getElementById("shared-logout-btn");
  if (!button) return;
  button.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.warn(error);
    }
    window.location.href = "/login.html";
  });
}

async function loadAuth() {
  const response = await fetch("/api/auth/me", { credentials: "same-origin" });
  if (!response.ok) {
    window.location.href = `/login.html?next=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }
  return response.json();
}

document.addEventListener("DOMContentLoaded", async () => {
  navAuth = await loadAuth();
  if (!navAuth?.authenticated) return;
  const sidebar = document.getElementById("app-sidebar");
  if (sidebar) {
    const activeKey = document.body.dataset.nav || "";
    sidebar.innerHTML = buildSharedSidebar(activeKey);
    bindSidebarGroups();
  }
  buildSharedHeader();
  bindLogout();
});
