# Keep these mappings until every existing state has migrated.
moved {
  from = aws_s3_bucket.buckets
  to   = module.storage.aws_s3_bucket.buckets
}

moved {
  from = aws_s3_bucket_public_access_block.buckets
  to   = module.storage.aws_s3_bucket_public_access_block.buckets
}

moved {
  from = aws_s3_bucket_ownership_controls.buckets
  to   = module.storage.aws_s3_bucket_ownership_controls.buckets
}

moved {
  from = aws_s3_bucket_server_side_encryption_configuration.buckets
  to   = module.storage.aws_s3_bucket_server_side_encryption_configuration.buckets
}

moved {
  from = aws_s3_bucket_versioning.website
  to   = module.storage.aws_s3_bucket_versioning.website
}

moved {
  from = aws_s3_bucket_lifecycle_configuration.logs
  to   = module.storage.aws_s3_bucket_lifecycle_configuration.logs
}

moved {
  from = aws_cloudfront_origin_access_control.website
  to   = module.cdn.aws_cloudfront_origin_access_control.website
}

moved {
  from = aws_cloudfront_cache_policy.website
  to   = module.cdn.aws_cloudfront_cache_policy.website
}

moved {
  from = aws_cloudfront_distribution.website
  to   = module.cdn.aws_cloudfront_distribution.website
}

moved {
  from = aws_s3_bucket_policy.website
  to   = module.cdn.aws_s3_bucket_policy.website
}

moved {
  from = aws_s3_bucket_policy.logs
  to   = module.logging.aws_s3_bucket_policy.logs
}

moved {
  from = aws_cloudwatch_log_delivery_source.website
  to   = module.logging.aws_cloudwatch_log_delivery_source.website
}

moved {
  from = aws_cloudwatch_log_delivery_destination.s3
  to   = module.logging.aws_cloudwatch_log_delivery_destination.s3
}

moved {
  from = aws_cloudwatch_log_delivery.website
  to   = module.logging.aws_cloudwatch_log_delivery.website
}

moved {
  from = aws_cognito_user_pool.admin
  to   = module.admin.aws_cognito_user_pool.admin
}

moved {
  from = aws_cognito_user_pool_client.admin
  to   = module.admin.aws_cognito_user_pool_client.admin
}

moved {
  from = aws_cognito_identity_pool.admin
  to   = module.admin.aws_cognito_identity_pool.admin
}

moved {
  from = aws_iam_role.admin_upload
  to   = module.admin.aws_iam_role.admin_upload
}

moved {
  from = aws_iam_role_policy.admin_upload
  to   = module.admin.aws_iam_role_policy.admin_upload
}

moved {
  from = aws_cognito_identity_pool_roles_attachment.admin
  to   = module.admin.aws_cognito_identity_pool_roles_attachment.admin
}

moved {
  from = aws_s3_bucket_cors_configuration.website_upload
  to   = module.admin.aws_s3_bucket_cors_configuration.website_upload
}
