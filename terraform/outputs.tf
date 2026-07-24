output "lambda_function_url" {
  description = "URL pública de la Lambda (Function URL)"
  value       = aws_lambda_function_url.tasks_api_url.function_url
}

output "dynamodb_table_name" {
  description = "Nombre de la tabla DynamoDB"
  value       = aws_dynamodb_table.tasks.name
}
