<#
.SYNOPSIS
    Runs the Playwright functional tests (agent mocked, no cloud needed).
#>
[CmdletBinding()]
param()

. "$PSScriptRoot/common.ps1"

Write-Step "Playwright functional tests"
Push-Location "$RepoRoot/frontend"
try {
    npm ci
    Assert-LastExitCode "frontend npm ci"

    $installArgs = if ($env:CI) { @('install', '--with-deps', 'chromium') } else { @('install', 'chromium') }
    npx playwright @installArgs
    Assert-LastExitCode "playwright browser install"

    npx playwright test
    Assert-LastExitCode "playwright tests"
}
finally {
    Pop-Location
}

Write-Host "`nPlaywright functional tests passed." -ForegroundColor Green
