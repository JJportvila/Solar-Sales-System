const { ensureSchema, getSql, isDatabaseEnabled } = require("./neon");

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createConfigStore() {
  let ready = false;
  let readyPromise = null;
  let cache = {
    settings: {},
    companyProfile: {},
    productConfig: { vatRate: 0, packages: [], discounts: [] },
    rbac: { employeeAccess: [], moduleMatrix: [], ipWhitelist: [], emergencyLocked: false, auditLogs: [] },
    backupIndex: { items: [] }
  };

  async function ensureConfigSchema() {
    if (!isDatabaseEnabled()) return false;
    await ensureSchema();
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS system_config_documents (
        document_key TEXT PRIMARY KEY,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS product_package_records (
        id TEXT PRIMARY KEY,
        sku TEXT NOT NULL DEFAULT '',
        name TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        sort_order INTEGER NOT NULL DEFAULT 1,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS product_package_sort_idx ON product_package_records (sort_order, updated_at DESC)`;
    await sql`
      CREATE TABLE IF NOT EXISTS product_discount_records (
        id TEXT PRIMARY KEY,
        active BOOLEAN NOT NULL DEFAULT FALSE,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS rbac_access_records (
        employee_id TEXT PRIMARY KEY,
        role_override TEXT NOT NULL DEFAULT '',
        access_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        security_level INTEGER NOT NULL DEFAULT 1,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS rbac_module_records (
        module_key TEXT PRIMARY KEY,
        group_name TEXT NOT NULL DEFAULT '',
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS rbac_ip_records (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'active',
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS rbac_audit_records (
        id TEXT PRIMARY KEY,
        actor TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS backup_index_records (
        id TEXT PRIMARY KEY,
        trigger TEXT NOT NULL DEFAULT 'manual',
        status TEXT NOT NULL DEFAULT 'ready',
        created_at TIMESTAMPTZ,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    return true;
  }

  async function hasAnyData() {
    const sql = getSql();
    const checks = await Promise.all([
      sql`SELECT EXISTS(SELECT 1 FROM system_config_documents LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM product_package_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM product_discount_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM rbac_access_records LIMIT 1) AS has_items`,
      sql`SELECT EXISTS(SELECT 1 FROM backup_index_records LIMIT 1) AS has_items`
    ]);
    return checks.some((row) => Boolean(row[0]?.has_items));
  }

  async function replaceAll(seed = {}) {
    const sql = getSql();
    const settings = cloneJson(seed.settings || {});
    const companyProfile = cloneJson(seed.companyProfile || {});
    const productConfig = cloneJson(seed.productConfig || { vatRate: 0, packages: [], discounts: [] });
    const rbac = cloneJson(seed.rbac || { employeeAccess: [], moduleMatrix: [], ipWhitelist: [], emergencyLocked: false, auditLogs: [] });
    const backupIndex = cloneJson(seed.backupIndex || { items: [] });

    await sql`DELETE FROM system_config_documents`;
    await sql`DELETE FROM product_package_records`;
    await sql`DELETE FROM product_discount_records`;
    await sql`DELETE FROM rbac_access_records`;
    await sql`DELETE FROM rbac_module_records`;
    await sql`DELETE FROM rbac_ip_records`;
    await sql`DELETE FROM rbac_audit_records`;
    await sql`DELETE FROM backup_index_records`;

    await sql`
      INSERT INTO system_config_documents (document_key, payload, updated_at)
      VALUES
        ('settings', ${JSON.stringify(settings)}::jsonb, NOW()),
        ('company_profile', ${JSON.stringify(companyProfile)}::jsonb, NOW()),
        ('product_config_meta', ${JSON.stringify({ vatRate: Number(productConfig.vatRate || 0) })}::jsonb, NOW()),
        ('rbac_meta', ${JSON.stringify({ emergencyLocked: Boolean(rbac.emergencyLocked) })}::jsonb, NOW())
    `;

    for (const item of Array.isArray(productConfig.packages) ? productConfig.packages : []) {
      await sql`
        INSERT INTO product_package_records (id, sku, name, status, sort_order, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.sku || "").trim()},
          ${String(item.name || "").trim()},
          ${String(item.status || "active").trim()},
          ${Math.max(1, Math.round(Number(item.sortOrder || 1) || 1))},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    for (const item of Array.isArray(productConfig.discounts) ? productConfig.discounts : []) {
      await sql`
        INSERT INTO product_discount_records (id, active, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${Boolean(item.active)},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    for (const item of Array.isArray(rbac.employeeAccess) ? rbac.employeeAccess : []) {
      await sql`
        INSERT INTO rbac_access_records (employee_id, role_override, access_enabled, security_level, payload, updated_at)
        VALUES (
          ${String(item.employeeId || "").trim()},
          ${String(item.roleOverride || "").trim()},
          ${item.accessEnabled !== false},
          ${Math.max(1, Math.round(Number(item.securityLevel || 1) || 1))},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    for (const item of Array.isArray(rbac.moduleMatrix) ? rbac.moduleMatrix : []) {
      await sql`
        INSERT INTO rbac_module_records (module_key, group_name, enabled, payload, updated_at)
        VALUES (
          ${String(item.key || "").trim()},
          ${String(item.group || "").trim()},
          ${item.enabled !== false},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    for (const item of Array.isArray(rbac.ipWhitelist) ? rbac.ipWhitelist : []) {
      await sql`
        INSERT INTO rbac_ip_records (id, status, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.status || "active").trim()},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    for (const item of Array.isArray(rbac.auditLogs) ? rbac.auditLogs : []) {
      await sql`
        INSERT INTO rbac_audit_records (id, actor, created_at, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.actor || "").trim()},
          ${String(item.createdAt || "").trim() || null},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    for (const item of Array.isArray(backupIndex.items) ? backupIndex.items : []) {
      await sql`
        INSERT INTO backup_index_records (id, trigger, status, created_at, payload, updated_at)
        VALUES (
          ${String(item.id || "").trim()},
          ${String(item.trigger || "manual").trim()},
          ${String(item.status || "ready").trim()},
          ${String(item.createdAt || "").trim() || null},
          ${JSON.stringify(cloneJson(item))}::jsonb,
          NOW()
        )
      `;
    }

    cache = { settings, companyProfile, productConfig, rbac, backupIndex };
  }

  async function hydrateCacheFromDatabase() {
    const sql = getSql();
    const [docs, packages, discounts, access, modules, ips, audits, backups] = await Promise.all([
      sql`SELECT document_key, payload FROM system_config_documents`,
      sql`SELECT payload FROM product_package_records ORDER BY sort_order ASC, updated_at DESC`,
      sql`SELECT payload FROM product_discount_records ORDER BY updated_at DESC`,
      sql`SELECT payload FROM rbac_access_records ORDER BY updated_at DESC`,
      sql`SELECT payload FROM rbac_module_records ORDER BY updated_at DESC`,
      sql`SELECT payload FROM rbac_ip_records ORDER BY updated_at DESC`,
      sql`SELECT payload FROM rbac_audit_records ORDER BY created_at DESC NULLS LAST, updated_at DESC`,
      sql`SELECT payload FROM backup_index_records ORDER BY created_at DESC NULLS LAST, updated_at DESC`
    ]);
    const docMap = new Map(docs.map((row) => [row.document_key, row.payload]));
    cache = {
      settings: cloneJson(docMap.get("settings") || {}),
      companyProfile: cloneJson(docMap.get("company_profile") || {}),
      productConfig: {
        vatRate: Number(docMap.get("product_config_meta")?.vatRate || 0),
        packages: packages.map((row) => cloneJson(row.payload)),
        discounts: discounts.map((row) => cloneJson(row.payload))
      },
      rbac: {
        employeeAccess: access.map((row) => cloneJson(row.payload)),
        moduleMatrix: modules.map((row) => cloneJson(row.payload)),
        ipWhitelist: ips.map((row) => cloneJson(row.payload)),
        emergencyLocked: Boolean(docMap.get("rbac_meta")?.emergencyLocked),
        auditLogs: audits.map((row) => cloneJson(row.payload))
      },
      backupIndex: {
        items: backups.map((row) => cloneJson(row.payload))
      }
    };
  }

  async function ensureReady(seed = {}) {
    if (!isDatabaseEnabled()) return false;
    if (ready) return true;
    if (!readyPromise) {
      readyPromise = (async () => {
        await ensureConfigSchema();
        if (await hasAnyData()) {
          await hydrateCacheFromDatabase();
        } else {
          await replaceAll(seed);
        }
        ready = true;
        return true;
      })().catch((error) => {
        readyPromise = null;
        throw error;
      });
    }
    return readyPromise;
  }

  function getSettings() {
    return cloneJson(cache.settings);
  }

  function getCompanyProfile() {
    return cloneJson(cache.companyProfile);
  }

  function getProductConfig() {
    return cloneJson(cache.productConfig);
  }

  function getRbac() {
    return cloneJson(cache.rbac);
  }

  function getBackupIndex() {
    return cloneJson(cache.backupIndex);
  }

  async function saveSettings(settings = {}) {
    cache.settings = cloneJson(settings);
    const sql = getSql();
    await sql`
      INSERT INTO system_config_documents (document_key, payload, updated_at)
      VALUES ('settings', ${JSON.stringify(cache.settings)}::jsonb, NOW())
      ON CONFLICT (document_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `;
  }

  async function saveCompanyProfile(companyProfile = {}) {
    cache.companyProfile = cloneJson(companyProfile);
    const sql = getSql();
    await sql`
      INSERT INTO system_config_documents (document_key, payload, updated_at)
      VALUES ('company_profile', ${JSON.stringify(cache.companyProfile)}::jsonb, NOW())
      ON CONFLICT (document_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
    `;
  }

  async function saveProductConfig(productConfig = {}) {
    cache.productConfig = cloneJson(productConfig);
    await replaceAll({
      settings: cache.settings,
      companyProfile: cache.companyProfile,
      productConfig: cache.productConfig,
      rbac: cache.rbac,
      backupIndex: cache.backupIndex
    });
  }

  async function saveRbac(rbac = {}) {
    cache.rbac = cloneJson(rbac);
    await replaceAll({
      settings: cache.settings,
      companyProfile: cache.companyProfile,
      productConfig: cache.productConfig,
      rbac: cache.rbac,
      backupIndex: cache.backupIndex
    });
  }

  async function saveBackupIndex(backupIndex = {}) {
    cache.backupIndex = cloneJson(backupIndex);
    await replaceAll({
      settings: cache.settings,
      companyProfile: cache.companyProfile,
      productConfig: cache.productConfig,
      rbac: cache.rbac,
      backupIndex: cache.backupIndex
    });
  }

  return {
    isEnabled: isDatabaseEnabled,
    ensureReady,
    replaceAll,
    getSettings,
    getCompanyProfile,
    getProductConfig,
    getRbac,
    getBackupIndex,
    saveSettings,
    saveCompanyProfile,
    saveProductConfig,
    saveRbac,
    saveBackupIndex
  };
}

module.exports = {
  createConfigStore
};
