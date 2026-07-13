# Mortgage Agent — Agentic Regression Testing Demo

A demo banking application for first-time home buyers in the Netherlands. It collects a
mortgage request across a short wizard and asks an **Azure AI Foundry model ("the agent")**
to produce a preliminary decision: **approved**, **needs review**, or **declined** (with a
reason). The point of the demo is the **agentic regression test suite** that guards the
agent's decision quality in CI/CD.

## Stack

| Layer        | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| Frontend     | React + Vite → Azure Static Web App                               |
| Backend      | Node.js (TypeScript) Azure Functions, **Flex Consumption** SKU     |
| AI           | Azure AI Foundry project + `gpt-4.1` model deployment (swappable)  |
| IaC          | Bicep (`infra/`)                                                   |
| Unit tests   | Vitest (backend + frontend)                                       |
| E2E tests    | Playwright (Gherkin-driven, `frontend/e2e`)                        |
| Agentic evals| Python `azure-ai-evaluation` (`evals/`) — **gates deployment**     |
| CI/CD        | GitHub Actions (OIDC) + matching PowerShell scripts (`scripts/`)   |

## Repository layout

```
infra/       Bicep infrastructure (Foundry, Functions, Static Web App, monitoring)
backend/     Node.js Functions API (mortgage rules, agent call, prompt)
frontend/    React wizard + Playwright e2e
evals/       Python Foundry evaluation suite + labeled dataset + reference calculator
scripts/     PowerShell equivalents of every CI step (run locally or from CI)
.github/     GitHub Actions workflow
```

## Quick start (local)

```powershell
# 1. Unit tests
./scripts/run-unit-tests.ps1

# 2. Deploy infra to dev (creates Foundry + model + Functions + SWA)
./scripts/deploy-infra.ps1 -Env dev

# 3. Playwright functional tests (mocked agent, no cloud needed)
./scripts/run-playwright.ps1

# 4. Agentic evaluations against the deployed model (the CI gate)
./scripts/run-evals.ps1 -Env dev

# 5. Full pipeline locally (mirrors CI order)
./scripts/deploy.ps1 -Env dev
```

## Swapping the model version

Edit `infra/main.<env>.bicepparam` (the `model` object's `name` / `version`), re-run
`./scripts/deploy-infra.ps1`, then `./scripts/run-evals.ps1` to confirm the new model still
passes the regression gate before promoting the app.

## CI/CD (GitHub Actions)

The workflow [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml) runs, in order:
**unit tests → Playwright → deploy infra → agentic eval gate → deploy backend → deploy
frontend**. Each stage calls the same PowerShell script you can run locally. On pull
requests only the test stages run; deployment stages run on `push` to `main` and via
`workflow_dispatch`.

Authentication uses **OIDC federated credentials** (no stored passwords). Configure an
Entra ID app registration / user-assigned identity with a federated credential for this
repo, grant it `Contributor` + `User Access Administrator` (needed for the role
assignments) on the subscription/resource group, and add these repository secrets:

| Secret                          | Value                                                  |
| ------------------------------- | ------------------------------------------------------ |
| `AZURE_CLIENT_ID`               | App registration (client) ID                           |
| `AZURE_TENANT_ID`               | Entra tenant ID                                        |
| `AZURE_SUBSCRIPTION_ID`         | Target subscription ID                                 |
| `AZURE_EVALUATOR_PRINCIPAL_ID`  | Object ID of the CI service principal (for model RBAC) |

See [docs/mortgage-rules.md](docs/mortgage-rules.md) for the Dutch lending rules the agent
and the evaluation ground truth are based on.
