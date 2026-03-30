const repairCreateState = {
  saving: false,
  map: null,
  marker: null,
  engineers: [],
  spareParts: [
    { id: "repair-fuse-100a", name: "Inverter DC Fuse (100A)", sku: "SOL-FUSE-100A-DC", unit: "pcs", stock: 22 },
    { id: "repair-seal-v2", name: "Connector Seal", sku: "SOL-SEAL-V2", unit: "pcs", stock: 64 },
    { id: "mc4-pair", name: "MC4 Connector Pair", sku: "MC4-PAIR", unit: "pairs", stock: 220 },
    { id: "pv-cable-black", name: "PV Black Cable", sku: "PV-BLACK", unit: "m", stock: 3200 },
    { id: "pv-cable-red", name: "PV Red Cable", sku: "PV-RED", unit: "m", stock: 3000 },
    { id: "ac-breaker", name: "Mini Circuit Breaker", sku: "BRK-GEN", unit: "pcs", stock: 140 }
  ]
};

function formatCoordinateText(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  return `${Math.abs(lat).toFixed(4)}° ${lat < 0 ? "S" : "N"}, ${Math.abs(lng).toFixed(4)}° ${lng < 0 ? "W" : "E"}`;
}

function renderMessage(message, success = true) {
  const node = document.getElementById("rc-message");
  node.classList.remove("hidden");
  node.className = `mt-4 rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`;
  node.textContent = message;
}

function setCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  document.getElementById("rc-latitude").value = lat.toFixed(6);
  document.getElementById("rc-longitude").value = lng.toFixed(6);
  document.getElementById("rc-coordinates").value = formatCoordinateText(lat, lng);
  if (repairCreateState.marker) repairCreateState.marker.setLatLng([lat, lng]);
  if (repairCreateState.map) repairCreateState.map.panTo([lat, lng], { animate: true });
  updatePreview();
}

function initMap() {
  repairCreateState.map = L.map("rc-map").setView([-17.7333, 168.3271], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap"
  }).addTo(repairCreateState.map);
  repairCreateState.marker = L.marker([-17.7333, 168.3271], { draggable: true }).addTo(repairCreateState.map);
  repairCreateState.map.on("click", (event) => setCoordinates(event.latlng.lat, event.latlng.lng));
  repairCreateState.marker.on("dragend", (event) => {
    const point = event.target.getLatLng();
    setCoordinates(point.lat, point.lng);
  });
  setCoordinates(-17.7333, 168.3271);
}

async function loadEngineers() {
  const response = await fetch("/api/employees?role=engineer");
  const result = await response.json();
  repairCreateState.engineers = Array.isArray(result.items) ? result.items : [];
  renderEngineers();
}

function renderEngineers() {
  const select = document.getElementById("rc-engineer");
  const options = repairCreateState.engineers.length
    ? repairCreateState.engineers.map((item) => `<option value="${item.id}">${item.name} / ${item.branch}</option>`).join("")
    : `<option value="">暂无工程师，请先到员工管理添加</option>`;
  select.innerHTML = options;
}

function renderSpareParts() {
  const wrap = document.getElementById("rc-spare-parts");
  wrap.innerHTML = repairCreateState.spareParts.map((item) => `
    <label class="rounded-2xl border border-outline-variant/20 bg-surface-container-low p-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="font-bold text-primary">${item.name}</div>
          <div class="text-xs text-slate-500">${item.sku} / 库存 ${item.stock} ${item.unit}</div>
        </div>
        <input class="mt-1 h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary/30" data-spare-toggle="${item.id}" type="checkbox" />
      </div>
      <div class="mt-3">
        <input class="w-full rounded-xl border border-outline-variant/20 bg-white px-4 py-2 text-sm" data-spare-qty="${item.id}" min="0" placeholder="数量" type="number" value="0" />
      </div>
    </label>
  `).join("");
}

function getSelectedSpareParts() {
  return repairCreateState.spareParts.map((item) => {
    const enabled = document.querySelector(`[data-spare-toggle="${item.id}"]`)?.checked;
    const quantity = Number(document.querySelector(`[data-spare-qty="${item.id}"]`)?.value || 0);
    if (!enabled || quantity <= 0) return null;
    return { id: item.id, name: item.name, sku: item.sku, unit: item.unit, quantity };
  }).filter(Boolean);
}

