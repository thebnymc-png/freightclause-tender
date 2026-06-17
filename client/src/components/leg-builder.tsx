// Per-lane Leg Builder. Mirrors the rows in B5:D13 of the JDT pricing template:
// each leg has a label (e.g. "load", "drive", "unload"), hours, km. The engine
// sums these and applies labour + vehicle costs to produce cost/trip.
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Calculator, Save } from "lucide-react";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { aud, pct, num } from "@/lib/format";
import { priceLane, inputsFor } from "@shared/pricing";
import type { Lane, Tender, Settings, Leg } from "@shared/schema";

const VEHICLE_CLASSES = ["Ute", "Rigid", "Semi", "Bdouble"] as const;

interface LegBuilderProps {
  lane: Lane;
  tender: Tender;
  trigger?: React.ReactNode;
}

export function LegBuilder({ lane, tender, trigger }: LegBuilderProps) {
  const { toast } = useToast();
  const { data: settings } = useQuery<Settings>({ queryKey: ["/api/settings"] });
  const [open, setOpen] = useState(false);

  // Local working copy
  const initialLegs: Leg[] = useMemo(() => {
    try { const p = JSON.parse(lane.legsJson || "[]"); return Array.isArray(p) ? p : []; }
    catch { return []; }
  }, [lane.legsJson]);

  const [legs, setLegs] = useState<Leg[]>(initialLegs);
  const [vehicleClass, setVehicleClass] = useState(lane.vehicleClass || lane.vehicle || "Rigid");
  const [palletSpaces, setPalletSpaces] = useState(lane.palletSpaces || 22);
  const [tolls, setTolls] = useState(lane.tolls || 0);
  const [overnight, setOvernight] = useState(lane.overnightAllowance || 0);
  const [loadingExtras, setLoadingExtras] = useState(lane.loadingExtras || 0);

  // Reset when the sheet opens (so toggling lanes shows fresh data)
  useEffect(() => {
    if (open) {
      setLegs(initialLegs.length ? initialLegs : defaultLegsForLane(lane));
      setVehicleClass(lane.vehicleClass || lane.vehicle || "Rigid");
      setPalletSpaces(lane.palletSpaces || 22);
      setTolls(lane.tolls || 0);
      setOvernight(lane.overnightAllowance || 0);
      setLoadingExtras(lane.loadingExtras || 0);
    }
  }, [open, lane, initialLegs]);

  // Live pricing preview
  const preview = useMemo(() => {
    if (!settings) return null;
    const inputs = inputsFor(
      {
        legsJson: JSON.stringify(legs),
        vehicleClass,
        palletSpaces,
        tolls,
        overnightAllowance: overnight,
        loadingExtras,
        tripsPerWeek: lane.tripsPerWeek,
        distanceKm: lane.distanceKm,
        vehicle: lane.vehicle,
      },
      tender,
      settings,
    );
    return priceLane(inputs);
  }, [legs, vehicleClass, palletSpaces, tolls, overnight, loadingExtras, lane, tender, settings]);

  const save = useMutation({
    mutationFn: async () => {
      if (!preview) throw new Error("Pricing engine not ready");
      const body = {
        legsJson: JSON.stringify(legs),
        vehicleClass,
        palletSpaces,
        tolls,
        overnightAllowance: overnight,
        loadingExtras,
        distanceKm: Math.round(preview.totalKm),
        costPerTrip: Math.round(preview.costPerTrip),
        proposedRate: Math.round(preview.proposedRate),
      };
      const res = await apiRequest("PATCH", `/api/lanes/${lane.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", lane.tenderId, "lanes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      toast({ title: "Legs saved", description: "Cost/trip and proposed rate recalculated." });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e?.message || String(e), variant: "destructive" }),
  });

  const addLeg = () => setLegs([...legs, { label: "New leg", hours: 0, km: 0, type: "drive" }]);
  const updateLeg = (i: number, patch: Partial<Leg>) =>
    setLegs(legs.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLeg = (i: number) => setLegs(legs.filter((_, idx) => idx !== i));

  const totalHours = legs.reduce((s, l) => s + (Number(l.hours) || 0), 0);
  const totalKm = legs.reduce((s, l) => s + (Number(l.km) || 0), 0);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline" data-testid={`button-legs-${lane.id}`}>
            <Calculator className="mr-1.5 h-3.5 w-3.5" />Edit legs
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pricing — {lane.origin} → {lane.destination}</SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          {/* Vehicle + pallet spaces */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Vehicle class</Label>
              <Select value={vehicleClass} onValueChange={setVehicleClass}>
                <SelectTrigger data-testid="select-vehicle-class"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VEHICLE_CLASSES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pallet spaces</Label>
              <Input type="number" value={palletSpaces}
                onChange={(e) => setPalletSpaces(Number(e.target.value) || 0)}
                data-testid="input-pallet-spaces" />
            </div>
          </div>

          {/* Legs table */}
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leg label</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-24 text-right">Hours</TableHead>
                  <TableHead className="w-24 text-right">Km</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {legs.map((leg, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Input value={leg.label}
                        onChange={(e) => updateLeg(i, { label: e.target.value })}
                        className="h-8" data-testid={`input-leg-label-${i}`} />
                    </TableCell>
                    <TableCell>
                      <Select value={leg.type || "drive"} onValueChange={(v) => updateLeg(i, { type: v as any })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yard">yard</SelectItem>
                          <SelectItem value="load">load</SelectItem>
                          <SelectItem value="drive">drive</SelectItem>
                          <SelectItem value="unload">unload</SelectItem>
                          <SelectItem value="return">return</SelectItem>
                          <SelectItem value="other">other</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input type="number" step="0.25" value={leg.hours}
                        onChange={(e) => updateLeg(i, { hours: Number(e.target.value) || 0 })}
                        className="h-8 text-right tnum" data-testid={`input-leg-hours-${i}`} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" value={leg.km}
                        onChange={(e) => updateLeg(i, { km: Number(e.target.value) || 0 })}
                        className="h-8 text-right tnum" data-testid={`input-leg-km-${i}`} />
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => removeLeg(i)} data-testid={`button-leg-delete-${i}`}>
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={5}>
                    <Button size="sm" variant="ghost" onClick={addLeg} data-testid="button-add-leg">
                      <Plus className="mr-1.5 h-3.5 w-3.5" />Add leg
                    </Button>
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/40 font-medium">
                  <TableCell colSpan={2} className="text-xs">Totals</TableCell>
                  <TableCell className="text-right tnum">{num(totalHours, 2)}</TableCell>
                  <TableCell className="text-right tnum">{num(totalKm)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>

          {/* Lane-level extras */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Lane extras (added to cost)</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tolls ($)</Label>
                <Input type="number" value={tolls} onChange={(e) => setTolls(Number(e.target.value) || 0)}
                  data-testid="input-tolls" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Overnight ($)</Label>
                <Input type="number" value={overnight} onChange={(e) => setOvernight(Number(e.target.value) || 0)}
                  data-testid="input-overnight" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Loading extras ($)</Label>
                <Input type="number" value={loadingExtras} onChange={(e) => setLoadingExtras(Number(e.target.value) || 0)}
                  data-testid="input-loading-extras" />
              </div>
            </div>
          </div>

          {/* Pricing preview */}
          {preview && (
            <Card className="p-4 bg-muted/30">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Live preview</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Stat label="Loaded hourly" value={aud(preview.loadedHourlyRate, 2)} />
                <Stat label="Labour cost" value={aud(preview.labourCost)} />
                <Stat label="Fuel & vehicle" value={aud(preview.fuelVehicleCost)} />
                <Stat label="Extras" value={aud(preview.extrasCost)} />
                <Stat label="Cost/trip" value={aud(preview.baseCost)} strong />
                <Stat label="Base price" value={aud(preview.basePrice)} />
                <Stat label="Price inc FL" value={aud(preview.priceIncFuelLevy)} strong accent />
                <Stat label="Margin %" value={pct(preview.marginPct * 100)} />
                <Stat label="Per pallet" value={aud(preview.perSpace, 2)} />
                <Stat label="Per hour" value={aud(preview.perHour, 2)} />
                <Stat label="Annual revenue" value={aud(preview.annualRevenue)} />
                <Stat label="Annual margin" value={aud(preview.annualMargin)} accent />
              </div>
            </Card>
          )}
        </div>

        <SheetFooter className="mt-5">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-legs">
            <Save className="mr-1.5 h-4 w-4" />{save.isPending ? "Saving…" : "Save & recalc"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`tnum ${strong ? "font-semibold" : ""} ${accent ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

// Sensible default legs when a lane has none — mirrors the structure of the template's first job.
export function defaultLegsForLane(lane: { origin: string; destination: string; distanceKm?: number }): Leg[] {
  const km = lane.distanceKm || 0;
  return [
    { label: "Yard prep", hours: 0.5, km: 0, type: "yard" },
    { label: "Load", hours: 1, km: 0, type: "load" },
    { label: `Drive ${lane.origin} → ${lane.destination}`, hours: km / 60 || 0.5, km, type: "drive" },
    { label: "Unload", hours: 1, km: 0, type: "unload" },
    { label: "Return", hours: km / 60 || 0.5, km, type: "return" },
  ];
}
