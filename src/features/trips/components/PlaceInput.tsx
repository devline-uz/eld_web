// 11.10 Create trip — a location input that suggests places (shared `usePlaceSearch`, MapTiler) and
// reports the picked place's coordinates. Without `VITE_MAP_API_KEY` it is a plain text input, so
// trip creation never depends on geocoding.
import { useState, type FocusEventHandler, type Ref } from 'react';
import { usePlaceSearch, type Place } from '@/shared/map/geocode';

export interface PlaceInputProps {
  value: string;
  /** Called on every keystroke — the owner must also drop any previously picked coordinates. */
  onTextChange: (text: string) => void;
  onPick: (place: Place) => void;
  className: string;
  name?: string;
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  'aria-label'?: string;
}

export function PlaceInput({ value, onTextChange, onPick, className, name, inputRef, onBlur, ...rest }: PlaceInputProps) {
  const [searching, setSearching] = useState(false);
  const search = usePlaceSearch(value, searching);
  const options = searching ? (search.data ?? []) : [];
  return (
    <div className="relative flex flex-col">
      <input
        {...rest}
        name={name}
        ref={inputRef}
        value={value}
        onBlur={onBlur}
        onChange={(e) => {
          setSearching(true);
          onTextChange(e.target.value);
        }}
        role="combobox"
        aria-expanded={options.length > 0}
        aria-autocomplete="list"
        autoComplete="off"
        className={className}
      />
      {options.length > 0 && (
        <ul
          role="listbox"
          className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-bg-surface py-1 shadow-pop"
        >
          {options.map((candidate) => (
            <li key={`${candidate.lat},${candidate.lon}`} role="option" aria-selected={false}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearching(false);
                  onPick(candidate);
                }}
                className="w-full px-3 py-1.5 text-left text-body text-text hover:bg-bg-subtle"
              >
                {candidate.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
