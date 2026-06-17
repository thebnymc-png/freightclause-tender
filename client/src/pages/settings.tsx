import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Save, KeyRound, Truck, MapPin, User, Calculator } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type SettingsDto = {
  costPerKm: number; driverHourly: number; fuelLevyDefault: number; gstRate: number;
  goThreshold: number; reviewThreshold: number; depotAddress: string; depotLat: number; depotLng: number;
  profileName: string; profileEmail: string; hasGoogleMapsApiKey: boolean;
  // v8 JDT Pricing Model
  driverBaseHourly: number; otMultiplier: number; publicHolidayHourly: number; linehaulHourly: number;
  superRate: number; workcoverRate: number; payrollTaxRate: number;
  vehicleRateUte: number; vehicleRateRigid: number; vehicleRateSemi: number; vehicleRateBdouble: number;
};

export default function Settings() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<SettingsDto>({ queryKey: ["/api/settings"] });
  const [form, setForm] = useState<Partial<SettingsDto>>({});
  const [apiKey, setApiKey] = useState("");

  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = { ...form };
      delete payload.hasGoogleMapsApiKey;
      if (apiKey) payload.googleMapsApiKey = apiKey;
      await apiRequest("PATCH", "/api/settings", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/maps/config"] });
      setApiKey("");
      toast({ title: "Settings saved" });
    },
  });

  if (isLoading || !data) return <AppShell title="Settings"><Skeleton className="h-96 w-full rounded-xl" /></AppShell>;

  const f = (k: keyof SettingsDto) => form[k] as any;
  const setN = (k: keyof SettingsDto, v: string) => setForm({ ...form, [k]: Number(v) });
  const setS = (k: keyof SettingsDto, v: string) => setForm({ ...form, [k]: v });

  return (
    <AppShell title="Settings">
      <div className="max-w-3xl space-y-5">
        {/* Cost engine */}
        <Card className="p-5">
          <SectionTitle icon={Truck} title="Cost engine" desc="Inputs used to compute lane cost-per-trip and target rates." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Cost / km ($)"><Input type="number" step="0.01" value={f("costPerKm") ?? ""} onChange={(e) => setN("costPerKm", e.target.value)} data-testid="input-cost-per-km" /></Field>
            <Field label="Driver hourly ($)"><Input type="number" value={f("driverHourly") ?? ""} onChange={(e) => setN("driverHourly", e.target.value)} data-testid="input-driver-hourly" /></Field>
            <Field label="Fuel levy default (%)"><Input type="number" value={f("fuelLevyDefault") ?? ""} onChange={(e) => setN("fuelLevyDefault", e.target.value)} data-testid="input-fuel-default" /></Field>
            <Field label="GST rate (%)"><Input type="number" value={f("gstRate") ?? ""} onChange={(e) => setN("gstRate", e.target.value)} data-testid="input-gst-rate" /></Field>
            <Field label="GO threshold (%)"><Input type="number" value={f("goThreshold") ?? ""} onChange={(e) => setN("goThreshold", e.target.value)} data-testid="input-go-threshold" /></Field>
            <Field label="REVIEW threshold (%)"><Input type="number" value={f("reviewThreshold") ?? ""} onChange={(e) => setN("reviewThreshold", e.target.value)} data-testid="input-review-threshold" /></Field>
          </div>
        </Card>

        {/* JDT Pricing Model (v8 — mirrors Pricing-Template.xlsx) */}
        <Card className="p-5">
          <SectionTitle icon={Calculator} title="JDT Pricing Model" desc="Driver labour rates, statutory loadings and vehicle running cost per km. Used by the per-lane Leg Builder to derive cost/trip and proposed rate." />
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Driver base hourly</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Base hourly ($)"><Input type="number" step="0.01" value={f("driverBaseHourly") ?? ""} onChange={(e) => setN("driverBaseHourly", e.target.value)} data-testid="input-driver-base" /></Field>
                <Field label="OT multiplier"><Input type="number" step="0.0001" value={f("otMultiplier") ?? ""} onChange={(e) => setN("otMultiplier", e.target.value)} data-testid="input-ot-mult" /></Field>
                <Field label="Public holiday ($/hr)"><Input type="number" step="0.01" value={f("publicHolidayHourly") ?? ""} onChange={(e) => setN("publicHolidayHourly", e.target.value)} data-testid="input-ph-hourly" /></Field>
                <Field label="Linehaul ($/hr)"><Input type="number" step="0.01" value={f("linehaulHourly") ?? ""} onChange={(e) => setN("linehaulHourly", e.target.value)} data-testid="input-linehaul-hourly" /></Field>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Statutory loadings (applied to loaded hourly rate)</h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Super (decimal, e.g. 0.12)"><Input type="number" step="0.001" value={f("superRate") ?? ""} onChange={(e) => setN("superRate", e.target.value)} data-testid="input-super" /></Field>
                <Field label="Workcover (decimal)"><Input type="number" step="0.00001" value={f("workcoverRate") ?? ""} onChange={(e) => setN("workcoverRate", e.target.value)} data-testid="input-workcover" /></Field>
                <Field label="Payroll tax (decimal)"><Input type="number" step="0.0001" value={f("payrollTaxRate") ?? ""} onChange={(e) => setN("payrollTaxRate", e.target.value)} data-testid="input-payroll" /></Field>
              </div>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vehicle running cost ($/km)</h4>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Ute"><Input type="number" step="0.01" value={f("vehicleRateUte") ?? ""} onChange={(e) => setN("vehicleRateUte", e.target.value)} data-testid="input-veh-ute" /></Field>
                <Field label="Rigid"><Input type="number" step="0.01" value={f("vehicleRateRigid") ?? ""} onChange={(e) => setN("vehicleRateRigid", e.target.value)} data-testid="input-veh-rigid" /></Field>
                <Field label="Semi"><Input type="number" step="0.01" value={f("vehicleRateSemi") ?? ""} onChange={(e) => setN("vehicleRateSemi", e.target.value)} data-testid="input-veh-semi" /></Field>
                <Field label="B-Double"><Input type="number" step="0.01" value={f("vehicleRateBdouble") ?? ""} onChange={(e) => setN("vehicleRateBdouble", e.target.value)} data-testid="input-veh-bdouble" /></Field>
              </div>
            </div>
            <p className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
              Loaded rate = base × OT × (1 + super) × (1 + workcover + payroll). Per leg cost = hours × loaded rate. Vehicle cost = km × $/km for the selected class.
            </p>
          </div>
        </Card>

        {/* Depot */}
        <Card className="p-5">
          <SectionTitle icon={MapPin} title="Depot" desc="Default origin for route planning and distance calculations." />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3"><Field label="Depot address"><Input value={f("depotAddress") ?? ""} onChange={(e) => setS("depotAddress", e.target.value)} data-testid="input-depot-address" /></Field></div>
            <Field label="Latitude"><Input type="number" step="0.0001" value={f("depotLat") ?? ""} onChange={(e) => setN("depotLat", e.target.value)} data-testid="input-depot-lat" /></Field>
            <Field label="Longitude"><Input type="number" step="0.0001" value={f("depotLng") ?? ""} onChange={(e) => setN("depotLng", e.target.value)} data-testid="input-depot-lng" /></Field>
          </div>
        </Card>

        {/* Maps key */}
        <Card className="p-5">
          <SectionTitle icon={KeyRound} title="Google Maps API key" desc="Stored server-side and never exposed in the tender data. Used to render live maps and proxy Distance/Directions calls." />
          <Field label={data.hasGoogleMapsApiKey ? "API key (set — enter a new value to replace)" : "API key (not set)"}>
            <Input type="password" placeholder={data.hasGoogleMapsApiKey ? "•••••••••••• stored" : "Paste your Google Maps API key"}
              value={apiKey} onChange={(e) => setApiKey(e.target.value)} data-testid="input-maps-key" />
          </Field>
          <p className="mt-2 text-xs text-muted-foreground">Without a key, maps fall back to a schematic preview and distances use a haversine estimate.</p>
        </Card>

        {/* Profile */}
        <Card className="p-5">
          <SectionTitle icon={User} title="Profile" desc="Your account details." />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input value={f("profileName") ?? ""} onChange={(e) => setS("profileName", e.target.value)} data-testid="input-profile-name" /></Field>
            <Field label="Email"><Input type="email" value={f("profileEmail") ?? ""} onChange={(e) => setS("profileEmail", e.target.value)} data-testid="input-profile-email" /></Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-save-settings">
            <Save className="mr-1.5 h-4 w-4" />{save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function SectionTitle({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="mb-4 flex items-start gap-2.5">
      <span className="rounded-md bg-primary/12 p-1.5 text-primary"><Icon className="h-4 w-4" /></span>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
