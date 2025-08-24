# EC2 Module for Book Review Platform
# Creates EC2 instance with user data for application deployment

# User data script for instance initialization
locals {
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    app_name              = var.app_name
    app_port              = var.app_port
    node_env              = var.node_env
    environment_variables = var.environment_variables
    github_repo           = var.github_repo
    github_branch         = var.github_branch
    node_version          = var.node_version
    pm2_instances         = var.pm2_instances
  }))
}

# EC2 Instance
resource "aws_instance" "app" {
  ami                    = var.ami_id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = var.subnet_id
  vpc_security_group_ids = var.vpc_security_group_ids
  iam_instance_profile   = var.iam_instance_profile_name

  user_data                   = local.user_data
  user_data_replace_on_change = true

  # Storage configuration
  root_block_device {
    volume_type           = var.root_volume_type
    volume_size           = var.root_volume_size
    encrypted             = var.enable_encryption
    kms_key_id            = var.kms_key_id
    delete_on_termination = true

    tags = merge(var.tags, {
      Name = "${var.app_name}-${var.environment}-root-volume"
    })
  }

  # Additional EBS volume for application data
  dynamic "ebs_block_device" {
    for_each = var.enable_data_volume ? [1] : []
    content {
      device_name           = "/dev/sdf"
      volume_type           = "gp3"
      volume_size           = var.data_volume_size
      encrypted             = var.enable_encryption
      kms_key_id            = var.kms_key_id
      delete_on_termination = false

      tags = merge(var.tags, {
        Name = "${var.app_name}-${var.environment}-data-volume"
      })
    }
  }

  # Monitoring
  monitoring = var.enable_detailed_monitoring

  # Metadata options for security
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  tags = merge(var.tags, {
    Name = "${var.app_name}-${var.environment}"
    Type = "Application Server"
  })

  lifecycle {
    create_before_destroy = true
    ignore_changes = [
      ami,
      user_data
    ]
  }
}

# CloudWatch Log Group for application logs
resource "aws_cloudwatch_log_group" "app_logs" {
  count = var.enable_cloudwatch_logs ? 1 : 0

  name              = "/aws/ec2/${var.app_name}-${var.environment}"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.enable_encryption ? var.kms_key_id : null

  tags = var.tags
}

# CloudWatch Log Stream for application
resource "aws_cloudwatch_log_stream" "app_stream" {
  count = var.enable_cloudwatch_logs ? 1 : 0

  name           = "${var.app_name}-application"
  log_group_name = aws_cloudwatch_log_group.app_logs[0].name
}

# CloudWatch Log Stream for access logs
resource "aws_cloudwatch_log_stream" "access_stream" {
  count = var.enable_cloudwatch_logs ? 1 : 0

  name           = "${var.app_name}-access"
  log_group_name = aws_cloudwatch_log_group.app_logs[0].name
}

# CloudWatch Log Stream for error logs
resource "aws_cloudwatch_log_stream" "error_stream" {
  count = var.enable_cloudwatch_logs ? 1 : 0

  name           = "${var.app_name}-error"
  log_group_name = aws_cloudwatch_log_group.app_logs[0].name
}

# CloudWatch Alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors ec2 cpu utilization"
  alarm_actions       = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  dimensions = {
    InstanceId = aws_instance.app.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "high_memory" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-high-memory"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "MemoryUtilization"
  namespace           = "CWAgent"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors memory utilization"
  alarm_actions       = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  dimensions = {
    InstanceId = aws_instance.app.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "status_check_failed" {
  count = var.enable_monitoring ? 1 : 0

  alarm_name          = "${var.app_name}-${var.environment}-status-check-failed"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = "300"
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "This metric monitors instance status check"
  alarm_actions       = var.sns_topic_arn != "" ? [var.sns_topic_arn] : []

  dimensions = {
    InstanceId = aws_instance.app.id
  }

  tags = var.tags
}

# EBS Snapshot for backup
resource "aws_ebs_snapshot" "app_backup" {
  count = var.enable_backup ? 1 : 0

  volume_id   = aws_instance.app.root_block_device[0].volume_id
  description = "Backup of ${var.app_name}-${var.environment} root volume"

  tags = merge(var.tags, {
    Name = "${var.app_name}-${var.environment}-backup"
  })
}

# Data Lifecycle Manager for automated backups
resource "aws_dlm_lifecycle_policy" "app_backup_policy" {
  count = var.enable_backup ? 1 : 0

  description        = "DLM lifecycle policy for ${var.app_name}-${var.environment}"
  execution_role_arn = aws_iam_role.dlm_lifecycle_role[0].arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["VOLUME"]
    target_tags = {
      Name = "${var.app_name}-${var.environment}"
    }

    schedule {
      name = "Daily Backup"

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["03:00"]
      }

      retain_rule {
        count = var.backup_retention_days
      }

      copy_tags = true

      tags_to_add = {
        SnapshotCreator = "DLM"
        Environment     = var.environment
      }
    }
  }

  tags = var.tags
}

# IAM role for DLM
resource "aws_iam_role" "dlm_lifecycle_role" {
  count = var.enable_backup ? 1 : 0

  name = "${var.app_name}-${var.environment}-dlm-lifecycle-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "dlm.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

resource "aws_iam_role_policy" "dlm_lifecycle_policy" {
  count = var.enable_backup ? 1 : 0

  name = "${var.app_name}-${var.environment}-dlm-lifecycle-policy"
  role = aws_iam_role.dlm_lifecycle_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateSnapshot",
          "ec2:CreateTags",
          "ec2:DeleteSnapshot",
          "ec2:DescribeInstances",
          "ec2:DescribeSnapshots",
          "ec2:DescribeVolumes"
        ]
        Resource = "*"
      }
    ]
  })
}

# Systems Manager Association for patching
resource "aws_ssm_association" "patch_baseline" {
  count = var.enable_ssm_patching ? 1 : 0

  name = "AWS-RunPatchBaseline"

  targets {
    key    = "InstanceIds"
    values = [aws_instance.app.id]
  }

  schedule_expression = "cron(0 2 ? * SUN *)" # Weekly on Sunday at 2 AM

  parameters = {
    Operation = "Install"
  }
}
