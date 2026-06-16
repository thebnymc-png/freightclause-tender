import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Route as RouteIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { RoutePlanner, type PlannerRoute } from "@/components/route-planner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { num } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Route as RouteRow } from "@shared/schema";

export default function RoutesPage() {
  const { data: routes, isLoading } = useQuery<RouteRow[]>({
    queryKey: ["/api/routes", "standalone"],
    queryFn: async () => { const res = await apiRequest("GET", "/api/routes?tenderId=null"); return res.json(); },
  });
  const [selected, setSelected] = useState<number | "new" | null>(null);

  const blank: PlannerRoute = { name: "New ad-hoc route", depot: "Acacia Ridge, Brisbane QLD", stops: ["Sunnybank QLD", "Mount Gravatt QLD"] };
  const active: PlannerRoute | null =
    selected === "new" ? blank :
    selected != null && routes ? (() => {
      const r = routes.find((x) => x.id === selected);
      return r ? { id: r.id, name: r.name, depot: r.depot, stops: JSON.parse(r.stopsJson) } : null;
    })() : null;

  return (
    <AppShell title="Routes">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Ad-hoc route planner — independent of any tender.</p>
          <Button size="sm" onClick={() => setSelected("new")} data-testid="button-new-route"><Plus className="mr-1.5 h-4 w-4" />New route</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          {routes?.map((r) => {
            const stops = JSON.parse(r.stopsJson) as string[];
            return (
              <Card key={r.id}
                className={cn("cursor-pointer p-4 hover-elevate", selected === r.id && "ring-2 ring-primary")}
                onClick={() => setSelected(r.id)} data-testid={`route-card-${r.id}`}>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-primary/12 p-1.5 text-primary"><RouteIcon className="h-4 w-4" /></span>
                  <p className="text-sm font-semibold">{r.name}</p>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{r.depot}</p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground tnum">
                  <span>{stops.length} stops</span>
                  <span>{num(r.totalKm)} km</span>
                  <span>{Math.floor(r.totalTimeMin / 60)}h {r.totalTimeMin % 60}m</span>
                </div>
              </Card>
            );
          })}
        </div>

        {active && (
          <div className="pt-2">
            <h2 className="mb-3 text-sm font-semibold">{active.name}</h2>
            <RoutePlanner route={active} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
