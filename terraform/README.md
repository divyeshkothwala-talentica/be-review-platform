# Book Review Platform - Infrastructure as Code

This directory contains Terraform infrastructure code for deploying the Book Review Platform backend on AWS using VM-based deployment.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Directory Structure](#directory-structure)
- [Environment Configuration](#environment-configuration)
- [Deployment](#deployment)
- [Validation](#validation)
- [CI/CD Pipeline](#cicd-pipeline)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Cost Optimization](#cost-optimization)

## 🏗️ Overview

This Terraform configuration creates a complete AWS infrastructure for hosting the Book Review Platform Node.js backend application. The infrastructure is designed to be:

- **Scalable**: Easy to scale from development to production
- **Secure**: Following AWS security best practices
- **Cost-effective**: Optimized for different environment needs
- **Maintainable**: Modular design with clear separation of concerns

## 🏛️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Cloud                           │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                      VPC                                │ │
│  │  ┌─────────────────┐  ┌─────────────────────────────────┐ │ │
│  │  │  Public Subnet  │  │        Private Subnet           │ │ │
│  │  │                 │  │                                 │ │ │
│  │  │  ┌───────────┐  │  │  ┌─────────────────────────────┐ │ │ │
│  │  │  │    ALB    │  │  │  │                             │ │ │ │
│  │  │  └───────────┘  │  │  │                             │ │ │ │
│  │  │        │        │  │  │                             │ │ │ │
│  │  │  ┌───────────┐  │  │  │                             │ │ │ │
│  │  │  │    EC2    │  │  │  │                             │ │ │ │
│  │  │  │ (Node.js) │  │  │  │                             │ │ │ │
│  │  │  └───────────┘  │  │  │                             │ │ │ │
│  │  └─────────────────┘  │  └─────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                             │
│  External Services:                                         │
│  - MongoDB Atlas (M0 Cluster)                              │
│  - OpenAI API                                              │
│  - CloudWatch Logs & Monitoring                            │
└─────────────────────────────────────────────────────────────┘
```

### Components

- **VPC**: Isolated network environment
- **Public Subnets**: For load balancer and NAT gateway
- **Private Subnets**: For application servers (future use)
- **EC2 Instance**: Hosts the Node.js application
- **Security Groups**: Network-level security
- **Application Load Balancer**: Optional for production
- **Elastic IP**: Consistent public IP address
- **CloudWatch**: Monitoring and logging
- **IAM Roles**: Secure access to AWS services

## 📋 Prerequisites

### Required Tools

1. **Terraform** (>= 1.0.0)
   ```bash
   # Install via Homebrew (macOS)
   brew install terraform
   
   # Or download from https://www.terraform.io/downloads.html
   ```

2. **AWS CLI** (>= 2.0.0)
   ```bash
   # Install via Homebrew (macOS)
   brew install awscli
   
   # Configure credentials
   aws configure
   ```

3. **jq** (for JSON processing)
   ```bash
   # Install via Homebrew (macOS)
   brew install jq
   ```

### AWS Prerequisites

1. **AWS Account** with appropriate permissions
2. **IAM User** with programmatic access
3. **Key Pair** for EC2 SSH access (optional but recommended)
4. **MongoDB Atlas** account and cluster (M0 free tier)
5. **OpenAI API** key for recommendations

### Required AWS Permissions

Your AWS user/role needs the following permissions:
- EC2 (full access)
- VPC (full access)
- IAM (limited - for roles and policies)
- CloudWatch (logs and metrics)
- Systems Manager (for parameter store)

## 🚀 Quick Start

### 1. Clone and Setup

```bash
# Navigate to the terraform directory
cd terraform

# Copy environment configuration
cp environments/dev/terraform.tfvars.example environments/dev/terraform.tfvars
```

### 2. Configure Environment Variables

```bash
# Set required environment variables
export TF_VAR_mongodb_uri="mongodb+srv://username:password@cluster.mongodb.net/bookreviews_dev"
export TF_VAR_jwt_secret="your-super-secret-jwt-key"
export TF_VAR_openai_api_key="your-openai-api-key"

# Optional: Set AWS profile
export AWS_PROFILE="your-aws-profile"
```

### 3. Validate Configuration

```bash
# Run local validation
./scripts/validate-local.sh -e dev -v
```

### 4. Deploy Infrastructure

```bash
# Deploy development environment
./scripts/deploy-infrastructure.sh -e dev -a apply
```

### 5. Deploy Application

```bash
# Deploy application code
./scripts/deploy-application.sh -e dev -r your-username/be-review-platform -k ~/.ssh/your-key.pem
```

## 📁 Directory Structure

```
terraform/
├── main.tf                    # Main Terraform configuration
├── variables.tf               # Input variables
├── outputs.tf                 # Output values
├── README.md                  # This file
├── modules/                   # Reusable Terraform modules
│   ├── networking/            # VPC, subnets, routing
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── security/              # Security groups, IAM roles
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── ec2/                   # EC2 instances, user data
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── user_data.sh
├── environments/              # Environment-specific configurations
│   ├── dev/
│   │   └── terraform.tfvars
│   ├── staging/
│   │   └── terraform.tfvars
│   └── prod/
│       └── terraform.tfvars
└── scripts/                   # Deployment and utility scripts
    ├── deploy-infrastructure.sh
    ├── deploy-application.sh
    └── validate-local.sh
```

## ⚙️ Environment Configuration

### Development Environment

- **Instance Type**: t3.micro (1 vCPU, 1GB RAM)
- **Monitoring**: Basic CloudWatch logs
- **Backup**: Disabled
- **Load Balancer**: Disabled
- **Estimated Cost**: ~$8.50/month

### Staging Environment

- **Instance Type**: t3.small (2 vCPU, 2GB RAM)
- **Monitoring**: Enhanced monitoring enabled
- **Backup**: 7-day retention
- **Load Balancer**: Enabled
- **Estimated Cost**: ~$25/month

### Production Environment

- **Instance Type**: t3.medium (2 vCPU, 4GB RAM)
- **Monitoring**: Full monitoring and alerting
- **Backup**: 30-day retention
- **Load Balancer**: Enabled with SSL
- **Security**: WAF, encryption enabled
- **Estimated Cost**: ~$50/month

## 🚀 Deployment

### Infrastructure Deployment

```bash
# Plan deployment (dry run)
./scripts/deploy-infrastructure.sh -e <environment> -a plan

# Apply deployment
./scripts/deploy-infrastructure.sh -e <environment> -a apply

# Destroy infrastructure
./scripts/deploy-infrastructure.sh -e <environment> -a destroy -y
```

### Application Deployment

```bash
# Deploy application
./scripts/deploy-application.sh -e <environment> -r <github-repo> -k <ssh-key>

# Rollback application
./scripts/deploy-application.sh -e <environment> --rollback -k <ssh-key>
```

### Environment-Specific Commands

```bash
# Development
./scripts/deploy-infrastructure.sh -e dev -a apply
./scripts/deploy-application.sh -e dev -r myuser/be-review-platform -k ~/.ssh/dev-key.pem

# Staging
./scripts/deploy-infrastructure.sh -e staging -a apply
./scripts/deploy-application.sh -e staging -r myuser/be-review-platform -k ~/.ssh/staging-key.pem

# Production (requires manual approval)
./scripts/deploy-infrastructure.sh -e prod -a apply
./scripts/deploy-application.sh -e prod -r myuser/be-review-platform -k ~/.ssh/prod-key.pem
```

## ✅ Validation

### Local Validation

```bash
# Basic validation
./scripts/validate-local.sh

# Verbose validation with specific environment
./scripts/validate-local.sh -e prod -v

# Validation with auto-fix
./scripts/validate-local.sh -e dev -f
```

### Manual Validation Steps

1. **Terraform Syntax**
   ```bash
   terraform fmt -check -recursive
   terraform validate
   ```

2. **Security Check**
   ```bash
   # Check for hardcoded secrets
   grep -r "password\|secret\|key" --include="*.tf" .
   
   # Verify SSH restrictions
   grep "0.0.0.0/0" environments/*/terraform.tfvars
   ```

3. **Cost Estimation**
   ```bash
   # Use terraform plan to estimate costs
   terraform plan -var-file="environments/dev/terraform.tfvars"
   ```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

The repository includes two main workflows:

1. **Infrastructure Deployment** (`.github/workflows/infrastructure.yml`)
   - Validates Terraform code
   - Plans infrastructure changes
   - Deploys to environments based on branch
   - Supports manual deployment via workflow_dispatch

2. **Application Deployment** (`.github/workflows/deploy-application.yml`)
   - Runs tests and builds application
   - Deploys to corresponding infrastructure
   - Supports rollback functionality

### Workflow Triggers

- **Development**: Automatic deployment on `develop` branch push
- **Staging**: Automatic deployment on `main` branch push
- **Production**: Manual deployment via GitHub Actions UI

### Required Secrets

Configure these secrets in your GitHub repository:

```
AWS_ACCESS_KEY_ID          # AWS access key
AWS_SECRET_ACCESS_KEY      # AWS secret key
SSH_PRIVATE_KEY           # SSH private key for EC2 access
DEV_MONGODB_URI           # Development MongoDB connection string
STAGING_MONGODB_URI       # Staging MongoDB connection string
PROD_MONGODB_URI          # Production MongoDB connection string
DEV_JWT_SECRET            # Development JWT secret
STAGING_JWT_SECRET        # Staging JWT secret
PROD_JWT_SECRET           # Production JWT secret
OPENAI_API_KEY            # OpenAI API key
```

## 📊 Monitoring and Maintenance

### CloudWatch Monitoring

- **Logs**: Application logs, Nginx access/error logs
- **Metrics**: CPU, memory, disk usage
- **Alarms**: High CPU, memory usage, status check failures

### Health Checks

```bash
# Application health check
curl http://<instance-ip>:5000/health

# Detailed status
ssh ec2-user@<instance-ip> 'pm2 list && systemctl status book-review-api'
```

### Log Monitoring

```bash
# View application logs
ssh ec2-user@<instance-ip> 'tail -f /var/log/book-review-api/combined.log'

# View Nginx logs
ssh ec2-user@<instance-ip> 'tail -f /var/log/nginx/access.log'
```

### Backup and Recovery

- **Automated Backups**: EBS snapshots via DLM (Data Lifecycle Manager)
- **Manual Backup**: Create snapshot before major deployments
- **Recovery**: Launch new instance from snapshot if needed

## 🔧 Troubleshooting

### Common Issues

1. **Terraform Init Fails**
   ```bash
   # Clear cache and reinitialize
   rm -rf .terraform
   terraform init
   ```

2. **SSH Connection Issues**
   ```bash
   # Check security groups
   aws ec2 describe-security-groups --group-ids <sg-id>
   
   # Verify key permissions
   chmod 600 ~/.ssh/your-key.pem
   ```

3. **Application Not Starting**
   ```bash
   # Check application logs
   ssh ec2-user@<instance-ip> 'journalctl -u book-review-api -f'
   
   # Check PM2 status
   ssh ec2-user@<instance-ip> 'pm2 logs'
   ```

4. **Database Connection Issues**
   ```bash
   # Test MongoDB connection
   ssh ec2-user@<instance-ip> 'curl -X GET http://localhost:5000/api/v1/books'
   ```

### Debug Commands

```bash
# Terraform debug
export TF_LOG=DEBUG
terraform plan

# AWS CLI debug
aws ec2 describe-instances --debug

# Application debug
ssh ec2-user@<instance-ip> 'NODE_ENV=development pm2 restart book-review-api'
```

## 💰 Cost Optimization

### Development Environment
- Use t3.micro instances (free tier eligible)
- Disable monitoring and backups
- Use single AZ deployment

### Staging Environment
- Use t3.small instances
- Enable basic monitoring
- Short backup retention (7 days)

### Production Environment
- Right-size instances based on usage
- Use reserved instances for predictable workloads
- Enable detailed monitoring only when needed
- Optimize backup retention policies

### Cost Monitoring

```bash
# Estimate costs before deployment
terraform plan -var-file="environments/prod/terraform.tfvars" | grep "Plan:"

# Monitor actual costs via AWS Cost Explorer
aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31 --granularity MONTHLY --metrics BlendedCost
```

## 📚 Additional Resources

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EC2 Best Practices](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-best-practices.html)
- [Node.js Deployment Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [PM2 Process Manager](https://pm2.keymetrics.io/docs/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run validation: `./scripts/validate-local.sh -v`
5. Submit a pull request

## 📄 License

This infrastructure code is part of the Book Review Platform project and follows the same license terms.

---

**Note**: Always run validation scripts before deploying to any environment, especially production. Keep your AWS credentials secure and never commit them to version control.
