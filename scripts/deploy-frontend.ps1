<#
.SYNOPSIS
    Builds the React frontend (pointing at the deployed backend) and deploys it to the Static Web App.
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
$swaName = $outputs['staticWebAppName']
$functionUrl = $outputs['functionAppUrl']
if (-not $swaName) { throw "staticWebAppName not found in deployment outputs. Deploy infra first." }

$apiBaseUrl = "$functionUrl/api"
$frontend = "$RepoRoot/frontend"

Write-Step "Building frontend (API base: $apiBaseUrl)"
Push-Location $frontend
try {
    $env:VITE_API_BASE_URL = $apiBaseUrl
    npm ci
    Assert-LastExitCode "frontend npm ci"
    npm run build
    Assert-LastExitCode "frontend build"
}
finally {
    Remove-Item Env:VITE_API_BASE_URL -ErrorAction SilentlyContinue
    Pop-Location
}

Write-Step "Retrieving Static Web App deployment token"
$token = az staticwebapp secrets list --name $swaName --resource-group $rg --query properties.apiKey -o tsv
Assert-LastExitCode "reading SWA token"

Write-Step "Deploying to Static Web App $swaName"
npx --yes @azure/static-web-apps-cli deploy "$frontend/dist" --deployment-token $token --env production
Assert-LastExitCode "SWA deploy"

Write-Host "`nFrontend deployed." -ForegroundColor Green
Write-Host "URL: https://$($outputs['staticWebAppHostName'])"
