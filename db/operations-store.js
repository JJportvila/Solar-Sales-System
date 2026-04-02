const { ensureSchema, getSql, isDatabaseEnabled } = require("./neon");

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createOperationsStore() {
  let ready = false;
  let readyPromise = null;

  async function ensureOperationsSchema() {
    if (!isDatabaseEnabled()) return false;
    await ensureSchema();
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_meta_documents (
        document_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_stock_records (
        id TEXT PRIMARY KEY,
        sku TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS inventory_stock_category_idx ON inventory_stock_records (category)`;
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_transaction_records (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL DEFAULT '',
        sku TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT '',
        timestamp TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS inventory_transaction_item_idx ON inventory_transaction_records (item_id, timestamp DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS inventory_purchase_order_records (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL DEFAULT '',
        sku TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS inventory_po_status_idx ON inventory_purchase_order_records (status, created_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS repair_order_records (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT '',
        priority TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        engineer_id TEXT NOT NULL DEFAULT '',
        engineer_name TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS repair_order_status_idx ON repair_order_records (status, updated_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS survey_booking_records (
        id TEXT PRIMARY KEY,
        island TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        engineer_id TEXT NOT NULL DEFAULT '',
        visit_date TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS survey_booking_status_idx ON survey_booking_records (status, updated_at DESC)`;
    return true;
  }

  async function hasAnyData() {
    const sql = getSql();
    const [inventory, repairs, surveys] = await Promise.all([
      sql`SELECT EXISTS(SELECT 1 FROM inventory_stock_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM repair_order_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM survey_booking_records LIMIT 1) AS has_items`
    ]);
    return Boolean(inventory[0]?.has_items || repairs[0]?.has_items || surveys[0]?.has_items);
  }

  async function replaceInventoryData(data = {}) {
    const sql = getSql();
    const stockItems = Array.isArray(data.stockItems) ? data.stockItems : [];
    const transactions = Array.isArray(data.transactions) ? data.transactions : [];
    const purchaseOrders = Array.isArray(data.purchaseOrders) ? data.purchaseOrders : [];
    await sql`DELETE FROM inventory_stock_records`;
    await sql`DELETE FROM inventory_transaction_records`;
    await sql`DELETE FROM inventory_purchase_order_records`;
    await sql`DELETE FROM inventory_meta_documents WHERE document_key = 'shipment'`;
    await sql`
      INSERT INTO inventory_meta_documents (document_key, payload, updated_at)
      VALUES ('shipment', ${JSON.stringify(data.shipment || {})}::jsonb, NOW())
    `;
    for (const item of stockItems) {
      await sql`
        INSERT INTO inventory_stock_records (id, sku, name, category, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.sku || "").trim()},
          ${String(item.name || "").trim()},
          ${String(item.category || "").trim()},
          ${JSON.stringify(item)}::jsonb,
          NOW()
        )
      `;
    }
    for (const item of transactions) {
      await sql`
        INSERT INTO inventory_transaction_records (id, item_id, sku, type, timestamp, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.itemId || "").trim()},
          ${String(item.sku || "").trim()},
          ${String(item.type || "").trim()},
          ${String(item.timestamp || "").trim() || null},
          ${JSON.stringify(item)}::jsonb,
          NOW()
        )
      `;
    }
    for (const item of purchaseOrders) {
      await sql`
        INSERT INTO inventory_purchase_order_records (id, item_id, sku, status, created_at, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.itemId || "").trim()},
          ${String(item.sku || "").trim()},
          ${String(item.status || "").trim()},
          ${String(item.createdAt || "").trim() || null},
          ${JSON.stringify(item)}::jsonb,
          NOW()
        )
      `;
    }
  }

  async function listInventoryData() {
    if (!isDatabaseEnabled()) return null;
    await ensureReady();
    const sql = getSql();
    const [metaRows, stockRows, transactionRows, purchaseOrderRows] = await Promise.all([
      sql`SELECT payload FROM inventory_meta_documents WHERE document_key = 'shipment' LIMIT 1`,
      sql`SELECT payload FROM inventory_stock_records ORDER BY updated_at DESC, name ASC`,
      sql`SELECT payload FROM inventory_transaction_records ORDER BY timestamp DESC NULLS LAST, updated_at DESC`,
      sql`SELECT payload FROM inventory_purchase_order_records ORDER BY created_at DESC NULLS LAST, updated_at DESC`
    ]);
    return {
      shipment: cloneJson(metaRows[0]?.payload || {}),
      stockItems: stockRows.map((row) => cloneJson(row.payload)),
      transactions: transactionRows.map((row) => cloneJson(row.payload)),
      purchaseOrders: purchaseOrderRows.map((row) => cloneJson(row.payload))
    };
  }

  async function replaceRepairOrders(items = []) {
    const sql = getSql();
    const rows = Array.isArray(items) ? items : [];
    await sql`DELETE FROM repair_order_records`;
    for (const item of rows) {
      await sql`
        INSERT INTO repair_order_records (id, status, priority, customer_name, engineer_id, engineer_name, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.status || "").trim()},
          ${String(item.priority || "").trim()},
          ${String(item.customer?.name || "").trim()},
          ${String(item.assignedEngineer?.id || "").trim()},
          ${String(item.assignedEngineer?.name || "").trim()},
          ${JSON.stringify(item)}::jsonb,
          NOW()
        )
      `;
    }
  }

  async function listRepairOrders() {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    const rows = await sql`
      SELECT payload
      FROM repair_order_records
      ORDER BY updated_at DESC
    `;
    return rows.map((row) => cloneJson(row.payload));
  }

  async function upsertRepairOrder(item = {}) {
    const sql = getSql();
    await sql`
      INSERT INTO repair_order_records (id, status, priority, customer_name, engineer_id, engineer_name, payload, updated_at)
      VALUES (
        ${String(item.id || "").trim()},
        ${String(item.status || "").trim()},
        ${String(item.priority || "").trim()},
        ${String(item.customer?.name || "").trim()},
        ${String(item.assignedEngineer?.id || "").trim()},
        ${String(item.assignedEngineer?.name || "").trim()},
        ${JSON.stringify(item)}::jsonb,
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        customer_name = EXCLUDED.customer_name,
        engineer_id = EXCLUDED.engineer_id,
        engineer_name = EXCLUDED.engineer_name,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  async function replaceSurveyBookings(items = []) {
    const sql = getSql();
    const rows = Array.isArray(items) ? items : [];
    await sql`DELETE FROM survey_booking_records`;
    for (const item of rows) {
      await sql`
        INSERT INTO survey_booking_records (id, island, status, customer_name, engineer_id, visit_date, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.island || "").trim()},
          ${String(item.status || "").trim()},
          ${String(item.customer?.name || "").trim()},
          ${String(item.scheduleTask?.engineerId || "").trim()},
          ${String(item.scheduleTask?.visitDate || item.preferredDate || "").trim()},
          ${JSON.stringify(item)}::jsonb,
          NOW()
        )
      `;
    }
  }

  async function listSurveyBookings() {
    if (!isDatabaseEnabled()) return [];
    await ensureReady();
    const sql = getSql();
    const rows = await sql`
      SELECT payload
      FROM survey_booking_records
      ORDER BY updated_at DESC
    `;
    return rows.map((row) => cloneJson(row.payload));
  }

  async function upsertSurveyBooking(item = {}) {
    const sql = getSql();
    await sql`
      INSERT INTO survey_booking_records (id, island, status, customer_name, engineer_id, visit_date, payload, updated_at)
      VALUES (
        ${String(item.id || "").trim()},
        ${String(item.island || "").trim()},
        ${String(item.status || "").trim()},
        ${String(item.customer?.name || "").trim()},
        ${String(item.scheduleTask?.engineerId || "").trim()},
        ${String(item.scheduleTask?.visitDate || item.preferredDate || "").trim()},
        ${JSON.stringify(item)}::jsonb,
        NOW()
      )
      ON CONFLICT (id)
      DO UPDATE SET
        island = EXCLUDED.island,
        status = EXCLUDED.status,
        customer_name = EXCLUDED.customer_name,
        engineer_id = EXCLUDED.engineer_id,
        visit_date = EXCLUDED.visit_date,
        payload = EXCLUDED.payload,
        updated_at = NOW()
    `;
  }

  async function seedFromDocuments(seed = {}) {
    if (await hasAnyData()) return;
    await replaceInventoryData(seed.inventory || {});
    await replaceRepairOrders(seed.repairs || []);
    await replaceSurveyBookings(seed.surveys || []);
  }

  async function ensureReady(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    if (ready) return true;
    if (!readyPromise) {
      readyPromise = (async () => {
        await ensureOperationsSchema();
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

  async function replaceAll(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    await ensureReady();
    await replaceInventoryData(seed.inventory || {});
    await replaceRepairOrders(seed.repairs || []);
    await replaceSurveyBookings(seed.surveys || []);
    return true;
  }

  return {
    isEnabled: isDatabaseEnabled,
    ensureReady,
    listInventoryData,
    replaceInventoryData,
    listRepairOrders,
    replaceRepairOrders,
    upsertRepairOrder,
    listSurveyBookings,
    replaceSurveyBookings,
    upsertSurveyBooking,
    replaceAll
  };
}

module.exports = {
  createOperationsStore
};
