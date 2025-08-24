# Variables for Book Review Platform Infrastructure

# General Configuration
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "book-review-platform"
}

# Networking Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "ssh_allowed_ips" {
  description = "List of IP addresses allowed to SSH to instances"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Change this to your IP for security
}

# EC2 Configuration
variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"

  validation {
    condition = contains([
      "t3.micro", "t3.small", "t3.medium", "t3.large",
      "t2.micro", "t2.small", "t2.medium", "t2.large"
    ], var.instance_type)
    error_message = "Instance type must be a valid AWS instance type."
  }
}

variable "key_pair_name" {
  description = "Name of the AWS key pair for EC2 access"
  type        = string
  default     = ""
}

# Application Configuration
variable "mongodb_uri" {
  description = "MongoDB connection URI (MongoDB Atlas)"
  type        = string
  sensitive   = true
  default     = ""
}

variable "jwt_secret" {
  description = "JWT secret key for authentication"
  type        = string
  sensitive   = true
  default     = ""
}

variable "openai_api_key" {
  description = "OpenAI API key for recommendations"
  type        = string
  sensitive   = true
  default     = ""
}

# Load Balancer Configuration
variable "enable_load_balancer" {
  description = "Enable Application Load Balancer"
  type        = bool
  default     = false
}

variable "enable_elastic_ip" {
  description = "Enable Elastic IP for consistent public IP"
  type        = bool
  default     = true
}

# DNS Configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID"
  type        = string
  default     = ""
}

# Monitoring and Logging
variable "enable_cloudwatch_logs" {
  description = "Enable CloudWatch logs"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

# Backup Configuration
variable "enable_ebs_backup" {
  description = "Enable EBS volume backup"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Number of days to retain backups"
  type        = number
  default     = 7
}

# Auto Scaling Configuration (for future use)
variable "enable_auto_scaling" {
  description = "Enable auto scaling group"
  type        = bool
  default     = false
}

variable "min_instances" {
  description = "Minimum number of instances in auto scaling group"
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum number of instances in auto scaling group"
  type        = number
  default     = 3
}

variable "desired_instances" {
  description = "Desired number of instances in auto scaling group"
  type        = number
  default     = 1
}

# Security Configuration
variable "enable_waf" {
  description = "Enable AWS WAF for additional security"
  type        = bool
  default     = false
}

variable "enable_ssl" {
  description = "Enable SSL/TLS certificate"
  type        = bool
  default     = false
}

# Cost Optimization
variable "enable_spot_instances" {
  description = "Use spot instances for cost optimization"
  type        = bool
  default     = false
}

variable "spot_price" {
  description = "Maximum spot price"
  type        = string
  default     = "0.05"
}

# Development Configuration
variable "enable_dev_tools" {
  description = "Install development tools on instances"
  type        = bool
  default     = true
}

variable "enable_ssh_access" {
  description = "Enable SSH access to instances"
  type        = bool
  default     = true
}

# GitHub Actions Configuration
variable "github_repo" {
  description = "GitHub repository for CI/CD"
  type        = string
  default     = ""
}

variable "github_branch" {
  description = "GitHub branch for deployment"
  type        = string
  default     = "main"
}

# Application Specific Variables
variable "app_version" {
  description = "Application version to deploy"
  type        = string
  default     = "latest"
}

variable "node_version" {
  description = "Node.js version to install"
  type        = string
  default     = "18"
}

variable "pm2_instances" {
  description = "Number of PM2 instances to run"
  type        = number
  default     = 1
}

# Environment-specific overrides
variable "environment_config" {
  description = "Environment-specific configuration overrides"
  type = map(object({
    instance_type     = string
    min_instances     = number
    max_instances     = number
    enable_monitoring = bool
  }))
  default = {
    dev = {
      instance_type     = "t3.micro"
      min_instances     = 1
      max_instances     = 1
      enable_monitoring = false
    }
    staging = {
      instance_type     = "t3.small"
      min_instances     = 1
      max_instances     = 2
      enable_monitoring = true
    }
    prod = {
      instance_type     = "t3.medium"
      min_instances     = 2
      max_instances     = 5
      enable_monitoring = true
    }
  }
}
