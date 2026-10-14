data "aws_caller_identity" "current" {}

locals {
  region = "ap-southeast-2"
  prefix = "npt-room-finder-prod"
  buckets = {
    website = "${local.prefix}-website-${data.aws_caller_identity.current.account_id}"
    logs    = "${local.prefix}-logs-${data.aws_caller_identity.current.account_id}"
  }
  deny_http = { for role, name in local.buckets : role => {
    Sid       = "DenyInsecureTransport"
    Effect    = "Deny"
    Principal = "*"
    Action    = "s3:*"
    Resource  = ["arn:aws:s3:::${name}", "arn:aws:s3:::${name}/*"]
    Condition = { Bool = { "aws:SecureTransport" = "false" } }
  } }
  log_source_arn = "arn:aws:logs:us-east-1:${data.aws_caller_identity.current.account_id}:delivery-source:${local.prefix}"
}
