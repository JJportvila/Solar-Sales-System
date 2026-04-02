const loginState = {
  accounts: [],
  defaultPin: "0000"
};

function roleLabel(role) {
  return ({
    admin: "管理员",
    sales_manager: "销售经理",
    sales: "销售员",
    engineer: "工程/维修"
  })[role] || role || "未设置";
}

function landingLabel(path) {
  if (path === "/dashboard.html") return "后台总览";
  if (path === "/mobile-app.html") return "手机工作台";
  if (path === "/field-app.html") return "外勤维修";
  return path || "-";
}

function setStatus(text, type = "") {
  const node = document.getElementById("login-status");
  node.textContent = text || "";
  node.className = `status${type ? ` ${type}` : ""}`;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || "请求失败");
  }
  return data;
}

function renderAccountOptions() {
  const select = document.getElementById("employee-select");
  const quickList = document.getElementById("quick-account-list");
  select.innerHTML = loginState.accounts.map((item) => `
    <option value="${item.id}">${item.name} · ${roleLabel(item.role)} · ${item.branch}</option>
  `).join("");

  quickList.innerHTML = loginState.accounts.map((item) => `
    <button class="account-option" data-id="${item.id}" type="button">
      <strong>${item.name}</strong>
      <small>${roleLabel(item.role)} · ${item.branch}</small>
    </button>
  `).join("");
}

function renderPreview() {
  const selectedId = document.getElementById("employee-select").value;
  const account = loginState.accounts.find((item) => item.id === selectedId) || loginState.accounts[0];
  if (!account) return;
  document.getElementById("employee-select").value = account.id;
  document.getElementById("preview-name").textContent = account.name;
  document.getElementById("preview-email").textContent = account.email || "未设置邮箱";
  document.getElementById("preview-role").textContent = roleLabel(account.role);
  document.getElementById("preview-branch").textContent = account.branch || "-";
  document.getElementById("preview-level").textContent = `L${account.securityLevel || 1}`;
  document.getElementById("preview-landing").textContent = landingLabel(account.landingPage);
  document.querySelectorAll(".account-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.id === account.id);
  });
}

async function loadAccounts() {
  const result = await fetchJson("/api/auth/options");
  loginState.accounts = Array.isArray(result.items) ? result.items.filter((item) => item.accessEnabled !== false) : [];
  loginState.defaultPin = result.defaultPin || "0000";
  document.getElementById("default-pin-label").textContent = loginState.defaultPin;
  document.getElementById("pin-input").value = loginState.defaultPin;
  renderAccountOptions();
  renderPreview();
}

async function submitLogin(event) {
  event.preventDefault();
  const employeeId = document.getElementById("employee-select").value;
  const pin = document.getElementById("pin-input").value.trim();
  const next = new URLSearchParams(window.location.search).get("next");
  setStatus("登录中，请稍候...");
  try {
    const result = await fetchJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, pin })
    });
    setStatus("登录成功，正在进入系统...", "success");
    window.location.href = next || result.landingPage || "/dashboard.html";
  } catch (error) {
    setStatus(error.message || "登录失败", "error");
  }
}

function bindEvents() {
  document.getElementById("employee-select").addEventListener("change", renderPreview);
  document.getElementById("login-form").addEventListener("submit", submitLogin);
  document.getElementById("quick-account-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-id]");
    if (!button) return;
    document.getElementById("employee-select").value = button.dataset.id;
    renderPreview();
  });
}

async function init() {
  bindEvents();
  try {
    const auth = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (auth.ok) {
      const result = await auth.json();
      window.location.href = result.landingPage || "/dashboard.html";
      return;
    }
  } catch (error) {
    console.warn(error);
  }
  try {
    await loadAccounts();
  } catch (error) {
    setStatus(error.message || "加载测试账号失败", "error");
  }
}

init();
