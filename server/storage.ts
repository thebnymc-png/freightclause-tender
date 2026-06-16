import {
  users, tenders, lanes, routes, customers, settings,
} from "@shared/schema";
import type {
  User, InsertUser, Tender, InsertTender, Lane, InsertLane,
  Route, InsertRoute, Customer, InsertCustomer, Settings, InsertSettings,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, sql } from "drizzle-orm";

const sqlite = new Database(process.env.DATABASE_PATH || "data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

// Ensure tables exist (no migration step in this env)
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tenders (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, tender_ref TEXT NOT NULL,
  customer_name TEXT NOT NULL, format TEXT NOT NULL, industry TEXT, term TEXT,
  target_margin REAL NOT NULL DEFAULT 18, fuel_levy REAL NOT NULL DEFAULT 12,
  gst_rate REAL NOT NULL DEFAULT 10, incumbent_carrier TEXT,
  decision TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lanes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tender_id INTEGER NOT NULL, origin TEXT NOT NULL,
  destination TEXT NOT NULL, vehicle TEXT NOT NULL DEFAULT 'Rigid', pallets INTEGER NOT NULL DEFAULT 0,
  trips_per_week INTEGER NOT NULL DEFAULT 1, stops INTEGER NOT NULL DEFAULT 1,
  distance_km REAL NOT NULL DEFAULT 0, cost_per_trip REAL NOT NULL DEFAULT 0,
  proposed_rate REAL NOT NULL DEFAULT 0, incumbent_rate REAL NOT NULL DEFAULT 0, notes TEXT
);
CREATE TABLE IF NOT EXISTS routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tender_id INTEGER, name TEXT NOT NULL, depot TEXT NOT NULL,
  stops_json TEXT NOT NULL DEFAULT '[]', vehicle TEXT NOT NULL DEFAULT 'Rigid',
  trips_per_week INTEGER NOT NULL DEFAULT 1, total_km REAL NOT NULL DEFAULT 0,
  total_time_min REAL NOT NULL DEFAULT 0, cost_per_trip REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, industry TEXT, contact_email TEXT, notes TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, google_maps_api_key TEXT NOT NULL DEFAULT '',
  cost_per_km REAL NOT NULL DEFAULT 1.85, driver_hourly REAL NOT NULL DEFAULT 38,
  fuel_levy_default REAL NOT NULL DEFAULT 12, gst_rate REAL NOT NULL DEFAULT 10,
  go_threshold REAL NOT NULL DEFAULT 18, review_threshold REAL NOT NULL DEFAULT 10,
  depot_address TEXT NOT NULL DEFAULT 'Acacia Ridge, Brisbane QLD',
  depot_lat REAL NOT NULL DEFAULT -27.5833, depot_lng REAL NOT NULL DEFAULT 153.0333,
  profile_name TEXT NOT NULL DEFAULT 'Ops Manager', profile_email TEXT NOT NULL DEFAULT 'ops@jdt.com.au'
);
`);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  createUser(u: InsertUser): Promise<User>;

  getTenders(): Promise<Tender[]>;
  getTender(id: number): Promise<Tender | undefined>;
  createTender(t: InsertTender): Promise<Tender>;
  updateTender(id: number, t: Partial<InsertTender>): Promise<Tender | undefined>;
  deleteTender(id: number): Promise<void>;

  getLanes(tenderId: number): Promise<Lane[]>;
  getAllLanes(): Promise<Lane[]>;
  createLane(l: InsertLane): Promise<Lane>;
  createLanes(ls: InsertLane[]): Promise<Lane[]>;
  updateLane(id: number, l: Partial<InsertLane>): Promise<Lane | undefined>;
  deleteLane(id: number): Promise<void>;

  getRoutes(tenderId?: number | null): Promise<Route[]>;
  getRoute(id: number): Promise<Route | undefined>;
  createRoute(r: InsertRoute): Promise<Route>;
  updateRoute(id: number, r: Partial<InsertRoute>): Promise<Route | undefined>;
  deleteRoute(id: number): Promise<void>;

  getCustomers(): Promise<Customer[]>;
  getCustomer(id: number): Promise<Customer | undefined>;
  createCustomer(c: InsertCustomer): Promise<Customer>;
  updateCustomer(id: number, c: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: number): Promise<void>;

  getSettings(): Promise<Settings>;
  updateSettings(s: InsertSettings): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number) { return db.select().from(users).where(eq(users.id, id)).get(); }
  async createUser(u: InsertUser) { return db.insert(users).values(u).returning().get(); }

  async getTenders() { return db.select().from(tenders).all(); }
  async getTender(id: number) { return db.select().from(tenders).where(eq(tenders.id, id)).get(); }
  async createTender(t: InsertTender) {
    return db.insert(tenders).values({ ...t, createdAt: Date.now() }).returning().get();
  }
  async updateTender(id: number, t: Partial<InsertTender>) {
    return db.update(tenders).set(t).where(eq(tenders.id, id)).returning().get();
  }
  async deleteTender(id: number) {
    db.delete(lanes).where(eq(lanes.tenderId, id)).run();
    db.delete(tenders).where(eq(tenders.id, id)).run();
  }

  async getLanes(tenderId: number) { return db.select().from(lanes).where(eq(lanes.tenderId, tenderId)).all(); }
  async getAllLanes() { return db.select().from(lanes).all(); }
  async createLane(l: InsertLane) { return db.insert(lanes).values(l).returning().get(); }
  async createLanes(ls: InsertLane[]) {
    if (!ls.length) return [];
    return db.insert(lanes).values(ls).returning().all();
  }
  async updateLane(id: number, l: Partial<InsertLane>) {
    return db.update(lanes).set(l).where(eq(lanes.id, id)).returning().get();
  }
  async deleteLane(id: number) { db.delete(lanes).where(eq(lanes.id, id)).run(); }

  async getRoutes(tenderId?: number | null) {
    if (tenderId === undefined) return db.select().from(routes).all();
    if (tenderId === null) return db.select().from(routes).where(sql`tender_id IS NULL`).all();
    return db.select().from(routes).where(eq(routes.tenderId, tenderId)).all();
  }
  async getRoute(id: number) { return db.select().from(routes).where(eq(routes.id, id)).get(); }
  async createRoute(r: InsertRoute) { return db.insert(routes).values(r).returning().get(); }
  async updateRoute(id: number, r: Partial<InsertRoute>) {
    return db.update(routes).set(r).where(eq(routes.id, id)).returning().get();
  }
  async deleteRoute(id: number) { db.delete(routes).where(eq(routes.id, id)).run(); }

  async getCustomers() { return db.select().from(customers).all(); }
  async getCustomer(id: number) { return db.select().from(customers).where(eq(customers.id, id)).get(); }
  async createCustomer(c: InsertCustomer) { return db.insert(customers).values(c).returning().get(); }
  async updateCustomer(id: number, c: Partial<InsertCustomer>) {
    return db.update(customers).set(c).where(eq(customers.id, id)).returning().get();
  }
  async deleteCustomer(id: number) { db.delete(customers).where(eq(customers.id, id)).run(); }

  async getSettings() {
    let s = db.select().from(settings).where(eq(settings.id, 1)).get();
    if (!s) s = db.insert(settings).values({ id: 1 } as any).returning().get();
    return s;
  }
  async updateSettings(s: InsertSettings) {
    await this.getSettings();
    return db.update(settings).set(s).where(eq(settings.id, 1)).returning().get();
  }
}

export const storage = new DatabaseStorage();

// ---------------- Seed ----------------
export function seed() {
  const existing = db.select().from(tenders).all();
  if (existing.length > 0) return;

  const now = Date.now();
  const day = 86400000;

  db.insert(users).values({ email: "ops@jdt.com.au", name: "Ops Manager" }).run();
  db.insert(settings).values({ id: 1 } as any).onConflictDoNothing?.();
  try { db.insert(settings).values({ id: 1 } as any).run(); } catch {}

  const cust = [
    { name: "QFresh", industry: "Produce / Grocery", contactEmail: "tenders@qfresh.com.au", notes: "Major SE-QLD produce distributor. Volume-sensitive on price." },
    { name: "DriveLogix", industry: "3PL / Logistics", contactEmail: "procurement@drivelogix.com.au", notes: "Aggregator. Multi-drop metro work. Strict on-time KPIs." },
    { name: "ColdHaul", industry: "Frozen / Cold Storage", contactEmail: "rfp@coldhaul.com.au", notes: "Frozen-only. Requires -18C reefer fleet certification." },
    { name: "MetroFreight", industry: "FMCG Distribution", contactEmail: "supply@metrofreight.com.au", notes: "DC replenishment. Predictable weekly volumes." },
  ];
  cust.forEach((c) => db.insert(customers).values(c).run());

  const tenderDefs = [
    { tenderRef: "JDT-2401", customerName: "QFresh", format: "lane_list", industry: "Produce / Grocery", term: "24 months", targetMargin: 18, fuelLevy: 12, gstRate: 10, incumbentCarrier: "FreshLine Transport", decision: "go", createdAt: now - 2 * day },
    { tenderRef: "JDT-2402", customerName: "DriveLogix", format: "multi_drop", industry: "3PL / Logistics", term: "12 months", targetMargin: 20, fuelLevy: 13, gstRate: 10, incumbentCarrier: "Metro Distribution Co", decision: "review", createdAt: now - 5 * day },
    { tenderRef: "JDT-2403", customerName: "ColdHaul", format: "dc_volumes", industry: "Frozen / Cold Storage", term: "36 months", targetMargin: 22, fuelLevy: 14, gstRate: 10, incumbentCarrier: "PolarFreight", decision: "no_go", createdAt: now - 9 * day },
    { tenderRef: "JDT-2404", customerName: "MetroFreight", format: "rate_card", industry: "FMCG Distribution", term: "24 months", targetMargin: 18, fuelLevy: 12, gstRate: 10, incumbentCarrier: "Incumbent (undisclosed)", decision: "go", createdAt: now - 12 * day },
    { tenderRef: "JDT-2405", customerName: "QFresh", format: "rfp_narrative", industry: "Produce / Grocery", term: "12 months", targetMargin: 16, fuelLevy: 12, gstRate: 10, incumbentCarrier: "FreshLine Transport", decision: "pending", createdAt: now - 1 * day },
  ];
  const tenderRows = tenderDefs.map((t) => db.insert(tenders).values({ ...t, userId: 1 }).returning().get());

  // Brisbane-area lanes; distances approximate (km). cost = distance*costPerKm + driving hours*hourly.
  const costPerKm = 1.85, hourly = 38, avgSpeed = 55;
  const laneSeeds: Array<[string, string, string, number, number, number, number]> = [
    // origin, destination, vehicle, pallets, trips/wk, distanceKm, incumbentRate
    ["Acacia Ridge DC", "Toowoomba", "Semi", 22, 6, 128, 540],
    ["Acacia Ridge DC", "Gold Coast", "Rigid", 14, 10, 78, 320],
    ["Acacia Ridge DC", "Sunshine Coast", "Rigid", 14, 8, 112, 430],
    ["Acacia Ridge DC", "Ipswich", "Rigid", 12, 12, 42, 210],
    ["Acacia Ridge DC", "Logan", "Rigid", 10, 14, 28, 165],
    ["Acacia Ridge DC", "Brisbane CBD", "Rigid", 8, 18, 18, 140],
    ["Wacol DC", "Caboolture", "Rigid", 12, 7, 64, 290],
    ["Wacol DC", "Redlands", "Rigid", 10, 9, 46, 230],
    ["Richlands DC", "Springfield", "Rigid", 8, 11, 22, 150],
    ["Richlands DC", "Beenleigh", "Rigid", 10, 8, 38, 200],
    ["Acacia Ridge DC", "Maryborough", "Semi", 24, 3, 255, 980],
    ["Acacia Ridge DC", "Bundaberg", "Semi", 24, 2, 360, 1320],
  ];
  const palletPresets = [22, 14, 14, 12, 10, 8, 12, 10, 8, 10, 24, 24];

  function buildLane(tenderId: number, idx: number, target: number, fuelLevy: number): InsertLane {
    const s = laneSeeds[idx % laneSeeds.length];
    const distanceKm = s[5];
    const hours = (distanceKm * 2) / avgSpeed; // round trip
    const baseCost = distanceKm * 2 * costPerKm + hours * hourly;
    const costPerTrip = Math.round(baseCost * (1 + fuelLevy / 100));
    const proposed = Math.round((costPerTrip / (1 - target / 100)) / 5) * 5;
    return {
      tenderId, origin: s[0], destination: s[1], vehicle: s[2], pallets: palletPresets[idx % palletPresets.length],
      tripsPerWeek: s[4], stops: 1, distanceKm, costPerTrip, proposedRate: proposed,
      incumbentRate: s[6], notes: null,
    };
  }

  // Distribute ~30 lanes across tenders
  const laneCounts = [8, 7, 6, 6, 3];
  tenderRows.forEach((t, ti) => {
    const arr: InsertLane[] = [];
    for (let i = 0; i < laneCounts[ti]; i++) {
      arr.push(buildLane(t.id, i + ti, t.targetMargin, t.fuelLevy));
    }
    db.insert(lanes).values(arr).run();
  });

  // 3 sample routes (standalone, tender-independent)
  const routeSeeds = [
    { name: "Acacia Ridge Metro Run", depot: "Acacia Ridge, Brisbane QLD", stops: ["Sunnybank QLD", "Mount Gravatt QLD", "Carindale QLD", "Cleveland QLD"], totalKm: 64, totalTimeMin: 92, costPerTrip: 290 },
    { name: "Wacol Western Loop", depot: "Wacol, Brisbane QLD", stops: ["Richlands QLD", "Springfield QLD", "Ipswich QLD", "Goodna QLD"], totalKm: 58, totalTimeMin: 84, costPerTrip: 265 },
    { name: "Richlands South Corridor", depot: "Richlands, Brisbane QLD", stops: ["Forest Lake QLD", "Browns Plains QLD", "Beenleigh QLD"], totalKm: 47, totalTimeMin: 71, costPerTrip: 220 },
  ];
  routeSeeds.forEach((r) => db.insert(routes).values({
    tenderId: null, name: r.name, depot: r.depot, stopsJson: JSON.stringify(r.stops),
    vehicle: "Rigid", tripsPerWeek: 5, totalKm: r.totalKm, totalTimeMin: r.totalTimeMin, costPerTrip: r.costPerTrip,
  }).run());

  console.log("Seeded demo data.");
}
