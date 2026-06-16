import { cn } from "@/lib/utils";
import { DECISION_LABELS } from "@/lib/format";

const styles: Record<string, string> = {
  go: "bg-[hsl(103_56%_31%/0.12)] text-[hsl(103_56%_26%)] dark:bg-[hsl(97_43%_50%/0.16)] dark:text-[hsl(97_43%_62%)] border-[hsl(103_56%_31%/0.3)]",
  review: "bg-[hsl(20_73%_34%/0.12)] text-[hsl(20_73%_34%)] dark:bg-[hsl(20_53%_55%/0.16)] dark:text-[hsl(20_53%_62%)] border-[hsl(20_73%_34%/0.3)]",
  no_go: "bg-[hsl(320_57%_40%/0.12)] text-[hsl(320_57%_40%)] dark:bg-[hsl(320_47%_60%/0.16)] dark:text-[hsl(320_47%_68%)] border-[hsl(320_57%_40%/0.3)]",
  pending: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ decision, className }: { decision: string; className?: string }) {
  return (
    <span
      data-testid={`badge-status-${decision}`}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        styles[decision] || styles.pending,
        className
      )}
    >
      {DECISION_LABELS[decision] || decision.toUpperCase()}
    </span>
  );
}
