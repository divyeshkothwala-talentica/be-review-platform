# Main Terraform configuration for Book Review Platform Backend
# AWS VM-based deployment with GitHub Actions CI/CD

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration for state management
  # Uncomment and configure for production use
  # backend "s3" {
  #   bucket = "book-review-terraform-state"
  #   key    = "infrastructure/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

# Configure the AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "book-review-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "devops-team"
    }
  }
}

# Data sources for existing AWS resources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Local values for common configurations
locals {
  common_tags = {
    Project     = "book-review-platform"
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  app_name = "book-review-api"

  # Application configuration
  app_config = {
    port      = 5000
    node_env  = var.environment
    log_level = var.environment == "prod" ? "info" : "debug"
  }
}

# Networking Module
module "networking" {
  source = "./modules/networking"

  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = data.aws_availability_zones.available.names

  tags = local.common_tags
}

# Security Module
module "security" {
  source = "./modules/security"

  environment = var.environment
  vpc_id      = module.networking.vpc_id

  # Allow HTTP/HTTPS traffic
  allowed_ports = [22, 80, 443, 5000]

  # Restrict SSH access (replace with your IP)
  ssh_cidr_blocks = var.ssh_allowed_ips

  tags = local.common_tags
}

# EC2 Module for Application Server
module "ec2" {
  source = "./modules/ec2"

  environment = var.environment
  app_name    = local.app_name

  # Instance configuration
  instance_type = var.instance_type
  ami_id        = data.aws_ami.amazon_linux.id
  key_name      = var.key_pair_name

  # Networking
  subnet_id              = module.networking.public_subnet_ids[0]
  vpc_security_group_ids = [module.security.app_security_group_id]

  # Application configuration
  app_port = local.app_config.port
  node_env = local.app_config.node_env

  # Environment variables for the application
  environment_variables = {
    NODE_ENV       = var.environment
    PORT           = local.app_config.port
    MONGODB_URI    = var.mongodb_uri
    JWT_SECRET     = var.jwt_secret
    OPENAI_API_KEY = var.openai_api_key
    LOG_LEVEL      = local.app_config.log_level
  }

  tags = local.common_tags
}

# Application Load Balancer (optional for production)
resource "aws_lb" "app_lb" {
  count = var.enable_load_balancer ? 1 : 0

  name               = "${local.app_name}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [module.security.alb_security_group_id]
  subnets            = module.networking.public_subnet_ids

  enable_deletion_protection = var.environment == "prod" ? true : false

  tags = merge(local.common_tags, {
    Name = "${local.app_name}-${var.environment}-alb"
  })
}

# Target Group for Load Balancer
resource "aws_lb_target_group" "app_tg" {
  count = var.enable_load_balancer ? 1 : 0

  name     = "${local.app_name}-${var.environment}-tg"
  port     = local.app_config.port
  protocol = "HTTP"
  vpc_id   = module.networking.vpc_id

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }

  tags = local.common_tags
}

# Load Balancer Listener
resource "aws_lb_listener" "app_listener" {
  count = var.enable_load_balancer ? 1 : 0

  load_balancer_arn = aws_lb.app_lb[0].arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app_tg[0].arn
  }
}

# Target Group Attachment
resource "aws_lb_target_group_attachment" "app_tg_attachment" {
  count = var.enable_load_balancer ? 1 : 0

  target_group_arn = aws_lb_target_group.app_tg[0].arn
  target_id        = module.ec2.instance_id
  port             = local.app_config.port
}

# Elastic IP for consistent public IP
resource "aws_eip" "app_eip" {
  count = var.enable_elastic_ip ? 1 : 0

  instance = module.ec2.instance_id
  domain   = "vpc"

  tags = merge(local.common_tags, {
    Name = "${local.app_name}-${var.environment}-eip"
  })
}

# Route53 DNS record (optional)
resource "aws_route53_record" "app_dns" {
  count = var.domain_name != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.environment == "prod" ? var.domain_name : "${var.environment}.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = var.enable_load_balancer ? [aws_lb.app_lb[0].dns_name] : [var.enable_elastic_ip ? aws_eip.app_eip[0].public_ip : module.ec2.public_ip]
}
