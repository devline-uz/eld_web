import { WifiOff } from 'lucide-react';
import { Button } from './Button';

// owner: web-design-system — §5.11, §13.4. Fixed bottom-left, `--bg-inverse`.

export interface OfflineBannerProps {
  cachedMinutesAgo: number;
  onRetry: () => void;
}

export function OfflineBanner({ cachedMinutesAgo, onRetry }: OfflineBannerProps) {
  return (
    <div
      role="status"
      className="fixed bottom-6 left-6 z-40 flex w-side-panel items-start gap-3 rounded-lg bg-bg-inverse p-4 text-text-inverse shadow-pop"
    >
      <WifiOff size={20} strokeWidth={1.75} className="mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-body-strong">You are offline</p>
        <p className="mt-0.5 text-card-sub opacity-80">
          Showing data cached {cachedMinutesAgo} minute{cachedMinutesAgo === 1 ? '' : 's'} ago. Live
          tracking resumes automatically.
        </p>
      </div>
      <Button variant="link" onClick={onRetry} className="shrink-0 text-text-inverse">
        Retry now
      </Button>
    </div>
  );
}
