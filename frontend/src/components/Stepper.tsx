interface StepperProps {
  current: number;
  steps: string[];
}

export function Stepper({ current, steps }: StepperProps) {
  return (
    <ol className="stepper" aria-label="Progress">
      {steps.map((label, index) => {
        const state = index < current ? 'done' : index === current ? 'active' : 'upcoming';
        return (
          <li key={label} className={`stepper__item stepper__item--${state}`}>
            <span className="stepper__dot" aria-hidden="true">
              {index < current ? '✓' : index + 1}
            </span>
            <span className="stepper__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
