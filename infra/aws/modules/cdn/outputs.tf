output "distribution" {
  value = {
    id                     = aws_cloudfront_distribution.website.id
    arn                    = aws_cloudfront_distribution.website.arn
    domain_name            = aws_cloudfront_distribution.website.domain_name
    default_cache_behavior = aws_cloudfront_distribution.website.default_cache_behavior
    viewer_certificate     = aws_cloudfront_distribution.website.viewer_certificate
    custom_error_response  = aws_cloudfront_distribution.website.custom_error_response
  }
}

output "origin_access_control" {
  value = {
    id               = aws_cloudfront_origin_access_control.website.id
    signing_behavior = aws_cloudfront_origin_access_control.website.signing_behavior
    signing_protocol = aws_cloudfront_origin_access_control.website.signing_protocol
  }
}

output "cache_policy" {
  value = {
    id      = aws_cloudfront_cache_policy.website.id
    min_ttl = aws_cloudfront_cache_policy.website.min_ttl
  }
}

output "bucket_policy" {
  value = {
    policy = aws_s3_bucket_policy.website.policy
  }
}
