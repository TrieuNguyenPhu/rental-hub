data "archive_file" "bootstrap" {
  type        = "zip"
  source_file = "${path.module}/index.mjs"
  output_path = "${path.root}/.terraform/media-bootstrap.zip"
}

resource "aws_iam_role" "media" {
  name = "${var.prefix}-media"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Action    = "sts:AssumeRole"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.media.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "images" {
  name = "${var.prefix}-images"
  role = aws_iam_role.media.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:PutObject", "s3:DeleteObject"]
      Resource = "${var.website_bucket.arn}/images/*"
      }, {
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject"]
      Resource = "${var.data_bucket.arn}/estate.json"
      }, {
      Effect   = "Allow"
      Action   = "s3:ListBucket"
      Resource = var.data_bucket.arn
    }]
  })
}

resource "aws_cloudwatch_log_group" "media" {
  name              = "/aws/lambda/${var.prefix}-media"
  retention_in_days = 14
}

resource "aws_lambda_function" "media" {
  function_name                  = "${var.prefix}-media"
  role                           = aws_iam_role.media.arn
  runtime                        = "nodejs24.x"
  architectures                  = ["x86_64"]
  handler                        = "index.handler"
  filename                       = data.archive_file.bootstrap.output_path
  source_code_hash               = data.archive_file.bootstrap.output_base64sha256
  memory_size                    = 1024
  timeout                        = 30
  reserved_concurrent_executions = 2
  environment {
    variables = { IMAGE_BUCKET = var.website_bucket.id, DATA_BUCKET = var.data_bucket.id }
  }
  depends_on = [aws_iam_role_policy_attachment.logs, aws_iam_role_policy.images, aws_cloudwatch_log_group.media]
  lifecycle { ignore_changes = [filename, source_code_hash] }
}

resource "aws_apigatewayv2_api" "media" {
  name          = "${var.prefix}-media"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_integration" "media" {
  api_id                 = aws_apigatewayv2_api.media.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.media.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "media" {
  api_id    = aws_apigatewayv2_api.media.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.media.id}"
}

resource "aws_apigatewayv2_stage" "media" {
  api_id      = aws_apigatewayv2_api.media.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_rate_limit  = 2
    throttling_burst_limit = 10
  }
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowMediaApi"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.media.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.media.execution_arn}/*/*"
}
