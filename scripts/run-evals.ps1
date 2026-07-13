<#
.SYNOPSIS
    Runs the Foundry agentic regression evaluation against the deployed model.
    Exits non-zero when the agent's verdict accuracy falls below the threshold.
.PARAMETER Env
    Target environment: dev or prd (used to read the deployed model config).
.PARAMETER Threshold
    Minimum verdict accuracy required to pass (0-1).
.PARAMETER MaxSevere
    Maximum allowed approved<->declined mismatches.
.PARAMETER Mock
    Use the deterministic reference calculator instead of the deployed model.
.PARAMETER Groundedness
    Also run the built-in groundedness evaluator on the agent's reason.
#>
[CmdletBinding()]
param(
    [ValidateSet('dev', 'prd')]
    [string]$Env = 'dev',
    [double]$Threshold = 0.9,
    [int]$MaxSevere = 0,
    [switch]$Mock,
    [switch]$Groundedness
)

. "$PSScriptRoot/common.ps1"

$evals = "$RepoRoot/evals"

if ($Mock) {
    $env:EVAL_MOCK = 'true'
    Write-Step "Running evaluation in MOCK mode"
}
else {
    Write-Step "Reading deployed model configuration ($Env)"
    $outputs = Get-InfraOutputs $Env
    $env:AZURE_OPENAI_ENDPOINT = $outputs['openAiEndpoint']
    $env:AZURE_OPENAI_DEPLOYMENT = $outputs['openAiDeployment']
    $env:AZURE_OPENAI_API_VERSION = $outputs['openAiApiVersion']
    Remove-Item Env:EVAL_MOCK -ErrorAction SilentlyContinue
    Write-Host "  Endpoint:   $($env:AZURE_OPENAI_ENDPOINT)"
    Write-Host "  Deployment: $($env:AZURE_OPENAI_DEPLOYMENT)"
}

Push-Location $evals
try {
    if (-not (Test-Path '.venv')) {
        Write-Step "Creating Python virtual environment"
        python -m venv .venv
        Assert-LastExitCode "venv create"
    }

    $python = if ($IsWindows -or $env:OS -eq 'Windows_NT') { '.venv/Scripts/python.exe' } else { '.venv/bin/python' }

    Write-Step "Installing evaluation dependencies"
    & $python -m pip install --quiet --upgrade pip
    & $python -m pip install --quiet -r requirements.txt
    Assert-LastExitCode "pip install"

    Write-Step "Regenerating labeled dataset"
    & $python generate_dataset.py
    Assert-LastExitCode "dataset generation"

    Write-Step "Running agentic evaluation"
    $evalArgs = @('run_eval.py', '--threshold', $Threshold, '--max-severe', $MaxSevere)
    if ($Groundedness) { $evalArgs += '--groundedness' }
    & $python @evalArgs
    $evalExit = $LASTEXITCODE
}
finally {
    Pop-Location
}

if ($evalExit -ne 0) {
    Write-Host "`nEvaluation gate FAILED." -ForegroundColor Red
    exit $evalExit
}
Write-Host "`nEvaluation gate PASSED." -ForegroundColor Green
