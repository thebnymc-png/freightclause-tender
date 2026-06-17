// JDT Pricing Engine — single source of truth for cost-per-trip and rate derivation.
// Mirrors the structure of Pricing-Template.xlsx (Save down Copy sheet).
//
// Inputs flow:
//   Settings (global)  →  Tender overrides  →  Lane (legs + extras)
//
// Output per lane:
//   { totalHours, totalKm, loadedHourlyRate, labourCost, fuelVehicleCost,
//     extrasCost, costPerTrip, proposedRate, marginPct, perSpace, perHour,
//     annualRevenue, annualMargin }
//
// Match to the template:
//   - H6 (driver base × OT)  = settings.driverBaseHourly × settings.otMultiplier
//   - H11 (loaded rate)      = H6 × (1 + super + workcover + payroll)  [we compound, not add — see note]
//   - C15 (total hrs/trip)   = sum(legs.hours)
//   - D15 (total km/trip)    = sum(legs.km)
//   - C19 (labour cost)      = C15 × loadedRate
//   - C20 (fuel & vehicle)   = D15 × vehicleRate
//   - C21 (cost)             = tolls + overnight + loadingExtras + labour + fuel/vehicle
//   - C23 (price inc FL)     = basePrice × (1 + fuelLevy)
//   - F23 (margin %)         = (price − cost) / price
//   - J23 (per space)        = basePrice / palletSpaces
//   - L23 (per hour)         = basePrice / totalHours

import type { Lane, Settings, Tender, Leg } from "./schema";

export interface PricingInputs {
  legs: Leg[];
  vehicleClass: string;            // "Ute" | "Rigid" | "Semi" | "Bdouble"
  palletSpaces: number;
  tolls: number;
  overnightAllowance: number;
  loadingExtras: number;
  // Tender-level
  fuelLevyPct: number;             // e.g. 12 (means 12%)
  targetMarginPct: number;         // e.g. 18
  tripsPerWeek: number;
  // Global model (from settings)
  driverBaseHourly: number;
  otMultiplier: number;
  superRate: number;               // 0.12
  workcoverRate: number;           // 0.06172
  payrollTaxRate: number;          // 0.0495
  vehicleRateUte: number;
  vehicleRateRigid: number;
  vehicleRateSemi: number;
  vehicleRateBdouble: number;
}

export interface PricingOutput {
  totalHours: number;
  totalKm: number;
  vehicleRate: number;             // $/km for the chosen class
  loadedHourlyRate: number;        // H11 in template
  labourCost: number;
  fuelVehicleCost: number;
  extrasCost: number;
  baseCost: number;                // C21 in template
  costPerTrip: number;             // baseCost (cost includes everything; price-inc-FL applies the levy)
  basePrice: number;               // price at target margin (excl FL)
  priceIncFuelLevy: number;        // C23 in template
  proposedRate: number;            // alias for priceIncFuelLevy for clarity in the app
  marginDollars: number;
  marginPct: number;               // F23 (0–1)
  perSpace: number;                // J23
  perHour: number;                 // L23
  annualRevenue: number;           // G23
  annualMargin: number;            // H23
}

export function vehicleRateFor(vehicleClass: string, s: Pick<PricingInputs,
  "vehicleRateUte" | "vehicleRateRigid" | "vehicleRateSemi" | "vehicleRateBdouble">): number {
  const v = (vehicleClass || "Rigid").toLowerCase();
  if (v.startsWith("ute")) return s.vehicleRateUte;
  if (v.startsWith("semi")) return s.vehicleRateSemi;
  if (v.startsWith("bdouble") || v.startsWith("b-double") || v.startsWith("b double")) return s.vehicleRateBdouble;
  return s.vehicleRateRigid;
}

// Loaded hourly rate per the template:
//   H8 = H6 + H7         where H7 = super × H6   →   H8 = H6 × (1 + super)
//   H9 = workcover × H8
//   H10 = payroll × H8
//   H11 = H8 + H9 + H10  =  H8 × (1 + workcover + payroll)
// So:  loaded = base × OT × (1 + super) × (1 + workcover + payroll)
export function loadedHourlyRate(i: Pick<PricingInputs,
  "driverBaseHourly" | "otMultiplier" | "superRate" | "workcoverRate" | "payrollTaxRate">): number {
  const baseWithOT = i.driverBaseHourly * i.otMultiplier;
  const afterSuper = baseWithOT * (1 + i.superRate);
  return afterSuper * (1 + i.workcoverRate + i.payrollTaxRate);
}

