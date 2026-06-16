export function aud(n: number, dp = 0): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency", currency: "AUD", minimumFractionDigits: dp, maximumFractionDigits: dp,
  }).format(n || 0);
}

export function num(n: number, dp = 0): string {
  return new Intl.NumberFormat("en-AU", { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(n || 0);
}

export function pct(n: number, dp = 1): string {
  return `${(n || 0).toFixed(dp)}%`;
}

export function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return shortDate(ts);
}

export const FORMAT_LABELS: Record<string, string> = {
  lane_list: "Lane list",
  multi_drop: "Multi-drop",
  dc_volumes: "DC volumes",
  rate_card: "Rate-card",
  rfp_narrative: "RFP narrative",
};

export const DECISION_LABELS: Record<string, string> = {
  go: "GO", review: "REVIEW", no_go: "NO-GO", pending: "PENDING",
};

// Lane economics
export function laneWeekly(proposedRate: number, tripsPerWeek: number): number {
  return proposedRate * tripsPerWeek;
}
export function laneMargin(proposedRate: number, costPerTrip: number): number {
  if (!proposedRate) return 0;
  return ((proposedRate - costPerTrip) / proposedRate) * 100;
}
export function laneStatus(margin: number, goT: number, reviewT: number): "go" | "review" | "no_go" {
  if (margin >= goT) return "go";
  if (margin >= reviewT) return "review";
  return "no_go";
}
