import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { shortDate, FORMAT_LABELS } from "@/lib/format";
import type { Tender } from "@shared/schema";

function NewTenderDialog() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [form, setForm] = useState({
    tenderRef: "", customerName: "", format: "lane_list", industry: "", term: "24 months",
    incumbentCarrier: "", targetMargin: 18, fuelLevy: 12, gstRate: 10,
  });

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tenders", form);
      return res.json();
    },
    onSuccess: (t: Tender) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      setOpen(false);
      toast({ title: "Tender created", description: `${t.tenderRef} — continue in Intake.` });
      navigate(`/tenders/${t.id}`);
    },
  });

  const ref = form.tenderRef || `JDT-${String(Math.floor(Math.random() * 9000) + 1000)}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-tender"><Plus className="mr-1.5 h-4 w-4" />New Tender</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>New tender</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ref">Tender reference</Label>
              <Input id="ref" placeholder={ref} value={form.tenderRef}
                onChange={(e) => setForm({ ...form, tenderRef: e.target.value })} data-testid="input-tender-ref" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust">Customer</Label>
              <Input id="cust" placeholder="QFresh" value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })} data-testid="input-customer" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select value={form.format} onValueChange={(v) => setForm({ ...form, format: v })}>
                <SelectTrigger data-testid="select-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ind">Industry</Label>
              <Input id="ind" placeholder="Produce / Grocery" value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })} data-testid="input-industry" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tm">Target margin %</Label>
              <Input id="tm" type="number" value={form.targetMargin}
                onChange={(e) => setForm({ ...form, targetMargin: Number(e.target.value) })} data-testid="input-target-margin" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fl">Fuel levy %</Label>
              <Input id="fl" type="number" value={form.fuelLevy}
                onChange={(e) => setForm({ ...form, fuelLevy: Number(e.target.value) })} data-testid="input-fuel-levy" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gst">GST %</Label>
              <Input id="gst" type="number" value={form.gstRate}
                onChange={(e) => setForm({ ...form, gstRate: Number(e.target.value) })} data-testid="input-gst" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc">Incumbent carrier</Label>
            <Input id="inc" placeholder="e.g. FreshLine Transport" value={form.incumbentCarrier}
              onChange={(e) => setForm({ ...form, incumbentCarrier: e.target.value })} data-testid="input-incumbent" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => create.mutate()}
            disabled={!form.customerName || create.isPending}
            data-testid="button-create-tender"
          >
            {create.isPending ? "Creating…" : "Create & open Intake"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Tenders() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");
  const { data: tenders, isLoading } = useQuery<Tender[]>({ queryKey: ["/api/tenders"] });

  const filtered = useMemo(() => {
    let rows = tenders ?? [];
    if (statusFilter !== "all") rows = rows.filter((t) => t.decision === statusFilter);
    if (q) rows = rows.filter((t) =>
      t.tenderRef.toLowerCase().includes(q.toLowerCase()) ||
      t.customerName.toLowerCase().includes(q.toLowerCase()));
    return [...rows].sort((a, b) => b.createdAt - a.createdAt);
  }, [tenders, statusFilter, q]);

  return (
    <AppShell title="Tenders">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by ref or customer…" value={q}
              onChange={(e) => setQ(e.target.value)} className="pl-8" data-testid="input-search-tenders" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40" data-testid="select-status-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="go">GO</SelectItem>
              <SelectItem value="review">REVIEW</SelectItem>
              <SelectItem value="no_go">NO-GO</SelectItem>
              <SelectItem value="pending">PENDING</SelectItem>
            </SelectContent>
          </Select>
          <div className="sm:ml-auto"><NewTenderDialog /></div>
        </div>

        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tender ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Format</TableHead>
                <TableHead className="hidden lg:table-cell">Industry</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
              ))}
              {filtered.map((t) => (
                <TableRow key={t.id} data-testid={`row-tender-${t.id}`}>
                  <TableCell>
                    <Link href={`/tenders/${t.id}`}>
                      <a className="font-semibold text-primary hover:underline tnum" data-testid={`link-tender-${t.id}`}>{t.tenderRef}</a>
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{t.customerName}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{FORMAT_LABELS[t.format]}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{t.industry || "—"}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground tnum">{shortDate(t.createdAt)}</TableCell>
                  <TableCell className="text-right"><StatusBadge decision={t.decision} /></TableCell>
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No tenders match your filters.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
