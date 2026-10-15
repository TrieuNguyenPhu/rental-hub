output "api_origin_domain" {
  value = trimprefix(aws_apigatewayv2_api.media.api_endpoint, "https://")
}

output "function_name" {
  value = aws_lambda_function.media.function_name
}
