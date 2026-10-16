$ErrorActionPreference = 'Stop'
$project = 'gcp-project-511702'
$zone = 'us-central1-a'
$vm = 'rental-hub-vm'
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Set-Location $root

$releaseId = [DateTime]::UtcNow.ToString('yyyyMMddHHmmssfff')
$archive = Join-Path $root ".local/rental-hub-$releaseId.tar.gz"
$remoteArchive = "${vm}:/tmp/rental-hub-$releaseId.tar.gz"

try {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
    $env:VITE_DISABLE_UPLOAD = 'true'
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'npm run build failed' }

    $web = Join-Path $root '.local/build/web'
    if (-not (Test-Path (Join-Path $web 'index.html'))) { throw 'Vite output is missing' }
    [System.IO.File]::WriteAllText((Join-Path $web 'release.json'), "{`"releaseId`":`"$releaseId`"}`n")
    tar -czf $archive -C $web .
    if ($LASTEXITCODE -ne 0) { throw 'Archive creation failed' }

    $ip = (gcloud compute instances describe $vm --project=$project --zone=$zone --format='value(networkInterfaces[0].accessConfigs[0].natIP)').Trim()
    if ($LASTEXITCODE -ne 0 -or -not $ip) { throw 'VM or external IP is unavailable' }
    gcloud compute ssh $vm --project=$project --zone=$zone --tunnel-through-iap --quiet --command='for i in $(seq 1 60); do systemctl is-active --quiet nginx && exit 0; sleep 2; done; exit 1'
    if ($LASTEXITCODE -ne 0) { throw 'Nginx startup did not finish' }

    gcloud compute scp $archive $remoteArchive --project=$project --zone=$zone --tunnel-through-iap --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Archive upload failed' }
    gcloud compute scp (Join-Path $PSScriptRoot 'release.sh') "${vm}:/tmp/rental-hub-release.sh" --project=$project --zone=$zone --tunnel-through-iap --quiet
    if ($LASTEXITCODE -ne 0) { throw 'Release script upload failed' }
    gcloud compute ssh $vm --project=$project --zone=$zone --tunnel-through-iap --quiet --command="sudo bash /tmp/rental-hub-release.sh activate $releaseId"
    if ($LASTEXITCODE -ne 0) { throw 'Remote activation failed' }

    try {
        node (Join-Path $PSScriptRoot 'smoke.mjs') "http://$ip" $releaseId
        if ($LASTEXITCODE -ne 0) { throw 'Public HTTP smoke test failed' }
    } catch {
        gcloud compute ssh $vm --project=$project --zone=$zone --tunnel-through-iap --quiet --command='sudo bash /tmp/rental-hub-release.sh rollback'
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Automatic rollback failed; inspect VM immediately.' }
        throw
    }
    Write-Host "Deployed http://$ip ($releaseId)"
} finally {
    if (Test-Path $archive) { Remove-Item -LiteralPath $archive }
}
