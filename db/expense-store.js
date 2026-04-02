const { ensureSchema, getSql, isDatabaseEnabled } = require("./neon");

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createExpenseStore() {
  let ready = false;
  let readyPromise = null;

  async function ensureExpenseSchema() {
    if (!isDatabaseEnabled()) return false;
    await ensureSchema();
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS expense_payment_queue_records (
        id TEXT PRIMARY KEY,
        customer TEXT NOT NULL DEFAULT '',
        amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS expense_payment_queue_status_idx ON expense_payment_queue_records (status, created_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS expense_installment_plan_records (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT '',
        collector_name TEXT NOT NULL DEFAULT '',
        payment_date TEXT NOT NULL DEFAULT '',
        total_amount INTEGER NOT NULL DEFAULT 0,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS expense_installment_plan_status_idx ON expense_installment_plan_records (status, updated_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS expense_commission_records (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT '',
        type TEXT NOT NULL DEFAULT '',
        amount INTEGER NOT NULL DEFAULT 0,
        release_status TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS expense_commission_status_idx ON expense_commission_records (release_status, updated_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS expense_transaction_records (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL DEFAULT '',
        customer TEXT NOT NULL DEFAULT '',
        amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS expense_transaction_status_idx ON expense_transaction_records (status, updated_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS expense_misc_records (
        section TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        amount INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT '',
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (section, id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS expense_misc_section_idx ON expense_misc_records (section, updated_at DESC)`;
    return true;
  }

  async function hasAnyData() {
    const sql = getSql();
    const rows = await Promise.all([
      sql`SELECT EXISTS(SELECT 1 FROM expense_payment_queue_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM expense_installment_plan_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM expense_commission_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM expense_transaction_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM expense_misc_records LIMIT 1) AS has_items`
    ]);
    return rows.some((row) => Boolean(row[0]?.has_items));
  }

  async function replaceAll(data = {}) {
    const sql = getSql();
    await sql`DELETE FROM expense_payment_queue_records`;
    await sql`DELETE FROM expense_installment_plan_records`;
    await sql`DELETE FROM expense_commission_records`;
    await sql`DELETE FROM expense_transaction_records`;
    await sql`DELETE FROM expense_misc_records`;

    for (const item of Array.isArray(data.paymentQueue) ? data.paymentQueue : []) {
      await sql`
        INSERT INTO expense_payment_queue_records (id, customer, amount, status, created_at, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.customer || "").trim()},
          ${Math.max(0, Math.round(Number(item.amount || 0) || 0))},
          ${String(item.status || "").trim()},
          ${String(item.createdAt || "").trim() || null},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    for (const item of Array.isArray(data.installmentPlans) ? data.installmentPlans : []) {
      await sql`
        INSERT INTO expense_installment_plan_records (id, name, status, collector_name, payment_date, total_amount, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.name || "").trim()},
          ${String(item.status || "").trim()},
          ${String(item.collectorName || "").trim()},
          ${String(item.paymentDate || "").trim()},
          ${Math.max(0, Math.round(Number(item.totalAmount || 0) || 0))},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    for (const item of Array.isArray(data.commissionPool) ? data.commissionPool : []) {
      await sql`
        INSERT INTO expense_commission_records (id, name, role, type, amount, release_status, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.name || "").trim()},
          ${String(item.role || "").trim()},
          ${String(item.type || "").trim()},
          ${Math.max(0, Math.round(Number(item.amount || 0) || 0))},
          ${String(item.releaseStatus || "").trim()},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    for (const item of Array.isArray(data.transactionLogs) ? data.transactionLogs : []) {
      await sql`
        INSERT INTO expense_transaction_records (id, type, customer, amount, status, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.type || "").trim()},
          ${String(item.customer || "").trim()},
          ${Math.round(Number(item.amount || 0) || 0)},
          ${String(item.status || "").trim()},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    for (const section of ["livingCosts", "taxes", "invoices", "rentLedger"]) {
      for (const item of Array.isArray(data[section]) ? data[section] : []) {
        await sql`
          INSERT INTO expense_misc_records (section, id, name, amount, status, payload, updated_at)
          VALUES (
            ${section},
            ${String(item.id || "").trim()},
            ${String(item.name || item.location || "").trim()},
            ${Math.max(0, Math.round(Number(item.amount || 0) || 0))},
            ${String(item.status || "").trim()},
            ${JSON.stringify(cloneJson(item))}::jsonb,
            NOW()
          )
        `;
      }
    }
  }

  async function seedFromDocuments(seed = {}) {
    if (await hasAnyData()) return;
    await replaceAll(seed);
  }

  async function ensureReady(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    if (ready) return true;
    if (!readyPromise) {
      readyPromise = (async () => {
        await ensureExpenseSchema();
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

  async function getAll() {
    if (!isDatabaseEnabled()) return null;
    await ensureReady();
    const sql = getSql();
    const [paymentQueue, installmentPlans, commissionPool, transactionLogs, miscRows] = await Promise.all([
      sql`SELECT payload FROM expense_payment_queue_records ORDER BY created_at DESC NULLS LAST, updated_at DESC`,
      sql`SELECT payload FROM expense_installment_plan_records ORDER BY updated_at DESC`,
      sql`SELECT payload FROM expense_commission_records ORDER BY updated_at DESC`,
      sql`SELECT payload FROM expense_transaction_records ORDER BY updated_at DESC`,
      sql`SELECT section, payload FROM expense_misc_records ORDER BY updated_at DESC`
    ]);

    const result = {
      paymentQueue: paymentQueue.map((row) => cloneJson(row.payload)),
      installmentPlans: installmentPlans.map((row) => cloneJson(row.payload)),
      commissionPool: commissionPool.map((row) => cloneJson(row.payload)),
      transactionLogs: transactionLogs.map((row) => cloneJson(row.payload)),
      livingCosts: [],
      taxes: [],
      invoices: [],
      rentLedger: []
    };

    for (const row of miscRows) {
      if (Array.isArray(result[row.section])) {
        result[row.section].push(cloneJson(row.payload));
      }
    }

    return result;
  }

  return {
    isEnabled: isDatabaseEnabled,
    ensureReady,
    getAll,
    replaceAll
  };
}

module.exports = {
  createExpenseStore
};
