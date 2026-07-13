import type { AgentResult } from '../../types';

interface ResultStepProps {
  result: AgentResult;
  onRestart: () => void;
}

const PRESENTATION: Record<
  AgentResult['verdict'],
  { title: string; emoji: string; className: string }
> = {
  approved: { title: "You're good to go!", emoji: '🎉', className: 'result--approved' },
  needs_review: {
    title: 'Almost there — we need a closer look',
    emoji: '🔍',
    className: 'result--review',
  },
  declined: { title: 'Not just yet', emoji: '💜', className: 'result--declined' },
};

export function ResultStep({ result, onRestart }: ResultStepProps) {
  const view = PRESENTATION[result.verdict];
  return (
    <div className={`card result ${view.className}`} data-testid="result" data-verdict={result.verdict}>
      <div className="result__emoji" aria-hidden="true">
        {view.emoji}
      </div>
      <h2 data-testid="result-title">{view.title}</h2>
      <p className="result__badge" data-testid="result-verdict">
        {result.verdict.replace('_', ' ')}
      </p>
      <p className="result__reason" data-testid="result-reason">
        {result.reason}
      </p>
      <button type="button" className="btn btn--ghost" onClick={onRestart}>
        Start over
      </button>
    </div>
  );
}
