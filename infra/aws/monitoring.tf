resource "aws_s3_bucket_metric" "website" {
  bucket = module.storage.buckets["website"].id
  name   = "EntireBucket"
}

resource "aws_sns_topic_policy" "alerts" {
  arn = local.alert_topic_arn
  policy = jsonencode({
    Id      = "__default_policy_ID"
    Version = "2008-10-17"
    Statement = [{
      Sid       = "__default_statement_ID"
      Effect    = "Allow"
      Principal = { AWS = "*" }
      Action    = ["SNS:GetTopicAttributes", "SNS:SetTopicAttributes", "SNS:AddPermission", "SNS:RemovePermission", "SNS:DeleteTopic", "SNS:Subscribe", "SNS:ListSubscriptionsByTopic", "SNS:Publish"]
      Resource  = local.alert_topic_arn
      Condition = { StringEquals = { "AWS:SourceOwner" = data.aws_caller_identity.current.account_id } }
      }, {
      Sid       = "CloudWatchWebsiteS3Alarm"
      Effect    = "Allow"
      Principal = { Service = "cloudwatch.amazonaws.com" }
      Action    = "sns:Publish"
      Resource  = local.alert_topic_arn
      Condition = {
        ArnEquals    = { "aws:SourceArn" = "arn:aws:cloudwatch:${local.region}:${data.aws_caller_identity.current.account_id}:alarm:${local.s3_alarm_name}" }
        StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }
      }
    }]
  })
}

resource "aws_cloudwatch_metric_alarm" "website_s3_5xx" {
  alarm_name          = local.s3_alarm_name
  alarm_description   = "S3 website bucket returned an origin HTTP 5xx error."
  namespace           = "AWS/S3"
  metric_name         = "5xxErrors"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  dimensions = {
    BucketName = module.storage.buckets["website"].id
    FilterId   = aws_s3_bucket_metric.website.name
  }
  alarm_actions = [local.alert_topic_arn]
  depends_on    = [aws_sns_topic_policy.alerts]
}
