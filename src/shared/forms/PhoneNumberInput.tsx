// The international phone input (11.8 Add / Edit driver, W-26 My account `Mobile number`).
// Formatting, country detection and caret mapping live in `./phoneNumber.ts` (pure, unit-tested);
// this only wires them to the DOM. Kept out of the `@/shared/forms` barrel so only the screens
// that render it load the libphonenumber metadata.
import type React from 'react';
import { applyPhoneInput, phoneDigits } from './phoneNumber';

type Props = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur' | 'type' | 'defaultValue'
> & {
  value: string | undefined;
  onChange: (value: string) => void;
  onBlur: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
};

export function PhoneNumberInput({ value, onChange, onBlur, inputRef, ...rest }: Props) {
  const current = value ?? '';
  return (
    <input
      {...rest}
      ref={inputRef}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={current}
      onChange={(e) => {
        const el = e.currentTarget;
        const inputType = (e.nativeEvent as InputEvent).inputType;
        const next = applyPhoneInput(
          current,
          el.value,
          el.selectionStart ?? el.value.length,
          inputType,
        );
        // Written straight to the DOM so the caret lands where it belongs even when the value
        // does not change (a rejected letter): React leaves a DOM value that already matches alone.
        el.value = next.value;
        if (document.activeElement === el) el.setSelectionRange(next.caret, next.caret);
        onChange(next.value);
      }}
      onBlur={() => {
        // A lone `+` is an empty field, not a value.
        if (current !== '' && !phoneDigits(current)) onChange('');
        onBlur();
      }}
    />
  );
}
