import { useState } from 'react';
import { Stepper } from './components/Stepper';
import { IncomeStep } from './components/steps/IncomeStep';
import { PersonalStep } from './components/steps/PersonalStep';
import { ResultStep } from './components/steps/ResultStep';
import { evaluateMortgage } from './api';
import type { AgentResult, MortgageForm } from './types';

const STEPS = ['Your money', 'About you', 'Result'];

const INITIAL_FORM: MortgageForm = {
  incomeSource: 'permanent',
  grossAnnualIncome: '',
  propertyValue: '',
  requestedLoanAmount: '',
  monthlyDebts: '0',
  age: '',
  gender: 'prefer not to say',
};

function validateIncome(form: MortgageForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!(Number(form.grossAnnualIncome) > 0)) {
    errors.grossAnnualIncome = 'Enter your gross annual income.';
  }
  if (!(Number(form.propertyValue) > 0)) {
    errors.propertyValue = 'Enter the price of the home.';
  }
  if (!(Number(form.requestedLoanAmount) > 0)) {
    errors.requestedLoanAmount = 'Enter how much you want to borrow.';
  }
  return errors;
}

function validatePersonal(form: MortgageForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const age = Number(form.age);
  if (!(age > 0) || age > 120) {
    errors.age = 'Enter a valid age.';
  }
  return errors;
}

export function App() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<MortgageForm>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const patch = (p: Partial<MortgageForm>) => setForm((prev) => ({ ...prev, ...p }));

  const goToPersonal = () => {
    const found = validateIncome(form);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      setStep(1);
    }
  };

  const submit = async () => {
    const found = validatePersonal(form);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      return;
    }
    setApiError(null);
    setLoading(true);
    try {
      const agentResult = await evaluateMortgage({
        incomeSource: form.incomeSource,
        grossAnnualIncome: Number(form.grossAnnualIncome),
        propertyValue: Number(form.propertyValue),
        requestedLoanAmount: Number(form.requestedLoanAmount),
        monthlyDebts: Number(form.monthlyDebts) || 0,
        age: Number(form.age),
        gender: form.gender,
      });
      setResult(agentResult);
      setStep(2);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const restart = () => {
    setForm(INITIAL_FORM);
    setErrors({});
    setResult(null);
    setApiError(null);
    setStep(0);
  };

  return (
    <div className="page">
      <header className="hero">
        <span className="hero__logo">🏡 Huisje</span>
        <h1>Your first home starts here</h1>
        <p>Get a friendly, instant read on your mortgage — no jargon, no pressure.</p>
      </header>

      <main className="container">
        <Stepper current={step} steps={STEPS} />

        {apiError && (
          <div className="banner banner--error" role="alert">
            {apiError}
          </div>
        )}

        {step === 0 && (
          <IncomeStep form={form} onChange={patch} onNext={goToPersonal} errors={errors} />
        )}
        {step === 1 && (
          <PersonalStep
            form={form}
            onChange={patch}
            onBack={() => setStep(0)}
            onSubmit={submit}
            errors={errors}
            loading={loading}
          />
        )}
        {step === 2 && result && <ResultStep result={result} onRestart={restart} />}
      </main>

      <footer className="footer">
        <p>Demo only — not a real lending decision. Built to showcase agentic regression testing.</p>
      </footer>
    </div>
  );
}
