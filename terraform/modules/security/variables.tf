# Variables for Security Module

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where security groups will be created"
  type        = string
}

variable "allowed_ports" {
  description = "List of allowed ports for the application"
  type        = list(number)
  default     = [22, 80, 443, 5000]
}

variable "ssh_cidr_blocks" {
  description = "CIDR blocks allowed for SSH access"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "enable_alb" {
  description = "Enable Application Load Balancer security group"
  type        = bool
  default     = false
}

variable "enable_database_sg" {
  description = "Enable database security group"
  type        = bool
  default     = false
}

variable "enable_encryption" {
  description = "Enable KMS encryption"
  type        = bool
  default     = false
}

variable "enable_waf" {
  description = "Enable AWS WAF"
  type        = bool
  default     = false
}

variable "additional_ingress_rules" {
  description = "Additional ingress rules for the application security group"
  type = list(object({
    from_port   = number
    to_port     = number
    protocol    = string
    cidr_blocks = list(string)
    description = string
  }))
  default = []
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
