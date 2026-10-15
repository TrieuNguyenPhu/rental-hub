output "source" {
  value = {
    name     = aws_cloudwatch_log_delivery_source.website.name
    region   = aws_cloudwatch_log_delivery_source.website.region
    log_type = aws_cloudwatch_log_delivery_source.website.log_type
  }
}

output "destination" {
  value = {
    name                               = aws_cloudwatch_log_delivery_destination.s3.name
    arn                                = aws_cloudwatch_log_delivery_destination.s3.arn
    output_format                      = aws_cloudwatch_log_delivery_destination.s3.output_format
    delivery_destination_configuration = aws_cloudwatch_log_delivery_destination.s3.delivery_destination_configuration
  }
}

output "delivery" {
  value = {
    id = aws_cloudwatch_log_delivery.website.id
  }
}

output "bucket_policy" {
  value = {
    policy = aws_s3_bucket_policy.logs.policy
  }
}
