# Outputs for EC2 Module

output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.app.id
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = aws_instance.app.public_ip
}

output "private_ip" {
  description = "Private IP address of the instance"
  value       = aws_instance.app.private_ip
}

output "public_dns" {
  description = "Public DNS name of the instance"
  value       = aws_instance.app.public_dns
}

output "private_dns" {
  description = "Private DNS name of the instance"
  value       = aws_instance.app.private_dns
}

output "availability_zone" {
  description = "Availability zone of the instance"
  value       = aws_instance.app.availability_zone
}

output "subnet_id" {
  description = "Subnet ID of the instance"
  value       = aws_instance.app.subnet_id
}

output "security_groups" {
  description = "Security groups attached to the instance"
  value       = aws_instance.app.vpc_security_group_ids
}

output "root_volume_id" {
  description = "ID of the root volume"
  value       = aws_instance.app.root_block_device[0].volume_id
}

output "data_volume_id" {
  description = "ID of the data volume (if enabled)"
  value       = var.enable_data_volume ? aws_instance.app.ebs_block_device[0].volume_id : null
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = var.enable_cloudwatch_logs ? aws_cloudwatch_log_group.app_logs[0].name : null
}

output "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group"
  value       = var.enable_cloudwatch_logs ? aws_cloudwatch_log_group.app_logs[0].arn : null
}

output "backup_snapshot_id" {
  description = "ID of the backup snapshot (if enabled)"
  value       = var.enable_backup ? aws_ebs_snapshot.app_backup[0].id : null
}

output "dlm_policy_id" {
  description = "ID of the DLM lifecycle policy (if enabled)"
  value       = var.enable_backup ? aws_dlm_lifecycle_policy.app_backup_policy[0].id : null
}
