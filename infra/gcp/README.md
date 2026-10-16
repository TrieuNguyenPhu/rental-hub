# Rental Hub on Google Compute Engine

Project `gcp-project-511702`, `us-central1-a`, Ubuntu 24.04, `e2-micro`, 20 GB `pd-standard`. Terraform creates a dedicated VPC, subnet, HTTP firewall, IAP-only SSH firewall, and a VM service account with no project roles. OS Login is enabled on the VM; the current project Owner already has OS Login, IAP tunnel, and service-account act-as permissions. The external IPv4 is ephemeral and may change if the VM is stopped. The existing AWS infrastructure is separate.

## First deployment

From the repository root in PowerShell, sign in to both gcloud and Terraform if needed:

```powershell
gcloud auth login
gcloud auth application-default login
```

Run `terraform -chdir=infra/gcp init -backend=false`, `terraform -chdir=infra/gcp fmt -check`, `terraform -chdir=infra/gcp validate`, and `terraform -chdir=infra/gcp plan`. Review the plan and cost **before** creating resources.

After approval, create the private versioned state bucket and activate the backend:

```powershell
gcloud storage buckets create gs://rental-hub-tfstate-973198905935 --project=gcp-project-511702 --location=us-central1 --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://rental-hub-tfstate-973198905935 --versioning
Copy-Item infra/gcp/backend.tf.example infra/gcp/backend.tf
terraform -chdir=infra/gcp init -reconfigure
terraform -chdir=infra/gcp plan
terraform -chdir=infra/gcp apply
powershell -ExecutionPolicy Bypass -File ops/gcp/deploy.ps1
```

The GCS bucket is private, versioned, and holds Terraform state. Keep `backend.tf`, `terraform.tfvars`, local plans, and state files out of Git. Limit bucket IAM to trusted Terraform operators. If `rental-hub-vm` already exists, inspect it and import it before applying; never accept a plan that replaces or destroys an existing VM.

The organization policy denies external IPv4 to VMs by default. Terraform creates a project-level exception for only `rental-hub-vm` under `constraints/compute.vmExternalIpAccess`; destroying the Terraform deployment removes this exception. The project Owner already has the OS Login and IAP permissions needed for SSH; no extra Gmail IAM binding is required.

## Redeploy and teardown

Run one command from the repository root to build locally, upload through IAP, switch releases, smoke test the public site, and roll back if smoke fails:

```powershell
powershell -ExecutionPolicy Bypass -File ops/gcp/deploy.ps1
```

After explicit approval to delete this deployment, run `terraform -chdir=infra/gcp destroy`. This removes the VM and its boot disk, VPC, firewall, project policy exception, and service account. The state bucket remains so its history is preserved; delete it separately only after backing up the state and confirming no infrastructure remains.

The HTTP site has browser-local CRUD data, no shared persistence, no login, and no image uploads. Nginx blocks `/api/images`; the build hides the upload input. Do not enter real customer data or credentials over public HTTP. Add a domain and HTTPS before enabling uploads or authentication.