function getFormData() {
  return {
    title: document.getElementById("rc-title").value.trim(),
    priority: document.getElementById("rc-priority").value,
    description: document.getElementById("rc-description").value.trim(),
    etaDate: document.getElementById("rc-eta-date").value,
    etaTime: document.getElementById("rc-eta-time").value,
    initialNote: document.getElementById("rc-note").value.trim(),
    customerName: document.getElementById("rc-customer-name").value.trim(),
    customerPhone: document.getElementById("rc-customer-phone").value.trim(),
    customerEmail: document.getElementById("rc-customer-email").value.trim(),
    customerAddress: document.getElementById("rc-customer-address").value.trim(),
    assignedEngineerId: document.getElementById("rc-engineer").value,
    assetName: document.getElementById("rc-asset-name").value.trim(),
    assetAddress: document.getElementById("rc-asset-address").value.trim(),
    latitude: Number(document.getElementById("rc-latitude").value || -17.7333),
    longitude: Number(document.getElementById("rc-longitude").value || 168.3271),
    coordinates: document.getElementById("rc-coordinates").value.trim(),
    spareParts: getSelectedSpareParts()
  };
}

function updatePreview() {
  const data = getFormData();
  const engineer = repairCreateState.engineers.find((item) => item.id === data.assignedEngineerId);
  document.getElementById("rc-preview-title").textContent = data.title || "-";
  document.getElementById("rc-preview-customer").textContent = data.customerName || "-";
  document.getElementById("rc-preview-engineer").textContent = engineer ? `${engineer.name} / ${engineer.branch}` : "-";
  document.getElementById("rc-preview-asset").textContent = data.assetName || data.assetAddress || "-";
  document.getElementById("rc-preview-eta").textContent = [data.etaDate, data.etaTime].filter(Boolean).join(" ") || "-";
  document.getElementById("rc-preview-parts").textContent = data.spareParts.length
    ? data.spareParts.map((item) => `${item.name} x${item.quantity}`).join("，")
    : "-";
}

function bindFormEvents() {
  [
    "rc-title", "rc-priority", "rc-description", "rc-eta-date", "rc-eta-time", "rc-note",
    "rc-customer-name", "rc-customer-phone", "rc-customer-email", "rc-customer-address",
    "rc-engineer", "rc-asset-name", "rc-asset-address", "rc-latitude", "rc-longitude"
  ].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updatePreview);
    document.getElementById(id)?.addEventListener("change", updatePreview);
  });

  document.getElementById("rc-latitude")?.addEventListener("change", () => {
    setCoordinates(document.getElementById("rc-latitude").value, document.getElementById("rc-longitude").value);
  });
  document.getElementById("rc-longitude")?.addEventListener("change", () => {
    setCoordinates(document.getElementById("rc-latitude").value, document.getElementById("rc-longitude").value);
  });
  document.querySelectorAll("[data-spare-toggle],[data-spare-qty]").forEach((node) => {
    node.addEventListener("change", updatePreview);
    node.addEventListener("input", updatePreview);
  });
  document.getElementById("rc-use-current-location")?.addEventListener("click", () => {
    if (!navigator.geolocation) {
      renderMessage("当前设备不支持定位。", false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setCoordinates(position.coords.latitude, position.coords.longitude),
      () => renderMessage("无法获取当前位置，请检查定位权限。", false)
    );
  });
  document.getElementById("rc-save")?.addEventListener("click", saveOrder);
}

async function saveOrder() {
  if (repairCreateState.saving) return;
  const data = getFormData();
  if (!data.title || !data.description || !data.assetName || !data.customerName || !data.customerPhone) {
    renderMessage("请填写故障标题、故障描述、站点名称、客户姓名和电话。", false);
    return;
  }
  if (!data.assignedEngineerId) {
    renderMessage("请先从员工管理中的工程师列表选择派单工程师。", false);
    return;
  }
  repairCreateState.saving = true;
  document.getElementById("rc-save").disabled = true;
  try {
    const response = await fetch("/api/repair-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });
    const result = await response.json();
    if (!response.ok || !result?.order?.id) {
      throw new Error(result?.error || "保存失败");
    }
    renderMessage("维修单已创建，正在跳转详情页。");
    setTimeout(() => {
      window.location.href = `/repair.html?id=${encodeURIComponent(result.order.id)}`;
    }, 500);
  } catch (error) {
    renderMessage(error.message || "保存失败", false);
  } finally {
    repairCreateState.saving = false;
    document.getElementById("rc-save").disabled = false;
  }
}

async function init() {
  renderSpareParts();
  await loadEngineers();
  initMap();
  bindFormEvents();
  updatePreview();
}

init().catch((error) => {
  console.error(error);
  renderMessage("维修单页面初始化失败。", false);
});
