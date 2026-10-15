output "user_pool" {
  value = {
    id                       = aws_cognito_user_pool.admin.id
    admin_create_user_config = aws_cognito_user_pool.admin.admin_create_user_config
    password_policy          = aws_cognito_user_pool.admin.password_policy
    deletion_protection      = aws_cognito_user_pool.admin.deletion_protection
  }
}

output "client" {
  value = {
    id              = aws_cognito_user_pool_client.admin.id
    generate_secret = aws_cognito_user_pool_client.admin.generate_secret
  }
}

output "identity_pool" {
  value = {
    id                               = aws_cognito_identity_pool.admin.id
    allow_unauthenticated_identities = aws_cognito_identity_pool.admin.allow_unauthenticated_identities
  }
}

output "upload_policy" {
  value = {
    policy = aws_iam_role_policy.admin_upload.policy
  }
}

output "cors" {
  value = {
    cors_rule = aws_s3_bucket_cors_configuration.website_upload.cors_rule
  }
}
