import type { MortgageForm } from '../../types';

interface PersonalStepProps {
  form: MortgageForm;
  onChange: (patch: Partial<MortgageForm>) => void;
  onBack: () => void;
  onSubmit: () => void;
  errors: Record<string, string>;
  loading: boolean;
}

const GENDERS = ['female', 'male', 'non-binary', 'prefer not to say'];

export function PersonalStep({ form, onChange, onBack, onSubmit, errors, loading }: PersonalStepProps) {
  return (
    <form
      className="card"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h2>A little about you 🙋</h2>
      <p className="muted">We only use this to run your preliminary check.</p>

      <label className="field">
        <span>Your age</span>
        <input
          type="number"
          name="age"
          inputMode="numeric"
          min="0"
          max="120"
          value={form.age}
          onChange={(e) => onChange({ age: e.target.value })}
          placeholder="e.g. 27"
        />
        {errors.age && <span className="error">{errors.age}</span>}
      </label>

      <label className="field">
        <span>Gender</span>
        <select
          name="gender"
          value={form.gender}
          onChange={(e) => onChange({ gender: e.target.value })}
        >
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </label>

      <div className="actions">
        <button type="button" className="btn btn--ghost" onClick={onBack} disabled={loading}>
          ← Back
        </button>
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Checking…' : 'Check my mortgage 🏡'}
        </button>
      </div>
    </form>
  );
}
