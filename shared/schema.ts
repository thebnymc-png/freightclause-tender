import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------- Users (single-user for v1, no auth) ----------------
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ---------------- Tenders ----------------
export const TENDER_FORMATS = ["lane_list", "multi_drop", "dc_volumes", "rate_card", "rfp_narrative"] as const;
export const DECISIONS = ["go", "review", "no_go", "pending"] as const;

export const tenders = sqliteTable("tenders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  tenderRef: text("tender_ref").notNull(),
  customerName: text("customer_name").notNull(),
  format: text("format").notNull(), // one of TENDER_FORMATS
  industry: text("industry"),
  term: text("term"),
  targetMargin: real("target_margin").notNull().default(18),
  fuelLevy: real("fuel_levy").notNull().default(12),
  gstRate: real("gst_rate").notNull().default(10),
  incumbentCarrier: text("incumbent_carrier"),
  // Cost model (per-tender overrides; fall back to global Settings when 0/null)
  costPerKm: real("cost_per_km").notNull().default(0),       // 0 = use settings.costPerKm
  fixedPerTrip: real("fixed_per_trip").notNull().default(0), // tolls, handling, driver fixed
  avgKmPerLane: real("avg_km_per_lane").notNull().default(0),// fallback distance when row has none
  decision: text("decision").notNull().default("pending"), // one of DECISIONS
  createdAt: integer("created_at").notNull(),
});

export const insertTenderSchema = createInsertSchema(tenders).omit({ id: true, createdAt: true });
export type InsertTender = z.infer<typeof insertTenderSchema>;
export type Tender = typeof tenders.$inferSelect;

// ---------------- Lanes ----------------
export const lanes = sqliteTable("lanes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenderId: integer("tender_id").notNull(),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  vehicle: text("vehicle").notNull().default("Rigid"),
  pallets: integer("pallets").notNull().default(0),
  tripsPerWeek: integer("trips_per_week").notNull().default(1),
  stops: integer("stops").notNull().default(1),
  distanceKm: real("distance_km").notNull().default(0),
  costPerTrip: real("cost_per_trip").notNull().default(0),
  proposedRate: real("proposed_rate").notNull().default(0),
  incumbentRate: real("incumbent_rate").notNull().default(0),
  notes: text("notes"),
});

export const insertLaneSchema = createInsertSchema(lanes).omit({ id: true });
export type InsertLane = z.infer<typeof insertLaneSchema>;
export type Lane = typeof lanes.$inferSelect;

// ---------------- Routes ----------------
export const routes = sqliteTable("routes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tenderId: integer("tender_id"), // nullable — standalone routes allowed
  name: text("name").notNull(),
  depot: text("depot").notNull(),
  stopsJson: text("stops_json").notNull().default("[]"), // JSON array of stop addresses
  vehicle: text("vehicle").notNull().default("Rigid"),
  tripsPerWeek: integer("trips_per_week").notNull().default(1),
  totalKm: real("total_km").notNull().default(0),
  totalTimeMin: real("total_time_min").notNull().default(0),
  costPerTrip: real("cost_per_trip").notNull().default(0),
});

export const insertRouteSchema = createInsertSchema(routes).omit({ id: true });
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;

// ---------------- Customers ----------------
export const customers = sqliteTable("customers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  industry: text("industry"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
});

export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// ---------------- Settings (singleton) ----------------
export const settings = sqliteTable("settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  googleMapsApiKey: text("google_maps_api_key").notNull().default(""),
  costPerKm: real("cost_per_km").notNull().default(1.85),
  driverHourly: real("driver_hourly").notNull().default(38),
  fuelLevyDefault: real("fuel_levy_default").notNull().default(12),
  gstRate: real("gst_rate").notNull().default(10),
  goThreshold: real("go_threshold").notNull().default(18),
  reviewThreshold: real("review_threshold").notNull().default(10),
  depotAddress: text("depot_address").notNull().default("Acacia Ridge, Brisbane QLD"),
  depotLat: real("depot_lat").notNull().default(-27.5833),
  depotLng: real("depot_lng").notNull().default(153.0333),
  profileName: text("profile_name").notNull().default("Ops Manager"),
  profileEmail: text("profile_email").notNull().default("ops@jdt.com.au"),
});

export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true }).partial();
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settings.$inferSelect;
