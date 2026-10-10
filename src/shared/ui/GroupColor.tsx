// owner: web-design-system — vehicle-group chip colours (WD-116). The API stores `#RRGGBB`
// (`CreateVehicleGroupDto.color`), so the swatches are hex values; each one is the value of an
// existing semantic token in ./tokens.css, so a group chip never introduces a new colour.

export interface GroupColorOption {
  value: string;
  label: string;
}

export const GROUP_COLOR_OPTIONS: readonly GroupColorOption[] = [
  { value: '#2563EB', label: 'Blue' }, // --color-primary
  { value: '#15803D', label: 'Green' }, // --color-success
  { value: '#B45309', label: 'Amber' }, // --color-warning
  { value: '#B91C1C', label: 'Red' }, // --color-danger
  { value: '#7C3AED', label: 'Violet' }, // --color-violet
  { value: '#475569', label: 'Slate' }, // --color-text-secondary
];

/** A stored colour the API accepts (`#RRGGBB`); anything else renders as the neutral dot. */
export function isGroupColor(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Small round swatch for a group — the colour comes from data, so it is an inline style. */
export function GroupColorDot({
  color,
  className = 'size-2.5',
}: {
  color: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 rounded-full ${isGroupColor(color) ? '' : 'bg-neutral'} ${className}`}
      style={isGroupColor(color) ? { backgroundColor: color } : undefined}
    />
  );
}
