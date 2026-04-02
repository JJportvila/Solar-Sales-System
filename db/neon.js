const { neon } = require("@neondatabase/serverless");

const DATABASE_URL = String(process.env.DATABASE_URL || process.env.POSTGRES_URL || "").trim();

let sqlClient = null;

function isDatabaseEnabled() {
  return Boolean(DATABASE_URL);
}

function getSql() {
  if (!isDatabaseEnabled()) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!sqlClient) {
    sqlClient = neon(DATABASE_URL);
  }
  return sqlClient;
}

async function ensureSchema() {
  if (!isDatabaseEnabled()) return false;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS app_json_documents (
      document_key TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  return true;
}

module.exports = {
  isDatabaseEnabled,
  getSql,
  ensureSchema
};
