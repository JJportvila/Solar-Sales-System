const state = {
  locale: localStorage.getItem("smart_sizing_locale") || "zh-CN",
  translations: {},
  bookings: [],
  scheduleQueue: [],
  engineers: [],
  island: "Efate",
  sitePhotos: [],
  map: null,
  marker: null,
  selectedBookingId: ""
};

const islandOptions = ["Efate", "Santo", "Tanna", "Malekula"];

function interpolate(template, params = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => params[key] ?? "");
}

function t(key, params = {}) {
  return interpolate(state.translations[key] ?? key, params);
}

async function loadTranslations(locale) {
  const response = await fetch(`/locales/${locale}.json`);
  state.translations = await response.json();
  state.locale = locale;
  localStorage.setItem("smart_sizing_locale", locale);
}

function setHealth(ok) {
  const dot = document.getElementById("health-dot");
  const text = document.getElementById("health-text");
  if (!dot || !text) return;
  dot.className = `inline-block w-2.5 h-2.5 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`;
  text.textContent = ok ? t("status.online") : t("status.error");
}

function renderOutput(message, success = true) {
  const node = document.getElementById("survey-output");
  node.classList.remove("hidden");
  node.className = `mt-5 rounded-2xl p-4 text-sm ${success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`;
  node.textContent = message;
}

function applyTranslations() {
  document.documentElement.lang = state.locale;
  document.title = t("survey.metaTitle");
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });
  renderIslandOptions();
  renderBookings();
  renderScheduleQueue();
  renderReviewPanel();
  renderSchedulePanel();
  renderPhotoGrid();
}

function renderIslandOptions() {
  const wrap = document.getElementById("survey-island-options");
  wrap.innerHTML = "";
  islandOptions.forEach((island) => {
    const active = island === state.island;
    const button = document.createElement("button");
    button.type = "button";
    button.className = `rounded-2xl border px-4 py-4 text-left text-sm font-bold transition ${active ? "border-secondary bg-secondary/5 text-primary" : "border-outline-variant/25 bg-surface-container-low text-slate-700"}`;
    button.textContent = island;
    button.addEventListener("click", () => {
      state.island = island;
      renderIslandOptions();
    });
    wrap.appendChild(button);
  });
}

