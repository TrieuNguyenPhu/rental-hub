[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$SshKeyPath = (Join-Path ([Environment]::GetFolderPath('UserProfile')) '.ssh\id_ed25519_rental_hub_ec2')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    if ((& git branch --show-current) -ne 'main') { throw 'Deploy only from the local main branch.' }
    if (& git status --porcelain) { throw 'Working tree must be clean.' }
    & git fetch --quiet origin main
    if ($LASTEXITCODE -ne 0) { throw 'Could not fetch origin/main.' }
    $sha = (& git rev-parse HEAD).Trim()
    if ($sha -notmatch '^[a-f0-9]{40}$' -or $sha -ne (& git rev-parse origin/main).Trim()) { throw 'Local main must equal origin/main.' }
    if (-not (Test-Path -LiteralPath $SshKeyPath -PathType Leaf)) { throw 'EC2 SSH key is missing.' }

    $ci = & gh run list -R TrieuNguyenPhu/rental-hub --workflow ci.yml --branch main --commit $sha --event push --limit 1 --json status,conclusion,headSha
    if ($LASTEXITCODE -ne 0) { throw 'Could not read GitHub CI status.' }
    $run = @(($ci | ConvertFrom-Json))
    if ($run.Count -ne 1 -or $run[0].status -ne 'completed' -or $run[0].conclusion -ne 'success' -or $run[0].headSha -ne $sha) {
        throw "GitHub CI must pass for $sha before production deployment."
    }

    $account = (& aws sts get-caller-identity --query Account --output text).Trim()
    if ($LASTEXITCODE -ne 0 -or $account -ne '287872994400') { throw 'Wrong AWS account.' }
    $instance = (& aws ec2 describe-instances --region ap-southeast-2 --instance-ids i-0ece2455235401517 --query 'Reservations[0].Instances[0]' --output json | Out-String | ConvertFrom-Json)
    if ($LASTEXITCODE -ne 0 -or $instance.State.Name -ne 'running' -or -not $instance.PublicIpAddress) { throw 'Task 2 EC2 is unavailable.' }
    $tags = @{}
    foreach ($tag in $instance.Tags) { $tags[$tag.Key] = $tag.Value }
    if ($tags.Project -ne 'rental-hub' -or $tags.Purpose -ne 'task-2-demo') { throw 'EC2 tags do not identify the Task 2 instance.' }
    $target = "ubuntu@$($instance.PublicIpAddress)"
    $sshOptions = @('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-i', $SshKeyPath, $target)
    $previous = (& ssh @sshOptions 'readlink -f /srv/rental-hub/current').Trim() -replace '^.*/', ''
    if ($LASTEXITCODE -ne 0 -or $previous -notmatch '^[a-f0-9]{40}$') { throw 'Could not verify the current EC2 release.' }

    if (-not $PSCmdlet.ShouldProcess("EC2 $target and CloudFront production", "Deploy main $sha")) { return }
    & npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Could not install locked dependencies; production was not changed.' }
    & ssh @sshOptions "git -C /home/ubuntu/rental-hub-source remote set-url origin https://github.com/TrieuNguyenPhu/rental-hub.git && git -C /home/ubuntu/rental-hub-source fetch --quiet origin main && git -C /home/ubuntu/rental-hub-source checkout --quiet --detach $sha && grep -Fxq REPO_URL=/home/ubuntu/rental-hub-source /home/ubuntu/rental-hub-deploy.env && bash /home/ubuntu/rental-hub-source/scripts/deploy.sh $sha /home/ubuntu/rental-hub-deploy.env"
    if ($LASTEXITCODE -ne 0) { throw 'EC2 deployment failed; inspect its release logs.' }

    try {
        & "$PSScriptRoot/deploy-aws.ps1" -ReleaseSha $sha
        Write-Host "Both production environments verified at main $sha"
    } catch {
        $failure = $_
        & ssh @sshOptions "bash /home/ubuntu/rental-hub-source/scripts/rollback.sh $previous /home/ubuntu/rental-hub-deploy.env"
        if ($LASTEXITCODE -ne 0) { throw "AWS deployment failed and EC2 rollback failed. Previous EC2 SHA: $previous. $failure" }
        throw "AWS deployment failed; EC2 restored to $previous. $failure"
    }
} finally {
    Pop-Location
}
