// 11.26 Account menu — web/tz.md §11.26, design
// `sheets, modals, drawers, menus/Settings — company profile and HOS ruleset.jpg` (260px).
// `Switch role` is removed in v1 (§20.4 Q3, no impersonation). `Switch organisation` and
// `Appearance` are disabled per §11.26; `What is new` has no destination in v1 (WD-056).
// Lazy chunk (WD-059): the Topbar shows `AccountTriggerButton` until this module arrives.
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Building2,
  Eye,
  Globe,
  HelpCircle,
  Keyboard,
  Lock,
  LogOut,
  Bell,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/shared/auth/AuthProvider';
import { ROLE_LABEL, type Role } from '@/shared/auth/permissions';
import { Avatar } from '@/shared/ui/Avatar';
import { AccountTriggerButton } from './TopbarTriggers';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';
import { cn } from '@/shared/ui/cn';

const ROLE_TONE: Record<Role, BadgeTone> = {
  ADMIN: 'violet',
  FLEET_MANAGER: 'info',
  DISPATCHER: 'success',
  VIEWER: 'neutral',
};

const ITEM =
  'flex h-btn cursor-pointer select-none items-center gap-3 px-3 text-body text-text data-[highlighted]:bg-bg-subtle data-[disabled]:cursor-not-allowed data-[disabled]:text-text-muted';

interface ItemProps {
  icon: LucideIcon;
  label: string;
  hint?: string;
  onSelect?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

function Item({ icon: Icon, label, hint, onSelect, disabled = false, danger = false }: ItemProps) {
  return (
    <DropdownMenu.Item disabled={disabled} onSelect={onSelect} className={cn(ITEM, danger && 'text-danger')}>
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" className={danger ? 'text-danger' : 'text-text-secondary'} />
      <span className="flex-1">{label}</span>
      {hint ? <span className="text-caption text-text-muted">{hint}</span> : null}
    </DropdownMenu.Item>
  );
}

const Separator = () => <DropdownMenu.Separator className="my-1 h-px bg-border" />;

export interface AccountMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenShortcuts: () => void;
}

export default function AccountMenu({ open, onOpenChange, onOpenShortcuts }: AccountMenuProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const name = user?.fullName ?? 'OneBook user';

  return (
    <DropdownMenu.Root modal={false} open={open} onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <AccountTriggerButton name={name} avatarUrl={user?.avatarUrl ?? null} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-account-menu overflow-hidden rounded-lg border border-border bg-bg-surface pb-1 shadow-pop"
        >
          <div className="flex items-center gap-3 px-3 py-3">
            {/* Decorative — the name is right beside it, and role="img" is not a valid menu child. */}
            <span aria-hidden="true">
              <Avatar name={name} src={user?.avatarUrl ?? undefined} size="lg" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-body-strong text-text">{name}</p>
              {user?.email ? <p className="truncate text-caption text-text-muted">{user.email}</p> : null}
            </div>
          </div>
          {user ? (
            <div className="flex items-center gap-2 border-y border-border px-3 py-2">
              <Badge tone={ROLE_TONE[user.role]} dot>
                {ROLE_LABEL[user.role]}
              </Badge>
              <span className="text-caption text-text-muted">All terminals</span>
            </div>
          ) : null}

          <DropdownMenu.Group className="pt-1">
            <Item icon={User} label="My profile" onSelect={() => navigate('/account#profile')} />
            <Item icon={Lock} label="Account security" onSelect={() => navigate('/account#security')} />
            <Item icon={Bell} label="Notification preferences" onSelect={() => navigate('/account#notifications')} />
          </DropdownMenu.Group>
          <Separator />
          <DropdownMenu.Group>
            <Item icon={Building2} label="Switch organisation" hint="v2" disabled />
            <Item icon={Globe} label="Language" hint="English" onSelect={() => navigate('/account#language')} />
            <Item icon={Eye} label="Appearance" hint="Light" disabled />
          </DropdownMenu.Group>
          <Separator />
          <DropdownMenu.Group>
            <Item icon={HelpCircle} label="Help centre" onSelect={() => navigate('/settings/support')} />
            <Item icon={Keyboard} label="Keyboard shortcuts" hint="?" onSelect={onOpenShortcuts} />
            <Item icon={Sparkles} label="What is new" disabled />
          </DropdownMenu.Group>
          <Separator />
          <Item icon={LogOut} label="Sign out" danger onSelect={() => signOut()} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
