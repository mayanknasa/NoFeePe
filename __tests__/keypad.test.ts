import {
  applyKeypadInput,
  parseRupeeStringToPaise,
} from '../src/components/NumericKeypad';

describe('Numeric Keypad Rules (Section 4.3)', () => {
  test('Leading zero handling: typing 0 then 5 produces 5, not 05', () => {
    let amt = applyKeypadInput('', '0');
    expect(amt).toBe('0');
    amt = applyKeypadInput(amt, '5');
    expect(amt).toBe('5');
  });

  test('Decimal point handling: at most one decimal point', () => {
    let amt = applyKeypadInput('', '.');
    expect(amt).toBe('0.');
    amt = applyKeypadInput(amt, '5');
    expect(amt).toBe('0.5');
    amt = applyKeypadInput(amt, '.');
    expect(amt).toBe('0.5'); // second decimal ignored
  });

  test('At most two decimal digits, extra ignored silently', () => {
    let amt = '1999.';
    amt = applyKeypadInput(amt, '0');
    expect(amt).toBe('1999.0');
    amt = applyKeypadInput(amt, '1');
    expect(amt).toBe('1999.01');
    amt = applyKeypadInput(amt, '5');
    expect(amt).toBe('1999.01'); // ignored
  });

  test('Backspace handling', () => {
    expect(applyKeypadInput('1999', '⌫')).toBe('199');
    expect(applyKeypadInput('1', '⌫')).toBe('');
    expect(applyKeypadInput('', '⌫')).toBe('');
  });

  test('Caps input at 1,00,000', () => {
    let amt = '100000';
    amt = applyKeypadInput(amt, '1');
    expect(amt).toBe('100000'); // cannot exceed 100000
  });

  test('parseRupeeStringToPaise integer conversion', () => {
    expect(parseRupeeStringToPaise('1999.00')).toBe(199900);
    expect(parseRupeeStringToPaise('1999.01')).toBe(199901);
    expect(parseRupeeStringToPaise('5')).toBe(500);
    expect(parseRupeeStringToPaise('0.50')).toBe(50);
    expect(parseRupeeStringToPaise('')).toBe(0);
  });
});
