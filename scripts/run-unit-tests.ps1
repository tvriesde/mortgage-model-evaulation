<#
.SYNOPSIS
    Runs unit tests for the backend and frontend.
#>
[CmdletBinding()]
param()

. "$PSScriptRoot/common.ps1"

Write-Step "Backend unit tests"
Push-Location "$RepoRoot/backend"
try {
    npm ci
    Assert-LastExitCode "backend npm ci"
    npm run build
    Assert-LastExitCode "backend build"
    npm test
    Assert-LastExitCode "backend tests"
}
finally {
    Pop-Location
}

Write-Step "Frontend unit tests"
Push-Location "$RepoRoot/frontend"
try {
    npm ci
    Assert-LastExitCode "frontend npm ci"
    npm test
    Assert-LastExitCode "frontend tests"
}
finally {
    Pop-Location
}

Write-Host "`nAll unit tests passed." -ForegroundColor Green