function renderPhotoGrid() {
  const wrap = document.getElementById("survey-photo-grid");
  wrap.innerHTML = "";
  if (!state.sitePhotos.length) {
    for (let index = 0; index < 4; index += 1) {
      const slot = document.createElement("div");
      slot.className = "rounded-[1.5rem] border-2 border-dashed border-outline-variant/25 bg-surface-container-low px-4 py-10 text-center text-sm text-slate-400";
      slot.innerHTML = `<div class="mb-2"><span class="material-symbols-outlined">photo_camera</span></div><div>${t("survey.emptyPhotoSlot")}</div>`;
      wrap.appendChild(slot);
    }
    return;
  }

  state.sitePhotos.forEach((photo, index) => {
    const card = document.createElement("div");
    card.className = "rounded-[1.5rem] overflow-hidden border border-outline-variant/20 bg-white shadow-sm";
    card.innerHTML = `
      <img class="h-32 w-full object-cover" src="${photo}" alt="survey photo ${index + 1}" />
      <button class="w-full border-t border-outline-variant/10 px-3 py-2 text-xs font-bold text-red-600">${t("action.cancel")}</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      state.sitePhotos.splice(index, 1);
      renderPhotoGrid();
    });
    wrap.appendChild(card);
  });
}

function formatBookingStatus(status) {
  const map = {
    review: t("survey.statusReview"),
    confirmed: t("survey.statusConfirmed"),
    scheduled: t("survey.statusScheduled"),
    completed: t("survey.statusCompleted"),
    rejected: t("survey.statusRejected")
  };
  return map[status] || status;
}

function getSelectedBooking() {
  if (!state.bookings.length) return null;
  return state.bookings.find((item) => item.id === state.selectedBookingId) || state.bookings[0];
}

function renderReviewPanel() {
  const booking = getSelectedBooking();
  const statusNode = document.getElementById("survey-review-status");
  const notesNode = document.getElementById("survey-review-notes");
  const reviewerNode = document.getElementById("survey-reviewed-by");
  const metaNode = document.getElementById("survey-review-meta");
  const photosNode = document.getElementById("survey-check-photos");
  const gpsNode = document.getElementById("survey-check-gps");
  const contactNode = document.getElementById("survey-check-contact");

  if (!statusNode || !notesNode || !reviewerNode || !metaNode || !photosNode || !gpsNode || !contactNode) return;

  if (!booking) {
    statusNode.textContent = "-";
    metaNode.textContent = t("survey.noBookingSelected");
    notesNode.value = "";
    reviewerNode.value = "Survey Desk";
    photosNode.checked = false;
    gpsNode.checked = false;
    contactNode.checked = false;
    return;
  }

  statusNode.textContent = formatBookingStatus(booking.status);
  notesNode.value = booking.reviewNotes || "";
  reviewerNode.value = booking.reviewedBy || "Survey Desk";
  photosNode.checked = Boolean(booking.reviewChecklist?.photosOk);
  gpsNode.checked = Boolean(booking.reviewChecklist?.gpsOk);
  contactNode.checked = Boolean(booking.reviewChecklist?.contactOk);

  const reviewedAt = booking.reviewedAt ? new Date(booking.reviewedAt).toLocaleString() : t("survey.notReviewedYet");
  metaNode.textContent = `${t("survey.reviewTarget")}: ${booking.customer?.name || t("fallback.unnamed")} / ${booking.id} / ${reviewedAt}`;
}

function renderSchedulePanel() {
  const booking = getSelectedBooking();
  const statusNode = document.getElementById("survey-schedule-panel-status");
  const metaNode = document.getElementById("survey-schedule-meta");
  const engineerNode = document.getElementById("survey-schedule-engineer");
  const dateNode = document.getElementById("survey-schedule-date");
  const timeNode = document.getElementById("survey-schedule-time");
  const notesNode = document.getElementById("survey-schedule-notes");

  if (!statusNode || !metaNode || !engineerNode || !dateNode || !timeNode || !notesNode) return;

  engineerNode.innerHTML = "";
  if (!state.engineers.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = t("survey.noEngineers");
    engineerNode.appendChild(option);
    engineerNode.disabled = true;
  } else {
    engineerNode.disabled = false;
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = t("survey.selectEngineer");
    engineerNode.appendChild(placeholder);
    state.engineers.forEach((engineer) => {
      const option = document.createElement("option");
      option.value = engineer.id;
      option.textContent = `${engineer.name} · ${engineer.branch || engineer.roleLabel || ""}`.trim();
      engineerNode.appendChild(option);
    });
  }

  if (!booking) {
    statusNode.textContent = "-";
    metaNode.textContent = t("survey.noBookingSelected");
    dateNode.value = "";
    timeNode.value = "09:00-12:00";
    notesNode.value = "";
    return;
  }

  const task = booking.scheduleTask || {};
  statusNode.textContent = formatScheduleTaskStatus(task.status || "pending");
  engineerNode.value = task.engineerId || "";
  dateNode.value = task.visitDate || booking.preferredDate || "";
  timeNode.value = task.visitTime || booking.preferredTime || "09:00-12:00";
  notesNode.value = task.notes || booking.reviewNotes || "";
  metaNode.textContent = `${t("survey.scheduleTarget")}: ${booking.customer?.name || t("fallback.unnamed")} / ${booking.id} / ${booking.island}`;
}

function renderBookings() {
  const list = document.getElementById("survey-booking-list");
  const count = document.getElementById("survey-booking-count");
  if (!list || !count) return;
  if (!state.selectedBookingId && state.bookings.length) {
    state.selectedBookingId = state.bookings[0].id;
  }
  if (state.selectedBookingId && !state.bookings.some((item) => item.id === state.selectedBookingId) && state.bookings.length) {
    state.selectedBookingId = state.bookings[0].id;
  }
  count.textContent = String(state.bookings.length);
  list.innerHTML = "";
  if (!state.bookings.length) {
    list.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-slate-500">${t("survey.noBookings")}</div>`;
    renderReviewPanel();
    return;
  }
  state.bookings.slice(0, 4).forEach((booking) => {
    const active = booking.id === state.selectedBookingId;
    const card = document.createElement("div");
    card.className = `rounded-2xl px-4 py-4 border cursor-pointer transition ${active ? "border-primary bg-primary text-white shadow-lg shadow-primary/10" : "border-transparent bg-surface-container-low hover:border-outline-variant/25"}`;
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="font-bold ${active ? "text-white" : "text-primary"}">${booking.customer?.name || t("fallback.unnamed")}</div>
          <div class="mt-1 text-sm ${active ? "text-white/80" : "text-slate-500"}">${booking.island} / ${booking.preferredDate || "-"} / ${booking.preferredTime || "-"}</div>
          <div class="mt-1 text-xs ${active ? "text-white/65" : "text-slate-400"}">${booking.customer?.phone || "-"} / ${booking.customer?.address || "-"}</div>
        </div>
        <span class="rounded-full ${active ? "bg-white/15 text-white" : "bg-white text-primary"} px-3 py-1 text-[11px] font-bold">${formatBookingStatus(booking.status)}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      state.selectedBookingId = booking.id;
      renderBookings();
      renderReviewPanel();
      renderSchedulePanel();
    });
    list.appendChild(card);
  });
  renderReviewPanel();
  renderSchedulePanel();
}

