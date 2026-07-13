import { describe, expect, it } from 'vitest';
import { validateMortgageRequest } from '../src/rules/validation.js';

describe('validateMortgageRequest', () => {
  it('accepts a well-formed request and coerces numeric strings', () => {
    const result = validateMortgageRequest({
      incomeSource: 'permanent',
      grossAnnualIncome: '50000',
      propertyValue: 250000,
      requestedLoanAmount: 200000,
      age: '30',
    });
    expect(result.ok).toBe(true);
    expect(result.request?.grossAnnualIncome).toBe(50000);
    expect(result.request?.age).toBe(30);
    expect(result.request?.monthlyDebts).toBe(0);
  });

  it('rejects an unknown income source', () => {
    const result = validateMortgageRequest({
      incomeSource: 'lottery',
      grossAnnualIncome: 50000,
      propertyValue: 250000,
      requestedLoanAmount: 200000,
      age: 30,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('incomeSource');
  });

  it('rejects non-positive amounts', () => {
    const result = validateMortgageRequest({
      incomeSource: 'permanent',
      grossAnnualIncome: 0,
      propertyValue: -1,
      requestedLoanAmount: 0,
      age: 30,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects a non-object body', () => {
    expect(validateMortgageRequest(null).ok).toBe(false);
    expect(validateMortgageRequest('nope').ok).toBe(false);
  });
});
