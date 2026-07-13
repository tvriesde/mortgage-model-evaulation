<#
.SYNOPSIS
    Builds the Node.js Functions backend and deploys it to the Flex Consumption function app.
.PARAMETER Env
    Target environment: dev or prd.
#>
[CmdletBinding()]
param(
    [ValidateSet('dev', 'prd')]
    [string]$Env = 'dev'
)

. "$PSScriptRoot/common.ps1"

$rg = Get-ResourceGroupName $Env
$outputs = Get-InfraOutputs $Env
$functionApp = $outputs['functionAppName']
if (-not $functionApp) { throw "functionAppName not found in deployment outputs. Deploy infra first." }

$backend = "$RepoRoot/backend"
$zipPath = Join-Path $backend 'app-package.zip'

Write-Step "Building backend"
Push-Location $backend
try {
    npm ci
    Assert-LastExitCode "backend npm ci"
    npm run build
    Assert-LastExitCode "backend build"

    Write-Step "Pruning dev dependencies"
    npm prune --omit=dev
    Assert-LastExitCode "npm prune"

    Write-Step "Packaging"
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
    Compress-Archive -Path 'dist', 'host.json', 'package.json', 'node_modules' -DestinationPath $zipPath -Force
}
finally {
    Pop-Location
}

Write-Step "Deploying to function app $functionApp (Flex Consumption)"
az functionapp deployment source config-zip `
    --resource-group $rg `
    --name $functionApp `
    --src $zipPath `
    --output none
Assert-LastExitCode "function app zip deploy"

# Restore all dependencies for local development after the prod prune.
Push-Location $backend
try { npm ci | Out-Null } finally { Pop-Location }

Write-Host "`nBackend deployed to $functionApp." -ForegroundColor Green
Write-Host "URL: $($outputs['functionAppUrl'])"
