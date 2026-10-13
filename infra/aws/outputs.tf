output "website_url" {
  value = "https://${aws_cloudfront_distribution.website.domain_name}"
}

output "deployment" {
  description = "Resource identifiers consumed by scripts/deploy-aws.ps1."
  value = {
    AccountId               = data.aws_caller_identity.current.account_id
    Region                  = local.region
    WebsiteBucket           = aws_s3_bucket.buckets["website"].id
    LogsBucket              = aws_s3_bucket.buckets["logs"].id
    DistributionId          = aws_cloudfront_distribution.website.id
    DomainName              = aws_cloudfront_distribution.website.domain_name
    OriginAccessControlId   = aws_cloudfront_origin_access_control.website.id
    CachePolicyId           = aws_cloudfront_cache_policy.website.id
    LogsDeliverySource      = aws_cloudwatch_log_delivery_source.website.name
    LogsDeliveryDestination = aws_cloudwatch_log_delivery_destination.s3.name
    LogsDeliveryId          = aws_cloudwatch_log_delivery.website.id
  }
}
