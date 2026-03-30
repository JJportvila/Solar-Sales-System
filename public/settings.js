const state = {
  settings: {
    audToVuv: 80,
    nzdToVuv: 72,
    quoteDisplayMode: "tax_inclusive",
    homepage: "dashboard",
    backup: {
      autoDaily: true,
      autoWeekly: true,
      googleDriveEnabled: false,
      googleDriveFolderId: "",
      googleDriveAccessToken: "",
      lastDailyBackupAt: "",
      lastWeeklyBackupAt: ""
    },
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
  },
  backups: []
};

function renderMessage(message, success = true) {
  const output = document.getElementById("settings-output");
  if (!output) return;
  output.classList.remove("hidden");
  output.className = `mt-6 rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`;
  output.textContent = message;
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value || 0));
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function renderLogoPreview(url) {
  const image = document.getElementById("company-logo-preview");
  const placeholder = document.getElementById("company-logo-placeholder");
  if (!image || !placeholder) return;
  if (url) {
    image.src = url;
    image.classList.remove("hidden");
    placeholder.classList.add("hidden");
    return;
  }
  image.src = "";
  image.classList.add("hidden");
  placeholder.classList.remove("hidden");
}

function postJson(url, payload) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then((response) => response.json());
}

function collectPayload() {
  return {
    audToVuv: Number(document.getElementById("aud-rate-input").value || 0),
    nzdToVuv: Number(document.getElementById("nzd-rate-input").value || 0),
    quoteDisplayMode: "tax_inclusive",
    homepage: document.getElementById("homepage-select").value,
    backup: {
      autoDaily: document.getElementById("backup-auto-daily").checked,
      autoWeekly: document.getElementById("backup-auto-weekly").checked,
      googleDriveEnabled: document.getElementById("backup-google-enabled").checked,
      googleDriveFolderId: document.getElementById("backup-google-folder-id").value.trim(),
      googleDriveAccessToken: document.getElementById("backup-google-access-token").value.trim(),
      lastDailyBackupAt: state.settings.backup?.lastDailyBackupAt || "",
      lastWeeklyBackupAt: state.settings.backup?.lastWeeklyBackupAt || ""
    },
    company: {
      name: document.getElementById("company-name-input").value.trim(),
      tin: document.getElementById("company-tin-input").value.trim(),
      bankName: document.getElementById("company-bank-name-input").value.trim(),
      bankAccountName: document.getElementById("company-bank-account-name-input").value.trim(),
      bankAccountNumber: document.getElementById("company-bank-account-number-input").value.trim(),
      address: document.getElementById("company-address-input").value.trim(),
      phone: document.getElementById("company-phone-input").value.trim(),
      email: document.getElementById("company-email-input").value.trim(),
      logoUrl: document.getElementById("company-logo-url-input").value.trim()
    }
  };
}

function renderBackupHistory() {
  const body = document.getElementById("backup-history-table");
  const count = document.getElementById("backup-count");
  if (!body || !count) return;
  count.textContent = String(state.backups.length);
  body.innerHTML = state.backups.map((item) => `
    <tr class="align-top">
      <td class="py-3 pr-4 pl-4 text-slate-700">${formatDateTime(item.createdAt)}</td>
      <td class="py-3 pr-4"><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">${item.trigger || "-"}</span></td>
      <td class="py-3 pr-4 text-slate-700">${formatBytes(item.sizeBytes)}</td>
      <td class="py-3 pr-4">
        <div class="font-semibold text-slate-700">${item.googleDriveStatus || "-"}</div>
        ${item.googleDriveError ? `<div class="mt-1 text-xs text-red-600">${item.googleDriveError}</div>` : ""}
      </td>
      <td class="py-3 pr-4">
        <div class="flex flex-wrap gap-2">
          <button class="backup-download rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-primary" data-id="${item.id}" type="button">下载</button>
          <button class="backup-restore rounded-xl bg-amber-300 px-3 py-2 text-xs font-bold text-primary" data-id="${item.id}" type="button">恢复</button>
        </div>
      </td>
    </tr>
  `).join("") || `<tr><td class="py-6 pl-4 text-sm text-slate-500" colspan="5">暂无备份记录</td></tr>`;
}

