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
      module.admin.user_pool.admin_create_user_config[0].allow_admin_create_user_only &&
      module.admin.user_pool.password_policy[0].minimum_length == 16 &&
      module.admin.user_pool.deletion_protection == "ACTIVE" &&
      !module.admin.client.generate_secret &&
      !module.admin.identity_pool.allow_unauthenticated_identities &&
      jsondecode(module.admin.upload_policy.policy).Statement[0].Action == "s3:PutObject" &&
      jsondecode(module.admin.upload_policy.policy).Statement[0].Resource == "${module.storage.buckets["website"].arn}/images/*" &&
      one(module.admin.cors.cors_rule).allowed_origins == toset(["https://${module.cdn.distribution.domain_name}"])
    )
    error_message = "Admin access must require authentication and restrict uploads to images from the site origin."
  }

  assert {
    condition = (
      jsondecode(module.cdn.bucket_policy.policy).Statement[0].Principal.Service == "cloudfront.amazonaws.com" &&
      jsondecode(module.cdn.bucket_policy.policy).Statement[0].Action == "s3:GetObject" &&
      jsondecode(module.cdn.bucket_policy.policy).Statement[0].Condition.StringEquals["AWS:SourceArn"] == module.cdn.distribution.arn &&
      jsondecode(module.logging.bucket_policy.policy).Statement[1].Condition.StringEquals["aws:SourceAccount"] == "287872994400" &&
      jsondecode(module.logging.bucket_policy.policy).Statement[1].Condition.ArnLike["aws:SourceArn"] == local.log_source_arn
    )
    error_message = "Bucket access must be restricted to the intended distribution and logging source."
  }
  assert {
    condition = alltrue([for bucket in module.storage.public_access :
      bucket.block_public_acls && bucket.ignore_public_acls && bucket.block_public_policy && bucket.restrict_public_buckets
    ])
    error_message = "Both buckets must block all public access."
  }
  assert {
    condition = alltrue([for ownership in module.storage.ownership :
      ownership.rule[0].object_ownership == "BucketOwnerEnforced"
    ])
    error_message = "ACLs must stay disabled on both buckets."
  }
  assert {
    condition = (module.cdn.origin_access_control.signing_behavior == "always" &&
      module.cdn.origin_access_control.signing_protocol == "sigv4" &&
      module.cdn.distribution.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https" &&
    module.cdn.distribution.viewer_certificate[0].cloudfront_default_certificate)
    error_message = "CloudFront must sign private S3 requests and serve viewers over HTTPS."
  }
  assert {
    condition = alltrue([for response in module.cdn.distribution.custom_error_response :
      contains([403, 404], response.error_code) && response.response_page_path == "/index.html" && response.response_code == 200 && response.error_caching_min_ttl == 0
    ]) && length(module.cdn.distribution.custom_error_response) == 2
    error_message = "403/404 must serve the SPA entry point without caching the error."
  }
  assert {
    condition = (module.cdn.cache_policy.min_ttl == 0 &&
    module.storage.versioning.versioning_configuration[0].status == "Enabled")
    error_message = "Index revalidation and S3 version recovery must remain available."
  }
  assert {
    condition = (module.storage.logs_lifecycle.bucket == module.storage.buckets["logs"].id &&
      module.storage.buckets["logs"].bucket != module.storage.buckets["website"].bucket &&
      module.storage.logs_lifecycle.transition_default_minimum_object_size == "all_storage_classes_128K" &&
      anytrue([for rule in module.storage.logs_lifecycle.rule :
        rule.id == "ExpireAllLogsAfter90Days" && rule.expiration[0].days == 90 && rule.filter[0].prefix == ""
        if length(rule.expiration) > 0
        ]) && anytrue([for rule in module.storage.logs_lifecycle.rule :
        one(rule.transition).days == 30 && one(rule.transition).storage_class == "STANDARD_IA"
        if length(rule.transition) > 0
    ]))
    error_message = "Only the separate logs bucket may expire all files at 90 days and transition large files at 30 days."
  }
  assert {
    condition = (module.logging.source.region == "us-east-1" &&
      module.logging.source.log_type == "ACCESS_LOGS" &&
      module.logging.destination.output_format == "json" &&
    module.logging.destination.delivery_destination_configuration[0].destination_resource_arn == module.storage.buckets["logs"].arn)
    error_message = "Standard logging v2 must target the logs bucket using the required API region."
  }
}
