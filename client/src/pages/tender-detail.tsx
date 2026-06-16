import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ChevronLeft, UploadCloud, FileSpreadsheet, Check, Download, FileText,
  ArrowRight, TrendingUp, DollarSign, Percent, Truck,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { RoutePlanner, type PlannerRoute } from "@/components/route-planner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient, API_BASE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  aud, num, pct, FORMAT_LABELS, laneWeekly, laneMargin, laneStatus,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Tender, Lane } from "@shared/schema";

const FORMAT_PRESETS: Record<string, { fields: Record<string, string[]> }> = {
  lane_list: { fields: { origin: ["origin", "from", "pickup", "depot"], destination: ["destination", "to", "drop", "delivery"], vehicle: ["vehicle", "truck", "equipment"], pallets: ["pallets", "pallet", "units"], tripsPerWeek: ["trips", "frequency", "trips/week", "freq"] } },
  multi_drop: { fields: { origin: ["origin", "depot", "from"], destination: ["destination", "stop", "to"], stops: ["stops", "drops", "no. stops"], pallets: ["pallets", "units"], tripsPerWeek: ["trips", "frequency"] } },
  dc_volumes: { fields: { origin: ["dc", "origin", "warehouse"], destination: ["destination", "store", "region"], pallets: ["volume", "pallets", "cartons"], tripsPerWeek: ["trips", "deliveries"] } },
  rate_card: { fields: { origin: ["origin", "from"], destination: ["destination", "to", "zone"], vehicle: ["vehicle", "class"], incumbentRate: ["rate", "price", "current rate"] } },
  rfp_narrative: { fields: { origin: ["origin", "from"], destination: ["destination", "to"], pallets: ["pallets", "volume"] } },
};

