interface StatusPillProps {
  label: string;
  tone?: "neutral" | "success" | "warning" | "active";
}

const toneClassName: Record<NonNullable<StatusPillProps["tone"]>, string> = {
  neutral: "border-ink/10 bg-white/72 text-ink/72",
  success: "border-leaf/15 bg-leaf/10 text-leaf",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-800",
  active: "border-coral/15 bg-coral/10 text-coral"
};

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  return (
    <span
      className={`ui-mono inline-flex rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] ${toneClassName[tone]}`}
    >
      {label}
    </span>
  );
}
