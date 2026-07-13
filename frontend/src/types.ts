export type IncomeSource = 'permanent' | 'temporary' | 'self_employed' | 'benefit';

export type Verdict = 'approved' | 'needs_review' | 'declined';

export interface MortgageForm {
  incomeSource: IncomeSource;
  grossAnnualIncome: string;
  propertyValue: string;
  requestedLoanAmount: string;
  monthlyDebts: string;
  age: string;
  gender: string;
}

export interface MortgageRequest {
  incomeSource: IncomeSource;
  grossAnnualIncome: number;
  propertyValue: number;
  requestedLoanAmount: number;
  monthlyDebts: number;
  age: number;
  gender: string;
}

export interface AgentResult {
  verdict: Verdict;
  reason: string;
}