// ---------------- Intake tab ----------------
function IntakeTab({ tender }: { tender: Tender }) {
  const { toast } = useToast();
  const [parsed, setParsed] = useState<{ columns: string[]; rows: any[]; totalRows: number } | null>(null);
  const [format, setFormat] = useState(tender.format);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  const onDrop = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", files[0]);
      const res = await fetch(`${API_BASE}/api/upload/parse`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      setParsed(data);
      autoSuggest(data.columns, format);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  };

  const autoSuggest = (columns: string[], fmt: string) => {
    const preset = FORMAT_PRESETS[fmt];
    const next: Record<string, string> = {};
    for (const [field, aliases] of Object.entries(preset.fields)) {
      const match = columns.find((c) => aliases.some((a) => c.toLowerCase().trim().includes(a)));
      if (match) next[field] = match;
    }
    setMapping(next);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: {
      "text/csv": [".csv"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
  });

  const importLanes = useMutation({
    mutationFn: async () => {
      const rows = parsed!.rows.map((r) => ({
        origin: String(r[mapping.origin] ?? "Acacia Ridge DC"),
        destination: String(r[mapping.destination] ?? "—"),
        vehicle: String(r[mapping.vehicle] ?? "Rigid"),
        pallets: Number(r[mapping.pallets]) || 0,
        tripsPerWeek: Number(r[mapping.tripsPerWeek]) || 1,
        stops: Number(r[mapping.stops]) || 1,
        incumbentRate: Number(r[mapping.incumbentRate]) || 0,
        distanceKm: 0, costPerTrip: 0, proposedRate: 0,
      }));
      const res = await apiRequest("POST", `/api/tenders/${tender.id}/lanes`, rows);
      return res.json();
    },
    onSuccess: (rows) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tender.id, "lanes"] });
      toast({ title: "Lanes imported", description: `${rows.length} rows added to the workspace.` });
      setParsed(null);
    },
  });

  return (
    <div className="space-y-5">
      <div {...getRootProps()}
        className={cn("flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 px-6 py-12 text-center transition-colors hover:border-primary/50",
          isDragActive && "border-primary bg-primary/5")}
        data-testid="dropzone-upload">
        <input {...getInputProps()} data-testid="input-file" />
        <UploadCloud className="mb-3 h-8 w-8 text-primary" />
        <p className="text-sm font-medium">{uploading ? "Parsing…" : "Drag & drop an Excel or CSV file"}</p>
        <p className="mt-1 text-xs text-muted-foreground">.xlsx, .xls or .csv — first sheet is parsed</p>
      </div>

      {parsed && (
        <>
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold">Column mapping</h3>
            <div className="mb-4">
              <Label className="mb-1.5 block text-xs">Detected format</Label>
              <Select value={format} onValueChange={(v) => { setFormat(v); autoSuggest(parsed.columns, v); }}>
                <SelectTrigger className="w-full sm:w-56" data-testid="select-intake-format"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMAT_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.keys(FORMAT_PRESETS[format].fields).map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label className="text-xs capitalize">{field.replace(/([A-Z])/g, " $1")}</Label>
                  <Select value={mapping[field] || "__none"} onValueChange={(v) => setMapping({ ...mapping, [field]: v === "__none" ? "" : v })}>
                    <SelectTrigger data-testid={`map-${field}`}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— not mapped —</SelectItem>
                      {parsed.columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between p-4">
              <h3 className="text-sm font-semibold">Preview — first 5 of {num(parsed.totalRows)} rows</h3>
              <Button size="sm" onClick={() => importLanes.mutate()} disabled={importLanes.isPending} data-testid="button-import-lanes">
                <Check className="mr-1.5 h-4 w-4" />{importLanes.isPending ? "Importing…" : "Import to workspace"}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>{parsed.columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {parsed.rows.slice(0, 5).map((r, i) => (
                    <TableRow key={i} data-testid={`preview-row-${i}`}>
                      {parsed.columns.map((c) => <TableCell key={c} className="tnum whitespace-nowrap">{String(r[c])}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ---------------- Workspace tab ----------------
function WorkspaceTab({ tender, lanes, isLoading }: { tender: Tender; lanes: Lane[]; isLoading: boolean }) {
  const { toast } = useToast();
  const goT = tender.targetMargin, reviewT = Math.max(tender.targetMargin - 8, 10);

  const update = useMutation({
    mutationFn: async ({ id, proposedRate }: { id: number; proposedRate: number }) => {
      const res = await apiRequest("PATCH", `/api/lanes/${id}`, { proposedRate });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tender.id, "lanes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
    },
  });

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (!lanes.length) return (
    <Card className="p-10 text-center">
      <FileSpreadsheet className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm font-medium">No lanes yet</p>
      <p className="mt-1 text-xs text-muted-foreground">Upload a file in the Intake tab to populate the workspace.</p>
    </Card>
  );

  return (
    <Card className="p-0 overflow-hidden">
      <div className="max-h-[600px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow>
              <TableHead>Lane</TableHead>
              <TableHead className="hidden md:table-cell">Vehicle</TableHead>
              <TableHead className="text-right">Trips/wk</TableHead>
              <TableHead className="text-right hidden sm:table-cell">Dist km</TableHead>
              <TableHead className="text-right">Cost/trip</TableHead>
              <TableHead className="text-right">JDT proposed $</TableHead>
              <TableHead className="text-right">Weekly $</TableHead>
              <TableHead className="text-right">Margin</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lanes.map((l) => {
              const margin = laneMargin(l.proposedRate, l.costPerTrip);
              const status = laneStatus(margin, goT, reviewT);
              return (
                <TableRow key={l.id} data-testid={`lane-row-${l.id}`}>
                  <TableCell className="font-medium whitespace-nowrap">{l.origin} <ArrowRight className="inline h-3 w-3 text-muted-foreground" /> {l.destination}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{l.vehicle}</TableCell>
                  <TableCell className="text-right tnum">{l.tripsPerWeek}</TableCell>
                  <TableCell className="text-right tnum hidden sm:table-cell">{num(l.distanceKm)}</TableCell>
                  <TableCell className="text-right tnum">{aud(l.costPerTrip)}</TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number" defaultValue={l.proposedRate}
                      className="ml-auto h-8 w-24 text-right tnum"
                      data-testid={`input-proposed-${l.id}`}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== l.proposedRate) update.mutate({ id: l.id, proposedRate: v });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right tnum font-medium">{aud(laneWeekly(l.proposedRate, l.tripsPerWeek))}</TableCell>
                  <TableCell className="text-right tnum">{pct(margin)}</TableCell>
                  <TableCell className="text-right"><StatusBadge decision={status} /></TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

// ---------------- Multi-Drop tab ----------------
function MultiDropTab({ tender }: { tender: Tender }) {
  const { data: routes } = useQuery<any[]>({ queryKey: ["/api/routes", { tenderId: tender.id }], queryFn: async () => {
    const res = await apiRequest("GET", `/api/routes?tenderId=${tender.id}`);
    return res.json();
  } });
  const fallback: PlannerRoute = {
    name: `${tender.tenderRef} multi-drop`, depot: "Acacia Ridge, Brisbane QLD",
    stops: ["Sunnybank QLD", "Mount Gravatt QLD", "Carindale QLD", "Cleveland QLD"],
  };
  const [route, setRoute] = useState<PlannerRoute>(fallback);
  return <RoutePlanner route={route} onChange={setRoute} />;
}

// ---------------- Summary tab ----------------
function SummaryTab({ tender, lanes }: { tender: Tender; lanes: Lane[] }) {
  const { toast } = useToast();
  const goT = tender.targetMargin, reviewT = Math.max(tender.targetMargin - 8, 10);
  const stats = useMemo(() => {
    let rev = 0, cost = 0, incRev = 0;
    const counts = { go: 0, review: 0, no_go: 0 };
    const gp: { label: string; gp: number }[] = [];
    for (const l of lanes) {
      const wk = laneWeekly(l.proposedRate, l.tripsPerWeek);
      const c = l.costPerTrip * l.tripsPerWeek;
      rev += wk; cost += c; incRev += l.incumbentRate * l.tripsPerWeek;
      const m = laneMargin(l.proposedRate, l.costPerTrip);
      counts[laneStatus(m, goT, reviewT)]++;
      gp.push({ label: `${l.origin} → ${l.destination}`, gp: wk - c });
    }
    const blended = rev > 0 ? ((rev - cost) / rev) * 100 : 0;
    const topLanes = gp.sort((a, b) => b.gp - a.gp).slice(0, 5);
    return { rev, cost, incRev, blended, counts, topLanes };
  }, [lanes, goT, reviewT]);

  const decision = stats.blended >= goT ? "go" : stats.blended >= reviewT ? "review" : "no_go";

  const setDecision = useMutation({
    mutationFn: async (d: string) => { await apiRequest("PATCH", `/api/tenders/${tender.id}`, { decision: d }); },
    onSuccess: (_d, d) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenders", tender.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/kpis"] });
      toast({ title: "Decision recorded", description: `Tender marked ${d.toUpperCase().replace("_", "-")}.` });
    },
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiMini icon={DollarSign} label="Weekly revenue" value={aud(stats.rev)} />
        <KpiMini icon={Truck} label="Weekly cost" value={aud(stats.cost)} />
        <KpiMini icon={TrendingUp} label="Annual GP" value={aud((stats.rev - stats.cost) * 52)} />
        <KpiMini icon={Percent} label="Blended margin" value={pct(stats.blended)} accent />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Decision panel */}
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Recommendation</h3>
          <div className="flex items-center gap-3">
            <StatusBadge decision={decision} className="text-sm px-3 py-1" />
            <span className="text-xs text-muted-foreground">
              Blended {pct(stats.blended)} vs GO ≥ {pct(goT, 0)} / REVIEW ≥ {pct(reviewT, 0)}
            </span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Override and record the final decision:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["go", "review", "no_go"].map((d) => (
              <Button key={d} size="sm" variant={tender.decision === d ? "default" : "outline"}
                onClick={() => setDecision.mutate(d)} data-testid={`button-decision-${d}`}>
                {d.toUpperCase().replace("_", "-")}
              </Button>
            ))}
          </div>
        </Card>

        {/* Incumbent vs JDT */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Incumbent vs JDT (weekly)</h3>
          <div className="space-y-2.5">
            <CompareRow label={tender.incumbentCarrier || "Incumbent"} value={aud(stats.incRev)} muted />
            <CompareRow label="JDT proposed" value={aud(stats.rev)} />
            <div className="border-t border-border pt-2.5">
              <CompareRow label="Delta" value={`${stats.rev - stats.incRev >= 0 ? "+" : ""}${aud(stats.rev - stats.incRev)}`}
                accent={stats.rev - stats.incRev <= 0} />
            </div>
          </div>
        </Card>

        {/* Status breakdown */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Lane status breakdown</h3>
          <div className="space-y-2.5">
            <BreakRow decision="go" count={stats.counts.go} total={lanes.length} />
            <BreakRow decision="review" count={stats.counts.review} total={lanes.length} />
            <BreakRow decision="no_go" count={stats.counts.no_go} total={lanes.length} />
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="mb-3 text-sm font-semibold">Top 5 lanes by GP</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {stats.topLanes.map((l, i) => (
            <div key={i} className="rounded-md border border-border p-3">
              <p className="truncate text-xs font-medium">{l.label}</p>
              <p className="mt-1 text-sm font-bold text-primary tnum">{aud(l.gp)}/wk</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KpiMini({ icon: Icon, label, value, accent }: any) {
  return (
    <Card className="p-3.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <p className={cn("mt-1.5 text-lg font-bold tnum", accent && "text-primary")}>{value}</p>
    </Card>
  );
}
function CompareRow({ label, value, muted, accent }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn("text-sm", muted && "text-muted-foreground")}>{label}</span>
      <span className={cn("text-sm font-semibold tnum", accent ? "text-destructive" : "")}>{value}</span>
    </div>
  );
}
function BreakRow({ decision, count, total }: { decision: string; count: number; total: number }) {
  const w = total ? (count / total) * 100 : 0;
  const colors: Record<string, string> = { go: "bg-[hsl(103_56%_36%)]", review: "bg-[hsl(20_73%_42%)]", no_go: "bg-[hsl(320_57%_48%)]" };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <StatusBadge decision={decision} />
        <span className="tnum text-muted-foreground">{count} lane{count !== 1 ? "s" : ""}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", colors[decision])} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

// ---------------- Quote tab ----------------
function QuoteTab({ tender, lanes }: { tender: Tender; lanes: Lane[] }) {
  const rows = lanes.map((l) => {
    const base = l.proposedRate;
    const fuel = base * (tender.fuelLevy / 100);
    const subtotal = base + fuel;
    const gst = subtotal * (tender.gstRate / 100);
    const allIn = subtotal + gst;
    return { lane: `${l.origin} → ${l.destination}`, base, fuel, gst, allIn, trips: l.tripsPerWeek };
  });

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setTextColor(1, 105, 111);
    doc.text("JD Refrigerated Transport — Quote", 14, 18);
    doc.setFontSize(10); doc.setTextColor(60);
    doc.text(`Tender: ${tender.tenderRef}`, 14, 26);
    doc.text(`Customer: ${tender.customerName}`, 14, 31);
    doc.text(`Term: ${tender.term || "—"}   Fuel levy: ${tender.fuelLevy}%   GST: ${tender.gstRate}%`, 14, 36);
    autoTable(doc, {
      startY: 42,
      head: [["Lane", "Base $", `Fuel ${tender.fuelLevy}%`, `GST ${tender.gstRate}%`, "All-in $", "Trips/wk"]],
      body: rows.map((r) => [r.lane, aud(r.base), aud(r.fuel), aud(r.gst), aud(r.allIn), String(r.trips)]),
      headStyles: { fillColor: [1, 105, 111] },
      styles: { fontSize: 8 },
    });
    doc.save(`${tender.tenderRef}-quote.pdf`);
  };

  const downloadCsv = () => {
    const data = rows.map((r) => ({
      Lane: r.lane, "Base $": r.base.toFixed(2), [`Fuel ${tender.fuelLevy}%`]: r.fuel.toFixed(2),
      [`GST ${tender.gstRate}%`]: r.gst.toFixed(2), "All-in $": r.allIn.toFixed(2), "Trips/wk": r.trips,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${tender.tenderRef}-quote.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={downloadPdf} data-testid="button-download-pdf"><Download className="mr-1.5 h-4 w-4" />Download PDF</Button>
        <Button variant="outline" onClick={downloadCsv} data-testid="button-download-csv"><Download className="mr-1.5 h-4 w-4" />Download CSV</Button>
      </div>
      <Card className="p-5">
        <div className="mb-4 flex items-start justify-between border-b border-border pb-4">
          <div>
            <h3 className="text-base font-bold">JD Refrigerated Transport</h3>
            <p className="text-xs text-muted-foreground">Cold-chain freight quote · Brisbane QLD</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p className="font-semibold text-foreground tnum">{tender.tenderRef}</p>
            <p>{tender.customerName}</p>
            <p>Term: {tender.term || "—"}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lane</TableHead>
                <TableHead className="text-right">Base $</TableHead>
                <TableHead className="text-right">Fuel {tender.fuelLevy}%</TableHead>
                <TableHead className="text-right">GST {tender.gstRate}%</TableHead>
                <TableHead className="text-right">All-in $</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i} data-testid={`quote-row-${i}`}>
                  <TableCell className="font-medium">{r.lane}</TableCell>
                  <TableCell className="text-right tnum">{aud(r.base)}</TableCell>
                  <TableCell className="text-right tnum text-muted-foreground">{aud(r.fuel)}</TableCell>
                  <TableCell className="text-right tnum text-muted-foreground">{aud(r.gst)}</TableCell>
                  <TableCell className="text-right tnum font-semibold">{aud(r.allIn)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// ---------------- Page ----------------
export default function TenderDetail() {
  const [, params] = useRoute("/tenders/:id");
  const id = Number(params?.id);
  const { data: tender, isLoading } = useQuery<Tender>({ queryKey: ["/api/tenders", id], queryFn: async () => {
    const res = await apiRequest("GET", `/api/tenders/${id}`); return res.json();
  } });
  const { data: lanes = [], isLoading: lanesLoading } = useQuery<Lane[]>({
    queryKey: ["/api/tenders", id, "lanes"],
    queryFn: async () => { const res = await apiRequest("GET", `/api/tenders/${id}/lanes`); return res.json(); },
  });

  if (isLoading || !tender) {
    return <AppShell title="Tender"><Skeleton className="h-96 w-full rounded-xl" /></AppShell>;
  }

  return (
    <AppShell title={tender.tenderRef}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/tenders"><a className="flex items-center text-sm text-muted-foreground hover:text-foreground" data-testid="link-back"><ChevronLeft className="h-4 w-4" />Tenders</a></Link>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight tnum">{tender.tenderRef}</h2>
            <StatusBadge decision={tender.decision} />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span><span className="font-medium text-foreground">{tender.customerName}</span></span>
            <span>{FORMAT_LABELS[tender.format]}</span>
            <span>Target {pct(tender.targetMargin, 0)}</span>
            <span>Fuel {tender.fuelLevy}% · GST {tender.gstRate}%</span>
          </div>
        </div>

        <Tabs defaultValue="intake">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="intake" data-testid="tab-intake">Intake</TabsTrigger>
            <TabsTrigger value="workspace" data-testid="tab-workspace">Workspace</TabsTrigger>
            <TabsTrigger value="multidrop" data-testid="tab-multidrop">Multi-Drop</TabsTrigger>
            <TabsTrigger value="summary" data-testid="tab-summary">Summary</TabsTrigger>
            <TabsTrigger value="quote" data-testid="tab-quote">Quote</TabsTrigger>
          </TabsList>
          <TabsContent value="intake" className="mt-4"><IntakeTab tender={tender} /></TabsContent>
          <TabsContent value="workspace" className="mt-4"><WorkspaceTab tender={tender} lanes={lanes} isLoading={lanesLoading} /></TabsContent>
          <TabsContent value="multidrop" className="mt-4"><MultiDropTab tender={tender} /></TabsContent>
          <TabsContent value="summary" className="mt-4"><SummaryTab tender={tender} lanes={lanes} /></TabsContent>
          <TabsContent value="quote" className="mt-4"><QuoteTab tender={tender} lanes={lanes} /></TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
