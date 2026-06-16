import type { Express, Request } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage, seed } from "./storage";
import {
  insertTenderSchema, insertLaneSchema, insertRouteSchema, insertCustomerSchema, insertSettingsSchema,
} from "@shared/schema";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// City coordinate lookup for haversine fallback (SE Queensland)
const COORDS: Record<string, [number, number]> = {
  "brisbane": [-27.4698, 153.0251], "brisbane cbd": [-27.4698, 153.0251],
  "acacia ridge": [-27.5833, 153.0333], "wacol": [-27.5833, 152.9333], "richlands": [-27.5667, 152.9667],
  "toowoomba": [-27.5598, 151.9507], "gold coast": [-28.0167, 153.4000], "sunshine coast": [-26.6500, 153.0667],
  "ipswich": [-27.6167, 152.7600], "logan": [-27.6392, 153.1086], "caboolture": [-27.0833, 152.9500],
  "redlands": [-27.5300, 153.2500], "springfield": [-27.6700, 152.9200], "beenleigh": [-27.7100, 153.2000],
  "maryborough": [-25.5400, 152.7000], "bundaberg": [-24.8661, 152.3489], "sunnybank": [-27.5710, 153.0590],
  "mount gravatt": [-27.5380, 153.0790], "carindale": [-27.5100, 153.1010], "cleveland": [-27.5260, 153.2640],
  "forest lake": [-27.6230, 152.9690], "browns plains": [-27.6620, 153.0470], "goodna": [-27.6130, 152.8980],
};

