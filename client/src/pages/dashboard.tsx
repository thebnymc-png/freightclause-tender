import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { FileText, DollarSign, TrendingUp, Percent } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { KpiCard } from "@/components/kpi-card";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { aud, num, pct, shortDate, FORMAT_LABELS } from "@/lib/format";
import type { Tender } from "@shared/schema";

type Kpis = {
  activeTenders: number; weeklyExposure: number; annualPipeline: number; blendedMargin: number;
  topLanes: { label: string; origin: string; destination: string; gp: number; tenderRef: string }[];
  monthly: { month: string; revenue: number; cost: number }[];
  recentTenders: Tender[];
};

export default function Dashboard() {
  const { data, isLoading } = useQuery<Kpis>({ queryKey: ["/api/dashboard/kpis"] });

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {isLoading || !data ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px] rounded-xl" />)
          ) : (
            <>
              <KpiCard label="Active tenders" value={num(data.activeTenders)} icon={FileText} accent testId="kpi-active-tenders" />
              <KpiCard label="Weekly $ exposure" value={aud(data.weeklyExposure)} sub="across all live lanes" icon={DollarSign} testId="kpi-weekly" />
              <KpiCard label="Annual pipeline" value={aud(data.annualPipeline)} sub="weekly × 52" icon={TrendingUp} testId="kpi-annual" />
              <KpiCard label="Blended margin" value={pct(data.blendedMargin)} sub="revenue-weighted GP" icon={Percent} accent testId="kpi-margin" />
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chart */}
          <Card className="p-4 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Revenue vs cost — last 6 months</h2>
              <span className="text-xs text-muted-foreground">Monthly, AUD</span>
            </div>
            <div className="h-64">
              {data && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthly} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip
                      formatter={(v: number) => aud(v)}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cost" name="Cost" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          {/* Top lanes */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Top 5 lanes by GP</h2>
            <div className="space-y-2">
              {data?.topLanes.map((l, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2" data-testid={`row-toplane-${i}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold" title={l.label}>{l.destination}</p>
                    <p className="truncate text-xs text-muted-foreground" title={l.label}>{l.origin} · {l.tenderRef}</p>
                  </div>
                  <span className="tnum shrink-0 text-sm font-semibold text-primary">{aud(l.gp)}/wk</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent tenders */}
        <Card className="p-0">
          <div className="flex items-center justify-between p-4">
            <h2 className="text-sm font-semibold">Recent tenders</h2>
            <Link href="/tenders"><a className="text-sm font-medium text-primary hover:underline" data-testid="link-view-all-tenders">View all</a></Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tender</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Format</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.recentTenders.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" data-testid={`row-tender-${t.id}`}>
                  <TableCell>
                    <Link href={`/tenders/${t.id}`}><a className="font-medium text-primary hover:underline tnum">{t.tenderRef}</a></Link>
                  </TableCell>
                  <TableCell>{t.customerName}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{FORMAT_LABELS[t.format]}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground tnum">{shortDate(t.createdAt)}</TableCell>
                  <TableCell className="text-right"><StatusBadge decision={t.decision} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
