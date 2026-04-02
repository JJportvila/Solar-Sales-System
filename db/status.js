const path = require("path");

const { ensureSchema, getSql, isDatabaseEnabled } = require("./neon");

const DOCUMENT_KEYS = [
  "saved_quotes",
  "settings",
  "company_profile",
  "product_config",
  "inventory",
  "repair_order",
  "repair_orders",
  "site_survey",
  "employees",
  "rbac",
  "customers",
  "vendors",
  "wholesale_orders",
  "expense_control",
  "invoices",
  "field_tracks",
  "field_visits",
  "field_checkins",
  "backup_index"
];

async function main() {
  if (!isDatabaseEnabled()) {
    throw new Error("DATABASE_URL is not configured");
  }

  await ensureSchema();
  const sql = getSql();

  const documentRows = await sql`
    SELECT document_key, updated_at
    FROM app_json_documents
    WHERE document_key = ANY(${DOCUMENT_KEYS})
    ORDER BY document_key
  `;

  const documentStatus = DOCUMENT_KEYS.map((key) => {
    const row = documentRows.find((item) => item.document_key === key);
    return {
      key,
      present: Boolean(row),
      updatedAt: row?.updated_at || null
    };
  });

  const [
    fieldCheckins,
    fieldVisits,
    fieldTrackSessions,
    fieldTrackPoints,
    customers,
    invoices,
    employees,
    quotes,
    inventoryStock,
    inventoryTransactions,
    inventoryPurchaseOrders,
    repairs,
    surveys,
    vendors,
    vendorOrders,
    wholesaleOrders,
    expensePaymentQueue,
    expenseInstallments,
    expenseCommissions,
    expenseTransactions,
    expenseMisc,
    configDocs,
    productPackages,
    productDiscounts,
    rbacAccess,
    rbacModules,
    rbacIps,
    rbacAudits,
    backupIndex
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS count FROM field_checkins_records`,
    sql`SELECT COUNT(*)::int AS count FROM field_visits_records`,
    sql`SELECT COUNT(*)::int AS count FROM field_track_sessions`,
    sql`SELECT COUNT(*)::int AS count FROM field_track_points`,
    sql`SELECT COUNT(*)::int AS count FROM customer_records`,
    sql`SELECT COUNT(*)::int AS count FROM invoice_records`,
    sql`SELECT COUNT(*)::int AS count FROM employee_records`,
    sql`SELECT COUNT(*)::int AS count FROM quote_records`,
    sql`SELECT COUNT(*)::int AS count FROM inventory_stock_records`,
    sql`SELECT COUNT(*)::int AS count FROM inventory_transaction_records`,
    sql`SELECT COUNT(*)::int AS count FROM inventory_purchase_order_records`,
    sql`SELECT COUNT(*)::int AS count FROM repair_order_records`,
    sql`SELECT COUNT(*)::int AS count FROM survey_booking_records`,
    sql`SELECT COUNT(*)::int AS count FROM vendor_records`,
    sql`SELECT COUNT(*)::int AS count FROM vendor_order_records`,
    sql`SELECT COUNT(*)::int AS count FROM wholesale_order_records`,
    sql`SELECT COUNT(*)::int AS count FROM expense_payment_queue_records`,
    sql`SELECT COUNT(*)::int AS count FROM expense_installment_plan_records`,
    sql`SELECT COUNT(*)::int AS count FROM expense_commission_records`,
    sql`SELECT COUNT(*)::int AS count FROM expense_transaction_records`,
    sql`SELECT COUNT(*)::int AS count FROM expense_misc_records`,
    sql`SELECT COUNT(*)::int AS count FROM system_config_documents`,
    sql`SELECT COUNT(*)::int AS count FROM product_package_records`,
    sql`SELECT COUNT(*)::int AS count FROM product_discount_records`,
    sql`SELECT COUNT(*)::int AS count FROM rbac_access_records`,
    sql`SELECT COUNT(*)::int AS count FROM rbac_module_records`,
    sql`SELECT COUNT(*)::int AS count FROM rbac_ip_records`,
    sql`SELECT COUNT(*)::int AS count FROM rbac_audit_records`,
    sql`SELECT COUNT(*)::int AS count FROM backup_index_records`
  ]);

  const tableStatus = {
    field_checkins_records: Number(fieldCheckins[0]?.count || 0),
    field_visits_records: Number(fieldVisits[0]?.count || 0),
    field_track_sessions: Number(fieldTrackSessions[0]?.count || 0),
    field_track_points: Number(fieldTrackPoints[0]?.count || 0),
    customer_records: Number(customers[0]?.count || 0),
    invoice_records: Number(invoices[0]?.count || 0),
    employee_records: Number(employees[0]?.count || 0),
    quote_records: Number(quotes[0]?.count || 0),
    inventory_stock_records: Number(inventoryStock[0]?.count || 0),
    inventory_transaction_records: Number(inventoryTransactions[0]?.count || 0),
    inventory_purchase_order_records: Number(inventoryPurchaseOrders[0]?.count || 0),
    repair_order_records: Number(repairs[0]?.count || 0),
    survey_booking_records: Number(surveys[0]?.count || 0),
    vendor_records: Number(vendors[0]?.count || 0),
    vendor_order_records: Number(vendorOrders[0]?.count || 0),
    wholesale_order_records: Number(wholesaleOrders[0]?.count || 0),
    expense_payment_queue_records: Number(expensePaymentQueue[0]?.count || 0),
    expense_installment_plan_records: Number(expenseInstallments[0]?.count || 0),
    expense_commission_records: Number(expenseCommissions[0]?.count || 0),
    expense_transaction_records: Number(expenseTransactions[0]?.count || 0),
    expense_misc_records: Number(expenseMisc[0]?.count || 0),
    system_config_documents: Number(configDocs[0]?.count || 0),
    product_package_records: Number(productPackages[0]?.count || 0),
    product_discount_records: Number(productDiscounts[0]?.count || 0),
    rbac_access_records: Number(rbacAccess[0]?.count || 0),
    rbac_module_records: Number(rbacModules[0]?.count || 0),
    rbac_ip_records: Number(rbacIps[0]?.count || 0),
    rbac_audit_records: Number(rbacAudits[0]?.count || 0),
    backup_index_records: Number(backupIndex[0]?.count || 0)
  };

  console.log(JSON.stringify({
    ok: true,
    cwd: path.resolve(process.cwd()),
    tables: tableStatus,
    documents: documentStatus
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
