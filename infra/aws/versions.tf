terraform {
  required_version = ">= 1.15, < 2.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region              = local.region
  allowed_account_ids = ["287872994400"]
}

provider "aws" {
  alias               = "logs"
  region              = "us-east-1"
  allowed_account_ids = ["287872994400"]
}
