variable "aws_region" {
  description = "Región de AWS donde se despliega la infraestructura"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "Profile de AWS CLI a usar"
  type        = string
  default     = "prf-aws-2026"
}

variable "project_name" {
  description = "Nombre base para los recursos del proyecto"
  type        = string
  default     = "todo-app"
}

variable "allowed_origin" {
  description = "Origen permitido para CORS en la Function URL (dominio de Vercel o * en desarrollo)"
  type        = string
  default     = "*"
}
