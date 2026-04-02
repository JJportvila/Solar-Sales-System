const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { createDocumentStore } = require("./db/document-store");
const { createFieldStore } = require("./db/field-store");
const { createCrmStore } = require("./db/crm-store");
const { createBusinessStore } = require("./db/business-store");
const { createOperationsStore } = require("./db/operations-store");
const { createCommerceStore } = require("./db/commerce-store");
const { createExpenseStore } = require("./db/expense-store");
const { createConfigStore } = require("./db/config-store");
const { buildDemoAttendanceData } = require("./db/attendance-demo-data");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const UPLOADS_DIR = path.join(PUBLIC_DIR, "uploads");
const SAVES_FILE = path.join(DATA_DIR, "saved_quotes.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const COMPANY_FILE = path.join(DATA_DIR, "company_profile.json");
const PRODUCT_CONFIG_FILE = path.join(DATA_DIR, "product_config.json");
const INVENTORY_FILE = path.join(DATA_DIR, "inventory.json");
const REPAIR_FILE = path.join(DATA_DIR, "repair_order.json");
const REPAIR_ORDERS_FILE = path.join(DATA_DIR, "repair_orders.json");
const SURVEY_FILE = path.join(DATA_DIR, "site_survey.json");
const EMPLOYEES_FILE = path.join(DATA_DIR, "employees.json");
const RBAC_FILE = path.join(DATA_DIR, "rbac.json");
const CUSTOMERS_FILE = path.join(DATA_DIR, "customers.json");
const VENDORS_FILE = path.join(DATA_DIR, "vendors.json");
const WHOLESALE_FILE = path.join(DATA_DIR, "wholesale_orders.json");
const EXPENSE_CONTROL_FILE = path.join(DATA_DIR, "expense_control.json");
const INVOICES_FILE = path.join(DATA_DIR, "invoices.json");
const FIELD_TRACKS_FILE = path.join(DATA_DIR, "field_tracks.json");
const FIELD_VISITS_FILE = path.join(DATA_DIR, "field_visits.json");
const FIELD_CHECKINS_FILE = path.join(DATA_DIR, "field_checkins.json");
const ACTIVE_TOKENS = new Map(); // token -> userId
const ACTIVE_LOGIN_SESSIONS = new Map(); // token -> auth session
const AUTH_COOKIE_SECRET = process.env.AUTH_COOKIE_SECRET || "solar-sales-system-auth-secret";
const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || "Pacific/Efate";
const RUNTIME_DATA_DIR = process.env.VERCEL ? path.join("/tmp", "solar-sales-data") : "";
const BACKUPS_DIR = path.join(DATA_DIR, "backups");
const BACKUP_INDEX_FILE = path.join(BACKUPS_DIR, "index.json");
const DEMO_ATTENDANCE_DATA = buildDemoAttendanceData({ timeZone: BUSINESS_TIME_ZONE });

let fieldDemoSeedPromise = null;
let fieldDemoSeeded = false;

const DATA_DOCUMENT_KEYS = {
  [SAVES_FILE]: { key: "saved_quotes", fallback: [] },
  [SETTINGS_FILE]: { key: "settings", fallback: {} },
  [COMPANY_FILE]: { key: "company_profile", fallback: {} },
  [PRODUCT_CONFIG_FILE]: { key: "product_config", fallback: {} },
  [INVENTORY_FILE]: { key: "inventory", fallback: {} },
  [REPAIR_FILE]: { key: "repair_order", fallback: {} },
  [REPAIR_ORDERS_FILE]: { key: "repair_orders", fallback: {} },
  [SURVEY_FILE]: { key: "site_survey", fallback: {} },
  [EMPLOYEES_FILE]: { key: "employees", fallback: {} },
  [RBAC_FILE]: { key: "rbac", fallback: {} },
  [CUSTOMERS_FILE]: { key: "customers", fallback: {} },
  [VENDORS_FILE]: { key: "vendors", fallback: {} },
  [WHOLESALE_FILE]: { key: "wholesale_orders", fallback: {} },
  [EXPENSE_CONTROL_FILE]: { key: "expense_control", fallback: {} },
  [INVOICES_FILE]: { key: "invoices", fallback: [] },
  [FIELD_TRACKS_FILE]: { key: "field_tracks", fallback: DEMO_ATTENDANCE_DATA.tracks },
  [FIELD_VISITS_FILE]: { key: "field_visits", fallback: DEMO_ATTENDANCE_DATA.visits },
  [FIELD_CHECKINS_FILE]: { key: "field_checkins", fallback: DEMO_ATTENDANCE_DATA.checkins },
  [BACKUP_INDEX_FILE]: { key: "backup_index", fallback: { items: [] } }
};

const documentStore = createDocumentStore(DATA_DOCUMENT_KEYS);
const fieldStore = createFieldStore();
const crmStore = createCrmStore();
const businessStore = createBusinessStore();
const operationsStore = createOperationsStore();
const commerceStore = createCommerceStore();
const expenseStore = createExpenseStore();
const configStore = createConfigStore();

const applianceCategories = [
  {
    key: "lighting",
    items: [
      { key: "led_bulb", name: "LED Light", power: 10, hours: 6, quantity: 4 },
      { key: "tube_light", name: "Tube Light", power: 20, hours: 5, quantity: 2 },
      { key: "security_light", name: "Security Light", power: 30, hours: 10, quantity: 1 }
    ]
  },
  {
    key: "kitchen",
    items: [
      { key: "fridge", name: "Fridge", power: 150, hours: 24, quantity: 1 },
      { key: "freezer", name: "Freezer", power: 220, hours: 18, quantity: 1 },
      { key: "rice_cooker", name: "Rice Cooker", power: 700, hours: 1, quantity: 1 },
      { key: "electric_kettle", name: "Electric Kettle", power: 1800, hours: 0.25, quantity: 1 },
      { key: "microwave", name: "Microwave", power: 1200, hours: 0.5, quantity: 1 }
    ]
  },
  {
    key: "comfort",
    items: [
      { key: "fan", name: "Fan", power: 45, hours: 10, quantity: 2 },
      { key: "ceiling_fan", name: "Ceiling Fan", power: 60, hours: 10, quantity: 2 },
      { key: "aircon", name: "Air Conditioner", power: 800, hours: 8, quantity: 1 }
    ]
  },
  {
    key: "entertainment",
    items: [
      { key: "tv", name: "TV", power: 120, hours: 5, quantity: 1 },
      { key: "router", name: "WiFi Router", power: 12, hours: 24, quantity: 1 },
      { key: "decoder", name: "Decoder", power: 25, hours: 5, quantity: 1 }
    ]
  },
  {
    key: "office",
    items: [
      { key: "laptop", name: "Laptop", power: 60, hours: 8, quantity: 2 },
      { key: "desktop", name: "Desktop Computer", power: 250, hours: 8, quantity: 1 },
      { key: "printer", name: "Printer", power: 100, hours: 0.5, quantity: 1 }
    ]
  },
  {
    key: "cleaning",
    items: [
      { key: "washing_machine", name: "Washing Machine", power: 500, hours: 1.5, quantity: 1 },
      { key: "iron", name: "Iron", power: 1200, hours: 0.5, quantity: 1 },
      { key: "vacuum", name: "Vacuum Cleaner", power: 900, hours: 0.5, quantity: 1 }
    ]
  },
  {
    key: "water",
    items: [
      { key: "water_pump", name: "Water Pump", power: 750, hours: 2, quantity: 1 },
      { key: "water_heater", name: "Water Heater", power: 1500, hours: 1, quantity: 1 }
    ]
  }
];

const presetAppliances = [
  { key: "lights", category: "lighting", device: { name: "LED Light", power: 10, hours: 6, quantity: 6 } },
  { key: "cold", category: "kitchen", device: { name: "Fridge", power: 150, hours: 24, quantity: 1 } },
  { key: "comfort", category: "comfort", device: { name: "Fan", power: 45, hours: 10, quantity: 2 } },
  { key: "office", category: "office", device: { name: "Laptop", power: 60, hours: 8, quantity: 2 } },
  { key: "tv", category: "entertainment", device: { name: "TV", power: 120, hours: 5, quantity: 1 } },
  { key: "pump", category: "water", device: { name: "Water Pump", power: 750, hours: 2, quantity: 1 } }
];

function defaultProductConfig() {
  return {
    vatRate: 15,
    packages: [
      {
        id: "m-box-300",
        sku: "M-BOX300",
        name: "M-BOX300",
        status: "active",
        storageKwh: 0.6,
        panelCount: 1,
        panelWatts: 200,
        loadCapacityW: 300,
        inverterModel: "300W Inverter",
        stock: 24,
        costVt: 42000,
        retailVt: 55000,
        wholesaleVt: 49000,
        featured: true,
        sortOrder: 1
      },
      {
        id: "m-box-1200",
        sku: "M-BOX1200",
        name: "M-BOX1200",
        status: "active",
        storageKwh: 1.2,
        panelCount: 1,
        panelWatts: 550,
        loadCapacityW: 1200,
        inverterModel: "1200W Inverter",
        stock: 16,
        costVt: 86000,
        retailVt: 110000,
        wholesaleVt: 98000,
        featured: true,
        sortOrder: 2
      },
      {
        id: "m-box-1500",
        sku: "M-BOX1500",
        name: "M-BOX1500",
        status: "active",
        storageKwh: 2.56,
        panelCount: 2,
        panelWatts: 550,
        loadCapacityW: 1500,
        inverterModel: "1.5kW Inverter",
        stock: 10,
        costVt: 152000,
        retailVt: 187000,
        wholesaleVt: 168000,
        featured: true,
        sortOrder: 3
      }
    ],
    discounts: [
      {
        id: "discount-new-island",
        name: "New Island Launch",
        description: "All kits 5% off",
        active: true
      },
      {
        id: "discount-rainy-season",
        name: "Rainy Season Promo",
        description: "Fixed VT 15,000 discount",
        active: false
      }
    ]
  };
}

function defaultInventoryData() {
  return {
    shipment: {
      routeLabel: "Guangzhou (CN) to Port Vila (VU)",
      status: "in_transit",
      statusLabel: "In Transit",
      trackingNo: "CN-VU-99283-SOL",
      cargoSummary: "M-BOX kits, panels, cables and accessories",
      originPort: "Guangzhou Port",
      originDate: "2026-03-10",
      transitPort: "Singapore",
      transitDate: "2026-03-18",
      currentZone: "Coral Sea",
      etaDate: "2026-04-08",
      destinationPort: "Port Vila",
      destinationDate: ""
    },
    stockItems: [
      {
        id: "pkg-mbox300",
        name: "M-BOX300",
        sku: "M-BOX300",
        category: "package",
        model: "0.6kWh / 300W inverter / 1 x 200W panel",
        unit: "sets",
        quantity: 24,
        monthlyUsage: 6,
        trendPct: 8,
        threshold: 6,
        status: "healthy",
        unitCostVt: 42000
      },
      {
        id: "pkg-mbox1200",
        name: "M-BOX1200",
        sku: "M-BOX1200",
        category: "package",
        model: "1.2kWh / 1200W inverter / 1 x 550W panel",
        unit: "sets",
        quantity: 16,
        monthlyUsage: 5,
        trendPct: 12,
        threshold: 4,
        status: "healthy",
        unitCostVt: 86000
      },
      {
        id: "pkg-mbox1500",
        name: "M-BOX1500",
        sku: "M-BOX1500",
        category: "package",
        model: "2.56kWh / 1.5kW inverter / 2 x 550W panel",
        unit: "sets",
        quantity: 10,
        monthlyUsage: 4,
        trendPct: 10,
        threshold: 3,
        status: "healthy",
        unitCostVt: 152000
      },
      {
        id: "inv-ls6-2k",
        name: "LS6.2K",
        sku: "INV-LS6.2K",
        category: "inverter",
        model: "Standalone inverter",
        unit: "units",
        quantity: 6,
        monthlyUsage: 2,
        trendPct: 4,
        threshold: 2,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "inv-ls3-6k",
        name: "LS3.6K",
        sku: "INV-LS3.6K",
        category: "inverter",
        model: "Standalone inverter",
        unit: "units",
        quantity: 8,
        monthlyUsage: 2,
        trendPct: 3,
        threshold: 2,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "inv-dml8k",
        name: "DML8K",
        sku: "INV-DML8K",
        category: "inverter",
        model: "Hybrid inverter",
        unit: "units",
        quantity: 5,
        monthlyUsage: 2,
        trendPct: 6,
        threshold: 2,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "pkg-tl6k-10kwh",
        name: "TL6K/10KWH",
        sku: "TL6K-10KWH",
        category: "package",
        model: "6kW inverter / 10kWh storage",
        unit: "sets",
        quantity: 3,
        monthlyUsage: 1,
        trendPct: 5,
        threshold: 1,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "cable-pv-black",
        name: "PV榛戠嚎",
        sku: "PV-BLACK",
        category: "cable",
        model: "Solar PV cable black",
        unit: "m",
        quantity: 3200,
        monthlyUsage: 500,
        trendPct: 8,
        threshold: 800,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "cable-pv-red",
        name: "PV绾㈢嚎",
        sku: "PV-RED",
        category: "cable",
        model: "Solar PV cable red",
        unit: "m",
        quantity: 3000,
        monthlyUsage: 480,
        trendPct: 7,
        threshold: 800,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "acc-mc4-pair",
        name: "MC4 Connector Pair",
        sku: "MC4-PAIR",
        category: "accessory",
        model: "MC4 connector pair",
        unit: "pairs",
        quantity: 220,
        monthlyUsage: 50,
        trendPct: 9,
        threshold: 60,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "acc-pv-2in1",
        name: "PV 2-in-1 Branch Connector",
        sku: "PV-2IN1",
        category: "accessory",
        model: "PV 2-in-1 branch connector",
        unit: "pcs",
        quantity: 60,
        monthlyUsage: 12,
        trendPct: 5,
        threshold: 20,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "acc-pv-3in1",
        name: "PV 3-in-1 Branch Connector",
        sku: "PV-3IN1",
        category: "accessory",
        model: "PV 3-in-1 branch connector",
        unit: "pcs",
        quantity: 44,
        monthlyUsage: 10,
        trendPct: 4,
        threshold: 15,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "acc-breaker",
        name: "绌哄紑",
        sku: "BRK-GEN",
        category: "accessory",
        model: "Mini circuit breaker",
        unit: "pcs",
        quantity: 140,
        monthlyUsage: 24,
        trendPct: 3,
        threshold: 40,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "acc-breaker-box",
        name: "Breaker Box",
        sku: "BRK-BOX",
        category: "accessory",
        model: "Breaker enclosure box",
        unit: "pcs",
        quantity: 48,
        monthlyUsage: 10,
        trendPct: 2,
        threshold: 15,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "acc-combiner-4in1",
        name: "姹囨祦绠卞洓杩涗竴",
        sku: "COMB-4IN1",
        category: "accessory",
        model: "4 in 1 combiner box",
        unit: "pcs",
        quantity: 20,
        monthlyUsage: 5,
        trendPct: 4,
        threshold: 8,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "panel-550w",
        name: "鍏変紡鏉?50W",
        sku: "PANEL-550W",
        category: "solar",
        model: "550W solar panel",
        unit: "pcs",
        quantity: 240,
        monthlyUsage: 60,
        trendPct: 11,
        threshold: 80,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "panel-590w",
        name: "鍏変紡鏉?90W",
        sku: "PANEL-590W",
        category: "solar",
        model: "590W solar panel",
        unit: "pcs",
        quantity: 90,
        monthlyUsage: 24,
        trendPct: 7,
        threshold: 30,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "panel-350w",
        name: "鍏変紡鏉?50W",
        sku: "PANEL-350W",
        category: "solar",
        model: "350W solar panel",
        unit: "pcs",
        quantity: 70,
        monthlyUsage: 18,
        trendPct: 4,
        threshold: 20,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "panel-200w",
        name: "鍏変紡鏉?00W",
        sku: "PANEL-200W",
        category: "solar",
        model: "200W solar panel",
        unit: "pcs",
        quantity: 120,
        monthlyUsage: 20,
        trendPct: 5,
        threshold: 30,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "battery-gel-12v200ah",
        name: "閾呴吀鑳朵綋鐢垫睜12V/200Ah",
        sku: "BAT-GEL-12V200AH",
        category: "battery",
        model: "12V 200Ah gel battery",
        unit: "pcs",
        quantity: 36,
        monthlyUsage: 8,
        trendPct: 2,
        threshold: 12,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "light-hi10",
        name: "Hi10",
        sku: "HI10",
        category: "lighting",
        model: "Portable lighting unit",
        unit: "pcs",
        quantity: 40,
        monthlyUsage: 8,
        trendPct: 3,
        threshold: 12,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "light-hi15",
        name: "Hi15",
        sku: "HI15",
        category: "lighting",
        model: "Portable lighting unit",
        unit: "pcs",
        quantity: 32,
        monthlyUsage: 7,
        trendPct: 3,
        threshold: 10,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "light-hi16",
        name: "Hi16",
        sku: "HI16",
        category: "lighting",
        model: "Portable lighting unit",
        unit: "pcs",
        quantity: 24,
        monthlyUsage: 6,
        trendPct: 2,
        threshold: 8,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "light-hi05",
        name: "Hi05",
        sku: "HI05",
        category: "lighting",
        model: "Portable lighting unit",
        unit: "pcs",
        quantity: 44,
        monthlyUsage: 9,
        trendPct: 4,
        threshold: 12,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "mount-roof",
        name: "灞嬮《鏀灦",
        sku: "MT-ROOF",
        category: "mounting",
        model: "Roof mounting structure",
        unit: "sets",
        quantity: 28,
        monthlyUsage: 6,
        trendPct: 4,
        threshold: 8,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "mount-ground",
        name: "鍦伴潰鏀灦",
        sku: "MT-GROUND",
        category: "mounting",
        model: "Ground mounting structure",
        unit: "sets",
        quantity: 18,
        monthlyUsage: 4,
        trendPct: 3,
        threshold: 6,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "light-ip65-50w",
        name: "IP65鎴峰鐏?0W",
        sku: "LAMP-IP65-50W",
        category: "lighting",
        model: "Outdoor flood light 50W",
        unit: "pcs",
        quantity: 52,
        monthlyUsage: 10,
        trendPct: 5,
        threshold: 15,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "light-thread-led",
        name: "Threaded LED Bulb",
        sku: "LED-THREAD",
        category: "lighting",
        model: "Threaded LED bulb",
        unit: "pcs",
        quantity: 160,
        monthlyUsage: 30,
        trendPct: 6,
        threshold: 50,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "light-holder-8m",
        name: "8绫崇嚎鐏骇",
        sku: "LAMP-HOLDER-8M",
        category: "lighting",
        model: "8m cable lamp holder",
        unit: "pcs",
        quantity: 72,
        monthlyUsage: 15,
        trendPct: 4,
        threshold: 20,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "light-camping",
        name: "Camping Light",
        sku: "LAMP-CAMP",
        category: "lighting",
        model: "Camping lantern",
        unit: "pcs",
        quantity: 60,
        monthlyUsage: 12,
        trendPct: 5,
        threshold: 18,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "acc-charge-3in1",
        name: "3-in-1 Charging Cable",
        sku: "CHARGE-3IN1",
        category: "accessory",
        model: "3 in 1 charging cable",
        unit: "pcs",
        quantity: 110,
        monthlyUsage: 20,
        trendPct: 4,
        threshold: 30,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "light-flash",
        name: "LED Flashlight",
        sku: "FLASH-LED",
        category: "lighting",
        model: "LED flashlight",
        unit: "pcs",
        quantity: 88,
        monthlyUsage: 16,
        trendPct: 4,
        threshold: 24,
        status: "healthy",
        unitCostVt: 0
      },
      {
        id: "acc-yellow-socket",
        name: "榛勮壊鎴峰鎺ョ嚎鎻掑骇",
        sku: "SOCKET-YELLOW-OUT",
        category: "accessory",
        model: "Outdoor wiring socket",
        unit: "pcs",
        quantity: 54,
        monthlyUsage: 12,
        trendPct: 3,
        threshold: 18,
        status: "healthy",
        unitCostVt: 0
      }
    ],
    purchaseOrders: [],
    transactions: [
      {
        id: "TR-20260329-03",
        itemId: "pkg-mbox1200",
        itemName: "M-BOX1200",
        sku: "M-BOX1200",
        type: "outbound",
        typeLabel: "Outbound - Retail Delivery",
        quantityChange: -2,
        quantityText: "-2",
        operator: "Sales Desk",
        timestamp: "2026-03-29T14:30:00+11:00"
      },
      {
        id: "TR-20260329-02",
        itemId: "panel-550w",
        itemName: "鍏変紡鏉?50W",
        sku: "PANEL-550W",
        type: "inbound",
        typeLabel: "Inbound - Container Receipt",
        quantityChange: 60,
        quantityText: "+60",
        operator: "Warehouse",
        timestamp: "2026-03-29T09:12:00+11:00"
      },
      {
        id: "TR-20260328-12",
        itemId: "acc-mc4-pair",
        itemName: "MC4 Connector Pair",
        sku: "MC4-PAIR",
        type: "outbound",
        typeLabel: "Outbound - Rooftop Kit",
        quantityChange: -20,
        quantityText: "-20",
        operator: "A. Molisa",
        timestamp: "2026-03-28T16:30:00+11:00"
      },
      {
        id: "TR-20260328-11",
        itemId: "cable-pv-black",
        itemName: "PV榛戠嚎",
        sku: "PV-BLACK",
        type: "outbound",
        typeLabel: "Outbound - Site Wiring",
        quantityChange: -300,
        quantityText: "-300m",
        operator: "R. Tari",
        timestamp: "2026-03-28T14:15:00+11:00"
      },
      {
        id: "TR-20260328-10",
        itemId: "mount-roof",
        itemName: "灞嬮《鏀灦",
        sku: "MT-ROOF",
        type: "outbound",
        typeLabel: "Outbound - Installation Team",
        quantityChange: -4,
        quantityText: "-4",
        operator: "Install Crew",
        timestamp: "2026-03-28T11:20:00+11:00"
      },
      {
        id: "TR-20260327-09",
        itemId: "battery-gel-12v200ah",
        itemName: "閾呴吀鑳朵綋鐢垫睜12V/200Ah",
        sku: "BAT-GEL-12V200AH",
        type: "inbound",
        typeLabel: "Inbound - Battery Refill",
        quantityChange: 12,
        quantityText: "+12",
        operator: "L. Boe",
        timestamp: "2026-03-27T15:10:00+11:00"
      },
      {
        id: "TR-20260327-08",
        itemId: "light-ip65-50w",
        itemName: "IP65鎴峰鐏?0W",
        sku: "LAMP-IP65-50W",
        type: "outbound",
        typeLabel: "Outbound - Lighting Order",
        quantityChange: -8,
        quantityText: "-8",
        operator: "Retail Shop",
        timestamp: "2026-03-27T09:40:00+11:00"
      }
    ]
  };
}

function defaultRepairOrder() {
  return {
    id: "RE-20240912-042",
    title: "Inverter Array Fault",
    status: "in_progress",
    statusLabel: "Under Maintenance",
    priority: "P1",
    priorityLabel: "Urgent (P1)",
    etaLabel: "Today 17:30",
    description: "Customer reported that inverter group #03 disconnected automatically during peak sunlight hours. Initial inspection shows abnormal bus voltage, likely caused by a blown 100A DC fuse or carbonized contactor.",
    customer: {
      name: "Efate Plantation Ltd",
      phone: "+678 555 0198",
      email: "ops@efateplantation.vu",
      address: "Teouma Road, Efate"
    },
    assignedEngineer: {
      id: "eng-zhang-wei",
      name: "Zhang Wei",
      role: "Field Engineer"
    },
    assetLocation: {
      name: "Solar Park A-03",
      address: "Solar Park A-03, Port Vila",
      coordinates: "17.7333? S, 168.3271? E",
      latitude: -17.7333,
      longitude: 168.3271
    },
    technicianFeedback: "Cooling fan bearing on unit #03 also has abnormal noise. Recommend lubrication and follow-up check during this repair cycle to avoid overheating trips later.",
    notes: [],
    spareParts: [
      {
        id: "repair-fuse-100a",
        name: "Inverter DC Fuse (100A)",
        sku: "SOL-FUSE-100A-DC",
        quantity: 2,
        status: "issued",
        statusLabel: "Issued"
      },
      {
        id: "repair-seal-v2",
        name: "Multi-purpose Connector Seal",
        sku: "SOL-SEAL-V2",
        quantity: 4,
        status: "pending",
        statusLabel: "Pending"
      }
    ],
    timeline: [
      {
        id: "tl-1",
        timeLabel: "Today 14:15",
        title: "In Progress: Internal cleaning and component replacement",
        detail: "Technician: Zhang Wei (L3)",
        type: "current"
      },
      {
        id: "tl-2",
        timeLabel: "Today 13:45",
        title: "On-site diagnosis completed: confirmed blown fuse",
        detail: "Initial conclusion: transient voltage fluctuation",
        type: "done"
      },
      {
        id: "tl-3",
        timeLabel: "Today 11:20",
        title: "Work order assigned",
        detail: "Dispatcher: system auto assignment",
        type: "done"
      },
      {
        id: "tl-4",
        timeLabel: "Yesterday 23:05",
        title: "Customer submitted repair request",
        detail: "Submitted via app",
        type: "start"
      }
    ]
  };
}

function defaultRepairEngineers() {
  return [
    { id: "eng-zhang-wei", name: "Zhang Wei", role: "Field Engineer", phone: "+678 555 0101" },
    { id: "eng-lina-tari", name: "Lina Tari", role: "Senior Technician", phone: "+678 555 0122" },
    { id: "eng-mika-john", name: "Mika John", role: "Service Engineer", phone: "+678 555 0146" }
  ];
}

function defaultRepairSpareParts() {
  return [
    { id: "repair-fuse-100a", name: "Inverter DC Fuse (100A)", sku: "SOL-FUSE-100A-DC", unit: "pcs", stock: 22 },
    { id: "repair-seal-v2", name: "Multi-purpose Connector Seal", sku: "SOL-SEAL-V2", unit: "pcs", stock: 64 },
    { id: "mc4-pair", name: "MC4 Connector Pair", sku: "MC4-PAIR", unit: "pairs", stock: 220 },
    { id: "pv-cable-black", name: "PV Black Cable", sku: "PV-BLACK", unit: "m", stock: 3200 },
    { id: "pv-cable-red", name: "PV Red Cable", sku: "PV-RED", unit: "m", stock: 3000 },
    { id: "ac-breaker", name: "Mini Circuit Breaker", sku: "BRK-GEN", unit: "pcs", stock: 140 }
  ];
}

function defaultSurveyData() {
  return {
    bookings: [
      {
        id: "SV-20260330-001",
        island: "Efate",
        preferredDate: "2026-04-02",
        preferredTime: "09:00-12:00",
        latitude: -17.7333,
        longitude: 168.3167,
        status: "review",
        sitePhotos: [],
        customer: {
          name: "Malo Solar Project",
          phone: "+678 555 0182",
          address: "Port Vila, Efate"
        },
        createdAt: "2026-03-30T08:20:00+11:00"
      }
    ]
  };
}

function defaultEmployeesData() {
  return {
    monthlyTrend: [
      { label: "10月", completed: 28, target: 32 },
      { label: "11月", completed: 24, target: 30 },
      { label: "12月", completed: 35, target: 36 },
      { label: "1月", completed: 18, target: 26 },
      { label: "2月", completed: 31, target: 34 },
      { label: "3月", completed: 38, target: 40 }
    ],
    items: [
      {
        id: "emp-eng-001",
        employeeNo: "VSLM-ENG-20240901",
        name: "陈家成",
        role: "engineer",
        roleLabel: "工程师",
        branch: "Efate 服务中心",
        status: "active",
        statusLabel: "在岗",
        phone: "+678 555 0101",
        email: "chen.jiacheng@vslm.vu",
        hireDate: "2024-09-01",
        skills: ["PV-Expert", "并网安装", "高空作业"],
        metrics: {
          primaryLabel: "完工率",
          primaryValue: "98%",
          secondaryLabel: "本月工单",
          secondaryValue: "42",
          ratingLabel: "客户评分",
          ratingValue: "4.9"
        }
      },
      {
        id: "emp-sales-001",
        employeeNo: "VSLM-SAL-20241105",
        name: "Lina Vatoko",
        role: "sales",
        roleLabel: "销售",
        branch: "Santo 销售点",
        status: "active",
        statusLabel: "在岗",
        phone: "+678 555 0148",
        email: "lina.vatoko@vslm.vu",
        hireDate: "2024-11-05",
        skills: ["Sales-L3", "CRM-Pro", "报价顾问"],
        metrics: {
          primaryLabel: "成交率",
          primaryValue: "100%",
          secondaryLabel: "签约金额",
          secondaryValue: "VT 24.0M",
          ratingLabel: "客户评分",
          ratingValue: "5.0"
        },
        payroll: {
          hourlyRate: 850,
          workHours: 176,
          baseSalary: 0,
          performanceSalary: 0,
          commissionRate: 0.045
        },
        baseDailyRate: 9500,
        advanceBalance: 5000,
        debtBalance: 1500,
        vnpfRate: 4,
        advanceRecords: [
          {
            id: "adv-sales-001-20260321",
            type: "advance",
            amount: 4000,
            date: "2026-03-21",
            note: "门店路演餐补和交通预支",
            approvedBy: "Ruth Moli",
            status: "approved"
          },
          {
            id: "adv-sales-001-20260327",
            type: "advance",
            amount: 2500,
            date: "2026-03-27",
            note: "客户拜访船票与通信费预支",
            approvedBy: "Mele Tari",
            status: "approved"
          },
          {
            id: "adv-sales-001-20260403",
            type: "repayment",
            amount: 1500,
            date: "2026-04-03",
            note: "工资结算回扣第一笔预支",
            approvedBy: "Ruth Moli",
            status: "approved"
          }
        ],
        payrollSettlements: [
          {
            id: "settlement-sales-001-20260316-20260331",
            startDate: "2026-03-16",
            endDate: "2026-03-31",
            grossPay: 114000,
            vnpfDeduction: 4560,
            advanceDeduction: 0,
            debtDeduction: 0,
            netPay: 109440,
            status: "paid",
            paidAt: "2026-04-01T17:30:00+11:00",
            note: "三月下半月已发放"
          }
        ]
      },
      {
        id: "emp-sales-mgr-001",
        employeeNo: "VSLM-MGR-20240218",
        name: "Mele Tari",
        role: "sales_manager",
        roleLabel: "销售经理",
        branch: "Port Vila 总部",
        status: "active",
        statusLabel: "在岗",
        phone: "+678 555 0208",
        email: "mele.tari@vslm.vu",
        hireDate: "2024-02-18",
        skills: ["区域管理", "渠道策略", "重点客户"],
        metrics: {
          primaryLabel: "团队达成",
          primaryValue: "94%",
          secondaryLabel: "团队签约",
          secondaryValue: "VT 58.4M",
          ratingLabel: "团队评分",
          ratingValue: "4.8"
        }
      },
      {
        id: "emp-admin-001",
        employeeNo: "VSLM-ADM-20230112",
        name: "Ruth Moli",
        role: "admin",
        roleLabel: "管理员",
        branch: "Port Vila 总部",
        status: "active",
        statusLabel: "在岗",
        phone: "+678 555 0180",
        email: "ruth.moli@vslm.vu",
        hireDate: "2023-01-12",
        skills: ["系统权限", "流程审批", "报表管理"],
        metrics: {
          primaryLabel: "流程及时率",
          primaryValue: "97%",
          secondaryLabel: "本月审批",
          secondaryValue: "186",
          ratingLabel: "协作评分",
          ratingValue: "4.7"
        }
      },
      {
        id: "emp-eng-002",
        employeeNo: "VSLM-ENG-20241212",
        name: "Jean-Marc",
        role: "engineer",
        roleLabel: "工程师",
        branch: "Malekula 服务点",
        status: "training",
        statusLabel: "培训中",
        phone: "+678 555 0196",
        email: "jean.marc@vslm.vu",
        hireDate: "2024-12-12",
        skills: ["现场排障", "电池维护"],
        metrics: {
          primaryLabel: "响应时效",
          primaryValue: "2.4h",
          secondaryLabel: "修复率",
          secondaryValue: "85%",
          ratingLabel: "客户评分",
          ratingValue: "4.2"
        }
      },
      {
        id: "emp-sales-002",
        employeeNo: "VSLM-SAL-20240815",
        name: "Tom Bani",
        role: "sales",
        roleLabel: "销售",
        branch: "Tanna 销售点",
        status: "leave",
        statusLabel: "休假",
        phone: "+678 555 0161",
        email: "tom.bani@vslm.vu",
        hireDate: "2024-08-15",
        skills: ["门店销售", "客户回访"],
        metrics: {
          primaryLabel: "成交率",
          primaryValue: "88%",
          secondaryLabel: "签约金额",
          secondaryValue: "VT 12.6M",
          ratingLabel: "客户评分",
          ratingValue: "4.5"
        }
      }
    ]
  };
}

function defaultRbacData() {
  return {
    employeeAccess: [
      {
        employeeId: "emp-admin-001",
        securityLevel: 3,
        accessEnabled: true,
        roleOverride: "admin",
        branchScope: "Port Vila 总部"
      },
      {
        employeeId: "emp-sales-mgr-001",
        securityLevel: 2,
        accessEnabled: true,
        roleOverride: "sales_manager",
        branchScope: "Port Vila 总部"
      },
      {
        employeeId: "emp-eng-001",
        securityLevel: 1,
        accessEnabled: true,
        roleOverride: "engineer",
        branchScope: "Efate 服务中心"
      },
      {
        employeeId: "emp-sales-001",
        securityLevel: 1,
        accessEnabled: true,
        roleOverride: "sales",
        branchScope: "Santo 销售点"
      }
    ],
    moduleMatrix: [
      { key: "inventory_sync", label: "库存全岛同步授权", enabled: true, group: "inventory" },
      { key: "remote_dispatch", label: "外岛维修派单权限", enabled: true, group: "inventory" },
      { key: "emergency_logistics_lock", label: "紧急物流优先锁定", enabled: false, group: "inventory" },
      { key: "finance_pool_edit", label: "财务资金池修改权", enabled: false, group: "finance" },
      { key: "offline_sync", label: "离线数据同步授权", enabled: true, group: "finance" },
      { key: "sensitive_customer_access", label: "高敏感客户隐私访问", enabled: false, group: "finance" }
    ],
    ipWhitelist: [
      { id: "ip-port-vila", label: "Port Vila Headquarters", cidr: "202.43.20.0/24", status: "active" },
      { id: "ip-santo", label: "Santo Logistics Center", cidr: "103.11.12.0/24", status: "active" },
      { id: "ip-tanna", label: "Tanna Satellite Office", cidr: "Unset (Dynamic)", status: "draft" }
    ],
    emergencyLocked: false,
    auditLogs: [
      {
        id: "audit-rbac-001",
        action: "初始化角色矩阵",
        actor: "系统",
        createdAt: "2026-03-30T07:20:00+11:00"
      },
      {
        id: "audit-rbac-002",
        action: "更新 Port Vila 总部白名单",
        actor: "管理员",
        createdAt: "2026-03-30T08:15:00+11:00"
      }
    ]
  };
}

function defaultCustomersData() {
  return {
    items: [
      {
        id: "merchant-port-vila-solar-mart",
        archiveNo: "VSLM-WHOLESALE-2026-001",
        name: "Port Vila Solar Mart",
        contactName: "Moses Tari",
        phone: "+678 771 2201",
        email: "orders@solarmart.vu",
        province: "Shefa Province",
        location: "Port Vila",
        address: "Kumul Highway, Port Vila, Vanuatu",
        usageType: "本地批发商",
        customerType: "local_wholesale",
        customerTypeLabel: "本地商家",
        installDate: "2026-03-12",
        salesPersonId: "emp-sales-001",
        salesPersonName: "Lina Vatoko",
        payment: {
          cycleLabel: "批发月结",
          completedWeeks: 0,
          totalWeeks: 4,
          paidAmount: 0,
          balanceAmount: 196000,
          nextDueLabel: "月末结算"
        },
        orders: [
          { id: "WHO-20260312-001", name: "M-BOX1200 x 2", status: "待付款", date: "2026-03-12" }
        ],
        devices: [],
        photos: [],
        warrantyHistory: [],
        warrantyEndsAt: ""
      },
      {
        id: "merchant-santo-energy-shop",
        archiveNo: "VSLM-WHOLESALE-2026-002",
        name: "Santo Energy Shop",
        contactName: "Lio Sam",
        phone: "+678 772 1188",
        email: "sales@santoenergy.vu",
        province: "Sanma Province",
        location: "Luganville",
        address: "Main Street, Luganville, Santo, Vanuatu",
        usageType: "本地批发商",
        customerType: "local_wholesale",
        customerTypeLabel: "本地商家",
        installDate: "2026-03-15",
        salesPersonId: "emp-sales-mgr-001",
        salesPersonName: "Mele Tari",
        payment: {
          cycleLabel: "批发月结",
          completedWeeks: 1,
          totalWeeks: 4,
          paidAmount: 168000,
          balanceAmount: 168000,
          nextDueLabel: "周五 16:00"
        },
        orders: [
          { id: "WHO-20260315-001", name: "M-BOX1500 x 2", status: "部分收款", date: "2026-03-15" }
        ],
        devices: [],
        photos: [],
        warrantyHistory: [],
        warrantyEndsAt: ""
      },
      {
        id: "crm-emae-village-center",
        archiveNo: "VSLM-CRM-2024-089",
        name: "Emae Village Center",
        contactName: "Samuel Kalo",
        phone: "+678 555 0123",
        email: "samuel.kalo@emae.vu",
        province: "Shefa Province",
        location: "Emae Island, Vanuatu",
        address: "Emae Village Center, Shefa Province, Vanuatu",
        usageType: "社区公共用电",
        installDate: "2024-01-15",
        salesPersonId: "emp-sales-001",
        salesPersonName: "Lina Vatoko",
        payment: {
          cycleLabel: "Weekly",
          completedWeeks: 26,
          totalWeeks: 52,
          paidAmount: 145000,
          balanceAmount: 145000,
          nextDueLabel: "周四 09:00"
        },
        orders: [
          { id: "ORD-99201", name: "Helios 5kW 套装", status: "已完成", date: "2024-01-15" },
          { id: "ORD-88122", name: "备用储能电池单元", status: "退款记录", date: "2024-03-02" }
        ],
        devices: [
          { id: "dev-main-controller", type: "主控制器", name: "主控制器", sn: "HEL-882-C1" },
          { id: "dev-panel-a", type: "太阳能板", name: "太阳能板 A", sn: "PNL-VX-001" },
          { id: "dev-panel-b", type: "太阳能板", name: "太阳能板 B", sn: "PNL-VX-002" },
          { id: "dev-battery", type: "储能电池", name: "锂电池", sn: "BAT-LITH-440" }
        ],
        photos: [
          {
            id: "photo-site-1",
            title: "实景外观",
            takenAt: "2024-01-15 14:30",
            imageUrl: "https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=1200&q=80"
          },
          {
            id: "photo-site-2",
            title: "配电箱细节",
            takenAt: "2024-01-15 15:45",
            imageUrl: "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=1200&q=80"
          }
        ],
        warrantyHistory: [
          { id: "war-1", title: "逆变器固件更新", detail: "2024-03-22 / 远程执行", date: "2024-03-22" },
          { id: "war-2", title: "清洁与物理检查", detail: "2024-06-10 / 工程师 Tom V.", date: "2024-06-10" },
          { id: "war-3", title: "预约年度性能评估", detail: "计划中 / 2025-01-15", date: "2025-01-15" }
        ],
        warrantyEndsAt: "2026-01-15"
      },
      {
        id: "crm-malo-solar-coop",
        archiveNo: "VSLM-CRM-2024-146",
        name: "Malo Solar Coop",
        contactName: "Risa Molou",
        phone: "+678 555 0168",
        email: "risa@malo.coop",
        province: "Sanma Province",
        location: "Malo Island, Vanuatu",
        address: "Malo Solar Coop, Sanma Province, Vanuatu",
        usageType: "社区微网",
        installDate: "2024-05-09",
        salesPersonId: "emp-sales-mgr-001",
        salesPersonName: "Mele Tari",
        payment: {
          cycleLabel: "Monthly",
          completedWeeks: 8,
          totalWeeks: 12,
          paidAmount: 820000,
          balanceAmount: 210000,
          nextDueLabel: "4月 05日"
        },
        orders: [
          { id: "ORD-10551", name: "M-BOX1500 x 12", status: "履约中", date: "2024-05-09" },
          { id: "ORD-10628", name: "屋顶支架补充件", status: "已完成", date: "2024-06-11" }
        ],
        devices: [
          { id: "malo-ctrl", type: "主控制器", name: "主控制器", sn: "HEL-MALO-201" },
          { id: "malo-panel", type: "太阳能板阵列", name: "550W 阵列", sn: "PNL-MALO-55X" },
          { id: "malo-battery", type: "储能电池", name: "储能电池组", sn: "BAT-MALO-18" }
        ],
        photos: [
          {
            id: "photo-malo-1",
            title: "机房外部",
            takenAt: "2024-05-09 11:20",
            imageUrl: "https://images.unsplash.com/photo-1497436072909-f5e4be0b1c5e?auto=format&fit=crop&w=1200&q=80"
          }
        ],
        warrantyHistory: [
          { id: "war-m1", title: "阵列巡检", detail: "2024-07-14 / 正常", date: "2024-07-14" }
        ],
        warrantyEndsAt: "2027-05-09"
      },
      {
        id: "crm-tanna-heights-lodge",
        archiveNo: "VSLM-CRM-2025-018",
        name: "Tanna Heights Lodge",
        contactName: "Jean Vira",
        phone: "+678 555 0221",
        email: "ops@tannaheights.vu",
        province: "Tafea Province",
        location: "Tanna Island, Vanuatu",
        address: "Tanna Heights Lodge, Tafea Province, Vanuatu",
        usageType: "酒店商用",
        installDate: "2025-01-08",
        salesPersonId: "emp-sales-002",
        salesPersonName: "Tom Bani",
        payment: {
          cycleLabel: "Monthly",
          completedWeeks: 3,
          totalWeeks: 6,
          paidAmount: 360000,
          balanceAmount: 360000,
          nextDueLabel: "周一 15:00"
        },
        orders: [
          { id: "ORD-12018", name: "LS6.2K + 10kWh 套装", status: "已完成", date: "2025-01-08" }
        ],
        devices: [
          { id: "tanna-main", type: "主控制器", name: "主控制器", sn: "HEL-TAN-801" },
          { id: "tanna-panels", type: "太阳能板阵列", name: "590W 阵列", sn: "PNL-TAN-590" }
        ],
        photos: [
          {
            id: "photo-tan-1",
            title: "屋顶阵列",
            takenAt: "2025-01-08 16:12",
            imageUrl: "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=1200&q=80"
          }
        ],
        warrantyHistory: [
          { id: "war-t1", title: "年度保养待排期", detail: "计划中 / 2026-01-10", date: "2026-01-10" }
        ],
        warrantyEndsAt: "2028-01-08"
      }
    ]
  };
}

function defaultVendorsData() {
  return {
    items: [
      {
        id: "vendor-shenzhen-solar",
        name: "赛力斯光伏技术（深圳）",
        region: "中国港口供应商",
        locationTag: "深圳 / 盐田港",
        reliabilityScore: 98.5,
        category: "太阳能板",
        secondaryCategory: "逆变器组件",
        contactName: "陈建国",
        contactRole: "采购总监",
        contactPhone: "+86 138 1100 2201",
        pendingOrders: 4,
        inTransitOrders: 4,
        transitMode: "中国港口直达",
        isActive: true,
        leadTimeDays: 18,
        minOrderVt: 120000,
        supportedItems: ["光伏板550W", "光伏板590W", "光伏板350W", "光伏板200W", "M-BOX300", "M-BOX1200", "M-BOX1500"]
      },
      {
        id: "vendor-ningbo-battery",
        name: "东极能源系统有限公司",
        region: "中国港口供应商",
        locationTag: "宁波 / 北仑港",
        reliabilityScore: 92.0,
        category: "蓄电池组",
        secondaryCategory: "储能柜",
        contactName: "Li Na",
        contactRole: "海外商务",
        contactPhone: "+86 139 4400 1808",
        pendingOrders: 2,
        inTransitOrders: 2,
        transitMode: "中国港口直达",
        isActive: true,
        leadTimeDays: 22,
        minOrderVt: 180000,
        supportedItems: ["LS6.2K", "LS3.6K", "DML8K", "TL6K/10KWH", "铅酸胶体电池12V/200Ah", "M-BOX300", "M-BOX1200", "M-BOX1500"]
      },
      {
        id: "vendor-guangzhou-cable",
        name: "广州安联线缆配件",
        region: "中国港口供应商",
        locationTag: "广州 / 南沙港",
        reliabilityScore: 93.6,
        category: "PV线材",
        secondaryCategory: "连接器配件",
        contactName: "Zhou Ming",
        contactRole: "外贸主管",
        contactPhone: "+86 137 2660 8812",
        pendingOrders: 3,
        inTransitOrders: 2,
        transitMode: "中国港口直达",
        isActive: true,
        leadTimeDays: 16,
        minOrderVt: 90000,
        supportedItems: ["PV黑线", "PV红线", "MC4接头/双", "PV二合一转接线", "PV三合一转接线", "空开", "空开盒", "汇流箱四进一"]
      },
      {
        id: "vendor-pacific-green",
        name: "Pacific Green Logistics",
        region: "维拉港本地供应商",
        locationTag: "维拉港 / 本地",
        reliabilityScore: 96.8,
        category: "末端配送",
        secondaryCategory: "安装维护",
        contactName: "Samuel Kalo",
        contactRole: "本地协调",
        contactPhone: "+678 555 1042",
        pendingOrders: 7,
        inTransitOrders: 0,
        transitMode: "本地网络",
        isActive: true,
        leadTimeDays: 3,
        minOrderVt: 30000,
        supportedItems: ["末端配送服务", "仓储转运", "上门送货"]
      },
      {
        id: "vendor-vse-local",
        name: "维拉港太阳能工程（VSE）",
        region: "维拉港本地供应商",
        locationTag: "维拉港 / 本地",
        reliabilityScore: 94.8,
        category: "安装工程",
        secondaryCategory: "本地服务",
        contactName: "Tom V.",
        contactRole: "服务经理",
        contactPhone: "+678 555 0196",
        pendingOrders: 8,
        inTransitOrders: 0,
        transitMode: "本地网络",
        isActive: true,
        leadTimeDays: 2,
        minOrderVt: 25000,
        supportedItems: ["上门安装", "现场支架施工", "系统调试", "屋顶支架", "地面支架"]
      },
      {
        id: "vendor-shanghai-logistics",
        name: "上海联达海运",
        region: "中国港口供应商",
        locationTag: "上海 / 洋山港",
        reliabilityScore: 88.2,
        category: "海上运输",
        secondaryCategory: "物流",
        contactName: "Wang Jun",
        contactRole: "航运协调",
        contactPhone: "+86 136 7177 6205",
        pendingOrders: 3,
        inTransitOrders: 6,
        transitMode: "中国港口直达",
        isActive: true,
        leadTimeDays: 26,
        minOrderVt: 80000,
        supportedItems: ["集装箱海运", "拼柜运输", "到港清关协调"]
      }
    ],
    orders: [
      {
        id: "PO-20260330-001",
        vendorId: "vendor-shenzhen-solar",
        vendorName: "赛力斯光伏技术（深圳）",
        currency: "CNY",
        totalAmount: 51600,
        status: "pending",
        statusLabel: "待审批",
        requestedBy: "采购中心",
        createdAt: "2026-03-30T14:20:00+11:00",
        notes: "补充四月安装批次",
        lines: [
          { itemName: "光伏板550W", quantity: 120, unit: "pcs", unitPrice: 430, currency: "CNY", lineTotal: 51600 }
        ]
      },
      {
        id: "PO-20260329-003",
        vendorId: "vendor-ningbo-battery",
        vendorName: "东极能源系统有限公司",
        currency: "USD",
        totalAmount: 3840,
        status: "in_transit",
        statusLabel: "海运在途",
        requestedBy: "仓储经理",
        createdAt: "2026-03-29T11:05:00+11:00",
        notes: "跟并柜批次一同到港",
        lines: [
          { itemName: "铅酸胶体电池12V/200Ah", quantity: 24, unit: "pcs", unitPrice: 160, currency: "USD", lineTotal: 3840 }
        ]
      },
      {
        id: "PO-20260328-006",
        vendorId: "vendor-pacific-green",
        vendorName: "Pacific Green Logistics",
        currency: "USD",
        totalAmount: 900,
        status: "approved",
        statusLabel: "已下单执行",
        requestedBy: "销售工作台",
        createdAt: "2026-03-28T09:40:00+11:00",
        notes: "覆盖本周 6 个客户点位",
        lines: [
          { itemName: "末端配送服务", quantity: 6, unit: "jobs", unitPrice: 150, currency: "USD", lineTotal: 900 }
        ]
      }
    ]
  };
}

function defaultWholesaleData() {
  return {
    orders: [
      {
        id: "WHO-20260312-001",
        merchantId: "merchant-port-vila-solar-mart",
        merchantName: "Port Vila Solar Mart",
        salesPersonId: "emp-sales-001",
        salesPersonName: "Lina Vatoko",
        packageId: "m-box-1200",
        packageName: "M-BOX1200",
        quantity: 2,
        unitPriceVt: 98000,
        totalVt: 196000,
        status: "pending_payment",
        statusLabel: "待付款",
        currency: "VUV",
        createdAt: "2026-03-12T10:20:00+11:00",
        notes: "首批门店铺货"
      },
      {
        id: "WHO-20260315-001",
        merchantId: "merchant-santo-energy-shop",
        merchantName: "Santo Energy Shop",
        salesPersonId: "emp-sales-mgr-001",
        salesPersonName: "Mele Tari",
        packageId: "m-box-1500",
        packageName: "M-BOX1500",
        quantity: 2,
        unitPriceVt: 168000,
        totalVt: 336000,
        status: "partial_paid",
        statusLabel: "部分收款",
        currency: "VUV",
        createdAt: "2026-03-15T14:10:00+11:00",
        notes: "Santo 展示店补货"
      }
    ]
  };
}

function defaultBackupSettings() {
  return {
    autoDaily: true,
    autoWeekly: true,
    googleDriveEnabled: false,
    googleDriveFolderId: "",
    googleDriveAccessToken: "",
    lastDailyBackupAt: "",
    lastWeeklyBackupAt: ""
  };
}

function defaultAttendanceSettings() {
  return {
    enabledWeekdays: [1, 2, 3, 4, 5],
    checkInStart: "08:30",
    checkInEnd: "10:00",
    checkOutStart: "17:00",
    checkOutEnd: "21:00",
    enforceTimeWindow: false,
    requireLocation: true
  };
}

function sanitizeBackupSettings(settings = {}) {
  return {
    ...settings,
    backup: {
      ...defaultBackupSettings(),
      ...(settings.backup || {}),
      googleDriveAccessToken: ""
    }
  };
}

function sanitizeSavedQuotesForBackup(items = []) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    settings: item?.settings ? sanitizeBackupSettings(item.settings) : item?.settings
  }));
}

function defaultCompanyProfile() {
  return {
    name: "VSLM Solar & Logistics",
    tin: "",
    bankName: "",
    bankAccountName: "",
    bankAccountNumber: "",
    address: "Port Vila, Vanuatu",
    phone: "",
    email: "",
    logoUrl: ""
  };
}

function defaultRepairOrders() {
  return {
    items: [defaultRepairOrder()]
  };
}

function defaultExpenseControlData() {
  return {
    paymentQueue: [
      { id: "ORD-88291", customer: "John T. Malvatumauri", amount: 45000, createdAt: "2026-03-24T14:20:00+11:00", status: "待审核" },
      { id: "ORD-88304", customer: "Efate Solar Co-op", amount: 128500, createdAt: "2026-03-24T11:05:00+11:00", status: "已核销" },
      { id: "ORD-88310", customer: "Samuel K. Rau", amount: 12000, createdAt: "2026-03-24T09:15:00+11:00", status: "已核销" }
    ],
    installmentPlans: [
      { id: "plan-home-a", name: "家庭能源套装 A", cycleLabel: "52 周计划", completedWeeks: 38, totalWeeks: 52, progress: 73.1, totalAmount: 240000, status: "履约中" },
      { id: "plan-villa-b", name: "村落微电网系统", cycleLabel: "26 周计划", completedWeeks: 24, totalWeeks: 26, progress: 92.3, totalAmount: 1200000, status: "即将结清" },
      { id: "plan-cold-1", name: "便携式农用储能组", cycleLabel: "52 周计划", completedWeeks: 12, totalWeeks: 26, progress: 46.2, totalAmount: 55000, status: "逾期风险" },
      { id: "plan-market-4", name: "商务型太阳能末端", cycleLabel: "52 周计划", completedWeeks: 15, totalWeeks: 52, progress: 28.8, totalAmount: 85000, status: "履约中" }
    ],
    commissionPool: [
      { id: "com-001", name: "Alick M.", role: "销售经理", type: "sales", amount: 120000, releaseRate: 98.2, releasedAmount: 117840, lockedAmount: 2160, releaseStatus: "申请释放" },
      { id: "com-002", name: "Jean S.", role: "销售", type: "sales", amount: 78000, releaseRate: 64.5, releasedAmount: 50310, lockedAmount: 27690, releaseStatus: "锁定中" },
      { id: "com-003", name: "Tom V.", role: "工程师", type: "engineer", amount: 24000, releaseRate: 100, releasedAmount: 24000, lockedAmount: 0, releaseStatus: "已释放" }
    ],
    transactionLogs: [
      { id: "TRX-009212", type: "分期还款", customer: "Kasper Toara", amount: 8500, status: "已到账" },
      { id: "TRX-009211", type: "首付款", customer: "Luganville Solar Center", amount: 150000, status: "待核销" },
      { id: "TRX-009208", type: "佣金扣减", customer: "Sales Rep: Jean S.", amount: -4200, status: "坏账抵扣" }
    ],
    livingCosts: [
      { id: "LIFE-001", name: "员工宿舍与餐补", category: "生活成本", amount: 185000, status: "已入账", note: "3 月员工生活补贴" },
      { id: "LIFE-002", name: "办公区水电网", category: "生活成本", amount: 92000, status: "待支付", note: "Port Vila 办公点" },
      { id: "LIFE-003", name: "员工通勤与船票", category: "生活成本", amount: 46000, status: "已入账", note: "外岛往返交通" }
    ],
    taxes: [
      { id: "TAX-001", name: "VAT 申报", period: "2026-03", amount: 126000, status: "待申报" },
      { id: "TAX-002", name: "工资税", period: "2026-03", amount: 88000, status: "已申报" },
      { id: "TAX-003", name: "进口税费", period: "2026-03", amount: 143000, status: "处理中" }
    ],
    invoices: [
      { id: "INV-3001", customer: "Emae Village Center", amount: 428500, issuedAt: "2026-03-22T10:00:00+11:00", status: "已开票" },
      { id: "INV-3002", customer: "Tanna Heights Lodge", amount: 245000, issuedAt: "2026-03-23T13:00:00+11:00", status: "待开票" },
      { id: "INV-3003", customer: "Malo Solar Coop", amount: 150000, issuedAt: "2026-03-24T09:00:00+11:00", status: "已开票" }
    ],
    rentLedger: [
      { id: "RENT-001", location: "Port Vila 办公室", month: "2026-03", amount: 120000, status: "已支付" },
      { id: "RENT-002", location: "仓库与备件间", month: "2026-03", amount: 86000, status: "待支付" },
      { id: "RENT-003", location: "Santo 服务点", month: "2026-03", amount: 54000, status: "已支付" }
    ]
  };
}

function mergeRecordsById(existing = [], incoming = []) {
  const map = new Map();
  for (const item of Array.isArray(existing) ? existing : []) {
    const id = String(item?.id || "").trim();
    if (id) map.set(id, item);
  }
  for (const item of Array.isArray(incoming) ? incoming : []) {
    const id = String(item?.id || "").trim();
    if (id) map.set(id, item);
  }
  return Array.from(map.values());
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  if (!fs.existsSync(SAVES_FILE)) fs.writeFileSync(SAVES_FILE, "[]", "utf8");
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(
        {
          audToVuv: 80,
          nzdToVuv: 72,
          quoteDisplayMode: "tax_inclusive",
          homepage: "dashboard",
          backup: defaultBackupSettings(),
          company: defaultCompanyProfile()
        },
        null,
        2
      ),
      "utf8"
    );
  }
  if (!fs.existsSync(COMPANY_FILE)) {
    fs.writeFileSync(COMPANY_FILE, JSON.stringify(defaultCompanyProfile(), null, 2), "utf8");
  }
  if (!fs.existsSync(PRODUCT_CONFIG_FILE)) {
    fs.writeFileSync(PRODUCT_CONFIG_FILE, JSON.stringify(defaultProductConfig(), null, 2), "utf8");
  }
  if (!fs.existsSync(INVENTORY_FILE)) {
    fs.writeFileSync(INVENTORY_FILE, JSON.stringify(defaultInventoryData(), null, 2), "utf8");
  }
if (!fs.existsSync(REPAIR_FILE)) {
  fs.writeFileSync(REPAIR_FILE, JSON.stringify(defaultRepairOrder(), null, 2), "utf8");
}
  if (!fs.existsSync(REPAIR_ORDERS_FILE)) {
    fs.writeFileSync(REPAIR_ORDERS_FILE, JSON.stringify(defaultRepairOrders(), null, 2), "utf8");
  }
  if (!fs.existsSync(SURVEY_FILE)) {
    fs.writeFileSync(SURVEY_FILE, JSON.stringify(defaultSurveyData(), null, 2), "utf8");
  }
  if (!fs.existsSync(EMPLOYEES_FILE)) {
    fs.writeFileSync(EMPLOYEES_FILE, JSON.stringify(defaultEmployeesData(), null, 2), "utf8");
  }
  if (!fs.existsSync(RBAC_FILE)) {
    fs.writeFileSync(RBAC_FILE, JSON.stringify(defaultRbacData(), null, 2), "utf8");
  }
  if (!fs.existsSync(CUSTOMERS_FILE)) {
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(defaultCustomersData(), null, 2), "utf8");
  }
if (!fs.existsSync(VENDORS_FILE)) {
  fs.writeFileSync(VENDORS_FILE, JSON.stringify(defaultVendorsData(), null, 2), "utf8");
}
if (!fs.existsSync(WHOLESALE_FILE)) {
  fs.writeFileSync(WHOLESALE_FILE, JSON.stringify(defaultWholesaleData(), null, 2), "utf8");
}
  if (!fs.existsSync(EXPENSE_CONTROL_FILE)) {
    fs.writeFileSync(EXPENSE_CONTROL_FILE, JSON.stringify(defaultExpenseControlData(), null, 2), "utf8");
  }
  if (!fs.existsSync(FIELD_TRACKS_FILE)) {
    fs.writeFileSync(FIELD_TRACKS_FILE, JSON.stringify(DEMO_ATTENDANCE_DATA.tracks, null, 2), "utf8");
  }
  if (!fs.existsSync(FIELD_VISITS_FILE)) {
    fs.writeFileSync(FIELD_VISITS_FILE, JSON.stringify(DEMO_ATTENDANCE_DATA.visits, null, 2), "utf8");
  }
  if (!fs.existsSync(FIELD_CHECKINS_FILE)) {
    fs.writeFileSync(FIELD_CHECKINS_FILE, JSON.stringify(DEMO_ATTENDANCE_DATA.checkins, null, 2), "utf8");
  }
if (!fs.existsSync(BACKUP_INDEX_FILE)) {
  fs.writeFileSync(BACKUP_INDEX_FILE, JSON.stringify({ items: [] }, null, 2), "utf8");
}
}

function resolveWritableDataPath(filePath) {
  if (!RUNTIME_DATA_DIR) return filePath;
  const normalizedSource = path.resolve(filePath);
  const normalizedDataDir = path.resolve(DATA_DIR);
  if (!normalizedSource.startsWith(normalizedDataDir)) return filePath;
  const relativePath = path.relative(normalizedDataDir, normalizedSource);
  const runtimePath = path.join(RUNTIME_DATA_DIR, relativePath);
  const runtimeDir = path.dirname(runtimePath);
  if (!fs.existsSync(runtimeDir)) {
    fs.mkdirSync(runtimeDir, { recursive: true });
  }
  if (!fs.existsSync(runtimePath) && fs.existsSync(normalizedSource)) {
    fs.copyFileSync(normalizedSource, runtimePath);
  }
  return runtimePath;
}

function readJson(filePath, fallback) {
  ensureDataDir();
  return documentStore.read(filePath, fallback);
}

function writeJson(filePath, value) {
  ensureDataDir();
  documentStore.write(filePath, value);
}

async function ensureFieldStoreReady() {
  if (!fieldStore.isEnabled()) return false;
  const mergedTrackDocs = mergeRecordsById(readJson(FIELD_TRACKS_FILE, DEMO_ATTENDANCE_DATA.tracks), DEMO_ATTENDANCE_DATA.tracks);
  const mergedVisitDocs = mergeRecordsById(readJson(FIELD_VISITS_FILE, DEMO_ATTENDANCE_DATA.visits), DEMO_ATTENDANCE_DATA.visits);
  const mergedCheckinDocs = mergeRecordsById(readJson(FIELD_CHECKINS_FILE, DEMO_ATTENDANCE_DATA.checkins), DEMO_ATTENDANCE_DATA.checkins);

  writeJson(FIELD_TRACKS_FILE, mergedTrackDocs);
  writeJson(FIELD_VISITS_FILE, mergedVisitDocs);
  writeJson(FIELD_CHECKINS_FILE, mergedCheckinDocs);

  await fieldStore.ensureReady({
    tracks: mergedTrackDocs,
    visits: mergedVisitDocs,
    checkins: mergedCheckinDocs
  });

  if (!fieldDemoSeeded) {
    if (!fieldDemoSeedPromise) {
      fieldDemoSeedPromise = (async () => {
        const [dbTracks, dbVisits, dbCheckins] = await Promise.all([
          fieldStore.listTracks({}),
          fieldStore.listVisits({}),
          fieldStore.listCheckins({})
        ]);
        const nextTracks = mergeRecordsById(dbTracks, DEMO_ATTENDANCE_DATA.tracks);
        const nextVisits = mergeRecordsById(dbVisits, DEMO_ATTENDANCE_DATA.visits);
        const nextCheckins = mergeRecordsById(dbCheckins, DEMO_ATTENDANCE_DATA.checkins);
        const changed = nextTracks.length !== dbTracks.length
          || nextVisits.length !== dbVisits.length
          || nextCheckins.length !== dbCheckins.length;

        if (changed) {
          await fieldStore.replaceAll({
            tracks: nextTracks,
            visits: nextVisits,
            checkins: nextCheckins
          });
          writeJson(FIELD_TRACKS_FILE, nextTracks);
          writeJson(FIELD_VISITS_FILE, nextVisits);
          writeJson(FIELD_CHECKINS_FILE, nextCheckins);
        }

        fieldDemoSeeded = true;
        return true;
      })().catch((error) => {
        fieldDemoSeedPromise = null;
        throw error;
      });
    }
    await fieldDemoSeedPromise;
  }
  return true;
}

async function getFieldTracksData({ userId = "", dateKey = "" } = {}) {
  if (fieldStore.isEnabled()) {
    await ensureFieldStoreReady();
    return fieldStore.listTracks({ userId, dateKey });
  }
  return readJson(FIELD_TRACKS_FILE, []).filter((item) => (!userId || item.userId === userId) && (!dateKey || item.date === dateKey));
}

async function getFieldVisitsData({ userId = "", dateKey = "" } = {}) {
  if (fieldStore.isEnabled()) {
    await ensureFieldStoreReady();
    return fieldStore.listVisits({ userId, dateKey });
  }
  return readJson(FIELD_VISITS_FILE, []).filter((item) => (!userId || item.userId === userId) && (!dateKey || String(item.recordedAt || "").startsWith(dateKey)));
}

async function getFieldCheckinsData({ userId = "", dateKey = "" } = {}) {
  if (fieldStore.isEnabled()) {
    await ensureFieldStoreReady();
    return fieldStore.listCheckins({ userId, dateKey });
  }
  return readJson(FIELD_CHECKINS_FILE, []).filter((item) => (!userId || item.userId === userId) && (!dateKey || item.date === dateKey));
}

async function syncFieldDocumentsFromStore() {
  if (!fieldStore.isEnabled()) return;
  const [tracks, visits, checkins] = await Promise.all([
    fieldStore.listTracks({}),
    fieldStore.listVisits({}),
    fieldStore.listCheckins({})
  ]);
  writeJson(FIELD_TRACKS_FILE, tracks);
  writeJson(FIELD_VISITS_FILE, visits);
  writeJson(FIELD_CHECKINS_FILE, checkins);
}

async function ensureCrmStoreReady() {
  if (!crmStore.isEnabled()) return false;
  await crmStore.ensureReady({
    customers: getCustomersData().items,
    invoices: getInvoicesData()
  });
  return true;
}

async function getCustomersDataAsync() {
  if (crmStore.isEnabled()) {
    await ensureCrmStoreReady();
    const items = (await crmStore.listCustomers()).map(normalizeCustomerRecord);
    return {
      items,
      summary: buildCustomerSummary(items)
    };
  }
  return getCustomersData();
}

async function getInvoicesDataAsync() {
  if (crmStore.isEnabled()) {
    await ensureCrmStoreReady();
    return (await crmStore.listInvoices())
      .map(normalizeInvoiceRecord)
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  }
  return getInvoicesData();
}

async function syncCrmDocumentsFromStore() {
  if (!crmStore.isEnabled()) return;
  const [customers, invoices] = await Promise.all([
    crmStore.listCustomers(),
    crmStore.listInvoices()
  ]);
  writeJson(CUSTOMERS_FILE, { items: customers.map(normalizeCustomerRecord) });
  writeJson(INVOICES_FILE, invoices.map(normalizeInvoiceRecord));
}

async function ensureBusinessStoreReady() {
  if (!businessStore.isEnabled()) return false;
  await businessStore.ensureReady({
    employees: readJson(EMPLOYEES_FILE, defaultEmployeesData()),
    quotes: readJson(SAVES_FILE, [])
  });
  return true;
}

async function syncBusinessDocumentsFromStore() {
  if (!businessStore.isEnabled()) return;
  const [employees, quotes] = await Promise.all([
    businessStore.listEmployees(),
    businessStore.listQuotes()
  ]);
  writeJson(EMPLOYEES_FILE, {
    monthlyTrend: (Array.isArray(employees.monthlyTrend) ? employees.monthlyTrend : []).map(normalizeEmployeeTrend),
    items: (Array.isArray(employees.items) ? employees.items : []).map(normalizeEmployee)
  });
  writeJson(SAVES_FILE, Array.isArray(quotes) ? quotes : []);
}

async function ensureOperationsStoreReady() {
  if (!operationsStore.isEnabled()) return false;
  await operationsStore.ensureReady({
    inventory: readJson(INVENTORY_FILE, defaultInventoryData()),
    repairs: getRepairOrders(),
    surveys: getSurveyData().bookings
  });
  return true;
}

async function syncOperationsDocumentsFromStore() {
  if (!operationsStore.isEnabled()) return;
  const [inventory, repairs, surveys] = await Promise.all([
    operationsStore.listInventoryData(),
    operationsStore.listRepairOrders(),
    operationsStore.listSurveyBookings()
  ]);
  if (inventory) {
    writeJson(INVENTORY_FILE, inventory);
  }
  const normalizedRepairs = (Array.isArray(repairs) ? repairs : []).map(normalizeRepairOrder);
  writeJson(REPAIR_ORDERS_FILE, { items: normalizedRepairs });
  if (normalizedRepairs[0]) {
    writeJson(REPAIR_FILE, normalizedRepairs[0]);
  }
  writeJson(SURVEY_FILE, { bookings: (Array.isArray(surveys) ? surveys : []).map(normalizeSurveyBooking) });
}

async function ensureCommerceStoreReady() {
  if (!commerceStore.isEnabled()) return false;
  const vendorsRaw = readJson(VENDORS_FILE, defaultVendorsData());
  const wholesaleRaw = readJson(WHOLESALE_FILE, defaultWholesaleData());
  await commerceStore.ensureReady({
    vendors: {
      items: (Array.isArray(vendorsRaw.items) ? vendorsRaw.items : defaultVendorsData().items).map(normalizeVendor),
      orders: (Array.isArray(vendorsRaw.orders) ? vendorsRaw.orders : defaultVendorsData().orders).map(normalizeVendorOrder)
    },
    wholesaleOrders: (Array.isArray(wholesaleRaw.orders) ? wholesaleRaw.orders : defaultWholesaleData().orders).map(normalizeWholesaleOrder)
  });
  return true;
}

async function syncCommerceDocumentsFromStore() {
  if (!commerceStore.isEnabled()) return;
  const [vendors, vendorOrders, wholesaleOrders] = await Promise.all([
    commerceStore.listVendors(),
    commerceStore.listVendorOrders(),
    commerceStore.listWholesaleOrders()
  ]);
  writeJson(VENDORS_FILE, {
    items: (Array.isArray(vendors) ? vendors : []).map(normalizeVendor),
    orders: (Array.isArray(vendorOrders) ? vendorOrders : []).map(normalizeVendorOrder)
  });
  writeJson(WHOLESALE_FILE, {
    orders: (Array.isArray(wholesaleOrders) ? wholesaleOrders : []).map(normalizeWholesaleOrder)
  });
}

async function ensureExpenseStoreReady() {
  if (!expenseStore.isEnabled()) return false;
  await expenseStore.ensureReady(readJson(EXPENSE_CONTROL_FILE, defaultExpenseControlData()));
  return true;
}

async function syncExpenseDocumentsFromStore() {
  if (!expenseStore.isEnabled()) return;
  const payload = await expenseStore.getAll();
  if (!payload) return;
  writeJson(EXPENSE_CONTROL_FILE, {
    paymentQueue: normalizeExpenseControlCollection(payload.paymentQueue, normalizeExpensePaymentQueue),
    installmentPlans: normalizeExpenseControlCollection(payload.installmentPlans, normalizeExpenseInstallment),
    commissionPool: normalizeExpenseControlCollection(payload.commissionPool, normalizeExpenseCommission),
    transactionLogs: normalizeExpenseControlCollection(payload.transactionLogs, normalizeExpenseTransaction),
    livingCosts: normalizeExpenseControlCollection(payload.livingCosts, (item, index) => normalizeExpenseSimpleItem(item, index, "LIFE")),
    taxes: normalizeExpenseControlCollection(payload.taxes, (item, index) => normalizeExpenseSimpleItem(item, index, "TAX")),
    invoices: normalizeExpenseControlCollection(payload.invoices, (item, index) => normalizeExpenseSimpleItem(item, index, "INV")),
    rentLedger: normalizeExpenseControlCollection(payload.rentLedger, (item, index) => normalizeExpenseSimpleItem(item, index, "RENT", "location"))
  });
}

async function ensureConfigStoreReady() {
  if (!configStore.isEnabled()) return false;
  await configStore.ensureReady({
    settings: readJson(SETTINGS_FILE, {
      audToVuv: 80,
      nzdToVuv: 72,
      quoteDisplayMode: "tax_inclusive",
      homepage: "dashboard",
      backup: defaultBackupSettings(),
      company: defaultCompanyProfile(),
      attendance: defaultAttendanceSettings()
    }),
    companyProfile: readJson(COMPANY_FILE, defaultCompanyProfile()),
    productConfig: readJson(PRODUCT_CONFIG_FILE, defaultProductConfig()),
    rbac: readJson(RBAC_FILE, defaultRbacData()),
    backupIndex: readJson(BACKUP_INDEX_FILE, { items: [] })
  });
  return true;
}

async function syncConfigDocumentsFromStore() {
  if (!configStore.isEnabled()) return;
  writeJson(SETTINGS_FILE, configStore.getSettings());
  writeJson(COMPANY_FILE, configStore.getCompanyProfile());
  writeJson(PRODUCT_CONFIG_FILE, configStore.getProductConfig());
  writeJson(RBAC_FILE, configStore.getRbac());
  writeJson(BACKUP_INDEX_FILE, configStore.getBackupIndex());
}

function getBackupIndex() {
  if (configStore.isEnabled()) {
    return configStore.getBackupIndex();
  }
  return readJson(BACKUP_INDEX_FILE, { items: [] });
}

function saveBackupIndex(data) {
  const payload = {
    items: Array.isArray(data.items) ? data.items : []
  };
  writeJson(BACKUP_INDEX_FILE, payload);
  if (configStore.isEnabled()) {
    configStore.saveBackupIndex(payload).catch((error) => {
      console.error("[backup-index] Failed to persist config store:", error);
    });
  }
  return getBackupIndex();
}

function normalizeBackupItem(item = {}, index = 0) {
  return {
    id: String(item.id || `backup-${Date.now()}-${index + 1}`).trim(),
    filename: String(item.filename || "").trim(),
    createdAt: String(item.createdAt || new Date().toISOString()).trim(),
    trigger: String(item.trigger || "manual").trim(),
    scope: String(item.scope || "system").trim(),
    status: String(item.status || "ready").trim(),
    sizeBytes: Math.max(0, Math.round(clampNumber(item.sizeBytes, 0))),
    googleDriveStatus: String(item.googleDriveStatus || "not_configured").trim(),
    googleDriveFileId: String(item.googleDriveFileId || "").trim(),
    googleDriveError: String(item.googleDriveError || "").trim(),
    notes: String(item.notes || "").trim()
  };
}

function getBackupHistory() {
  const raw = getBackupIndex();
  return (Array.isArray(raw.items) ? raw.items : [])
    .map(normalizeBackupItem)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function buildBackupPayload(trigger = "manual", notes = "") {
  return {
    meta: {
      app: "smart_sizing",
      version: 1,
      trigger,
      notes: String(notes || "").trim(),
      createdAt: new Date().toISOString()
    },
    files: {
      settings: sanitizeBackupSettings(readJson(SETTINGS_FILE, {})),
      companyProfile: readJson(COMPANY_FILE, defaultCompanyProfile()),
      savedQuotes: sanitizeSavedQuotesForBackup(readJson(SAVES_FILE, [])),
      productConfig: readJson(PRODUCT_CONFIG_FILE, {}),
      inventory: readJson(INVENTORY_FILE, {}),
      repairOrder: readJson(REPAIR_FILE, {}),
      repairOrders: readJson(REPAIR_ORDERS_FILE, {}),
      siteSurvey: readJson(SURVEY_FILE, {}),
      employees: readJson(EMPLOYEES_FILE, {}),
      rbac: readJson(RBAC_FILE, {}),
      customers: readJson(CUSTOMERS_FILE, {}),
      vendors: readJson(VENDORS_FILE, {}),
      wholesale: readJson(WHOLESALE_FILE, {}),
      expenseControl: readJson(EXPENSE_CONTROL_FILE, {}),
      invoices: readJson(INVOICES_FILE, []),
      fieldTracks: readJson(FIELD_TRACKS_FILE, []),
      fieldVisits: readJson(FIELD_VISITS_FILE, []),
      fieldCheckins: readJson(FIELD_CHECKINS_FILE, [])
    },
    assets: {
      uploads: fs.existsSync(UPLOADS_DIR)
        ? fs.readdirSync(UPLOADS_DIR, { withFileTypes: true })
          .filter((entry) => entry.isFile())
          .map((entry) => {
            const filePath = path.join(UPLOADS_DIR, entry.name);
            return {
              name: entry.name,
              data: fs.readFileSync(filePath).toString("base64")
            };
          })
        : []
    }
  };
}

function writeBackupSnapshot(trigger = "manual", notes = "") {
  ensureDataDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `backup-${trigger}-${timestamp}.json`;
  const filePath = path.join(BACKUPS_DIR, filename);
  const payload = buildBackupPayload(trigger, notes);
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf8");
  const stats = fs.statSync(filePath);
  const history = getBackupHistory();
  const item = normalizeBackupItem({
    id: `backup-${Date.now()}`,
    filename,
    createdAt: payload.meta.createdAt,
    trigger,
    scope: "system",
    status: "ready",
    sizeBytes: stats.size,
    googleDriveStatus: "not_configured",
    notes
  }, history.length);
  saveBackupIndex({ items: [item, ...history] });
  return { item, filePath, payload };
}

async function restoreBackupSnapshot(backupId) {
  const history = getBackupHistory();
  const item = history.find((entry) => entry.id === String(backupId || "").trim());
  if (!item) return { error: "Backup not found" };
  const snapshotPath = path.join(BACKUPS_DIR, item.filename);
  if (!fs.existsSync(snapshotPath)) return { error: "Backup file missing" };
  const payload = readJson(snapshotPath, null);
  if (!payload || !payload.files) return { error: "Backup payload invalid" };
  const currentSettings = getSettings();
  const restoredSettings = sanitizeBackupSettings(payload.files.settings || currentSettings);
  restoredSettings.backup.googleDriveAccessToken = String(currentSettings.backup?.googleDriveAccessToken || "").trim();
  writeJson(SETTINGS_FILE, restoredSettings);
  writeJson(COMPANY_FILE, payload.files.companyProfile || defaultCompanyProfile());
  writeJson(SAVES_FILE, sanitizeSavedQuotesForBackup(payload.files.savedQuotes || []));
  writeJson(PRODUCT_CONFIG_FILE, payload.files.productConfig || defaultProductConfig());
  if (configStore.isEnabled()) {
    await ensureConfigStoreReady();
    await configStore.replaceAll({
      settings: restoredSettings,
      companyProfile: payload.files.companyProfile || defaultCompanyProfile(),
      productConfig: payload.files.productConfig || defaultProductConfig(),
      rbac: payload.files.rbac || defaultRbacData(),
      backupIndex: getBackupIndex()
    });
  }
  writeJson(INVENTORY_FILE, payload.files.inventory || defaultInventoryData());
  writeJson(REPAIR_FILE, payload.files.repairOrder || defaultRepairOrder());
  writeJson(REPAIR_ORDERS_FILE, payload.files.repairOrders || defaultRepairOrders());
  writeJson(SURVEY_FILE, payload.files.siteSurvey || defaultSurveyData());
  if (operationsStore.isEnabled()) {
    await ensureOperationsStoreReady();
    await operationsStore.replaceAll({
      inventory: payload.files.inventory || defaultInventoryData(),
      repairs: Array.isArray(payload.files.repairOrders?.items) ? payload.files.repairOrders.items : [],
      surveys: Array.isArray(payload.files.siteSurvey?.bookings) ? payload.files.siteSurvey.bookings : []
    });
  }
  writeJson(EMPLOYEES_FILE, payload.files.employees || defaultEmployeesData());
  if (businessStore.isEnabled()) {
    await ensureBusinessStoreReady();
    await businessStore.replaceAll({
      employees: payload.files.employees || defaultEmployeesData(),
      quotes: sanitizeSavedQuotesForBackup(payload.files.savedQuotes || [])
    });
  }
  writeJson(RBAC_FILE, payload.files.rbac || defaultRbacData());
  writeJson(CUSTOMERS_FILE, payload.files.customers || defaultCustomersData());
  writeJson(VENDORS_FILE, payload.files.vendors || defaultVendorsData());
  writeJson(WHOLESALE_FILE, payload.files.wholesale || defaultWholesaleData());
  if (commerceStore.isEnabled()) {
    await ensureCommerceStoreReady();
    await commerceStore.replaceAll({
      vendors: {
        items: Array.isArray(payload.files.vendors?.items) ? payload.files.vendors.items : defaultVendorsData().items,
        orders: Array.isArray(payload.files.vendors?.orders) ? payload.files.vendors.orders : defaultVendorsData().orders
      },
      wholesaleOrders: Array.isArray(payload.files.wholesale?.orders) ? payload.files.wholesale.orders : defaultWholesaleData().orders
    });
  }
  writeJson(EXPENSE_CONTROL_FILE, payload.files.expenseControl || defaultExpenseControlData());
  if (expenseStore.isEnabled()) {
    await ensureExpenseStoreReady();
    await expenseStore.replaceAll(payload.files.expenseControl || defaultExpenseControlData());
  }
  writeJson(INVOICES_FILE, Array.isArray(payload.files.invoices) ? payload.files.invoices : []);
  if (crmStore.isEnabled()) {
    await ensureCrmStoreReady();
    await crmStore.replaceAll({
      customers: Array.isArray(payload.files.customers?.items) ? payload.files.customers.items : [],
      invoices: Array.isArray(payload.files.invoices) ? payload.files.invoices : []
    });
  }
  writeJson(FIELD_TRACKS_FILE, Array.isArray(payload.files.fieldTracks) ? payload.files.fieldTracks : []);
  writeJson(FIELD_VISITS_FILE, Array.isArray(payload.files.fieldVisits) ? payload.files.fieldVisits : []);
  writeJson(FIELD_CHECKINS_FILE, Array.isArray(payload.files.fieldCheckins) ? payload.files.fieldCheckins : []);
  if (fieldStore.isEnabled()) {
    await ensureFieldStoreReady();
    await fieldStore.replaceAll({
      tracks: Array.isArray(payload.files.fieldTracks) ? payload.files.fieldTracks : [],
      visits: Array.isArray(payload.files.fieldVisits) ? payload.files.fieldVisits : [],
      checkins: Array.isArray(payload.files.fieldCheckins) ? payload.files.fieldCheckins : []
    });
  }
  ensureDataDir();
  fs.readdirSync(UPLOADS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .forEach((entry) => {
      fs.unlinkSync(path.join(UPLOADS_DIR, entry.name));
    });
  (Array.isArray(payload.assets?.uploads) ? payload.assets.uploads : []).forEach((item) => {
    const safeName = path.basename(String(item.name || "").trim());
    if (!safeName || !item.data) return;
    fs.writeFileSync(path.join(UPLOADS_DIR, safeName), Buffer.from(String(item.data), "base64"));
  });
  return { ok: true, item };
}

function uploadBackupToGoogleDrive(filePath, backupItem, backupSettings) {
  return new Promise((resolve) => {
    const accessToken = String(backupSettings.googleDriveAccessToken || "").trim();
    if (!backupSettings.googleDriveEnabled || !accessToken) {
      resolve({
        googleDriveStatus: backupSettings.googleDriveEnabled ? "missing_token" : "not_enabled",
        googleDriveFileId: "",
        googleDriveError: backupSettings.googleDriveEnabled ? "Missing Google Drive access token" : ""
      });
      return;
    }

    const boundary = `backup_${Date.now()}`;
    const metadata = {
      name: backupItem.filename,
      mimeType: "application/json"
    };
    const folderId = String(backupSettings.googleDriveFolderId || "").trim();
    if (folderId) metadata.parents = [folderId];
    const fileContent = fs.readFileSync(filePath);
    const preamble = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
      "utf8"
    );
    const ending = Buffer.from(`\r\n--${boundary}--`, "utf8");
    const body = Buffer.concat([preamble, fileContent, ending]);

    const request = https.request(
      {
        method: "POST",
        hostname: "www.googleapis.com",
        path: "/upload/drive/v3/files?uploadType=multipart&fields=id,name",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
          "Content-Length": body.length
        }
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => { raw += chunk; });
        response.on("end", () => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            if (response.statusCode >= 200 && response.statusCode < 300 && parsed.id) {
              resolve({
                googleDriveStatus: "uploaded",
                googleDriveFileId: parsed.id,
                googleDriveError: ""
              });
              return;
            }
            resolve({
              googleDriveStatus: "error",
              googleDriveFileId: "",
              googleDriveError: parsed.error?.message || `HTTP ${response.statusCode}`
            });
          } catch (error) {
            resolve({
              googleDriveStatus: "error",
              googleDriveFileId: "",
              googleDriveError: error.message
            });
          }
        });
      }
    );

    request.on("error", (error) => {
      resolve({
        googleDriveStatus: "error",
        googleDriveFileId: "",
        googleDriveError: error.message
      });
    });
    request.write(body);
    request.end();
  });
}

function googleDriveGet(pathname, accessToken) {
  return new Promise((resolve) => {
    const request = https.request(
      {
        method: "GET",
        hostname: "www.googleapis.com",
        path: pathname,
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => { raw += chunk; });
        response.on("end", () => {
          try {
            const parsed = raw ? JSON.parse(raw) : {};
            if (response.statusCode >= 200 && response.statusCode < 300) {
              resolve({ ok: true, data: parsed });
              return;
            }
            resolve({
              ok: false,
              error: parsed.error?.message || `HTTP ${response.statusCode}`
            });
          } catch (error) {
            resolve({ ok: false, error: error.message });
          }
        });
      }
    );
    request.on("error", (error) => resolve({ ok: false, error: error.message }));
    request.end();
  });
}

async function testGoogleDriveConnection(backupSettings) {
  const accessToken = String(backupSettings.googleDriveAccessToken || "").trim();
  const folderId = String(backupSettings.googleDriveFolderId || "").trim();

  if (!backupSettings.googleDriveEnabled) {
    return { ok: false, error: "请先开启同步到谷歌网盘" };
  }
  if (!accessToken) {
    return { ok: false, error: "请先填写 Google Drive Access Token" };
  }

  const accountResult = await googleDriveGet("/drive/v3/about?fields=user", accessToken);
  if (!accountResult.ok) return accountResult;

  const result = {
    ok: true,
    accountName: accountResult.data.user?.displayName || accountResult.data.user?.emailAddress || "Google Drive"
  };

  if (folderId) {
    const folderResult = await googleDriveGet(`/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType`, accessToken);
    if (!folderResult.ok) return folderResult;
    result.folderId = folderResult.data.id || folderId;
    result.folderName = folderResult.data.name || folderId;
  }

  return result;
}

async function createBackupSnapshot(trigger = "manual", notes = "") {
  const created = writeBackupSnapshot(trigger, notes);
  const settings = getSettings();
  const uploadResult = await uploadBackupToGoogleDrive(created.filePath, created.item, settings.backup || defaultBackupSettings());
  const history = getBackupHistory();
  const updatedItems = history.map((item) => item.id === created.item.id ? { ...item, ...uploadResult } : item);
  saveBackupIndex({ items: updatedItems });
  return {
    item: updatedItems.find((entry) => entry.id === created.item.id) || { ...created.item, ...uploadResult },
    history: getBackupHistory()
  };
}

function shouldRunDailyBackup(lastRunAt, now = new Date()) {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt);
  return last.toDateString() !== now.toDateString();
}

function shouldRunWeeklyBackup(lastRunAt, now = new Date()) {
  if (!lastRunAt) return true;
  const last = new Date(lastRunAt);
  const elapsed = now.getTime() - last.getTime();
  return elapsed >= 7 * 24 * 60 * 60 * 1000;
}

let backupSchedulerRunning = false;
async function runScheduledBackupsIfNeeded() {
  if (backupSchedulerRunning) return;
  backupSchedulerRunning = true;
  try {
    const settings = getSettings();
    const now = new Date();
    let changed = false;

    if (settings.backup.autoDaily && shouldRunDailyBackup(settings.backup.lastDailyBackupAt, now)) {
      await createBackupSnapshot("daily", "每日自动备份");
      settings.backup.lastDailyBackupAt = now.toISOString();
      changed = true;
    }

    if (settings.backup.autoWeekly && shouldRunWeeklyBackup(settings.backup.lastWeeklyBackupAt, now)) {
      await createBackupSnapshot("weekly", "每周自动备份");
      settings.backup.lastWeeklyBackupAt = now.toISOString();
      changed = true;
    }

    if (changed) {
      writeJson(SETTINGS_FILE, settings);
    }
  } catch (error) {
    console.error("backup scheduler error", error);
  } finally {
    backupSchedulerRunning = false;
  }
}

function formatRepairStatusLabel(status) {
  if (status === "completed") return "Completed";
  if (status === "pending") return "Pending";
  return "Under Maintenance";
}

function saveDataUrlImage(dataUrl, prefix = "repair") {
  const match = String(dataUrl || "").match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) return "";
  const mimeType = match[1].toLowerCase();
  const extension = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const buffer = Buffer.from(match[3], "base64");
  if (!buffer.length) return "";
  ensureDataDir();
  const filename = `${prefix}-${Date.now()}.${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${filename}`;
}

function saveDataUrlFile(dataUrl, prefix = "upload") {
  const match = String(dataUrl || "").match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return "";
  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) return "";
  ensureDataDir();
  const extensionMap = {
    "audio/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp"
  };
  const extension = extensionMap[mimeType] || mimeType.split("/").pop() || "bin";
  const filename = `${prefix}-${Date.now()}.${extension}`;
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${filename}`;
}

function clampNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function toId(value, fallback = "item") {
  return String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;
}

function getSettings() {
  const settings = configStore.isEnabled()
    ? configStore.getSettings()
    : readJson(SETTINGS_FILE, {
      audToVuv: 80,
      nzdToVuv: 72,
      quoteDisplayMode: "tax_inclusive",
      homepage: "dashboard",
      backup: defaultBackupSettings(),
      company: defaultCompanyProfile(),
      attendance: defaultAttendanceSettings()
    });
  const company = settings.company || settings.backup?.companyProfile || (configStore.isEnabled()
    ? configStore.getCompanyProfile()
    : readJson(COMPANY_FILE, defaultCompanyProfile()));
  return {
    audToVuv: Math.max(0.01, clampNumber(settings.audToVuv, 80)),
    nzdToVuv: Math.max(0.01, clampNumber(settings.nzdToVuv, 72)),
    quoteDisplayMode: "tax_inclusive",
    homepage: settings.homepage === "calculator" ? "calculator" : "dashboard",
    backup: {
      ...defaultBackupSettings(),
      ...(settings.backup || {}),
      autoDaily: Boolean(settings.backup?.autoDaily),
      autoWeekly: Boolean(settings.backup?.autoWeekly),
      googleDriveEnabled: Boolean(settings.backup?.googleDriveEnabled),
      googleDriveFolderId: String(settings.backup?.googleDriveFolderId || "").trim(),
      googleDriveAccessToken: String(settings.backup?.googleDriveAccessToken || "").trim(),
      lastDailyBackupAt: String(settings.backup?.lastDailyBackupAt || "").trim(),
      lastWeeklyBackupAt: String(settings.backup?.lastWeeklyBackupAt || "").trim()
    },
    attendance: {
      ...defaultAttendanceSettings(),
      ...(settings.attendance || {}),
      enabledWeekdays: Array.isArray(settings.attendance?.enabledWeekdays)
        ? settings.attendance.enabledWeekdays.map((item) => Math.max(0, Math.min(6, Math.round(clampNumber(item, 1))))).filter((item, index, arr) => arr.indexOf(item) === index).sort((a, b) => a - b)
        : defaultAttendanceSettings().enabledWeekdays,
      checkInStart: String(settings.attendance?.checkInStart || defaultAttendanceSettings().checkInStart).trim(),
      checkInEnd: String(settings.attendance?.checkInEnd || defaultAttendanceSettings().checkInEnd).trim(),
      checkOutStart: String(settings.attendance?.checkOutStart || defaultAttendanceSettings().checkOutStart).trim(),
      checkOutEnd: String(settings.attendance?.checkOutEnd || defaultAttendanceSettings().checkOutEnd).trim(),
      enforceTimeWindow: settings.attendance?.enforceTimeWindow === true,
      requireLocation: settings.attendance?.requireLocation !== false
    },
    company: {
      ...defaultCompanyProfile(),
      ...(company || {}),
      name: String(company?.name || defaultCompanyProfile().name).trim(),
      tin: String(company?.tin || "").trim(),
      bankName: String(company?.bankName || "").trim(),
      bankAccountName: String(company?.bankAccountName || "").trim(),
      bankAccountNumber: String(company?.bankAccountNumber || "").trim(),
      address: String(company?.address || "").trim(),
      phone: String(company?.phone || "").trim(),
      email: String(company?.email || "").trim(),
      logoUrl: String(company?.logoUrl || "").trim()
    }
  };
}

function buildSystemSettings(body = {}) {
  const current = getSettings();
  const nextCompany = {
    ...defaultCompanyProfile(),
    ...(current.company || {}),
    ...(body.company || {}),
    name: String(body.company?.name || current.company?.name || defaultCompanyProfile().name).trim(),
    tin: String(body.company?.tin || current.company?.tin || "").trim(),
    bankName: String(body.company?.bankName || current.company?.bankName || "").trim(),
    bankAccountName: String(body.company?.bankAccountName || current.company?.bankAccountName || "").trim(),
    bankAccountNumber: String(body.company?.bankAccountNumber || current.company?.bankAccountNumber || "").trim(),
    address: String(body.company?.address || current.company?.address || "").trim(),
    phone: String(body.company?.phone || current.company?.phone || "").trim(),
    email: String(body.company?.email || current.company?.email || "").trim(),
    logoUrl: String(body.company?.logoUrl || current.company?.logoUrl || "").trim()
  };
  return {
    audToVuv: Math.max(0.01, clampNumber(body.audToVuv, current.audToVuv || 80)),
    nzdToVuv: Math.max(0.01, clampNumber(body.nzdToVuv, current.nzdToVuv || 72)),
    quoteDisplayMode: "tax_inclusive",
    homepage: body.homepage === "calculator" ? "calculator" : "dashboard",
    backup: {
      ...defaultBackupSettings(),
      ...(current.backup || {}),
      ...(body.backup || {}),
      autoDaily: Boolean(body.backup?.autoDaily),
      autoWeekly: Boolean(body.backup?.autoWeekly),
      googleDriveEnabled: Boolean(body.backup?.googleDriveEnabled),
      googleDriveFolderId: String(body.backup?.googleDriveFolderId || "").trim(),
      googleDriveAccessToken: String(body.backup?.googleDriveAccessToken || "").trim(),
      lastDailyBackupAt: String((body.backup?.lastDailyBackupAt ?? current.backup?.lastDailyBackupAt) || "").trim(),
      lastWeeklyBackupAt: String((body.backup?.lastWeeklyBackupAt ?? current.backup?.lastWeeklyBackupAt) || "").trim(),
      companyProfile: nextCompany
    },
    attendance: {
      ...defaultAttendanceSettings(),
      ...(current.attendance || {}),
      ...(body.attendance || {}),
      enabledWeekdays: Array.isArray(body.attendance?.enabledWeekdays)
        ? body.attendance.enabledWeekdays.map((item) => Math.max(0, Math.min(6, Math.round(clampNumber(item, 1))))).filter((item, index, arr) => arr.indexOf(item) === index).sort((a, b) => a - b)
        : current.attendance?.enabledWeekdays || defaultAttendanceSettings().enabledWeekdays,
      checkInStart: String(body.attendance?.checkInStart || current.attendance?.checkInStart || defaultAttendanceSettings().checkInStart).trim(),
      checkInEnd: String(body.attendance?.checkInEnd || current.attendance?.checkInEnd || defaultAttendanceSettings().checkInEnd).trim(),
      checkOutStart: String(body.attendance?.checkOutStart || current.attendance?.checkOutStart || defaultAttendanceSettings().checkOutStart).trim(),
      checkOutEnd: String(body.attendance?.checkOutEnd || current.attendance?.checkOutEnd || defaultAttendanceSettings().checkOutEnd).trim(),
      enforceTimeWindow: body.attendance?.enforceTimeWindow == null
        ? current.attendance?.enforceTimeWindow === true
        : Boolean(body.attendance.enforceTimeWindow),
      requireLocation: body.attendance?.requireLocation == null
        ? current.attendance?.requireLocation !== false
        : Boolean(body.attendance.requireLocation)
    },
    company: nextCompany
  };
}

function normalizePackage(item = {}, index = 0) {
  const costVt = Math.max(0, Math.round(clampNumber(item.costVt, 0)));
  const retailVt = Math.max(costVt, Math.round(clampNumber(item.retailVt, costVt)));
  const wholesaleVt = Math.max(costVt, Math.round(clampNumber(item.wholesaleVt, Math.round(retailVt * 0.9))));
  return {
    id: toId(item.id || item.sku || item.name || `package-${index + 1}`, `package-${index + 1}`),
    sku: String(item.sku || `PKG-${index + 1}`).trim(),
    name: String(item.name || `Package ${index + 1}`).trim(),
    status: item.status === "draft" ? "draft" : "active",
    storageKwh: Math.max(0, Number(clampNumber(item.storageKwh, 0)).toFixed(2)),
    panelCount: Math.max(0, Math.round(clampNumber(item.panelCount, 0))),
    panelWatts: Math.max(0, Math.round(clampNumber(item.panelWatts, 0))),
    loadCapacityW: Math.max(0, Math.round(clampNumber(item.loadCapacityW, 0))),
    inverterModel: String(item.inverterModel || "").trim(),
    stock: Math.max(0, Math.round(clampNumber(item.stock, 0))),
    costVt,
    retailVt,
    wholesaleVt,
    featured: Boolean(item.featured),
    sortOrder: Math.max(1, Math.round(clampNumber(item.sortOrder, index + 1)))
  };
}

function enrichPackage(item, vatRate) {
  const normalized = normalizePackage(item);
  const marginPct = normalized.retailVt > 0
    ? Number((((normalized.retailVt - normalized.costVt) / normalized.retailVt) * 100).toFixed(1))
    : 0;
  const wholesaleMarginPct = normalized.wholesaleVt > 0
    ? Number((((normalized.wholesaleVt - normalized.costVt) / normalized.wholesaleVt) * 100).toFixed(1))
    : 0;
  return {
    ...normalized,
    vatRate,
    marginPct,
    wholesaleMarginPct
  };
}

function getCustomerTypeLabel(type) {
  if (type === "local_wholesale") return "本地商家";
  if (type === "business") return "商用客户";
  return "终端客户";
}

function normalizeDiscount(item = {}, index = 0) {
  return {
    id: toId(item.id || item.name || `discount-${index + 1}`, `discount-${index + 1}`),
    name: String(item.name || `Discount ${index + 1}`).trim(),
    description: String(item.description || "").trim(),
    active: Boolean(item.active)
  };
}

function getProductConfig() {
  const raw = configStore.isEnabled() ? configStore.getProductConfig() : readJson(PRODUCT_CONFIG_FILE, defaultProductConfig());
  const vatRate = Math.max(0, Number(clampNumber(raw.vatRate, 15)).toFixed(2));
  const packages = (Array.isArray(raw.packages) ? raw.packages : defaultProductConfig().packages)
    .map((item, index) => enrichPackage(item, vatRate))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const discounts = (Array.isArray(raw.discounts) ? raw.discounts : defaultProductConfig().discounts)
    .map(normalizeDiscount);
  return { vatRate, packages, discounts };
}

function saveProductConfig(nextConfig) {
  const payload = {
    vatRate: nextConfig.vatRate,
    packages: nextConfig.packages.map((item) => normalizePackage(item)),
    discounts: nextConfig.discounts.map((item) => normalizeDiscount(item))
  };
  writeJson(PRODUCT_CONFIG_FILE, payload);
  if (configStore.isEnabled()) {
    configStore.saveProductConfig(payload).catch((error) => {
      console.error("[product-config] Failed to persist config store:", error);
    });
  }
  return getProductConfig();
}

function normalizeCustomer(customer = {}) {
  return {
    name: String(customer.name || "").trim(),
    phone: String(customer.phone || "").trim(),
    email: String(customer.email || "").trim(),
    address: String(customer.address || "").trim()
  };
}

function normalizeInstallmentPlan(plan = {}, total = 0) {
  const termWeeks = Math.max(0, Math.round(clampNumber(plan.termWeeks, 0)));
  const enabled = Boolean(plan.enabled && termWeeks > 0);
  const totalAmount = Math.max(0, Math.round(clampNumber(total, 0)));
  const downPayment = Math.max(0, Math.round(clampNumber(plan.downPayment, 0)));
  const financedAmount = Math.max(0, Math.round(clampNumber(plan.financedAmount, Math.max(0, totalAmount - downPayment))));
  const weeklyAmount = enabled && termWeeks ? Math.max(0, Math.round(clampNumber(plan.weeklyAmount, Math.ceil(financedAmount / termWeeks)))) : 0;
  const installments = Array.isArray(plan.installments) ? plan.installments.map((item, index) => ({
    index: Math.max(1, Math.round(clampNumber(item.index, index + 1))),
    label: String(item.label || `第${index + 1}期`).trim(),
    amount: Math.max(0, Math.round(clampNumber(item.amount, 0))),
    dueDate: String(item.dueDate || "").trim()
  })) : [];
  return {
    enabled,
    termWeeks,
    termCount: Math.max(0, Math.round(clampNumber(plan.termCount, termWeeks))),
    totalAmount,
    downPayment,
    financedAmount,
    weeklyAmount,
    installments,
    cycleLabel: String(plan.cycleLabel || (enabled ? `共${termWeeks}期` : "Full Payment")).trim(),
    nextDueLabel: String(plan.nextDueLabel || (enabled ? "下期" : "-")).trim(),
    startDate: String(plan.startDate || new Date().toISOString().slice(0, 10)).trim(),
    depositDate: String(plan.depositDate || "").trim()
  };
}

function sanitizeInvoicePayload(payload = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const safeSettings = source.settings && typeof source.settings === "object"
    ? {
      ...source.settings,
      backup: source.settings.backup && typeof source.settings.backup === "object"
        ? {
          ...source.settings.backup,
          googleDriveAccessToken: source.settings.backup.googleDriveAccessToken ? "***" : "",
          googleDriveFolderId: source.settings.backup.googleDriveFolderId ? "***" : ""
        }
        : undefined
    }
    : undefined;
  return {
    ...source,
    settings: safeSettings
  };
}

function normalizeInvoiceRecord(item = {}, index = 0) {
  const customer = normalizeCustomer(item.customer);
  const payload = sanitizeInvoicePayload(item.payload);
  const quote = payload.quote && typeof payload.quote === "object" ? payload.quote : {};
  const recommendation = payload.recommendation && typeof payload.recommendation === "object" ? payload.recommendation : {};
  const createdAt = String(item.createdAt || item.issuedAt || new Date().toISOString()).trim();
  const invoiceNo = String(item.invoiceNo || `INV-${String(Date.now() + index).slice(-8)}`).trim();
  const note = String(item.note || payload.note || "").trim();
  return {
    id: String(item.id || `invoice-${Date.now()}-${index + 1}`).trim(),
    invoiceNo,
    quoteId: String(item.quoteId || item.savedQuoteId || "").trim(),
    customer,
    customerName: customer.name || String(item.customerName || "").trim(),
    customerPhone: customer.phone || String(item.customerPhone || "").trim(),
    customerEmail: customer.email || String(item.customerEmail || "").trim(),
    customerAddress: customer.address || String(item.customerAddress || "").trim(),
    packageName: String(item.packageName || recommendation.packageName || "").trim(),
    amount: Math.max(0, Math.round(clampNumber(item.amount, quote.displayTotal || quote.total || 0))),
    status: String(item.status || "issued").trim(),
    issuedAt: String(item.issuedAt || createdAt).trim(),
    createdAt,
    salesPersonName: String(item.salesPersonName || payload.salesPersonName || payload.salesPerson?.name || "").trim(),
    note,
    payload
  };
}

function getInvoicesData() {
  return readJson(INVOICES_FILE, []).map(normalizeInvoiceRecord).sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
}

function saveInvoicesData(items) {
  writeJson(INVOICES_FILE, (Array.isArray(items) ? items : []).map(normalizeInvoiceRecord));
  return getInvoicesData();
}

function syncCustomerInstallmentFromQuote(savedRecord) {
  const installmentPlan = normalizeInstallmentPlan(savedRecord.installmentPlan, savedRecord.total);
  if (!installmentPlan.enabled) return;

  const customers = getCustomersData();
  const customer = normalizeCustomer(savedRecord.customer);
  const matchIndex = customers.items.findIndex((item) => {
    if (customer.phone && item.phone === customer.phone) return true;
    return customer.name && item.name === customer.name;
  });

  const orderRecord = normalizeCustomerOrder({
    id: savedRecord.id,
    name: savedRecord.packageName || "分期订单",
    status: "分期中",
    date: savedRecord.createdAt.slice(0, 10)
  });

  if (matchIndex >= 0) {
    const existing = customers.items[matchIndex];
    const nextOrders = [orderRecord, ...existing.orders.filter((item) => item.id !== orderRecord.id)];
    customers.items[matchIndex] = normalizeCustomerRecord({
      ...existing,
      name: customer.name || existing.name,
      phone: customer.phone || existing.phone,
      email: customer.email || existing.email,
      address: customer.address || existing.address,
      salesPersonId: savedRecord.salesPersonId || existing.salesPersonId,
      salesPersonName: savedRecord.salesPersonName || existing.salesPersonName,
      payment: {
        cycleLabel: installmentPlan.cycleLabel,
        completedWeeks: 0,
        totalWeeks: installmentPlan.termWeeks,
        paidAmount: installmentPlan.downPayment,
        balanceAmount: installmentPlan.financedAmount,
        nextDueLabel: installmentPlan.nextDueLabel
      },
      orders: nextOrders
    }, matchIndex);
  } else {
    const nextIndex = customers.items.length;
    customers.items.unshift(normalizeCustomerRecord({
      id: `crm-${Date.now()}`,
      archiveNo: `VSLM-CRM-${new Date().getFullYear()}-${String(nextIndex + 1).padStart(3, "0")}`,
      name: customer.name || "未命名客户",
      contactName: customer.name || "",
      phone: customer.phone,
      email: customer.email,
      province: "Shefa Province",
      location: savedRecord.location || "Port Vila",
      address: customer.address,
      usageType: "分期客户",
      installDate: savedRecord.createdAt.slice(0, 10),
      salesPersonId: savedRecord.salesPersonId,
      salesPersonName: savedRecord.salesPersonName,
      payment: {
        cycleLabel: installmentPlan.cycleLabel,
        completedWeeks: 0,
        totalWeeks: installmentPlan.termWeeks,
        paidAmount: installmentPlan.downPayment,
        balanceAmount: installmentPlan.financedAmount,
        nextDueLabel: installmentPlan.nextDueLabel
      },
      orders: [orderRecord]
    }, nextIndex));
  }

  saveCustomersData(customers);
}

function getDashboardData() {
  const rawItems = readJson(SAVES_FILE, []).slice().reverse();
  const customerItems = getCustomersData().items;
  const items = rawItems.map((item) => {
    const payload = item.payload || {};
    const customer = normalizeCustomer(item.customer || payload.customer || {});
    const quote = payload.quote || {};
    const installmentPlan = normalizeInstallmentPlan(item.installmentPlan || payload.installmentPlan, item.total || quote.displayTotal || quote.total || 0);
    const matchedCustomer = customerItems.find((entry) => {
      if (customer.phone && entry.phone === customer.phone) return true;
      return customer.name && entry.name === customer.name;
    });
    return {
      id: String(item.id || "").trim(),
      customerId: matchedCustomer?.id || "",
      customer,
      customerName: customer.name || "未命名客户",
      customerPhone: customer.phone || "",
      customerEmail: customer.email || "",
      customerAddress: customer.address || "",
      packageName: String(item.packageName || payload.recommendation?.packageName || "").trim(),
      total: Math.max(0, Math.round(clampNumber(item.total, quote.displayTotal || quote.total || 0))),
      dailyWh: Math.max(0, Math.round(clampNumber(item.dailyWh, payload.metrics?.dailyWh || 0))),
      location: String(item.location || payload.location || "-").trim(),
      status: String(item.status || "draft").trim(),
      createdAt: String(item.createdAt || new Date().toISOString()).trim(),
      installmentPlan,
      salesPersonName: String(item.salesPersonName || payload.salesPersonName || payload.salesPerson?.name || "").trim(),
      payload
    };
  });

  const totalSales = items.reduce((sum, item) => sum + item.total, 0);
  const activeQuotes = items.filter((item) => item.status !== "paid").length;
  const paidThisWeek = items
    .filter((item) => item.status === "paid" && Date.now() - new Date(item.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000)
    .reduce((sum, item) => sum + item.total, 0);

  const installmentRecords = items
    .filter((item) => item.installmentPlan.enabled)
    .map((item) => {
      const matchedCustomer = customerItems.find((entry) => entry.id === item.customerId)
        || customerItems.find((entry) => item.customerPhone && entry.phone === item.customerPhone)
        || customerItems.find((entry) => item.customerName && entry.name === item.customerName);
      return {
        id: item.id,
        customerId: item.customerId,
        customerName: item.customerName,
        packageName: item.packageName,
        salesPersonName: item.salesPersonName,
        depositDate: item.installmentPlan.depositDate || "",
        cycleLabel: item.installmentPlan.cycleLabel || "-",
        downPayment: item.installmentPlan.downPayment || 0,
        financedAmount: item.installmentPlan.financedAmount || 0,
        paidAmount: matchedCustomer?.payment?.paidAmount || item.installmentPlan.downPayment || 0,
        balanceAmount: matchedCustomer?.payment?.balanceAmount ?? item.installmentPlan.financedAmount ?? 0,
        installments: item.installmentPlan.installments || []
      };
    });

  return {
    summary: {
      totalSales,
      activeQuotes,
      paidThisWeek,
      totalQuotes: items.length,
      updatedAt: items[0]?.createdAt || ""
    },
    items,
    installmentRecords
  };
}

function normalizeInventoryItem(item = {}, index = 0) {
  return {
    id: toId(item.id || item.sku || item.name || `inventory-${index + 1}`, `inventory-${index + 1}`),
    name: String(item.name || `Inventory Item ${index + 1}`).trim(),
    sku: String(item.sku || "").trim(),
    category: String(item.category || "general").trim(),
    model: String(item.model || "").trim(),
    unit: String(item.unit || "pcs").trim(),
    quantity: Math.max(0, Math.round(clampNumber(item.quantity, 0))),
    monthlyUsage: Math.max(0, Math.round(clampNumber(item.monthlyUsage, 0))),
    trendPct: Math.round(clampNumber(item.trendPct, 0)),
    threshold: Math.max(0, Math.round(clampNumber(item.threshold, 0))),
    status: item.status === "low" ? "low" : "healthy",
    unitCostVt: Math.max(0, Math.round(clampNumber(item.unitCostVt, 0)))
  };
}

function normalizeInventoryTransaction(item = {}, index = 0) {
  const quantityChange = Math.round(clampNumber(item.quantityChange, 0));
  return {
    id: String(item.id || `TR-${Date.now()}-${index + 1}`).trim(),
    itemId: String(item.itemId || "").trim(),
    itemName: String(item.itemName || "").trim(),
    sku: String(item.sku || "").trim(),
    type: item.type === "inbound" ? "inbound" : item.type === "stocktake" ? "stocktake" : "outbound",
    typeLabel: String(item.typeLabel || "").trim(),
    quantityChange,
    quantityText: String(item.quantityText || (quantityChange >= 0 ? `+${quantityChange}` : `${quantityChange}`)).trim(),
    operator: String(item.operator || "-").trim(),
    referenceNo: String(item.referenceNo || "").trim(),
    notes: String(item.notes || "").trim(),
    timestamp: String(item.timestamp || new Date().toISOString()).trim()
  };
}

function normalizeInventoryPurchaseOrder(item = {}, index = 0) {
  return {
    id: String(item.id || `PO-${Date.now()}-${index + 1}`).trim(),
    itemId: String(item.itemId || "").trim(),
    itemName: String(item.itemName || "").trim(),
    sku: String(item.sku || "").trim(),
    supplierName: String(item.supplierName || "").trim(),
    quantity: Math.max(0, Math.round(clampNumber(item.quantity, 0))),
    unitCostVt: Math.max(0, Math.round(clampNumber(item.unitCostVt, 0))),
    totalCostVt: Math.max(0, Math.round(clampNumber(item.totalCostVt, 0))),
    currency: ["VUV", "CNY", "USD"].includes(String(item.currency || "").trim()) ? String(item.currency).trim() : "VUV",
    operator: String(item.operator || "-").trim(),
    etaDate: String(item.etaDate || "").trim(),
    status: ["draft", "ordered", "received", "cancelled"].includes(String(item.status || "").trim()) ? String(item.status).trim() : "ordered",
    notes: String(item.notes || "").trim(),
    createdAt: String(item.createdAt || new Date().toISOString()).trim()
  };
}

function getInventoryData() {
  const raw = readJson(INVENTORY_FILE, defaultInventoryData());
  const stockItems = (Array.isArray(raw.stockItems) ? raw.stockItems : []).map(normalizeInventoryItem);
  const transactions = (Array.isArray(raw.transactions) ? raw.transactions : [])
    .map(normalizeInventoryTransaction)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const purchaseOrders = (Array.isArray(raw.purchaseOrders) ? raw.purchaseOrders : [])
    .map(normalizeInventoryPurchaseOrder)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const shipment = raw.shipment || defaultInventoryData().shipment;
  const inventoryValue = stockItems.reduce((sum, item) => sum + item.quantity * item.unitCostVt, 0);
  const availableLiquidity = Math.round(inventoryValue * 0.5);
  const alertCount = stockItems.filter((item) => item.quantity <= item.threshold).length;
  return {
    shipment,
    stockItems,
    purchaseOrders,
    transactions,
    summary: {
      inventoryValue,
      availableLiquidity,
      alertCount
    }
  };
}

function saveInventoryData(data) {
  writeJson(INVENTORY_FILE, data);
  if (operationsStore.isEnabled()) {
    operationsStore.replaceInventoryData(data).catch((error) => {
      console.error("[inventory] Failed to persist operations store:", error);
    });
  }
  return getInventoryData();
}

function getEmployeeRoleLabel(role) {
  if (role === "sales") return "销售";
  if (role === "sales_manager") return "销售经理";
  if (role === "admin") return "管理员";
  return "工程师";
}

function getEmployeeStatusLabel(status) {
  if (status === "resigned") return "离职";
  if (status === "training") return "培训中";
  if (status === "leave") return "休假";
  return "在岗";
}

function looksCorruptedText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return /[?�]|鏈|鍛|閿|宸|绠|鍦|绂|璇|垎|鎬|荤粺|浣|澶|鎷|琛|褰|鐨|銆/.test(text);
}

function getDefaultPayrollConfig(role) {
  if (role === "sales") {
    return {
      hourlyRate: 850,
      workHours: 176,
      baseSalary: 0,
      performanceSalary: 0,
      commissionRate: 0.03
    };
  }
  if (role === "sales_manager") {
    return {
      hourlyRate: 0,
      workHours: 0,
      baseSalary: 185000,
      performanceSalary: 42000,
      commissionRate: 0.018
    };
  }
  if (role === "engineer") {
    return {
      hourlyRate: 780,
      workHours: 184,
      baseSalary: 0,
      performanceSalary: 12000,
      commissionRate: 0
    };
  }
  return {
    hourlyRate: 0,
    workHours: 0,
    baseSalary: 165000,
    performanceSalary: 18000,
    commissionRate: 0
  };
}

function computeEmployeeCommission(employee, quoteItems = [], repairOrders = []) {
  if (employee.role === "sales" || employee.role === "sales_manager") {
    const relatedQuotes = quoteItems.filter((item) => {
      const salesName = String(item.salesPersonName || item.payload?.salesPerson?.name || "").trim().toLowerCase();
      return salesName && salesName === employee.name.trim().toLowerCase();
    });
    const signedTotal = relatedQuotes.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.total, 0))), 0);
    const rate = clampNumber(employee.payroll?.commissionRate, getDefaultPayrollConfig(employee.role).commissionRate);
    return Math.round(signedTotal * rate);
  }

  if (employee.role === "engineer") {
    const relatedRepairs = repairOrders.filter((item) => String(item.assignedEngineer?.name || "").trim().toLowerCase() === employee.name.trim().toLowerCase());
    const completed = relatedRepairs.filter((item) => item.status === "completed").length;
    const inProgress = relatedRepairs.filter((item) => item.status === "in_progress").length;
    return completed * 2500 + inProgress * 1000;
  }

  return 0;
}

function buildEmployeePayroll(employee, quoteItems = [], repairOrders = []) {
  const config = {
    ...getDefaultPayrollConfig(employee.role),
    ...(employee.payroll || {})
  };
  const commission = computeEmployeeCommission(employee, quoteItems, repairOrders);
  const workSalary = Math.round(clampNumber(config.hourlyRate, 0) * clampNumber(config.workHours, 0));
  const baseSalary = Math.round(clampNumber(config.baseSalary, 0));
  const performanceSalary = Math.round(clampNumber(config.performanceSalary, 0));
  const total = employee.role === "sales"
    ? workSalary + commission
    : employee.role === "sales_manager"
      ? baseSalary + commission + performanceSalary
      : baseSalary + workSalary + commission + performanceSalary;

  return {
    hourlyRate: Math.round(clampNumber(config.hourlyRate, 0)),
    workHours: Math.round(clampNumber(config.workHours, 0)),
    workSalary,
    baseSalary,
    performanceSalary,
    commissionRate: Number(clampNumber(config.commissionRate, getDefaultPayrollConfig(employee.role).commissionRate).toFixed(4)),
    commission,
    total
  };
}

function getRecordDateKey(value = "", fallback = "") {
  const text = String(value || "").trim();
  if (!text) return String(fallback || "").trim();
  return text.slice(0, 10);
}

function normalizeAdvanceRecord(item = {}, index = 0) {
  const type = ["advance", "repayment", "adjustment"].includes(String(item.type || "").trim())
    ? String(item.type).trim()
    : "advance";
  const status = ["draft", "approved", "paid", "cancelled"].includes(String(item.status || "").trim())
    ? String(item.status).trim()
    : "approved";
  const date = getRecordDateKey(item.date || item.createdAt || item.workDate, new Date().toISOString().slice(0, 10));
  return {
    id: String(item.id || `advance-${Date.now()}-${index + 1}`).trim(),
    type,
    amount: Math.max(0, Math.round(clampNumber(item.amount, 0))),
    date,
    createdAt: String(item.createdAt || `${date}T12:00:00+11:00`).trim(),
    workDate: getRecordDateKey(item.workDate || date, date),
    note: String(item.note || "").trim(),
    approvedBy: String(item.approvedBy || "").trim(),
    status
  };
}

function normalizePayrollSettlementRecord(item = {}, index = 0) {
  const startDate = getRecordDateKey(item.startDate || item.date, new Date().toISOString().slice(0, 10));
  const endDate = getRecordDateKey(item.endDate || startDate, startDate);
  const grossPay = Math.max(0, Math.round(clampNumber(item.grossPay, 0)));
  const vnpfDeduction = Math.max(0, Math.round(clampNumber(item.vnpfDeduction, 0)));
  const advanceDeduction = Math.max(0, Math.round(clampNumber(item.advanceDeduction, 0)));
  const debtDeduction = Math.max(0, Math.round(clampNumber(item.debtDeduction, 0)));
  const netPay = Math.max(0, Math.round(clampNumber(item.netPay, grossPay - vnpfDeduction - advanceDeduction - debtDeduction)));
  return {
    id: String(item.id || `settlement-${Date.now()}-${index + 1}`).trim(),
    startDate,
    endDate,
    grossPay,
    vnpfDeduction,
    advanceDeduction,
    debtDeduction,
    netPay,
    status: ["draft", "paid", "pending"].includes(String(item.status || "").trim()) ? String(item.status).trim() : "paid",
    paidAt: String(item.paidAt || "").trim(),
    note: String(item.note || "").trim()
  };
}

function getAdvanceOutstanding(records = [], fallbackBalance = 0) {
  const outstanding = (Array.isArray(records) ? records : []).reduce((sum, item) => {
    if (item.status === "cancelled") return sum;
    if (item.type === "repayment") return sum - item.amount;
    if (item.type === "advance") return sum + item.amount;
    return sum;
  }, 0);
  return Math.max(0, Math.round(clampNumber(outstanding, fallbackBalance)));
}

function normalizeEmployee(item = {}, index = 0) {
  const role = ["engineer", "sales", "sales_manager", "admin"].includes(String(item.role || "").trim())
    ? String(item.role).trim()
    : "engineer";
  const status = ["active", "training", "leave", "resigned"].includes(String(item.status || "").trim())
    ? String(item.status).trim()
    : "active";
  const roleLabel = looksCorruptedText(item.roleLabel) ? getEmployeeRoleLabel(role) : String(item.roleLabel || getEmployeeRoleLabel(role)).trim();
  const statusLabel = looksCorruptedText(item.statusLabel) ? getEmployeeStatusLabel(status) : String(item.statusLabel || getEmployeeStatusLabel(status)).trim();
  const branch = looksCorruptedText(item.branch) ? "Port Vila 总部" : String(item.branch || "Port Vila 总部").trim();
  const primaryLabel = looksCorruptedText(item.metrics?.primaryLabel) ? "绩效" : String(item.metrics?.primaryLabel || "绩效").trim();
  const secondaryLabel = looksCorruptedText(item.metrics?.secondaryLabel) ? "任务量" : String(item.metrics?.secondaryLabel || "任务量").trim();
  const ratingLabel = looksCorruptedText(item.metrics?.ratingLabel) ? "评分" : String(item.metrics?.ratingLabel || "评分").trim();
  return {
    id: toId(item.id || item.employeeNo || item.name || `employee-${index + 1}`, `employee-${index + 1}`),
    employeeNo: String(item.employeeNo || `VSLM-EMP-${String(index + 1).padStart(4, "0")}`).trim(),
    name: String(item.name || `员工 ${index + 1}`).trim(),
    role,
    roleLabel,
    branch,
    status,
    statusLabel,
    phone: String(item.phone || "").trim(),
    email: String(item.email || "").trim(),
    hireDate: String(item.hireDate || "").trim(),
    resignedAt: String(item.resignedAt || "").trim(),
    skills: (Array.isArray(item.skills) ? item.skills : []).map((skill) => String(skill || "").trim()).filter(Boolean),
    metrics: {
      primaryLabel,
      primaryValue: String(item.metrics?.primaryValue || "0").trim(),
      secondaryLabel,
      secondaryValue: String(item.metrics?.secondaryValue || "0").trim(),
      ratingLabel,
      ratingValue: String(item.metrics?.ratingValue || "0").trim()
    },
    payroll: {
      hourlyRate: Math.round(clampNumber(item.payroll?.hourlyRate, getDefaultPayrollConfig(role).hourlyRate)),
      workHours: Math.round(clampNumber(item.payroll?.workHours, getDefaultPayrollConfig(role).workHours)),
      baseSalary: Math.round(clampNumber(item.payroll?.baseSalary, getDefaultPayrollConfig(role).baseSalary)),
      performanceSalary: Math.round(clampNumber(item.payroll?.performanceSalary, getDefaultPayrollConfig(role).performanceSalary)),
      commissionRate: Number(clampNumber(item.payroll?.commissionRate, getDefaultPayrollConfig(role).commissionRate).toFixed(4))
    },
    pin: String(item.pin || "0000").trim(),
    baseDailyRate: Math.round(clampNumber(item.baseDailyRate, 0)),
    advanceRecords: (Array.isArray(item.advanceRecords) ? item.advanceRecords : []).map(normalizeAdvanceRecord)
      .sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime()),
    payrollSettlements: (Array.isArray(item.payrollSettlements) ? item.payrollSettlements : []).map(normalizePayrollSettlementRecord)
      .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime()),
    advanceBalance: getAdvanceOutstanding(Array.isArray(item.advanceRecords) ? item.advanceRecords : [], Math.round(clampNumber(item.advanceBalance, 0))),
    debtBalance: Math.round(clampNumber(item.debtBalance, 0)),
    vnpfRate: Number(clampNumber(item.vnpfRate, 4).toFixed(2))
  };
}

function normalizeEmployeeTrend(item = {}, index = 0) {
  return {
    label: String(item.label || `${index + 1}月`).trim(),
    completed: Math.max(0, Math.round(clampNumber(item.completed, 0))),
    target: Math.max(0, Math.round(clampNumber(item.target, 0)))
  };
}

function buildEmployeeSummary(items = []) {
  const total = items.length;
  const activeCount = items.filter((item) => item.status === "active").length;
  const workingHeadcount = items.filter((item) => item.status !== "resigned").length;
  const roleCounts = {
    engineer: items.filter((item) => item.role === "engineer" && item.status !== "resigned").length,
    sales: items.filter((item) => item.role === "sales" && item.status !== "resigned").length,
    sales_manager: items.filter((item) => item.role === "sales_manager" && item.status !== "resigned").length,
    admin: items.filter((item) => item.role === "admin" && item.status !== "resigned").length
  };
  const resignedCount = items.filter((item) => item.status === "resigned").length;
  const attendanceRate = workingHeadcount ? Number(((activeCount / workingHeadcount) * 100).toFixed(1)) : 0;
  return {
    total,
    activeCount,
    workingHeadcount,
    resignedCount,
    attendanceRate,
    roleCounts
  };
}

function getEmployeesData() {
  const raw = readJson(EMPLOYEES_FILE, defaultEmployeesData());
  const monthlyTrend = (Array.isArray(raw.monthlyTrend) ? raw.monthlyTrend : defaultEmployeesData().monthlyTrend).map(normalizeEmployeeTrend);
  const quoteItems = readJson(SAVES_FILE, []);
  const repairOrders = getRepairOrders();
  const items = (Array.isArray(raw.items) ? raw.items : defaultEmployeesData().items)
    .map(normalizeEmployee)
    .map((item) => ({
      ...item,
      payrollSummary: buildEmployeePayroll(item, quoteItems, repairOrders)
    }));
  return {
    monthlyTrend,
    items,
    summary: buildEmployeeSummary(items)
  };
}

function saveEmployeesData(data) {
  writeJson(EMPLOYEES_FILE, {
    monthlyTrend: (Array.isArray(data.monthlyTrend) ? data.monthlyTrend : []).map(normalizeEmployeeTrend),
    items: (Array.isArray(data.items) ? data.items : []).map(normalizeEmployee)
  });
  return getEmployeesData();
}

function findEmployeeById(employeeId = "") {
  const requested = String(employeeId || "").trim();
  if (!requested) return null;
  return getEmployeesData().items.find((item) => item.id === requested) || null;
}

function normalizeCustomerOrder(item = {}, index = 0) {
  return {
    id: String(item.id || `ORD-${index + 1}`).trim(),
    name: String(item.name || `订单 ${index + 1}`).trim(),
    status: String(item.status || "处理中").trim(),
    date: String(item.date || "").trim(),
    archived: Boolean(item.archived || item.archivedAt),
    archivedAt: String(item.archivedAt || "").trim(),
    archiveReason: String(item.archiveReason || "").trim()
  };
}

function normalizeCustomerDevice(item = {}, index = 0) {
  return {
    id: String(item.id || `customer-device-${index + 1}`).trim(),
    type: String(item.type || "设备").trim(),
    name: String(item.name || `设备 ${index + 1}`).trim(),
    sn: String(item.sn || "").trim(),
    archived: Boolean(item.archived || item.archivedAt),
    archivedAt: String(item.archivedAt || "").trim(),
    archiveReason: String(item.archiveReason || "").trim()
  };
}

function normalizeCustomerPhoto(item = {}, index = 0) {
  return {
    id: String(item.id || `customer-photo-${index + 1}`).trim(),
    title: String(item.title || `现场照片 ${index + 1}`).trim(),
    takenAt: String(item.takenAt || "").trim(),
    imageUrl: String(item.imageUrl || "").trim()
  };
}

function normalizeCustomerWarranty(item = {}, index = 0) {
  return {
    id: String(item.id || `customer-warranty-${index + 1}`).trim(),
    title: String(item.title || `保修记录 ${index + 1}`).trim(),
    detail: String(item.detail || "").trim(),
    date: String(item.date || "").trim(),
    serialNo: String(item.serialNo || item.sn || "").trim()
  };
}

function normalizeCustomerRecord(item = {}, index = 0) {
  const customerType = ["end_customer", "business", "local_wholesale"].includes(String(item.customerType || "").trim())
    ? String(item.customerType).trim()
    : "end_customer";
  return {
    id: toId(item.id || item.archiveNo || item.name || `customer-${index + 1}`, `customer-${index + 1}`),
    archiveNo: String(item.archiveNo || `VSLM-CRM-${String(index + 1).padStart(3, "0")}`).trim(),
    name: String(item.name || `客户 ${index + 1}`).trim(),
    contactName: String(item.contactName || "").trim(),
    phone: String(item.phone || "").trim(),
    email: String(item.email || "").trim(),
    province: String(item.province || "").trim(),
    location: String(item.location || "").trim(),
    address: String(item.address || "").trim(),
    customerType,
    customerTypeLabel: String(item.customerTypeLabel || getCustomerTypeLabel(customerType)).trim(),
    usageType: String(item.usageType || "住宅用电").trim(),
    installDate: String(item.installDate || "").trim(),
    salesPersonId: String(item.salesPersonId || "").trim(),
    salesPersonName: String(item.salesPersonName || "").trim(),
    payment: {
      cycleLabel: String(item.payment?.cycleLabel || "Monthly").trim(),
      completedWeeks: Math.max(0, Math.round(clampNumber(item.payment?.completedWeeks, 0))),
      totalWeeks: Math.max(1, Math.round(clampNumber(item.payment?.totalWeeks, 1))),
      paidAmount: Math.max(0, Math.round(clampNumber(item.payment?.paidAmount, 0))),
      balanceAmount: Math.max(0, Math.round(clampNumber(item.payment?.balanceAmount, 0))),
      nextDueLabel: String(item.payment?.nextDueLabel || "-").trim()
    },
    paymentHistory: (Array.isArray(item.paymentHistory) ? item.paymentHistory : []).map((entry, paymentIndex) => ({
      id: String(entry.id || `PAY-${Date.now()}-${paymentIndex + 1}`).trim(),
      amount: Math.max(0, Math.round(clampNumber(entry.amount, 0))),
      paidAt: String(entry.paidAt || entry.date || "").trim(),
      collectorName: String(entry.collectorName || "").trim(),
      note: String(entry.note || "").trim(),
      receiptNo: String(entry.receiptNo || `CPAY-${String(entry.id || `${index + 1}${paymentIndex + 1}`).replace(/[^A-Za-z0-9]/g, "").slice(-10)}`).trim()
    })).sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime()),
    orders: (Array.isArray(item.orders) ? item.orders : []).map(normalizeCustomerOrder),
    devices: (Array.isArray(item.devices) ? item.devices : []).map(normalizeCustomerDevice),
    photos: (Array.isArray(item.photos) ? item.photos : []).map(normalizeCustomerPhoto),
    warrantyHistory: (Array.isArray(item.warrantyHistory) ? item.warrantyHistory : []).map(normalizeCustomerWarranty),
    warrantyEndsAt: String(item.warrantyEndsAt || "").trim(),
    archived: Boolean(item.archived || item.archivedAt),
    archivedAt: String(item.archivedAt || "").trim(),
    archiveReason: String(item.archiveReason || "").trim()
  };
}

function getActiveCustomers(items = []) {
  return items.filter((item) => !item.archived && !item.archivedAt);
}

function buildCustomerSummary(items = []) {
  const activeItems = getActiveCustomers(items);
  const total = activeItems.length;
  const totalPaid = activeItems.reduce((sum, item) => sum + item.payment.paidAmount, 0);
  const totalBalance = activeItems.reduce((sum, item) => sum + item.payment.balanceAmount, 0);
  const activeWarranty = activeItems.filter((item) => item.warrantyEndsAt && new Date(item.warrantyEndsAt).getTime() >= Date.now()).length;
  return {
    total,
    totalPaid,
    totalBalance,
    activeWarranty
  };
}

function getCustomersData() {
  const raw = readJson(CUSTOMERS_FILE, defaultCustomersData());
  const items = (Array.isArray(raw.items) ? raw.items : defaultCustomersData().items).map(normalizeCustomerRecord);
  return {
    items,
    summary: buildCustomerSummary(items)
  };
}

function normalizeWholesaleOrder(item = {}, index = 0) {
  const status = ["pending_payment", "partial_paid", "paid", "delivered", "cancelled"].includes(String(item.status || "").trim())
    ? String(item.status).trim()
    : "pending_payment";
  const statusLabelMap = {
    pending_payment: "待付款",
    partial_paid: "部分收款",
    paid: "已付款",
    delivered: "已交付",
    cancelled: "已取消"
  };
  return {
    id: String(item.id || `WHO-${Date.now()}-${index + 1}`).trim(),
    merchantId: String(item.merchantId || "").trim(),
    merchantName: String(item.merchantName || "").trim(),
    salesPersonId: String(item.salesPersonId || "").trim(),
    salesPersonName: String(item.salesPersonName || "").trim(),
    packageId: String(item.packageId || "").trim(),
    packageName: String(item.packageName || "").trim(),
    quantity: Math.max(1, Math.round(clampNumber(item.quantity, 1))),
    unitPriceVt: Math.max(0, Math.round(clampNumber(item.unitPriceVt, 0))),
    totalVt: Math.max(0, Math.round(clampNumber(item.totalVt, 0))),
    paidAmountVt: Math.max(0, Math.round(clampNumber(item.paidAmountVt, 0))),
    balanceAmountVt: Math.max(0, Math.round(clampNumber(item.balanceAmountVt, Math.max(0, clampNumber(item.totalVt, 0) - clampNumber(item.paidAmountVt, 0))))),
    status,
    statusLabel: String(statusLabelMap[status] || "待付款").trim(),
    currency: String(item.currency || "VUV").trim(),
    createdAt: String(item.createdAt || new Date().toISOString()).trim(),
    notes: String(item.notes || "").trim()
  };
}

function buildWholesaleDataFromOrders(rawOrders = []) {
  const orders = (Array.isArray(rawOrders) ? rawOrders : [])
    .map(normalizeWholesaleOrder)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const customers = getCustomersData();
  const merchants = customers.items
    .filter((item) => item.customerType === "local_wholesale")
    .map((item) => {
      const merchantOrders = orders.filter((order) => order.merchantId === item.id);
      const lifetimeTotal = merchantOrders.reduce((sum, order) => sum + order.totalVt, 0);
      const paidTotal = merchantOrders.reduce((sum, order) => sum + order.paidAmountVt, 0);
      const pendingBalance = merchantOrders
        .reduce((sum, order) => sum + order.balanceAmountVt, 0);
      return {
        ...item,
        wholesaleStats: {
          orderCount: merchantOrders.length,
          lifetimeTotal,
          pendingBalance,
          paidTotal
        }
      };
    });
  const employees = getEmployeesData();
  const salesPeople = employees.items.filter((item) => item.role === "sales" || item.role === "sales_manager");
  const packages = getProductConfig().packages
    .filter((item) => item.status === "active")
    .map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      stock: item.stock,
      costVt: item.costVt,
      retailVt: item.retailVt,
      wholesaleVt: item.wholesaleVt,
      storageKwh: item.storageKwh,
      panelCount: item.panelCount,
      panelWatts: item.panelWatts,
      loadCapacityW: item.loadCapacityW,
      inverterModel: item.inverterModel
    }));
  return {
    merchants,
    salesPeople,
    packages,
    orders,
    summary: {
      merchantCount: merchants.length,
      orderCount: orders.length,
      pendingAmount: orders.reduce((sum, item) => sum + item.balanceAmountVt, 0),
      wholesaleRevenue: orders
        .filter((item) => item.status !== "cancelled")
        .reduce((sum, item) => sum + item.totalVt, 0),
      paidAmount: orders.reduce((sum, item) => sum + item.paidAmountVt, 0)
    }
  };
}

function getWholesaleData() {
  const raw = readJson(WHOLESALE_FILE, defaultWholesaleData());
  return buildWholesaleDataFromOrders(Array.isArray(raw.orders) ? raw.orders : defaultWholesaleData().orders);
}

async function getWholesaleDataAsync() {
  if (commerceStore.isEnabled()) {
    await ensureCommerceStoreReady();
    return buildWholesaleDataFromOrders(await commerceStore.listWholesaleOrders());
  }
  return getWholesaleData();
}

function saveWholesaleData(data) {
  const payload = {
    orders: (Array.isArray(data.orders) ? data.orders : []).map(normalizeWholesaleOrder)
  };
  writeJson(WHOLESALE_FILE, payload);
  if (commerceStore.isEnabled()) {
    commerceStore.replaceWholesaleOrders(payload.orders).catch((error) => {
      console.error("[wholesale] Failed to persist commerce store:", error);
    });
  }
  return getWholesaleData();
}

function saveCustomersData(data) {
  writeJson(CUSTOMERS_FILE, {
    items: (Array.isArray(data.items) ? data.items : []).map(normalizeCustomerRecord)
  });
  return getCustomersData();
}

function getCustomerDetail(id) {
  const customers = getCustomersData();
  const customer = customers.items.find((item) => item.id === String(id || "").trim()) || null;
  if (!customer) return null;
  const customerName = String(customer.name || "").trim().toLowerCase();
  const customerPhone = String(customer.phone || "").trim();
  const relatedQuotes = readJson(SAVES_FILE, [])
    .map((item) => ({
      id: String(item.id || "").trim(),
      customerName: String(item.customer?.name || item.customerName || item.payload?.customer?.name || "").trim(),
      customerPhone: String(item.customer?.phone || item.customerPhone || item.payload?.customer?.phone || "").trim(),
      packageName: String(item.packageName || item.payload?.recommendation?.packageName || "").trim(),
      total: Math.max(0, Math.round(clampNumber(item.total, item.payload?.quote?.displayTotal || item.payload?.quote?.total || 0))),
      status: String(item.status || "draft").trim(),
      createdAt: String(item.createdAt || "").trim(),
      salesPersonName: String(item.salesPersonName || item.payload?.salesPersonName || item.payload?.salesPerson?.name || "").trim()
    }))
    .filter((item) => (customerPhone && item.customerPhone === customerPhone) || (customerName && item.customerName.toLowerCase() === customerName))
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  const relatedRepairs = readJson(REPAIR_ORDERS_FILE, defaultRepairOrders())
    .items.map((item) => ({
      id: String(item.id || "").trim(),
      title: String(item.title || "").trim(),
      status: String(item.statusLabel || item.status || "").trim(),
      customerName: String(item.customer?.name || "").trim(),
      customerPhone: String(item.customer?.phone || "").trim(),
      assignedEngineer: String(item.assignedEngineer?.name || "").trim(),
      etaLabel: String(item.etaLabel || "").trim()
    }))
    .filter((item) => (customerPhone && item.customerPhone === customerPhone) || (customerName && item.customerName.toLowerCase() === customerName));
  return {
    ...customer,
    orders: (Array.isArray(customer.orders) ? customer.orders : []).filter((item) => !item.archived && !item.archivedAt),
    relatedQuotes,
    relatedRepairs
  };
}

function searchCustomerWarrantyBySerial(serial) {
  const keyword = String(serial || "").trim().toLowerCase();
  if (!keyword) return [];
  const customers = getCustomersData().items;
  return customers.flatMap((customer) => {
    const devices = Array.isArray(customer.devices) ? customer.devices : [];
    const matchedDevices = devices.filter((device) => String(device.sn || "").trim().toLowerCase().includes(keyword));
    if (!matchedDevices.length) return [];
    const histories = (Array.isArray(customer.warrantyHistory) ? customer.warrantyHistory : []).filter((item) => {
      const itemSerial = String(item.serialNo || "").trim().toLowerCase();
      return !itemSerial || matchedDevices.some((device) => String(device.sn || "").trim().toLowerCase() === itemSerial || itemSerial.includes(keyword));
    });
    return matchedDevices.map((device) => ({
      customerId: customer.id,
      customerName: customer.name,
      contactName: customer.contactName,
      phone: customer.phone,
      deviceId: device.id,
      deviceName: device.name,
      deviceType: device.type,
      serialNo: device.sn || "",
      warrantyEndsAt: customer.warrantyEndsAt || "",
      history: histories
    }));
  });
}

function normalizeVendor(item = {}, index = 0) {
  return {
    id: toId(item.id || item.name || `vendor-${index + 1}`, `vendor-${index + 1}`),
    name: String(item.name || `供应商 ${index + 1}`).trim(),
    region: String(item.region || "中国港口供应商").trim(),
    locationTag: String(item.locationTag || "").trim(),
    reliabilityScore: Number(clampNumber(item.reliabilityScore, 90)).toFixed(1) * 1,
    category: String(item.category || "综合供应").trim(),
    secondaryCategory: String(item.secondaryCategory || "").trim(),
    contactName: String(item.contactName || "").trim(),
    contactRole: String(item.contactRole || "").trim(),
    contactPhone: String(item.contactPhone || "").trim(),
    pendingOrders: Math.max(0, Math.round(clampNumber(item.pendingOrders, 0))),
    inTransitOrders: Math.max(0, Math.round(clampNumber(item.inTransitOrders, 0))),
    transitMode: String(item.transitMode || "本地网络").trim(),
    isActive: item.isActive !== false,
    leadTimeDays: Math.max(1, Math.round(clampNumber(item.leadTimeDays, 7))),
    minOrderVt: Math.max(0, Math.round(clampNumber(item.minOrderVt, 0))),
    supportedItems: Array.isArray(item.supportedItems) ? item.supportedItems.map((entry) => String(entry || "").trim()).filter(Boolean) : []
  };
}

function normalizeVendorOrder(item = {}, index = 0) {
  const status = ["pending", "approved", "in_transit", "received", "cancelled"].includes(String(item.status || "").trim())
    ? String(item.status).trim()
    : "pending";
  const statusMap = {
    pending: "待审批",
    approved: "已下单执行",
    in_transit: "海运在途",
    received: "已到货",
    cancelled: "已取消"
  };
  const currency = ["CNY", "USD"].includes(String(item.currency || "").trim().toUpperCase())
    ? String(item.currency).trim().toUpperCase()
    : "CNY";
  const lines = (Array.isArray(item.lines) ? item.lines : []).map((line, lineIndex) => {
    const quantity = Math.max(1, Math.round(clampNumber(line.quantity, 1)));
    const unitPrice = Math.max(0, Number(clampNumber(line.unitPrice, 0).toFixed(2)));
    const lineCurrency = ["CNY", "USD"].includes(String(line.currency || currency).trim().toUpperCase())
      ? String(line.currency || currency).trim().toUpperCase()
      : currency;
    return {
      id: String(line.id || `${item.id || `line-${index + 1}`}-${lineIndex + 1}`).trim(),
      itemName: String(line.itemName || item.itemName || "未命名物料").trim(),
      quantity,
      unit: String(line.unit || item.unit || "pcs").trim(),
      unitPrice,
      currency: lineCurrency,
      lineTotal: Number(clampNumber(line.lineTotal, unitPrice * quantity).toFixed(2))
    };
  });
  const fallbackQuantity = Math.max(1, Math.round(clampNumber(item.quantity, 1)));
  const fallbackUnitPrice = Math.max(0, Number(clampNumber(item.unitPriceVt || item.unitPrice, 0).toFixed(2)));
  const finalLines = lines.length ? lines : [{
    id: `${item.id || `line-${index + 1}`}-1`,
    itemName: String(item.itemName || "未命名物料").trim(),
    quantity: fallbackQuantity,
    unit: String(item.unit || "pcs").trim(),
    unitPrice: fallbackUnitPrice,
    currency,
    lineTotal: Number((fallbackUnitPrice * fallbackQuantity).toFixed(2))
  }];
  const totalAmount = Number(clampNumber(item.totalAmount, finalLines.reduce((sum, line) => sum + line.lineTotal, 0)).toFixed(2));
  return {
    id: String(item.id || `PO-${Date.now()}-${index + 1}`).trim(),
    vendorId: String(item.vendorId || "").trim(),
    vendorName: String(item.vendorName || "").trim(),
    currency,
    totalAmount,
    status,
    statusLabel: String(item.statusLabel || statusMap[status] || "待审批").trim(),
    requestedBy: String(item.requestedBy || "采购中心").trim(),
    createdAt: String(item.createdAt || new Date().toISOString()).trim(),
    notes: String(item.notes || "").trim(),
    lines: finalLines,
    itemSummary: finalLines.map((line) => `${line.itemName} x${line.quantity}`).join("、")
  };
}

function buildVendorsData(raw = {}) {
  const items = (Array.isArray(raw.items) ? raw.items : defaultVendorsData().items).map(normalizeVendor);
  const orders = (Array.isArray(raw.orders) ? raw.orders : defaultVendorsData().orders).map(normalizeVendorOrder)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const inventory = getInventoryData();
  const productConfig = getProductConfig();
  const catalogMap = new Map();
  productConfig.packages.forEach((item) => {
    catalogMap.set(item.name, {
      value: item.name,
      label: `${item.name} / 套装`,
      unit: "sets",
      defaultPrice: item.retailVt || 0,
      source: "package"
    });
  });
  inventory.stockItems.forEach((item) => {
    catalogMap.set(item.name, {
      value: item.name,
      label: `${item.name} / ${item.category}`,
      unit: item.unit || "pcs",
      defaultPrice: item.unitCostVt || 0,
      source: "inventory"
    });
  });
  ["末端配送服务", "仓储转运", "上门送货", "上门安装", "现场支架施工", "系统调试", "集装箱海运", "拼柜运输", "到港清关协调"].forEach((name) => {
    if (!catalogMap.has(name)) {
      catalogMap.set(name, {
        value: name,
        label: `${name} / 服务`,
        unit: "jobs",
        defaultPrice: 0,
        source: "service"
      });
    }
  });
  const itemsWithCounts = items.map((item) => {
    const pendingOrders = orders.filter((order) => order.vendorId === item.id && (order.status === "pending" || order.status === "approved")).length;
    const inTransitOrders = orders.filter((order) => order.vendorId === item.id && order.status === "in_transit").length;
    const supportedCatalog = (item.supportedItems || [])
      .map((name) => catalogMap.get(name))
      .filter(Boolean)
      .map((entry) => ({
        ...entry,
        vendorId: item.id
      }));
    const nextItem = {
      ...item,
      pendingOrders,
      inTransitOrders,
      recentOrders: orders.filter((order) => order.vendorId === item.id).slice(0, 4),
      supportedCatalog
    };
    return nextItem;
  });
  const activeVendors = itemsWithCounts.filter((item) => item.isActive).length;
  const ordersPending = orders.filter((item) => item.status === "pending" || item.status === "approved").length;
  const transitBatches = orders.filter((item) => item.status === "in_transit").length;
  const avgReliability = items.length
    ? Number((items.reduce((sum, item) => sum + item.reliabilityScore, 0) / items.length).toFixed(1))
    : 0;
  const chinaVendors = itemsWithCounts.filter((item) => item.region.includes("中国"));
  const localVendors = itemsWithCounts.filter((item) => item.region.includes("维拉") || item.region.includes("本地"));
  const purchaseOptions = itemsWithCounts.reduce((acc, item) => {
    acc[item.id] = item.supportedCatalog || [];
    return acc;
  }, {});
  return {
    items: itemsWithCounts,
    orders,
    purchaseOptions,
    selectedVendors: {
      china: chinaVendors.slice(0, 2),
      local: localVendors.slice(0, 2)
    },
    sections: {
      chinaVendors,
      localVendors
    },
    summary: {
      activeVendors,
      ordersPending,
      avgReliability,
      transitBatches
    }
  };
}

function getVendorsData() {
  return buildVendorsData(readJson(VENDORS_FILE, defaultVendorsData()));
}

async function getVendorsDataAsync() {
  if (commerceStore.isEnabled()) {
    await ensureCommerceStoreReady();
    const [items, orders] = await Promise.all([
      commerceStore.listVendors(),
      commerceStore.listVendorOrders()
    ]);
    return buildVendorsData({ items, orders });
  }
  return getVendorsData();
}

function saveVendorsData(data) {
  const payload = {
    items: (Array.isArray(data.items) ? data.items : defaultVendorsData().items).map(normalizeVendor),
    orders: (Array.isArray(data.orders) ? data.orders : defaultVendorsData().orders).map(normalizeVendorOrder)
  };
  writeJson(VENDORS_FILE, payload);
  if (commerceStore.isEnabled()) {
    commerceStore.replaceVendorData(payload).catch((error) => {
      console.error("[vendors] Failed to persist commerce store:", error);
    });
  }
  return getVendorsData();
}

function inferLocationCoordinates(customer = {}) {
  const haystack = `${customer.location || ""} ${customer.address || ""} ${customer.province || ""}`.toLowerCase();
  if (haystack.includes("emae")) return { lat: -17.0504, lng: 168.3972 };
  if (haystack.includes("malo")) return { lat: -15.6906, lng: 167.1703 };
  if (haystack.includes("tanna")) return { lat: -19.5316, lng: 169.2818 };
  if (haystack.includes("santo") || haystack.includes("sanma")) return { lat: -15.5128, lng: 167.1764 };
  if (haystack.includes("port vila") || haystack.includes("shefa")) return { lat: -17.7333, lng: 168.3167 };
  return { lat: -17.7333, lng: 168.3167 };
}

function parseCurrencyAmount(value) {
  const raw = String(value || "").trim().toUpperCase();
  const multiplier = raw.includes("M") ? 1000000 : raw.includes("K") ? 1000 : 1;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const num = Number(cleaned);
  return Number.isFinite(num) ? Math.round(num * multiplier) : 0;
}

function getPerformanceData() {
  const employees = getEmployeesData().items.filter((item) => item.role === "sales" || item.role === "sales_manager");
  const customers = getCustomersData().items;
  const savedQuotes = readJson(SAVES_FILE, []).map((item) => ({
    ...item,
    total: Math.max(0, Math.round(clampNumber(item.total || item.payload?.quote?.displayTotal || item.payload?.quote?.total, 0))),
    status: String(item.status || "draft").trim(),
    createdAt: String(item.createdAt || new Date().toISOString()).trim(),
    salesPersonName: String(item.salesPersonName || item.payload?.salesPerson?.name || "").trim(),
    customerName: String(item.customer?.name || item.customerName || item.payload?.customer?.name || "未命名客户").trim(),
    customerPhone: String(item.customer?.phone || item.payload?.customer?.phone || "").trim(),
    customerEmail: String(item.customer?.email || item.payload?.customer?.email || "").trim(),
    customerAddress: String(item.customer?.address || item.payload?.customer?.address || "").trim(),
    packageName: String(item.packageName || item.payload?.recommendation?.packageName || "未命名套装").trim(),
    location: String(item.location || item.payload?.location || item.customer?.address || item.payload?.customer?.address || "Vanuatu").trim()
  }));

  const targetBase = 1200000;
  const team = employees.map((employee) => {
    const relatedQuotes = savedQuotes.filter((item) => {
      const assignedName = item.salesPersonName.toLowerCase();
      if (assignedName) return assignedName === employee.name.toLowerCase();
      return employee.role === "sales_manager" && employee.branch.toLowerCase().includes("port vila");
    });
    const monthlyAmount = relatedQuotes.reduce((sum, item) => sum + item.total, 0);
    const targetAmount = parseCurrencyAmount(employee.metrics?.secondaryValue) || targetBase;
    const achievementRate = targetAmount ? Number(((monthlyAmount / targetAmount) * 100).toFixed(1)) : 0;
    const paidCount = relatedQuotes.filter((item) => item.status === "paid").length;
    const delayedCount = relatedQuotes.filter((item) => item.status === "draft" || item.status === "sent").length;
    const collectionStatus = delayedCount > paidCount && delayedCount > 0 ? "延迟" : "正常";
    const badge = achievementRate >= 110 ? "明星" : achievementRate >= 95 ? "优秀" : "需跟进";
    const quoteDetails = relatedQuotes
      .map((item) => ({
        id: item.id,
        customerName: item.customerName,
        customerPhone: item.customerPhone,
        customerEmail: item.customerEmail,
        customerAddress: item.customerAddress,
        packageName: item.packageName,
        total: item.total,
        status: item.status,
        createdAt: item.createdAt,
        location: item.location
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return {
      id: employee.id,
      name: employee.name,
      employeeNo: employee.employeeNo,
      branch: employee.branch,
      role: employee.role,
      roleLabel: employee.roleLabel,
      monthlyAmount,
      targetAmount,
      achievementRate,
      collectionStatus,
      badge,
      status: employee.statusLabel,
      activeProjects: relatedQuotes.filter((item) => item.status !== "paid").length,
      quoteCount: relatedQuotes.length,
      quoteDetails
    };
  }).sort((a, b) => b.monthlyAmount - a.monthlyAmount);

  const now = new Date();
  const monthBuckets = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (4 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: index === 4 ? "本月" : `${date.getMonth() + 1}月`,
      monthLabel: `${date.getFullYear()}年${date.getMonth() + 1}月`,
      value: 0,
      quotes: []
    };
  });

  savedQuotes.forEach((item) => {
    const date = new Date(item.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthBuckets.find((entry) => entry.key === key);
    if (!bucket) return;
    bucket.value += item.total;
    bucket.quotes.push({
      id: item.id,
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      customerEmail: item.customerEmail,
      customerAddress: item.customerAddress,
      packageName: item.packageName,
      total: item.total,
      status: item.status,
      createdAt: item.createdAt,
      salesPersonName: item.salesPersonName || "未分配销售",
      location: item.location
    });
  });

  const totalActual = team.reduce((sum, item) => sum + item.monthlyAmount, 0);
  const totalTarget = team.reduce((sum, item) => sum + item.targetAmount, 0);
  const achievementRate = totalTarget ? Number(((totalActual / totalTarget) * 100).toFixed(1)) : 0;
  const unpaid = savedQuotes.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.total, 0);
  const collectionOverdueRate = totalActual ? Number(((unpaid / Math.max(totalActual + unpaid, 1)) * 100).toFixed(1)) : 0;
  const activeProjects = savedQuotes.filter((item) => item.status !== "paid").length;
  const overdueQuotes = savedQuotes
    .filter((item) => item.status !== "paid")
    .map((item) => ({
      id: item.id,
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      customerEmail: item.customerEmail,
      customerAddress: item.customerAddress,
      packageName: item.packageName,
      total: item.total,
      status: item.status,
      createdAt: item.createdAt,
      salesPersonName: item.salesPersonName || "未分配销售",
      location: item.location
    }))
    .sort((a, b) => b.total - a.total);
  const activeProjectDetails = overdueQuotes.map((item) => ({
    ...item,
    stage: item.status === "draft" ? "方案跟进中" : item.status === "sent" ? "已发送待回款" : "执行中"
  }));
  const bestPerformer = team[0] || null;
  const coverageRate = Math.min(100, 82 + team.length * 3);
  const mapPoints = customers.slice(0, 8).map((customer, index) => {
    const coords = inferLocationCoordinates(customer);
    return {
      id: customer.id || `coverage-${index + 1}`,
      name: customer.name,
      location: customer.location || customer.address || "Vanuatu",
      coverageValue: Math.max(65, Math.min(100, 72 + index * 5)),
      lat: coords.lat,
      lng: coords.lng
    };
  });
  const focusPoint = mapPoints[0] || {
    id: "focus-port-vila",
    name: "Port Vila",
    location: "Port Vila, Vanuatu",
    coverageValue: coverageRate,
    lat: -17.7333,
    lng: 168.3167
  };

  return {
    periodLabel: `${new Date().getFullYear()}年${new Date().getMonth() + 1}月`,
    title: `${new Date().getFullYear()}年${new Date().getMonth() + 1}月区域经理业绩报告`,
    summary: {
      achievementRate,
      collectionOverdueRate,
      activeProjects,
      totalActual,
      totalTarget,
      coverageRate
    },
    trend: monthBuckets,
    team,
    details: {
      achievement: {
        periodLabel: `${new Date().getFullYear()}年${new Date().getMonth() + 1}月`,
        totalActual,
        totalTarget,
        gapAmount: Math.max(0, totalTarget - totalActual),
        teamBreakdown: team.map((item) => ({
          id: item.id,
          name: item.name,
          roleLabel: item.roleLabel,
          monthlyAmount: item.monthlyAmount,
          targetAmount: item.targetAmount,
          achievementRate: item.achievementRate,
          quoteCount: item.quoteCount
        }))
      },
      overdue: {
        count: overdueQuotes.length,
        totalAmount: unpaid,
        items: overdueQuotes
      },
      activeProjects: {
        count: activeProjectDetails.length,
        items: activeProjectDetails
      }
    },
    insight: {
      headline: "月度业务洞察",
      text: `本月团队累计签约 ${Math.max(0, Math.round(totalActual)).toLocaleString("en-US")} VT，整体达成率 ${achievementRate}%。${bestPerformer ? `其中 ${bestPerformer.name} 表现最佳，完成率 ${bestPerformer.achievementRate}%。` : ""} 当前未结清报价占比 ${collectionOverdueRate}% ，建议优先跟进草稿和已发送未付款客户。`
    },
      bestPerformer,
      region: {
        name: bestPerformer?.branch || "Port Vila 核心区域",
        coverageRate,
        mapCenter: {
          lat: focusPoint.lat,
          lng: focusPoint.lng
        },
        points: mapPoints
      }
    };
  }

function getReportsData() {
  const quotes = readJson(SAVES_FILE, []).map((item) => ({
    ...item,
    total: Math.max(0, Math.round(clampNumber(item.total || item.payload?.quote?.displayTotal || item.payload?.quote?.total, 0))),
    status: String(item.status || "draft").trim(),
    createdAt: String(item.createdAt || new Date().toISOString()).trim(),
    salesPersonName: String(item.salesPersonName || item.payload?.salesPerson?.name || "").trim(),
    customerName: String(item.customer?.name || item.customerName || item.payload?.customer?.name || "未命名客户").trim(),
    customerPhone: String(item.customer?.phone || item.payload?.customer?.phone || "").trim(),
    customerEmail: String(item.customer?.email || item.payload?.customer?.email || "").trim(),
    customerAddress: String(item.customer?.address || item.payload?.customer?.address || "").trim(),
    packageName: String(item.packageName || item.payload?.recommendation?.packageName || "未命名套装").trim()
  }));
  const employees = getEmployeesData().items;
  const repairs = getRepairOrders();
  const inventory = getInventoryData();

  const financeTotal = quotes.reduce((sum, item) => sum + item.total, 0);
  const pendingCount = quotes.filter((item) => item.status !== "paid").length;
  const settlementRate = quotes.length ? Number(((quotes.filter((item) => item.status === "paid").length / quotes.length) * 100).toFixed(1)) : 0;
  const financeDetails = quotes
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((item) => ({
      id: item.id,
      customerName: item.customerName,
      customerPhone: item.customerPhone,
      customerEmail: item.customerEmail,
      packageName: item.packageName,
      total: item.total,
      status: item.status,
      createdAt: item.createdAt,
      salesPersonName: item.salesPersonName || "未分配销售"
    }));

  const now = new Date();
  const monthBuckets = Array.from({ length: 6 }, (_, index) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getMonth() + 1}月`;
    return { key, label, total: 0 };
  });

  quotes.forEach((item) => {
    const date = new Date(item.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const bucket = monthBuckets.find((entry) => entry.key === key);
    if (bucket) {
      bucket.total += item.total;
      bucket.items = bucket.items || [];
      bucket.items.push({
        id: item.id,
        customerName: item.customerName,
        customerPhone: item.customerPhone,
        customerEmail: item.customerEmail,
        packageName: item.packageName,
        total: item.total,
        status: item.status,
        createdAt: item.createdAt,
        salesPersonName: item.salesPersonName || "未分配销售"
      });
    }
  });

  const avgTurnover = inventory.stockItems.length
    ? Number((inventory.stockItems.reduce((sum, item) => sum + (item.monthlyUsage / Math.max(item.quantity || 1, 1)), 0) / inventory.stockItems.length * 12).toFixed(1))
    : 0;

  const salesRoles = employees.filter((item) => item.role === "sales" || item.role === "sales_manager");
  const engineerRoles = employees.filter((item) => item.role === "engineer");

  const commissionItems = [
    ...salesRoles.map((employee) => {
      const relatedQuotes = quotes.filter((item) => {
        const assignedName = item.salesPersonName.toLowerCase();
        if (assignedName) return assignedName === employee.name.toLowerCase();
        return employee.role === "sales_manager" && employee.branch.toLowerCase().includes("port vila");
      });
      const signedTotal = relatedQuotes.reduce((sum, item) => sum + item.total, 0);
      const rate = employee.role === "sales_manager" ? 0.018 : 0.03;
      const commission = Math.round(signedTotal * rate);
      return {
        id: employee.id,
        name: employee.name,
        role: employee.roleLabel,
        type: "sales",
        amount: commission,
        relatedItems: relatedQuotes.map((item) => ({
          id: item.id,
          customerName: item.customerName,
          customerPhone: item.customerPhone,
          customerEmail: item.customerEmail,
          packageName: item.packageName,
          total: item.total,
          status: item.status,
          createdAt: item.createdAt
        }))
      };
    }),
    ...engineerRoles.map((employee) => {
      const relatedRepairs = repairs.filter((item) => String(item.assignedEngineer?.name || "").trim().toLowerCase() === employee.name.toLowerCase());
      const completed = relatedRepairs.filter((item) => item.status === "completed").length;
      const inProgress = relatedRepairs.filter((item) => item.status === "in_progress").length;
      const commission = completed * 2500 + inProgress * 1000;
      return {
        id: employee.id,
        name: employee.name,
        role: employee.roleLabel,
        type: "engineer",
        amount: commission,
        relatedItems: relatedRepairs.map((item) => ({
          id: item.id,
          title: item.title,
          customerName: item.customer?.name || "未命名客户",
          status: item.status,
          statusLabel: item.statusLabel || item.status,
          createdAt: item.createdAt || new Date().toISOString()
        }))
      };
    })
  ].sort((a, b) => b.amount - a.amount);

  const exportHistory = [
    { id: "report-finance-q1", name: "财务对账汇总", exportedAt: "2026-03-30 14:20", format: "EXCEL", status: "已完成", action: "重新下载" },
    { id: "report-sales-month", name: "月度销售与绩效报告", exportedAt: "2026-03-30 11:05", format: "PDF", status: "已完成", action: "重新下载" },
    { id: "report-commission", name: "全员佣金预结算清单", exportedAt: "2026-03-29 16:45", format: "EXCEL", status: "生成中", action: "等待中" }
  ];

  return {
    summary: {
      financeTotal,
      pendingCount,
      settlementRate,
      inventoryTurnover: avgTurnover,
      commissionTotal: commissionItems.reduce((sum, item) => sum + item.amount, 0)
    },
    monthlySales: monthBuckets,
    commissionItems: commissionItems.slice(0, 6),
    exportHistory,
    details: {
      finance: {
        totalAmount: financeTotal,
        pendingCount,
        settlementRate,
        items: financeDetails
      },
      inventory: {
        turnover: avgTurnover,
        items: inventory.stockItems
          .slice()
          .sort((a, b) => (b.monthlyUsage || 0) - (a.monthlyUsage || 0))
          .slice(0, 12)
          .map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            quantity: item.quantity,
            monthlyUsage: item.monthlyUsage,
            valueVt: item.valueVt
          }))
      },
      exportHistory
    }
  };
}

function getFinancialReportData() {
  const quotes = readJson(SAVES_FILE, []).map((item) => ({
    ...item,
    total: Math.max(0, Math.round(clampNumber(item.total || item.payload?.quote?.displayTotal || item.payload?.quote?.total, 0))),
    createdAt: String(item.createdAt || new Date().toISOString()).trim(),
    status: String(item.status || "draft").trim(),
    packageName: String(item.packageName || item.payload?.recommendation?.packageName || "").trim(),
    equipmentPrice: Math.max(0, Math.round(clampNumber(item.payload?.quote?.equipmentPrice, 0))),
    installFee: Math.max(0, Math.round(clampNumber(item.payload?.quote?.installFee, 0))),
    logisticsFee: Math.max(0, Math.round(clampNumber(item.payload?.quote?.logisticsFee, 0))),
    customerName: String(item.customer?.name || item.customerName || item.payload?.customer?.name || "未命名客户").trim(),
    customerPhone: String(item.customer?.phone || item.payload?.customer?.phone || "").trim(),
    customerEmail: String(item.customer?.email || item.payload?.customer?.email || "").trim(),
    customerAddress: String(item.customer?.address || item.payload?.customer?.address || "").trim(),
    salesPersonName: String(item.salesPersonName || item.payload?.salesPerson?.name || "").trim()
  }));
  const productConfig = getProductConfig();

  const monthlyRevenue = quotes.reduce((sum, item) => sum + item.total, 0);
  const arBalance = quotes.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.total, 0);
  const estimatedCost = quotes.reduce((sum, item) => {
    const matchedPackage = productConfig.packages.find((pkg) => pkg.name === item.packageName);
    return sum + (matchedPackage?.costVt || Math.round(item.equipmentPrice * 0.72)) + item.installFee + item.logisticsFee;
  }, 0);
  const profit = Math.max(0, monthlyRevenue - estimatedCost);
  const netProfitMargin = monthlyRevenue ? Number(((profit / monthlyRevenue) * 100).toFixed(1)) : 0;

  const packageBuckets = [
    { key: "mox", label: "MOX 套装（基础款）", amount: 0, color: "bg-primary" },
    { key: "mbox", label: "MBOX 套装（专业版）", amount: 0, color: "bg-secondary" },
    { key: "ultra", label: "ULTRA 工业级套装", amount: 0, color: "bg-teal-900" },
    { key: "service", label: "其他组件/维修服务", amount: 0, color: "bg-slate-500" }
  ];

  quotes.forEach((item) => {
    const name = item.packageName.toLowerCase();
    if (name.includes("m-box") || name.includes("mbox")) {
      packageBuckets[1].amount += item.total;
    } else if (name.includes("ultra") || name.includes("grid")) {
      packageBuckets[2].amount += item.total;
    } else if (name.includes("mox")) {
      packageBuckets[0].amount += item.total;
    } else {
      packageBuckets[3].amount += item.total;
    }
  });

  if (!packageBuckets.some((item) => item.amount > 0)) {
    packageBuckets[0].amount = Math.round(monthlyRevenue * 0.5);
    packageBuckets[1].amount = Math.round(monthlyRevenue * 0.3);
    packageBuckets[2].amount = Math.round(monthlyRevenue * 0.15);
    packageBuckets[3].amount = Math.max(0, monthlyRevenue - packageBuckets[0].amount - packageBuckets[1].amount - packageBuckets[2].amount);
  }

  const totalDistribution = packageBuckets.reduce((sum, item) => sum + item.amount, 0) || 1;
  const distribution = packageBuckets.map((item) => ({
    ...item,
    percent: Number(((item.amount / totalDistribution) * 100).toFixed(1))
  }));

  const shortCycleEfficiency = quotes.length ? Number((((quotes.filter((item) => item.status === "paid").length + 1) / (quotes.length + 1)) * 100).toFixed(1)) : 0;
  const longCycleEfficiency = Math.min(99.9, Number((88 + netProfitMargin / 2).toFixed(1)));

  const ledger = quotes.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 8).map((item, index) => {
    const category = item.total >= 0 ? "销售收入" : "退款业务";
    const state = item.status === "paid" ? "已结清" : item.status === "sent" ? "待支付" : "处理中";
    return {
      id: `FIN-${new Date(item.createdAt).getFullYear()}-${String(index + 1).padStart(4, "0")}`,
      category,
      customer: item.customerName,
      customerPhone: item.customerPhone,
      customerEmail: item.customerEmail,
      customerAddress: item.customerAddress,
      packageName: item.packageName,
      salesPersonName: item.salesPersonName || "未分配销售",
      createdAt: item.createdAt,
      amount: item.total,
      state,
      action: item.status === "paid" ? "详情" : "处理"
    };
  });

  return {
    periodLabel: `${new Date().getFullYear()}年 ${new Date().getMonth() + 1}月`,
    summary: {
      monthlyRevenue,
      arBalance,
      netProfitMargin
    },
    collection: {
      shortCycleEfficiency,
      longCycleEfficiency
    },
    distribution,
    ledger,
    details: {
      revenue: {
        total: monthlyRevenue,
        items: quotes.map((item) => ({
          id: item.id,
          customerName: item.customerName,
          customerPhone: item.customerPhone,
          customerEmail: item.customerEmail,
          customerAddress: item.customerAddress,
          packageName: item.packageName,
          salesPersonName: item.salesPersonName || "未分配销售",
          total: item.total,
          createdAt: item.createdAt,
          status: item.status
        }))
      },
      ar: {
        total: arBalance,
        items: quotes.filter((item) => item.status !== "paid").map((item) => ({
          id: item.id,
          customerName: item.customerName,
          customerPhone: item.customerPhone,
          customerEmail: item.customerEmail,
          customerAddress: item.customerAddress,
          packageName: item.packageName,
          salesPersonName: item.salesPersonName || "未分配销售",
          total: item.total,
          createdAt: item.createdAt,
          status: item.status
        }))
      },
      margin: {
        netProfitMargin,
        profit,
        estimatedCost,
        monthlyRevenue
      },
      distribution,
      collection: {
        shortCycleEfficiency,
        longCycleEfficiency,
        items: quotes.map((item) => ({
          id: item.id,
          customerName: item.customerName,
          packageName: item.packageName,
          total: item.total,
          status: item.status,
          createdAt: item.createdAt,
          cycleType: item.status === "paid" ? "短周期已结清" : "长周期跟进中"
        }))
      },
      ledger
    }
  };
}

function normalizeExpenseControlCollection(items, mapper) {
  return (Array.isArray(items) ? items : []).map(mapper).filter(Boolean);
}

function normalizeExpenseAmount(value) {
  return Math.max(0, Math.round(clampNumber(value, 0)));
}

function normalizeExpensePaymentQueue(item = {}, index = 0) {
  return {
    id: String(item.id || `ORD-${88291 + index}`).trim(),
    customer: String(item.customer || "未命名客户").trim(),
    amount: normalizeExpenseAmount(item.amount),
    createdAt: String(item.createdAt || new Date().toISOString()).trim(),
    status: String(item.status || "待审核").trim(),
    attachmentUrl: String(item.attachmentUrl || "").trim(),
    attachmentName: String(item.attachmentName || "").trim(),
    attachmentUploadedAt: String(item.attachmentUploadedAt || "").trim()
  };
}

function normalizeExpenseInstallment(item = {}, index = 0) {
  const totalWeeks = Math.max(1, Math.round(clampNumber(item.totalWeeks, 52)));
  const completedWeeks = Math.max(0, Math.min(totalWeeks, Math.round(clampNumber(item.completedWeeks, 0))));
  const progress = totalWeeks ? Number(((completedWeeks / totalWeeks) * 100).toFixed(1)) : 0;
  const rawStatus = String(item.status || "").trim();
  const status = ["履约中", "即将结清", "逾期风险", "已结清"].includes(rawStatus) ? rawStatus : "履约中";
  const paymentRecords = (Array.isArray(item.paymentRecords) ? item.paymentRecords : []).map((record, recordIndex) => ({
    id: String(record.id || `${item.id || `plan-${index + 1}`}-record-${recordIndex + 1}`).trim(),
    receiptNo: String(record.receiptNo || `RCPT-${String(record.id || `${item.id || `plan-${index + 1}`}-${recordIndex + 1}`).replace(/[^A-Za-z0-9]/g, "").slice(-10) || Date.now()}`).trim(),
    amount: normalizeExpenseAmount(record.amount),
    paidAt: String(record.paidAt || record.paymentDate || "").trim(),
    collectorName: String(record.collectorName || "").trim(),
    note: String(record.note || "").trim()
  })).sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime());
  const latestPayment = paymentRecords[0] || null;
  return {
    id: String(item.id || `plan-${index + 1}`).trim(),
    name: String(item.name || `分期计划 ${index + 1}`).trim(),
    cycleLabel: String(item.cycleLabel || `${totalWeeks} 周计划`).trim(),
    completedWeeks,
    totalWeeks,
    progress,
    totalAmount: normalizeExpenseAmount(item.totalAmount),
    status,
    paymentAmount: normalizeExpenseAmount(item.paymentAmount || latestPayment?.amount || 0),
    paymentDate: String(item.paymentDate || latestPayment?.paidAt || "").trim(),
    collectorName: String(item.collectorName || latestPayment?.collectorName || "").trim(),
    paymentRecords
  };
}

function normalizeExpenseCommission(item = {}, index = 0) {
  const amount = normalizeExpenseAmount(item.amount);
  const releaseRate = Math.max(0, Math.min(100, clampNumber(item.releaseRate, 0)));
  const releasedAmount = normalizeExpenseAmount(item.releasedAmount || Math.round(amount * (releaseRate / 100)));
  const lockedAmount = normalizeExpenseAmount(item.lockedAmount || Math.max(0, amount - releasedAmount));
  return {
    id: String(item.id || `com-${String(index + 1).padStart(3, "0")}`).trim(),
    name: String(item.name || `佣金人员 ${index + 1}`).trim(),
    role: String(item.role || "员工").trim(),
    type: String(item.type || "staff").trim(),
    amount,
    releaseRate,
    releasedAmount,
    lockedAmount,
    releaseStatus: String(item.releaseStatus || "锁定中").trim()
  };
}

function normalizeExpenseTransaction(item = {}, index = 0) {
  return {
    id: String(item.id || `TRX-${String(9212 - index).padStart(6, "0")}`).trim(),
    type: String(item.type || "收支流水").trim(),
    customer: String(item.customer || "未命名对象").trim(),
    amount: Math.round(clampNumber(item.amount, 0)),
    status: String(item.status || "待核销").trim()
  };
}

function normalizeExpenseSimpleItem(item = {}, index = 0, prefix = "EXP", nameKey = "name") {
  return {
    id: String(item.id || `${prefix}-${String(index + 1).padStart(3, "0")}`).trim(),
    [nameKey]: String(item[nameKey] || `${prefix}-${index + 1}`).trim(),
    amount: normalizeExpenseAmount(item.amount),
    status: String(item.status || "待处理").trim(),
    note: String(item.note || "").trim(),
    category: String(item.category || "").trim(),
    period: String(item.period || "").trim(),
    customer: String(item.customer || "").trim(),
    issuedAt: String(item.issuedAt || new Date().toISOString()).trim(),
    month: String(item.month || "").trim(),
    location: String(item.location || "").trim(),
    attachmentUrl: String(item.attachmentUrl || "").trim(),
    attachmentName: String(item.attachmentName || "").trim(),
    attachmentUploadedAt: String(item.attachmentUploadedAt || "").trim()
  };
}

function getExpenseControlData() {
  const raw = readJson(EXPENSE_CONTROL_FILE, defaultExpenseControlData());
  const paymentQueue = normalizeExpenseControlCollection(raw.paymentQueue, normalizeExpensePaymentQueue);
  const installmentPlans = normalizeExpenseControlCollection(raw.installmentPlans, normalizeExpenseInstallment);
  const commissionPool = normalizeExpenseControlCollection(raw.commissionPool, normalizeExpenseCommission);
  const transactionLogs = normalizeExpenseControlCollection(raw.transactionLogs, normalizeExpenseTransaction)
    .sort((a, b) => String(b.id).localeCompare(String(a.id)));
  const livingCosts = normalizeExpenseControlCollection(raw.livingCosts, (item, index) => normalizeExpenseSimpleItem(item, index, "LIFE"));
  const taxes = normalizeExpenseControlCollection(raw.taxes, (item, index) => normalizeExpenseSimpleItem(item, index, "TAX"));
  const invoices = normalizeExpenseControlCollection(raw.invoices, (item, index) => normalizeExpenseSimpleItem(item, index, "INV"));
  const rentLedger = normalizeExpenseControlCollection(raw.rentLedger, (item, index) => normalizeExpenseSimpleItem(item, index, "RENT", "location"));

  return {
    summary: {
      pendingPayments: paymentQueue.filter((item) => item.status !== "已核销").length,
      totalCommissionPool: commissionPool.reduce((sum, item) => sum + item.amount, 0),
      recentTransactions: transactionLogs.length,
      livingCostTotal: livingCosts.reduce((sum, item) => sum + item.amount, 0),
      taxTotal: taxes.reduce((sum, item) => sum + item.amount, 0),
      invoiceTotal: invoices.reduce((sum, item) => sum + item.amount, 0),
      rentTotal: rentLedger.reduce((sum, item) => sum + item.amount, 0)
    },
    paymentQueue,
    installmentPlans,
    commissionPool,
    transactionLogs,
    livingCosts,
    taxes,
    invoices,
    rentLedger
  };
}

async function getExpenseControlDataAsync() {
  if (expenseStore.isEnabled()) {
    await ensureExpenseStoreReady();
    const raw = await expenseStore.getAll();
    if (raw) {
      const paymentQueue = normalizeExpenseControlCollection(raw.paymentQueue, normalizeExpensePaymentQueue);
      const installmentPlans = normalizeExpenseControlCollection(raw.installmentPlans, normalizeExpenseInstallment);
      const commissionPool = normalizeExpenseControlCollection(raw.commissionPool, normalizeExpenseCommission);
      const transactionLogs = normalizeExpenseControlCollection(raw.transactionLogs, normalizeExpenseTransaction)
        .sort((a, b) => String(b.id).localeCompare(String(a.id)));
      const livingCosts = normalizeExpenseControlCollection(raw.livingCosts, (item, index) => normalizeExpenseSimpleItem(item, index, "LIFE"));
      const taxes = normalizeExpenseControlCollection(raw.taxes, (item, index) => normalizeExpenseSimpleItem(item, index, "TAX"));
      const invoices = normalizeExpenseControlCollection(raw.invoices, (item, index) => normalizeExpenseSimpleItem(item, index, "INV"));
      const rentLedger = normalizeExpenseControlCollection(raw.rentLedger, (item, index) => normalizeExpenseSimpleItem(item, index, "RENT", "location"));
      return {
        summary: {
          pendingPayments: paymentQueue.filter((item) => item.status !== "已核销").length,
          totalCommissionPool: commissionPool.reduce((sum, item) => sum + item.amount, 0),
          recentTransactions: transactionLogs.length,
          livingCostTotal: livingCosts.reduce((sum, item) => sum + item.amount, 0),
          taxTotal: taxes.reduce((sum, item) => sum + item.amount, 0),
          invoiceTotal: invoices.reduce((sum, item) => sum + item.amount, 0),
          rentTotal: rentLedger.reduce((sum, item) => sum + item.amount, 0)
        },
        paymentQueue,
        installmentPlans,
        commissionPool,
        transactionLogs,
        livingCosts,
        taxes,
        invoices,
        rentLedger
      };
    }
  }
  return getExpenseControlData();
}

function saveExpenseControlData(data) {
  const payload = {
    paymentQueue: normalizeExpenseControlCollection(data.paymentQueue, normalizeExpensePaymentQueue),
    installmentPlans: normalizeExpenseControlCollection(data.installmentPlans, normalizeExpenseInstallment),
    commissionPool: normalizeExpenseControlCollection(data.commissionPool, normalizeExpenseCommission),
    transactionLogs: normalizeExpenseControlCollection(data.transactionLogs, normalizeExpenseTransaction),
    livingCosts: normalizeExpenseControlCollection(data.livingCosts, (item, index) => normalizeExpenseSimpleItem(item, index, "LIFE")),
    taxes: normalizeExpenseControlCollection(data.taxes, (item, index) => normalizeExpenseSimpleItem(item, index, "TAX")),
    invoices: normalizeExpenseControlCollection(data.invoices, (item, index) => normalizeExpenseSimpleItem(item, index, "INV")),
    rentLedger: normalizeExpenseControlCollection(data.rentLedger, (item, index) => normalizeExpenseSimpleItem(item, index, "RENT", "location"))
  };
  writeJson(EXPENSE_CONTROL_FILE, payload);
  if (expenseStore.isEnabled()) {
    expenseStore.replaceAll(payload).catch((error) => {
      console.error("[expense-control] Failed to persist expense store:", error);
    });
  }
  return getExpenseControlData();
}

function appendExpenseTransactionEntry(data, entry = {}) {
  const nextData = {
    ...data,
    transactionLogs: [
      {
        id: String(entry.id || `TRX-${Date.now()}`).trim(),
        type: String(entry.type || "系统更新").trim(),
        customer: String(entry.customer || "系统").trim(),
        amount: Math.round(clampNumber(entry.amount, 0)),
        status: String(entry.status || "已记录").trim()
      },
      ...(Array.isArray(data.transactionLogs) ? data.transactionLogs : [])
    ]
  };
  return saveExpenseControlData(nextData);
}

function saveExpenseAttachment(section, id, filename, dataUrl) {
  const targetMap = {
    paymentQueue: "paymentQueue",
    livingCosts: "livingCosts",
    taxes: "taxes",
    invoices: "invoices",
    rentLedger: "rentLedger"
  };
  const targetKey = targetMap[String(section || "").trim()];
  if (!targetKey) return { error: "Invalid expense section" };

  const uploadedUrl = saveDataUrlImage(dataUrl, `expense-${targetKey}`);
  if (!uploadedUrl) return { error: "Invalid image data" };

  const data = getExpenseControlData();
  const items = Array.isArray(data[targetKey]) ? data[targetKey] : [];
  let matched = false;
  const updatedItems = items.map((item) => {
    if (item.id !== String(id || "").trim()) return item;
    matched = true;
    return {
      ...item,
      attachmentUrl: uploadedUrl,
      attachmentName: String(filename || path.basename(uploadedUrl)).trim(),
      attachmentUploadedAt: new Date().toISOString()
    };
  });

  if (!matched) return { error: "Expense item not found" };

  const saved = saveExpenseControlData({ ...data, [targetKey]: updatedItems });
  return saved;
}

function normalizeRbacAccess(item = {}, index = 0) {
  const employee = findEmployeeById(item.employeeId);
  const roleOverride = ["engineer", "sales", "sales_manager", "admin"].includes(String(item.roleOverride || "").trim())
    ? String(item.roleOverride).trim()
    : (employee?.role || "engineer");
  const securityLevel = Math.max(1, Math.min(3, Math.round(clampNumber(item.securityLevel, 1))));
  return {
    id: String(item.id || `rbac-access-${index + 1}`).trim(),
    employeeId: String(item.employeeId || "").trim(),
    roleOverride,
    branchScope: String(item.branchScope || employee?.branch || "未分配").trim(),
    accessEnabled: item.accessEnabled !== false,
    securityLevel
  };
}

function normalizeRbacModule(item = {}, index = 0) {
  return {
    key: String(item.key || `module-${index + 1}`).trim(),
    label: String(item.label || `模块 ${index + 1}`).trim(),
    enabled: item.enabled !== false,
    group: String(item.group || "general").trim()
  };
}

function normalizeRbacIp(item = {}, index = 0) {
  return {
    id: String(item.id || `ip-${index + 1}`).trim(),
    label: String(item.label || `IP 白名单 ${index + 1}`).trim(),
    cidr: String(item.cidr || "").trim(),
    status: item.status === "draft" ? "draft" : "active"
  };
}

function normalizeAuditLog(item = {}, index = 0) {
  return {
    id: String(item.id || `audit-${index + 1}`).trim(),
    action: String(item.action || "").trim(),
    actor: String(item.actor || "系统").trim(),
    createdAt: String(item.createdAt || new Date().toISOString()).trim()
  };
}

function getSecurityData() {
  const raw = configStore.isEnabled() ? configStore.getRbac() : readJson(RBAC_FILE, defaultRbacData());
  const employees = getEmployeesData().items;
  const employeeAccess = (Array.isArray(raw.employeeAccess) ? raw.employeeAccess : defaultRbacData().employeeAccess)
    .map(normalizeRbacAccess)
    .filter((item) => item.employeeId)
    .map((item) => {
      const employee = employees.find((entry) => entry.id === item.employeeId);
      return {
        ...item,
        employee: employee ? {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          branch: employee.branch,
          status: employee.status,
          statusLabel: employee.statusLabel,
          role: employee.role,
          roleLabel: employee.roleLabel
        } : null
      };
    })
    .filter((item) => item.employee);

  const moduleMatrix = (Array.isArray(raw.moduleMatrix) ? raw.moduleMatrix : defaultRbacData().moduleMatrix).map(normalizeRbacModule);
  const ipWhitelist = (Array.isArray(raw.ipWhitelist) ? raw.ipWhitelist : defaultRbacData().ipWhitelist).map(normalizeRbacIp);
  const auditLogs = (Array.isArray(raw.auditLogs) ? raw.auditLogs : defaultRbacData().auditLogs)
    .map(normalizeAuditLog)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    employeeAccess,
    moduleMatrix,
    ipWhitelist,
    emergencyLocked: Boolean(raw.emergencyLocked),
    auditLogs
  };
}

function getAccessProfile(userId) {
  const employee = getEmployeesData().items.find((item) => item.id === String(userId || "").trim()) || null;
  if (!employee) return null;
  const security = getSecurityData();
  const access = security.employeeAccess.find((item) => item.employeeId === employee.id) || null;
  const role = access?.roleOverride || employee.role || "sales";
  const accessEnabled = security.emergencyLocked ? role === "admin" : access?.accessEnabled !== false;
  return {
    employee,
    access,
    role,
    accessEnabled,
    securityLevel: Number(access?.securityLevel || 1),
    security
  };
}

function getRoleLandingPage(role) {
  switch (String(role || "").trim()) {
    case "admin":
    case "sales_manager":
      return "/dashboard.html";
    case "engineer":
      return "/field-app.html";
    case "sales":
    default:
      return "/mobile-app.html";
  }
}

function getRoleAllowedPages(role) {
  const salesPages = [
    "/dashboard.html",
    "/index.html",
    "/customer.html",
    "/invoices.html",
    "/repair-list.html",
    "/repair.html",
    "/field-app.html",
    "/mobile-app.html",
    "/mobile-quote.html",
    "/mobile-saved-quotes.html",
    "/mobile-quote-detail.html",
    "/mobile-customer-detail.html",
    "/mobile-invoices.html",
    "/mobile-repair.html",
    "/mobile-attendance.html",
    "/mobile-attendance-detail.html",
    "/mobile-payroll.html"
  ];
  const managerExtras = [
    "/performance.html",
    "/reports.html",
    "/field-admin.html",
    "/finance.html",
    "/commission.html"
  ];
  const engineerPages = [
    "/field-app.html",
    "/repair-list.html",
    "/repair.html",
    "/mobile-repair.html",
    "/mobile-app.html"
  ];
  const adminOnly = [
    "/employee.html",
    "/employee-detail.html",
    "/security.html",
    "/settings.html",
    "/vendors.html",
    "/inventory.html",
    "/product-config.html",
    "/expense-control.html",
    "/installment.html",
    "/wholesale.html",
    "/survey.html",
    "/finance.html",
    "/commission.html",
    "/field-admin.html",
    "/reports.html",
    "/performance.html"
  ];
  if (role === "admin") {
    return null;
  }
  if (role === "sales_manager") {
    return new Set([...salesPages, ...managerExtras]);
  }
  if (role === "engineer") {
    return new Set(engineerPages);
  }
  return new Set(salesPages);
}

function isPageAllowedForRole(role, pathname) {
  const allowed = getRoleAllowedPages(role);
  if (!allowed) return true;
  return allowed.has(pathname);
}

function isApiAllowedForRole(role, pathname) {
  if (role === "admin") return true;
  const adminOnlyPrefixes = [
    "/api/security",
    "/api/system-settings",
    "/api/settings",
    "/api/backups",
    "/api/company-profile",
    "/api/product-config/package",
    "/api/vendors",
    "/api/inventory",
    "/api/product-config",
    "/api/expense-control",
    "/api/installments",
    "/api/commission",
    "/api/employees"
  ];
  if (adminOnlyPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return role === "sales_manager" && (pathname.startsWith("/api/employees") || pathname.startsWith("/api/commission")) ? true : false;
  }
  if (role === "engineer") {
    const engineerPrefixes = [
      "/api/repair-order",
      "/api/repair-orders",
      "/api/field-",
      "/api/attendance-overview",
      "/api/field-payroll"
    ];
    return engineerPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
  }
  return true;
}

function isProtectedHtmlPath(pathname) {
  if (!String(pathname || "").toLowerCase().endsWith(".html")) return false;
  return pathname !== "/login.html";
}

function nameMatchesEmployee(value, employee) {
  const itemName = String(value || "").trim().toLowerCase();
  const employeeName = String(employee?.name || "").trim().toLowerCase();
  return Boolean(itemName && employeeName && itemName === employeeName);
}

function branchMatchesEmployee(value, employee) {
  const itemBranch = String(value || "").trim().toLowerCase();
  const employeeBranch = String(employee?.branch || "").trim().toLowerCase();
  return Boolean(itemBranch && employeeBranch && itemBranch === employeeBranch);
}

function isSelfOrBranch(role, itemEmployeeId, itemEmployeeName, itemBranch, employee) {
  if (!employee) return false;
  if (role === "admin") return true;
  if (role === "sales_manager") {
    return branchMatchesEmployee(itemBranch, employee)
      || String(itemEmployeeId || "").trim() === employee.id
      || nameMatchesEmployee(itemEmployeeName, employee);
  }
  return String(itemEmployeeId || "").trim() === employee.id || nameMatchesEmployee(itemEmployeeName, employee);
}

function canAccessCustomer(profile, customer) {
  if (!profile || !customer) return false;
  const role = profile.role;
  if (role === "admin") return true;
  if (role === "engineer") return true;
  return isSelfOrBranch(
    role,
    customer.salesPersonId,
    customer.salesPersonName,
    customer.branch || customer.location || customer.province,
    profile.employee
  );
}

function canAccessSavedQuote(profile, quote) {
  if (!profile || !quote) return false;
  const role = profile.role;
  if (role === "admin") return true;
  if (role === "engineer") return false;
  return isSelfOrBranch(
    role,
    quote.salesPersonId || quote.payload?.salesPerson?.id,
    quote.salesPersonName || quote.payload?.salesPersonName || quote.payload?.salesPerson?.name,
    quote.branch || quote.payload?.branch || quote.location,
    profile.employee
  );
}

function canAccessInvoice(profile, invoice) {
  if (!profile || !invoice) return false;
  const role = profile.role;
  if (role === "admin") return true;
  if (role === "engineer") return false;
  return isSelfOrBranch(
    role,
    invoice.salesPersonId || invoice.payload?.salesPerson?.id,
    invoice.salesPersonName || invoice.payload?.salesPersonName || invoice.payload?.salesPerson?.name,
    invoice.branch || invoice.payload?.branch || invoice.payload?.location,
    profile.employee
  );
}

function canAccessRepairOrder(profile, order) {
  if (!profile || !order) return false;
  if (profile.role === "admin" || profile.role === "sales_manager") return true;
  if (profile.role === "engineer") {
    return String(order.assignedEngineer?.id || "").trim() === profile.employee.id
      || nameMatchesEmployee(order.assignedEngineer?.name, profile.employee);
  }
  const customer = order.customer || {};
  const customerRecord = getCustomersData().items.find((item) => {
    const samePhone = customer.phone && item.phone && String(item.phone).trim() === String(customer.phone).trim();
    const sameName = customer.name && item.name && String(item.name).trim().toLowerCase() === String(customer.name).trim().toLowerCase();
    return samePhone || sameName;
  });
  return canAccessCustomer(profile, customerRecord);
}

function filterCustomersForProfile(profile, items) {
  if (!profile || profile.role === "admin" || profile.role === "engineer") return items;
  return (Array.isArray(items) ? items : []).filter((item) => canAccessCustomer(profile, item));
}

function filterSavedQuotesForProfile(profile, items) {
  if (!profile || profile.role === "admin") return items;
  return (Array.isArray(items) ? items : []).filter((item) => canAccessSavedQuote(profile, item));
}

function filterInvoicesForProfile(profile, items) {
  if (!profile || profile.role === "admin") return items;
  return (Array.isArray(items) ? items : []).filter((item) => canAccessInvoice(profile, item));
}

function filterRepairOrdersForProfile(profile, items) {
  if (!profile || profile.role === "admin") return items;
  return (Array.isArray(items) ? items : []).filter((item) => canAccessRepairOrder(profile, item));
}

function ensureAuthedProfile(req, res) {
  const session = getLoginSession(req);
  if (!session) {
    sendJson(res, 401, { ok: false, error: "请先登录" });
    return null;
  }
  return session.profile;
}

function saveSecurityData(data) {
  const payload = {
    employeeAccess: (Array.isArray(data.employeeAccess) ? data.employeeAccess : []).map(normalizeRbacAccess),
    moduleMatrix: (Array.isArray(data.moduleMatrix) ? data.moduleMatrix : []).map(normalizeRbacModule),
    ipWhitelist: (Array.isArray(data.ipWhitelist) ? data.ipWhitelist : []).map(normalizeRbacIp),
    emergencyLocked: Boolean(data.emergencyLocked),
    auditLogs: (Array.isArray(data.auditLogs) ? data.auditLogs : []).map(normalizeAuditLog)
  };
  writeJson(RBAC_FILE, payload);
  if (configStore.isEnabled()) {
    configStore.saveRbac(payload).catch((error) => {
      console.error("[rbac] Failed to persist config store:", error);
    });
  }
  return getSecurityData();
}

function getEmployeeDetail(id) {
  const employees = getEmployeesData();
  const employee = employees.items.find((item) => item.id === String(id || "").trim());
  if (!employee) return null;

  const repairOrders = getRepairOrders().filter((item) => {
    const engineerName = String(item.assignedEngineer?.name || "").trim().toLowerCase();
    return Boolean(engineerName) && engineerName === employee.name.trim().toLowerCase();
  });

  const quoteItems = readJson(SAVES_FILE, []).filter((item) => {
    const payloadSales = String(item.payload?.salesPerson?.name || item.payload?.salesName || item.salesPersonName || item.salesName || "").trim().toLowerCase();
    const savedSales = String(item.salesPersonName || item.salesName || "").trim().toLowerCase();
    const branchMatch = String(item.branch || item.payload?.branch || "").trim().toLowerCase();
    const employeeName = employee.name.trim().toLowerCase();
    return payloadSales === employeeName || savedSales === employeeName || (employee.role !== "engineer" && branchMatch && branchMatch === employee.branch.trim().toLowerCase());
  });

  const repairSummary = {
    total: repairOrders.length,
    pending: repairOrders.filter((item) => item.status === "pending").length,
    inProgress: repairOrders.filter((item) => item.status === "in_progress").length,
    completed: repairOrders.filter((item) => item.status === "completed").length
  };

  const quoteSummary = {
    total: quoteItems.length,
    draft: quoteItems.filter((item) => item.status === "draft" || !item.status).length,
    sent: quoteItems.filter((item) => item.status === "sent").length,
    paid: quoteItems.filter((item) => item.status === "paid").length,
    totalAmount: quoteItems.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.total, 0))), 0)
  };

  const payrollSummary = buildEmployeePayroll(employee, quoteItems, repairOrders);

  return {
    employee,
    payrollSummary,
    related: {
      repairOrders: repairOrders.slice(0, 10).map((item) => ({
        id: item.id,
        title: item.title,
        status: item.status,
        statusLabel: item.statusLabel,
        priorityLabel: item.priorityLabel,
        etaLabel: item.etaLabel
      })),
      quoteItems: quoteItems.slice(-10).reverse().map((item) => ({
        id: item.id,
        customerName: item.customer?.name || item.customerName || item.payload?.customer?.name || "-",
        packageName: item.packageName || item.payload?.recommendation?.packageName || "-",
        status: item.status || "draft",
        total: Math.max(0, Math.round(clampNumber(item.total, 0))),
        createdAt: item.createdAt || ""
      })),
      repairSummary,
      quoteSummary
    }
  };
}

function applyRepairSparePartDeduction(order) {
  const repairOrder = normalizeRepairOrder(order);
  const parts = Array.isArray(repairOrder.spareParts) ? repairOrder.spareParts.filter((item) => item.quantity > 0) : [];
  if (!parts.length) return getInventoryData();

  const current = readJson(INVENTORY_FILE, defaultInventoryData());
  const stockItems = (Array.isArray(current.stockItems) ? current.stockItems : []).map(normalizeInventoryItem);
  const transactions = Array.isArray(current.transactions) ? current.transactions : [];

  parts.forEach((part) => {
    const index = stockItems.findIndex((item) => item.id === part.id || item.sku === part.sku);
    if (index < 0) return;
    const quantity = Math.max(0, Math.round(clampNumber(part.quantity, 0)));
    if (!quantity) return;
    stockItems[index].quantity = Math.max(0, stockItems[index].quantity - quantity);
    stockItems[index].status = stockItems[index].quantity <= stockItems[index].threshold ? "low" : "healthy";
    transactions.unshift({
      id: `TR-${Date.now()}-${part.id}`,
      itemId: stockItems[index].id,
      itemName: stockItems[index].name,
      sku: stockItems[index].sku,
      type: "outbound",
      typeLabel: `Outbound - Repair Order ${repairOrder.id}`,
      quantityChange: -quantity,
      quantityText: `-${quantity}`,
      operator: repairOrder.assignedEngineer?.name || "Repair Dispatch",
      timestamp: new Date().toISOString()
    });
  });

  return saveInventoryData({
    shipment: current.shipment || defaultInventoryData().shipment,
    stockItems,
    transactions
  });
}

function normalizeRepairOrder(order = {}) {
  const base = defaultRepairOrder();
  const status = ["pending", "in_progress", "completed"].includes(order.status) ? order.status : base.status;
  return {
    ...base,
    ...order,
    id: String(order.id || base.id).trim(),
    title: String(order.title || base.title).trim(),
    priority: String(order.priority || base.priority).trim() || "P1",
    priorityLabel: String(order.priorityLabel || base.priorityLabel).trim(),
    etaLabel: String(order.etaLabel || base.etaLabel).trim(),
    description: String(order.description || base.description).trim(),
    technicianFeedback: String(order.technicianFeedback || base.technicianFeedback).trim(),
    customer: {
      name: String(order.customer?.name || base.customer?.name || "").trim(),
      phone: String(order.customer?.phone || base.customer?.phone || "").trim(),
      email: String(order.customer?.email || base.customer?.email || "").trim(),
      address: String(order.customer?.address || base.customer?.address || "").trim()
    },
    assignedEngineer: {
      id: String(order.assignedEngineer?.id || base.assignedEngineer?.id || "").trim(),
      name: String(order.assignedEngineer?.name || base.assignedEngineer?.name || "").trim(),
      role: String(order.assignedEngineer?.role || base.assignedEngineer?.role || "").trim()
    },
    assetLocation: {
      name: String(order.assetLocation?.name || base.assetLocation.name).trim(),
      address: String(order.assetLocation?.address || base.assetLocation.address || "").trim(),
      coordinates: String(order.assetLocation?.coordinates || base.assetLocation.coordinates).trim(),
      latitude: Number(clampNumber(order.assetLocation?.latitude, base.assetLocation.latitude || -17.7333).toFixed(6)),
      longitude: Number(clampNumber(order.assetLocation?.longitude, base.assetLocation.longitude || 168.3271).toFixed(6))
    },
    status,
    statusLabel: String(order.statusLabel || formatRepairStatusLabel(status)).trim(),
    spareParts: (Array.isArray(order.spareParts) ? order.spareParts : base.spareParts).map((item, index) => ({
      id: item.id || `spare-${index + 1}`,
      name: String(item.name || "").trim(),
      sku: String(item.sku || "").trim(),
      quantity: Math.max(0, Math.round(clampNumber(item.quantity, 0))),
      unit: String(item.unit || "pcs").trim(),
      status: item.status === "pending" ? "pending" : "issued",
      statusLabel: String(item.statusLabel || (item.status === "pending" ? "Pending" : "Issued")).trim()
    })),
    timeline: (Array.isArray(order.timeline) ? order.timeline : base.timeline).map((item, index) => ({
      id: item.id || `timeline-${index + 1}`,
      timeLabel: String(item.timeLabel || "").trim(),
      title: String(item.title || "").trim(),
      detail: String(item.detail || "").trim(),
      type: ["current", "done", "start"].includes(item.type) ? item.type : "done"
    })),
    notes: Array.isArray(order.notes) ? order.notes.map((item, index) => ({
      id: item.id || `note-${index + 1}`,
      text: String(item.text || "").trim(),
      createdAt: String(item.createdAt || new Date().toISOString()).trim(),
      imageUrl: String(item.imageUrl || "").trim(),
      status: ["pending", "in_progress", "completed"].includes(item.status) ? item.status : ""
    })) : []
  };
}

function getRepairOrders() {
  const data = readJson(REPAIR_ORDERS_FILE, defaultRepairOrders());
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) {
    return [normalizeRepairOrder(readJson(REPAIR_FILE, defaultRepairOrder()))];
  }
  return items.map(normalizeRepairOrder);
}

function getRepairOrder(orderId = "") {
  const items = getRepairOrders();
  const requested = String(orderId || "").trim();
  return items.find((item) => item.id === requested) || items[0] || normalizeRepairOrder(defaultRepairOrder());
}

function saveRepairOrders(items) {
  const normalizedItems = (Array.isArray(items) ? items : []).map(normalizeRepairOrder);
  writeJson(REPAIR_ORDERS_FILE, { items: normalizedItems });
  if (normalizedItems[0]) {
    writeJson(REPAIR_FILE, normalizedItems[0]);
  }
  if (operationsStore.isEnabled()) {
    operationsStore.replaceRepairOrders(normalizedItems).catch((error) => {
      console.error("[repair] Failed to persist operations store:", error);
    });
  }
  return getRepairOrders();
}

function saveRepairOrder(order) {
  const nextOrder = normalizeRepairOrder(order);
  const items = getRepairOrders();
  const index = items.findIndex((item) => item.id === nextOrder.id);
  if (index >= 0) {
    items[index] = nextOrder;
  } else {
    items.unshift(nextOrder);
  }
  saveRepairOrders(items);
  return getRepairOrder(nextOrder.id);
}

function createRepairOrder(body = {}) {
  const timestamp = Date.now();
  const id = String(body.id || `RE-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(timestamp).slice(-3)}`).trim();
  const title = String(body.title || "").trim() || "New Repair Order";
  const priority = ["P1", "P2", "P3"].includes(String(body.priority || "").trim().toUpperCase()) ? String(body.priority).trim().toUpperCase() : "P2";
  const priorityLabelMap = {
    P1: "Urgent (P1)",
    P2: "Normal (P2)",
    P3: "Low (P3)"
  };
  const now = new Date();
  const etaDate = String(body.etaDate || "").trim();
  const etaTime = String(body.etaTime || "").trim();
  const etaLabel = [etaDate, etaTime].filter(Boolean).join(" ") || "Pending schedule";
  const selectedEngineer = findEmployeeById(body.assignedEngineerId);
  const assignedEngineer = selectedEngineer
    ? {
        id: selectedEngineer.id,
        name: selectedEngineer.name,
        role: selectedEngineer.roleLabel || getEmployeeRoleLabel(selectedEngineer.role)
      }
    : { id: "", name: "", role: "" };
  const latitude = Number(clampNumber(body.latitude, -17.7333).toFixed(6));
  const longitude = Number(clampNumber(body.longitude, 168.3271).toFixed(6));
  const coordinates = String(body.coordinates || "").trim() || `${Math.abs(latitude).toFixed(4)}° ${latitude < 0 ? "S" : "N"}, ${Math.abs(longitude).toFixed(4)}° ${longitude < 0 ? "W" : "E"}`;
  const spareParts = Array.isArray(body.spareParts) ? body.spareParts.map((item, index) => ({
    id: String(item.id || `spare-${index + 1}`).trim(),
    name: String(item.name || "").trim(),
    sku: String(item.sku || "").trim(),
    quantity: Math.max(0, Math.round(clampNumber(item.quantity, 0))),
    status: "pending",
    statusLabel: "Pending",
    unit: String(item.unit || "pcs").trim()
  })).filter((item) => item.name && item.quantity > 0) : [];
  return normalizeRepairOrder({
    id,
    title,
    status: "pending",
    statusLabel: formatRepairStatusLabel("pending"),
    priority,
    priorityLabel: priorityLabelMap[priority] || "Normal (P2)",
    etaLabel,
    description: String(body.description || "").trim() || "Waiting for engineer review.",
    customer: {
      name: String(body.customerName || "").trim(),
      phone: String(body.customerPhone || "").trim(),
      email: String(body.customerEmail || "").trim(),
      address: String(body.customerAddress || "").trim()
    },
    assignedEngineer,
    assetLocation: {
      name: String(body.assetName || "").trim() || "New Site",
      address: String(body.assetAddress || body.customerAddress || "").trim(),
      coordinates,
      latitude,
      longitude
    },
    technicianFeedback: String(body.initialNote || "").trim() || "New repair order submitted and waiting for assignment.",
    notes: String(body.initialNote || "").trim() ? [{
      id: `note-${timestamp}`,
      text: String(body.initialNote || "").trim(),
      createdAt: now.toISOString(),
      imageUrl: "",
      status: "pending"
    }] : [],
    spareParts,
    timeline: [
      {
        id: `timeline-${timestamp}`,
        timeLabel: now.toLocaleString("en-US"),
        title: "Repair order created",
        detail: assignedEngineer.name ? `Assigned engineer: ${assignedEngineer.name}` : "Waiting for dispatch and engineer assignment",
        type: "current"
      }
    ]
  });
}

function normalizeSurveyBooking(item = {}, index = 0) {
  const status = String(item.status || "review").trim();
  return {
    id: String(item.id || `SV-${Date.now()}-${index + 1}`).trim(),
    island: String(item.island || "Efate").trim(),
    preferredDate: String(item.preferredDate || "").trim(),
    preferredTime: String(item.preferredTime || "").trim(),
    latitude: Number(clampNumber(item.latitude, -17.7333).toFixed(6)),
    longitude: Number(clampNumber(item.longitude, 168.3167).toFixed(6)),
    status: ["review", "confirmed", "scheduled", "completed", "rejected"].includes(status) ? status : "review",
    sitePhotos: Array.isArray(item.sitePhotos) ? item.sitePhotos.map((photo) => String(photo || "").trim()).filter(Boolean) : [],
    customer: {
      name: String(item.customer?.name || "").trim(),
      phone: String(item.customer?.phone || "").trim(),
      address: String(item.customer?.address || "").trim()
    },
    reviewChecklist: {
      photosOk: Boolean(item.reviewChecklist?.photosOk),
      gpsOk: Boolean(item.reviewChecklist?.gpsOk),
      contactOk: Boolean(item.reviewChecklist?.contactOk)
    },
    reviewNotes: String(item.reviewNotes || "").trim(),
    reviewedBy: String(item.reviewedBy || "").trim(),
    reviewedAt: String(item.reviewedAt || "").trim(),
    scheduleTask: item.scheduleTask && typeof item.scheduleTask === "object" ? {
      id: String(item.scheduleTask.id || `SCH-${String(item.id || `SV-${Date.now()}-${index + 1}`)}`).trim(),
      status: ["pending", "scheduled", "on_hold", "completed"].includes(item.scheduleTask.status) ? item.scheduleTask.status : "pending",
      notes: String(item.scheduleTask.notes || "").trim(),
      engineerId: String(item.scheduleTask.engineerId || "").trim(),
      engineerName: String(item.scheduleTask.engineerName || "").trim(),
      visitDate: String(item.scheduleTask.visitDate || item.preferredDate || "").trim(),
      visitTime: String(item.scheduleTask.visitTime || item.preferredTime || "").trim(),
      createdAt: String(item.scheduleTask.createdAt || new Date().toISOString()).trim(),
      updatedAt: String(item.scheduleTask.updatedAt || item.scheduleTask.createdAt || new Date().toISOString()).trim()
    } : null,
    createdAt: String(item.createdAt || new Date().toISOString()).trim()
  };
}

function buildScheduleQueue(bookings = []) {
  return bookings
    .filter((item) => item.scheduleTask)
    .map((item) => ({
      bookingId: item.id,
      customerName: item.customer?.name || "",
      island: item.island,
        preferredDate: item.preferredDate,
        preferredTime: item.preferredTime,
        status: item.scheduleTask.status,
        notes: item.scheduleTask.notes,
        engineerId: item.scheduleTask.engineerId,
        engineerName: item.scheduleTask.engineerName,
        visitDate: item.scheduleTask.visitDate,
        visitTime: item.scheduleTask.visitTime,
        taskId: item.scheduleTask.id,
        updatedAt: item.scheduleTask.updatedAt
      }))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function getSurveyData() {
  const data = readJson(SURVEY_FILE, defaultSurveyData());
  const bookings = (Array.isArray(data.bookings) ? data.bookings : []).map(normalizeSurveyBooking);
  return {
    bookings,
    scheduleQueue: buildScheduleQueue(bookings)
  };
}

function saveSurveyData(data) {
  const bookings = (Array.isArray(data.bookings) ? data.bookings : []).map(normalizeSurveyBooking);
  writeJson(SURVEY_FILE, {
    bookings
  });
  if (operationsStore.isEnabled()) {
    operationsStore.replaceSurveyBookings(bookings).catch((error) => {
      console.error("[survey] Failed to persist operations store:", error);
    });
  }
  return getSurveyData();
}

function createRepairTimelineEntry(status) {
  const timeLabel = new Date().toLocaleString("en-US");
  if (status === "completed") {
    return {
      id: `timeline-${Date.now()}`,
      timeLabel,
      title: "Repair completed with engineer confirmation",
      detail: "Completion proof uploaded from field device",
      type: "current"
    };
  }
  if (status === "pending") {
    return {
      id: `timeline-${Date.now()}`,
      timeLabel,
      title: "Work order returned to pending status",
      detail: "Engineer updated progress for follow-up action",
      type: "current"
    };
  }
  return {
    id: `timeline-${Date.now()}`,
    timeLabel,
    title: "Repair resumed on site",
    detail: "Engineer is actively servicing the equipment",
    type: "current"
  };
}

function refreshRepairTimeline(timeline = [], nextEntry) {
  return [nextEntry, ...(Array.isArray(timeline) ? timeline : []).map((item) => ({
    ...item,
    type: item.type === "start" ? "start" : "done"
  }))];
}

function buildPackages(dailyWh, peakPower) {
  const { packages } = getProductConfig();
  const activePackages = packages.filter((item) => item.status === "active");
  const source = activePackages.length ? activePackages : packages;
  return source.map((pkg) => {
    const energyTargetWh = Math.max(0, Math.round(pkg.storageKwh * 900));
    const sufficientPower = pkg.loadCapacityW >= peakPower;
    const sufficientEnergy = energyTargetWh <= dailyWh || energyTargetWh === 0 || dailyWh === 0;
    const demandPenalty = Math.max(0, energyTargetWh - dailyWh) / 120;
    const inverterPenalty = Math.max(0, peakPower - pkg.loadCapacityW) / 60;
    const fitScore = Math.max(60, 98 - Math.round(demandPenalty + inverterPenalty));
    return {
      packageId: pkg.id,
      packageName: pkg.name,
      sku: pkg.sku,
      fitScore,
      solarPanels: `${pkg.panelCount} x ${pkg.panelWatts}W Mono Solar Panels`,
      battery: `${pkg.storageKwh}kWh LiFePO4 Battery Bank`,
      inverter: pkg.inverterModel,
      loadCapacityW: pkg.loadCapacityW,
      energyTargetWh,
      estimatedPrice: pkg.retailVt,
      compatible: sufficientPower && sufficientEnergy,
      stock: pkg.stock,
      status: pkg.status
    };
  });
}

function calculateSizing(devices, locationName = "Port Vila", customer = {}, selectedPackageName = "") {
  const normalizedDevices = (Array.isArray(devices) ? devices : [])
    .map((device, index) => {
      const quantity = Math.max(0, Math.round(clampNumber(device.quantity, 0)));
      const power = Math.max(0, clampNumber(device.power, 0));
      const hours = Math.max(0, clampNumber(device.hours, 0));
      return {
        id: index + 1,
        name: String(device.name || ""),
        power,
        hours,
        quantity,
        dailyWh: power * hours * quantity
      };
    })
    .filter((device) => device.name || device.power > 0 || device.hours > 0 || device.quantity > 0);

  const dailyWh = normalizedDevices.reduce((sum, item) => sum + item.dailyWh, 0);
  const peakPower = normalizedDevices.reduce((sum, item) => sum + item.power * item.quantity, 0);
  const autonomyDays = dailyWh > 5000 ? 2 : dailyWh > 2500 ? 2.5 : 3;
  const productConfig = getProductConfig();
  const packages = buildPackages(dailyWh, peakPower);
  const selected = packages.find((item) => item.packageName === selectedPackageName && item.compatible);
  const recommendation = selected || packages.find((item) => item.compatible) || packages[0];

  const logisticsFee = locationName === "Port Vila" ? 12000 : locationName === "Espiritu Santo" ? 18000 : locationName === "Tanna" ? 24000 : 26000;
  const installFee = dailyWh > 6000 ? 65000 : dailyWh > 3000 ? 45000 : 30000;
  const equipmentPrice = recommendation?.estimatedPrice || 0;
  const totalInclTax = equipmentPrice + installFee + logisticsFee;
  const vatRate = Math.max(0, Number(productConfig.vatRate ?? settings.vatRate ?? 15));
  const divisor = vatRate > 0 ? 1 + vatRate / 100 : 1;
  const subtotalExclTax = divisor > 1 ? Math.round(totalInclTax / divisor) : totalInclTax;
  const vat = Math.max(0, totalInclTax - subtotalExclTax);
  const settings = getSettings();
  const displayMode = "tax_inclusive";
  const displayTotal = totalInclTax;

  return {
    customer: normalizeCustomer(customer),
    location: locationName,
    devices: normalizedDevices,
    metrics: {
      dailyWh,
      dailyKwh: Number((dailyWh / 1000).toFixed(2)),
      peakPower,
      autonomyDays
    },
    recommendation,
    packages,
    quote: {
      equipmentPrice,
      installFee,
      logisticsFee,
      subtotalExclTax,
      vatRate,
      vat,
      totalInclTax,
      displayMode,
      displayTotal,
      currency: "VUV"
    },
    settings: {
      ...settings,
      vatRate
    },
    qrPayload: `https://smart-sizing.local/quote?customer=${encodeURIComponent(normalizeCustomer(customer).name || "guest")}&package=${encodeURIComponent(recommendation?.packageName || "")}&total=${displayTotal}`
  };
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  res.end(JSON.stringify(payload));
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function sendDownload(res, statusCode, contentType, filename, content) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename="${filename}"`
  });
  res.end(content);
}

function escapePdfText(value = "") {
  return String(value || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdfBuffer(lines = []) {
  const safeLines = (Array.isArray(lines) ? lines : []).slice(0, 40);
  const contentLines = ["BT", "/F1 12 Tf", "50 790 Td", "16 TL"];
  safeLines.forEach((line, index) => {
    const prefix = index === 0 ? "" : "T* ";
    contentLines.push(`${prefix}(${escapePdfText(line)}) Tj`);
  });
  contentLines.push("ET");
  const stream = contentLines.join("\n");
  const objects = [];
  objects.push("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj");
  objects.push("2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj");
  objects.push("3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj");
  objects.push("4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj");
  objects.push(`5 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function buildReportsExportCsv(data) {
  const sections = [];
  sections.push(["Reports Center Summary"]);
  sections.push(["Finance Total", "Pending Items", "Settlement Rate", "Inventory Turnover", "Commission Total"]);
  sections.push([
    data.summary.financeTotal,
    data.summary.pendingCount,
    `${data.summary.settlementRate}%`,
    `${data.summary.inventoryTurnover}x`,
    data.summary.commissionTotal
  ]);
  sections.push([]);
  sections.push(["Monthly Sales"]);
  sections.push(["Month", "Sales Total"]);
  (data.monthlySales || []).forEach((item) => sections.push([item.label, item.total]));
  sections.push([]);
  sections.push(["Commission Details"]);
  sections.push(["Name", "Role", "Type", "Commission"]);
  (data.commissionItems || []).forEach((item) => sections.push([item.name, item.role, item.type, item.amount]));
  sections.push([]);
  sections.push(["Export History"]);
  sections.push(["Name", "Exported At", "Format", "Status", "Action"]);
  (data.exportHistory || []).forEach((item) => sections.push([item.name, item.exportedAt, item.format, item.status, item.action]));
  return sections
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function buildReportsExportPdf(data) {
  const lines = [
    "Reports Center Summary",
    "",
    `Finance Total: ${moneyValue(data.summary.financeTotal)}`,
    `Pending Items: ${data.summary.pendingCount}`,
    `Settlement Rate: ${data.summary.settlementRate}%`,
    `Inventory Turnover: ${data.summary.inventoryTurnover}x`,
    `Commission Total: ${moneyValue(data.summary.commissionTotal)}`,
    "",
    "Monthly Sales",
    ...(data.monthlySales || []).map((item) => `${item.label}: ${moneyValue(item.total)}`),
    "",
    "Commission Details",
    ...(data.commissionItems || []).map((item) => `${item.name} / ${item.role}: ${moneyValue(item.amount)}`)
  ];
  return buildSimplePdfBuffer(lines);
}

function moneyValue(value) {
  return `VT ${Math.max(0, Number(value || 0)).toLocaleString("en-US")}`;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png"
  };

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const parseRawJson = (rawInput) => {
      const rawBody = Buffer.isBuffer(rawInput)
        ? rawInput.toString("utf8").trim()
        : String(rawInput || "").trim();
      if (!rawBody) return {};
      return JSON.parse(rawBody);
    };

    if (req.body != null) {
      try {
        if (Buffer.isBuffer(req.body) || req.body instanceof Uint8Array) {
          resolve(parseRawJson(Buffer.from(req.body)));
          return;
        }
        if (typeof req.body === "string") {
          resolve(parseRawJson(req.body));
          return;
        }
        if (typeof req.body === "object") {
          resolve(req.body);
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }
    }

    const chunks = [];
    req.on("data", (chunk) => {
      if (Buffer.isBuffer(chunk) || chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
        return;
      }
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk, "utf8"));
        return;
      }
      if (chunk && typeof chunk === "object") {
        chunks.push(Buffer.from(JSON.stringify(chunk), "utf8"));
      }
    });
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(parseRawJson(Buffer.concat(chunks)));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function issueFieldToken(userId) {
  const token = `field_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  ACTIVE_TOKENS.set(token, {
    userId,
    issuedAt: Date.now()
  });
  return token;
}

function getFieldAuth(req) {
  const header = String(req.headers.authorization || "").trim();
  if (!header.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  if (!token) return null;
  const session = ACTIVE_TOKENS.get(token);
  if (!session) return null;
  return { token, ...session };
}

function getCheckinAuth(req, userId = "") {
  const normalizedUserId = String(userId || "").trim();
  const fieldAuth = getFieldAuth(req);
  if (fieldAuth && fieldAuth.userId === normalizedUserId) {
    return { mode: "field", userId: fieldAuth.userId };
  }

  const loginSession = getLoginSession(req);
  if (loginSession?.profile?.employee?.id && String(loginSession.profile.employee.id).trim() === normalizedUserId) {
    return { mode: "login", userId: normalizedUserId };
  }

  return null;
}

function getFieldOrLoginAuth(req) {
  const fieldAuth = getFieldAuth(req);
  if (fieldAuth) return { mode: "field", userId: fieldAuth.userId };

  const loginSession = getLoginSession(req);
  if (loginSession?.profile?.employee?.id) {
    return { mode: "login", userId: String(loginSession.profile.employee.id).trim() };
  }

  return null;
}

function getFieldEmployeeById(userId) {
  return getEmployeesData().items.find((item) => item.id === String(userId || "").trim()) || null;
}

function parseCookies(req) {
  const header = String(req.headers.cookie || "").trim();
  if (!header) return {};
  return header.split(";").reduce((acc, item) => {
    const [rawKey, ...rawValue] = item.split("=");
    const key = String(rawKey || "").trim();
    if (!key) return acc;
    acc[key] = decodeURIComponent(rawValue.join("=").trim());
    return acc;
  }, {});
}

function createAuthCookieSignature(payload) {
  return crypto.createHmac("sha256", AUTH_COOKIE_SECRET).update(payload).digest("hex");
}

function createAuthCookieToken(userId) {
  const payload = JSON.stringify({
    userId: String(userId || "").trim(),
    issuedAt: Date.now()
  });
  const encodedPayload = Buffer.from(payload).toString("base64url");
  const signature = createAuthCookieSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function parseAuthCookieToken(token) {
  const rawToken = String(token || "").trim();
  if (!rawToken || !rawToken.includes(".")) return null;
  const [encodedPayload, signature] = rawToken.split(".");
  if (!encodedPayload || !signature) return null;
  const expectedSignature = createAuthCookieSignature(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    return {
      userId: String(payload.userId || "").trim(),
      issuedAt: Number(payload.issuedAt || 0)
    };
  } catch (_error) {
    return null;
  }
}

function issueLoginSession(userId) {
  const profile = getAccessProfile(userId);
  if (!profile) return null;
  const token = createAuthCookieToken(profile.employee.id);
  const session = {
    token,
    userId: profile.employee.id,
    role: profile.role,
    issuedAt: Date.now()
  };
  ACTIVE_LOGIN_SESSIONS.set(token, session);
  return session;
}

function getLoginSession(req) {
  const cookies = parseCookies(req);
  const token = String(cookies.smart_auth || "").trim();
  if (!token) return null;
  let session = ACTIVE_LOGIN_SESSIONS.get(token);
  if (!session) {
    const parsed = parseAuthCookieToken(token);
    if (!parsed?.userId) return null;
    session = {
      token,
      userId: parsed.userId,
      issuedAt: parsed.issuedAt || 0
    };
  }
  const profile = getAccessProfile(session.userId);
  if (!profile || !profile.accessEnabled) return null;
  return {
    ...session,
    profile
  };
}

function clearLoginSession(req) {
  const cookies = parseCookies(req);
  const token = String(cookies.smart_auth || "").trim();
  if (token) {
    ACTIVE_LOGIN_SESSIONS.delete(token);
  }
}

function buildAuthCookie(token = "") {
  if (!token) {
    return "smart_auth=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax";
  }
  return `smart_auth=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax`;
}

function getFieldDailyRate(employee) {
  if (!employee) return 0;
  const storedRate = Math.round(clampNumber(employee.baseDailyRate, 0));
  if (storedRate > 0) return storedRate;
  const hourlyRate = Math.round(clampNumber(employee.payroll?.hourlyRate, 0));
  const baseSalary = Math.round(clampNumber(employee.payroll?.baseSalary, 0));
  if (hourlyRate > 0) return hourlyRate * 8;
  if (baseSalary > 0) return Math.round(baseSalary / 26);
  return 0;
}

function offsetDateKey(dateKey = "", offsetDays = 0) {
  const [year, month, day] = String(dateKey || "").split("-").map((value) => Number(value));
  if (!year || !month || !day) return String(dateKey || "").trim();
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays);
  return utcDate.toISOString().slice(0, 10);
}

function listDateKeysBetween(startDate = "", endDate = "") {
  const start = String(startDate || "").trim();
  const end = String(endDate || "").trim();
  if (!start || !end || start > end) return [];
  const items = [];
  let current = start;
  while (current && current <= end) {
    items.push(current);
    const next = offsetDateKey(current, 1);
    if (next === current) break;
    current = next;
  }
  return items;
}

function resolvePayrollWindow({ dateKey = "", startDate = "", endDate = "", period = "" } = {}) {
  const anchorDate = String(dateKey || getBusinessTimeParts(new Date()).dateKey).trim();
  const requestedPeriod = String(period || "").trim() || "day";
  if (startDate || endDate) {
    const safeStart = String(startDate || anchorDate).trim();
    const safeEnd = String(endDate || anchorDate).trim();
    return {
      period: "custom",
      startDate: safeStart <= safeEnd ? safeStart : safeEnd,
      endDate: safeStart <= safeEnd ? safeEnd : safeStart
    };
  }
  if (requestedPeriod === "half_month") {
    return {
      period: requestedPeriod,
      startDate: offsetDateKey(anchorDate, -14),
      endDate: anchorDate
    };
  }
  if (requestedPeriod === "month") {
    return {
      period: requestedPeriod,
      startDate: `${anchorDate.slice(0, 8)}01`,
      endDate: anchorDate
    };
  }
  return {
    period: "day",
    startDate: anchorDate,
    endDate: anchorDate
  };
}

function buildPayrollWindowLabel(window = {}) {
  if (!window?.startDate || !window?.endDate) return "工资结算";
  if (window.startDate === window.endDate) return `${window.startDate} 日结算`;
  if (window.period === "half_month") return `${window.startDate} 至 ${window.endDate} 最近15天结算`;
  if (window.period === "month") return `${window.startDate} 至 ${window.endDate} 本月结算`;
  return `${window.startDate} 至 ${window.endDate} 区间结算`;
}

function buildFieldDailyAttendanceSummary(employee, dateKey, checkins = [], visits = [], tracks = [], options = {}) {
  const sortedCheckins = (Array.isArray(checkins) ? checkins : []).slice().sort((a, b) => new Date(a.ts) - new Date(b.ts));
  const firstCheckIn = sortedCheckins.find((item) => item.action === "in") || null;
  const lastCheckOut = [...sortedCheckins].reverse().find((item) => item.action === "out") || null;
  const startTs = firstCheckIn ? new Date(firstCheckIn.ts).getTime() : 0;
  const endTs = lastCheckOut ? new Date(lastCheckOut.ts).getTime() : 0;
  const workedMs = startTs && endTs && endTs > startTs ? endTs - startTs : 0;
  const workedHours = workedMs > 0 ? Number((workedMs / 3600000).toFixed(2)) : 0;
  const dailyRate = getFieldDailyRate(employee);
  const attendanceStatus = firstCheckIn ? (lastCheckOut ? "已完成打卡" : "在岗中") : "未出勤";
  const grossPay = firstCheckIn ? dailyRate : 0;
  const vnpfRate = Number(clampNumber(employee?.vnpfRate, 4).toFixed(2));
  const vnpfDeduction = Math.round(grossPay * (vnpfRate / 100));
  const advanceDeduction = Math.max(0, Math.round(clampNumber(options.advanceDeduction, 0)));
  const debtDeduction = Math.max(0, Math.round(clampNumber(options.debtDeduction, 0)));
  const attendancePay = Math.max(0, grossPay - vnpfDeduction - advanceDeduction - debtDeduction);
  const trackPointCount = (Array.isArray(tracks) ? tracks : []).reduce((sum, item) => sum + (Array.isArray(item.points) ? item.points.length : 0), 0);

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    role: employee.role,
    roleLabel: employee.roleLabel,
    date: dateKey,
    dailyRate,
    grossPay,
    attendancePay,
    attendanceStatus,
    vnpfRate,
    vnpfDeduction,
    advanceDeduction,
    debtDeduction,
    visitCount: Array.isArray(visits) ? visits.length : 0,
    trackPointCount,
    checkinCount: sortedCheckins.length,
    workHours: workedHours,
    workHoursLabel: workedHours > 0 ? `${workedHours} 小时` : "0 小时",
    firstCheckInLabel: firstCheckIn ? new Date(firstCheckIn.ts).toLocaleTimeString("en-US") : "-",
    lastCheckOutLabel: lastCheckOut ? new Date(lastCheckOut.ts).toLocaleTimeString("en-US") : "-"
  };
}

async function getFieldPayrollSettlement(userId, options = {}) {
  const employee = getFieldEmployeeById(userId);
  if (!employee) return null;

  const window = resolvePayrollWindow(options);
  const [allCheckins, allVisits, allTracks] = await Promise.all([
    getFieldCheckinsData({ userId: employee.id }),
    getFieldVisitsData({ userId: employee.id }),
    getFieldTracksData({ userId: employee.id })
  ]);

  const dateKeys = listDateKeysBetween(window.startDate, window.endDate);
  const advances = Array.isArray(employee.advanceRecords) ? employee.advanceRecords : [];
  const periodAdvances = advances.filter((item) => item.status !== "cancelled" && item.date >= window.startDate && item.date <= window.endDate);
  const periodAdvanceDeductions = periodAdvances.filter((item) => item.type === "repayment");
  const periodDebtDeduction = 0;

  const dailyItems = dateKeys.map((date) => {
    const dailyAdvanceDeduction = periodAdvanceDeductions
      .filter((item) => item.date === date)
      .reduce((sum, item) => sum + item.amount, 0);
    return buildFieldDailyAttendanceSummary(
      employee,
      date,
      (Array.isArray(allCheckins) ? allCheckins : []).filter((item) => item.date === date),
      (Array.isArray(allVisits) ? allVisits : []).filter((item) => getRecordDateKey(item.recordedAt) === date),
      (Array.isArray(allTracks) ? allTracks : []).filter((item) => item.date === date),
      { advanceDeduction: dailyAdvanceDeduction, debtDeduction: 0 }
    );
  });

  const workedDays = dailyItems.filter((item) => item.checkinCount > 0).length;
  const grossPay = dailyItems.reduce((sum, item) => sum + item.grossPay, 0);
  const vnpfRate = Number(clampNumber(employee.vnpfRate, 4).toFixed(2));
  const vnpfDeduction = Math.round(grossPay * (vnpfRate / 100));
  const advanceDeduction = periodAdvanceDeductions.reduce((sum, item) => sum + item.amount, 0);
  const debtDeduction = Math.max(0, Math.round(clampNumber(periodDebtDeduction, 0)));
  const netPay = Math.max(0, grossPay - vnpfDeduction - advanceDeduction - debtDeduction);
  const advanceIssuedTotal = periodAdvances.filter((item) => item.type === "advance").reduce((sum, item) => sum + item.amount, 0);
  const trackPointCount = dailyItems.reduce((sum, item) => sum + item.trackPointCount, 0);
  const visitCount = dailyItems.reduce((sum, item) => sum + item.visitCount, 0);
  const workHours = Number(dailyItems.reduce((sum, item) => sum + item.workHours, 0).toFixed(2));
  const outstandingAdvance = getAdvanceOutstanding(advances, employee.advanceBalance);
  const previousSettlements = (Array.isArray(employee.payrollSettlements) ? employee.payrollSettlements : [])
    .filter((item) => item.endDate < window.startDate)
    .slice(0, 3);

  return {
    employeeId: employee.id,
    employeeName: employee.name,
    role: employee.role,
    roleLabel: employee.roleLabel,
    date: String(options.dateKey || options.date || window.endDate || "").trim() || window.endDate,
    startDate: window.startDate,
    endDate: window.endDate,
    period: window.period,
    settlementLabel: buildPayrollWindowLabel(window),
    daysInPeriod: dateKeys.length,
    workedDays,
    absentDays: Math.max(0, dateKeys.length - workedDays),
    dailyRate: getFieldDailyRate(employee),
    grossPay,
    attendancePay: netPay,
    netPay,
    attendanceStatus: workedDays ? (dailyItems[dailyItems.length - 1]?.attendanceStatus || "已完成打卡") : "未出勤",
    vnpfRate,
    vnpfDeduction,
    advanceDeduction,
    debtDeduction,
    advanceOutstanding: outstandingAdvance,
    advanceIssuedTotal,
    visitCount,
    trackPointCount,
    checkinCount: dailyItems.reduce((sum, item) => sum + item.checkinCount, 0),
    workHours,
    workHoursLabel: workHours > 0 ? `${workHours} 小时` : "0 小时",
    firstCheckInLabel: dailyItems.find((item) => item.firstCheckInLabel && item.firstCheckInLabel !== "-")?.firstCheckInLabel || "-",
    lastCheckOutLabel: [...dailyItems].reverse().find((item) => item.lastCheckOutLabel && item.lastCheckOutLabel !== "-")?.lastCheckOutLabel || "-",
    dailyItems,
    advanceRecords: periodAdvances,
    settlementHistory: previousSettlements,
    debtOutstanding: Math.max(0, Math.round(clampNumber(employee.debtBalance, 0)))
  };
}

function parseTimeToMinutes(value, fallbackMinutes) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallbackMinutes;
  const hours = Math.max(0, Math.min(23, Number(match[1])));
  const minutes = Math.max(0, Math.min(59, Number(match[2])));
  return hours * 60 + minutes;
}

function getBusinessTimeParts(ts = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(ts).reduce((acc, item) => {
    acc[item.type] = item.value;
    return acc;
  }, {});
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdayMap[parts.weekday] ?? ts.getDay(),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: (Number(parts.hour || 0) * 60) + Number(parts.minute || 0)
  };
}

function getAttendanceValidation(action, ts = new Date()) {
  const settings = getSettings().attendance || defaultAttendanceSettings();
  if (settings.enforceTimeWindow !== true) {
    return { ok: true };
  }
  const businessTime = getBusinessTimeParts(ts);
  const weekday = businessTime.weekday;
  const enabledWeekdays = Array.isArray(settings.enabledWeekdays) ? settings.enabledWeekdays : defaultAttendanceSettings().enabledWeekdays;
  if (!enabledWeekdays.includes(weekday)) {
    return { ok: false, error: "今天不是允许打卡的工作日" };
  }
  const currentMinutes = businessTime.minutes;
  const checkInStart = parseTimeToMinutes(settings.checkInStart, 8 * 60 + 30);
  const checkInEnd = parseTimeToMinutes(settings.checkInEnd, 10 * 60);
  const checkOutStart = parseTimeToMinutes(settings.checkOutStart, 17 * 60);
  const checkOutEnd = parseTimeToMinutes(settings.checkOutEnd, 21 * 60);
  if (action === "in" && (currentMinutes < checkInStart || currentMinutes > checkInEnd)) {
    return { ok: false, error: `上班打卡时间为 ${settings.checkInStart} - ${settings.checkInEnd}` };
  }
  if (action === "out" && (currentMinutes < checkOutStart || currentMinutes > checkOutEnd)) {
    return { ok: false, error: `下班打卡时间为 ${settings.checkOutStart} - ${settings.checkOutEnd}` };
  }
  return { ok: true };
}

async function getFieldPayrollSummary(userId, dateKey) {
  return getFieldPayrollSettlement(userId, { dateKey, period: "day" });
}

async function getCompanyAttendanceOverview(dateKey = "", options = {}) {
  const targetDate = String(dateKey || new Date().toISOString().slice(0, 10)).trim();
  const period = String(options.period || "").trim();
  const employees = getEmployeesData().items.filter((item) => item.status !== "resigned");
  const items = (await Promise.all(employees.map((employee) => getFieldPayrollSettlement(employee.id, {
    dateKey: targetDate,
    period,
    startDate: options.startDate,
    endDate: options.endDate
  })))).filter(Boolean);
  const presentCount = items.filter((item) => item.checkinCount > 0).length;
  const onDutyCount = items.filter((item) => item.attendanceStatus === "在岗中").length;
  const completedCount = items.filter((item) => item.attendanceStatus === "已完成打卡").length;
  const absentCount = items.length - presentCount;
  const totalAttendancePay = items.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.attendancePay, 0))), 0);
  const totalVisits = items.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.visitCount, 0))), 0);
  const totalGrossPay = items.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.grossPay, 0))), 0);
  const totalVnpfDeduction = items.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.vnpfDeduction, 0))), 0);
  const totalAdvanceDeduction = items.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.advanceDeduction, 0))), 0);
  const totalWorkedDays = items.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.workedDays, item.checkinCount > 0 ? 1 : 0))), 0);
  const settlementWindow = resolvePayrollWindow({
    dateKey: targetDate,
    period,
    startDate: options.startDate,
    endDate: options.endDate
  });

  return {
    date: targetDate,
    startDate: settlementWindow.startDate,
    endDate: settlementWindow.endDate,
    period: settlementWindow.period,
    settlementLabel: buildPayrollWindowLabel(settlementWindow),
    summary: {
      totalEmployees: items.length,
      presentCount,
      onDutyCount,
      completedCount,
      absentCount,
      totalAttendancePay,
      totalVisits,
      totalGrossPay,
      totalVnpfDeduction,
      totalAdvanceDeduction,
      totalWorkedDays
    },
    items: items
      .slice()
      .sort((a, b) => {
        const score = (entry) => (entry.attendanceStatus === "在岗中" ? 2 : entry.attendanceStatus === "已完成打卡" ? 1 : 0);
        return score(b) - score(a) || String(a.employeeName || "").localeCompare(String(b.employeeName || ""));
      })
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "smart_sizing", time: new Date().toISOString() });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/auth/options" || url.pathname === "/api/auth/options/")) {
    const employees = getEmployeesData().items
      .map((employee) => {
        const profile = getAccessProfile(employee.id);
        return {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          branch: employee.branch,
          status: employee.status,
          role: profile?.role || employee.role || "sales",
          roleLabel: employee.roleLabel || employee.role || "",
          accessEnabled: profile?.accessEnabled !== false,
          securityLevel: Number(profile?.securityLevel || 1),
          landingPage: getRoleLandingPage(profile?.role || employee.role || "sales")
        };
      })
      .filter((item) => item.status !== "resigned");
    sendJson(res, 200, { ok: true, items: employees, defaultPin: "0000" });
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/auth/login" || url.pathname === "/api/auth/login/")) {
    parseBody(req)
      .then((body) => {
        const employeeId = String(body.employeeId || body.userId || "").trim();
        const pin = String(body.pin || "").trim();
        const employee = getFieldEmployeeById(employeeId);
        if (!employee) {
          sendJson(res, 404, { ok: false, error: "账号不存在" });
          return;
        }
        const profile = getAccessProfile(employee.id);
        if (!profile?.accessEnabled) {
          sendJson(res, 403, { ok: false, error: "该账号未启用后台访问权限" });
          return;
        }
        if (employee.status === "resigned") {
          sendJson(res, 403, { ok: false, error: "该账号已停用" });
          return;
        }
        if (pin !== String(employee.pin || "").trim()) {
          sendJson(res, 401, { ok: false, error: "PIN 不正确" });
          return;
        }
        const session = issueLoginSession(employee.id);
        sendJson(
          res,
          200,
          {
            ok: true,
            landingPage: getRoleLandingPage(profile.role),
            user: {
              id: employee.id,
              name: employee.name,
              email: employee.email,
              branch: employee.branch,
              role: profile.role,
              securityLevel: profile.securityLevel,
              accessEnabled: profile.accessEnabled
            }
          },
          { "Set-Cookie": buildAuthCookie(session.token) }
        );
      })
      .catch(() => sendJson(res, 400, { ok: false, error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/auth/me" || url.pathname === "/api/auth/me/")) {
    const session = getLoginSession(req);
    if (!session) {
      sendJson(res, 401, { ok: false, authenticated: false });
      return true;
    }
    const { employee, role, securityLevel, accessEnabled } = session.profile;
    sendJson(res, 200, {
      ok: true,
      authenticated: true,
      landingPage: getRoleLandingPage(role),
      user: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        branch: employee.branch,
        role,
        securityLevel,
        accessEnabled
      }
    });
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/auth/logout" || url.pathname === "/api/auth/logout/")) {
    clearLoginSession(req);
    sendJson(res, 200, { ok: true }, { "Set-Cookie": buildAuthCookie("") });
    return true;
  }

  const restrictedApiPrefixes = [
    "/api/security",
    "/api/system-settings",
    "/api/settings",
    "/api/backups",
    "/api/company-profile",
    "/api/product-config/package",
    "/api/vendors",
    "/api/inventory",
    "/api/product-config",
    "/api/expense-control",
    "/api/installments",
    "/api/commission",
    "/api/employees"
  ];
  if (restrictedApiPrefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) {
    const session = getLoginSession(req);
    if (!session) {
      sendJson(res, 401, { ok: false, error: "请先登录" });
      return true;
    }
    if (!isApiAllowedForRole(session.profile.role, url.pathname)) {
      sendJson(res, 403, { ok: false, error: "当前账号无权限访问此接口" });
      return true;
    }
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/system-settings")) {
    const currentSettings = getSettings();
    sendJson(res, 200, {
      ok: true,
      settings: {
        ...currentSettings,
        company: currentSettings.company || defaultCompanyProfile()
      },
      backups: getBackupHistory()
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/company-profile") {
    sendJson(res, 200, { ok: true, company: configStore.isEnabled() ? configStore.getCompanyProfile() : readJson(COMPANY_FILE, defaultCompanyProfile()) });
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/system-settings")) {
    parseBody(req)
      .then((body) => {
        const nextSettings = buildSystemSettings(body);
        writeJson(SETTINGS_FILE, nextSettings);
        writeJson(COMPANY_FILE, nextSettings.company || defaultCompanyProfile());
        if (configStore.isEnabled()) {
          configStore.saveSettings(nextSettings).catch((error) => {
            console.error("[settings] Failed to persist config store:", error);
          });
          configStore.saveCompanyProfile(nextSettings.company || defaultCompanyProfile()).catch((error) => {
            console.error("[company-profile] Failed to persist config store:", error);
          });
        }
        sendJson(res, 200, { ok: true, settings: getSettings(), backups: getBackupHistory() });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/company-profile") {
    parseBody(req)
      .then((body) => {
        const currentCompany = configStore.isEnabled() ? configStore.getCompanyProfile() : readJson(COMPANY_FILE, defaultCompanyProfile());
        const nextCompany = {
          ...defaultCompanyProfile(),
          ...currentCompany,
          ...(body.company || body),
          name: String(body.company?.name || body.name || currentCompany.name || defaultCompanyProfile().name).trim(),
          tin: String(body.company?.tin || body.tin || currentCompany.tin || "").trim(),
          bankName: String(body.company?.bankName || body.bankName || currentCompany.bankName || "").trim(),
          bankAccountName: String(body.company?.bankAccountName || body.bankAccountName || currentCompany.bankAccountName || "").trim(),
          bankAccountNumber: String(body.company?.bankAccountNumber || body.bankAccountNumber || currentCompany.bankAccountNumber || "").trim(),
          address: String(body.company?.address || body.address || currentCompany.address || "").trim(),
          phone: String(body.company?.phone || body.phone || currentCompany.phone || "").trim(),
          email: String(body.company?.email || body.email || currentCompany.email || "").trim(),
          logoUrl: String(body.company?.logoUrl || body.logoUrl || currentCompany.logoUrl || "").trim()
        };
        writeJson(COMPANY_FILE, nextCompany);
        if (configStore.isEnabled()) {
          configStore.saveCompanyProfile(nextCompany).catch((error) => {
            console.error("[company-profile] Failed to persist config store:", error);
          });
        }
        sendJson(res, 200, { ok: true, company: nextCompany });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/company-profile/logo/upload") {
    parseBody(req)
      .then((body) => {
        const uploadedUrl = saveDataUrlImage(body.dataUrl, "company-logo");
        if (!uploadedUrl) {
          sendJson(res, 400, { error: "Invalid image data" });
          return;
        }
        const currentCompany = configStore.isEnabled() ? configStore.getCompanyProfile() : readJson(COMPANY_FILE, defaultCompanyProfile());
        const nextCompany = {
          ...defaultCompanyProfile(),
          ...currentCompany,
          logoUrl: uploadedUrl
        };
        writeJson(COMPANY_FILE, nextCompany);
        if (configStore.isEnabled()) {
          configStore.saveCompanyProfile(nextCompany).catch((error) => {
            console.error("[company-profile] Failed to persist config store:", error);
          });
        }
        sendJson(res, 200, { ok: true, logoUrl: uploadedUrl, company: nextCompany });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/system-backups/create")) {
    parseBody(req)
      .then(async (body) => {
        const created = await createBackupSnapshot(String(body.trigger || "manual").trim() || "manual", body.notes || "");
        sendJson(res, 200, { ok: true, item: created.item, backups: created.history });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/system-backups/test-drive")) {
    parseBody(req)
      .then(async (body) => {
        const mergedBackupSettings = {
          ...defaultBackupSettings(),
          ...(getSettings().backup || {}),
          ...(body.backup || {}),
          autoDaily: Boolean(body.backup?.autoDaily ?? getSettings().backup?.autoDaily),
          autoWeekly: Boolean(body.backup?.autoWeekly ?? getSettings().backup?.autoWeekly),
          googleDriveEnabled: Boolean(body.backup?.googleDriveEnabled ?? getSettings().backup?.googleDriveEnabled),
          googleDriveFolderId: String((body.backup?.googleDriveFolderId ?? getSettings().backup?.googleDriveFolderId) || "").trim(),
          googleDriveAccessToken: String((body.backup?.googleDriveAccessToken ?? getSettings().backup?.googleDriveAccessToken) || "").trim()
        };
        const result = await testGoogleDriveConnection(mergedBackupSettings);
        if (!result.ok) {
          sendJson(res, 400, result);
          return;
        }
        sendJson(res, 200, result);
      })
      .catch(() => sendJson(res, 400, { ok: false, error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/system-backups/restore")) {
    parseBody(req)
      .then(async (body) => {
        const restored = await restoreBackupSnapshot(body.id);
        if (restored.error) {
          sendJson(res, 404, { error: restored.error });
          return;
        }
        sendJson(res, 200, { ok: true, item: restored.item, settings: getSettings(), backups: getBackupHistory() });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/system-backups/download")) {
    const history = getBackupHistory();
    const item = history.find((entry) => entry.id === String(url.searchParams.get("id") || "").trim());
    if (!item) {
      sendJson(res, 404, { error: "Backup not found" });
      return true;
    }
    const filePath = path.join(BACKUPS_DIR, item.filename);
    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: "Backup file missing" });
      return true;
    }
    sendDownload(res, 200, "application/json; charset=utf-8", item.filename, fs.readFileSync(filePath));
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/settings")) {
    sendJson(res, 200, {
      ok: true,
      settings: getSettings(),
      backups: getBackupHistory()
    });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/backups/download")) {
    const history = getBackupHistory();
    const item = history.find((entry) => entry.id === String(url.searchParams.get("id") || "").trim());
    if (!item) {
      sendJson(res, 404, { error: "Backup not found" });
      return true;
    }
    const filePath = path.join(BACKUPS_DIR, item.filename);
    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: "Backup file missing" });
      return true;
    }
    sendDownload(res, 200, "application/json; charset=utf-8", item.filename, fs.readFileSync(filePath));
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/backups/create")) {
    parseBody(req)
      .then(async (body) => {
        const created = await createBackupSnapshot(String(body.trigger || "manual").trim() || "manual", body.notes || "");
        sendJson(res, 200, { ok: true, item: created.item, backups: created.history });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/backups/restore")) {
    parseBody(req)
      .then(async (body) => {
        const restored = await restoreBackupSnapshot(body.id);
        if (restored.error) {
          sendJson(res, 404, { error: restored.error });
          return;
        }
        sendJson(res, 200, { ok: true, item: restored.item, settings: getSettings(), backups: getBackupHistory() });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/inventory" || url.pathname === "/api/inventory/")) {
    sendJson(res, 200, { ok: true, ...getInventoryData() });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/repair-order" || url.pathname === "/api/repair-order/")) {
    sendJson(res, 200, { ok: true, order: getRepairOrder(url.searchParams.get("id")) });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/repair-orders" || url.pathname === "/api/repair-orders/")) {
    const profile = ensureAuthedProfile(req, res);
    if (!profile) return true;
    sendJson(res, 200, { ok: true, items: filterRepairOrdersForProfile(profile, getRepairOrders()).map((item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      statusLabel: item.statusLabel,
      priority: item.priority,
      priorityLabel: item.priorityLabel,
      etaLabel: item.etaLabel,
      assetLocation: item.assetLocation,
      customer: item.customer,
      assignedEngineer: item.assignedEngineer
    })) });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/site-survey" || url.pathname === "/api/site-survey/")) {
    sendJson(res, 200, { ok: true, ...getSurveyData() });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/employees" || url.pathname === "/api/employees/")) {
    if (businessStore.isEnabled()) {
      syncBusinessDocumentsFromStore().catch((error) => {
        console.error("[employees:sync] failed:", error);
      });
    }
    const employees = getEmployeesData();
    const role = String(url.searchParams.get("role") || "").trim();
    const items = role ? employees.items.filter((item) => item.role === role) : employees.items;
    sendJson(res, 200, {
      ok: true,
      monthlyTrend: employees.monthlyTrend,
      items,
      summary: buildEmployeeSummary(items)
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/field-auth/login") {
    parseBody(req)
      .then((body) => {
        const employeeId = String(body.employeeId || body.userId || "").trim();
        const pin = String(body.pin || "").trim();
        const employee = getFieldEmployeeById(employeeId);
        if (!employee) {
          sendJson(res, 404, { error: "员工不存在" });
          return;
        }
        if (employee.status !== "active") {
          sendJson(res, 403, { error: "当前员工无外勤登录权限" });
          return;
        }
        if (!pin || pin !== String(employee.pin || "0000")) {
          sendJson(res, 401, { error: "PIN 不正确" });
          return;
        }
        const token = issueFieldToken(employee.id);
        sendJson(res, 200, {
          ok: true,
          token,
          user: {
            id: employee.id,
            name: employee.name,
            role: employee.role,
            roleLabel: employee.roleLabel,
            dailyRate: getFieldDailyRate(employee)
          }
        });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/field-auth/me") {
    const auth = getFieldAuth(req);
    if (!auth) {
      sendJson(res, 401, { error: "未登录" });
      return true;
    }
    const employee = getFieldEmployeeById(auth.userId);
    if (!employee) {
      sendJson(res, 404, { error: "员工不存在" });
      return true;
    }
    sendJson(res, 200, {
      ok: true,
      user: {
        id: employee.id,
        name: employee.name,
        role: employee.role,
        roleLabel: employee.roleLabel,
        dailyRate: getFieldDailyRate(employee)
      }
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/field-payroll") {
    const profile = ensureAuthedProfile(req, res);
    if (!profile) return true;
    const requestedUserId = String(url.searchParams.get("user") || "").trim();
    const userId = profile.role === "admin" || profile.role === "sales_manager" ? requestedUserId : (requestedUserId || profile.employee.id);
    if (profile.role !== "admin" && profile.role !== "sales_manager" && userId !== profile.employee.id) {
      sendJson(res, 403, { ok: false, error: "当前账号只能查看自己的工资结算" });
      return true;
    }
    const dateKey = String(url.searchParams.get("date") || "").trim();
    const period = String(url.searchParams.get("period") || "").trim();
    const startDate = String(url.searchParams.get("start") || "").trim();
    const endDate = String(url.searchParams.get("end") || "").trim();
    Promise.resolve(getFieldPayrollSettlement(userId, { dateKey, period, startDate, endDate }))
      .then((summary) => {
        if (!summary) {
          sendJson(res, 404, { error: "未找到员工工资结算信息" });
          return;
        }
        sendJson(res, 200, summary);
      })
      .catch((error) => {
        console.error("[field-payroll] failed:", error);
        sendJson(res, 500, { error: "工资结算读取失败" });
      });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/attendance-overview") {
    const profile = ensureAuthedProfile(req, res);
    if (!profile) return true;
    const dateKey = String(url.searchParams.get("date") || "").trim();
    const period = String(url.searchParams.get("period") || "").trim();
    const startDate = String(url.searchParams.get("start") || "").trim();
    const endDate = String(url.searchParams.get("end") || "").trim();
    Promise.resolve(getCompanyAttendanceOverview(dateKey, { period, startDate, endDate }))
      .then((overview) => {
        if (profile.role === "admin" || profile.role === "sales_manager") {
          sendJson(res, 200, overview);
          return;
        }
        const ownItem = (overview.items || []).filter((item) => String(item.employeeId || "").trim() === profile.employee.id);
        sendJson(res, 200, {
          ...overview,
          summary: {
            ...overview.summary,
            totalEmployees: ownItem.length,
            presentCount: ownItem.filter((item) => item.attendanceStatus !== "未出勤").length,
            onDutyCount: ownItem.filter((item) => item.attendanceStatus === "在岗中").length,
            completedCount: ownItem.filter((item) => item.attendanceStatus === "已完成打卡").length,
            absentCount: ownItem.filter((item) => item.attendanceStatus === "未出勤").length,
            totalAttendancePay: ownItem.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.netPay, 0))), 0),
            totalVisits: ownItem.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.visitCount, 0))), 0),
            totalGrossPay: ownItem.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.grossPay, 0))), 0),
            totalVnpfDeduction: ownItem.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.vnpfDeduction, 0))), 0),
            totalAdvanceDeduction: ownItem.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.advanceDeduction, 0))), 0),
            totalWorkedDays: ownItem.reduce((sum, item) => sum + Math.max(0, Math.round(clampNumber(item.workedDays, 0))), 0)
          },
          items: ownItem
        });
      })
      .catch((error) => {
        console.error("[attendance-overview] failed:", error);
        sendJson(res, 500, { error: "考勤总览读取失败" });
      });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/employees/detail" || url.pathname === "/api/employees/detail/")) {
    const detail = getEmployeeDetail(url.searchParams.get("id"));
    if (!detail) {
      sendJson(res, 404, { error: "Employee not found" });
      return true;
    }
    sendJson(res, 200, { ok: true, ...detail });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/security" || url.pathname === "/api/security/")) {
    sendJson(res, 200, { ok: true, ...getSecurityData() });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/performance" || url.pathname === "/api/performance/")) {
    sendJson(res, 200, { ok: true, ...getPerformanceData() });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/reports" || url.pathname === "/api/reports/")) {
    sendJson(res, 200, { ok: true, ...getReportsData() });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/reports/export.csv" || url.pathname === "/api/reports/export.csv/")) {
    const csv = "\uFEFF" + buildReportsExportCsv(getReportsData());
    sendDownload(res, 200, "text/csv; charset=utf-8", "reports-center-export.csv", csv);
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/reports/export.pdf" || url.pathname === "/api/reports/export.pdf/")) {
    const pdf = buildReportsExportPdf(getReportsData());
    sendDownload(res, 200, "application/pdf", "reports-center-export.pdf", pdf);
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/financial-report" || url.pathname === "/api/financial-report/")) {
    sendJson(res, 200, { ok: true, ...getFinancialReportData() });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/expense-control" || url.pathname === "/api/expense-control/")) {
    Promise.resolve(getExpenseControlDataAsync())
      .then((data) => sendJson(res, 200, { ok: true, ...data }))
      .catch((error) => {
        console.error("[expense-control:list] failed:", error);
        sendJson(res, 500, { error: "费用数据读取失败" });
      });
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/expense-control/payment-queue/update" || url.pathname === "/api/expense-control/payment-queue/update/")) {
    parseBody(req)
      .then((body) => {
        const data = getExpenseControlData();
        const targetId = String(body.id || "").trim();
        const nextStatus = String(body.status || "").trim();
        const updated = data.paymentQueue.map((item) => item.id === targetId ? { ...item, status: nextStatus || item.status } : item);
        const next = saveExpenseControlData({ ...data, paymentQueue: updated });
        const result = appendExpenseTransactionEntry(next, {
          type: "支付审核更新",
          customer: body.customer || targetId || "支付审核",
          amount: clampNumber(body.amount, 0),
          status: nextStatus || "已更新"
        });
        sendJson(res, 200, { ok: true, ...result });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/expense-control/installment/update" || url.pathname === "/api/expense-control/installment/update/")) {
    parseBody(req)
      .then((body) => {
        const data = getExpenseControlData();
        const targetId = String(body.id || "").trim();
        const updated = data.installmentPlans.map((item) => {
          if (item.id !== targetId) return item;
          const completedWeeks = body.completedWeeks == null ? item.completedWeeks : Math.round(clampNumber(body.completedWeeks, item.completedWeeks));
          const totalWeeks = Math.max(1, Math.round(clampNumber(body.totalWeeks, item.totalWeeks)));
          const progress = Number(((Math.max(0, Math.min(totalWeeks, completedWeeks)) / totalWeeks) * 100).toFixed(1));
          const paymentAmount = normalizeExpenseAmount(body.paymentAmount);
          const paymentDate = String(body.paymentDate || "").trim();
          const collectorName = String(body.collectorName || "").trim();
          const paymentNote = String(body.paymentNote || "").trim();
          const paymentRecords = Array.isArray(item.paymentRecords) ? item.paymentRecords.slice() : [];
          if (paymentAmount > 0 || paymentDate || collectorName || paymentNote) {
            const paymentId = `PAY-${Date.now()}`;
            paymentRecords.unshift({
              id: paymentId,
              receiptNo: `RCPT-${String(paymentId).replace(/[^A-Za-z0-9]/g, "").slice(-10)}`,
              amount: paymentAmount,
              paidAt: paymentDate || new Date().toISOString().slice(0, 10),
              collectorName,
              note: paymentNote
            });
          }
          return {
            ...item,
            completedWeeks: Math.max(0, Math.min(totalWeeks, completedWeeks)),
            totalWeeks,
            progress,
            cycleLabel: `${totalWeeks} 周计划`,
            status: String(body.status || item.status).trim() || item.status,
            paymentAmount: paymentAmount || item.paymentAmount || 0,
            paymentDate: paymentDate || item.paymentDate || "",
            collectorName: collectorName || item.collectorName || "",
            paymentRecords
          };
        });
        const result = saveExpenseControlData({ ...data, installmentPlans: updated });
        sendJson(res, 200, { ok: true, ...result });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/expense-control/commission/update" || url.pathname === "/api/expense-control/commission/update/")) {
    parseBody(req)
      .then((body) => {
        const data = getExpenseControlData();
        const targetId = String(body.id || "").trim();
        const updated = data.commissionPool.map((item) => {
          if (item.id !== targetId) return item;
          const releaseRate = Math.max(0, Math.min(100, clampNumber(body.releaseRate, item.releaseRate)));
          const releasedAmount = Math.round(item.amount * (releaseRate / 100));
          return {
            ...item,
            releaseRate,
            releasedAmount,
            lockedAmount: Math.max(0, item.amount - releasedAmount),
            releaseStatus: String(body.releaseStatus || item.releaseStatus).trim() || item.releaseStatus
          };
        });
        const result = saveExpenseControlData({ ...data, commissionPool: updated });
        sendJson(res, 200, { ok: true, ...result });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/expense-control/living-cost/update" || url.pathname === "/api/expense-control/living-cost/update/")) {
    parseBody(req)
      .then((body) => {
        const data = getExpenseControlData();
        const targetId = String(body.id || "").trim();
        const nextItems = targetId
          ? data.livingCosts.map((item) => item.id === targetId ? { ...item, status: String(body.status || item.status).trim() || item.status } : item)
          : [{ id: body.id || `LIFE-${Date.now()}`, name: body.name, category: body.category || "生活成本", amount: body.amount, status: body.status || "待支付", note: body.note || "" }, ...data.livingCosts];
        const result = saveExpenseControlData({ ...data, livingCosts: nextItems });
        sendJson(res, 200, { ok: true, ...result });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/expense-control/tax/update" || url.pathname === "/api/expense-control/tax/update/")) {
    parseBody(req)
      .then((body) => {
        const data = getExpenseControlData();
        const targetId = String(body.id || "").trim();
        const nextItems = targetId
          ? data.taxes.map((item) => item.id === targetId ? { ...item, status: String(body.status || item.status).trim() || item.status } : item)
          : [{ id: body.id || `TAX-${Date.now()}`, name: body.name, period: body.period || "", amount: body.amount, status: body.status || "待申报" }, ...data.taxes];
        const result = saveExpenseControlData({ ...data, taxes: nextItems });
        sendJson(res, 200, { ok: true, ...result });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/expense-control/invoice/update" || url.pathname === "/api/expense-control/invoice/update/")) {
    parseBody(req)
      .then((body) => {
        const data = getExpenseControlData();
        const targetId = String(body.id || "").trim();
        const nextItems = targetId
          ? data.invoices.map((item) => item.id === targetId ? { ...item, status: String(body.status || item.status).trim() || item.status } : item)
          : [{ id: body.id || `INV-${Date.now()}`, customer: body.customer || "未命名客户", amount: body.amount, status: body.status || "待开票", issuedAt: body.issuedAt || new Date().toISOString() }, ...data.invoices];
        const result = saveExpenseControlData({ ...data, invoices: nextItems });
        sendJson(res, 200, { ok: true, ...result });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/expense-control/rent/update" || url.pathname === "/api/expense-control/rent/update/")) {
    parseBody(req)
      .then((body) => {
        const data = getExpenseControlData();
        const targetId = String(body.id || "").trim();
        const nextItems = targetId
          ? data.rentLedger.map((item) => item.id === targetId ? { ...item, status: String(body.status || item.status).trim() || item.status } : item)
          : [{ id: body.id || `RENT-${Date.now()}`, location: body.location || "未命名站点", month: body.month || "", amount: body.amount, status: body.status || "待支付" }, ...data.rentLedger];
        const result = saveExpenseControlData({ ...data, rentLedger: nextItems });
        sendJson(res, 200, { ok: true, ...result });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/expense-control/attachment/upload" || url.pathname === "/api/expense-control/attachment/upload/")) {
    parseBody(req)
      .then((body) => {
        const saved = saveExpenseAttachment(body.section, body.id, body.filename, body.dataUrl);
        if (saved?.error) {
          sendJson(res, 400, { error: saved.error });
          return;
        }
        sendJson(res, 200, { ok: true, ...saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/vendors" || url.pathname === "/api/vendors/")) {
    Promise.resolve(getVendorsDataAsync())
      .then((data) => sendJson(res, 200, { ok: true, ...data }))
      .catch((error) => {
        console.error("[vendors:list] failed:", error);
        sendJson(res, 500, { error: "供应商数据读取失败" });
      });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/wholesale" || url.pathname === "/api/wholesale/")) {
    Promise.resolve(getWholesaleDataAsync())
      .then((data) => sendJson(res, 200, { ok: true, ...data }))
      .catch((error) => {
        console.error("[wholesale:list] failed:", error);
        sendJson(res, 500, { error: "批发数据读取失败" });
      });
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/wholesale/merchant" || url.pathname === "/api/wholesale/merchant/")) {
    parseBody(req)
      .then((body) => {
        const customers = getCustomersData();
        const salesPerson = body.salesPersonId ? findEmployeeById(body.salesPersonId) : null;
        const customer = normalizeCustomerRecord({
          id: body.id || `merchant-${Date.now()}`,
          archiveNo: body.archiveNo || `VSLM-WHOLESALE-${new Date().getFullYear()}-${String(customers.items.filter((item) => item.customerType === "local_wholesale").length + 1).padStart(3, "0")}`,
          name: body.name,
          contactName: body.contactName,
          phone: body.phone,
          email: body.email,
          province: body.province || "Shefa Province",
          location: body.location || "Port Vila",
          address: body.address,
          customerType: "local_wholesale",
          usageType: body.usageType || "本地批发商",
          installDate: body.installDate || new Date().toISOString().slice(0, 10),
          salesPersonId: salesPerson?.id || "",
          salesPersonName: salesPerson?.name || "",
          payment: body.payment || {
            cycleLabel: "批发月结",
            completedWeeks: 0,
            totalWeeks: 4,
            paidAmount: 0,
            balanceAmount: 0,
            nextDueLabel: "月末结算"
          },
          orders: [],
          devices: [],
          photos: [],
          warrantyHistory: [],
          warrantyEndsAt: ""
        }, customers.items.length);
        const exists = customers.items.some((item) => item.id === customer.id || item.archiveNo === customer.archiveNo);
        if (exists) {
          sendJson(res, 400, { error: "Merchant already exists" });
          return;
        }
        customers.items.unshift(customer);
        saveCustomersData(customers);
        sendJson(res, 200, { ok: true, merchant: customer, wholesale: getWholesaleData() });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/wholesale/orders" || url.pathname === "/api/wholesale/orders/")) {
    parseBody(req)
      .then((body) => {
        const merchantId = String(body.merchantId || "").trim();
        const packageId = String(body.packageId || "").trim();
        const quantity = Math.max(1, Math.round(clampNumber(body.quantity, 1)));
        const customers = getCustomersData();
        const merchantIndex = customers.items.findIndex((item) => item.id === merchantId && item.customerType === "local_wholesale");
        if (merchantIndex < 0) {
          sendJson(res, 404, { error: "Merchant not found" });
          return;
        }
        const salesPerson = findEmployeeById(body.salesPersonId);
        if (!salesPerson || !["sales", "sales_manager"].includes(salesPerson.role)) {
          sendJson(res, 400, { error: "Valid sales person is required" });
          return;
        }
        const config = getProductConfig();
        const packageIndex = config.packages.findIndex((item) => item.id === packageId && item.status === "active");
        if (packageIndex < 0) {
          sendJson(res, 404, { error: "Wholesale package not found" });
          return;
        }
        const selectedPackage = config.packages[packageIndex];
        if (selectedPackage.stock < quantity) {
          sendJson(res, 400, { error: "Insufficient package stock" });
          return;
        }

        const unitPriceVt = Math.max(0, Math.round(clampNumber(body.unitPriceVt, selectedPackage.wholesaleVt)));
        const totalVt = unitPriceVt * quantity;
        const paidAmountVt = Math.max(0, Math.min(totalVt, Math.round(clampNumber(body.paidAmountVt, 0))));
        const order = normalizeWholesaleOrder({
          id: `WHO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`,
          merchantId,
          merchantName: customers.items[merchantIndex].name,
          salesPersonId: salesPerson.id,
          salesPersonName: salesPerson.name,
          packageId: selectedPackage.id,
          packageName: selectedPackage.name,
          quantity,
          unitPriceVt,
          totalVt,
          paidAmountVt,
          balanceAmountVt: Math.max(0, totalVt - paidAmountVt),
          status: body.status || "pending_payment",
          currency: "VUV",
          createdAt: new Date().toISOString(),
          notes: body.notes || ""
        });

        const wholesale = readJson(WHOLESALE_FILE, defaultWholesaleData());
        const nextOrders = [order, ...((Array.isArray(wholesale.orders) ? wholesale.orders : []).map(normalizeWholesaleOrder))];
        saveWholesaleData({ orders: nextOrders });

        config.packages[packageIndex] = normalizePackage({
          ...selectedPackage,
          stock: selectedPackage.stock - quantity
        }, packageIndex);
        saveProductConfig(config);

        const merchant = customers.items[merchantIndex];
        const updatedOrders = [
          normalizeCustomerOrder({
            id: order.id,
            name: `${order.packageName} x ${order.quantity}`,
            status: order.statusLabel,
            date: order.createdAt.slice(0, 10)
          }),
          ...merchant.orders.filter((item) => item.id !== order.id)
        ];
        customers.items[merchantIndex] = normalizeCustomerRecord({
          ...merchant,
          salesPersonId: salesPerson.id,
          salesPersonName: salesPerson.name,
          payment: {
            ...merchant.payment,
            cycleLabel: "批发月结",
            paidAmount: merchant.payment.paidAmount + paidAmountVt,
            balanceAmount: merchant.payment.balanceAmount + Math.max(0, totalVt - paidAmountVt),
            nextDueLabel: merchant.payment.nextDueLabel || "月末结算"
          },
          orders: updatedOrders
        }, merchantIndex);
        saveCustomersData(customers);

        sendJson(res, 200, { ok: true, order, wholesale: getWholesaleData() });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/wholesale/orders/payment" || url.pathname === "/api/wholesale/orders/payment/")) {
    parseBody(req)
      .then((body) => {
        const orderId = String(body.id || "").trim();
        const wholesaleRaw = readJson(WHOLESALE_FILE, defaultWholesaleData());
        const orders = (Array.isArray(wholesaleRaw.orders) ? wholesaleRaw.orders : []).map(normalizeWholesaleOrder);
        const index = orders.findIndex((item) => item.id === orderId);
        if (index < 0) {
          sendJson(res, 404, { error: "Wholesale order not found" });
          return;
        }

        const currentOrder = orders[index];
        const totalVt = currentOrder.totalVt;
        const paidAmountVt = Math.max(0, Math.min(totalVt, Math.round(clampNumber(body.paidAmountVt, currentOrder.paidAmountVt))));
        const balanceAmountVt = Math.max(0, totalVt - paidAmountVt);
        let status = ["pending_payment", "partial_paid", "paid", "delivered", "cancelled"].includes(String(body.status || "").trim())
          ? String(body.status).trim()
          : currentOrder.status;

        if (status !== "cancelled" && status !== "delivered") {
          if (paidAmountVt <= 0) status = "pending_payment";
          else if (paidAmountVt >= totalVt) status = "paid";
          else status = "partial_paid";
        }

        orders[index] = normalizeWholesaleOrder({
          ...currentOrder,
          paidAmountVt,
          balanceAmountVt,
          status,
          notes: body.notes ?? currentOrder.notes
        }, index);
        saveWholesaleData({ orders });

        const customers = getCustomersData();
        const merchantIndex = customers.items.findIndex((item) => item.id === currentOrder.merchantId);
        if (merchantIndex >= 0) {
          const merchantOrders = orders.filter((item) => item.merchantId === currentOrder.merchantId);
          const totalPaid = merchantOrders.reduce((sum, item) => sum + item.paidAmountVt, 0);
          const totalBalance = merchantOrders.reduce((sum, item) => sum + item.balanceAmountVt, 0);
          const orderStatusLabel = orders[index].statusLabel;
          customers.items[merchantIndex] = normalizeCustomerRecord({
            ...customers.items[merchantIndex],
            payment: {
              ...customers.items[merchantIndex].payment,
              paidAmount: totalPaid,
              balanceAmount: totalBalance
            },
            orders: customers.items[merchantIndex].orders.map((item) => item.id === currentOrder.id ? { ...item, status: orderStatusLabel } : item)
          }, merchantIndex);
          saveCustomersData(customers);
        }

        sendJson(res, 200, { ok: true, order: orders[index], wholesale: getWholesaleData() });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/vendors/order" || url.pathname === "/api/vendors/order/")) {
    parseBody(req)
      .then((body) => {
        const current = readJson(VENDORS_FILE, defaultVendorsData());
        const vendorItems = (Array.isArray(current.items) ? current.items : defaultVendorsData().items).map(normalizeVendor);
        const vendor = vendorItems.find((item) => item.id === String(body.vendorId || "").trim());
        if (!vendor) {
          sendJson(res, 404, { error: "Vendor not found" });
          return;
        }

        const currency = ["CNY", "USD"].includes(String(body.currency || "").trim().toUpperCase())
          ? String(body.currency).trim().toUpperCase()
          : "CNY";
        const rawLines = Array.isArray(body.lines) ? body.lines : [];
        const lines = rawLines.map((line) => ({
          itemName: String(line.itemName || "").trim(),
          quantity: Math.max(1, Math.round(clampNumber(line.quantity, 1))),
          unit: String(line.unit || "pcs").trim(),
          unitPrice: Math.max(0, Number(clampNumber(line.unitPrice, 0).toFixed(2))),
          currency
        })).filter((line) => line.itemName);
        if (!lines.length) {
          sendJson(res, 400, { error: "At least one order line is required" });
          return;
        }
        const unsupported = lines.find((line) => !(vendor.supportedItems || []).includes(line.itemName));
        if (unsupported) {
          sendJson(res, 400, { error: `${vendor.name} does not supply ${unsupported.itemName}` });
          return;
        }

        const requesterId = String(body.requestedById || "").trim();
        const requester = findEmployeeById(requesterId);
        if (!requester || !["admin", "sales_manager"].includes(requester.role)) {
          sendJson(res, 403, { error: "Only admins and sales managers can place purchase orders" });
          return;
        }

        const order = normalizeVendorOrder({
          id: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-4)}`,
          vendorId: vendor.id,
          vendorName: vendor.name,
          currency,
          status: "pending",
          requestedBy: requester.name,
          notes: String(body.notes || "").trim(),
          createdAt: new Date().toISOString(),
          lines
        });

        const orders = [order, ...((Array.isArray(current.orders) ? current.orders : defaultVendorsData().orders).map(normalizeVendorOrder))];
        saveVendorsData({
          items: vendorItems,
          orders
        });
        sendJson(res, 200, { ok: true, order, data: getVendorsData() });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/customers" || url.pathname === "/api/customers/")) {
    const profile = ensureAuthedProfile(req, res);
    if (!profile) return true;
    Promise.resolve(getCustomersDataAsync())
      .then((current) => {
        sendJson(res, 200, { ok: true, ...current, items: filterCustomersForProfile(profile, getActiveCustomers(current.items)) });
      })
      .catch((error) => {
        console.error("[customers:list] failed:", error);
        sendJson(res, 500, { error: "客户数据读取失败" });
      });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/customers/detail" || url.pathname === "/api/customers/detail/")) {
    const profile = ensureAuthedProfile(req, res);
    if (!profile) return true;
    Promise.resolve((async () => {
      await syncCrmDocumentsFromStore();
      return getCustomerDetail(url.searchParams.get("id"));
    })())
      .then((customer) => {
        if (!customer) {
          sendJson(res, 404, { error: "Customer not found" });
          return;
        }
        if (!canAccessCustomer(profile, customer)) {
          sendJson(res, 403, { ok: false, error: "当前账号无权限查看该客户" });
          return;
        }
        sendJson(res, 200, { ok: true, customer });
      })
      .catch((error) => {
        console.error("[customers:detail] failed:", error);
        sendJson(res, 500, { error: "客户详情读取失败" });
      });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/customers/warranty-search" || url.pathname === "/api/customers/warranty-search/")) {
    const serial = String(url.searchParams.get("serial") || "").trim();
    if (!serial) {
      sendJson(res, 400, { error: "Serial number is required" });
      return true;
    }
    sendJson(res, 200, { ok: true, serial, items: searchCustomerWarrantyBySerial(serial) });
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/customers/payment" || url.pathname === "/api/customers/payment/")) {
    parseBody(req)
      .then(async (body) => {
        const id = String(body.id || "").trim();
        const current = await getCustomersDataAsync();
        const index = current.items.findIndex((item) => item.id === id);
        if (index < 0) {
          sendJson(res, 404, { error: "Customer not found" });
          return;
        }
        const amount = Math.max(0, Math.round(clampNumber(body.amount, 0)));
        if (amount <= 0) {
          sendJson(res, 400, { error: "Payment amount is required" });
          return;
        }
        const paidAt = String(body.paidAt || new Date().toISOString().slice(0, 10)).trim();
        const collectorName = String(body.collectorName || "").trim();
        const note = String(body.note || "").trim();
        const paymentId = `CPAY-${Date.now()}`;
        const record = {
          id: paymentId,
          receiptNo: paymentId,
          amount,
          paidAt,
          collectorName,
          note
        };
        const customer = current.items[index];
        current.items[index] = normalizeCustomerRecord({
          ...customer,
          payment: {
            ...customer.payment,
            paidAmount: customer.payment.paidAmount + amount,
            balanceAmount: Math.max(0, customer.payment.balanceAmount - amount),
            nextDueLabel: body.nextDueLabel ? String(body.nextDueLabel).trim() : customer.payment.nextDueLabel
          },
          paymentHistory: [record, ...(Array.isArray(customer.paymentHistory) ? customer.paymentHistory : [])]
        }, index);
        let saved = saveCustomersData(current);
        if (crmStore.isEnabled()) {
          await ensureCrmStoreReady();
          await crmStore.upsertCustomer(current.items[index]);
          await syncCrmDocumentsFromStore();
          saved = await getCustomersDataAsync();
        }
        sendJson(res, 200, { ok: true, customer: getCustomerDetail(current.items[index].id), customers: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/customers/warranty" || url.pathname === "/api/customers/warranty/")) {
    parseBody(req)
      .then(async (body) => {
        const id = String(body.id || "").trim();
        const current = await getCustomersDataAsync();
        const index = current.items.findIndex((item) => item.id === id);
        if (index < 0) {
          sendJson(res, 404, { error: "Customer not found" });
          return;
        }
        const title = String(body.title || "").trim();
        if (!title) {
          sendJson(res, 400, { error: "Warranty title is required" });
          return;
        }
        const date = String(body.date || new Date().toISOString().slice(0, 10)).trim();
        const detail = String(body.detail || "").trim();
        const customer = current.items[index];
        current.items[index] = normalizeCustomerRecord({
          ...customer,
          warrantyHistory: [
            {
              id: `war-${Date.now()}`,
              title,
              date,
              detail,
              serialNo: String(body.serialNo || "").trim()
            },
            ...(Array.isArray(customer.warrantyHistory) ? customer.warrantyHistory : [])
          ],
          warrantyEndsAt: String(body.warrantyEndsAt || customer.warrantyEndsAt || "").trim()
        }, index);
        let saved = saveCustomersData(current);
        if (crmStore.isEnabled()) {
          await ensureCrmStoreReady();
          await crmStore.upsertCustomer(current.items[index]);
          await syncCrmDocumentsFromStore();
          saved = await getCustomersDataAsync();
        }
        sendJson(res, 200, { ok: true, customer: getCustomerDetail(current.items[index].id), customers: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/customers/photo" || url.pathname === "/api/customers/photo/")) {
    parseBody(req)
      .then(async (body) => {
        const id = String(body.id || "").trim();
        const current = await getCustomersDataAsync();
        const index = current.items.findIndex((item) => item.id === id);
        if (index < 0) {
          sendJson(res, 404, { error: "Customer not found" });
          return;
        }
        const title = String(body.title || "").trim();
        if (!title) {
          sendJson(res, 400, { error: "Photo title is required" });
          return;
        }
        const imageUrl = saveDataUrlImage(body.dataUrl, `customer-${id}`);
        if (!imageUrl) {
          sendJson(res, 400, { error: "Invalid image data" });
          return;
        }
        const customer = current.items[index];
        current.items[index] = normalizeCustomerRecord({
          ...customer,
          photos: [
            {
              id: `photo-${Date.now()}`,
              title,
              takenAt: String(body.takenAt || new Date().toLocaleString("zh-CN")).trim(),
              imageUrl
            },
            ...(Array.isArray(customer.photos) ? customer.photos : [])
          ]
        }, index);
        let saved = saveCustomersData(current);
        if (crmStore.isEnabled()) {
          await ensureCrmStoreReady();
          await crmStore.upsertCustomer(current.items[index]);
          await syncCrmDocumentsFromStore();
          saved = await getCustomersDataAsync();
        }
        sendJson(res, 200, { ok: true, customer: getCustomerDetail(current.items[index].id), customers: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/inventory/transaction" || url.pathname === "/api/inventory/transaction/")) {
    parseBody(req)
      .then((body) => {
        const current = readJson(INVENTORY_FILE, defaultInventoryData());
        const stockItems = (Array.isArray(current.stockItems) ? current.stockItems : []).map(normalizeInventoryItem);
        const operatorName = String(body.operator || "").trim();
        const operator = getEmployeesData().items.find((item) => item.name === operatorName);
        if (!operator || !["admin", "sales_manager"].includes(operator.role)) {
          sendJson(res, 403, { error: "Only admins and sales managers can perform inventory transactions" });
          return;
        }
        const index = stockItems.findIndex((item) => item.id === String(body.itemId || ""));
        if (index < 0) {
          sendJson(res, 404, { error: "Inventory item not found" });
          return;
        }

        const type = body.type === "inbound" ? "inbound" : "outbound";
        const changeAbs = Math.max(0, Math.round(clampNumber(body.quantity, 0)));
        const signedChange = type === "inbound" ? changeAbs : -changeAbs;
        stockItems[index].quantity = Math.max(0, stockItems[index].quantity + signedChange);
        stockItems[index].status = stockItems[index].quantity <= stockItems[index].threshold ? "low" : "healthy";

        const transactions = Array.isArray(current.transactions) ? current.transactions : [];
        transactions.unshift({
          id: `TR-${Date.now()}`,
          itemId: stockItems[index].id,
          itemName: stockItems[index].name,
          sku: stockItems[index].sku,
          type,
          typeLabel: String(body.typeLabel || (type === "inbound" ? "Inbound - Manual Receipt" : "Outbound - Manual Issue")).trim(),
          quantityChange: signedChange,
          quantityText: String(body.quantityText || (signedChange >= 0 ? `+${signedChange}` : `${signedChange}`)).trim(),
          operator: String(body.operator || "System").trim(),
          referenceNo: String(body.referenceNo || "").trim(),
          notes: String(body.notes || "").trim(),
          timestamp: new Date().toISOString()
        });

        const saved = saveInventoryData({
          shipment: current.shipment || defaultInventoryData().shipment,
          stockItems,
          purchaseOrders: Array.isArray(current.purchaseOrders) ? current.purchaseOrders : [],
          transactions
        });
        sendJson(res, 200, { ok: true, inventory: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/inventory/stocktake" || url.pathname === "/api/inventory/stocktake/")) {
    parseBody(req)
      .then((body) => {
        const current = readJson(INVENTORY_FILE, defaultInventoryData());
        const stockItems = (Array.isArray(current.stockItems) ? current.stockItems : []).map(normalizeInventoryItem);
        const index = stockItems.findIndex((item) => item.id === String(body.itemId || ""));
        if (index < 0) {
          sendJson(res, 404, { error: "Inventory item not found" });
          return;
        }

        const actualQuantity = Math.max(0, Math.round(clampNumber(body.actualQuantity, -1)));
        const previousQuantity = stockItems[index].quantity;
        const delta = actualQuantity - previousQuantity;
        stockItems[index].quantity = actualQuantity;
        stockItems[index].status = stockItems[index].quantity <= stockItems[index].threshold ? "low" : "healthy";

        const transactions = Array.isArray(current.transactions) ? current.transactions : [];
        transactions.unshift({
          id: `ST-${Date.now()}`,
          itemId: stockItems[index].id,
          itemName: stockItems[index].name,
          sku: stockItems[index].sku,
          type: "stocktake",
          typeLabel: "Stocktake Adjustment",
          quantityChange: delta,
          quantityText: `${delta >= 0 ? "+" : ""}${delta} (${previousQuantity} -> ${actualQuantity})`,
          operator: operator.name,
          timestamp: new Date().toISOString()
        });

        const saved = saveInventoryData({
          shipment: current.shipment || defaultInventoryData().shipment,
          stockItems,
          purchaseOrders: Array.isArray(current.purchaseOrders) ? current.purchaseOrders : [],
          transactions
        });
        sendJson(res, 200, { ok: true, inventory: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/inventory/stocktake/batch" || url.pathname === "/api/inventory/stocktake/batch/")) {
    parseBody(req)
      .then((body) => {
        const current = readJson(INVENTORY_FILE, defaultInventoryData());
        const stockItems = (Array.isArray(current.stockItems) ? current.stockItems : []).map(normalizeInventoryItem);
        const transactions = Array.isArray(current.transactions) ? current.transactions : [];
        const rows = Array.isArray(body.rows) ? body.rows : [];
        const operatorName = String(body.operator || "").trim();
        const operator = getEmployeesData().items.find((item) => item.name === operatorName);
        if (!operator || !["admin", "sales_manager"].includes(operator.role)) {
          sendJson(res, 403, { error: "Only admins and sales managers can perform stocktake" });
          return;
        }
        if (!rows.length) {
          sendJson(res, 400, { error: "No stocktake rows provided" });
          return;
        }

        rows.forEach((row, rowIndex) => {
          const index = stockItems.findIndex((item) => item.id === String(row.itemId || ""));
          if (index < 0) return;
          const actualQuantity = Math.max(0, Math.round(clampNumber(row.actualQuantity, -1)));
          const previousQuantity = stockItems[index].quantity;
          const delta = actualQuantity - previousQuantity;
          stockItems[index].quantity = actualQuantity;
          stockItems[index].status = stockItems[index].quantity <= stockItems[index].threshold ? "low" : "healthy";
          transactions.unshift({
            id: `STB-${Date.now()}-${rowIndex + 1}`,
            itemId: stockItems[index].id,
            itemName: stockItems[index].name,
            sku: stockItems[index].sku,
            type: "stocktake",
            typeLabel: "Batch Stocktake Adjustment",
            quantityChange: delta,
            quantityText: `${delta >= 0 ? "+" : ""}${delta} (${previousQuantity} -> ${actualQuantity})`,
            operator: operator.name,
            timestamp: new Date().toISOString()
          });
        });

        const saved = saveInventoryData({
          shipment: current.shipment || defaultInventoryData().shipment,
          stockItems,
          purchaseOrders: Array.isArray(current.purchaseOrders) ? current.purchaseOrders : [],
          transactions
        });
        sendJson(res, 200, { ok: true, inventory: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/inventory/purchase-order" || url.pathname === "/api/inventory/purchase-order/")) {
    parseBody(req)
      .then((body) => {
        const current = readJson(INVENTORY_FILE, defaultInventoryData());
        const stockItems = (Array.isArray(current.stockItems) ? current.stockItems : []).map(normalizeInventoryItem);
        const purchaseOrders = (Array.isArray(current.purchaseOrders) ? current.purchaseOrders : []).map(normalizeInventoryPurchaseOrder);
        const index = stockItems.findIndex((item) => item.id === String(body.itemId || ""));
        if (index < 0) {
          sendJson(res, 404, { error: "Inventory item not found" });
          return;
        }
        const quantity = Math.max(1, Math.round(clampNumber(body.quantity, 0)));
        const unitCostVt = Math.max(0, Math.round(clampNumber(body.unitCostVt, 0)));
        const purchaseOrder = normalizeInventoryPurchaseOrder({
          id: `PO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9000) + 1000}`,
          itemId: stockItems[index].id,
          itemName: stockItems[index].name,
          sku: stockItems[index].sku,
          supplierName: String(body.supplierName || "").trim() || "待填写供应商",
          quantity,
          unitCostVt,
          totalCostVt: quantity * unitCostVt,
          currency: body.currency,
          operator: String(body.operator || "System").trim(),
          etaDate: String(body.etaDate || "").trim(),
          status: "ordered",
          notes: String(body.notes || "").trim(),
          createdAt: new Date().toISOString()
        });
        purchaseOrders.unshift(purchaseOrder);

        const saved = saveInventoryData({
          shipment: current.shipment || defaultInventoryData().shipment,
          stockItems,
          purchaseOrders,
          transactions: Array.isArray(current.transactions) ? current.transactions : []
        });
        sendJson(res, 200, { ok: true, inventory: saved, purchaseOrder });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/repair-order/feedback" || url.pathname === "/api/repair-order/feedback/")) {
    parseBody(req)
      .then((body) => {
        const order = getRepairOrder(body.id || url.searchParams.get("id"));
        const text = String(body.text || "").trim();
        const photoDataUrl = String(body.photoDataUrl || "").trim();
        const imageUrl = photoDataUrl ? saveDataUrlImage(photoDataUrl, "repair-note") : "";
        if (!text && !imageUrl) {
          sendJson(res, 400, { error: "Feedback text or photo is required" });
          return;
        }
        if (text) {
          order.technicianFeedback = text;
        }
        order.notes = [
          {
            id: `note-${Date.now()}`,
            text,
            imageUrl,
            status: order.status,
            createdAt: new Date().toISOString()
          },
          ...(order.notes || [])
        ];
        const saved = saveRepairOrder(order);
        sendJson(res, 200, { ok: true, order: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/employees" || url.pathname === "/api/employees/")) {
    parseBody(req)
      .then(async (body) => {
        const current = getEmployeesData();
        const nextEmployee = normalizeEmployee(body.employee || body, current.items.length);
        const exists = current.items.some((item) => item.id === nextEmployee.id || item.employeeNo === nextEmployee.employeeNo);
        if (exists) {
          sendJson(res, 400, { error: "Employee already exists" });
          return;
        }
        current.items.unshift(nextEmployee);
        const saved = saveEmployeesData(current);
        if (businessStore.isEnabled()) {
          await ensureBusinessStoreReady();
          await businessStore.upsertEmployee(nextEmployee);
          await businessStore.saveEmployeeMeta("monthly_trend", saved.monthlyTrend || []);
          await syncBusinessDocumentsFromStore();
        }
        sendJson(res, 200, { ok: true, item: nextEmployee, employees: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/employees/update" || url.pathname === "/api/employees/update/")) {
    parseBody(req)
      .then(async (body) => {
        const current = getEmployeesData();
        const id = String(body.id || body.employee?.id || "").trim();
        const index = current.items.findIndex((item) => item.id === id);
        if (index < 0) {
          sendJson(res, 404, { error: "Employee not found" });
          return;
        }
        current.items[index] = normalizeEmployee({
          ...current.items[index],
          ...(body.employee || body),
          id: current.items[index].id
        }, index);
        const saved = saveEmployeesData(current);
        if (businessStore.isEnabled()) {
          await ensureBusinessStoreReady();
          await businessStore.upsertEmployee(saved.items[index]);
          await businessStore.saveEmployeeMeta("monthly_trend", saved.monthlyTrend || []);
          await syncBusinessDocumentsFromStore();
        }
        sendJson(res, 200, { ok: true, item: saved.items[index], employees: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/employees/delete" || url.pathname === "/api/employees/delete/")) {
      parseBody(req)
        .then(async (body) => {
          const id = String(body.id || "").trim();
          const current = getEmployeesData();
          const index = current.items.findIndex((item) => item.id === id);
          if (index < 0) {
            sendJson(res, 404, { error: "Employee not found" });
            return;
          }
          current.items[index] = normalizeEmployee({
            ...current.items[index],
            status: "resigned",
            statusLabel: getEmployeeStatusLabel("resigned"),
            resignedAt: String(body.resignedAt || new Date().toISOString().slice(0, 10)).trim()
          }, index);
          const saved = saveEmployeesData(current);
          if (businessStore.isEnabled()) {
            await ensureBusinessStoreReady();
            await businessStore.upsertEmployee(saved.items[index]);
            await businessStore.saveEmployeeMeta("monthly_trend", saved.monthlyTrend || []);
            await syncBusinessDocumentsFromStore();
          }
          sendJson(res, 200, { ok: true, item: saved.items[index], employees: saved });
        })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/customers/order/archive" || url.pathname === "/api/customers/order/archive/")) {
    parseBody(req)
      .then(async (body) => {
        const customerId = String(body.customerId || body.id || "").trim();
        const orderId = String(body.orderId || "").trim();
        const current = await getCustomersDataAsync();
        const customerIndex = current.items.findIndex((item) => item.id === customerId);
        if (customerIndex < 0) {
          sendJson(res, 404, { error: "Customer not found" });
          return;
        }
        const orders = Array.isArray(current.items[customerIndex].orders) ? current.items[customerIndex].orders : [];
        const orderIndex = orders.findIndex((item) => item.id === orderId);
        if (orderIndex < 0) {
          sendJson(res, 404, { error: "Order not found" });
          return;
        }
        orders[orderIndex] = normalizeCustomerOrder({
          ...orders[orderIndex],
          archived: true,
          archivedAt: new Date().toISOString(),
          archiveReason: String(body.archiveReason || "manual_archive").trim()
        }, orderIndex);
        current.items[customerIndex] = normalizeCustomerRecord({
          ...current.items[customerIndex],
          orders
        }, customerIndex);
        let saved = saveCustomersData({ items: current.items });
        if (crmStore.isEnabled()) {
          await ensureCrmStoreReady();
          await crmStore.upsertCustomer(current.items[customerIndex]);
          await syncCrmDocumentsFromStore();
          saved = await getCustomersDataAsync();
        }
        sendJson(res, 200, { ok: true, archived: true, customer: saved.items[customerIndex] });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/customers" || url.pathname === "/api/customers/")) {
    parseBody(req)
      .then(async (body) => {
        const current = await getCustomersDataAsync();
        const nextCustomer = normalizeCustomerRecord(body.customer || body, current.items.length);
        const exists = current.items.some((item) => item.id === nextCustomer.id || item.archiveNo === nextCustomer.archiveNo);
        if (exists) {
          sendJson(res, 400, { error: "Customer already exists" });
          return;
        }
        current.items.unshift(nextCustomer);
        let saved = saveCustomersData(current);
        if (crmStore.isEnabled()) {
          await ensureCrmStoreReady();
          await crmStore.upsertCustomer(nextCustomer);
          await syncCrmDocumentsFromStore();
          saved = await getCustomersDataAsync();
        }
        sendJson(res, 200, { ok: true, customer: nextCustomer, customers: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/customers/update" || url.pathname === "/api/customers/update/")) {
    parseBody(req)
      .then(async (body) => {
        const current = await getCustomersDataAsync();
        const id = String(body.id || body.customer?.id || "").trim();
        const index = current.items.findIndex((item) => item.id === id);
        if (index < 0) {
          sendJson(res, 404, { error: "Customer not found" });
          return;
        }
        current.items[index] = normalizeCustomerRecord({
          ...current.items[index],
          ...(body.customer || body),
          id: current.items[index].id
        }, index);
        let saved = saveCustomersData(current);
        if (crmStore.isEnabled()) {
          await ensureCrmStoreReady();
          await crmStore.upsertCustomer(current.items[index]);
          await syncCrmDocumentsFromStore();
          saved = await getCustomersDataAsync();
        }
        sendJson(res, 200, { ok: true, customer: saved.items[index], customers: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/customers/delete" || url.pathname === "/api/customers/delete/")) {
    parseBody(req)
      .then(async (body) => {
        const id = String(body.id || "").trim();
        const current = await getCustomersDataAsync();
        const index = current.items.findIndex((item) => item.id === id);
        if (index < 0) {
          sendJson(res, 404, { error: "Customer not found" });
          return;
        }
        current.items[index] = normalizeCustomerRecord({
          ...current.items[index],
          archived: true,
          archivedAt: new Date().toISOString(),
          archiveReason: String(body.archiveReason || "manual_archive").trim()
        }, index);
        let saved = saveCustomersData({ items: current.items });
        if (crmStore.isEnabled()) {
          await ensureCrmStoreReady();
          await crmStore.upsertCustomer(current.items[index]);
          await syncCrmDocumentsFromStore();
          saved = await getCustomersDataAsync();
        }
        sendJson(res, 200, { ok: true, archived: true, customer: saved.items[index], customers: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/security/employee" || url.pathname === "/api/security/employee/")) {
    parseBody(req)
      .then((body) => {
        const employee = findEmployeeById(body.employeeId);
        if (!employee) {
          sendJson(res, 404, { error: "Employee not found" });
          return;
        }
        const current = getSecurityData();
        const nextItem = normalizeRbacAccess({
          employeeId: employee.id,
          roleOverride: body.roleOverride || employee.role,
          branchScope: body.branchScope || employee.branch,
          accessEnabled: body.accessEnabled,
          securityLevel: body.securityLevel
        }, current.employeeAccess.length);
        const index = current.employeeAccess.findIndex((item) => item.employeeId === employee.id);
        if (index >= 0) {
          current.employeeAccess[index] = { ...current.employeeAccess[index], ...nextItem };
        } else {
          current.employeeAccess.unshift(nextItem);
        }
        current.auditLogs.unshift({
          id: `audit-${Date.now()}`,
          action: `更新员工权限：${employee.name}`,
          actor: "管理员",
          createdAt: new Date().toISOString()
        });
        const saved = saveSecurityData(current);
        sendJson(res, 200, { ok: true, security: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/security/module" || url.pathname === "/api/security/module/")) {
    parseBody(req)
      .then((body) => {
        const current = getSecurityData();
        const index = current.moduleMatrix.findIndex((item) => item.key === String(body.key || ""));
        if (index < 0) {
          sendJson(res, 404, { error: "Module permission not found" });
          return;
        }
        current.moduleMatrix[index].enabled = Boolean(body.enabled);
        current.auditLogs.unshift({
          id: `audit-${Date.now()}`,
          action: `更新模块权限：${current.moduleMatrix[index].label}`,
          actor: "管理员",
          createdAt: new Date().toISOString()
        });
        const saved = saveSecurityData(current);
        sendJson(res, 200, { ok: true, security: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/security/ip" || url.pathname === "/api/security/ip/")) {
    parseBody(req)
      .then((body) => {
        const current = getSecurityData();
        const nextIp = normalizeRbacIp(body.ip || body, current.ipWhitelist.length);
        const index = current.ipWhitelist.findIndex((item) => item.id === nextIp.id);
        if (index >= 0) {
          current.ipWhitelist[index] = { ...current.ipWhitelist[index], ...nextIp };
        } else {
          current.ipWhitelist.unshift(nextIp);
        }
        current.auditLogs.unshift({
          id: `audit-${Date.now()}`,
          action: `更新 IP 白名单：${nextIp.label}`,
          actor: "管理员",
          createdAt: new Date().toISOString()
        });
        const saved = saveSecurityData(current);
        sendJson(res, 200, { ok: true, security: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/security/emergency" || url.pathname === "/api/security/emergency/")) {
    parseBody(req)
      .then((body) => {
        const current = getSecurityData();
        const enabled = Boolean(body.enabled);
        current.emergencyLocked = enabled;
        current.employeeAccess = current.employeeAccess.map((item) => ({
          ...item,
          accessEnabled: item.roleOverride === "admin" ? true : !enabled
        }));
        current.auditLogs.unshift({
          id: `audit-${Date.now()}`,
          action: enabled ? "启用紧急系统封锁" : "解除紧急系统封锁",
          actor: "管理员",
          createdAt: new Date().toISOString()
        });
        const saved = saveSecurityData(current);
        sendJson(res, 200, { ok: true, security: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/repair-order/complete" || url.pathname === "/api/repair-order/complete/")) {
    parseBody(req)
      .then((body) => {
        const order = getRepairOrder(body.id || url.searchParams.get("id"));
        const text = String(body.text || "").trim();
        const photoDataUrl = String(body.photoDataUrl || "").trim();
        const imageUrl = saveDataUrlImage(photoDataUrl, "repair-complete");
        if (!imageUrl) {
          sendJson(res, 400, { error: "Completion photo is required" });
          return;
        }
        order.status = "completed";
        order.statusLabel = formatRepairStatusLabel("completed");
        if (text) {
          order.technicianFeedback = text;
        }
        order.notes = [
          {
            id: `note-${Date.now()}`,
            text: text || "Engineer marked this repair as completed.",
            imageUrl,
            status: "completed",
            createdAt: new Date().toISOString()
          },
          ...(order.notes || [])
        ];
        order.timeline = refreshRepairTimeline(order.timeline, createRepairTimelineEntry("completed"));
        const saved = saveRepairOrder(order);
        sendJson(res, 200, { ok: true, order: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/repair-order/status" || url.pathname === "/api/repair-order/status/")) {
    parseBody(req)
      .then((body) => {
        const nextStatus = ["pending", "in_progress", "completed"].includes(body.status) ? body.status : "";
        if (!nextStatus) {
          sendJson(res, 400, { error: "Valid status is required" });
          return;
        }
        const order = getRepairOrder(body.id || url.searchParams.get("id"));
        const text = String(body.text || "").trim();
        const photoDataUrl = String(body.photoDataUrl || "").trim();
        const imageUrl = photoDataUrl ? saveDataUrlImage(photoDataUrl, "repair-status") : "";
        if (nextStatus === "completed" && !imageUrl) {
          sendJson(res, 400, { error: "Completion photo is required" });
          return;
        }

        order.status = nextStatus;
        order.statusLabel = formatRepairStatusLabel(nextStatus);
        if (text) {
          order.technicianFeedback = text;
        }
        order.timeline = refreshRepairTimeline(order.timeline, createRepairTimelineEntry(nextStatus));
        if (text || imageUrl) {
          order.notes = [
            {
              id: `note-${Date.now()}`,
              text: text || `Engineer updated status to ${order.statusLabel}.`,
              imageUrl,
              status: nextStatus,
              createdAt: new Date().toISOString()
            },
            ...(order.notes || [])
          ];
        }
        const saved = saveRepairOrder(order);
        sendJson(res, 200, { ok: true, order: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/repair-orders" || url.pathname === "/api/repair-orders/")) {
    parseBody(req)
      .then((body) => {
        const order = createRepairOrder(body);
        const saved = saveRepairOrder(order);
        applyRepairSparePartDeduction(saved);
        sendJson(res, 200, { ok: true, order: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/repair-orders/update" || url.pathname === "/api/repair-orders/update/")) {
    parseBody(req)
      .then((body) => {
        const existing = getRepairOrder(body.id);
        if (!existing?.id) {
          sendJson(res, 404, { error: "Repair order not found" });
          return;
        }
        existing.title = String(body.title || existing.title).trim();
        existing.description = String(body.description || existing.description).trim();
        existing.priority = ["P1", "P2", "P3"].includes(String(body.priority || "").trim().toUpperCase())
          ? String(body.priority).trim().toUpperCase()
          : existing.priority;
        existing.priorityLabel = existing.priority === "P1" ? "Urgent (P1)" : existing.priority === "P3" ? "Low (P3)" : "Normal (P2)";
        if (body.etaDate || body.etaTime) {
          existing.etaLabel = [String(body.etaDate || "").trim(), String(body.etaTime || "").trim()].filter(Boolean).join(" ") || existing.etaLabel;
        }
        const saved = saveRepairOrder(existing);
        sendJson(res, 200, { ok: true, order: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/repair-orders/reassign" || url.pathname === "/api/repair-orders/reassign/")) {
    parseBody(req)
      .then((body) => {
        const existing = getRepairOrder(body.id);
        if (!existing?.id) {
          sendJson(res, 404, { error: "Repair order not found" });
          return;
        }
        const selectedEngineer = findEmployeeById(body.engineerId);
        const nextName = String(body.engineerName || selectedEngineer?.name || "").trim();
        if (!nextName) {
          sendJson(res, 400, { error: "Engineer is required" });
          return;
        }
        existing.assignedEngineer = {
          id: selectedEngineer?.id || `manual-${Date.now()}`,
          name: nextName,
          role: selectedEngineer?.roleLabel || existing.assignedEngineer?.role || "Field Engineer"
        };
        existing.timeline = refreshRepairTimeline(existing.timeline, {
          id: `timeline-${Date.now()}`,
          timeLabel: new Date().toLocaleString("en-US"),
          title: "Engineer reassigned",
          detail: `Assigned engineer: ${nextName}`,
          type: "current"
        });
        const saved = saveRepairOrder(existing);
        sendJson(res, 200, { ok: true, order: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/repair-orders/delete" || url.pathname === "/api/repair-orders/delete/")) {
    parseBody(req)
      .then((body) => {
        const id = String(body.id || "").trim();
        const items = getRepairOrders().filter((item) => item.id !== id);
        saveRepairOrders(items.length ? items : [defaultRepairOrder()]);
        sendJson(res, 200, { ok: true });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/site-survey/book" || url.pathname === "/api/site-survey/book/")) {
    parseBody(req)
      .then((body) => {
        const current = getSurveyData();
        const sitePhotos = Array.isArray(body.sitePhotos) ? body.sitePhotos.map((item, index) => {
          const photo = String(item || "").trim();
          if (!photo.startsWith("data:image/")) return "";
          return saveDataUrlImage(photo, `survey-${index + 1}`);
        }).filter(Boolean) : [];
        const booking = normalizeSurveyBooking({
          id: `SV-${Date.now()}`,
          island: body.island,
          preferredDate: body.preferredDate,
          preferredTime: body.preferredTime,
          latitude: body.latitude,
          longitude: body.longitude,
          status: "review",
          sitePhotos,
          customer: body.customer
        }, current.bookings.length);
        current.bookings.unshift(booking);
        const saved = saveSurveyData(current);
        sendJson(res, 200, { ok: true, booking, bookings: saved.bookings });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
      return true;
    }

  if (req.method === "POST" && (url.pathname === "/api/site-survey/review" || url.pathname === "/api/site-survey/review/")) {
      parseBody(req)
        .then((body) => {
          const bookingId = String(body.id || "").trim();
          if (!bookingId) {
            sendJson(res, 400, { error: "Booking id is required" });
            return;
          }

          const current = getSurveyData();
          const bookingIndex = current.bookings.findIndex((item) => item.id === bookingId);
          if (bookingIndex < 0) {
            sendJson(res, 404, { error: "Survey booking not found" });
            return;
          }

          const nextStatus = ["review", "confirmed", "scheduled", "completed", "rejected"].includes(body.status)
              ? body.status
              : current.bookings[bookingIndex].status;
          const currentBooking = current.bookings[bookingIndex];
          let nextScheduleTask = currentBooking.scheduleTask;

          if (nextStatus === "confirmed" || nextStatus === "scheduled") {
            nextScheduleTask = {
              id: String(currentBooking.scheduleTask?.id || `SCH-${bookingId}`).trim(),
              status: nextStatus === "scheduled" ? "scheduled" : "pending",
              notes: String(body.scheduleNotes || body.reviewNotes || currentBooking.scheduleTask?.notes || "").trim(),
              createdAt: String(currentBooking.scheduleTask?.createdAt || new Date().toISOString()).trim(),
              updatedAt: new Date().toISOString()
            };
          } else if (nextStatus === "rejected" && currentBooking.scheduleTask) {
            nextScheduleTask = {
              ...currentBooking.scheduleTask,
              status: "on_hold",
              notes: String(body.scheduleNotes || body.reviewNotes || currentBooking.scheduleTask.notes || "").trim(),
              updatedAt: new Date().toISOString()
            };
          } else if (nextStatus === "completed" && currentBooking.scheduleTask) {
            nextScheduleTask = {
              ...currentBooking.scheduleTask,
              status: "completed",
              updatedAt: new Date().toISOString()
            };
          }

          current.bookings[bookingIndex] = normalizeSurveyBooking({
            ...currentBooking,
            status: nextStatus,
            reviewNotes: body.reviewNotes,
            reviewChecklist: {
              photosOk: body.reviewChecklist?.photosOk,
              gpsOk: body.reviewChecklist?.gpsOk,
              contactOk: body.reviewChecklist?.contactOk
            },
            reviewedBy: body.reviewedBy || currentBooking.reviewedBy || "Survey Desk",
            reviewedAt: new Date().toISOString(),
            scheduleTask: nextScheduleTask
          }, bookingIndex);

          const saved = saveSurveyData(current);
          const booking = saved.bookings.find((item) => item.id === bookingId) || saved.bookings[bookingIndex];
          sendJson(res, 200, { ok: true, booking, bookings: saved.bookings, scheduleQueue: saved.scheduleQueue });
        })
        .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
        return true;
      }

  if (req.method === "POST" && (url.pathname === "/api/site-survey/schedule" || url.pathname === "/api/site-survey/schedule/")) {
      parseBody(req)
        .then((body) => {
          const bookingId = String(body.id || "").trim();
          if (!bookingId) {
            sendJson(res, 400, { error: "Booking id is required" });
            return;
          }

          const current = getSurveyData();
          const bookingIndex = current.bookings.findIndex((item) => item.id === bookingId);
          if (bookingIndex < 0) {
            sendJson(res, 404, { error: "Survey booking not found" });
            return;
          }

          const engineer = findEmployeeById(body.engineerId);
          if (!engineer || engineer.role !== "engineer") {
            sendJson(res, 400, { error: "Valid engineer is required" });
            return;
          }

          const currentBooking = current.bookings[bookingIndex];
          const visitDate = String(body.visitDate || "").trim();
          const visitTime = String(body.visitTime || "").trim();
          if (!visitDate || !visitTime) {
            sendJson(res, 400, { error: "Visit date and time are required" });
            return;
          }

          current.bookings[bookingIndex] = normalizeSurveyBooking({
            ...currentBooking,
            status: "scheduled",
            scheduleTask: {
              id: String(currentBooking.scheduleTask?.id || `SCH-${bookingId}`).trim(),
              status: "scheduled",
              notes: String(body.notes || currentBooking.scheduleTask?.notes || currentBooking.reviewNotes || "").trim(),
              engineerId: engineer.id,
              engineerName: engineer.name,
              visitDate,
              visitTime,
              createdAt: String(currentBooking.scheduleTask?.createdAt || new Date().toISOString()).trim(),
              updatedAt: new Date().toISOString()
            }
          }, bookingIndex);

          const saved = saveSurveyData(current);
          const booking = saved.bookings.find((item) => item.id === bookingId) || saved.bookings[bookingIndex];
          sendJson(res, 200, { ok: true, booking, bookings: saved.bookings, scheduleQueue: saved.scheduleQueue });
        })
        .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
      return true;
    }

  if (req.method === "GET" && url.pathname === "/api/catalog") {
    const productConfig = getProductConfig();
    sendJson(res, 200, {
      categories: applianceCategories,
      presets: presetAppliances,
      settings: {
        ...getSettings(),
        vatRate: productConfig.vatRate
      },
      packages: productConfig.packages.filter((item) => item.status === "active").map((item) => item.name),
      wholesalePackages: productConfig.packages
        .filter((item) => item.status === "active")
        .map((item) => ({ id: item.id, name: item.name, wholesaleVt: item.wholesaleVt, retailVt: item.retailVt }))
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/product-config") {
    sendJson(res, 200, { ok: true, ...getProductConfig() });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/settings" || url.pathname === "/api/settings/")) {
    sendJson(res, 200, {
      ok: true,
      settings: getSettings(),
      backups: getBackupHistory()
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/product-config/package") {
    parseBody(req)
      .then((body) => {
        const current = getProductConfig();
        const nextPackage = normalizePackage(body.package || body, current.packages.length);
        const existingIndex = current.packages.findIndex((item) => item.id === nextPackage.id);
        if (existingIndex >= 0) {
          current.packages[existingIndex] = { ...current.packages[existingIndex], ...nextPackage };
        } else {
          current.packages.push(nextPackage);
        }
        const saved = saveProductConfig(current);
        const item = saved.packages.find((pkg) => pkg.id === nextPackage.id);
        sendJson(res, 200, { ok: true, item, config: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/product-config/vat") {
    parseBody(req)
      .then((body) => {
        const current = getProductConfig();
        current.vatRate = Math.max(0, Number(clampNumber(body.vatRate, current.vatRate)).toFixed(2));
        const saved = saveProductConfig(current);
        sendJson(res, 200, { ok: true, vatRate: saved.vatRate, config: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/product-config/discount") {
    parseBody(req)
      .then((body) => {
        const current = getProductConfig();
        const nextDiscount = normalizeDiscount(body.discount || body, current.discounts.length);
        const existingIndex = current.discounts.findIndex((item) => item.id === nextDiscount.id);
        if (existingIndex >= 0) {
          current.discounts[existingIndex] = { ...current.discounts[existingIndex], ...nextDiscount };
        } else {
          current.discounts.unshift(nextDiscount);
        }
        const saved = saveProductConfig(current);
        sendJson(res, 200, { ok: true, item: nextDiscount, config: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/product-config/discount/toggle") {
    parseBody(req)
      .then((body) => {
        const current = getProductConfig();
        const index = current.discounts.findIndex((item) => item.id === String(body.id || ""));
        if (index < 0) {
          sendJson(res, 404, { error: "Discount not found" });
          return;
        }
        current.discounts[index].active = Boolean(body.active);
        const saved = saveProductConfig(current);
        sendJson(res, 200, { ok: true, item: saved.discounts[index], config: saved });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/settings")) {
    parseBody(req)
      .then((body) => {
        const nextSettings = buildSystemSettings(body);
        writeJson(SETTINGS_FILE, nextSettings);
        writeJson(COMPANY_FILE, nextSettings.company || defaultCompanyProfile());
        if (configStore.isEnabled()) {
          configStore.saveSettings(nextSettings).catch((error) => {
            console.error("[settings] Failed to persist config store:", error);
          });
          configStore.saveCompanyProfile(nextSettings.company || defaultCompanyProfile()).catch((error) => {
            console.error("[company-profile] Failed to persist config store:", error);
          });
        }
        sendJson(res, 200, { ok: true, settings: getSettings(), backups: getBackupHistory() });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/backups/create" || url.pathname === "/api/backups/create/")) {
    parseBody(req)
      .then(async (body) => {
        const created = await createBackupSnapshot(String(body.trigger || "manual").trim() || "manual", body.notes || "");
        sendJson(res, 200, { ok: true, item: created.item, backups: created.history });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && (url.pathname === "/api/backups/restore" || url.pathname === "/api/backups/restore/")) {
    parseBody(req)
      .then(async (body) => {
        const restored = await restoreBackupSnapshot(body.id);
        if (restored.error) {
          sendJson(res, 404, { error: restored.error });
          return;
        }
        sendJson(res, 200, { ok: true, item: restored.item, settings: getSettings(), backups: getBackupHistory() });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/backups/download" || url.pathname === "/api/backups/download/")) {
    const history = getBackupHistory();
    const item = history.find((entry) => entry.id === String(url.searchParams.get("id") || "").trim());
    if (!item) {
      sendJson(res, 404, { error: "Backup not found" });
      return true;
    }
    const filePath = path.join(BACKUPS_DIR, item.filename);
    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: "Backup file missing" });
      return true;
    }
    sendDownload(res, 200, "application/json; charset=utf-8", item.filename, fs.readFileSync(filePath));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/saved-quotes") {
    if (businessStore.isEnabled()) {
      syncBusinessDocumentsFromStore().catch((error) => {
        console.error("[saved-quotes:sync] failed:", error);
      });
    }
    sendJson(res, 200, { items: readJson(SAVES_FILE, []).slice(-20).reverse() });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/invoices") {
    Promise.resolve(getInvoicesDataAsync())
      .then((items) => sendJson(res, 200, { items }))
      .catch((error) => {
        console.error("[invoices:list] failed:", error);
        sendJson(res, 500, { error: "发票数据读取失败" });
      });
    return true;
  }

  if (req.method === "GET" && (url.pathname === "/api/dashboard" || url.pathname === "/api/dashboard/")) {
    sendJson(res, 200, { ok: true, ...getDashboardData() });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/saved-quotes/status") {
    parseBody(req)
      .then(async (body) => {
        const allowedStatuses = new Set(["draft", "sent", "paid", "in_progress"]);
        const items = readJson(SAVES_FILE, []);
        const index = items.findIndex((item) => item.id === String(body.id || ""));
        if (index < 0) {
          sendJson(res, 404, { error: "Quote not found" });
          return;
        }
        items[index].status = allowedStatuses.has(body.status) ? body.status : "draft";
        writeJson(SAVES_FILE, items);
        if (businessStore.isEnabled()) {
          await ensureBusinessStoreReady();
          await businessStore.upsertQuote(items[index]);
          await syncBusinessDocumentsFromStore();
        }
        sendJson(res, 200, { ok: true, item: items[index] });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/calculate") {
    parseBody(req)
      .then((body) => sendJson(res, 200, calculateSizing(body.devices, body.location, body.customer, body.selectedPackageName)))
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/save-quote") {
    parseBody(req)
        .then(async (body) => {
          const items = readJson(SAVES_FILE, []);
          const installmentPlan = normalizeInstallmentPlan(body.installmentPlan, body.quote?.displayTotal || 0);
          const savedRecord = {
            id: `${Date.now()}`,
            customer: normalizeCustomer(body.customer),
            location: body.location || "Port Vila",
            salesPersonId: String(body.salesPerson?.id || body.salesPersonId || "").trim(),
            salesPersonName: String(body.salesPerson?.name || body.salesPersonName || "").trim(),
            salesPersonRole: String(body.salesPerson?.roleLabel || body.salesPersonRole || "").trim(),
            packageName: body.recommendation?.packageName || "",
            total: body.quote?.displayTotal || 0,
            dailyWh: body.metrics?.dailyWh || 0,
            installmentPlan,
            status: "draft",
            createdAt: new Date().toISOString(),
            payload: body
          };
          items.push(savedRecord);
          writeJson(SAVES_FILE, items);
          if (businessStore.isEnabled()) {
            await ensureBusinessStoreReady();
            await businessStore.upsertQuote(savedRecord);
            await syncBusinessDocumentsFromStore();
          }
          syncCustomerInstallmentFromQuote(savedRecord);
          sendJson(res, 200, { ok: true, item: savedRecord });
        })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/invoices") {
    parseBody(req)
      .then(async (body) => {
        const sourcePayload = body.payload && typeof body.payload === "object" ? body.payload : body;
        const sourceCustomer = normalizeCustomer(body.customer || sourcePayload.customer || {});
        const sourceQuote = sourcePayload.quote && typeof sourcePayload.quote === "object" ? sourcePayload.quote : {};
        const sourceRecommendation = sourcePayload.recommendation && typeof sourcePayload.recommendation === "object" ? sourcePayload.recommendation : {};
        const items = await getInvoicesDataAsync();
        const nextItem = normalizeInvoiceRecord({
          id: `invoice-${Date.now()}`,
          invoiceNo: `INV-${String(Date.now()).slice(-8)}`,
          quoteId: String(body.quoteId || sourcePayload.id || "").trim(),
          customer: sourceCustomer,
          packageName: body.packageName || sourceRecommendation.packageName || "",
          amount: body.amount || sourceQuote.displayTotal || sourceQuote.total || 0,
          status: "issued",
          issuedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          salesPersonName: body.salesPersonName || sourcePayload.salesPersonName || sourcePayload.salesPerson?.name || "",
          payload: sanitizeInvoicePayload(sourcePayload)
        }, items.length);
        let savedItems = saveInvoicesData([nextItem, ...items]);
        if (crmStore.isEnabled()) {
          await ensureCrmStoreReady();
          await crmStore.upsertInvoice(nextItem);
          await syncCrmDocumentsFromStore();
          savedItems = await getInvoicesDataAsync();
        }
        sendJson(res, 200, { ok: true, item: savedItems.find((item) => item.id === nextItem.id) || savedItems[0] });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/invoices/update") {
    parseBody(req)
      .then(async (body) => {
        const invoiceId = String(body.id || "").trim();
        if (!invoiceId) {
          sendJson(res, 400, { error: "Invoice id is required" });
          return;
        }

        const items = await getInvoicesDataAsync();
        const index = items.findIndex((item) => item.id === invoiceId);
        if (index < 0) {
          sendJson(res, 404, { error: "Invoice not found" });
          return;
        }

        const current = items[index];
        const nextPayload = current.payload && typeof current.payload === "object"
          ? JSON.parse(JSON.stringify(current.payload))
          : {};
        const nextCustomer = normalizeCustomer({
          ...(current.customer || {}),
          ...(nextPayload.customer || {}),
          name: body.customerName ?? current.customerName,
          phone: body.customerPhone ?? current.customerPhone,
          email: body.customerEmail ?? current.customerEmail,
          address: body.customerAddress ?? current.customerAddress
        });

        nextPayload.customer = nextCustomer;
        nextPayload.note = String(body.note ?? current.note ?? nextPayload.note ?? "").trim();

        if (nextPayload.recommendation && typeof nextPayload.recommendation === "object" && body.packageName !== undefined) {
          nextPayload.recommendation.packageName = String(body.packageName || "").trim();
        }

        if (nextPayload.quote && typeof nextPayload.quote === "object" && body.amount !== undefined) {
          const nextAmount = Math.max(0, Math.round(clampNumber(body.amount, current.amount || 0)));
          nextPayload.quote.displayTotal = nextAmount;
          nextPayload.quote.total = nextAmount;
        }

        items[index] = normalizeInvoiceRecord({
          ...current,
          invoiceNo: String(body.invoiceNo || current.invoiceNo || "").trim(),
          customer: nextCustomer,
          customerName: nextCustomer.name || current.customerName,
          customerPhone: nextCustomer.phone || current.customerPhone,
          customerEmail: nextCustomer.email || current.customerEmail,
          customerAddress: nextCustomer.address || current.customerAddress,
          packageName: String(body.packageName || current.packageName || "").trim(),
          salesPersonName: String(body.salesPersonName || current.salesPersonName || "").trim(),
          amount: Math.max(0, Math.round(clampNumber(body.amount, current.amount || 0))),
          status: String(body.status || current.status || "issued").trim(),
          issuedAt: body.issuedAt ? new Date(`${String(body.issuedAt).trim()}T00:00:00`).toISOString() : current.issuedAt,
          note: String(body.note || current.note || "").trim(),
          payload: nextPayload
        }, index);

        let savedItems = saveInvoicesData(items);
        if (crmStore.isEnabled()) {
          await ensureCrmStoreReady();
          await crmStore.upsertInvoice(items[index]);
          await syncCrmDocumentsFromStore();
          savedItems = await getInvoicesDataAsync();
        }
        const savedItem = savedItems.find((item) => item.id === invoiceId) || savedItems[0];
        sendJson(res, 200, { ok: true, item: savedItem });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  // Field tracking: append point
  if (req.method === "POST" && url.pathname === "/api/field-tracks/point") {
    parseBody(req)
      .then(async (body) => {
        const userId = String(body.userId || "").trim();
        const auth = getCheckinAuth(req, userId);
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        const accuracy = Number(body.accuracy || 0);
        const ts = body.ts ? new Date(body.ts) : new Date();
        if (!auth) {
          sendJson(res, 401, { error: "请先登录当前账号" });
          return;
        }
        if (!userId || (attendanceSettings.requireLocation && (Number.isNaN(lat) || Number.isNaN(lng)))) {
          sendJson(res, 400, { error: "缺少 userId 或坐标" });
          return;
        }
        const dateKey = getBusinessTimeParts(ts).dateKey;
        let track;
        if (fieldStore.isEnabled()) {
          await ensureFieldStoreReady();
          track = await fieldStore.appendTrackPoint({
            userId,
            dateKey,
            startedAt: ts.toISOString(),
            point: { lat, lng, accuracy, ts: ts.toISOString() }
          });
          await syncFieldDocumentsFromStore();
        } else {
          const tracks = readJson(FIELD_TRACKS_FILE, []);
          track = tracks.find((t) => t.userId === userId && t.date === dateKey);
          if (!track) {
            track = { id: `trk-${Date.now()}`, userId, date: dateKey, startedAt: ts.toISOString(), endedAt: "", points: [] };
            tracks.push(track);
          }
          track.points.push({ lat, lng, accuracy, ts: ts.toISOString() });
          writeJson(FIELD_TRACKS_FILE, tracks);
        }
        sendJson(res, 200, { ok: true, track });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  // Field tracking: close session
  if (req.method === "POST" && url.pathname === "/api/field-tracks/close") {
    parseBody(req)
      .then(async (body) => {
        const userId = String(body.userId || "").trim();
        const auth = getCheckinAuth(req, userId);
        const dateKey = String(body.date || "").trim() || getBusinessTimeParts(new Date()).dateKey;
        if (!auth) {
          sendJson(res, 401, { error: "请先登录当前账号" });
          return;
        }
        if (!userId) {
          sendJson(res, 400, { error: "缺少 userId" });
          return;
        }
        let track = null;
        if (fieldStore.isEnabled()) {
          await ensureFieldStoreReady();
          track = await fieldStore.closeTrack({ userId, dateKey, endedAt: new Date().toISOString() });
          await syncFieldDocumentsFromStore();
        } else {
          const tracks = readJson(FIELD_TRACKS_FILE, []);
          track = tracks.find((t) => t.userId === userId && t.date === dateKey);
          if (track) {
            track.endedAt = new Date().toISOString();
            writeJson(FIELD_TRACKS_FILE, tracks);
          }
        }
        sendJson(res, 200, { ok: true, track });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  // Field tracking: query
  if (req.method === "GET" && url.pathname === "/api/field-tracks") {
    const userId = String(url.searchParams.get("user") || "").trim();
    const dateKey = String(url.searchParams.get("date") || "").trim();
    Promise.resolve(getFieldTracksData({ userId, dateKey }))
      .then((items) => sendJson(res, 200, { items }))
      .catch((error) => {
        console.error("[field-tracks] failed:", error);
        sendJson(res, 500, { error: "轨迹记录读取失败" });
      });
    return true;
  }

  // Field visit: add
  if (req.method === "POST" && url.pathname === "/api/field-visits") {
    parseBody(req)
      .then(async (body) => {
        const userId = String(body.userId || "").trim();
        const auth = getCheckinAuth(req, userId);
        const customer = String(body.customer || "").trim();
        const note = String(body.note || "").trim();
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        const accuracy = Number(body.accuracy || 0);
        const audioUrl = String(body.audioUrl || "").trim();
        const address = String(body.address || "").trim();
        const photoUrls = Array.isArray(body.photoUrls)
          ? body.photoUrls.map((item) => String(item || "").trim()).filter(Boolean)
          : [];
        if (!auth) {
          sendJson(res, 401, { error: "请先登录当前账号" });
          return;
        }
        if (!userId || !customer) {
          sendJson(res, 400, { error: "缺少 userId 或客户名称" });
          return;
        }
        const item = {
          id: `visit-${Date.now()}`,
          userId,
          customer,
          note,
          lat: Number.isNaN(lat) ? null : lat,
          lng: Number.isNaN(lng) ? null : lng,
          accuracy,
          address,
          audioUrl,
          photoUrls,
          recordedAt: new Date().toISOString()
        };
        if (fieldStore.isEnabled()) {
          await ensureFieldStoreReady();
          await fieldStore.addVisit(item);
          await syncFieldDocumentsFromStore();
        } else {
          const visits = readJson(FIELD_VISITS_FILE, []);
          visits.unshift(item);
          writeJson(FIELD_VISITS_FILE, visits);
        }
        sendJson(res, 200, { ok: true, item });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  // Field visit: query
  if (req.method === "GET" && url.pathname === "/api/field-visits") {
    const userId = String(url.searchParams.get("user") || "").trim();
    const dateKey = String(url.searchParams.get("date") || "").trim();
    Promise.resolve(getFieldVisitsData({ userId, dateKey }))
      .then((items) => sendJson(res, 200, { items }))
      .catch((error) => {
        console.error("[field-visits] failed:", error);
        sendJson(res, 500, { error: "拜访记录读取失败" });
      });
    return true;
  }

  // Field audio upload (dataURL)
  if (req.method === "POST" && url.pathname === "/api/uploads/field-audio") {
    parseBody(req)
      .then((body) => {
        const auth = getFieldOrLoginAuth(req);
        if (!auth) {
          sendJson(res, 401, { error: "请先登录当前账号" });
          return;
        }
        if (!body.dataUrl || typeof body.dataUrl !== "string" || !body.dataUrl.startsWith("data:audio")) {
          sendJson(res, 400, { error: "缺少音频 dataUrl" });
          return;
        }
        const savedUrl = saveDataUrlFile(body.dataUrl, "field-audio");
        if (!savedUrl) {
          sendJson(res, 400, { error: "音频保存失败" });
          return;
        }
        sendJson(res, 200, { ok: true, url: savedUrl });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  // Field photo upload (dataURL)
  if (req.method === "POST" && url.pathname === "/api/uploads/field-photo") {
    parseBody(req)
      .then((body) => {
        const auth = getFieldOrLoginAuth(req);
        if (!auth) {
          sendJson(res, 401, { error: "请先登录当前账号" });
          return;
        }
        if (!body.dataUrl || typeof body.dataUrl !== "string" || !body.dataUrl.startsWith("data:image")) {
          sendJson(res, 400, { error: "缺少图片 dataUrl" });
          return;
        }
        const savedUrl = saveDataUrlImage(body.dataUrl, "field-photo");
        sendJson(res, 200, { ok: true, url: savedUrl });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  // Field check-in/out
  if (req.method === "POST" && url.pathname === "/api/field-checkin") {
    parseBody(req)
      .then(async (body) => {
        const userId = String(body.userId || "").trim();
        const auth = getCheckinAuth(req, userId);
        const action = body.action === "out" ? "out" : "in";
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        const accuracy = Number(body.accuracy || 0);
        const note = String(body.note || "").trim();
        const ts = body.ts ? new Date(body.ts) : new Date();
        if (!auth) {
          sendJson(res, 401, { error: "请先登录当前账号" });
          return;
        }
        const attendanceRule = getAttendanceValidation(action, ts);
        if (!attendanceRule.ok) {
          sendJson(res, 400, { error: attendanceRule.error });
          return;
        }
        const attendanceSettings = getSettings().attendance || defaultAttendanceSettings();
        if (attendanceSettings.requireLocation && (Number.isNaN(lat) || Number.isNaN(lng))) {
          sendJson(res, 400, { error: "打卡必须带定位坐标" });
          return;
        }
        if (!userId || Number.isNaN(lat) || Number.isNaN(lng)) {
          sendJson(res, 400, { error: "缺少 userId 或坐标" });
          return;
        }
        const dateKey = getBusinessTimeParts(ts).dateKey;
        const sameDayItems = await getFieldCheckinsData({ userId, dateKey });
        const hasCheckIn = sameDayItems.some((entry) => entry.action === "in");
        const hasCheckOut = sameDayItems.some((entry) => entry.action === "out");
        if (action === "in" && hasCheckIn) {
          sendJson(res, 400, { error: "今天已经上班打卡，不需要重复提交" });
          return;
        }
        if (action === "out" && !hasCheckIn) {
          sendJson(res, 400, { error: "请先完成上班打卡" });
          return;
        }
        if (action === "out" && hasCheckOut) {
          sendJson(res, 400, { error: "今天已经下班打卡，不需要重复提交" });
          return;
        }
        const item = {
          id: `chk-${Date.now()}`,
          userId,
          action,
          lat,
          lng,
          accuracy,
          note,
          ts: ts.toISOString(),
          date: dateKey
        };
        if (fieldStore.isEnabled()) {
          await ensureFieldStoreReady();
          await fieldStore.addCheckin(item);
          await syncFieldDocumentsFromStore();
        } else {
          const items = readJson(FIELD_CHECKINS_FILE, []);
          items.unshift(item);
          writeJson(FIELD_CHECKINS_FILE, items);
        }
        sendJson(res, 200, {
          ok: true,
          item,
          payroll: await getFieldPayrollSummary(userId, dateKey),
          companyAttendance: (await getCompanyAttendanceOverview(dateKey)).summary
        });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body" }));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/field-checkins") {
    const userId = String(url.searchParams.get("user") || "").trim();
    const dateKey = String(url.searchParams.get("date") || "").trim();
    Promise.resolve(getFieldCheckinsData({ userId, dateKey }))
      .then((items) => sendJson(res, 200, { items }))
      .catch((error) => {
        console.error("[field-checkins] failed:", error);
        sendJson(res, 500, { error: "打卡记录读取失败" });
      });
    return true;
  }

  return false;
}

async function requestHandler(req, res) {
  try {
    await documentStore.ensureHydrated();
    await ensureFieldStoreReady();
    await ensureCrmStoreReady();
    await ensureBusinessStoreReady();
    await ensureOperationsStoreReady();
    await ensureCommerceStoreReady();
    await ensureExpenseStoreReady();
    await ensureConfigStoreReady();
    await syncCrmDocumentsFromStore();
    await syncBusinessDocumentsFromStore();
    await syncOperationsDocumentsFromStore();
    await syncCommerceDocumentsFromStore();
    await syncExpenseDocumentsFromStore();
    await syncConfigDocumentsFromStore();
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (await handleApi(req, res, url)) return;

    const requestedPath = url.pathname === "/" ? "/login.html" : url.pathname;
    const session = getLoginSession(req);
    if (requestedPath === "/login.html" && session) {
      const next = String(url.searchParams.get("next") || "").trim();
      sendRedirect(res, next || getRoleLandingPage(session.profile.role));
      return;
    }
    if (isProtectedHtmlPath(requestedPath)) {
      if (!session) {
        sendRedirect(res, `/login.html?next=${encodeURIComponent(requestedPath)}`);
        return;
      }
      if (!isPageAllowedForRole(session.profile.role, requestedPath)) {
        sendRedirect(res, getRoleLandingPage(session.profile.role));
        return;
      }
    }
    const safePath = path.normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(PUBLIC_DIR, safePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    sendFile(res, filePath);
  } catch (error) {
    console.error("[requestHandler]", error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Server initialization failed" });
    } else {
      res.end();
    }
  }
}

if (require.main === module) {
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    ensureDataDir();
    runScheduledBackupsIfNeeded();
    console.log(`smart_sizing server running at http://localhost:${PORT}`);
  });

  setInterval(() => {
    runScheduledBackupsIfNeeded();
  }, 60 * 60 * 1000);
}

module.exports = requestHandler;


