mock_provider "aws" {
  mock_data "aws_caller_identity" {
    defaults = { account_id = "287872994400" }
  }
  mock_resource "aws_s3_bucket" {
    defaults = { arn = "arn:aws:s3:::mock-bucket" }
  }
  mock_resource "aws_cloudfront_distribution" {
    defaults = { arn = "arn:aws:cloudfront::287872994400:distribution/MOCKCF" }
  }
}

mock_provider "aws" {
  alias = "logs"
  mock_resource "aws_cloudwatch_log_delivery_destination" {
    defaults = { arn = "arn:aws:logs:us-east-1:287872994400:delivery-destination:mock-s3" }
  }
}

run "private_spa_with_separate_logs" {
  command = apply

  assert {
    condition = (
      jsondecode(aws_s3_bucket_policy.website.policy).Statement[0].Principal.Service == "cloudfront.amazonaws.com" &&
      jsondecode(aws_s3_bucket_policy.website.policy).Statement[0].Action == "s3:GetObject" &&
      jsondecode(aws_s3_bucket_policy.website.policy).Statement[0].Condition.StringEquals["AWS:SourceArn"] == aws_cloudfront_distribution.website.arn &&
      jsondecode(aws_s3_bucket_policy.logs.policy).Statement[1].Condition.StringEquals["aws:SourceAccount"] == "287872994400" &&
      jsondecode(aws_s3_bucket_policy.logs.policy).Statement[1].Condition.ArnLike["aws:SourceArn"] == local.log_source_arn
    )
    error_message = "Bucket access must be restricted to the intended distribution and logging source."
  }
  assert {
    condition = alltrue([for bucket in aws_s3_bucket_public_access_block.buckets :
      bucket.block_public_acls && bucket.ignore_public_acls && bucket.block_public_policy && bucket.restrict_public_buckets
    ])
    error_message = "Both buckets must block all public access."
  }
  assert {
    condition = alltrue([for ownership in aws_s3_bucket_ownership_controls.buckets :
      ownership.rule[0].object_ownership == "BucketOwnerEnforced"
    ])
    error_message = "ACLs must stay disabled on both buckets."
  }
  assert {
    condition = (aws_cloudfront_origin_access_control.website.signing_behavior == "always" &&
      aws_cloudfront_origin_access_control.website.signing_protocol == "sigv4" &&
      aws_cloudfront_distribution.website.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https" &&
    aws_cloudfront_distribution.website.viewer_certificate[0].cloudfront_default_certificate)
    error_message = "CloudFront must sign private S3 requests and serve viewers over HTTPS."
  }
  assert {
    condition = alltrue([for response in aws_cloudfront_distribution.website.custom_error_response :
      contains([403, 404], response.error_code) && response.response_page_path == "/index.html" && response.response_code == 200 && response.error_caching_min_ttl == 0
    ]) && length(aws_cloudfront_distribution.website.custom_error_response) == 2
    error_message = "403/404 must serve the SPA entry point without caching the error."
  }
  assert {
    condition = (aws_cloudfront_cache_policy.website.min_ttl == 0 &&
    aws_s3_bucket_versioning.website.versioning_configuration[0].status == "Enabled")
    error_message = "Index revalidation and S3 version recovery must remain available."
  }
  assert {
    condition = (aws_s3_bucket_lifecycle_configuration.logs.bucket == aws_s3_bucket.buckets["logs"].id &&
      aws_s3_bucket.buckets["logs"].bucket != aws_s3_bucket.buckets["website"].bucket &&
      aws_s3_bucket_lifecycle_configuration.logs.transition_default_minimum_object_size == "all_storage_classes_128K" &&
      anytrue([for rule in aws_s3_bucket_lifecycle_configuration.logs.rule :
        rule.id == "ExpireAllLogsAfter90Days" && rule.expiration[0].days == 90 && rule.filter[0].prefix == ""
        if length(rule.expiration) > 0
        ]) && anytrue([for rule in aws_s3_bucket_lifecycle_configuration.logs.rule :
        one(rule.transition).days == 30 && one(rule.transition).storage_class == "STANDARD_IA"
        if length(rule.transition) > 0
    ]))
    error_message = "Only the separate logs bucket may expire all files at 90 days and transition large files at 30 days."
  }
  assert {
    condition = (aws_cloudwatch_log_delivery_source.website.region == "us-east-1" &&
      aws_cloudwatch_log_delivery_source.website.log_type == "ACCESS_LOGS" &&
      aws_cloudwatch_log_delivery_destination.s3.output_format == "json" &&
    aws_cloudwatch_log_delivery_destination.s3.delivery_destination_configuration[0].destination_resource_arn == aws_s3_bucket.buckets["logs"].arn)
    error_message = "Standard logging v2 must target the logs bucket using the required API region."
  }
}
