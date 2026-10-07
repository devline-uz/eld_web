// Vehicles ⇄ Trailers switch shown on top of both inventory screens. The sidebar (§4.2) is fixed,
// so Trailers is reached from here; both screens are gated by the same `vehicles` key.
import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/vehicles', label: 'Vehicles' },
  { to: '/trailers', label: 'Trailers' },
] as const;

export function InventoryTabs() {
  return (
    <nav aria-label="Unit inventory" className="flex h-9 w-fit overflow-hidden rounded-md border border-border">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            isActive
              ? 'flex items-center bg-bg-inverse px-3 text-body-strong text-text-inverse'
              : 'flex items-center bg-bg-surface px-3 text-body text-text-secondary hover:bg-bg-subtle'
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
