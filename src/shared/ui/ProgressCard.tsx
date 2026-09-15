import { Card } from './Card';
import { ProgressBar } from './ProgressBar';

// owner: web-design-system — §5.11. `Generating FMCSA audit pack` style progress card.

export interface ProgressCardProps {
  title: string;
  percent: number;
  detail: string;
}

export function ProgressCard({ title, percent, detail }: ProgressCardProps) {
  const pct = Math.round(Math.max(0, Math.min(100, percent)));
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-body-strong text-text">{title}</span>
        <span className="tabular text-body-strong text-text">{pct}%</span>
      </div>
      <ProgressBar ratio={pct / 100} tone="success" thick className="mt-3" label={title} />
      <p className="mt-2 text-caption text-text-muted">{detail}</p>
    </Card>
  );
}
