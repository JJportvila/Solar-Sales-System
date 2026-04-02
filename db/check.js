const { ensureSchema, getSql, isDatabaseEnabled } = require("./neon");

async function main() {
  if (!isDatabaseEnabled()) {
    throw new Error("DATABASE_URL is not configured");
  }
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`SELECT NOW() AS now`;
  console.log(JSON.stringify({ ok: true, now: rows[0]?.now || null }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
