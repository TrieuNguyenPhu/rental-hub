resource "aws_s3_bucket_policy" "logs" {
  bucket = var.logs_bucket.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AWSLogDeliveryAclCheck"
      Effect    = "Allow"
      Principal = { Service = "delivery.logs.amazonaws.com" }
      Action    = ["s3:GetBucketAcl", "s3:ListBucket"]
      Resource  = var.logs_bucket.arn
      Condition = {
        StringEquals = { "aws:SourceAccount" = var.account_id }
        ArnLike      = { "aws:SourceArn" = var.log_source_arn }
      }
      }, {
      Sid       = "AWSLogDeliveryWrite"
      Effect    = "Allow"
      Principal = { Service = "delivery.logs.amazonaws.com" }
      Action    = "s3:PutObject"
      Resource  = "${var.logs_bucket.arn}/AWSLogs/${var.account_id}/*"
      Condition = {
        StringEquals = {
          "aws:SourceAccount" = var.account_id
          "s3:x-amz-acl"      = "bucket-owner-full-control"
        }
        ArnLike = { "aws:SourceArn" = var.log_source_arn }
      }
    }, var.deny_http]
  })
}

resource "aws_cloudwatch_log_delivery_source" "website" {
  region       = "us-east-1"
  name         = var.prefix
  log_type     = "ACCESS_LOGS"
  resource_arn = var.distribution_arn
}

resource "aws_cloudwatch_log_delivery_destination" "s3" {
  region        = "us-east-1"
  name          = "${var.prefix}-s3"
  output_format = "json"
  delivery_destination_configuration {
    destination_resource_arn = var.logs_bucket.arn
  }
}

resource "aws_cloudwatch_log_delivery" "website" {
  region                   = "us-east-1"
  delivery_source_name     = aws_cloudwatch_log_delivery_source.website.name
  delivery_destination_arn = aws_cloudwatch_log_delivery_destination.s3.arn
  depends_on               = [aws_s3_bucket_policy.logs]
}
