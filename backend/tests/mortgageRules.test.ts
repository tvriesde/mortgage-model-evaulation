import { describe, expect, it } from 'vitest';
import { computeMortgageDecision, type MortgageRequest } from '../src/rules/mortgageRules.js';

function baseRequest(overrides: Partial<MortgageRequest> = {}): MortgageRequest {
  return {
    incomeSource: 'permanent',
    grossAnnualIncome: 50000,
    propertyValue: 250000,
    requestedLoanAmount: 200000,
    age: 30,
    monthlyDebts: 0,
    ...overrides,
  };
}

describe('computeMortgageDecision', () => {
  it('approves a comfortable permanent-income request', () => {
    const decision = computeMortgageDecision(baseRequest());
    expect(decision.verdict).toBe('approved');
    expect(decision.maxLoanByIncome).toBe(225000);
    expect(decision.maxLoanByValue).toBe(250000);
  });

  it('declines when the loan exceeds the property value (LTV over 100%)', () => {
    const decision = computeMortgageDecision(
      baseRequest({ propertyValue: 180000, requestedLoanAmount: 200000 }),
    );
    expect(decision.verdict).toBe('declined');
    expect(decision.reason).toContain('LTV');
  });

  it('declines when the loan clearly exceeds income capacity', () => {
    const decision = computeMortgageDecision(
      baseRequest({ grossAnnualIncome: 30000, propertyValue: 400000, requestedLoanAmount: 300000 }),
    );
    expect(decision.verdict).toBe('declined');
    expect(decision.reason).toContain('income');
  });

  it('needs review for a temporary contract even within limits', () => {
    const decision = computeMortgageDecision(baseRequest({ incomeSource: 'temporary' }));
    expect(decision.verdict).toBe('needs_review');
    expect(decision.reason).toContain('temporary');
  });

  it('needs review for self-employed applicants', () => {
    const decision = computeMortgageDecision(
      baseRequest({ incomeSource: 'self_employed', requestedLoanAmount: 150000 }),
    );
    expect(decision.verdict).toBe('needs_review');
  });

  it('needs review near retirement age', () => {
    const decision = computeMortgageDecision(baseRequest({ age: 60, requestedLoanAmount: 150000 }));
    expect(decision.verdict).toBe('needs_review');
    expect(decision.reason).toContain('retirement');
  });

  it('needs review when the loan is marginal (within 5% of max)', () => {
    const decision = computeMortgageDecision(baseRequest({ requestedLoanAmount: 220000 }));
    expect(decision.verdict).toBe('needs_review');
    expect(decision.reason).toContain('maximum');
  });

  it('declines applicants under 18', () => {
    const decision = computeMortgageDecision(baseRequest({ age: 17 }));
    expect(decision.verdict).toBe('declined');
    expect(decision.reason).toContain('18');
  });

  it('reduces capacity for monthly debts', () => {
    const noDebt = computeMortgageDecision(baseRequest());
    const withDebt = computeMortgageDecision(baseRequest({ monthlyDebts: 250 }));
    expect(withDebt.maxLoanByIncome).toBe(noDebt.maxLoanByIncome - 25000);
  });

  it('uses a higher multiplier for high incomes', () => {
    const decision = computeMortgageDecision(
      baseRequest({ grossAnnualIncome: 80000, propertyValue: 500000, requestedLoanAmount: 350000 }),
    );
    expect(decision.maxLoanByIncome).toBe(400000);
    expect(decision.verdict).toBe('approved');
  });
});
