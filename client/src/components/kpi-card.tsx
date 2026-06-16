import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function KpiCard({
  label, value, sub, icon: Icon, accent, testId,
}: {
  label: string; value: string; sub?: string; icon?: LucideIcon; accent?: boolean; testId?: string;
}) {
  return (
    <Card className="p-4" data-testid={testId}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon && (
          <span className={cn("rounded-md p-1.5", accent ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground")}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-bold tnum tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground tnum">{sub}</p>}
    </Card>
  );
}
