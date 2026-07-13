# Shared helpers for the mortgage-agent scripts. Dot-source this file:
#   . "$PSScriptRoot/common.ps1"

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:BaseName = 'mortgage-agent'
$RepoRoot = Split-Path -Parent $PSScriptRoot

function Get-ResourceGroupName([string]$Env) {
    return "rg-$script:BaseName-$Env"
}

function Get-DeploymentName([string]$Env) {
    return "$script:BaseName-$Env"
}

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-LastExitCode([string]$What) {
    if ($LASTEXITCODE -ne 0) {
        throw "$What failed with exit code $LASTEXITCODE"
    }
}

# Returns a hashtable of the main deployment outputs for the given environment.
function Get-InfraOutputs([string]$Env) {
    $rg = Get-ResourceGroupName $Env
    $deployment = Get-DeploymentName $Env
    $json = az deployment group show --resource-group $rg --name $deployment --query properties.outputs -o json
    Assert-LastExitCode "Reading deployment outputs"
    $outputs = $json | ConvertFrom-Json
    $result = @{}
    foreach ($prop in $outputs.PSObject.Properties) {
        $result[$prop.Name] = $prop.Value.value
    }
    return $result
}
