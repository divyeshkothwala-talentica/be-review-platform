#!/bin/bash
# Local Setup Script for Book Review Platform Infrastructure
# This script helps set up the local development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Setting up Book Review Platform Infrastructure Development Environment"

# Check if we're in the right directory
if [[ ! -f "main.tf" ]]; then
    print_error "Please run this script from the terraform directory"
    exit 1
fi

# Check for required tools
print_status "Checking required tools..."

check_tool() {
    local tool=$1
    local install_cmd=$2
    
    if command -v "$tool" &> /dev/null; then
        print_success "$tool is installed"
        return 0
    else
        print_error "$tool is not installed"
        echo "  Install with: $install_cmd"
        return 1
    fi
}

MISSING_TOOLS=0

check_tool "terraform" "https://learn.hashicorp.com/tutorials/terraform/install-cli" || ((MISSING_TOOLS++))
check_tool "aws" "https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html" || ((MISSING_TOOLS++))
check_tool "jq" "sudo apt-get install jq (Ubuntu) or brew install jq (macOS)" || ((MISSING_TOOLS++))
check_tool "git" "https://git-scm.com/downloads" || ((MISSING_TOOLS++))

if [[ $MISSING_TOOLS -gt 0 ]]; then
    print_error "Please install missing tools before continuing"
    exit 1
fi

# Check AWS credentials
print_status "Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=$(aws configure get region || echo "us-east-1")
    print_success "AWS credentials configured (Account: $ACCOUNT_ID, Region: $AWS_REGION)"
else
    print_error "AWS credentials not configured"
    echo "Please run: aws configure"
    exit 1
fi

# Create environment configuration if it doesn't exist
print_status "Setting up environment configuration..."

ENV_FILE="environments/dev/terraform.tfvars"
if [[ ! -f "$ENV_FILE" ]]; then
    print_status "Creating development environment configuration..."
    
    # Get user's public IP for SSH access
    USER_IP=$(curl -s https://ipinfo.io/ip 2>/dev/null || echo "0.0.0.0")
    
    cat > "$ENV_FILE" << EOF
# Development Environment Configuration
# Book Review Platform - Development Environment

# General Configuration
environment = "dev"
aws_region  = "$AWS_REGION"

# Networking Configuration
vpc_cidr = "10.0.0.0/16"

# EC2 Configuration
instance_type = "t3.micro"
key_pair_name = "" # TODO: Add your EC2 key pair name

# Security Configuration
ssh_allowed_ips = ["$USER_IP/32"] # Your current IP address

# Load Balancer Configuration (disabled for dev)
enable_load_balancer = false
enable_elastic_ip    = true

# Monitoring Configuration (minimal for dev)
enable_cloudwatch_logs = true
log_retention_days     = 3

# Backup Configuration (disabled for dev)
enable_ebs_backup = false

# Cost Optimization
enable_spot_instances = false
enable_auto_scaling   = false

# Development Tools
enable_dev_tools  = true
enable_ssh_access = true

# Node.js Configuration
node_version  = "18"
pm2_instances = 1

# Application Configuration
# Note: Set these via environment variables for security
# mongodb_uri    = "mongodb+srv://username:password@cluster.mongodb.net/bookreviews_dev"
# jwt_secret     = "your-dev-jwt-secret-key"
# openai_api_key = "your-openai-api-key"

# GitHub Configuration (optional for automated deployment)
# github_repo   = "your-username/be-review-platform"
# github_branch = "develop"
EOF
    
    print_success "Created $ENV_FILE"
    print_warning "Please update the configuration with your specific values"
else
    print_success "Environment configuration already exists: $ENV_FILE"
fi

# Create environment variables template
ENV_TEMPLATE=".env.template"
if [[ ! -f "$ENV_TEMPLATE" ]]; then
    print_status "Creating environment variables template..."
    
    cat > "$ENV_TEMPLATE" << 'EOF'
# Environment Variables Template
# Copy this file to .env and fill in your actual values
# DO NOT commit .env to version control

# MongoDB Atlas connection string
export TF_VAR_mongodb_uri="mongodb+srv://username:password@cluster.mongodb.net/bookreviews_dev"

# JWT secret key (generate a secure random string)
export TF_VAR_jwt_secret="your-super-secret-jwt-key-at-least-32-characters-long"

# OpenAI API key for recommendations
export TF_VAR_openai_api_key="sk-your-openai-api-key-here"

# Optional: AWS profile if using multiple profiles
# export AWS_PROFILE="your-aws-profile"

# Optional: GitHub repository for automated deployment
# export TF_VAR_github_repo="your-username/be-review-platform"
EOF
    
    print_success "Created $ENV_TEMPLATE"
    print_warning "Copy this to .env and fill in your actual values"
fi

# Check for EC2 key pairs
print_status "Checking EC2 key pairs..."
KEY_PAIRS=$(aws ec2 describe-key-pairs --query 'KeyPairs[].KeyName' --output text 2>/dev/null || echo "")

if [[ -n "$KEY_PAIRS" ]]; then
    print_success "Available EC2 key pairs:"
    for key in $KEY_PAIRS; do
        echo "  - $key"
    done
    print_warning "Update key_pair_name in $ENV_FILE with one of these keys"
else
    print_warning "No EC2 key pairs found in region $AWS_REGION"
    echo "Create one with: aws ec2 create-key-pair --key-name book-review-dev --query 'KeyMaterial' --output text > ~/.ssh/book-review-dev.pem"
    echo "Then run: chmod 600 ~/.ssh/book-review-dev.pem"
fi

# Initialize Terraform
print_status "Initializing Terraform..."
if terraform init -backend=false &> /dev/null; then
    print_success "Terraform initialized successfully"
else
    print_error "Terraform initialization failed"
    terraform init -backend=false
fi

# Validate Terraform configuration
print_status "Validating Terraform configuration..."
if terraform validate &> /dev/null; then
    print_success "Terraform configuration is valid"
else
    print_error "Terraform configuration validation failed"
    terraform validate
fi

# Make scripts executable
print_status "Making scripts executable..."
chmod +x scripts/*.sh
print_success "Scripts are now executable"

# Create .gitignore entries
GITIGNORE="../.gitignore"
print_status "Updating .gitignore..."

GITIGNORE_ENTRIES=(
    "# Terraform"
    "terraform/.terraform/"
    "terraform/.terraform.lock.hcl"
    "terraform/terraform.tfstate*"
    "terraform/tfplan*"
    "terraform/.env"
    "terraform/environments/*/terraform-outputs.json"
    ""
    "# SSH Keys"
    "*.pem"
    "*.key"
    ""
    "# Environment Variables"
    ".env"
    ".env.local"
    ".env.*.local"
)

