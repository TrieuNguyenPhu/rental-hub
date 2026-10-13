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

resource "aws_s3_bucket" "buckets" {
  for_each      = local.buckets
  bucket        = each.value
  force_destroy = false
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_public_access_block" "buckets" {
  for_each                = aws_s3_bucket.buckets
  bucket                  = each.value.id
  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "buckets" {
  for_each = aws_s3_bucket.buckets
  bucket   = each.value.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "buckets" {
  for_each = aws_s3_bucket.buckets
  bucket   = each.value.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.buckets["website"].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket                                 = aws_s3_bucket.buckets["logs"].id
  transition_default_minimum_object_size = "all_storage_classes_128K"
  rule {
    id     = "TransitionLargeLogsAfter30Days"
    status = "Enabled"
    filter { prefix = "" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
  rule {
    id     = "ExpireAllLogsAfter90Days"
    status = "Enabled"
    filter { prefix = "" }
    expiration { days = 90 }
    abort_incomplete_multipart_upload { days_after_initiation = 7 }
  }
}

resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${local.prefix}-oac"
  description                       = "Private S3 origin for EstateFlow Task 3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_cache_policy" "website" {
  name        = "${local.prefix}-cache"
  comment     = "Respect S3 Cache-Control; no query strings or cookies"
  min_ttl     = 0
  default_ttl = 60
  max_ttl     = 31536000
  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
    headers_config { header_behavior = "none" }
    cookies_config { cookie_behavior = "none" }
    query_strings_config { query_string_behavior = "none" }
  }
}

resource "aws_cloudfront_distribution" "website" {
  comment             = "EstateFlow room-finder Task 3"
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_All"
  http_version        = "http2and3"
  is_ipv6_enabled     = true

  origin {
    origin_id                = "private-s3"
    domain_name              = aws_s3_bucket.buckets["website"].bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }
  default_cache_behavior {
    target_origin_id           = "private-s3"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.website.id
    response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03" # AWS managed SecurityHeadersPolicy.
  }
  dynamic "custom_error_response" {
    for_each = toset([403, 404])
    content {
      error_code            = custom_error_response.value
      response_page_path    = "/index.html"
      response_code         = 200
      error_caching_min_ttl = 0
    }
  }
  viewer_certificate {
    cloudfront_default_certificate = true
  }
  restrictions {
    geo_restriction { restriction_type = "none" }
  }
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.buckets["website"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudFrontReadOnly"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.buckets["website"].arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.website.arn } }
    }, local.deny_http.website]
  })
}

resource "aws_s3_bucket_policy" "logs" {
  bucket = aws_s3_bucket.buckets["logs"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AWSLogDeliveryAclCheck"
      Effect    = "Allow"
      Principal = { Service = "delivery.logs.amazonaws.com" }
      Action    = ["s3:GetBucketAcl", "s3:ListBucket"]
      Resource  = aws_s3_bucket.buckets["logs"].arn
      Condition = {
        StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
        ArnLike      = { "aws:SourceArn" = local.log_source_arn }
      }
      }, {
      Sid       = "AWSLogDeliveryWrite"
      Effect    = "Allow"
      Principal = { Service = "delivery.logs.amazonaws.com" }
      Action    = "s3:PutObject"
      Resource  = "${aws_s3_bucket.buckets["logs"].arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          "s3:x-amz-acl"      = "bucket-owner-full-control"
        }
        ArnLike = { "aws:SourceArn" = local.log_source_arn }
      }
    }, local.deny_http.logs]
  })
}

# CloudFront logging v2 uses this API region even though both buckets are in Sydney.
resource "aws_cloudwatch_log_delivery_source" "website" {
  provider     = aws.logs
  region       = "us-east-1"
  name         = local.prefix
  log_type     = "ACCESS_LOGS"
  resource_arn = aws_cloudfront_distribution.website.arn
}

resource "aws_cloudwatch_log_delivery_destination" "s3" {
  provider      = aws.logs
  region        = "us-east-1"
  name          = "${local.prefix}-s3"
  output_format = "json"
  delivery_destination_configuration {
    destination_resource_arn = aws_s3_bucket.buckets["logs"].arn
  }
}

resource "aws_cloudwatch_log_delivery" "website" {
  provider                 = aws.logs
  region                   = "us-east-1"
  delivery_source_name     = aws_cloudwatch_log_delivery_source.website.name
  delivery_destination_arn = aws_cloudwatch_log_delivery_destination.s3.arn
  depends_on               = [aws_s3_bucket_policy.logs]
}
