# Disposable in-memory S3/CloudFront transport; executes the real deploy script.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$global:RentalHubTestActive = 'B'
$global:RentalHubTestMissingAsset = $false
$global:RentalHubTestFailSmoke = $false
$global:RentalHubTestBuildFails = $false
$global:RentalHubTestCopies = 0
$global:RentalHubTestUploads = 0
$global:RentalHubTestUploadedIndex = ''
$global:RentalHubTestNetworkFailures = 0
function global:terraform {
    $global:LASTEXITCODE = 0
    '{"Region":"test-region","AccountId":"000000000000","WebsiteBucket":"fixture","DistributionId":"fixture","DomainName":"fixture.cloudfront.net"}'
}
function global:npm { $global:LASTEXITCODE = if ($global:RentalHubTestBuildFails) { 1 } else { 0 } }
function global:aws {
    $global:LASTEXITCODE = 0
    $a = @($args)
    function ValueAfter($key) { $a[[array]::IndexOf($a, $key) + 1] }
    switch ("$($a[0]) $($a[1])") {
        'sts get-caller-identity' { '000000000000' }
        's3api head-bucket' { }
        's3api get-bucket-versioning' { '{"Status":"Enabled"}' }
        'cloudfront get-distribution' { '{"Distribution":{"DomainName":"fixture.cloudfront.net","DistributionConfig":{"Origins":{"Items":[{"DomainName":"fixture.s3.test-region.amazonaws.com"}]}}}}' }
        's3api head-object' {
            if ((ValueAfter '--key') -eq 'index.html') { "{`"VersionId`":`"$global:RentalHubTestActive`"}" }
            elseif ($global:RentalHubTestMissingAsset) { $global:LASTEXITCODE = 1 }
            else { '{"ContentType":"application/javascript"}' }
        }
        's3api get-object' {
            $version = ValueAfter '--version-id'
            $outFile = $a[[array]::IndexOf($a, '--region') - 1]
            $body = if ((ValueAfter '--key') -eq 'index.html') { "<!doctype html><div id=`"root`"></div><script src=`"/assets/$version.js`"></script>" } else { 'old-file' }
            [IO.File]::WriteAllText($outFile, $body)
            '{}'
        }
        's3api copy-object' {
            $source = ValueAfter '--copy-source'
            $global:RentalHubTestActive = [uri]::UnescapeDataString(($source -split 'versionId=')[1])
            $global:RentalHubTestCopies++
            '{}'
        }
        'cloudfront create-invalidation' { 'fixture-invalidation' }
        'cloudfront wait' { }
        's3api list-objects-v2' { '["index.html","favicon.svg"]' }
        's3 cp' {
            $global:RentalHubTestUploads++
            if ($a[2] -eq 'dist/index.html') {
                $global:RentalHubTestUploadedIndex = [IO.File]::ReadAllText((Join-Path $fixture 'dist/index.html'))
                $global:RentalHubTestActive = 'C'
            }
        }
        default { throw "Unexpected external call: $($a[0..1] -join ' ')" }
    }
}
function global:Invoke-WebRequest {
    param($Uri, [switch]$UseBasicParsing, $MaximumRedirection, $TimeoutSec)
    if ($global:RentalHubTestNetworkFailures -gt 0) {
        $global:RentalHubTestNetworkFailures--
        throw 'Simulated transient DNS failure'
    }
    if ($global:RentalHubTestFailSmoke -and $global:RentalHubTestActive -eq 'A') { throw 'Simulated failed activation' }
    if ($Uri -match '/assets/') {
        return @{ StatusCode = 200; Content = 'console.log(1)'; Headers = @{ 'Content-Type' = 'application/javascript' } }
    }
    $body = if ($global:RentalHubTestActive -eq 'C') { $global:RentalHubTestUploadedIndex } else { "<!doctype html><div id=`"root`"></div><script src=`"/assets/$global:RentalHubTestActive.js`"></script>" }
    @{ StatusCode = 200; Content = $body; Headers = @{ 'Content-Type' = 'text/html' } }
}
function Assert-Equal($actual, $expected, $name) { if ($actual -ne $expected) { throw "$name expected $expected, got $actual" } }
$fixture = Join-Path ([IO.Path]::GetTempPath()) ('rental-hub-aws-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $fixture 'scripts'), (Join-Path $fixture 'dist/assets') | Out-Null
$deploy = Join-Path $fixture 'scripts/deploy-aws.ps1'
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'deploy-aws.ps1') -Destination $deploy
[IO.File]::WriteAllText((Join-Path $fixture 'dist/index.html'), '<!doctype html><head></head><div id="root"></div><script src="/assets/A.js"></script>')
[IO.File]::WriteAllText((Join-Path $fixture 'dist/favicon.svg'), 'changed-file')
try {
    & $deploy -RollbackVersionId A -Confirm:$false
    Assert-Equal $global:RentalHubTestActive A 'Rollback restores the requested index'
    $global:RentalHubTestActive = 'B'; $global:RentalHubTestMissingAsset = $true; $copiesBefore = $global:RentalHubTestCopies
    try { & $deploy -RollbackVersionId A -Confirm:$false; throw 'Unexpected success' }
    catch { if ($_.Exception.Message -eq 'Unexpected success') { throw } }
    Assert-Equal $global:RentalHubTestActive B 'Missing asset preserves current'
    Assert-Equal $global:RentalHubTestCopies $copiesBefore 'No switch before validation'
    $global:RentalHubTestMissingAsset = $false; $global:RentalHubTestFailSmoke = $true
    try { & $deploy -RollbackVersionId A -Confirm:$false; throw 'Unexpected success' }
    catch { if ($_.Exception.Message -eq 'Unexpected success') { throw } }
    Assert-Equal $global:RentalHubTestActive B 'Failed rollback recovers the original index'
    $global:RentalHubTestFailSmoke = $false; $global:RentalHubTestBuildFails = $true; $copiesBefore = $global:RentalHubTestCopies
    try { & $deploy -Confirm:$false; throw 'Unexpected success' }
    catch { if ($_.Exception.Message -eq 'Unexpected success') { throw } }
    Assert-Equal $global:RentalHubTestCopies $copiesBefore 'Build failure uploads nothing'
    $global:RentalHubTestBuildFails = $false
    try { & $deploy -Confirm:$false; throw 'Unexpected success' }
    catch { if ($_.Exception.Message -notlike '*Public file changed*') { throw } }
    Assert-Equal $global:RentalHubTestUploads 0 'Changed non-hashed files cannot break rollback'
    [IO.File]::WriteAllText((Join-Path $fixture 'dist/favicon.svg'), 'old-file')
    $sha = '1234567890abcdef1234567890abcdef12345678'
    $global:RentalHubTestNetworkFailures = 1
    & $deploy -ReleaseSha $sha -Confirm:$false
    Assert-Equal $global:RentalHubTestNetworkFailures 0 'Transient DNS failure retried'
    if ($global:RentalHubTestUploadedIndex -notlike "*<meta name=`"release-sha`" content=`"$sha`">*") { throw 'Release marker missing from uploaded index' }
    Assert-Equal $global:RentalHubTestActive C 'Release index activated'
    Write-Host 'PASS: AWS rollback, missing asset, recovery and failed build (mock transport; no AWS requests)'
} finally {
    $resolvedFixture = [IO.Path]::GetFullPath($fixture)
    $fixturePrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar + 'rental-hub-aws-test-'
    if ($resolvedFixture.StartsWith($fixturePrefix, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $resolvedFixture -Recurse -Force }
    Remove-Item Function:\terraform, Function:\npm, Function:\aws, Function:\Invoke-WebRequest
}
