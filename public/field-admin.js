const adminState = {
  users: [],
  userId: "",
  date: new Date().toISOString().slice(0, 10),
  dailyRate: 0,
  checkins: [],
  visits: [],
  tracks: []
};

function $(id) { return document.getElementById(id); }

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(url);
  return res.json();
}

async function loadUsers() {
  const data = await fetchJson("/api/employees");
  adminState.users = data.items || [];
  const sel = $("admin-user-select");
  sel.innerHTML = adminState.users.map((u) => `<option value="${u.id}">${u.name} / ${u.roleLabel || u.role}</option>`).join("");
  adminState.userId = adminState.users[0]?.id || "";
  sel.value = adminState.userId;
}

async function loadData() {
  const { userId, date } = adminState;
  if (!userId) return;
  const [checkinsRes, visitsRes, tracksRes] = await Promise.all([
    fetchJson(`/api/field-checkins?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`),
    fetchJson(`/api/field-visits?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`),
    fetchJson(`/api/field-tracks?user=${encodeURIComponent(userId)}&date=${encodeURIComponent(date)}`)
  ]);
  adminState.checkins = checkinsRes.items || [];
  adminState.visits = visitsRes.items || [];
  adminState.tracks = tracksRes.items || [];
  renderAll();
}

function renderCheckins() {
  const wrap = $("checkin-table");
  if (!adminState.checkins.length) {
    wrap.textContent = "当日暂无打卡";
    return;
  }
  wrap.innerHTML = `
    <table class="w-full text-left border-collapse">
      <thead class="text-[11px] uppercase text-slate-500">
        <tr><th class="py-2 pr-4">时间</th><th class="py-2 pr-4">动作</th><th class="py-2 pr-4">坐标</th><th class="py-2 pr-4">备注</th></tr>
      </thead>
      <tbody class="text-xs divide-y divide-slate-100">
        ${adminState.checkins.map((c)=>`
          <tr>
            <td class="py-2 pr-4">${new Date(c.ts).toLocaleTimeString()}</td>
            <td class="py-2 pr-4">${c.action === "in" ? "上班" : "下班"}</td>
            <td class="py-2 pr-4">${(c.lat?.toFixed(5) || "-")}, ${(c.lng?.toFixed(5) || "-")}</td>
            <td class="py-2 pr-4">${c.note || "-"}</td>
          </tr>`).join("")}
      </tbody>
    </table>
  `;
}

function renderVisits() {
  const wrap = $("visit-table");
  if (!adminState.visits.length) {
    wrap.textContent = "当日暂无拜访";
    return;
  }
  wrap.innerHTML = adminState.visits.map((v)=>`
    <div class="rounded-xl border border-slate-200 p-3 mb-2 text-xs">
      <div class="flex justify-between">
        <span class="font-bold text-primary">${v.customer}</span>
        <span class="text-slate-500">${(v.recordedAt||"").slice(11,16)}</span>
      </div>
      <div class="text-slate-600">${v.address || "-"}</div>
      <div class="text-slate-500">${v.note || ""}</div>
      ${v.photoUrls?.length ? `<div class="flex gap-2 flex-wrap mt-1">${v.photoUrls.map((url)=>`<img src="${url}" class="h-14 w-14 rounded-lg object-cover border" />`).join("")}</div>` : ""}
      ${v.audioUrl ? `<a class="text-primary font-bold mt-1 inline-block" href="${v.audioUrl}" target="_blank" rel="noreferrer">播放录音</a>` : ""}
    </div>
  `).join("");
}

function renderTracks() {
  const wrap = $("track-table");
  const points = adminState.tracks.flatMap((t)=>t.points||[]);
  if (!points.length) {
    wrap.textContent = "当日暂无轨迹";
    return;
  }
  wrap.innerHTML = `
    <table class="w-full text-left border-collapse">
      <thead class="text-[11px] uppercase text-slate-500">
        <tr><th class="py-2 pr-4">时间</th><th class="py-2 pr-4">坐标</th><th class="py-2 pr-4">精度</th></tr>
      </thead>
      <tbody class="text-xs divide-y divide-slate-100">
        ${points.sort((a,b)=>new Date(b.ts)-new Date(a.ts)).slice(0,80).map((p)=>`
          <tr>
            <td class="py-2 pr-4">${new Date(p.ts).toLocaleTimeString()}</td>
            <td class="py-2 pr-4">${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</td>
            <td class="py-2 pr-4">${Math.round(p.accuracy||0)}m</td>
          </tr>`).join("")}
      </tbody>
    </table>
  `;
}

function renderKpi() {
  $("kpi-checkins").textContent = `${adminState.checkins.length} 次`;
  $("kpi-visits").textContent = `${adminState.visits.length}`;
  const dailyRate = Number($("daily-rate").value || 0);
  const days = new Set(adminState.checkins.map(c=>c.date || (c.ts||"").slice(0,10))).size;
  $("kpi-payroll").textContent = dailyRate > 0 ? `VT ${(days*dailyRate).toLocaleString()}` : "0";
}

function renderAll() {
  renderCheckins();
  renderVisits();
  renderTracks();
  renderKpi();
}

function bind() {
  $("admin-user-select").onchange = (e)=>{ adminState.userId = e.target.value; loadData(); };
  $("admin-date").value = adminState.date;
  $("admin-date").onchange = (e)=>{ adminState.date = e.target.value; loadData(); };
  $("daily-rate").onchange = renderKpi;
  $("admin-refresh").onclick = loadData;
}

async function init() {
  await loadUsers();
  bind();
  await loadData();
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch((err)=>{ console.error(err); });
});
