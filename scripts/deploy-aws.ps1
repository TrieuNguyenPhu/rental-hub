[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
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

    foreach ($gate in @('lint', 'test', 'build')) {
        & npm run $gate
        if ($LASTEXITCODE -ne 0) { throw "Quality gate failed: $gate. Nothing uploaded." }
    }
    if (-not $PSCmdlet.ShouldProcess($deployment.DomainName, 'Upload production build and invalidate CloudFront')) { return }

    $destination = "s3://$($deployment.WebsiteBucket)"
    # Keep old hashed assets so open tabs and an index rollback can still load them.
    Invoke-Aws @('s3', 'cp', 'dist/assets/', "$destination/assets/", '--recursive', '--cache-control', 'public,max-age=31536000,immutable') | Out-Host
    Invoke-Aws @('s3', 'cp', 'dist/', "$destination/", '--recursive', '--exclude', 'index.html', '--exclude', 'assets/*', '--cache-control', 'public,max-age=86400') | Out-Host
    Invoke-Aws @('s3', 'cp', 'dist/index.html', "$destination/index.html", '--content-type', 'text/html; charset=utf-8', '--cache-control', 'no-cache,max-age=0,must-revalidate') | Out-Host
    $invalidation = Invoke-Aws @('cloudfront', 'create-invalidation', '--distribution-id', $deployment.DistributionId, '--paths', '/*', '--query', 'Invalidation.Id', '--output', 'text')
    Invoke-Aws @('cloudfront', 'wait', 'distribution-deployed', '--id', $deployment.DistributionId) | Out-Null
    Invoke-Aws @('cloudfront', 'wait', 'invalidation-completed', '--distribution-id', $deployment.DistributionId, '--id', $invalidation) | Out-Null

    $index = [IO.File]::ReadAllText((Join-Path (Get-Location) 'dist/index.html'))
    $websiteUrl = "https://$($deployment.DomainName)"
    foreach ($route in @('/', '/buildings', '/rooms', '/bookings')) {
        $response = Invoke-WebRequest "$websiteUrl$route" -UseBasicParsing
        if ($response.StatusCode -ne 200 -or $response.Content -ne $index) { throw "Smoke check failed: $route" }
    }
    $asset = [regex]::Match($index, 'src="(/assets/[^" ]+\.js)"').Groups[1].Value
    if (-not $asset) { throw 'Build has no JavaScript entry point' }
    $response = Invoke-WebRequest "$websiteUrl$asset" -UseBasicParsing
    if ($response.Headers['Content-Type'] -notmatch '(javascript|ecmascript)') { throw 'JavaScript asset has incorrect MIME type' }
    Write-Host "Deployment verified: $websiteUrl"
} finally {
    Pop-Location
}
