// Deterministic Dutch mortgage rules engine.
//
// This is the single source of truth for the lending logic. It is mirrored by:
//  - the agent system prompt (src/prompts/systemPrompt.ts)
//  - the Python reference calculator used to label the eval dataset (evals/reference_calculator.py)
//  - docs/mortgage-rules.md
//
// It is intentionally simplified and MUST NOT be used for real lending decisions.

export type IncomeSource = 'permanent' | 'temporary' | 'self_employed' | 'benefit';

export type Verdict = 'approved' | 'needs_review' | 'declined';

export interface MortgageRequest {
  incomeSource: IncomeSource;
  grossAnnualIncome: number;
  propertyValue: number;
  requestedLoanAmount: number;
  age: number;
  gender?: string;
  monthlyDebts?: number;
}

export interface MortgageDecision {
  verdict: Verdict;
  reason: string;
  maxLoanByIncome: number;
  maxLoanByValue: number;
  maxLoan: number;
}

export const LTV_CAP = 1.0;
export const STATE_PENSION_AGE = 67;
export const MARGINAL_LOWER = 0.95;
export const MARGINAL_UPPER = 1.05;
export const DEBT_REDUCTION_FACTOR = 100;

export function incomeMultiplier(grossAnnualIncome: number): number {
  if (grossAnnualIncome < 30000) {
    return 4.0;
  }
  if (grossAnnualIncome <= 60000) {
    return 4.5;
  }
  return 5.0;
}

function incomeSourceFactor(source: IncomeSource): { factor: number; review: boolean } {
  switch (source) {
    case 'permanent':
      return { factor: 1.0, review: false };
    case 'temporary':
      return { factor: 1.0, review: true };
    case 'self_employed':
      return { factor: 0.9, review: true };
    case 'benefit':
      return { factor: 0.7, review: true };
  }
}

function ageFactor(age: number): { factor: number; review: boolean } {
  if (age >= STATE_PENSION_AGE) {
    return { factor: 0.7, review: true };
  }
  if (age >= 57) {
    return { factor: 0.85, review: true };
  }
  return { factor: 1.0, review: false };
}

function isValid(request: MortgageRequest): boolean {
  return (
    request.grossAnnualIncome > 0 &&
    request.propertyValue > 0 &&
    request.requestedLoanAmount > 0 &&
    Number.isFinite(request.age)
  );
}

export function computeMortgageDecision(request: MortgageRequest): MortgageDecision {
  const monthlyDebts = request.monthlyDebts ?? 0;

  if (!isValid(request)) {
    return {
      verdict: 'declined',
      reason: 'invalid application data',
      maxLoanByIncome: 0,
      maxLoanByValue: 0,
      maxLoan: 0,
    };
  }

  if (request.age < 18) {
    return {
      verdict: 'declined',
      reason: 'applicant must be at least 18 years old',
      maxLoanByIncome: 0,
      maxLoanByValue: 0,
      maxLoan: 0,
    };
  }

  const income = incomeSourceFactor(request.incomeSource);
  const ageBand = ageFactor(request.age);
  const multiplier = incomeMultiplier(request.grossAnnualIncome);

  const maxLoanByIncome = Math.round(
    request.grossAnnualIncome * multiplier * income.factor * ageBand.factor -
      monthlyDebts * DEBT_REDUCTION_FACTOR,
  );
  const maxLoanByValue = Math.round(request.propertyValue * LTV_CAP);
  const maxLoan = Math.min(maxLoanByIncome, maxLoanByValue);

  const base = { maxLoanByIncome, maxLoanByValue, maxLoan };

  // Rule 1: LTV breach takes priority.
  if (request.requestedLoanAmount > maxLoanByValue) {
    return {
      ...base,
      verdict: 'declined',
      reason: 'loan exceeds property value (LTV over 100%)',
    };
  }

  // Rule 2: income clearly insufficient.
  if (request.requestedLoanAmount > maxLoanByIncome * MARGINAL_UPPER) {
    return {
      ...base,
      verdict: 'declined',
      reason: 'requested loan exceeds maximum borrowing capacity based on income',
    };
  }

  // Rule 3: marginal amount or a review-forcing factor.
  const marginal = request.requestedLoanAmount > maxLoanByIncome * MARGINAL_LOWER;
  if (marginal || income.review || ageBand.review) {
    const reasons: string[] = [];
    if (marginal) {
      reasons.push('requested loan is close to the maximum borrowing capacity');
    }
    if (income.review) {
      reasons.push(`income source "${request.incomeSource}" requires manual verification`);
    }
    if (ageBand.review) {
      reasons.push('applicant age requires assessment against retirement/pension income');
    }
    return {
      ...base,
      verdict: 'needs_review',
      reason: reasons.join('; '),
    };
  }

  // Rule 4: approved.
  return {
    ...base,
    verdict: 'approved',
    reason: 'requested loan is within income and property-value limits',
  };
}
