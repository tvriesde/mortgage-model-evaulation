<#
.SYNOPSIS
    Deploys the Bicep infrastructure (Foundry + model, Functions, Static Web App, monitoring).
.PARAMETER Env
    Target environment: dev or prd.
.PARAMETER Location
    Azure region for the resource group and most resources.
.PARAMETER EvaluatorPrincipalId
    Object ID granted "Cognitive Services OpenAI User" on the Foundry account so the
    evaluation step can call the model. Defaults to the signed-in user when available.
#>
[CmdletBinding()]
param(
    [ValidateSet('dev', 'prd')]
    [string]$Env = 'dev',
    [string]$Location = 'swedencentral',
    [string]$EvaluatorPrincipalId = ''
)

. "$PSScriptRoot/common.ps1"

$rg = Get-ResourceGroupName $Env
$deployment = Get-DeploymentName $Env
$paramFile = "$RepoRoot/infra/main.$Env.bicepparam"

if (-not $EvaluatorPrincipalId) {
    Write-Step "Resolving evaluator principal (signed-in identity)"
    $EvaluatorPrincipalId = az ad signed-in-user show --query id -o tsv 2>$null
    if (-not $EvaluatorPrincipalId) {
        Write-Warning "Could not resolve a signed-in user object ID. The evaluator role will not be assigned; pass -EvaluatorPrincipalId to grant it (required for a service principal in CI)."
        $EvaluatorPrincipalId = ''
    }
}

$principalType = 'ServicePrincipal'
if ($EvaluatorPrincipalId) {
    # A signed-in user resolves via az ad signed-in-user; treat that case as User.
    $me = az ad signed-in-user show --query id -o tsv 2>$null
    if ($me -eq $EvaluatorPrincipalId) { $principalType = 'User' }
}

Write-Step "Creating resource group $rg in $Location"
az group create --name $rg --location $Location --output none
Assert-LastExitCode "resource group create"

Write-Step "Deploying infrastructure ($deployment)"
$overrides = @("location=$Location")
if ($EvaluatorPrincipalId) {
    $overrides += "evaluatorPrincipalId=$EvaluatorPrincipalId"
    $overrides += "evaluatorPrincipalType=$principalType"
}

az deployment group create `
    --resource-group $rg `
    --name $deployment `
    --parameters $paramFile `
    --parameters $overrides `
    --output none
Assert-LastExitCode "infrastructure deployment"

Write-Step "Deployment outputs"
$outputs = Get-InfraOutputs $Env
$outputs.GetEnumerator() | Sort-Object Name | ForEach-Object {
    Write-Host ("  {0,-24} {1}" -f $_.Name, $_.Value)
}

Write-Host "`nInfrastructure deployed to '$Env'." -ForegroundColor Green
