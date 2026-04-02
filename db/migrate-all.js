const fs = require("fs");
const path = require("path");

const { isDatabaseEnabled } = require("./neon");
const { createFieldStore } = require("./field-store");
const { createCrmStore } = require("./crm-store");
const { createBusinessStore } = require("./business-store");
const { createOperationsStore } = require("./operations-store");
const { createCommerceStore } = require("./commerce-store");
const { createExpenseStore } = require("./expense-store");
const { createConfigStore } = require("./config-store");

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return fallback;
  }
}

async function main() {
  if (!isDatabaseEnabled()) {
    throw new Error("DATABASE_URL is not configured");
  }

  const dataDir = path.join(process.cwd(), "data");
  const seed = {
    employees: readJson(path.join(dataDir, "employees.json"), {}),
    quotes: readJson(path.join(dataDir, "saved_quotes.json"), []),
    inventory: readJson(path.join(dataDir, "inventory.json"), {}),
    repairs: readJson(path.join(dataDir, "repair_orders.json"), {}),
    surveys: readJson(path.join(dataDir, "site_survey.json"), {}),
    customers: readJson(path.join(dataDir, "customers.json"), {}),
    invoices: readJson(path.join(dataDir, "invoices.json"), []),
    vendors: readJson(path.join(dataDir, "vendors.json"), {}),
    wholesale: readJson(path.join(dataDir, "wholesale_orders.json"), {}),
    expenseControl: readJson(path.join(dataDir, "expense_control.json"), {}),
    settings: readJson(path.join(dataDir, "settings.json"), {}),
    companyProfile: readJson(path.join(dataDir, "company_profile.json"), {}),
    productConfig: readJson(path.join(dataDir, "product_config.json"), {}),
    rbac: readJson(path.join(dataDir, "rbac.json"), {}),
    backupIndex: readJson(path.join(dataDir, "backups", "index.json"), { items: [] }),
    tracks: readJson(path.join(dataDir, "field_tracks.json"), []),
    visits: readJson(path.join(dataDir, "field_visits.json"), []),
    checkins: readJson(path.join(dataDir, "field_checkins.json"), [])
  };

  const fieldStore = createFieldStore();
  const crmStore = createCrmStore();
  const businessStore = createBusinessStore();
  const operationsStore = createOperationsStore();
  const commerceStore = createCommerceStore();
  const expenseStore = createExpenseStore();
  const configStore = createConfigStore();

  await fieldStore.replaceAll({
    tracks: Array.isArray(seed.tracks) ? seed.tracks : [],
    visits: Array.isArray(seed.visits) ? seed.visits : [],
    checkins: Array.isArray(seed.checkins) ? seed.checkins : []
  });

  await crmStore.replaceAll({
    customers: Array.isArray(seed.customers.items) ? seed.customers.items : [],
    invoices: Array.isArray(seed.invoices) ? seed.invoices : []
  });

  await businessStore.replaceAll({
    employees: seed.employees,
    quotes: Array.isArray(seed.quotes) ? seed.quotes : []
  });

  await operationsStore.replaceAll({
    inventory: seed.inventory,
    repairs: Array.isArray(seed.repairs.items) ? seed.repairs.items : [],
    surveys: Array.isArray(seed.surveys.bookings) ? seed.surveys.bookings : []
  });

  await commerceStore.replaceAll({
    vendors: {
      items: Array.isArray(seed.vendors.items) ? seed.vendors.items : [],
      orders: Array.isArray(seed.vendors.orders) ? seed.vendors.orders : []
    },
    wholesaleOrders: Array.isArray(seed.wholesale.orders) ? seed.wholesale.orders : []
  });

  await expenseStore.replaceAll(seed.expenseControl || {});

  await configStore.replaceAll({
    settings: seed.settings || {},
    companyProfile: seed.companyProfile || {},
    productConfig: seed.productConfig || {},
    rbac: seed.rbac || {},
    backupIndex: seed.backupIndex || { items: [] }
  });

  const [fieldTracks, fieldVisits, fieldCheckins, customers, invoices, employees, quotes, inventory, repairs, surveys, vendors, vendorOrders, wholesaleOrders, expenseData, configSettings, configCompany, configProduct, configRbac, configBackup] = await Promise.all([
    fieldStore.listTracks({}),
    fieldStore.listVisits({}),
    fieldStore.listCheckins({}),
    crmStore.listCustomers(),
    crmStore.listInvoices(),
    businessStore.listEmployees(),
    businessStore.listQuotes(),
    operationsStore.listInventoryData(),
    operationsStore.listRepairOrders(),
    operationsStore.listSurveyBookings(),
    commerceStore.listVendors(),
    commerceStore.listVendorOrders(),
    commerceStore.listWholesaleOrders(),
    expenseStore.getAll(),
    Promise.resolve(configStore.getSettings()),
    Promise.resolve(configStore.getCompanyProfile()),
    Promise.resolve(configStore.getProductConfig()),
    Promise.resolve(configStore.getRbac()),
    Promise.resolve(configStore.getBackupIndex())
  ]);

  console.log(JSON.stringify({
    ok: true,
    seeded: {
      fieldTracks: fieldTracks.length,
      fieldVisits: fieldVisits.length,
      fieldCheckins: fieldCheckins.length,
      customers: customers.length,
      invoices: invoices.length,
      employees: Array.isArray(employees.items) ? employees.items.length : 0,
      monthlyTrend: Array.isArray(employees.monthlyTrend) ? employees.monthlyTrend.length : 0,
      quotes: quotes.length,
      inventoryStockItems: Array.isArray(inventory?.stockItems) ? inventory.stockItems.length : 0,
      inventoryTransactions: Array.isArray(inventory?.transactions) ? inventory.transactions.length : 0,
      inventoryPurchaseOrders: Array.isArray(inventory?.purchaseOrders) ? inventory.purchaseOrders.length : 0,
      repairs: repairs.length,
      surveys: surveys.length,
      vendors: vendors.length,
      vendorOrders: vendorOrders.length,
      wholesaleOrders: wholesaleOrders.length,
      expensePaymentQueue: Array.isArray(expenseData?.paymentQueue) ? expenseData.paymentQueue.length : 0,
      expenseInstallments: Array.isArray(expenseData?.installmentPlans) ? expenseData.installmentPlans.length : 0,
      expenseCommissions: Array.isArray(expenseData?.commissionPool) ? expenseData.commissionPool.length : 0,
      expenseTransactions: Array.isArray(expenseData?.transactionLogs) ? expenseData.transactionLogs.length : 0,
      expenseMisc: ["livingCosts", "taxes", "invoices", "rentLedger"].reduce((sum, key) => sum + (Array.isArray(expenseData?.[key]) ? expenseData[key].length : 0), 0),
      configSettings: Object.keys(configSettings || {}).length,
      configCompanyProfile: Object.keys(configCompany || {}).length,
      configPackages: Array.isArray(configProduct?.packages) ? configProduct.packages.length : 0,
      configDiscounts: Array.isArray(configProduct?.discounts) ? configProduct.discounts.length : 0,
      rbacEmployeeAccess: Array.isArray(configRbac?.employeeAccess) ? configRbac.employeeAccess.length : 0,
      rbacModules: Array.isArray(configRbac?.moduleMatrix) ? configRbac.moduleMatrix.length : 0,
      rbacIps: Array.isArray(configRbac?.ipWhitelist) ? configRbac.ipWhitelist.length : 0,
      rbacAudits: Array.isArray(configRbac?.auditLogs) ? configRbac.auditLogs.length : 0,
      backupIndexItems: Array.isArray(configBackup?.items) ? configBackup.items.length : 0
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
