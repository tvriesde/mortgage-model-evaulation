# Dutch mortgage rules (simplified, demo)

These rules are the **single source of truth** shared by three places:

1. the **agent system prompt** ([backend/src/prompts/systemPrompt.ts](../backend/src/prompts/systemPrompt.ts)),
2. the deterministic **reference calculator** used to label the eval dataset
   ([evals/reference_calculator.py](../evals/reference_calculator.py) and
   [backend/src/rules/mortgageRules.ts](../backend/src/rules/mortgageRules.ts)),
3. this document.

They are a **simplified but realistic** version of Dutch (Nibud/AFM-style) lending logic.
They are **not** financial advice and must not be used for real lending decisions.

## Inputs

| Field                 | Meaning                                                      |
| --------------------- | ----------------------------------------------------------- |
| `incomeSource`        | `permanent` \| `temporary` \| `self_employed` \| `benefit`   |
| `grossAnnualIncome`   | Gross annual income in EUR                                   |
| `propertyValue`       | Purchase price / market value of the home in EUR            |
| `requestedLoanAmount` | Mortgage amount requested in EUR                            |
| `age`                 | Applicant age in years                                      |
| `monthlyDebts`        | Existing monthly debt obligations (e.g. student loan) in EUR|

## Rule 1 — Loan-to-income (max borrowing by income)

`maxLoanByIncome = grossAnnualIncome × multiplier × incomeFactor × ageFactor − (monthlyDebts × 100)`

Income multiplier (banded):

| Gross annual income | Multiplier |
| ------------------- | ---------- |
| < €30,000           | 4.0        |
| €30,000 – €60,000   | 4.5        |
| > €60,000           | 5.0        |

Income-source factor (and review flag):

| Income source   | Factor | Forces "needs review"? |
| --------------- | ------ | ---------------------- |
| `permanent`     | 1.00   | no                     |
| `temporary`     | 1.00   | yes (contract type)    |
| `self_employed` | 0.90   | yes (3-yr avg needed)  |
| `benefit`       | 0.70   | yes                    |

Age factor (retirement assessment, state pension age ≈ 67):

| Age        | Factor | Forces "needs review"? |
| ---------- | ------ | ---------------------- |
| ≥ 67       | 0.70   | yes (pension income)   |
| 57 – 66    | 0.85   | yes                    |
| 18 – 56    | 1.00   | no                     |

## Rule 2 — Loan-to-value (LTV)

Dutch LTV cap is **100%** of the property value:

`maxLoanByValue = propertyValue × 1.00`

## Decision

Let `maxLoanByIncome` and `maxLoanByValue` be as above.

1. If `requestedLoanAmount > maxLoanByValue` → **declined** — _"loan exceeds property value (LTV over 100%)"_.
2. Else if `requestedLoanAmount > maxLoanByIncome × 1.05` → **declined** — _"requested loan exceeds maximum borrowing capacity based on income"_.
3. Else if `requestedLoanAmount > maxLoanByIncome × 0.95` (marginal) **or** the income source
   or age forces a review → **needs review** (with the relevant reason).
4. Otherwise → **approved**.

## Validation (declined outright)

- `age < 18` → declined — _"applicant must be at least 18 years old"_.
- Any non-positive income, property value, or requested amount → declined — _"invalid application data"_.
