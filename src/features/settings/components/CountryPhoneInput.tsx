// owner: web-settings-admin — a phone input bound to one selected country (W-17 Main phone).
// Parsing, grouping and caret mapping live in `shared/forms/international/countryPhone.ts`
// (pure, unit-tested); this only wires them to the DOM. On blur a valid number is rewritten in
// the international format (`+998 90 123 45 67`); the E.164 form is made at save time.
import type React from 'react';
import { applyCountryPhoneInput, formatCountryPhone, type CountryCode } from '@/shared/forms/international';

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur' | 'type' | 'defaultValue'
> & {
  value: string | null | undefined;
  country: CountryCode;
  onChange: (value: string) => void;
  /** Called with the reformatted value, after `onChange`. */
  onBlur: (value: string) => void;
};

export function CountryPhoneInput({ value, country, onChange, onBlur, ...rest }: Props) {
  const current = value ?? '';
  return (
    <input
      {...rest}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={current}
      onChange={(e) => {
        const el = e.currentTarget;
        const inputType = (e.nativeEvent as InputEvent).inputType;
        const next = applyCountryPhoneInput(current, el.value, el.selectionStart ?? el.value.length, country, inputType);
        // Written straight to the DOM so the caret lands right even when the value is unchanged
        // (a rejected letter): React leaves a DOM value that already matches alone.
        el.value = next.value;
        if (document.activeElement === el) el.setSelectionRange(next.caret, next.caret);
        onChange(next.value);
      }}
      onBlur={() => {
        const formatted = current === '+' ? '' : formatCountryPhone(current, country);
        if (formatted !== current) onChange(formatted);
        onBlur(formatted);
      }}
    />
  );
}
