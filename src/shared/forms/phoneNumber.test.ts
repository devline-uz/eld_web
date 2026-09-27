import { describe, expect, it } from 'vitest';
import { VALIDATION_MESSAGES as M } from './messages';
import {
  applyPhoneInput,
  caretAfterDigits,
  detectPhoneCountry,
  formatPhoneInput,
  internationalPhone,
  phoneForDisplay,
  phoneProblem,
  toE164,
} from './phoneNumber';
import { driverSchema } from './driverSchema';

/** Types `text` one character at a time at the end of the field, like a user would. */
function typeInto(start: string, text: string): string {
  let value = start;
  for (const ch of text) {
    const raw = value + ch;
    value = applyPhoneInput(value, raw, raw.length, 'insertText').value;
  }
  return value;
}

/** One backspace at `caret` (default: end of the field). */
function backspace(value: string, caret = value.length) {
  if (caret === 0) return { value, caret };
  const raw = value.slice(0, caret - 1) + value.slice(caret);
  return applyPhoneInput(value, raw, caret - 1, 'deleteContentBackward');
}

describe('formatPhoneInput', () => {
  it('empty stays empty — never a lone +', () => {
    expect(formatPhoneInput('')).toBe('');
    expect(formatPhoneInput('+')).toBe('');
    expect(formatPhoneInput('abc')).toBe('');
  });

  it('formats per detected country', () => {
    expect(formatPhoneInput('+998901234567')).toBe('+998 90 123 45 67');
    expect(formatPhoneInput('+12345678900')).toBe('+1 234 567 8900');
    expect(formatPhoneInput('+442012345678')).toBe('+44 20 1234 5678');
    expect(formatPhoneInput('+79161234567')).toBe('+7 916 123 45 67');
  });

  it('adds the + to digits typed or pasted without it', () => {
    expect(formatPhoneInput('998901234567')).toBe('+998 90 123 45 67');
    expect(formatPhoneInput('9')).toBe('+9');
  });

  it('normalizes pasted formatted numbers', () => {
    expect(formatPhoneInput('+1 (234) 567-8900')).toBe('+1 234 567 8900');
    expect(formatPhoneInput('+998 (90) 123-45-67')).toBe('+998 90 123 45 67');
    expect(formatPhoneInput('+44.20.1234.5678')).toBe('+44 20 1234 5678');
    expect(formatPhoneInput('  +998 90 123 45 67  ')).toBe('+998 90 123 45 67');
  });

  it('keeps a single leading + — extra and misplaced + signs are dropped', () => {
    expect(formatPhoneInput('++998901234567')).toBe('+998 90 123 45 67');
    expect(formatPhoneInput('+998+90+1234567')).toBe('+998 90 123 45 67');
    expect(formatPhoneInput('998+901234567')).toBe('+998 90 123 45 67');
  });

  it('drops letters', () => {
    expect(formatPhoneInput('+998 9a0 12b3 45 67')).toBe('+998 90 123 45 67');
  });

  it('caps at 15 digits (E.164)', () => {
    expect(formatPhoneInput('+1234567890123456789').replace(/\D/g, '')).toHaveLength(15);
  });
});

describe('detectPhoneCountry', () => {
  it('detects the country once the number is unambiguous', () => {
    expect(detectPhoneCountry('+998 90 123 45 67')).toBe('UZ');
    expect(detectPhoneCountry('+1 212 555 0123')).toBe('US');
    expect(detectPhoneCountry('+1 416 555 0123')).toBe('CA');
    expect(detectPhoneCountry('+44 20 1234 5678')).toBe('GB');
    expect(detectPhoneCountry('+7 916 123 45 67')).toBe('RU');
    expect(detectPhoneCountry('+7 701 123 45 67')).toBe('KZ');
  });

  it('does not commit to a country on a shared or partial prefix', () => {
    expect(detectPhoneCountry('')).toBeUndefined();
    expect(detectPhoneCountry('+1')).toBeUndefined();
    expect(detectPhoneCountry('+7')).toBeUndefined();
    expect(detectPhoneCountry('+99')).toBeUndefined();
  });
});

