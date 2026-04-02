const fs = require("fs");
const path = require("path");

const { buildDemoAttendanceData } = require("./attendance-demo-data");
const { createFieldStore } = require("./field-store");

const ROOT_DIR = path.join(__dirname, "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const FIELD_TRACKS_FILE = path.join(DATA_DIR, "field_tracks.json");
const FIELD_VISITS_FILE = path.join(DATA_DIR, "field_visits.json");
const FIELD_CHECKINS_FILE = path.join(DATA_DIR, "field_checkins.json");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function mergeById(existing = [], incoming = []) {
  const map = new Map();
  for (const item of Array.isArray(existing) ? existing : []) {
    if (item && item.id) map.set(String(item.id), item);
  }
  for (const item of Array.isArray(incoming) ? incoming : []) {
    if (item && item.id) map.set(String(item.id), item);
  }
  return Array.from(map.values());
}

async function main() {
  ensureDir(DATA_DIR);

  const demo = buildDemoAttendanceData({
    timeZone: process.env.BUSINESS_TIME_ZONE || "Pacific/Efate"
  });

  const nextTracks = mergeById(readJson(FIELD_TRACKS_FILE, []), demo.tracks)
    .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
  const nextVisits = mergeById(readJson(FIELD_VISITS_FILE, []), demo.visits)
    .sort((a, b) => String(b.recordedAt || "").localeCompare(String(a.recordedAt || "")));
  const nextCheckins = mergeById(readJson(FIELD_CHECKINS_FILE, []), demo.checkins)
    .sort((a, b) => String(b.ts || "").localeCompare(String(a.ts || "")));

  writeJson(FIELD_TRACKS_FILE, nextTracks);
  writeJson(FIELD_VISITS_FILE, nextVisits);
  writeJson(FIELD_CHECKINS_FILE, nextCheckins);

  const fieldStore = createFieldStore();
  let databaseUpdated = false;
  if (fieldStore.isEnabled()) {
    await fieldStore.ensureReady({
      tracks: nextTracks,
      visits: nextVisits,
      checkins: nextCheckins
    });
    const [dbTracks, dbVisits, dbCheckins] = await Promise.all([
      fieldStore.listTracks({}),
      fieldStore.listVisits({}),
      fieldStore.listCheckins({})
    ]);
    await fieldStore.replaceAll({
      tracks: mergeById(dbTracks, demo.tracks),
      visits: mergeById(dbVisits, demo.visits),
      checkins: mergeById(dbCheckins, demo.checkins)
    });
    databaseUpdated = true;
  }

  console.log(JSON.stringify({
    ok: true,
    dateKey: demo.dateKey,
    local: {
      tracks: demo.tracks.length,
      visits: demo.visits.length,
      checkins: demo.checkins.length
    },
    databaseUpdated
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
