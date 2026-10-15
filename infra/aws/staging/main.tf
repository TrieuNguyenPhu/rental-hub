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
  region              = "ap-southeast-2"
  allowed_account_ids = ["287872994400"]
}

data "aws_caller_identity" "current" {}

locals {
  bucket      = "npt-room-finder-staging-website-${data.aws_caller_identity.current.account_id}"
  data_bucket = "npt-room-finder-staging-data-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "data" {
  bucket        = local.data_bucket
  force_destroy = false
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket_public_access_block" "data" {
  bucket                  = aws_s3_bucket.data.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "data" {
  bucket = aws_s3_bucket.data.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "data" {
  bucket = aws_s3_bucket.data.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket" "website" {
  bucket        = local.bucket
  force_destroy = false
  lifecycle { prevent_destroy = true }
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket                  = aws_s3_bucket.website.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "website" {
  bucket = aws_s3_bucket.website.id
  rule { object_ownership = "BucketOwnerEnforced" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "website" {
  bucket = aws_s3_bucket.website.id
  rule {
    apply_server_side_encryption_by_default { sse_algorithm = "AES256" }
  }
}

resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id
  versioning_configuration { status = "Enabled" }
}

module "media" {
  source         = "../shared/media"
  prefix         = "npt-room-finder-staging"
  website_bucket = aws_s3_bucket.website
  data_bucket    = aws_s3_bucket.data
}

module "cdn" {
  source            = "../modules/cdn"
  prefix            = "npt-room-finder-staging"
  website_bucket    = aws_s3_bucket.website
  api_origin_domain = module.media.api_origin_domain
  deny_http = {
    Sid       = "DenyInsecureTransport"
    Effect    = "Deny"
    Principal = "*"
    Action    = "s3:*"
    Resource  = ["arn:aws:s3:::${local.bucket}", "arn:aws:s3:::${local.bucket}/*"]
    Condition = { Bool = { "aws:SecureTransport" = "false" } }
  }
}

output "deployment" {
  value = {
    AccountId         = data.aws_caller_identity.current.account_id
    Region            = "ap-southeast-2"
    WebsiteBucket     = aws_s3_bucket.website.id
    DistributionId    = module.cdn.distribution.id
    DomainName        = module.cdn.distribution.domain_name
    MediaFunctionName = module.media.function_name
  }
}
