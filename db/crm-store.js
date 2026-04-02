const { ensureSchema, getSql, isDatabaseEnabled } = require("./neon");

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createCrmStore() {
  let ready = false;
  let readyPromise = null;

  async function ensureCrmSchema() {
    if (!isDatabaseEnabled()) return false;
    await ensureSchema();
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS customer_records (
        id TEXT PRIMARY KEY,
        archive_no TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        sales_person_id TEXT NOT NULL DEFAULT '',
        sales_person_name TEXT NOT NULL DEFAULT '',
        customer_type TEXT NOT NULL DEFAULT 'end_customer',
        archived BOOLEAN NOT NULL DEFAULT FALSE,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS customer_records_phone_idx ON customer_records (phone)`;
    await sql`CREATE INDEX IF NOT EXISTS customer_records_sales_idx ON customer_records (sales_person_id, sales_person_name)`;
    await sql`
      CREATE TABLE IF NOT EXISTS invoice_records (
        id TEXT PRIMARY KEY,
        invoice_no TEXT NOT NULL DEFAULT '',
        quote_id TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        customer_phone TEXT NOT NULL DEFAULT '',
        sales_person_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'issued',
        amount INTEGER NOT NULL DEFAULT 0,
        issued_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS invoice_records_customer_idx ON invoice_records (customer_phone, customer_name)`;
    await sql`CREATE INDEX IF NOT EXISTS invoice_records_sales_idx ON invoice_records (sales_person_name, status)`;
    await sql`CREATE INDEX IF NOT EXISTS invoice_records_issued_idx ON invoice_records (issued_at DESC)`;
    return true;
  }

  async function hasAnyData() {
    const sql = getSql();
    const [customers, invoices] = await Promise.all([
      sql`SELECT EXISTS(SELECT 1 FROM customer_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM invoice_records LIMIT 1) AS has_items`
    ]);
    return Boolean(customers[0]?.has_items || invoices[0]?.has_items);
  }

  async function upsertCustomer(item = {}) {
    const sql = getSql();
    const payload = cloneJson(item);
    await sql`
      INSERT INTO customer_records (
        id, archive_no, name, phone, email, sales_person_id, sales_person_name, customer_type, archived, payload, updated_at
      )
      VALUES (
        ${String(payload.id || "").trim()},
        ${String(payload.archiveNo || "").trim()},
        ${String(payload.name || "").trim()},
        ${String(payload.phone || "").trim()},
        ${String(payload.email || "").trim()},
        ${String(payload.salesPersonId || "").trim()},
        ${String(payload.salesPersonName || "").trim()},
        ${String(payload.customerType || "end_customer").trim()},
        ${Boolean(payload.archived || payload.archivedAt)},
        ${JSON.stringify(payload)}::jsonb,
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        archive_no = EXCLUDED.archive_no,
        name = EXCLUDED.name,
        phone = EXCLUDED.phone,
        email = EXCLUDED.email,
        sales_person_id = EXCLUDED.sales_person_id,
        sales_person_name = EXCLUDED.sales_person_name,
        customer_type = EXCLUDED.customer_type,
        archived = EXCLUDED.archived,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  async function upsertInvoice(item = {}) {
    const sql = getSql();
    const payload = cloneJson(item);
    const issuedAt = String(payload.issuedAt || payload.createdAt || "").trim();
    await sql`
      INSERT INTO invoice_records (
        id, invoice_no, quote_id, customer_name, customer_phone, sales_person_name, status, amount, issued_at, payload, updated_at
      )
      VALUES (
        ${String(payload.id || "").trim()},
        ${String(payload.invoiceNo || "").trim()},
        ${String(payload.quoteId || "").trim()},
        ${String(payload.customerName || payload.customer?.name || "").trim()},
        ${String(payload.customerPhone || payload.customer?.phone || "").trim()},
        ${String(payload.salesPersonName || "").trim()},
        ${String(payload.status || "issued").trim()},
        ${Math.max(0, Math.round(Number(payload.amount || 0) || 0))},
        ${issuedAt || null},
        ${JSON.stringify(payload)}::jsonb,
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        invoice_no = EXCLUDED.invoice_no,
        quote_id = EXCLUDED.quote_id,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        sales_person_name = EXCLUDED.sales_person_name,
        status = EXCLUDED.status,
        amount = EXCLUDED.amount,
        issued_at = EXCLUDED.issued_at,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  async function seedFromDocuments(seed = {}) {
    if (await hasAnyData()) return;
    const customers = Array.isArray(seed.customers) ? seed.customers : [];
    const invoices = Array.isArray(seed.invoices) ? seed.invoices : [];
    for (const item of customers) await upsertCustomer(item);
    for (const item of invoices) await upsertInvoice(item);
  }

  async function ensureReady(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    if (ready) return true;
    if (!readyPromise) {
      readyPromise = (async () => {
        await ensureCrmSchema();
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

  async function listCustomers() {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    const rows = await sql`
      SELECT payload
      FROM customer_records
      ORDER BY updated_at DESC, name ASC
    `;
    return rows.map((row) => cloneJson(row.payload));
  }

  async function listInvoices() {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    const rows = await sql`
      SELECT payload
      FROM invoice_records
      ORDER BY issued_at DESC NULLS LAST, updated_at DESC
    `;
    return rows.map((row) => cloneJson(row.payload));
  }

  async function replaceAll(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    await ensureReady();
    const sql = getSql();
    await sql`DELETE FROM customer_records`;
    await sql`DELETE FROM invoice_records`;
    await seedFromDocuments(seed);
    return true;
  }

  return {
    isEnabled: isDatabaseEnabled,
    ensureReady,
    listCustomers,
    listInvoices,
    upsertCustomer,
    upsertInvoice,
    replaceAll
  };
}

module.exports = {
  createCrmStore
};
