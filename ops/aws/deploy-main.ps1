[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Push-Location (Join-Path $PSScriptRoot '../..')
try {
    if ((& git branch --show-current) -ne 'main') { throw 'Deploy only from the local main branch.' }
    if (& git status --porcelain) { throw 'Working tree must be clean.' }
    & git fetch --quiet origin main
    if ($LASTEXITCODE -ne 0) { throw 'Could not fetch origin/main.' }
    $sha = (& git rev-parse HEAD).Trim()
    if ($sha -notmatch '^[a-f0-9]{40}$' -or $sha -ne (& git rev-parse origin/main).Trim()) { throw 'Local main must equal origin/main.' }
    $ci = & gh run list -R TrieuNguyenPhu/rental-hub --workflow ci.yml --branch main --commit $sha --event push --limit 1 --json status,conclusion,headSha
    if ($LASTEXITCODE -ne 0) { throw 'Could not read GitHub CI status.' }
    $run = @(($ci | ConvertFrom-Json))
    if ($run.Count -ne 1 -or $run[0].status -ne 'completed' -or $run[0].conclusion -ne 'success' -or $run[0].headSha -ne $sha) {
        throw "GitHub CI must pass for $sha before production deployment."
    }
    $account = (& aws sts get-caller-identity --query Account --output text).Trim()
    if ($LASTEXITCODE -ne 0 -or $account -ne '287872994400') { throw 'Wrong AWS account.' }
    if (-not $PSCmdlet.ShouldProcess('CloudFront Task 3', "Deploy main $sha")) { return }
    & npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Could not install locked dependencies; production was not changed.' }
    & "$PSScriptRoot/deploy-aws.ps1" -ReleaseSha $sha
    if ($LASTEXITCODE -ne 0) { throw 'AWS deployment failed.' }
} finally {
    Pop-Location
}
