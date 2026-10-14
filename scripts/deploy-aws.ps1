[CmdletBinding(SupportsShouldProcess)]
param([string]$RollbackVersionId)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Push-Location (Split-Path $PSScriptRoot -Parent)
$lock = $null
$temporary = $null
try {
    # One operator machine at a time; do not run this from two separate checkouts/hosts.
    $lock = [IO.File]::Open((Join-Path (Get-Location) '.aws-deploy.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    $terraformOutput = & terraform '-chdir=infra/aws' output -json deployment
    if ($LASTEXITCODE -ne 0) { throw 'Terraform outputs unavailable. Run terraform init, plan and apply first.' }
    $deployment = ($terraformOutput -join "`n") | ConvertFrom-Json
    function Invoke-Aws([string[]]$AwsArguments) {
        $output = & aws @AwsArguments --region $deployment.Region --no-cli-pager
        if ($LASTEXITCODE -ne 0) { throw "AWS command failed: $($AwsArguments[0..1] -join ' ')" }
        return $output
    }

    $account = Invoke-Aws @('sts', 'get-caller-identity', '--query', 'Account', '--output', 'text')
    if ($account -ne $deployment.AccountId) { throw 'AWS account does not match Terraform outputs' }
    Invoke-Aws @('s3api', 'head-bucket', '--bucket', $deployment.WebsiteBucket, '--expected-bucket-owner', $deployment.AccountId) | Out-Null
    $distributionJson = Invoke-Aws @('cloudfront', 'get-distribution', '--id', $deployment.DistributionId, '--output', 'json')
    $distribution = ($distributionJson -join "`n") | ConvertFrom-Json
    if ($distribution.Distribution.DomainName -ne $deployment.DomainName -or
        $distribution.Distribution.DistributionConfig.Origins.Items[0].DomainName -ne "$($deployment.WebsiteBucket).s3.$($deployment.Region).amazonaws.com") {
        throw 'CloudFront origin/domain does not match Terraform outputs'
    }

    function Invalidate-Website {
        $id = Invoke-Aws @('cloudfront', 'create-invalidation', '--distribution-id', $deployment.DistributionId, '--paths', '/*', '--query', 'Invalidation.Id', '--output', 'text')
        Invoke-Aws @('cloudfront', 'wait', 'distribution-deployed', '--id', $deployment.DistributionId) | Out-Null
        Invoke-Aws @('cloudfront', 'wait', 'invalidation-completed', '--distribution-id', $deployment.DistributionId, '--id', $id) | Out-Null
    }
    $websiteUrl = "https://$($deployment.DomainName)"
    function Verify-Website([string]$Index) {
        foreach ($route in @('/', '/buildings', '/rooms', '/bookings')) {
            $response = Invoke-WebRequest "$websiteUrl$route" -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30
            if ($response.StatusCode -ne 200 -or $response.Content -ne $Index) { throw "Smoke check failed: $route" }
        }
        $asset = [regex]::Match($Index, 'src="(/assets/[^" ]+\.js)"').Groups[1].Value
        if (-not $asset) { throw 'Build has no JavaScript entry point' }
        $response = Invoke-WebRequest "$websiteUrl$asset" -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 30
        if ($response.Headers['Content-Type'] -notmatch '(javascript|ecmascript)') { throw 'JavaScript asset has incorrect MIME type' }
    }
    function Restore-Index([string]$Version) {
        $source = "$($deployment.WebsiteBucket)/index.html?versionId=$([uri]::EscapeDataString($Version))"
        Invoke-Aws @('s3api', 'copy-object', '--bucket', $deployment.WebsiteBucket, '--key', 'index.html', '--copy-source', $source,
            '--expected-bucket-owner', $deployment.AccountId, '--expected-source-bucket-owner', $deployment.AccountId, '--metadata-directive', 'COPY') | Out-Null
        Invalidate-Website
    }

    $versioning = (Invoke-Aws @('s3api', 'get-bucket-versioning', '--bucket', $deployment.WebsiteBucket, '--expected-bucket-owner', $deployment.AccountId, '--output', 'json')) | ConvertFrom-Json
    if ($versioning.Status -ne 'Enabled') { throw 'Bucket versioning must be enabled for safe recovery' }
    $previous = (Invoke-Aws @('s3api', 'head-object', '--bucket', $deployment.WebsiteBucket, '--key', 'index.html', '--expected-bucket-owner', $deployment.AccountId, '--output', 'json')) | ConvertFrom-Json
    if (-not $previous.VersionId -or $previous.VersionId -eq 'null') { throw 'Current index needs an S3 version before deployment' }
    $temporary = Join-Path ([IO.Path]::GetTempPath()) ('rental-hub-aws-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $temporary | Out-Null
    $savedIndex = Join-Path $temporary 'previous.html'
    Invoke-Aws @('s3api', 'get-object', '--bucket', $deployment.WebsiteBucket, '--key', 'index.html', '--version-id', $previous.VersionId, '--expected-bucket-owner', $deployment.AccountId, $savedIndex) | Out-Null
    $previousIndex = [IO.File]::ReadAllText($savedIndex)
    if ($RollbackVersionId) {
        $targetFile = Join-Path $temporary 'target.html'
        Invoke-Aws @('s3api', 'get-object', '--bucket', $deployment.WebsiteBucket, '--key', 'index.html', '--version-id', $RollbackVersionId, '--expected-bucket-owner', $deployment.AccountId, $targetFile) | Out-Null
        $index = [IO.File]::ReadAllText($targetFile)
        $assets = [regex]::Matches($index, '(?:src|href)="(/assets/[^"?#]+)"')
        if (-not [regex]::IsMatch($index, 'src="/assets/[^" ]+\.js"')) { throw 'Rollback index has no JavaScript entry point' }
        foreach ($asset in $assets) {
            $key = $asset.Groups[1].Value.TrimStart('/')
            if ($key.Contains('..')) { throw 'Invalid rollback asset path' }
            Invoke-Aws @('s3api', 'head-object', '--bucket', $deployment.WebsiteBucket, '--key', $key, '--expected-bucket-owner', $deployment.AccountId) | Out-Null
        }
    } else {
        foreach ($gate in @('lint', 'test', 'build')) {
            & npm run $gate
            if ($LASTEXITCODE -ne 0) { throw "Quality gate failed: $gate. Nothing uploaded." }
        }
        $index = [IO.File]::ReadAllText((Join-Path (Get-Location) 'dist/index.html'))
        $publishedKeys = (Invoke-Aws @('s3api', 'list-objects-v2', '--bucket', $deployment.WebsiteBucket, '--expected-bucket-owner', $deployment.AccountId, '--query', 'Contents[].Key', '--output', 'json')) | ConvertFrom-Json
        $distRoot = (Resolve-Path 'dist').Path
        foreach ($file in Get-ChildItem -LiteralPath $distRoot -Recurse -File) {
            $key = $file.FullName.Substring($distRoot.Length + 1).Replace('\', '/')
            if ($key -eq 'index.html' -or $key.StartsWith('assets/') -or $publishedKeys -notcontains $key) { continue }
            $savedPublicFile = Join-Path $temporary 'public-file'
            Invoke-Aws @('s3api', 'get-object', '--bucket', $deployment.WebsiteBucket, '--key', $key, '--expected-bucket-owner', $deployment.AccountId, $savedPublicFile) | Out-Null
            if ((Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $savedPublicFile).Hash) {
                throw "Public file changed: $key. Use a new filename so previous indexes remain valid. Nothing uploaded."
            }
        }
    }
    if (-not $PSCmdlet.ShouldProcess($deployment.DomainName, 'Activate index, invalidate CloudFront and verify (recover on failure)')) { return }
    Write-Host "Recovery index VersionId: $($previous.VersionId)"
    $switched = $false
    try {
        if ($RollbackVersionId) {
            $switched = $true
            Restore-Index $RollbackVersionId
        } else {
            $destination = "s3://$($deployment.WebsiteBucket)"
            # Keep all old hashed assets for open tabs and index rollback.
            Invoke-Aws @('s3', 'cp', 'dist/assets/', "$destination/assets/", '--recursive', '--cache-control', 'public,max-age=31536000,immutable') | Out-Host
            # Existing public files were checked byte-for-byte; changed files need a new name.
            Invoke-Aws @('s3', 'cp', 'dist/', "$destination/", '--recursive', '--exclude', 'index.html', '--exclude', 'assets/*', '--cache-control', 'public,max-age=86400') | Out-Host
            $switched = $true
            Invoke-Aws @('s3', 'cp', 'dist/index.html', "$destination/index.html", '--content-type', 'text/html; charset=utf-8', '--cache-control', 'no-cache,max-age=0,must-revalidate') | Out-Host
            Invalidate-Website
        }
        Verify-Website $index
        Write-Host "Deployment verified: $websiteUrl"
    } catch {
        $failure = $_
        if ($switched) {
            try { Restore-Index $previous.VersionId; Verify-Website $previousIndex; Write-Warning 'Previous index restored and verified' }
            catch { throw "RECOVERY FAILED. Restore S3 index VersionId $($previous.VersionId). $($_.Exception.Message)" }
        }
        throw $failure
    }
} finally {
    if ($temporary) {
        $resolvedTemporary = [IO.Path]::GetFullPath($temporary)
        $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar + 'rental-hub-aws-'
        if ($resolvedTemporary.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase)) { Remove-Item -LiteralPath $resolvedTemporary -Recurse -Force }
    }
    if ($lock) { $lock.Dispose() }
    Pop-Location
}
