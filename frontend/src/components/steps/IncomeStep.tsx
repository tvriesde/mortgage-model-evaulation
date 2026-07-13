import type { IncomeSource, MortgageForm } from '../../types';

interface IncomeStepProps {
  form: MortgageForm;
  onChange: (patch: Partial<MortgageForm>) => void;
  onNext: () => void;
  errors: Record<string, string>;
}

const INCOME_SOURCES: { value: IncomeSource; label: string; emoji: string }[] = [
  { value: 'permanent', label: 'Permanent contract', emoji: '💼' },
  { value: 'temporary', label: 'Temporary contract', emoji: '📄' },
  { value: 'self_employed', label: 'Self-employed / ZZP', emoji: '🚀' },
  { value: 'benefit', label: 'Benefit / other', emoji: '🌱' },
];

export function IncomeStep({ form, onChange, onNext, errors }: IncomeStepProps) {
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
    >
      <h2>Let's talk money 💶</h2>
      <p className="muted">Tell us how you earn and what you're dreaming of buying.</p>

      <fieldset className="field">
        <legend>Where does your income come from?</legend>
        <div className="chips" role="radiogroup" aria-label="Income source">
          {INCOME_SOURCES.map((source) => (
            <label
              key={source.value}
              className={`chip ${form.incomeSource === source.value ? 'chip--selected' : ''}`}
            >
              <input
                type="radio"
                name="incomeSource"
                value={source.value}
                checked={form.incomeSource === source.value}
                onChange={() => onChange({ incomeSource: source.value })}
              />
              <span aria-hidden="true">{source.emoji}</span> {source.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="field">
        <span>Gross annual income (€)</span>
        <input
          type="number"
          name="grossAnnualIncome"
          inputMode="numeric"
          min="0"
          value={form.grossAnnualIncome}
          onChange={(e) => onChange({ grossAnnualIncome: e.target.value })}
          placeholder="e.g. 42000"
        />
        {errors.grossAnnualIncome && <span className="error">{errors.grossAnnualIncome}</span>}
      </label>

      <label className="field">
        <span>Price of the home you want (€)</span>
        <input
          type="number"
          name="propertyValue"
          inputMode="numeric"
          min="0"
          value={form.propertyValue}
          onChange={(e) => onChange({ propertyValue: e.target.value })}
          placeholder="e.g. 300000"
        />
        {errors.propertyValue && <span className="error">{errors.propertyValue}</span>}
      </label>

      <label className="field">
        <span>How much do you want to borrow? (€)</span>
        <input
          type="number"
          name="requestedLoanAmount"
          inputMode="numeric"
          min="0"
          value={form.requestedLoanAmount}
          onChange={(e) => onChange({ requestedLoanAmount: e.target.value })}
          placeholder="e.g. 285000"
        />
        {errors.requestedLoanAmount && <span className="error">{errors.requestedLoanAmount}</span>}
      </label>

      <label className="field">
        <span>Monthly debt payments, e.g. study debt (€)</span>
        <input
          type="number"
          name="monthlyDebts"
          inputMode="numeric"
          min="0"
          value={form.monthlyDebts}
          onChange={(e) => onChange({ monthlyDebts: e.target.value })}
          placeholder="0"
        />
      </label>

      <button type="submit" className="btn btn--primary">
        Next: about you →
      </button>
    </form>
  );
}
