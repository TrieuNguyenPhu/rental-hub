resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${var.prefix}-oac"
  description                       = "Private S3 origin for EstateFlow Task 3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_cache_policy" "website" {
  name        = "${var.prefix}-cache"
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
    domain_name              = var.website_bucket.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }
  dynamic "origin" {
    for_each = var.api_origin_domain == null ? [] : [var.api_origin_domain]
    content {
      origin_id   = "media-api"
      domain_name = origin.value
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
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
  dynamic "ordered_cache_behavior" {
    for_each = var.api_origin_domain == null ? [] : [var.api_origin_domain]
    content {
      path_pattern             = "/api/*"
      target_origin_id         = "media-api"
      viewer_protocol_policy   = "https-only"
      allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "PATCH", "POST", "DELETE"]
      cached_methods           = ["GET", "HEAD"]
      compress                 = false
      cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # AWS managed CachingDisabled.
      origin_request_policy_id = "b689b0a8-53d0-40ab-baf2-68738e2966ac" # AWS managed AllViewerExceptHostHeader.
    }
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
  bucket = var.website_bucket.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "CloudFrontReadOnly"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${var.website_bucket.arn}/*"
      Condition = { StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.website.arn } }
    }, var.deny_http]
  })
}