function renderSettings() {
  const { backup, company } = state.settings;
  const locale = localStorage.getItem("smart_sizing_locale") || "zh-CN";
  const homepageLabels = { dashboard: "销售工作台", calculator: "销售报价" };
  const languageLabels = { "zh-CN": "中文", en: "English", bi: "Bislama" };

  document.getElementById("homepage-select").value = state.settings.homepage;
  document.getElementById("settings-language-select").value = locale;
  document.getElementById("aud-rate-input").value = state.settings.audToVuv;
  document.getElementById("nzd-rate-input").value = state.settings.nzdToVuv;
  document.getElementById("quote-display-mode").value = "tax_inclusive";

  document.getElementById("backup-auto-daily").checked = Boolean(backup.autoDaily);
  document.getElementById("backup-auto-weekly").checked = Boolean(backup.autoWeekly);
  document.getElementById("backup-google-enabled").checked = Boolean(backup.googleDriveEnabled);
  document.getElementById("backup-google-folder-id").value = backup.googleDriveFolderId || "";
  document.getElementById("backup-google-access-token").value = backup.googleDriveAccessToken || "";

  document.getElementById("company-name-input").value = company.name || "";
  document.getElementById("company-tin-input").value = company.tin || "";
  document.getElementById("company-bank-name-input").value = company.bankName || "";
  document.getElementById("company-bank-account-name-input").value = company.bankAccountName || "";
  document.getElementById("company-bank-account-number-input").value = company.bankAccountNumber || "";
  document.getElementById("company-address-input").value = company.address || "";
  document.getElementById("company-phone-input").value = company.phone || "";
  document.getElementById("company-email-input").value = company.email || "";
  document.getElementById("company-logo-url-input").value = company.logoUrl || "";
  renderLogoPreview(company.logoUrl || "");

  document.getElementById("summary-homepage").textContent = `默认首页：${homepageLabels[state.settings.homepage] || state.settings.homepage}`;
  document.getElementById("summary-language").textContent = `系统语言：${languageLabels[locale] || locale}`;
  document.getElementById("summary-aud").textContent = `AUD：1 AUD = ${state.settings.audToVuv} VUV`;
  document.getElementById("summary-nzd").textContent = `NZD：1 NZD = ${state.settings.nzdToVuv} VUV`;
  document.getElementById("summary-tax-mode").textContent = "税态：含税价（全局统一）";
  document.getElementById("aud-rate-line").textContent = `1 AUD = ${state.settings.audToVuv} VUV`;
  document.getElementById("nzd-rate-line").textContent = `1 NZD = ${state.settings.nzdToVuv} VUV`;
  document.getElementById("backup-last-daily").textContent = formatDateTime(backup.lastDailyBackupAt);
  document.getElementById("backup-last-weekly").textContent = formatDateTime(backup.lastWeeklyBackupAt);
  document.getElementById("google-drive-summary").textContent = backup.googleDriveEnabled
    ? (backup.googleDriveFolderId ? `已开启，Folder ID：${backup.googleDriveFolderId}` : "已开启，请完成 Google Drive 配置")
    : "未开启";

  renderBackupHistory();
}

async function loadSettings() {
  const settingsData = await fetch("/api/system-settings").then((response) => response.json());
  const localCompany = JSON.parse(localStorage.getItem("smart_sizing_company_profile") || "{}");
  state.settings = {
    ...state.settings,
    ...(settingsData.settings || {}),
    company: {
      ...state.settings.company,
      ...(settingsData.settings?.company || {}),
      ...(localCompany || {})
    }
  };
  state.backups = settingsData.backups || [];
  renderSettings();
}

async function saveSettings(showMessage = true) {
  const payload = collectPayload();
  const settingsData = await postJson("/api/system-settings", payload);
  if (!settingsData.ok) {
    renderMessage(settingsData.error || "保存设置失败", false);
    return false;
  }

  state.settings = {
    ...state.settings,
    ...(settingsData.settings || {}),
    company: {
      ...state.settings.company,
      ...(payload.company || {})
    }
  };
  state.backups = settingsData.backups || state.backups;
  localStorage.setItem("smart_sizing_company_profile", JSON.stringify(payload.company || {}));
  localStorage.setItem("smart_sizing_locale", document.getElementById("settings-language-select").value);
  renderSettings();
  if (showMessage) renderMessage("设置已保存", true);
  return true;
}

async function createBackup() {
  const saved = await saveSettings(false);
  if (!saved) return;
  const data = await postJson("/api/system-backups/create", { trigger: "manual", notes: "后台手动备份" });
  if (!data.ok) {
    renderMessage(data.error || "创建备份失败", false);
    return;
  }
  state.backups = data.backups || [];
  renderSettings();
  renderMessage("备份已生成", true);
}

async function restoreBackup(id) {
  if (!window.confirm("恢复会覆盖当前业务数据，确定继续吗？")) return;
  const data = await postJson("/api/system-backups/restore", { id });
  if (!data.ok) {
    renderMessage(data.error || "恢复备份失败", false);
    return;
  }
  await loadSettings();
  renderMessage("备份已恢复", true);
}

function downloadBackup(id) {
  window.location.href = `/api/system-backups/download?id=${encodeURIComponent(id)}`;
}

