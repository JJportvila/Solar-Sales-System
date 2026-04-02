const fs = require("fs");

const { ensureSchema, getSql, isDatabaseEnabled } = require("./neon");

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createDocumentStore(registry = {}) {
  const cache = new Map();
  const keyToFilePath = new Map();
  Object.entries(registry).forEach(([filePath, config]) => {
    keyToFilePath.set(config.key, filePath);
  });

  let hydrated = false;
  let hydratePromise = null;

  function getRegistryEntry(filePath) {
    return registry[filePath] || null;
  }

  function readLocalFile(filePath, fallback) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (_error) {
      return cloneJson(fallback);
    }
  }

  function getFallback(filePath, fallback) {
    if (fallback !== undefined) return cloneJson(fallback);
    const entry = getRegistryEntry(filePath);
    return cloneJson(entry?.fallback);
  }

  async function hydrateFromDatabase() {
    if (!isDatabaseEnabled()) {
      hydrated = true;
      return;
    }
    await ensureSchema();
    const sql = getSql();
    const documentKeys = Array.from(keyToFilePath.keys());
    if (!documentKeys.length) {
      hydrated = true;
      return;
    }

    const existingRows = await sql`
      SELECT document_key, payload
      FROM app_json_documents
      WHERE document_key = ANY(${documentKeys})
    `;
    const existingMap = new Map(existingRows.map((row) => [row.document_key, row.payload]));

    for (const [filePath, config] of Object.entries(registry)) {
      if (existingMap.has(config.key)) {
        cache.set(filePath, cloneJson(existingMap.get(config.key)));
        continue;
      }
      const seed = readLocalFile(filePath, config.fallback);
      cache.set(filePath, cloneJson(seed));
      await sql`
        INSERT INTO app_json_documents (document_key, payload, updated_at)
        VALUES (${config.key}, ${JSON.stringify(seed)}::jsonb, NOW())
        ON CONFLICT (document_key) DO NOTHING
      `;
    }

    hydrated = true;
  }

  function ensureHydrated() {
    if (hydrated || !isDatabaseEnabled()) {
      hydrated = true;
      return Promise.resolve();
    }
    if (!hydratePromise) {
      hydratePromise = hydrateFromDatabase().catch((error) => {
        hydratePromise = null;
        throw error;
      });
    }
    return hydratePromise;
  }

  function read(filePath, fallback) {
    if (cache.has(filePath)) {
      return cloneJson(cache.get(filePath));
    }
    const value = readLocalFile(filePath, getFallback(filePath, fallback));
    cache.set(filePath, cloneJson(value));
    return cloneJson(value);
  }

  async function persist(filePath, value) {
    const entry = getRegistryEntry(filePath);
    if (!entry || !isDatabaseEnabled()) return;
    await ensureHydrated();
    const sql = getSql();
    await sql`
      INSERT INTO app_json_documents (document_key, payload, updated_at)
      VALUES (${entry.key}, ${JSON.stringify(value)}::jsonb, NOW())
      ON CONFLICT (document_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `;
  }

  function write(filePath, value) {
    const nextValue = cloneJson(value);
    cache.set(filePath, nextValue);
    if (!process.env.VERCEL) {
      fs.writeFileSync(filePath, JSON.stringify(nextValue, null, 2), "utf8");
    }
    persist(filePath, nextValue).catch((error) => {
      console.error(`[db] Failed to persist ${filePath}:`, error);
    });
  }

  return {
    ensureHydrated,
    read,
    write
  };
}

module.exports = {
  createDocumentStore
};
