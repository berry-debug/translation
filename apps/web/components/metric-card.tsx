interface MetricCardProps {
  label: string;
  value: string | number;
  detail: string;
}

export function MetricCard({ label, value, detail }: MetricCardProps) {
  return (
    <article className="ui-panel rounded-[1.4rem] p-6">
      <p className="ui-kicker">{label}</p>
      <p className="ui-mono mt-4 text-[2.1rem] tracking-[-0.04em] text-ink">{value}</p>
      <p className="mt-2 text-sm leading-6 text-ink/62">{detail}</p>
    </article>
  );
}
