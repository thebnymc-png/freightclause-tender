export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 32 32" fill="none"
      className={className} aria-label="FreightClause" role="img"
    >
      <rect width="32" height="32" rx="7" className="fill-primary" />
      {/* F */}
      <path d="M8 8.5h6.5M8 8.5v15M8 16h5" className="stroke-primary-foreground" strokeWidth="2.3" strokeLinecap="round" />
      {/* C as an open route arc */}
      <path d="M24 12a6 6 0 1 0 0 8" className="stroke-primary-foreground" strokeWidth="2.3" strokeLinecap="round" fill="none" />
      {/* route pin dot */}
      <circle cx="24" cy="16" r="1.6" className="fill-primary-foreground" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5" data-testid="logo-wordmark">
      <Logo size={28} />
      <div className="flex flex-col leading-none">
        <span className="text-sm font-bold tracking-tight">FreightClause</span>
        <span className="text-[11px] text-muted-foreground font-medium">JDT Tender</span>
      </div>
    </div>
  );
}
