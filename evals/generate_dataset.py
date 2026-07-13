"""Generate the labeled evaluation dataset (JSONL).

Each row contains a mortgage request, the ground-truth verdict (computed by the
deterministic reference calculator), and a short grounding explanation. The agent
under test must reproduce these verdicts. Run:

    python generate_dataset.py
"""
from __future__ import annotations

import json
from pathlib import Path

from reference_calculator import MortgageRequest, compute_mortgage_decision

# Curated cases spanning approved / needs_review / declined across the rule surface.
CASES: list[MortgageRequest] = [
    # Clear approvals (permanent, comfortably within limits)
    {"incomeSource": "permanent", "grossAnnualIncome": 50000, "propertyValue": 250000, "requestedLoanAmount": 200000, "age": 30, "gender": "female", "monthlyDebts": 0},
    {"incomeSource": "permanent", "grossAnnualIncome": 80000, "propertyValue": 500000, "requestedLoanAmount": 350000, "age": 35, "gender": "male", "monthlyDebts": 0},
    {"incomeSource": "permanent", "grossAnnualIncome": 45000, "propertyValue": 300000, "requestedLoanAmount": 150000, "age": 28, "gender": "non-binary", "monthlyDebts": 0},
    {"incomeSource": "permanent", "grossAnnualIncome": 65000, "propertyValue": 400000, "requestedLoanAmount": 280000, "age": 41, "gender": "male", "monthlyDebts": 100},
    {"incomeSource": "permanent", "grossAnnualIncome": 120000, "propertyValue": 700000, "requestedLoanAmount": 500000, "age": 45, "gender": "female", "monthlyDebts": 0},

    # Declined — LTV over 100%
    {"incomeSource": "permanent", "grossAnnualIncome": 50000, "propertyValue": 180000, "requestedLoanAmount": 200000, "age": 30, "gender": "female", "monthlyDebts": 0},
    {"incomeSource": "permanent", "grossAnnualIncome": 90000, "propertyValue": 300000, "requestedLoanAmount": 320000, "age": 38, "gender": "male", "monthlyDebts": 0},

    # Declined — income clearly insufficient
    {"incomeSource": "permanent", "grossAnnualIncome": 30000, "propertyValue": 400000, "requestedLoanAmount": 300000, "age": 33, "gender": "male", "monthlyDebts": 0},
    {"incomeSource": "permanent", "grossAnnualIncome": 25000, "propertyValue": 350000, "requestedLoanAmount": 250000, "age": 29, "gender": "female", "monthlyDebts": 0},
    {"incomeSource": "permanent", "grossAnnualIncome": 40000, "propertyValue": 500000, "requestedLoanAmount": 300000, "age": 31, "gender": "female", "monthlyDebts": 400},

    # Declined — under 18
    {"incomeSource": "permanent", "grossAnnualIncome": 20000, "propertyValue": 150000, "requestedLoanAmount": 100000, "age": 17, "gender": "male", "monthlyDebts": 0},

    # Needs review — temporary contract within limits
    {"incomeSource": "temporary", "grossAnnualIncome": 50000, "propertyValue": 250000, "requestedLoanAmount": 200000, "age": 30, "gender": "female", "monthlyDebts": 0},
    {"incomeSource": "temporary", "grossAnnualIncome": 60000, "propertyValue": 350000, "requestedLoanAmount": 220000, "age": 34, "gender": "male", "monthlyDebts": 0},

    # Needs review — self-employed within limits
    {"incomeSource": "self_employed", "grossAnnualIncome": 70000, "propertyValue": 400000, "requestedLoanAmount": 250000, "age": 39, "gender": "female", "monthlyDebts": 0},
    {"incomeSource": "self_employed", "grossAnnualIncome": 55000, "propertyValue": 300000, "requestedLoanAmount": 180000, "age": 36, "gender": "male", "monthlyDebts": 0},

    # Needs review — benefit income within (reduced) limits
    {"incomeSource": "benefit", "grossAnnualIncome": 40000, "propertyValue": 250000, "requestedLoanAmount": 100000, "age": 44, "gender": "female", "monthlyDebts": 0},

    # Needs review — near/after retirement age
    {"incomeSource": "permanent", "grossAnnualIncome": 60000, "propertyValue": 350000, "requestedLoanAmount": 150000, "age": 60, "gender": "male", "monthlyDebts": 0},
    {"incomeSource": "permanent", "grossAnnualIncome": 70000, "propertyValue": 400000, "requestedLoanAmount": 180000, "age": 68, "gender": "female", "monthlyDebts": 0},

    # Needs review — marginal amount (within 5% of income max) on a permanent contract
    {"incomeSource": "permanent", "grossAnnualIncome": 50000, "propertyValue": 300000, "requestedLoanAmount": 220000, "age": 32, "gender": "male", "monthlyDebts": 0},

    # Declined — self-employed but far over capacity (income rule beats review)
    {"incomeSource": "self_employed", "grossAnnualIncome": 40000, "propertyValue": 500000, "requestedLoanAmount": 300000, "age": 37, "gender": "female", "monthlyDebts": 0},
]


def build_query(case: MortgageRequest) -> str:
    return json.dumps(
        {
            "incomeSource": case["incomeSource"],
            "grossAnnualIncome": case["grossAnnualIncome"],
            "propertyValue": case["propertyValue"],
            "requestedLoanAmount": case["requestedLoanAmount"],
            "age": case["age"],
            "gender": case.get("gender"),
            "monthlyDebts": case.get("monthlyDebts", 0),
        }
    )


def main() -> None:
    out_path = Path(__file__).parent / "data" / "mortgage_dataset.jsonl"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with out_path.open("w", encoding="utf-8") as f:
        for case in CASES:
            decision = compute_mortgage_decision(case)
            row = {
                **case,
                "monthlyDebts": case.get("monthlyDebts", 0),
                "gender": case.get("gender", "prefer not to say"),
                "query": build_query(case),
                "expected_verdict": decision.verdict,
                "context": (
                    f"Ground truth: {decision.verdict}. {decision.reason}. "
                    f"Max loan by income = {decision.max_loan_by_income}, "
                    f"max loan by value = {decision.max_loan_by_value}."
                ),
            }
            f.write(json.dumps(row) + "\n")

    print(f"Wrote {len(CASES)} rows to {out_path}")


if __name__ == "__main__":
    main()
