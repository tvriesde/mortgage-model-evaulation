# Mortgage Agent — Agentic Regression Testing Demo

A demo banking application for first-time home buyers in the Netherlands. It collects a
mortgage request across a short wizard and asks an **Azure AI Foundry model ("the agent")**
to produce a preliminary decision: **approved**, **needs review**, or **declined** (with a
reason). The point of the demo is the **agentic regression test suite** that guards the
agent's decision quality in CI/CD.

## Why this repo exists

Agentic applications are hard to ship safely: the model sits at the core of the product,
yet its behaviour is non-deterministic and can silently regress when you change a prompt,
swap a model, or bump an API version. Traditional unit and E2E tests can't catch "the
answers got worse" — they only check that the plumbing still works.

This repo is a **reference for treating evaluation as a first-class CI/CD gate** for
agentic apps. It shows, end to end, how to:

- **Encode ground truth** as a deterministic reference (the mortgage rules engine) and use
  it to generate a labeled dataset the model is scored against.
- **Run agentic evaluations in the pipeline** with `azure-ai-evaluation`, measuring verdict
  accuracy and flagging severe (approved↔declined) regressions.
- **Gate deployment on quality**, not just tests — the eval job fails the build and blocks
  the backend/frontend deploy when accuracy drops below a threshold.
- **Compare models safely** by deploying candidates side-by-side and running the same gate
  against each before promoting one to production.

The mortgage use case is just a concrete, easy-to-reason-about vehicle; the pattern —
reference calculator → labeled dataset → evaluators → CI gate — transfers to any agentic
application where output quality matters.

## Stack

| Layer        | Technology                                                        |
| ------------ | ----------------------------------------------------------------- |
| Frontend     | React + Vite → Azure Static Web App                               |
| Backend      | Node.js (TypeScript) Azure Functions, **Flex Consumption** SKU     |
| AI           | Azure AI Foundry project + one or more model deployments (e.g. `gpt-4.1`, swappable) |
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

## Choosing models

Models are deployed **side-by-side** on the one Foundry account. Which model the
**app** uses and which model the **eval gate** tests are chosen independently, so you can
validate a candidate before promoting it to real users.

### 1. Which models are deployed

List the deployments in `infra/main.<env>.bicepparam` under `models`, and set
`primaryDeploymentName` to the one the backend app should use:

```bicep
param models = [
  { deploymentName: 'gpt-4.1',      name: 'gpt-4.1',      version: '2025-04-14', skuName: 'GlobalStandard', capacity: 20 }
  { deploymentName: 'gpt-4.1-mini', name: 'gpt-4.1-mini', version: '2025-04-14', skuName: 'GlobalStandard', capacity: 20 }
  { deploymentName: 'gpt-5',        name: 'gpt-5',        version: '2025-08-07', skuName: 'GlobalStandard', capacity: 20 }
]

param primaryDeploymentName = 'gpt-4.1'
```

Apply with `./scripts/deploy-infra.ps1 -Env dev`. Deployments are created serially
(`@batchSize(1)`) because a Cognitive Services account cannot create them concurrently.

> Reasoning models (`gpt-5`, `o*`) require a newer `openAiApiVersion` (dev uses
> `2025-04-01-preview`) and reject `temperature: 0` — the backend agent and the eval
> target detect these by name and omit the temperature automatically.

### 2. Change the model the **app** uses

Edit `primaryDeploymentName` in `infra/main.<env>.bicepparam` (it must be one of the
deployed `models`) and redeploy:

```powershell
./scripts/deploy-infra.ps1 -Env dev
```

This updates the Function app's `AZURE_OPENAI_DEPLOYMENT` setting, which
`backend/src/services/foundryAgent.ts` reads at runtime. For a quick, non-persistent
experiment you can override the setting directly (reset on the next infra deploy):

```powershell
az functionapp config appsettings set `
  --name mortgage-agent-dev-func --resource-group rg-mortgage-agent-dev `
  --settings AZURE_OPENAI_DEPLOYMENT=gpt-4.1-mini
```

### 3. Change the model the **eval gate** tests

Pass `-Deployment` to target any deployed model without touching the app (defaults to
`primaryDeploymentName`):

```powershell
./scripts/run-evals.ps1 -Env dev -Deployment gpt-4.1-mini
./scripts/run-evals.ps1 -Env dev -Deployment gpt-5
```

In CI, use **Run workflow** (`workflow_dispatch`) and pick the `model` input; the eval job
validates it's deployed to the target env before running. Normal `push` builds evaluate
`primaryDeploymentName`.

**Recommended flow:** confirm a candidate passes `run-evals.ps1 -Deployment <model>`, then
promote it by setting `primaryDeploymentName` and redeploying.

## CI/CD (GitHub Actions)

The workflow [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml) runs, in order:
**unit tests → Playwright → deploy infra → agentic eval gate → deploy backend → deploy
frontend**. Each stage calls the same PowerShell script you can run locally. On pull
requests only the test stages run; deployment stages run on `push` to `main` and via
`workflow_dispatch`. A manual `workflow_dispatch` run also accepts a `model` input to run
the eval gate against a specific deployed model (see [Choosing models](#choosing-models)).

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
