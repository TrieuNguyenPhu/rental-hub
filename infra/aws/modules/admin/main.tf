resource "aws_cognito_user_pool" "admin" {
  name                = "${var.prefix}-admin"
  user_pool_tier      = "LITE"
  deletion_protection = "ACTIVE"
  admin_create_user_config {
    allow_admin_create_user_only = true
  }
  password_policy {
    minimum_length    = 16
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = true
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cognito_user_pool_client" "admin" {
  name                          = "${var.prefix}-browser"
  user_pool_id                  = aws_cognito_user_pool.admin.id
  generate_secret               = false
  prevent_user_existence_errors = "ENABLED"
  explicit_auth_flows           = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
}

resource "aws_cognito_identity_pool" "admin" {
  identity_pool_name               = "${var.prefix}-admin"
  allow_unauthenticated_identities = false
  allow_classic_flow               = false
  cognito_identity_providers {
    client_id               = aws_cognito_user_pool_client.admin.id
    provider_name           = aws_cognito_user_pool.admin.endpoint
    server_side_token_check = true
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_iam_role" "admin_upload" {
  name = "${var.prefix}-admin-upload"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect    = "Allow"
    Principal = { Federated = "cognito-identity.amazonaws.com" }
    Action    = "sts:AssumeRoleWithWebIdentity"
    Condition = {
      StringEquals             = { "cognito-identity.amazonaws.com:aud" = aws_cognito_identity_pool.admin.id }
      "ForAnyValue:StringLike" = { "cognito-identity.amazonaws.com:amr" = "authenticated" }
    }
  }] })
}

resource "aws_iam_role_policy" "admin_upload" {
  name = "images-only"
  role = aws_iam_role.admin_upload.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect   = "Allow"
    Action   = "s3:PutObject"
    Resource = "${var.website_bucket.arn}/images/*"
  }] })
}

resource "aws_cognito_identity_pool_roles_attachment" "admin" {
  identity_pool_id = aws_cognito_identity_pool.admin.id
  roles = {
    authenticated = aws_iam_role.admin_upload.arn
  }
}

resource "aws_s3_bucket_cors_configuration" "website_upload" {
  bucket = var.website_bucket.id
  cors_rule {
    allowed_methods = ["PUT"]
    allowed_origins = ["https://${var.website_domain_name}"]
    allowed_headers = ["*"]
    max_age_seconds = 300
  }
}