export function priceLane(i: PricingInputs): PricingOutput {
  const totalHours = i.legs.reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const totalKm    = i.legs.reduce((s, l) => s + (Number(l.km)    || 0), 0);
  const loaded     = loadedHourlyRate(i);
  const labour     = totalHours * loaded;
  const vehRate    = vehicleRateFor(i.vehicleClass, i);
  const fuelVeh    = totalKm * vehRate;
  const extras     = (i.tolls || 0) + (i.overnightAllowance || 0) + (i.loadingExtras || 0);
  const baseCost   = labour + fuelVeh + extras;

  // Base price = cost / (1 − margin%).  Price inc FL = base × (1 + FL%).
  const marginFrac = (i.targetMarginPct || 0) / 100;
  const basePrice  = marginFrac > 0 && marginFrac < 1 ? baseCost / (1 - marginFrac) : baseCost;
  const fuelFrac   = (i.fuelLevyPct || 0) / 100;
  const priceIncFL = basePrice * (1 + fuelFrac);

  const annualRev    = priceIncFL * (i.tripsPerWeek || 0) * 52;
  const annualMargin = (priceIncFL - baseCost) * (i.tripsPerWeek || 0) * 52;

  return {
    totalHours,
    totalKm,
    vehicleRate: vehRate,
    loadedHourlyRate: loaded,
    labourCost: labour,
    fuelVehicleCost: fuelVeh,
    extrasCost: extras,
    baseCost,
    costPerTrip: baseCost,
    basePrice,
    priceIncFuelLevy: priceIncFL,
    proposedRate: priceIncFL,
    marginDollars: priceIncFL - baseCost,
    marginPct: priceIncFL > 0 ? (priceIncFL - baseCost) / priceIncFL : 0,
    perSpace: i.palletSpaces > 0 ? basePrice / i.palletSpaces : 0,
    perHour: totalHours > 0 ? basePrice / totalHours : 0,
    annualRevenue: annualRev,
    annualMargin,
  };
}

// Build PricingInputs from a Lane + Tender + Settings (the actual app callsite).
export function inputsFor(
  lane: Pick<Lane, "legsJson" | "vehicleClass" | "palletSpaces" | "tolls" | "overnightAllowance" | "loadingExtras" | "tripsPerWeek" | "distanceKm" | "vehicle">,
  tender: Pick<Tender, "fuelLevy" | "targetMargin">,
  settings: Pick<Settings,
    | "driverBaseHourly" | "otMultiplier" | "superRate" | "workcoverRate" | "payrollTaxRate"
    | "vehicleRateUte" | "vehicleRateRigid" | "vehicleRateSemi" | "vehicleRateBdouble">,
): PricingInputs {
  let legs: Leg[] = [];
  try { legs = JSON.parse(lane.legsJson || "[]"); } catch { legs = []; }

  // Fallback: if no legs but distanceKm is known, synthesise a single drive leg so the engine still works.
  if (!legs.length && lane.distanceKm > 0) {
    // assume 60 km/h average for the synthesised leg, round-trip
    legs = [{ label: "Round trip", hours: (lane.distanceKm * 2) / 60, km: lane.distanceKm * 2, type: "drive" }];
  }

  return {
    legs,
    vehicleClass: lane.vehicleClass || lane.vehicle || "Rigid",
    palletSpaces: lane.palletSpaces || 22,
    tolls: lane.tolls || 0,
    overnightAllowance: lane.overnightAllowance || 0,
    loadingExtras: lane.loadingExtras || 0,
    fuelLevyPct: tender.fuelLevy || 0,
    targetMarginPct: tender.targetMargin || 0,
    tripsPerWeek: lane.tripsPerWeek || 0,
    driverBaseHourly: settings.driverBaseHourly,
    otMultiplier: settings.otMultiplier,
    superRate: settings.superRate,
    workcoverRate: settings.workcoverRate,
    payrollTaxRate: settings.payrollTaxRate,
    vehicleRateUte: settings.vehicleRateUte,
    vehicleRateRigid: settings.vehicleRateRigid,
    vehicleRateSemi: settings.vehicleRateSemi,
    vehicleRateBdouble: settings.vehicleRateBdouble,
  };
}
