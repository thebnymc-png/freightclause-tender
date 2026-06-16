import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronLeft, Mail } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { aud, relativeTime, FORMAT_LABELS } from "@/lib/format";
import type { Customer, Tender, Lane } from "@shared/schema";

type Kpis = { recentTenders: Tender[] };

export default function Customers() {
  const { data: customers, isLoading } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: tenders } = useQuery<Tender[]>({ queryKey: ["/api/tenders"] });
  const [selected, setSelected] = useState<Customer | null>(null);

  // exposure approximation per customer: sum of proposed weekly across their tenders' lanes — fetched lazily per detail
  const summary = useMemo(() => {
    const map: Record<string, { active: number; last: number }> = {};
    (tenders ?? []).forEach((t) => {
      const e = map[t.customerName] || { active: 0, last: 0 };
      if (t.decision !== "no_go") e.active++;
      e.last = Math.max(e.last, t.createdAt);
      map[t.customerName] = e;
    });
    return map;
  }, [tenders]);

  if (selected) return <CustomerDetail customer={selected} tenders={(tenders ?? []).filter((t) => t.customerName === selected.name)} onBack={() => setSelected(null)} />;

  return (
    <AppShell title="Customers">
      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden sm:table-cell">Industry</TableHead>
              <TableHead className="text-right">Active tenders</TableHead>
              <TableHead className="text-right hidden md:table-cell">Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
            ))}
            {customers?.map((c) => {
              const s = summary[c.name] || { active: 0, last: 0 };
              return (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c)} data-testid={`customer-row-${c.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <span className="rounded-md bg-primary/12 p-1.5 text-primary"><Building2 className="h-4 w-4" /></span>
                      <span className="font-medium">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{c.industry || "—"}</TableCell>
                  <TableCell className="text-right tnum font-medium">{s.active}</TableCell>
                  <TableCell className="text-right text-muted-foreground tnum hidden md:table-cell">{s.last ? relativeTime(s.last) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </AppShell>
  );
}

function CustomerDetail({ customer, tenders, onBack }: { customer: Customer; tenders: Tender[]; onBack: () => void }) {
  return (
    <AppShell title={customer.name}>
      <div className="space-y-5">
        <button onClick={onBack} className="flex items-center text-sm text-muted-foreground hover:text-foreground" data-testid="link-back-customers">
          <ChevronLeft className="h-4 w-4" />Customers
        </button>
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-primary/12 p-2.5 text-primary"><Building2 className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-bold">{customer.name}</h2>
              <p className="text-sm text-muted-foreground">{customer.industry}</p>
              {customer.contactEmail && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" />{customer.contactEmail}</p>
              )}
            </div>
          </div>
          {customer.notes && <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{customer.notes}</p>}
        </Card>

        <Card className="p-0 overflow-hidden">
          <h3 className="p-4 text-sm font-semibold">Tenders ({tenders.length})</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tender</TableHead>
                <TableHead className="hidden sm:table-cell">Format</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenders.map((t) => (
                <TableRow key={t.id} data-testid={`cust-tender-${t.id}`}>
                  <TableCell><Link href={`/tenders/${t.id}`}><a className="font-medium text-primary hover:underline tnum">{t.tenderRef}</a></Link></TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{FORMAT_LABELS[t.format]}</TableCell>
                  <TableCell className="text-right"><StatusBadge decision={t.decision} /></TableCell>
                </TableRow>
              ))}
              {tenders.length === 0 && <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">No tenders yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