for entry in "${GITIGNORE_ENTRIES[@]}"; do
    if [[ -n "$entry" ]] && ! grep -Fxq "$entry" "$GITIGNORE" 2>/dev/null; then
        echo "$entry" >> "$GITIGNORE"
    fi
done

print_success "Updated .gitignore with Terraform-specific entries"

# Summary and next steps
print_success "Local setup completed successfully!"

echo ""
echo "=================================="
echo "         NEXT STEPS"
echo "=================================="
echo ""
echo "1. Configure your environment:"
echo "   - Copy .env.template to .env and fill in your values"
echo "   - Update environments/dev/terraform.tfvars with your key pair name"
echo ""
echo "2. Set up external services:"
echo "   - Create MongoDB Atlas M0 cluster"
echo "   - Get OpenAI API key"
echo "   - Create EC2 key pair if needed"
echo ""
echo "3. Validate your configuration:"
echo "   source .env"
echo "   ./scripts/validate-local.sh -e dev -v"
echo ""
echo "4. Deploy infrastructure:"
echo "   ./scripts/deploy-infrastructure.sh -e dev -a plan"
echo "   ./scripts/deploy-infrastructure.sh -e dev -a apply"
echo ""
echo "5. Deploy application:"
echo "   ./scripts/deploy-application.sh -e dev -r your-username/be-review-platform -k ~/.ssh/your-key.pem"
echo ""
echo "=================================="
echo ""

print_warning "Important reminders:"
echo "  - Never commit .env files or private keys to version control"
echo "  - Use strong, unique passwords and secrets"
echo "  - Regularly update your IP address in terraform.tfvars"
echo "  - Monitor AWS costs and usage"

print_status "Setup complete! Check the DEPLOYMENT_GUIDE.md for detailed instructions."
