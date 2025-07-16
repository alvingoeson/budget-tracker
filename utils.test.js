import { describe, it, expect } from 'vitest';
import { currency, getMonthlyData } from './utils.js';

describe('currency()', () => {
  it('formats a number to two decimals with $', () => {
    expect(currency(2)).toBe('$2.00');
    expect(currency(3.456)).toBe('$3.46');
  });
});

describe('getMonthlyData()', () => {
  const sample = [
    { date: '2025-07-01T00:00:00.000Z', type: 'income',  amount: 100 },
    { date: '2025-07-15T00:00:00.000Z', type: 'expense', amount:  40 },
    { date: '2025-08-05T00:00:00.000Z', type: 'income',  amount: 200 }
  ];

  it('aggregates incomes and expenses by month', () => {
    const { labels, incomes, expenses } = getMonthlyData(sample);
    expect(labels).toEqual(['Jul 2025','Aug 2025']);
    expect(incomes).toEqual([100,200]);
    expect(expenses).toEqual([40,0]);
  });
});
