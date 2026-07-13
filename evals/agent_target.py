"""The agent under test: calls the deployed Azure AI Foundry model.

Mirrors the backend agent (backend/src/services/foundryAgent.ts and
backend/src/prompts/systemPrompt.ts). Set EVAL_MOCK=true to use the deterministic
reference calculator instead of the model (useful for validating the harness itself).
"""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache

from reference_calculator import compute_mortgage_decision

SYSTEM_PROMPT = """You are a mortgage pre-assessment agent for a Dutch bank that helps first-time home buyers.
You must decide a preliminary verdict for a mortgage request using the rules below and return
ONLY a JSON object. Do not give financial advice or add commentary outside the JSON.

RULES (all amounts in EUR):

1. Maximum borrowing by income:
   maxLoanByIncome = grossAnnualIncome * multiplier * incomeFactor * ageFactor - (monthlyDebts * 100)

   multiplier (by gross annual income):
     - income < 30000        -> 4.0
     - 30000 <= income <= 60000 -> 4.5
     - income > 60000        -> 5.0

   incomeFactor (by income source), and whether it forces "needs_review":
     - permanent      -> 1.00, review = no
     - temporary      -> 1.00, review = yes
     - self_employed  -> 0.90, review = yes
     - benefit        -> 0.70, review = yes

   ageFactor (state pension age is 67), and whether it forces "needs_review":
     - age >= 67   -> 0.70, review = yes
     - 57 <= age <= 66 -> 0.85, review = yes
     - 18 <= age <= 56 -> 1.00, review = no

2. Maximum borrowing by value (LTV cap is 100%):
   maxLoanByValue = propertyValue * 1.00

DECISION (evaluate in order):
   a. If age < 18 -> "declined", reason "applicant must be at least 18 years old".
   b. If any of grossAnnualIncome, propertyValue, requestedLoanAmount is not positive -> "declined", reason "invalid application data".
   c. If requestedLoanAmount > maxLoanByValue -> "declined", reason "loan exceeds property value (LTV over 100%)".
   d. If requestedLoanAmount > maxLoanByIncome * 1.05 -> "declined", reason "requested loan exceeds maximum borrowing capacity based on income".
   e. If requestedLoanAmount > maxLoanByIncome * 0.95 (marginal) OR incomeFactor forces review OR ageFactor forces review -> "needs_review", with a reason explaining which condition(s) applied.
   f. Otherwise -> "approved", reason "requested loan is within income and property-value limits".

OUTPUT: return ONLY a JSON object with this exact shape:
{
  "verdict": "approved" | "needs_review" | "declined",
  "reason": "<short human-readable explanation>"
}"""


@lru_cache(maxsize=1)
def _client():
    from azure.identity import DefaultAzureCredential, get_bearer_token_provider
    from openai import AzureOpenAI

    endpoint = os.environ["AZURE_OPENAI_ENDPOINT"]
    api_version = os.environ.get("AZURE_OPENAI_API_VERSION", "2024-10-21")
    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
    )
    return AzureOpenAI(
        azure_endpoint=endpoint,
        api_version=api_version,
        azure_ad_token_provider=token_provider,
    )


def _mock(row: dict) -> dict:
    decision = compute_mortgage_decision(row)  # type: ignore[arg-type]
    return {"verdict": decision.verdict, "reason": decision.reason, "response": decision.reason}


def _is_reasoning_model(deployment: str) -> bool:
    # Reasoning models (gpt-5.x, o-series) reject temperature != 1, so omit it.
    return re.match(r"^(gpt-5|o\d)", deployment, re.IGNORECASE) is not None


def evaluate_request(
    incomeSource: str,
    grossAnnualIncome: float,
    propertyValue: float,
    requestedLoanAmount: float,
    age: int,
    gender: str = "",
    monthlyDebts: float = 0,
) -> dict:
    """Target callable invoked by azure-ai-evaluation for each dataset row.

    Parameters are named to match the dataset columns so the evaluation SDK can
    map them automatically.
    """
    row = {
        "incomeSource": incomeSource,
        "grossAnnualIncome": grossAnnualIncome,
        "propertyValue": propertyValue,
        "requestedLoanAmount": requestedLoanAmount,
        "age": age,
        "gender": gender,
        "monthlyDebts": monthlyDebts,
    }

    if os.environ.get("EVAL_MOCK", "").lower() == "true":
        return _mock(row)

    deployment = os.environ["AZURE_OPENAI_DEPLOYMENT"]
    user_message = json.dumps(row)

    kwargs: dict = {
        "model": deployment,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    }
    if not _is_reasoning_model(deployment):
        kwargs["temperature"] = 0

    completion = _client().chat.completions.create(**kwargs)
    content = completion.choices[0].message.content or "{}"
    parsed = json.loads(content)
    reason = parsed.get("reason", "")
    return {
        "verdict": parsed.get("verdict", "unknown"),
        "reason": reason,
        "response": reason,
    }