async function copyDriveSteps() {
  const steps = [
    "1. 打开 Google Drive，进入目标文件夹。",
    "2. 复制地址中 folders/ 后面的内容，填入 Google Drive Folder ID。",
    "3. 打开 Google OAuth 2.0 Playground。",
    "4. 选择 https://www.googleapis.com/auth/drive.file 并授权。",
    "5. 点击 Exchange authorization code for tokens。",
    "6. 复制 Access Token 粘贴回设置页。",
    "7. 先保存，再点击测试连通。"
  ].join("\n");

  try {
    await navigator.clipboard.writeText(steps);
    renderMessage("操作步骤已复制", true);
  } catch {
    renderMessage("复制失败，请手动复制", false);
  }
}

async function testGoogleDriveConnection() {
  const payload = collectPayload();
  const settingsSaved = await postJson("/api/system-settings", payload);
  if (!settingsSaved.ok) {
    renderMessage(settingsSaved.error || "备份设置保存失败", false);
    return;
  }

  const data = await postJson("/api/system-backups/test-drive", { backup: payload.backup });
  if (!data.ok) {
    renderMessage(data.error || "Google Drive 连通失败", false);
    return;
  }

  const text = [
    data.accountName ? `账号：${data.accountName}` : "",
    data.folderName ? `文件夹：${data.folderName}` : ""
  ].filter(Boolean).join(" | ");
  renderMessage(text || "Google Drive 连通正常", true);
  if (text) document.getElementById("google-drive-summary").textContent = text;
}

function openDriveModal() {
  const modal = document.getElementById("google-drive-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeDriveModal() {
  const modal = document.getElementById("google-drive-modal");
  if (!modal) return;
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.readAsDataURL(file);
  });
}

async function uploadCompanyLogo(file) {
  if (!file) return;
  const dataUrl = await readFileAsDataUrl(file);
  const data = await postJson("/api/company-profile/logo/upload", {
    filename: file.name,
    dataUrl
  });
  if (!data.ok) {
    renderMessage(data.error || "LOGO 上传失败", false);
    return;
  }
  document.getElementById("company-logo-url-input").value = data.logoUrl || "";
  renderLogoPreview(data.logoUrl || "");
  await saveSettings(true);
  renderMessage("LOGO 已上传并保存", true);
}

function bindEvents() {
  document.getElementById("save-settings-button").addEventListener("click", () => saveSettings(true));
  document.getElementById("backup-save-config-button").addEventListener("click", () => saveSettings(true));
  document.getElementById("backup-create-button").addEventListener("click", createBackup);
  document.getElementById("backup-refresh-button").addEventListener("click", loadSettings);
  document.getElementById("copy-drive-steps-button").addEventListener("click", copyDriveSteps);
  document.getElementById("close-drive-modal-button").addEventListener("click", closeDriveModal);
  document.getElementById("backup-test-drive-button").addEventListener("click", testGoogleDriveConnection);
  document.getElementById("backup-save-drive-button").addEventListener("click", async () => {
    const saved = await saveSettings(true);
    if (saved) closeDriveModal();
  });
  document.getElementById("backup-disable-drive-button").addEventListener("click", async () => {
    document.getElementById("backup-google-enabled").checked = false;
    document.getElementById("backup-google-folder-id").value = "";
    document.getElementById("backup-google-access-token").value = "";
    await saveSettings(true);
    closeDriveModal();
  });
  document.getElementById("backup-google-enabled").addEventListener("change", (event) => {
    if (event.target.checked) openDriveModal();
  });
  document.getElementById("company-logo-upload-button").addEventListener("click", () => {
    document.getElementById("company-logo-file-input").click();
  });
  document.getElementById("company-logo-file-input").addEventListener("change", async (event) => {
    const [file] = Array.from(event.target.files || []);
    if (!file) return;
    try {
      await uploadCompanyLogo(file);
    } catch (error) {
      console.error(error);
      renderMessage(error.message || "LOGO 上传失败", false);
    } finally {
      event.target.value = "";
    }
  });
  document.getElementById("company-logo-url-input").addEventListener("input", (event) => {
    renderLogoPreview(event.target.value.trim());
  });
  document.getElementById("backup-history-table").addEventListener("click", (event) => {
    const downloadButton = event.target.closest(".backup-download");
    if (downloadButton) {
      downloadBackup(downloadButton.dataset.id);
      return;
    }
    const restoreButton = event.target.closest(".backup-restore");
    if (restoreButton) restoreBackup(restoreButton.dataset.id);
  });
}

async function init() {
  bindEvents();
  await loadSettings();
}

init().catch((error) => {
  console.error(error);
  renderMessage("设置页初始化失败", false);
});
