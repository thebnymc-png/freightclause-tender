import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { GoogleMap, useJsApiLoader, Marker, Polyline } from "@react-google-maps/api";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, MapPin, Plus, Trash2, Wand2, Navigation, Clock, Gauge, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { aud, num } from "@/lib/format";
import { cn } from "@/lib/utils";

type MapsConfig = { apiKey: string; depot: { lat: number; lng: number; address: string } };

export type PlannerRoute = {
  id?: number; name: string; depot: string; stops: string[];
  totalKm?: number; totalTimeMin?: number; costPerTrip?: number;
};

const COORDS: Record<string, [number, number]> = {
  brisbane: [-27.4698, 153.0251], "acacia ridge": [-27.5833, 153.0333], wacol: [-27.5833, 152.9333],
  richlands: [-27.5667, 152.9667], toowoomba: [-27.5598, 151.9507], "gold coast": [-28.0167, 153.4],
  "sunshine coast": [-26.65, 153.0667], ipswich: [-27.6167, 152.76], logan: [-27.6392, 153.1086],
  caboolture: [-27.0833, 152.95], redlands: [-27.53, 153.25], springfield: [-27.67, 152.92],
  beenleigh: [-27.71, 153.2], sunnybank: [-27.571, 153.059], "mount gravatt": [-27.538, 153.079],
  carindale: [-27.51, 153.101], cleveland: [-27.526, 153.264], "forest lake": [-27.623, 152.969],
  "browns plains": [-27.662, 153.047], goodna: [-27.613, 152.898], "sunnybank hills": [-27.61, 153.05],
};
function coord(name: string): { lat: number; lng: number } | null {
  const k = name.toLowerCase();
  for (const key of Object.keys(COORDS)) if (k.includes(key)) return { lat: COORDS[key][0], lng: COORDS[key][1] };
  return null;
}