function formatScheduleTaskStatus(status) {
  const map = {
    pending: t("survey.schedulePending"),
    scheduled: t("survey.scheduleReady"),
    on_hold: t("survey.scheduleOnHold"),
    completed: t("survey.scheduleDone")
  };
  return map[status] || status;
}

function renderScheduleQueue() {
  const list = document.getElementById("survey-schedule-list");
  const count = document.getElementById("survey-schedule-count");
  if (!list || !count) return;
  count.textContent = String(state.scheduleQueue.length);
  list.innerHTML = "";
  if (!state.scheduleQueue.length) {
    list.innerHTML = `<div class="rounded-2xl bg-surface-container-low px-4 py-4 text-sm text-slate-500">${t("survey.noScheduleTasks")}</div>`;
    return;
  }

  state.scheduleQueue.slice(0, 5).forEach((task) => {
    const card = document.createElement("div");
    card.className = "rounded-2xl border border-outline-variant/15 bg-surface-container-low px-4 py-4";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="font-bold text-primary">${task.customerName || t("fallback.unnamed")}</div>
          <div class="mt-1 text-sm text-slate-500">${task.island} / ${task.preferredDate || "-"} / ${task.preferredTime || "-"}</div>
          <div class="mt-1 text-xs text-slate-400">${task.notes || t("survey.schedulePendingHint")}</div>
        </div>
        <span class="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-primary">${formatScheduleTaskStatus(task.status)}</span>
      </div>
    `;
    card.addEventListener("click", () => {
      state.selectedBookingId = task.bookingId;
      renderBookings();
      renderSchedulePanel();
    });
    list.appendChild(card);
  });
}

async function loadBookings() {
  const response = await fetch("/api/site-survey");
  const data = await response.json();
  state.bookings = data.bookings || [];
  state.scheduleQueue = data.scheduleQueue || [];
  renderBookings();
  renderScheduleQueue();
}

async function loadEngineers() {
  const response = await fetch("/api/employees?role=engineer");
  const data = await response.json();
  state.engineers = data.items || [];
  renderSchedulePanel();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handlePhotoUpload(event) {
  const files = Array.from(event.target.files || []).slice(0, 6);
  const uploads = [];
  for (const file of files) {
    uploads.push(await readFileAsDataUrl(file));
  }
  state.sitePhotos = uploads;
  renderPhotoGrid();
}

function getCurrentCoordinates() {
  const lat = Number(document.getElementById("survey-latitude").value || -17.7333);
  const lng = Number(document.getElementById("survey-longitude").value || 168.3167);
  return {
    lat: Number.isFinite(lat) ? lat : -17.7333,
    lng: Number.isFinite(lng) ? lng : 168.3167
  };
}

function updateMapMarker(lat, lng, center = false) {
  if (!state.map || !window.L) return;
  const point = [lat, lng];
  if (!state.marker) {
    state.marker = window.L.marker(point, { draggable: true }).addTo(state.map);
    state.marker.on("dragend", () => {
      const markerPoint = state.marker.getLatLng();
      setCoordinates(markerPoint.lat, markerPoint.lng, false);
    });
  } else {
    state.marker.setLatLng(point);
  }
  if (center) {
    state.map.setView(point, Math.max(state.map.getZoom(), 13));
  }
}

function setCoordinates(lat, lng, syncMap = true) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
  document.getElementById("survey-latitude").value = Number(lat).toFixed(6);
  document.getElementById("survey-longitude").value = Number(lng).toFixed(6);
  if (syncMap) {
    updateMapMarker(Number(lat), Number(lng), true);
  }
}

function initMap() {
  if (!window.L || state.map) return;
  const { lat, lng } = getCurrentCoordinates();
  state.map = window.L.map("survey-map", {
    zoomControl: true,
    attributionControl: true
  }).setView([lat, lng], 13);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(state.map);

  updateMapMarker(lat, lng, false);

  state.map.on("click", (event) => {
    setCoordinates(event.latlng.lat, event.latlng.lng, false);
    updateMapMarker(event.latlng.lat, event.latlng.lng, true);
  });

  setTimeout(() => state.map.invalidateSize(), 50);
}

function lockCurrentLocation() {
  if (!navigator.geolocation) {
    renderOutput(t("survey.locationUnsupported"), false);
    return;
  }
  navigator.geolocation.getCurrentPosition((position) => {
    setCoordinates(position.coords.latitude, position.coords.longitude, true);
  }, () => renderOutput(t("survey.locationDenied"), false));
}

async function submitSurvey() {
  const payload = {
    island: state.island,
    preferredDate: document.getElementById("survey-date").value,
    preferredTime: document.getElementById("survey-time").value,
    latitude: Number(document.getElementById("survey-latitude").value || -17.7333),
    longitude: Number(document.getElementById("survey-longitude").value || 168.3167),
    sitePhotos: state.sitePhotos,
    customer: {
      name: document.getElementById("survey-customer-name").value.trim(),
      phone: document.getElementById("survey-customer-phone").value.trim(),
      address: document.getElementById("survey-customer-address").value.trim()
    }
  };

  if (!payload.customer.name || !payload.customer.phone || !payload.preferredDate) {
    renderOutput(t("survey.formInvalid"), false);
    return;
  }

  const response = await fetch("/api/site-survey/book", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    renderOutput(data.error || t("status.error"), false);
    return;
  }

  state.bookings = data.bookings || [];
  state.scheduleQueue = data.scheduleQueue || state.scheduleQueue;
  state.selectedBookingId = data.booking?.id || state.selectedBookingId;
  renderBookings();
  renderScheduleQueue();
  renderSchedulePanel();
  renderOutput(t("survey.saved"), true);
}

async function submitReview(status) {
  const booking = getSelectedBooking();
  if (!booking) {
    renderOutput(t("survey.noBookingSelected"), false);
    return;
  }

  const payload = {
    id: booking.id,
    status,
    reviewNotes: document.getElementById("survey-review-notes").value.trim(),
    reviewedBy: document.getElementById("survey-reviewed-by").value.trim() || "Survey Desk",
    reviewChecklist: {
      photosOk: document.getElementById("survey-check-photos").checked,
      gpsOk: document.getElementById("survey-check-gps").checked,
      contactOk: document.getElementById("survey-check-contact").checked
    }
  };

  const response = await fetch("/api/site-survey/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    renderOutput(data.error || t("status.error"), false);
    return;
  }

  state.bookings = data.bookings || [];
  state.scheduleQueue = data.scheduleQueue || state.scheduleQueue;
  state.selectedBookingId = data.booking?.id || state.selectedBookingId;
  renderBookings();
  renderScheduleQueue();
  renderSchedulePanel();

  const successKey = status === "rejected"
    ? "survey.reviewRejectedSaved"
    : status === "scheduled"
      ? "survey.reviewScheduledSaved"
      : "survey.reviewApprovedSaved";
  renderOutput(t(successKey), true);
}

async function saveSchedule() {
  const booking = getSelectedBooking();
  if (!booking) {
    renderOutput(t("survey.noBookingSelected"), false);
    return;
  }

  const payload = {
    id: booking.id,
    engineerId: document.getElementById("survey-schedule-engineer").value,
    visitDate: document.getElementById("survey-schedule-date").value,
    visitTime: document.getElementById("survey-schedule-time").value,
    notes: document.getElementById("survey-schedule-notes").value.trim()
  };

  if (!payload.engineerId || !payload.visitDate || !payload.visitTime) {
    renderOutput(t("survey.scheduleInvalid"), false);
    return;
  }

  const response = await fetch("/api/site-survey/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    renderOutput(data.error || t("status.error"), false);
    return;
  }

  state.bookings = data.bookings || [];
  state.scheduleQueue = data.scheduleQueue || [];
  state.selectedBookingId = data.booking?.id || state.selectedBookingId;
  renderBookings();
  renderScheduleQueue();
  renderSchedulePanel();
  renderOutput(t("survey.scheduleSaved"), true);
}

function bindEvents() {
  document.getElementById("survey-photo-input").addEventListener("change", (event) => {
    handlePhotoUpload(event).catch(() => renderOutput(t("status.error"), false));
  });
  document.getElementById("survey-current-location").addEventListener("click", lockCurrentLocation);
  document.getElementById("survey-submit").addEventListener("click", submitSurvey);
  document.getElementById("survey-review-approve").addEventListener("click", () => submitReview("confirmed"));
  document.getElementById("survey-review-reject").addEventListener("click", () => submitReview("rejected"));
  document.getElementById("survey-review-schedule").addEventListener("click", () => submitReview("scheduled"));
  document.getElementById("survey-schedule-save").addEventListener("click", saveSchedule);
  document.getElementById("survey-latitude").addEventListener("change", () => {
    const { lat, lng } = getCurrentCoordinates();
    updateMapMarker(lat, lng, true);
  });
  document.getElementById("survey-longitude").addEventListener("change", () => {
    const { lat, lng } = getCurrentCoordinates();
    updateMapMarker(lat, lng, true);
  });
}

async function init() {
  await loadTranslations(state.locale);
  bindEvents();
  applyTranslations();
  setCoordinates(-17.7333, 168.3167, false);
  initMap();
  const health = await fetch("/api/health");
  setHealth(health.ok);
  await loadEngineers();
  await loadBookings();
}

init().catch((error) => {
  console.error(error);
  setHealth(false);
  renderOutput(t("status.error"), false);
});
