# Task 2 temporary EC2 demo

This Terraform state is separate from `infra/aws` (the existing S3/CloudFront deployment). It creates one Ubuntu 24.04 `t3.small` instance with an encrypted, 20 GiB gp3 root volume, one key pair, and one Security Group in Sydney. SSH is limited to the operator's IPv4 `/32`; only HTTP/HTTPS are public. Node listens on loopback. Terraform never receives the SSH private key or upload password.

The account was checked on 2026-10-14: AWS Free Plan ACTIVE, USD 140 credit remaining, expiration 2027-04-12. The selected AMI is marked Free Tier eligible. Usage consumes credit; AWS billing data may lag. No paid plan upgrade is part of this demo.

From PowerShell in this directory:

```powershell
$env:TF_VAR_admin_cidr = '<your-current-public-IPv4>/32'
$env:TF_VAR_public_key_path = "$env:USERPROFILE\.ssh\id_ed25519_rental_hub_ec2.pub"
terraform init
terraform plan '-out=task2.tfplan'
terraform apply task2.tfplan
terraform output
```

The private key is `C:\Users\NguyenPhuTrieu\.ssh\id_ed25519_rental_hub_ec2`. Application source was transferred as a Git bundle from commit `9b87730158542d524bcd470ca38a887a67cb04fd`; `scripts/deploy.sh` built and checked it on the EC2 host. Nginx and systemd use the shared `deploy/` templates. TLS uses a temporary `sslip.io` hostname and Let's Encrypt certificate. The upload password is only in the local `.ssh\rental-hub-task2-upload.txt` file and the server's htpasswd file; it is not in Git or Terraform state.

Current review URL: <https://3-26-186-22.sslip.io/>. Instance: `i-0ece2455235401517`. The public IP may change after stop/start, which would require a new hostname and certificate. Browser metadata is per origin; images live on the EC2 root volume. Destroying the instance deletes those images. Export anything needed before teardown.

**Wait for the user's review before teardown.** Keep this directory and its ignored `terraform.tfstate` until destruction succeeds. After confirmation, run `terraform plan -destroy` and check that only these Task 2 resources are selected, then `terraform destroy`. Never run destroy from `infra/aws` for this demo.
