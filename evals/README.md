# Evaluations — Foundry agentic regression suite

Python evaluation harness that runs the deployed mortgage agent against a labeled
dataset and **gates deployment** on verdict accuracy. Built on the Azure AI Foundry
evaluation SDK (`azure-ai-evaluation`).

## Files

| File                       | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `reference_calculator.py`  | Deterministic Dutch rules (ground truth), mirrors the backend |
| `generate_dataset.py`      | Builds `data/mortgage_dataset.jsonl` with ground-truth labels |
| `data/mortgage_dataset.jsonl` | Labeled requests (approved / needs_review / declined)      |
| `agent_target.py`          | The agent under test — calls the Foundry model (keyless)      |
| `evaluators/verdict_match.py` | Custom evaluator: verdict == expected (+ severe-flip flag)  |
| `run_eval.py`              | Runs `evaluate()`, prints a report, exits non-zero on failure |

## Run locally

```powershell
# From the repo root — sets env from the deployed stack and runs the eval
./scripts/run-evals.ps1 -Env dev

# Or directly:
python -m venv .venv; ./.venv/Scripts/Activate.ps1
pip install -r requirements.txt
$env:AZURE_OPENAI_ENDPOINT = "https://<subdomain>.openai.azure.com/"
$env:AZURE_OPENAI_DEPLOYMENT = "gpt-4.1"
python run_eval.py --threshold 0.9 --max-severe 0
```

Set `EVAL_MOCK=true` to exercise the harness without a deployed model (uses the
reference calculator as the "agent").

## The gate

The build fails when either:
- verdict **accuracy** < `--threshold` (default 90%), or
- there is any **severe mismatch** (an `approved` ↔ `declined` flip), configurable
  via `--max-severe`.

Regenerate the dataset after changing the rules: `python generate_dataset.py`.
