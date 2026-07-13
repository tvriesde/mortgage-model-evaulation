import type { IncomeSource, MortgageRequest } from '../rules/mortgageRules.js';

const INCOME_SOURCES: IncomeSource[] = ['permanent', 'temporary', 'self_employed', 'benefit'];

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  request?: MortgageRequest;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

export function validateMortgageRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof body !== 'object' || body === null) {
    return { ok: false, errors: ['request body must be a JSON object'] };
  }

  const record = body as Record<string, unknown>;

  const incomeSource = record.incomeSource;
  if (typeof incomeSource !== 'string' || !INCOME_SOURCES.includes(incomeSource as IncomeSource)) {
    errors.push(`incomeSource must be one of: ${INCOME_SOURCES.join(', ')}`);
  }

  const grossAnnualIncome = asNumber(record.grossAnnualIncome);
  if (grossAnnualIncome === undefined || grossAnnualIncome <= 0) {
    errors.push('grossAnnualIncome must be a positive number');
  }

  const propertyValue = asNumber(record.propertyValue);
  if (propertyValue === undefined || propertyValue <= 0) {
    errors.push('propertyValue must be a positive number');
  }

  const requestedLoanAmount = asNumber(record.requestedLoanAmount);
  if (requestedLoanAmount === undefined || requestedLoanAmount <= 0) {
    errors.push('requestedLoanAmount must be a positive number');
  }

  const age = asNumber(record.age);
  if (age === undefined || age < 0 || age > 120) {
    errors.push('age must be a number between 0 and 120');
  }

  const monthlyDebts = record.monthlyDebts === undefined ? 0 : asNumber(record.monthlyDebts);
  if (monthlyDebts === undefined || monthlyDebts < 0) {
    errors.push('monthlyDebts must be a non-negative number');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const gender = typeof record.gender === 'string' ? record.gender : undefined;

  return {
    ok: true,
    errors: [],
    request: {
      incomeSource: incomeSource as IncomeSource,
      grossAnnualIncome: grossAnnualIncome as number,
      propertyValue: propertyValue as number,
      requestedLoanAmount: requestedLoanAmount as number,
      age: age as number,
      gender,
      monthlyDebts: monthlyDebts as number,
    },
  };
}