describe('phoneProblem / toE164', () => {
  it('empty is fine — the field is optional', () => {
    expect(phoneProblem('')).toBeNull();
    expect(phoneProblem('+')).toBeNull();
    expect(toE164('')).toBeUndefined();
  });

  it.each([
    ['+998901234567', '+998901234567'],
    ['998901234567', '+998901234567'],
    ['+998 90 123 45 67', '+998901234567'],
    ['+1 234 567 8900', '+12345678900'],
    ['+1 (234) 567-8900', '+12345678900'],
    ['+44 20 1234 5678', '+442012345678'],
  ])('%s is valid and becomes %s', (input, e164) => {
    expect(phoneProblem(input)).toBeNull();
    expect(toE164(input)).toBe(e164);
  });

  it('an unknown country calling code is reported as such', () => {
    expect(phoneProblem('+999 123 456 789')).toBe('invalidCountry');
    expect(phoneProblem('+0 123 456 789')).toBe('invalidCountry');
  });

  it('an incomplete number is reported as incomplete', () => {
    expect(phoneProblem('+998 90 123')).toBe('incomplete');
    expect(phoneProblem('+1 234 567')).toBe('incomplete');
    expect(phoneProblem('+44 20')).toBe('incomplete');
    expect(toE164('+998 90 123')).toBeUndefined();
  });

  it('a number the country does not allow is invalid', () => {
    // Uzbekistan has no numbers starting with 0 after the calling code.
    expect(phoneProblem('+998 00 123 45 67')).toBe('invalid');
    // NANP area codes never start with 0 or 1.
    expect(phoneProblem('+1 123 456 7890')).toBe('invalid');
    expect(phoneProblem('+998 90 123 45 67 89')).toBe('invalid');
  });

  it('rejects multiple or misplaced + signs', () => {
    expect(phoneProblem('++998901234567')).toBe('invalid');
    expect(phoneProblem('+998+901234567')).toBe('invalid');
    expect(phoneProblem('998901234567+')).toBe('invalid');
  });

  it('rejects letters inside the number', () => {
    expect(phoneProblem('+998 90 abc 45 67')).toBe('invalid');
    expect(phoneProblem('+1 234 567 890O')).toBe('invalid');
  });
});

describe('internationalPhone (zod) — the value the API receives', () => {
  const schema = internationalPhone();

  it('turns empty into undefined (not sent)', () => {
    expect(schema.parse(undefined)).toBeUndefined();
    expect(schema.parse('')).toBeUndefined();
    expect(schema.parse('+')).toBeUndefined();
  });

  it('turns a formatted display value into E.164', () => {
    expect(schema.parse('+998 90 123 45 67')).toBe('+998901234567');
    expect(schema.parse('+1 234 567 8900')).toBe('+12345678900');
    expect(schema.parse('+44 20 1234 5678')).toBe('+442012345678');
  });

  it('reports each problem with its §14 message', () => {
    const message = (v: string) => schema.safeParse(v).error?.issues[0]?.message;
    expect(message('+998 90 123')).toBe(M.phoneIncomplete);
    expect(message('+999 123 456 789')).toBe(M.phoneCountryCode);
    expect(message('+998 90 abc 45 67')).toBe(M.phone);
  });

  it('driverSchema submits E.164 for the phone', () => {
    const base = {
      firstName: 'Marcus',
      lastName: 'Webb',
      email: 'marcus.webb@universal-logistics.example',
      username: 'marcus.webb',
      password: 'Onebook2026',
      cdlNumber: 'OH-4471982',
      cdlState: 'OH',
    };
    expect(driverSchema.parse({ ...base, phone: '+998 90 123 45 67' }).phone).toBe('+998901234567');
    expect(driverSchema.parse({ ...base, phone: '' }).phone).toBeUndefined();
    expect(driverSchema.safeParse({ ...base, phone: '+998 90 12' }).success).toBe(false);
  });
});

