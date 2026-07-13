<#
.SYNOPSIS
    Full local pipeline, mirroring the CI/CD job order:
    unit tests -> infra -> Playwright -> agentic evals (gate) -> backend -> frontend.
.PARAMETER Env
    Target environment: dev or prd.
.PARAMETER SkipTests
    Skip unit + Playwright tests.
.PARAMETER SkipEvals
    Skip the agentic evaluation gate (not recommended).
.PARAMETER SkipInfra
    Skip the infrastructure deployment.
.PARAMETER EvaluatorPrincipalId
    Object ID granted access to the model for evaluations (passed to infra deploy).
#>
[CmdletBinding()]
param(
    [ValidateSet('dev', 'prd')]
    [string]$Env = 'dev',
    [switch]$SkipTests,
    [switch]$SkipEvals,
    [switch]$SkipInfra,
    [string]$EvaluatorPrincipalId = ''
)

. "$PSScriptRoot/common.ps1"

if (-not $SkipTests) {
    Write-Step "STAGE 1/6 — Unit tests"
    & "$PSScriptRoot/run-unit-tests.ps1"
}

if (-not $SkipInfra) {
    Write-Step "STAGE 2/6 — Infrastructure"
    & "$PSScriptRoot/deploy-infra.ps1" -Env $Env -EvaluatorPrincipalId $EvaluatorPrincipalId
}

if (-not $SkipTests) {
    Write-Step "STAGE 3/6 — Playwright functional tests"
    & "$PSScriptRoot/run-playwright.ps1"
}

if (-not $SkipEvals) {
    Write-Step "STAGE 4/6 — Agentic evaluation gate"
    & "$PSScriptRoot/run-evals.ps1" -Env $Env
    if ($LASTEXITCODE -ne 0) {
        throw "Agentic evaluation gate failed — deployment blocked."
    }
}

Write-Step "STAGE 5/6 — Backend deployment"
& "$PSScriptRoot/deploy-backend.ps1" -Env $Env

Write-Step "STAGE 6/6 — Frontend deployment"
& "$PSScriptRoot/deploy-frontend.ps1" -Env $Env

Write-Host "`nPipeline complete for '$Env'." -ForegroundColor Green