function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.25); // *1.25 road-network factor
}
function lookupCoord(name: string): [number, number] | null {
  const k = name.toLowerCase().replace(/,.*$/, "").replace(/\bdc\b/g, "").replace(/qld|australia/gi, "").trim();
  for (const key of Object.keys(COORDS)) if (k.includes(key)) return COORDS[key];
  return null;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  seed();

  // ---------- Tenders ----------
  app.get("/api/tenders", async (_req, res) => res.json(await storage.getTenders()));
  app.get("/api/tenders/:id", async (req, res) => {
    const t = await storage.getTender(Number(req.params.id));
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });
  app.post("/api/tenders", async (req, res) => {
    const parsed = insertTenderSchema.partial({ userId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createTender({ userId: 1, ...parsed.data } as any));
  });
  app.patch("/api/tenders/:id", async (req, res) => {
    const t = await storage.updateTender(Number(req.params.id), req.body);
    if (!t) return res.status(404).json({ error: "Not found" });
    res.json(t);
  });
  app.delete("/api/tenders/:id", async (req, res) => {
    await storage.deleteTender(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- Lanes ----------
  app.get("/api/tenders/:id/lanes", async (req, res) => res.json(await storage.getLanes(Number(req.params.id))));
  app.post("/api/tenders/:id/lanes", async (req, res) => {
    const tenderId = Number(req.params.id);
    if (Array.isArray(req.body)) {
      const rows = req.body.map((r: any) => ({ ...r, tenderId }));
      return res.json(await storage.createLanes(rows));
    }
    const parsed = insertLaneSchema.safeParse({ ...req.body, tenderId });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createLane(parsed.data));
  });
  app.patch("/api/lanes/:id", async (req, res) => {
    const l = await storage.updateLane(Number(req.params.id), req.body);
    if (!l) return res.status(404).json({ error: "Not found" });
    res.json(l);
  });
  app.delete("/api/lanes/:id", async (req, res) => {
    await storage.deleteLane(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- Routes ----------
  app.get("/api/routes", async (req, res) => {
    const t = req.query.tenderId;
    if (t === "null") return res.json(await storage.getRoutes(null));
    if (t !== undefined) return res.json(await storage.getRoutes(Number(t)));
    res.json(await storage.getRoutes());
  });
  app.get("/api/routes/:id", async (req, res) => {
    const r = await storage.getRoute(Number(req.params.id));
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(r);
  });
  app.post("/api/routes", async (req, res) => {
    const parsed = insertRouteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createRoute(parsed.data));
  });
  app.patch("/api/routes/:id", async (req, res) => {
    const r = await storage.updateRoute(Number(req.params.id), req.body);
    if (!r) return res.status(404).json({ error: "Not found" });
    res.json(r);
  });
  app.delete("/api/routes/:id", async (req, res) => {
    await storage.deleteRoute(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- Customers ----------
  app.get("/api/customers", async (_req, res) => res.json(await storage.getCustomers()));
  app.get("/api/customers/:id", async (req, res) => {
    const c = await storage.getCustomer(Number(req.params.id));
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json(c);
  });
  app.post("/api/customers", async (req, res) => {
    const parsed = insertCustomerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    res.json(await storage.createCustomer(parsed.data));
  });
  app.patch("/api/customers/:id", async (req, res) => {
    const c = await storage.updateCustomer(Number(req.params.id), req.body);
    if (!c) return res.status(404).json({ error: "Not found" });
    res.json(c);
  });
  app.delete("/api/customers/:id", async (req, res) => {
    await storage.deleteCustomer(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------- Settings ----------
  // Never expose the API key to clients verbatim — send a masked flag instead.
  app.get("/api/settings", async (_req, res) => {
    const s = await storage.getSettings();
    const { googleMapsApiKey, ...rest } = s;
    res.json({ ...rest, hasGoogleMapsApiKey: !!googleMapsApiKey });
  });
  app.patch("/api/settings", async (req, res) => {
    const parsed = insertSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const data = { ...parsed.data };
    // Don't overwrite stored key with empty string unless explicitly clearing
    if (data.googleMapsApiKey === "" && req.body.clearKey !== true) delete data.googleMapsApiKey;
    const s = await storage.updateSettings(data);
    const { googleMapsApiKey, ...rest } = s;
    res.json({ ...rest, hasGoogleMapsApiKey: !!googleMapsApiKey });
  });

  // ---------- Dashboard KPIs ----------
  app.get("/api/dashboard/kpis", async (_req, res) => {
    const tenders = await storage.getTenders();
    const allLanes = await storage.getAllLanes();
    const active = tenders.filter((t) => t.decision !== "no_go").length;
    let weeklyExposure = 0, weeklyCost = 0;
    const laneGP: Array<{ label: string; origin: string; destination: string; gp: number; tenderRef: string }> = [];
    for (const t of tenders) {
      const tl = allLanes.filter((l) => l.tenderId === t.id);
      for (const l of tl) {
        const wkRev = l.proposedRate * l.tripsPerWeek;
        const wkCost = l.costPerTrip * l.tripsPerWeek;
        weeklyExposure += wkRev;
        weeklyCost += wkCost;
        laneGP.push({ label: `${l.origin} → ${l.destination}`, origin: l.origin, destination: l.destination, gp: wkRev - wkCost, tenderRef: t.tenderRef });
      }
    }
    const annualPipeline = weeklyExposure * 52;
    const blendedMargin = weeklyExposure > 0 ? ((weeklyExposure - weeklyCost) / weeklyExposure) * 100 : 0;
    const topLanes = laneGP.sort((a, b) => b.gp - a.gp).slice(0, 5);

    // 6-month revenue vs cost (mock, derived from current weekly figures with seasonality)
    const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    const seasonality = [0.82, 0.88, 0.95, 1.0, 1.08, 1.12];
    const monthly = months.map((m, i) => ({
      month: m,
      revenue: Math.round(weeklyExposure * 4.33 * seasonality[i]),
      cost: Math.round(weeklyCost * 4.33 * seasonality[i]),
    }));

    res.json({
      activeTenders: active,
      weeklyExposure: Math.round(weeklyExposure),
      annualPipeline: Math.round(annualPipeline),
      blendedMargin: Number(blendedMargin.toFixed(1)),
      topLanes, monthly,
      recentTenders: [...tenders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
    });
  });

  // ---------- Upload parse ----------
  app.post("/api/upload/parse", upload.single("file"), async (req: Request, res) => {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });
    try {
      const wb = XLSX.read(file.buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const columns = rows.length ? Object.keys(rows[0]) : [];
      res.json({ columns, rows: rows.slice(0, 200), totalRows: rows.length });
    } catch (e: any) {
      res.status(400).json({ error: "Could not parse file: " + e.message });
    }
  });

  // ---------- Maps: Distance Matrix (haversine fallback when no key) ----------
  app.post("/api/maps/distance-matrix", async (req, res) => {
    const { origins, destinations } = req.body as { origins: string[]; destinations: string[] };
    const s = await storage.getSettings();
    if (s.googleMapsApiKey && origins?.length && destinations?.length) {
      try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origins.join("|"))}&destinations=${encodeURIComponent(destinations.join("|"))}&key=${s.googleMapsApiKey}`;
        const r = await fetch(url);
        return res.json({ source: "google", data: await r.json() });
      } catch { /* fall through */ }
    }
    // haversine fallback
    const matrix = (origins || []).map((o) => (destinations || []).map((d) => {
      const a = lookupCoord(o), b = lookupCoord(d);
      const km = a && b ? haversine(a, b) : 0;
      return { distanceKm: km, durationMin: Math.round((km / 55) * 60) };
    }));
    res.json({ source: "haversine", matrix });
  });

  // ---------- Maps: Directions proxy ----------
  app.post("/api/maps/directions", async (req, res) => {
    const { origin, destination, waypoints, optimize } = req.body;
    const s = await storage.getSettings();
    if (!s.googleMapsApiKey) {
      // fallback: order is unchanged, compute haversine total
      const pts = [origin, ...(waypoints || []), destination];
      let totalKm = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const a = lookupCoord(pts[i]), b = lookupCoord(pts[i + 1]);
        if (a && b) totalKm += haversine(a, b);
      }
      return res.json({
        source: "haversine", totalKm,
        durationMin: Math.round((totalKm / 45) * 60),
        trafficMin: Math.round((totalKm / 38) * 60),
        order: (waypoints || []).map((_: any, i: number) => i),
      });
    }
    try {
      const wp = waypoints?.length
        ? `&waypoints=${optimize ? "optimize:true|" : ""}${waypoints.map((w: string) => encodeURIComponent(w)).join("|")}`
        : "";
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${wp}&departure_time=now&key=${s.googleMapsApiKey}`;
      const r = await fetch(url);
      res.json({ source: "google", data: await r.json() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---------- Expose key only to maps loader (server-controlled) ----------
  app.get("/api/maps/config", async (_req, res) => {
    const s = await storage.getSettings();
    res.json({ apiKey: s.googleMapsApiKey || "", depot: { lat: s.depotLat, lng: s.depotLng, address: s.depotAddress } });
  });

  return httpServer;
}
