output "website_url" {
  value = "https://${module.cdn.distribution.domain_name}"
}

output "deployment" {
  description = "Resource identifiers consumed by ops/aws/deploy-aws.ps1."
  value = {
    AccountId               = data.aws_caller_identity.current.account_id
    Region                  = local.region
    WebsiteBucket           = module.storage.buckets["website"].id
    LogsBucket              = module.storage.buckets["logs"].id
    DistributionId          = module.cdn.distribution.id
    DomainName              = module.cdn.distribution.domain_name
    OriginAccessControlId   = module.cdn.origin_access_control.id
    CachePolicyId           = module.cdn.cache_policy.id
    LogsDeliverySource      = module.logging.source.name
    LogsDeliveryDestination = module.logging.destination.name
    LogsDeliveryId          = module.logging.delivery.id
    AdminUserPoolId         = module.admin.user_pool.id
    AdminClientId           = module.admin.client.id
    AdminIdentityPoolId     = module.admin.identity_pool.id
  }
}
