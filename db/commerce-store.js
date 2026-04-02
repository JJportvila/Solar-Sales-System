const { ensureSchema, getSql, isDatabaseEnabled } = require("./neon");

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createCommerceStore() {
  let ready = false;
  let readyPromise = null;

  async function ensureCommerceSchema() {
    if (!isDatabaseEnabled()) return false;
    await ensureSchema();
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS vendor_records (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        region TEXT NOT NULL DEFAULT '',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS vendor_records_region_idx ON vendor_records (region, is_active)`;
    await sql`
      CREATE TABLE IF NOT EXISTS vendor_order_records (
        id TEXT PRIMARY KEY,
        vendor_id TEXT NOT NULL DEFAULT '',
        vendor_name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending',
        currency TEXT NOT NULL DEFAULT 'CNY',
        total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS vendor_order_records_vendor_idx ON vendor_order_records (vendor_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS vendor_order_records_status_idx ON vendor_order_records (status, created_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS wholesale_order_records (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL DEFAULT '',
        merchant_name TEXT NOT NULL DEFAULT '',
        sales_person_id TEXT NOT NULL DEFAULT '',
        package_id TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'pending_payment',
        total_vt INTEGER NOT NULL DEFAULT 0,
        paid_amount_vt INTEGER NOT NULL DEFAULT 0,
        balance_amount_vt INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS wholesale_order_records_merchant_idx ON wholesale_order_records (merchant_id, created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS wholesale_order_records_sales_idx ON wholesale_order_records (sales_person_id, status)`;
    return true;
  }

  async function hasAnyData() {
    const sql = getSql();
    const [vendors, vendorOrders, wholesaleOrders] = await Promise.all([
      sql`SELECT EXISTS(SELECT 1 FROM vendor_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM vendor_order_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM wholesale_order_records LIMIT 1) AS has_items`
    ]);
    return Boolean(vendors[0]?.has_items || vendorOrders[0]?.has_items || wholesaleOrders[0]?.has_items);
  }

  async function upsertVendor(item = {}) {
    const sql = getSql();
    const payload = cloneJson(item);
    await sql`
      INSERT INTO vendor_records (id, name, region, is_active, payload, updated_at)
      VALUES (
        ${String(payload.id || "").trim()},
        ${String(payload.name || "").trim()},
        ${String(payload.region || "").trim()},
        ${payload.isActive !== false},
        ${JSON.stringify(payload)}::jsonb,
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        region = EXCLUDED.region,
        is_active = EXCLUDED.is_active,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  async function upsertVendorOrder(item = {}) {
    const sql = getSql();
    const payload = cloneJson(item);
    await sql`
      INSERT INTO vendor_order_records (id, vendor_id, vendor_name, status, currency, total_amount, created_at, payload, updated_at)
      VALUES (
        ${String(payload.id || "").trim()},
        ${String(payload.vendorId || "").trim()},
        ${String(payload.vendorName || "").trim()},
        ${String(payload.status || "pending").trim()},
        ${String(payload.currency || "CNY").trim()},
        ${Number(Number(payload.totalAmount || 0).toFixed(2))},
        ${String(payload.createdAt || "").trim() || null},
        ${JSON.stringify(payload)}::jsonb,
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        vendor_id = EXCLUDED.vendor_id,
        vendor_name = EXCLUDED.vendor_name,
        status = EXCLUDED.status,
        currency = EXCLUDED.currency,
        total_amount = EXCLUDED.total_amount,
        created_at = EXCLUDED.created_at,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  async function upsertWholesaleOrder(item = {}) {
    const sql = getSql();
    const payload = cloneJson(item);
    await sql`
      INSERT INTO wholesale_order_records (
        id, merchant_id, merchant_name, sales_person_id, package_id, status, total_vt, paid_amount_vt, balance_amount_vt, created_at, payload, updated_at
      )
      VALUES (
        ${String(payload.id || "").trim()},
        ${String(payload.merchantId || "").trim()},
        ${String(payload.merchantName || "").trim()},
        ${String(payload.salesPersonId || "").trim()},
        ${String(payload.packageId || "").trim()},
        ${String(payload.status || "pending_payment").trim()},
        ${Math.max(0, Math.round(Number(payload.totalVt || 0) || 0))},
        ${Math.max(0, Math.round(Number(payload.paidAmountVt || 0) || 0))},
        ${Math.max(0, Math.round(Number(payload.balanceAmountVt || 0) || 0))},
        ${String(payload.createdAt || "").trim() || null},
        ${JSON.stringify(payload)}::jsonb,
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        merchant_id = EXCLUDED.merchant_id,
        merchant_name = EXCLUDED.merchant_name,
        sales_person_id = EXCLUDED.sales_person_id,
        package_id = EXCLUDED.package_id,
        status = EXCLUDED.status,
        total_vt = EXCLUDED.total_vt,
        paid_amount_vt = EXCLUDED.paid_amount_vt,
        balance_amount_vt = EXCLUDED.balance_amount_vt,
        created_at = EXCLUDED.created_at,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  async function replaceVendorData(seed = {}) {
    const sql = getSql();
    const items = Array.isArray(seed.items) ? seed.items : [];
    const orders = Array.isArray(seed.orders) ? seed.orders : [];
    await sql`DELETE FROM vendor_records`;
    await sql`DELETE FROM vendor_order_records`;
    for (const item of items) await upsertVendor(item);
    for (const item of orders) await upsertVendorOrder(item);
  }

  async function replaceWholesaleOrders(items = []) {
    const sql = getSql();
    const rows = Array.isArray(items) ? items : [];
    await sql`DELETE FROM wholesale_order_records`;
    for (const item of rows) await upsertWholesaleOrder(item);
  }

  async function seedFromDocuments(seed = {}) {
    if (await hasAnyData()) return;
    await replaceVendorData(seed.vendors || {});
    await replaceWholesaleOrders(seed.wholesaleOrders || []);
  }

  async function ensureReady(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    if (ready) return true;
    if (!readyPromise) {
      readyPromise = (async () => {
        await ensureCommerceSchema();
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

  async function listVendors() {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    const rows = await sql`
      SELECT payload
      FROM vendor_records
      ORDER BY updated_at DESC, name ASC
    `;
    return rows.map((row) => cloneJson(row.payload));
  }

  async function listVendorOrders() {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    const rows = await sql`
      SELECT payload
      FROM vendor_order_records
      ORDER BY created_at DESC NULLS LAST, updated_at DESC
    `;
    return rows.map((row) => cloneJson(row.payload));
  }

  async function listWholesaleOrders() {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    const rows = await sql`
      SELECT payload
      FROM wholesale_order_records
      ORDER BY created_at DESC NULLS LAST, updated_at DESC
    `;
    return rows.map((row) => cloneJson(row.payload));
  }

  async function replaceAll(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    await ensureReady();
    await replaceVendorData(seed.vendors || {});
    await replaceWholesaleOrders(seed.wholesaleOrders || []);
    return true;
  }

  return {
    isEnabled: isDatabaseEnabled,
    ensureReady,
    listVendors,
    listVendorOrders,
    replaceVendorData,
    upsertVendor,
    upsertVendorOrder,
    listWholesaleOrders,
    replaceWholesaleOrders,
    upsertWholesaleOrder,
    replaceAll
  };
}

module.exports = {
  createCommerceStore
};