describe('applyPhoneInput — typing, pasting, deleting', () => {
  it('typing digits builds the formatted number, + included', () => {
    expect(typeInto('', '998901234567')).toBe('+998 90 123 45 67');
    expect(typeInto('', '+12345678900')).toBe('+1 234 567 8900');
    expect(typeInto('', '+442012345678')).toBe('+44 20 1234 5678');
  });

  it('a + typed into the empty field is kept; a second + is not', () => {
    expect(applyPhoneInput('', '+', 1, 'insertText')).toEqual({ value: '+', caret: 1 });
    expect(typeInto('+', '+9')).toBe('+9');
  });

  it('letters are rejected and the caret stays put', () => {
    const r = applyPhoneInput('+998 90', '+998 9x0', 7, 'insertText');
    expect(r.value).toBe('+998 90');
    expect(r.caret).toBe(6); // still just after the 9
  });

  it('pasting a formatted number normalizes it', () => {
    const pasted = '+1 (234) 567-8900';
    expect(applyPhoneInput('', pasted, pasted.length, 'insertFromPaste')).toEqual({
      value: '+1 234 567 8900',
      caret: 15,
    });
    const bare = '998901234567';
    expect(applyPhoneInput('', bare, bare.length, 'insertFromPaste').value).toBe(
      '+998 90 123 45 67',
    );
  });

  it('deleting everything leaves an empty field, not a lone +', () => {
    let state = { value: '+998 90 123 45 67', caret: 17 };
    while (state.value) state = backspace(state.value, state.caret);
    expect(state).toEqual({ value: '', caret: 0 });
    // Select-all + delete.
    expect(applyPhoneInput('+998 90 123 45 67', '', 0, 'deleteContentBackward').value).toBe('');
    // Deleting only the digits leaves `+` → cleared too.
    expect(applyPhoneInput('+9', '+', 1, 'deleteContentBackward').value).toBe('');
  });

  it('backspace over a space removes the digit before it', () => {
    // Caret right after the space in "+998 |90": the 8 goes, the caret sits after "+99".
    expect(backspace('+998 90', 5)).toEqual({ value: '+9990', caret: 3 });
  });

  it('forward-delete over a space removes the digit after it', () => {
    const r = applyPhoneInput('+998 90', '+99890', 4, 'deleteContentForward');
    expect(r.value).toBe('+998 0');
    expect(r.caret).toBe(4);
  });

  it('deleting and retyping in the middle keeps the caret next to the same digit', () => {
    // Backspace with the caret just after the "1" in "+998 90 1|23 45 67" (index 9).
    const deleted = backspace('+998 90 123 45 67', 9);
    expect(deleted.value.replace(/\D/g, '')).toBe('99890234567');
    // Retype the 1 at the caret.
    const raw = deleted.value.slice(0, deleted.caret) + '1' + deleted.value.slice(deleted.caret);
    const retyped = applyPhoneInput(deleted.value, raw, deleted.caret + 1, 'insertText');
    expect(retyped.value).toBe('+998 90 123 45 67');
    expect(retyped.caret).toBe(9);
  });

  it('caretAfterDigits maps a digit count to an index', () => {
    expect(caretAfterDigits('+998 90 123', 0)).toBe(1);
    expect(caretAfterDigits('+998 90 123', 3)).toBe(4);
    expect(caretAfterDigits('+998 90 123', 5)).toBe(7);
    expect(caretAfterDigits('+998 90 123', 99)).toBe(11);
    expect(caretAfterDigits('', 0)).toBe(0);
  });
});

describe('phoneForDisplay — a phone already on file', () => {
  it.each([
    [null, ''],
    ['', ''],
    ['+998901234567', '+998 90 123 45 67'],
    ['+1 614 555 0100', '+1 614 555 0100'],
    ['6145550100', '+1 614 555 0100'],
    ['(614) 555-0100', '+1 614 555 0100'],
    ['00998901234567', '+998 90 123 45 67'],
    ['998901234567', '+998 90 123 45 67'],
  ])('%s → %s', (stored, display) => {
    expect(phoneForDisplay(stored)).toBe(display);
  });
});
