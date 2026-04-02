const { ensureSchema, getSql, isDatabaseEnabled } = require("./neon");

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function normalizeTrack(track = {}) {
  return {
    id: String(track.id || "").trim(),
    userId: String(track.userId || "").trim(),
    date: String(track.date || "").trim(),
    startedAt: String(track.startedAt || "").trim(),
    endedAt: String(track.endedAt || "").trim(),
    points: Array.isArray(track.points) ? track.points.map((point) => ({
      lat: Number(point.lat),
      lng: Number(point.lng),
      accuracy: Number(point.accuracy || 0),
      ts: String(point.ts || "").trim()
    })) : []
  };
}

function normalizeVisit(visit = {}) {
  return {
    id: String(visit.id || "").trim(),
    userId: String(visit.userId || "").trim(),
    customer: String(visit.customer || "").trim(),
    note: String(visit.note || "").trim(),
    lat: visit.lat == null ? null : Number(visit.lat),
    lng: visit.lng == null ? null : Number(visit.lng),
    accuracy: Number(visit.accuracy || 0),
    address: String(visit.address || "").trim(),
    audioUrl: String(visit.audioUrl || "").trim(),
    photoUrls: Array.isArray(visit.photoUrls) ? visit.photoUrls.map((item) => String(item || "").trim()).filter(Boolean) : [],
    recordedAt: String(visit.recordedAt || "").trim()
  };
}

function normalizeCheckin(item = {}) {
  return {
    id: String(item.id || "").trim(),
    userId: String(item.userId || "").trim(),
    action: item.action === "out" ? "out" : "in",
    lat: Number(item.lat),
    lng: Number(item.lng),
    accuracy: Number(item.accuracy || 0),
    note: String(item.note || "").trim(),
    ts: String(item.ts || "").trim(),
    date: String(item.date || "").trim()
  };
}

function mapTrackRows(rows = [], pointRows = []) {
  const pointsByTrackId = pointRows.reduce((acc, row) => {
    const trackId = String(row.track_id || "").trim();
    if (!trackId) return acc;
    if (!acc.has(trackId)) acc.set(trackId, []);
    acc.get(trackId).push({
      lat: Number(row.lat),
      lng: Number(row.lng),
      accuracy: Number(row.accuracy || 0),
      ts: row.ts ? new Date(row.ts).toISOString() : ""
    });
    return acc;
  }, new Map());

  return rows.map((row) => ({
    id: String(row.id || "").trim(),
    userId: String(row.user_id || "").trim(),
    date: String(row.date_key || "").trim(),
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : "",
    endedAt: row.ended_at ? new Date(row.ended_at).toISOString() : "",
    points: pointsByTrackId.get(String(row.id || "").trim()) || []
  }));
}

