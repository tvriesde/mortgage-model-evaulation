"""Deterministic Dutch mortgage rules — the ground-truth reference.

This mirrors backend/src/rules/mortgageRules.ts exactly and is used to label the
evaluation dataset. See docs/mortgage-rules.md. Not for real lending decisions.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal, TypedDict

IncomeSource = Literal["permanent", "temporary", "self_employed", "benefit"]
Verdict = Literal["approved", "needs_review", "declined"]

LTV_CAP = 1.0
STATE_PENSION_AGE = 67
MARGINAL_LOWER = 0.95
MARGINAL_UPPER = 1.05
DEBT_REDUCTION_FACTOR = 100


class MortgageRequest(TypedDict, total=False):
    incomeSource: IncomeSource
    grossAnnualIncome: float
    propertyValue: float
    requestedLoanAmount: float
    age: int
    gender: str
    monthlyDebts: float


@dataclass
class MortgageDecision:
    verdict: Verdict
    reason: str
    max_loan_by_income: int
    max_loan_by_value: int
    max_loan: int


def income_multiplier(gross_annual_income: float) -> float:
    if gross_annual_income < 30000:
        return 4.0
    if gross_annual_income <= 60000:
        return 4.5
    return 5.0


def _income_source_factor(source: IncomeSource) -> tuple[float, bool]:
    return {
        "permanent": (1.0, False),
        "temporary": (1.0, True),
        "self_employed": (0.9, True),
        "benefit": (0.7, True),
    }[source]


def _age_factor(age: int) -> tuple[float, bool]:
    if age >= STATE_PENSION_AGE:
        return (0.7, True)
    if age >= 57:
        return (0.85, True)
    return (1.0, False)


def compute_mortgage_decision(request: MortgageRequest) -> MortgageDecision:
    monthly_debts = request.get("monthlyDebts") or 0
    income = request.get("grossAnnualIncome") or 0
    property_value = request.get("propertyValue") or 0
    requested = request.get("requestedLoanAmount") or 0
    age = request.get("age")

    if income <= 0 or property_value <= 0 or requested <= 0 or age is None:
        return MortgageDecision("declined", "invalid application data", 0, 0, 0)

    if age < 18:
        return MortgageDecision("declined", "applicant must be at least 18 years old", 0, 0, 0)

    factor, income_review = _income_source_factor(request["incomeSource"])
    age_factor, age_review = _age_factor(age)
    multiplier = income_multiplier(income)

    max_loan_by_income = round(
        income * multiplier * factor * age_factor - monthly_debts * DEBT_REDUCTION_FACTOR
    )
    max_loan_by_value = round(property_value * LTV_CAP)
    max_loan = min(max_loan_by_income, max_loan_by_value)

    if requested > max_loan_by_value:
        return MortgageDecision(
            "declined",
            "loan exceeds property value (LTV over 100%)",
            max_loan_by_income,
            max_loan_by_value,
            max_loan,
        )

    if requested > max_loan_by_income * MARGINAL_UPPER:
        return MortgageDecision(
            "declined",
            "requested loan exceeds maximum borrowing capacity based on income",
            max_loan_by_income,
            max_loan_by_value,
            max_loan,
        )

    marginal = requested > max_loan_by_income * MARGINAL_LOWER
    if marginal or income_review or age_review:
        reasons: list[str] = []
        if marginal:
            reasons.append("requested loan is close to the maximum borrowing capacity")
        if income_review:
            reasons.append(
                f'income source "{request["incomeSource"]}" requires manual verification'
            )
        if age_review:
            reasons.append(
                "applicant age requires assessment against retirement/pension income"
            )
        return MortgageDecision(
            "needs_review",
            "; ".join(reasons),
            max_loan_by_income,
            max_loan_by_value,
            max_loan,
        )

    return MortgageDecision(
        "approved",
        "requested loan is within income and property-value limits",
        max_loan_by_income,
        max_loan_by_value,
        max_loan,
    )
