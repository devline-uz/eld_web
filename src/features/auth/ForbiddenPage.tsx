// owner: web-auth-rbac — /403 and every route a role may not open (web/tz.md §12.4).
// The screen name comes from the route handle the router already carries, so the sentence reads
// `Ask an administrator if you need access to DVIR & Maintenance.`
import { useMatches, useNavigate } from 'react-router-dom';
import { ForbiddenState } from '@/shared/ui/states';

interface TitleHandle {
  title?: string;
}

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const matches = useMatches();
  let screenName = 'this page';
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const handle = matches[i]?.handle as TitleHandle | undefined;
    if (handle?.title && handle.title !== 'Access denied') {
      screenName = handle.title;
      break;
    }
  }

  return <ForbiddenState screenName={screenName} onBack={() => navigate('/')} />;
}
