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

    # System deps are already present on ubuntu-latest runners, and the browser binary
    # is cached across CI runs, so only download it on a cache miss (drop --with-deps).
    if (-not $env:CI -or $env:PLAYWRIGHT_CACHE_HIT -ne 'true') {
        npx playwright install chromium
        Assert-LastExitCode "playwright browser install"
    }

    npx playwright test
    Assert-LastExitCode "playwright tests"
}
finally {
    Pop-Location
}

Write-Host "`nPlaywright functional tests passed." -ForegroundColor Green