function createFieldStore() {
  let ready = false;
  let readyPromise = null;

  async function ensureFieldSchema() {
    if (!isDatabaseEnabled()) return false;
    await ensureSchema();
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS field_track_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date_key TEXT NOT NULL,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS field_track_sessions_user_date_idx ON field_track_sessions (user_id, date_key)`;
    await sql`
      CREATE TABLE IF NOT EXISTS field_track_points (
        id BIGSERIAL PRIMARY KEY,
        track_id TEXT NOT NULL REFERENCES field_track_sessions(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
        ts TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS field_track_points_track_idx ON field_track_points (track_id, position)`;
    await sql`
      CREATE TABLE IF NOT EXISTS field_visits_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        customer TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
        address TEXT NOT NULL DEFAULT '',
        audio_url TEXT NOT NULL DEFAULT '',
        photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
        recorded_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS field_visits_user_recorded_idx ON field_visits_records (user_id, recorded_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS field_checkins_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        accuracy DOUBLE PRECISION NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        ts TIMESTAMPTZ NOT NULL,
        date_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS field_checkins_user_date_idx ON field_checkins_records (user_id, date_key, ts DESC)`;
    return true;
  }

  async function hasAnyFieldData() {
    const sql = getSql();
    const [tracks, visits, checkins] = await Promise.all([
      sql`SELECT EXISTS(SELECT 1 FROM field_track_sessions LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM field_visits_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM field_checkins_records LIMIT 1) AS has_items`
    ]);
    return Boolean(tracks[0]?.has_items || visits[0]?.has_items || checkins[0]?.has_items);
  }

  async function insertTrack(track = {}) {
    const sql = getSql();
    const normalized = normalizeTrack(track);
    if (!normalized.id || !normalized.userId || !normalized.date || !normalized.startedAt) return;
    await sql`
      INSERT INTO field_track_sessions (id, user_id, date_key, started_at, ended_at)
      VALUES (${normalized.id}, ${normalized.userId}, ${normalized.date}, ${normalized.startedAt}, ${normalized.endedAt || null})
      ON CONFLICT (id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        date_key = EXCLUDED.date_key,
        started_at = EXCLUDED.started_at,
        ended_at = EXCLUDED.ended_at
    `;
    await sql`DELETE FROM field_track_points WHERE track_id = ${normalized.id}`;
    for (let index = 0; index < normalized.points.length; index += 1) {
      const point = normalized.points[index];
      await sql`
        INSERT INTO field_track_points (track_id, position, lat, lng, accuracy, ts)
        VALUES (${normalized.id}, ${index + 1}, ${point.lat}, ${point.lng}, ${point.accuracy}, ${point.ts})
      `;
    }
  }

  async function insertVisit(visit = {}) {
    const sql = getSql();
    const normalized = normalizeVisit(visit);
    if (!normalized.id || !normalized.userId || !normalized.customer || !normalized.recordedAt) return;
    await sql`
      INSERT INTO field_visits_records (id, user_id, customer, note, lat, lng, accuracy, address, audio_url, photo_urls, recorded_at)
      VALUES (
        ${normalized.id},
        ${normalized.userId},
        ${normalized.customer},
        ${normalized.note},
        ${normalized.lat},
        ${normalized.lng},
        ${normalized.accuracy},
        ${normalized.address},
        ${normalized.audioUrl},
        ${JSON.stringify(normalized.photoUrls)}::jsonb,
        ${normalized.recordedAt}
      )
      ON CONFLICT (id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        customer = EXCLUDED.customer,
        note = EXCLUDED.note,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        accuracy = EXCLUDED.accuracy,
        address = EXCLUDED.address,
        audio_url = EXCLUDED.audio_url,
        photo_urls = EXCLUDED.photo_urls,
        recorded_at = EXCLUDED.recorded_at
    `;
  }

  async function insertCheckin(item = {}) {
    const sql = getSql();
    const normalized = normalizeCheckin(item);
    if (!normalized.id || !normalized.userId || !normalized.ts || !normalized.date) return;
    await sql`
      INSERT INTO field_checkins_records (id, user_id, action, lat, lng, accuracy, note, ts, date_key)
      VALUES (
        ${normalized.id},
        ${normalized.userId},
        ${normalized.action},
        ${normalized.lat},
        ${normalized.lng},
        ${normalized.accuracy},
        ${normalized.note},
        ${normalized.ts},
        ${normalized.date}
      )
      ON CONFLICT (id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        action = EXCLUDED.action,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        accuracy = EXCLUDED.accuracy,
        note = EXCLUDED.note,
        ts = EXCLUDED.ts,
        date_key = EXCLUDED.date_key
    `;
  }

  async function seedFromDocuments(seed = {}) {
    if (await hasAnyFieldData()) return;
    const tracks = Array.isArray(seed.tracks) ? seed.tracks : [];
    const visits = Array.isArray(seed.visits) ? seed.visits : [];
    const checkins = Array.isArray(seed.checkins) ? seed.checkins : [];
    for (const track of tracks) await insertTrack(track);
    for (const visit of visits) await insertVisit(visit);
    for (const item of checkins) await insertCheckin(item);
  }

  async function ensureReady(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    if (ready) return true;
    if (!readyPromise) {
      readyPromise = (async () => {
        await ensureFieldSchema();
        await seedFromDocuments(seed);
        ready = true;
        return true;
      })().catch((error) => {
        readyPromise = null;
        throw error;
      });
    }
    return readyPromise;
  }

  async function listCheckins({ userId = "", dateKey = "" } = {}) {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    let rows;
    if (userId && dateKey) {
      rows = await sql`
        SELECT id, user_id, action, lat, lng, accuracy, note, ts, date_key
        FROM field_checkins_records
        WHERE user_id = ${userId} AND date_key = ${dateKey}
        ORDER BY ts DESC
      `;
    } else if (userId) {
      rows = await sql`
        SELECT id, user_id, action, lat, lng, accuracy, note, ts, date_key
        FROM field_checkins_records
        WHERE user_id = ${userId}
        ORDER BY ts DESC
      `;
    } else if (dateKey) {
      rows = await sql`
        SELECT id, user_id, action, lat, lng, accuracy, note, ts, date_key
        FROM field_checkins_records
        WHERE date_key = ${dateKey}
        ORDER BY ts DESC
      `;
    } else {
      rows = await sql`
        SELECT id, user_id, action, lat, lng, accuracy, note, ts, date_key
        FROM field_checkins_records
        ORDER BY ts DESC
      `;
    }
    return rows.map((row) => ({
      id: String(row.id || "").trim(),
      userId: String(row.user_id || "").trim(),
      action: row.action === "out" ? "out" : "in",
      lat: Number(row.lat),
      lng: Number(row.lng),
      accuracy: Number(row.accuracy || 0),
      note: String(row.note || "").trim(),
      ts: row.ts ? new Date(row.ts).toISOString() : "",
      date: String(row.date_key || "").trim()
    }));
  }

  async function listVisits({ userId = "", dateKey = "" } = {}) {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    let rows;
    if (userId && dateKey) {
      rows = await sql`
        SELECT id, user_id, customer, note, lat, lng, accuracy, address, audio_url, photo_urls, recorded_at
        FROM field_visits_records
        WHERE user_id = ${userId} AND recorded_at::date = ${dateKey}::date
        ORDER BY recorded_at DESC
      `;
    } else if (userId) {
      rows = await sql`
        SELECT id, user_id, customer, note, lat, lng, accuracy, address, audio_url, photo_urls, recorded_at
        FROM field_visits_records
        WHERE user_id = ${userId}
        ORDER BY recorded_at DESC
      `;
    } else if (dateKey) {
      rows = await sql`
        SELECT id, user_id, customer, note, lat, lng, accuracy, address, audio_url, photo_urls, recorded_at
        FROM field_visits_records
        WHERE recorded_at::date = ${dateKey}::date
        ORDER BY recorded_at DESC
      `;
    } else {
      rows = await sql`
        SELECT id, user_id, customer, note, lat, lng, accuracy, address, audio_url, photo_urls, recorded_at
        FROM field_visits_records
        ORDER BY recorded_at DESC
      `;
    }
    return rows.map((row) => ({
      id: String(row.id || "").trim(),
      userId: String(row.user_id || "").trim(),
      customer: String(row.customer || "").trim(),
      note: String(row.note || "").trim(),
      lat: row.lat == null ? null : Number(row.lat),
      lng: row.lng == null ? null : Number(row.lng),
      accuracy: Number(row.accuracy || 0),
      address: String(row.address || "").trim(),
      audioUrl: String(row.audio_url || "").trim(),
      photoUrls: Array.isArray(row.photo_urls) ? row.photo_urls.map((item) => String(item || "").trim()).filter(Boolean) : [],
      recordedAt: row.recorded_at ? new Date(row.recorded_at).toISOString() : ""
    }));
  }

  async function listTracks({ userId = "", dateKey = "" } = {}) {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    let rows;
    if (userId && dateKey) {
      rows = await sql`
        SELECT id, user_id, date_key, started_at, ended_at
        FROM field_track_sessions
        WHERE user_id = ${userId} AND date_key = ${dateKey}
        ORDER BY started_at DESC
      `;
    } else if (userId) {
      rows = await sql`
        SELECT id, user_id, date_key, started_at, ended_at
        FROM field_track_sessions
        WHERE user_id = ${userId}
        ORDER BY started_at DESC
      `;
    } else if (dateKey) {
      rows = await sql`
        SELECT id, user_id, date_key, started_at, ended_at
        FROM field_track_sessions
        WHERE date_key = ${dateKey}
        ORDER BY started_at DESC
      `;
    } else {
      rows = await sql`
        SELECT id, user_id, date_key, started_at, ended_at
        FROM field_track_sessions
        ORDER BY started_at DESC
      `;
    }
    if (!rows.length) return [];
    const trackIds = rows.map((row) => String(row.id || "").trim()).filter(Boolean);
    const pointRows = await sql`
      SELECT track_id, position, lat, lng, accuracy, ts
      FROM field_track_points
      WHERE track_id = ANY(${trackIds})
      ORDER BY track_id ASC, position ASC
    `;
    return mapTrackRows(rows, pointRows);
  }

  async function addCheckin(item = {}) {
    if (!isDatabaseEnabled()) return cloneJson(item);
    await ensureReady();
    await insertCheckin(item);
    return cloneJson(normalizeCheckin(item));
  }

  async function addVisit(item = {}) {
    if (!isDatabaseEnabled()) return cloneJson(item);
    await ensureReady();
    await insertVisit(item);
    return cloneJson(normalizeVisit(item));
  }

  async function appendTrackPoint({ trackId = "", userId = "", dateKey = "", startedAt = "", point = {} } = {}) {
    if (!isDatabaseEnabled()) return null;
    await ensureReady();
    const sql = getSql();
    let rows = await sql`
      SELECT id, user_id, date_key, started_at, ended_at
      FROM field_track_sessions
      WHERE user_id = ${userId} AND date_key = ${dateKey}
      ORDER BY started_at DESC
      LIMIT 1
    `;
    let track = rows[0] || null;
    const nextTrackId = String(trackId || (track?.id || "")).trim() || `trk-${Date.now()}`;
    const pointTs = String(point.ts || startedAt || new Date().toISOString()).trim();
    if (!track) {
      await sql`
        INSERT INTO field_track_sessions (id, user_id, date_key, started_at, ended_at)
        VALUES (${nextTrackId}, ${userId}, ${dateKey}, ${startedAt || pointTs}, NULL)
      `;
      rows = await sql`
        SELECT id, user_id, date_key, started_at, ended_at
        FROM field_track_sessions
        WHERE id = ${nextTrackId}
        LIMIT 1
      `;
      track = rows[0] || null;
    }
    const positionRows = await sql`
      SELECT COALESCE(MAX(position), 0) AS max_position
      FROM field_track_points
      WHERE track_id = ${track.id}
    `;
    const nextPosition = Number(positionRows[0]?.max_position || 0) + 1;
    await sql`
      INSERT INTO field_track_points (track_id, position, lat, lng, accuracy, ts)
      VALUES (${track.id}, ${nextPosition}, ${Number(point.lat)}, ${Number(point.lng)}, ${Number(point.accuracy || 0)}, ${pointTs})
    `;
    const items = await listTracks({ userId, dateKey });
    return items.find((item) => item.id === String(track.id || "").trim()) || null;
  }

  async function closeTrack({ userId = "", dateKey = "", endedAt = "" } = {}) {
    if (!isDatabaseEnabled()) return null;
    await ensureReady();
    const sql = getSql();
    const rows = await sql`
      SELECT id
      FROM field_track_sessions
      WHERE user_id = ${userId} AND date_key = ${dateKey}
      ORDER BY started_at DESC
      LIMIT 1
    `;
    const trackId = String(rows[0]?.id || "").trim();
    if (!trackId) return null;
    await sql`
      UPDATE field_track_sessions
      SET ended_at = ${endedAt || new Date().toISOString()}
      WHERE id = ${trackId}
    `;
    const items = await listTracks({ userId, dateKey });
    return items.find((item) => item.id === trackId) || null;
  }

  async function replaceAll(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    await ensureReady();
    const sql = getSql();
    await sql`DELETE FROM field_track_points`;
    await sql`DELETE FROM field_track_sessions`;
    await sql`DELETE FROM field_visits_records`;
    await sql`DELETE FROM field_checkins_records`;
    await seedFromDocuments(seed);
    return true;
  }

  return {
    isEnabled: isDatabaseEnabled,
    ensureReady,
    listCheckins,
    listVisits,
    listTracks,
    addCheckin,
    addVisit,
    appendTrackPoint,
    closeTrack,
    replaceAll
  };
}

module.exports = {
  createFieldStore
};
