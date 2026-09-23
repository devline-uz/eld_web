// owner: web-auth-rbac — Page not found (the `*` route inside the app shell).
//
// WB-175 — this was still the `PagePlaceholder` scaffold ("— · not implemented yet"), which told
// a user who mistyped a URL that the product was unfinished and gave them no way back. It is the
// shared §12.4/§13.1 empty state now, with the same `‹ Back to dashboard` route out that the 403
// page uses.
import { useLocation, useNavigate } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';
import { EmptyState } from '@/shared/ui/states';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <EmptyState
        icon={<MapPinOff size={24} strokeWidth={1.75} />}
        title="Page not found"
        description={`Nothing is served at ${pathname}. The link may be out of date, or the page may have moved.`}
        actions={[
          { label: 'Go back', onClick: () => navigate(-1), variant: 'secondary' },
          { label: 'Open dashboard', onClick: () => navigate('/'), variant: 'primary' },
        ]}
      />
    </div>
  );
}
