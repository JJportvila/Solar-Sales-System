const { ensureSchema, getSql, isDatabaseEnabled } = require("./neon");

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createBusinessStore() {
  let ready = false;
  let readyPromise = null;

  async function ensureBusinessSchema() {
    if (!isDatabaseEnabled()) return false;
    await ensureSchema();
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS employee_records (
        id TEXT PRIMARY KEY,
        employee_no TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'engineer',
        status TEXT NOT NULL DEFAULT 'active',
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS employee_records_role_idx ON employee_records (role, status)`;
    await sql`
      CREATE TABLE IF NOT EXISTS employee_meta_documents (
        document_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS quote_records (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL DEFAULT '',
        customer_phone TEXT NOT NULL DEFAULT '',
        sales_person_id TEXT NOT NULL DEFAULT '',
        sales_person_name TEXT NOT NULL DEFAULT '',
        package_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        total INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS quote_records_sales_idx ON quote_records (sales_person_id, sales_person_name, status)`;
    await sql`CREATE INDEX IF NOT EXISTS quote_records_customer_idx ON quote_records (customer_phone, customer_name)`;
    await sql`CREATE INDEX IF NOT EXISTS quote_records_created_idx ON quote_records (created_at DESC)`;
    return true;
  }

  async function hasAnyData() {
    const sql = getSql();
    const [employees, quotes] = await Promise.all([
      sql`SELECT EXISTS(SELECT 1 FROM employee_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM quote_records LIMIT 1) AS has_items`
    ]);
    return Boolean(employees[0]?.has_items || quotes[0]?.has_items);
  }

  async function upsertEmployee(item = {}) {
    const sql = getSql();
    const payload = cloneJson(item);
    await sql`
      INSERT INTO employee_records (id, employee_no, name, role, status, payload, updated_at)
      VALUES (
        ${String(payload.id || "").trim()},
        ${String(payload.employeeNo || "").trim()},
        ${String(payload.name || "").trim()},
        ${String(payload.role || "engineer").trim()},
        ${String(payload.status || "active").trim()},
        ${JSON.stringify(payload)}::jsonb,
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        employee_no = EXCLUDED.employee_no,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  async function saveEmployeeMeta(documentKey = "", payload = {}) {
    const sql = getSql();
    const key = String(documentKey || "").trim();
    if (!key) return;
    await sql`
      INSERT INTO employee_meta_documents (document_key, payload, updated_at)
      VALUES (${key}, ${JSON.stringify(payload)}::jsonb, NOW())
      ON CONFLICT (document_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `;
  }

  async function upsertQuote(item = {}) {
    const sql = getSql();
    const payload = cloneJson(item);
    const customer = payload.customer && typeof payload.customer === "object" ? payload.customer : {};
    await sql`
      INSERT INTO quote_records (
        id, customer_name, customer_phone, sales_person_id, sales_person_name, package_name, status, total, created_at, payload, updated_at
      )
      VALUES (
        ${String(payload.id || "").trim()},
        ${String(customer.name || payload.customerName || "").trim()},
        ${String(customer.phone || payload.customerPhone || "").trim()},
        ${String(payload.salesPersonId || "").trim()},
        ${String(payload.salesPersonName || payload.payload?.salesPerson?.name || "").trim()},
        ${String(payload.packageName || payload.payload?.recommendation?.packageName || "").trim()},
        ${String(payload.status || "draft").trim()},
        ${Math.max(0, Math.round(Number(payload.total || 0) || 0))},
        ${String(payload.createdAt || "").trim() || null},
        ${JSON.stringify(payload)}::jsonb,
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        sales_person_id = EXCLUDED.sales_person_id,
        sales_person_name = EXCLUDED.sales_person_name,
        package_name = EXCLUDED.package_name,
        status = EXCLUDED.status,
        total = EXCLUDED.total,
        created_at = EXCLUDED.created_at,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  async function seedFromDocuments(seed = {}) {
    if (await hasAnyData()) return;
    const employees = Array.isArray(seed.employees?.items) ? seed.employees.items : [];
    const monthlyTrend = Array.isArray(seed.employees?.monthlyTrend) ? seed.employees.monthlyTrend : [];
    const quotes = Array.isArray(seed.quotes) ? seed.quotes : [];
    for (const item of employees) await upsertEmployee(item);
    await saveEmployeeMeta("monthly_trend", monthlyTrend);
    for (const item of quotes) await upsertQuote(item);
  }

  async function ensureReady(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    if (ready) return true;
    if (!readyPromise) {
      readyPromise = (async () => {
        await ensureBusinessSchema();
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

  async function listEmployees() {
    if (!isDatabaseEnabled()) return { monthlyTrend: [], items: [] };
    await ensureReady();
    const sql = getSql();
    const [rows, metaRows] = await Promise.all([
      sql`SELECT payload FROM employee_records ORDER BY updated_at DESC, name ASC`,
      sql`SELECT payload FROM employee_meta_documents WHERE document_key = 'monthly_trend' LIMIT 1`
    ]);
    return {
      monthlyTrend: Array.isArray(metaRows[0]?.payload) ? cloneJson(metaRows[0].payload) : [],
      items: rows.map((row) => cloneJson(row.payload))
    };
  }

  async function listQuotes() {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    const rows = await sql`
      SELECT payload
      FROM quote_records
      ORDER BY created_at DESC NULLS LAST, updated_at DESC
    `;
    return rows.map((row) => cloneJson(row.payload));
  }

  async function replaceAll(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    await ensureReady();
    const sql = getSql();
    await sql`DELETE FROM employee_records`;
    await sql`DELETE FROM employee_meta_documents`;
    await sql`DELETE FROM quote_records`;
    await seedFromDocuments(seed);
    return true;
  }

  return {
    isEnabled: isDatabaseEnabled,
    ensureReady,
    listEmployees,
    listQuotes,
    upsertEmployee,
    saveEmployeeMeta,
    upsertQuote,
    replaceAll
  };
}

module.exports = {
  createBusinessStore
};
