module "storage" {
  source  = "./modules/storage"
  buckets = local.buckets
}

module "cdn" {
  source         = "./modules/cdn"
  prefix         = local.prefix
  website_bucket = module.storage.buckets["website"]
  deny_http      = local.deny_http.website
}

module "logging" {
  source           = "./modules/logging"
  providers        = { aws = aws.logs }
  prefix           = local.prefix
  account_id       = data.aws_caller_identity.current.account_id
  log_source_arn   = local.log_source_arn
  distribution_arn = module.cdn.distribution.arn
  logs_bucket      = module.storage.buckets["logs"]
  deny_http        = local.deny_http.logs
}

module "admin" {
  source              = "./modules/admin"
  prefix              = local.prefix
  website_bucket      = module.storage.buckets["website"]
  website_domain_name = module.cdn.distribution.domain_name
}
