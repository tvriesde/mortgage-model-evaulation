"""Agentic regression evaluation — the CI gate.

Runs the deployed mortgage agent against the labeled dataset using the Azure AI
Foundry evaluation SDK (azure-ai-evaluation) and fails (exit code 1) when the
agent's verdict accuracy drops below the threshold or produces a severe mismatch
(approved <-> declined). Results are written to evals/results/.

Usage:
    python run_eval.py [--threshold 0.9] [--max-severe 0] [--groundedness]

Environment:
    AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT, AZURE_OPENAI_API_VERSION
    EVAL_MOCK=true            -> use the reference calculator instead of the model
    EVAL_PASS_THRESHOLD       -> default accuracy threshold (default 0.9)
    EVAL_MAX_SEVERE           -> max allowed approved<->declined flips (default 0)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from agent_target import evaluate_request
from evaluators.verdict_match import VerdictMatchEvaluator

HERE = Path(__file__).parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the mortgage agent regression evaluation.")
    parser.add_argument(
        "--threshold",
        type=float,
        default=float(os.environ.get("EVAL_PASS_THRESHOLD", "0.9")),
        help="Minimum verdict accuracy required to pass.",
    )
    parser.add_argument(
        "--max-severe",
        type=int,
        default=int(os.environ.get("EVAL_MAX_SEVERE", "0")),
        help="Maximum allowed approved<->declined mismatches.",
    )
    parser.add_argument(
        "--dataset",
        type=str,
        default=str(HERE / "data" / "mortgage_dataset.jsonl"),
        help="Path to the JSONL dataset.",
    )
    parser.add_argument(
        "--groundedness",
        action="store_true",
        help="Also run the built-in groundedness evaluator on the agent's reason.",
    )
    return parser.parse_args()


def build_evaluators(use_groundedness: bool):
    evaluators = {"verdict_match": VerdictMatchEvaluator()}
    evaluator_config = {
        "verdict_match": {
            "column_mapping": {
                "verdict": "${target.verdict}",
                "expected_verdict": "${data.expected_verdict}",
            }
        }
    }

    if use_groundedness:
        from azure.ai.evaluation import AzureOpenAIModelConfiguration, GroundednessEvaluator

        model_config = AzureOpenAIModelConfiguration(
            azure_endpoint=os.environ["AZURE_OPENAI_ENDPOINT"],
            azure_deployment=os.environ["AZURE_OPENAI_DEPLOYMENT"],
            api_version=os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21"),
        )
        evaluators["groundedness"] = GroundednessEvaluator(model_config)
        evaluator_config["groundedness"] = {
            "column_mapping": {
                "response": "${target.response}",
                "context": "${data.context}",
                "query": "${data.query}",
            }
        }

    return evaluators, evaluator_config


def summarize(rows: list[dict]) -> dict:
    total = len(rows)
    matches = 0
    severe = 0
    failures = []
    for row in rows:
        match = row.get("outputs.verdict_match.verdict_match", 0.0)
        sev = row.get("outputs.verdict_match.severe_mismatch", 0.0)
        if match >= 1.0:
            matches += 1
        else:
            failures.append(
                {
                    "expected": row.get("outputs.verdict_match.expected_verdict"),
                    "actual": row.get("outputs.verdict_match.actual_verdict"),
                    "query": row.get("inputs.query"),
                    "severe": sev >= 1.0,
                }
            )
        if sev >= 1.0:
            severe += 1
    accuracy = matches / total if total else 0.0
    return {"total": total, "matches": matches, "accuracy": accuracy, "severe": severe, "failures": failures}


def main() -> int:
    args = parse_args()
    mock = os.environ.get("EVAL_MOCK", "").lower() == "true"

    print("=== Mortgage agent regression evaluation ===")
    print(f"Mode:        {'MOCK (reference calculator)' if mock else 'LIVE model'}")
    if not mock:
        print(f"Endpoint:    {os.environ.get('AZURE_OPENAI_ENDPOINT', '<unset>')}")
        print(f"Deployment:  {os.environ.get('AZURE_OPENAI_DEPLOYMENT', '<unset>')}")
    print(f"Dataset:     {args.dataset}")
    print(f"Threshold:   {args.threshold:.0%} accuracy, <= {args.max_severe} severe mismatch(es)")
    print()

    from azure.ai.evaluation import evaluate

    evaluators, evaluator_config = build_evaluators(args.groundedness)

    result = evaluate(
        data=args.dataset,
        target=evaluate_request,
        evaluators=evaluators,
        evaluator_config=evaluator_config,
    )

    rows = result.get("rows", [])
    summary = summarize(rows)

    results_dir = HERE / "results"
    results_dir.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_file = results_dir / f"eval-{stamp}.json"
    out_file.write_text(
        json.dumps({"summary": summary, "metrics": result.get("metrics", {})}, indent=2),
        encoding="utf-8",
    )

    print(f"Cases:      {summary['total']}")
    print(f"Correct:    {summary['matches']}")
    print(f"Accuracy:   {summary['accuracy']:.1%}")
    print(f"Severe:     {summary['severe']} (approved<->declined flips)")
    if summary["failures"]:
        print("\nMismatches:")
        for f in summary["failures"]:
            marker = "!!" if f["severe"] else "  "
            print(f"  {marker} expected={f['expected']:<12} actual={f['actual']:<12} {f['query']}")
    print(f"\nResults written to {out_file}")

    passed = summary["accuracy"] >= args.threshold and summary["severe"] <= args.max_severe
    print(f"\nGATE: {'PASS' if passed else 'FAIL'}")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