function SortableStop({ id, value, index, onChange, onRemove }: {
  id: string; value: string; index: number; onChange: (v: string) => void; onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5", isDragging && "opacity-60 shadow-lg")}
      data-testid={`stop-row-${index}`}>
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground touch-none" aria-label="Drag to reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary tnum">{index + 1}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 border-0 px-1 shadow-none focus-visible:ring-0" data-testid={`input-stop-${index}`} />
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive" aria-label="Remove stop" data-testid={`button-remove-stop-${index}`}>
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

const LIBS: any = [];

export function RoutePlanner({ route, onChange }: { route: PlannerRoute; onChange?: (r: PlannerRoute) => void }) {
  const { data: config } = useQuery<MapsConfig>({ queryKey: ["/api/maps/config"] });
  const apiKey = config?.apiKey || "";
  const { isLoaded } = useJsApiLoader({ id: "gmap-loader", googleMapsApiKey: apiKey, libraries: LIBS });

  const [stops, setStops] = useState<string[]>(route.stops);
  const [depot, setDepot] = useState(route.depot);
  const [metrics, setMetrics] = useState<{ totalKm: number; durationMin: number; trafficMin: number; cost: number } | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => { setStops(route.stops); setDepot(route.depot); }, [route.id]);

  const idStops = useMemo(() => stops.map((s, i) => ({ id: `s-${i}`, value: s })), [stops]);

  const points = useMemo(() => {
    const all = [depot, ...stops, depot].map(coord).filter(Boolean) as { lat: number; lng: number }[];
    return all;
  }, [depot, stops]);

  // compute metrics whenever stops/depot change
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest("POST", "/api/maps/directions", {
          origin: depot, destination: depot, waypoints: stops, optimize: false,
        });
        const d = await res.json();
        if (!active) return;
        const totalKm = d.source === "google" && d.data?.routes?.[0]
          ? d.data.routes[0].legs.reduce((s: number, l: any) => s + l.distance.value, 0) / 1000
          : d.totalKm || 0;
        const durationMin = d.durationMin ?? Math.round((totalKm / 45) * 60);
        const trafficMin = d.trafficMin ?? Math.round((totalKm / 38) * 60);
        const cost = Math.round(totalKm * 1.85 + (durationMin / 60) * 38);
        setMetrics({ totalKm: Math.round(totalKm), durationMin, trafficMin, cost });
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [depot, JSON.stringify(stops)]);

  const emit = (next: { stops?: string[]; depot?: string }) => {
    const r = { ...route, stops: next.stops ?? stops, depot: next.depot ?? depot };
    onChange?.(r);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = idStops.findIndex((s) => s.id === active.id);
    const newI = idStops.findIndex((s) => s.id === over.id);
    const next = arrayMove(stops, oldI, newI);
    setStops(next); emit({ stops: next });
  };

  const optimize = async () => {
    setOptimizing(true);
    try {
      const res = await apiRequest("POST", "/api/maps/directions", {
        origin: depot, destination: depot, waypoints: stops, optimize: true,
      });
      const d = await res.json();
      let order: number[] | undefined;
      if (d.source === "google") order = d.data?.routes?.[0]?.waypoint_order;
      // fallback: nearest-neighbour from depot
      if (!order) {
        const depotC = coord(depot);
        if (depotC) {
          const remaining = stops.map((s, i) => i);
          const result: number[] = [];
          let cur = depotC;
          while (remaining.length) {
            let best = 0, bestD = Infinity;
            remaining.forEach((idx, ri) => {
              const c = coord(stops[idx]);
              if (!c) return;
              const dist = (c.lat - cur.lat) ** 2 + (c.lng - cur.lng) ** 2;
              if (dist < bestD) { bestD = dist; best = ri; }
            });
            const chosen = remaining.splice(best, 1)[0];
            result.push(chosen);
            cur = coord(stops[chosen]) || cur;
          }
          order = result;
        }
      }
      if (order) {
        const next = order.map((i) => stops[i]);
        setStops(next); emit({ stops: next });
      }
    } finally { setOptimizing(false); }
  };

  const center = points[0] || { lat: config?.depot.lat ?? -27.5833, lng: config?.depot.lng ?? 153.0333 };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* Left: stops */}
      <Card className="p-4">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Depot</label>
        <div className="mb-3 flex items-center gap-2 rounded-md border border-border px-2 py-1.5">
          <MapPin className="h-4 w-4 text-primary" />
          <Input value={depot} onChange={(e) => { setDepot(e.target.value); emit({ depot: e.target.value }); }}
            className="h-8 border-0 px-1 shadow-none focus-visible:ring-0" data-testid="input-depot" />
        </div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Stops ({stops.length})</label>
          <Button size="sm" variant="outline" className="h-7"
            onClick={() => { const next = [...stops, ""]; setStops(next); emit({ stops: next }); }} data-testid="button-add-stop">
            <Plus className="mr-1 h-3.5 w-3.5" />Add
          </Button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={idStops.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {idStops.map((s, i) => (
                <SortableStop key={s.id} id={s.id} value={s.value} index={i}
                  onChange={(v) => { const next = [...stops]; next[i] = v; setStops(next); emit({ stops: next }); }}
                  onRemove={() => { const next = stops.filter((_, idx) => idx !== i); setStops(next); emit({ stops: next }); }} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button className="mt-3 w-full" variant="secondary" onClick={optimize} disabled={optimizing || stops.length < 2} data-testid="button-optimize">
          <Wand2 className="mr-1.5 h-4 w-4" />{optimizing ? "Optimising…" : "Optimize route order"}
        </Button>

        {/* metrics */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Metric icon={Navigation} label="Total km" value={metrics ? num(metrics.totalKm) : "—"} />
          <Metric icon={Clock} label="Drive time" value={metrics ? `${Math.floor(metrics.durationMin / 60)}h ${metrics.durationMin % 60}m` : "—"} />
          <Metric icon={Gauge} label="Traffic-adj" value={metrics ? `${Math.floor(metrics.trafficMin / 60)}h ${metrics.trafficMin % 60}m` : "—"} />
          <Metric icon={DollarSign} label="Cost/trip" value={metrics ? aud(metrics.cost) : "—"} />
        </div>
      </Card>

      {/* Right: map */}
      <Card className="relative min-h-[420px] overflow-hidden p-0">
        {isLoaded && apiKey ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "100%", minHeight: 420 }}
            center={center} zoom={10}
            options={{ disableDefaultUI: false, streetViewControl: false, mapTypeControl: false }}
          >
            {points.map((p, i) => <Marker key={i} position={p} label={i === 0 ? "D" : String(i)} />)}
            <Polyline path={points} options={{ strokeColor: "#01696F", strokeWeight: 4, strokeOpacity: 0.85 }} />
          </GoogleMap>
        ) : (
          <FallbackMap points={points} stops={stops} depot={depot} />
        )}
      </Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <p className="mt-0.5 text-sm font-semibold tnum">{value}</p>
    </div>
  );
}

// Schematic fallback when no Google Maps key — draws stops on an SVG canvas
function FallbackMap({ points, stops, depot }: { points: { lat: number; lng: number }[]; stops: string[]; depot: string }) {
  const all = points.length ? points : [{ lat: -27.58, lng: 153.03 }];
  const lats = all.map((p) => p.lat), lngs = all.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const W = 600, H = 420, pad = 50;
  const x = (lng: number) => maxLng === minLng ? W / 2 : pad + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * pad);
  const y = (lat: number) => maxLat === minLat ? H / 2 : pad + ((maxLat - lat) / (maxLat - minLat)) * (H - 2 * pad);
  const labels = [depot, ...stops, depot];

  return (
    <div className="relative h-full w-full bg-muted/40" data-testid="map-fallback">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        <polyline points={all.map((p) => `${x(p.lng)},${y(p.lat)}`).join(" ")} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeOpacity="0.8" strokeDasharray="6 4" />
        {all.map((p, i) => (
          <g key={i}>
            <circle cx={x(p.lng)} cy={y(p.lat)} r={i === 0 || i === all.length - 1 ? 9 : 7} fill="hsl(var(--primary))" />
            <text x={x(p.lng)} y={y(p.lat) + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="hsl(var(--primary-foreground))">
              {i === 0 || i === all.length - 1 ? "D" : i}
            </text>
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 bg-gradient-to-t from-background/95 to-transparent p-3 text-center">
        <p className="text-xs font-medium text-muted-foreground">Schematic preview — add a Google Maps API key in Settings for the live map.</p>
      </div>
    </div>
  );
}
