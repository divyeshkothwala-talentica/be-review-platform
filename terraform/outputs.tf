# Outputs for Book Review Platform Infrastructure

# Networking Outputs
output "vpc_id" {
  description = "ID of the VPC"
  value       = module.networking.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.networking.vpc_cidr_block
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.networking.private_subnet_ids
}

output "internet_gateway_id" {
  description = "ID of the Internet Gateway"
  value       = module.networking.internet_gateway_id
}

# Security Outputs
output "app_security_group_id" {
  description = "ID of the application security group"
  value       = module.security.app_security_group_id
}

output "alb_security_group_id" {
  description = "ID of the ALB security group"
  value       = module.security.alb_security_group_id
}

# EC2 Outputs
output "instance_id" {
  description = "ID of the EC2 instance"
  value       = module.ec2.instance_id
}

output "instance_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = module.ec2.public_ip
}

output "instance_private_ip" {
  description = "Private IP address of the EC2 instance"
  value       = module.ec2.private_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = module.ec2.public_dns
}

# Elastic IP Output
output "elastic_ip" {
  description = "Elastic IP address (if enabled)"
  value       = var.enable_elastic_ip ? aws_eip.app_eip[0].public_ip : null
}

# Load Balancer Outputs
output "load_balancer_dns" {
  description = "DNS name of the load balancer"
  value       = var.enable_load_balancer ? aws_lb.app_lb[0].dns_name : null
}

output "load_balancer_zone_id" {
  description = "Zone ID of the load balancer"
  value       = var.enable_load_balancer ? aws_lb.app_lb[0].zone_id : null
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = var.enable_load_balancer ? aws_lb_target_group.app_tg[0].arn : null
}

# Application URLs
output "application_url" {
  description = "URL to access the application"
  value = var.enable_load_balancer ? (
    var.enable_ssl ? "https://${aws_lb.app_lb[0].dns_name}" : "http://${aws_lb.app_lb[0].dns_name}"
    ) : (
    var.enable_elastic_ip ? "http://${aws_eip.app_eip[0].public_ip}:5000" : "http://${module.ec2.public_ip}:5000"
  )
}

output "health_check_url" {
  description = "URL for health check endpoint"
  value = var.enable_load_balancer ? (
    var.enable_ssl ? "https://${aws_lb.app_lb[0].dns_name}/health" : "http://${aws_lb.app_lb[0].dns_name}/health"
    ) : (
    var.enable_elastic_ip ? "http://${aws_eip.app_eip[0].public_ip}:5000/health" : "http://${module.ec2.public_ip}:5000/health"
  )
}

# SSH Connection Information
output "ssh_connection_command" {
  description = "SSH command to connect to the instance"
  value = var.key_pair_name != "" ? (
    var.enable_elastic_ip ?
    "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@${aws_eip.app_eip[0].public_ip}" :
    "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@${module.ec2.public_ip}"
  ) : "Key pair not configured"
}

# Environment Information
output "environment" {
  description = "Current environment"
  value       = var.environment
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}

# Resource Tags
output "common_tags" {
  description = "Common tags applied to resources"
  value       = local.common_tags
}

# Application Configuration
output "app_port" {
  description = "Application port"
  value       = local.app_config.port
}

output "node_environment" {
  description = "Node.js environment"
  value       = local.app_config.node_env
}

# DNS Information
output "dns_record" {
  description = "DNS record for the application (if configured)"
  value = var.domain_name != "" ? (
    var.environment == "prod" ? var.domain_name : "${var.environment}.${var.domain_name}"
  ) : null
}

# Deployment Information
output "deployment_info" {
  description = "Deployment information for CI/CD"
  value = {
    instance_id   = module.ec2.instance_id
    public_ip     = var.enable_elastic_ip ? aws_eip.app_eip[0].public_ip : module.ec2.public_ip
    ssh_user      = "ec2-user"
    app_directory = "/opt/book-review-api"
    service_name  = "book-review-api"
    environment   = var.environment
    region        = var.aws_region
  }
}

# Security Information
output "security_groups" {
  description = "Security group information"
  value = {
    app_security_group = module.security.app_security_group_id
    alb_security_group = var.enable_load_balancer ? module.security.alb_security_group_id : null
  }
}

# Monitoring Information
output "monitoring_info" {
  description = "Monitoring and logging information"
  value = {
    cloudwatch_log_group = var.enable_cloudwatch_logs ? "/aws/ec2/book-review-api" : null
    instance_id          = module.ec2.instance_id
    environment          = var.environment
  }
}

# Cost Information
output "estimated_monthly_cost" {
  description = "Estimated monthly cost (approximate)"
  value = {
    instance_cost = var.instance_type == "t3.micro" ? "$8.50" : (
      var.instance_type == "t3.small" ? "$17.00" : (
        var.instance_type == "t3.medium" ? "$34.00" : "Variable"
      )
    )
    elastic_ip_cost    = var.enable_elastic_ip ? "$3.65" : "$0.00"
    load_balancer_cost = var.enable_load_balancer ? "$16.20" : "$0.00"
    total_estimate     = "See individual components"
  }
}
