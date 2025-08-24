#!/bin/bash
# Infrastructure Deployment Script for Book Review Platform
# This script deploys the Terraform infrastructure for the specified environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=""
ACTION="plan"
AUTO_APPROVE=false
DESTROY=false
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Deploy Terraform infrastructure for Book Review Platform

OPTIONS:
    -e, --environment ENV    Environment to deploy (dev, staging, prod)
    -a, --action ACTION      Action to perform (plan, apply, destroy)
    -y, --auto-approve       Auto approve terraform apply/destroy
    -h, --help              Show this help message

EXAMPLES:
    $0 -e dev -a plan                    # Plan development environment
    $0 -e staging -a apply               # Apply staging environment
    $0 -e prod -a apply -y               # Apply production with auto-approve
    $0 -e dev -a destroy -y              # Destroy development environment

ENVIRONMENTS:
    dev         Development environment (t3.micro, minimal monitoring)
    staging     Staging environment (t3.small, basic monitoring)
    prod        Production environment (t3.medium, full monitoring)

ACTIONS:
    plan        Show what Terraform will do
    apply       Apply the Terraform configuration
    destroy     Destroy the infrastructure
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -a|--action)
            ACTION="$2"
            shift 2
            ;;
        -y|--auto-approve)
            AUTO_APPROVE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$ENVIRONMENT" ]]; then
    print_error "Environment is required. Use -e or --environment"
    show_usage
    exit 1
fi

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod"
    exit 1
fi

# Validate action
if [[ ! "$ACTION" =~ ^(plan|apply|destroy)$ ]]; then
    print_error "Invalid action: $ACTION. Must be plan, apply, or destroy"
    exit 1
fi

# Set destroy flag
if [[ "$ACTION" == "destroy" ]]; then
    DESTROY=true
fi

# Environment-specific configurations
ENV_DIR="$TERRAFORM_DIR/environments/$ENVIRONMENT"
TFVARS_FILE="$ENV_DIR/terraform.tfvars"

print_status "Starting Terraform deployment for $ENVIRONMENT environment"
print_status "Action: $ACTION"
print_status "Terraform directory: $TERRAFORM_DIR"
print_status "Environment directory: $ENV_DIR"

# Check if Terraform is installed
if ! command -v terraform &> /dev/null; then
    print_error "Terraform is not installed. Please install Terraform first."
    exit 1
fi

# Check if AWS CLI is installed and configured
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed. Please install AWS CLI first."
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    print_error "AWS credentials not configured. Please run 'aws configure' first."
    exit 1
fi

# Check if tfvars file exists
if [[ ! -f "$TFVARS_FILE" ]]; then
    print_error "Terraform variables file not found: $TFVARS_FILE"
    exit 1
fi

# Change to Terraform directory
cd "$TERRAFORM_DIR"

# Initialize Terraform
print_status "Initializing Terraform..."
terraform init

# Validate Terraform configuration
print_status "Validating Terraform configuration..."
terraform validate

# Format Terraform files
print_status "Formatting Terraform files..."
terraform fmt -recursive

# Select or create workspace
print_status "Managing Terraform workspace for $ENVIRONMENT..."
if terraform workspace list | grep -q "$ENVIRONMENT"; then
    terraform workspace select "$ENVIRONMENT"
else
    terraform workspace new "$ENVIRONMENT"
fi

# Show current workspace
CURRENT_WORKSPACE=$(terraform workspace show)
print_status "Current workspace: $CURRENT_WORKSPACE"

# Verify workspace matches environment
if [[ "$CURRENT_WORKSPACE" != "$ENVIRONMENT" ]]; then
    print_error "Workspace mismatch. Expected: $ENVIRONMENT, Current: $CURRENT_WORKSPACE"
    exit 1
fi

# Check for required variables
print_status "Checking required variables..."
REQUIRED_VARS=("mongodb_uri" "jwt_secret" "openai_api_key")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^$var\s*=" "$TFVARS_FILE" && [[ -z "${!var}" ]]; then
        MISSING_VARS+=("$var")
    fi
done

if [[ ${#MISSING_VARS[@]} -gt 0 ]]; then
    print_warning "The following variables are not set in $TFVARS_FILE:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    print_warning "Make sure to set these via environment variables or update the tfvars file"
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        print_error "All variables must be set for production deployment"
        exit 1
    fi
fi

# Production safety check
if [[ "$ENVIRONMENT" == "prod" && "$DESTROY" == true ]]; then
    print_warning "You are about to DESTROY the PRODUCTION environment!"
    if [[ "$AUTO_APPROVE" != true ]]; then
        read -p "Are you absolutely sure? Type 'yes' to continue: " confirm
        if [[ "$confirm" != "yes" ]]; then
            print_status "Deployment cancelled"
            exit 0
        fi
    fi
fi

# Build Terraform command
TF_COMMAND="terraform $ACTION"
TF_COMMAND="$TF_COMMAND -var-file=\"$TFVARS_FILE\""

# Add environment variables if set
for var in "${REQUIRED_VARS[@]}"; do
    if [[ -n "${!var}" ]]; then
        TF_COMMAND="$TF_COMMAND -var=\"$var=${!var}\""
    fi
done

# Add auto-approve flag if requested and action is apply or destroy
if [[ "$AUTO_APPROVE" == true && ("$ACTION" == "apply" || "$ACTION" == "destroy") ]]; then
    TF_COMMAND="$TF_COMMAND -auto-approve"
fi

# Add destroy flag if destroying
if [[ "$DESTROY" == true ]]; then
    TF_COMMAND="terraform destroy -var-file=\"$TFVARS_FILE\""
    for var in "${REQUIRED_VARS[@]}"; do
        if [[ -n "${!var}" ]]; then
            TF_COMMAND="$TF_COMMAND -var=\"$var=${!var}\""
        fi
    done
    if [[ "$AUTO_APPROVE" == true ]]; then
        TF_COMMAND="$TF_COMMAND -auto-approve"
    fi
fi

# Show what will be executed
print_status "Executing: $TF_COMMAND"

# Execute Terraform command
if eval "$TF_COMMAND"; then
    if [[ "$ACTION" == "plan" ]]; then
        print_success "Terraform plan completed successfully"
    elif [[ "$ACTION" == "apply" ]]; then
        print_success "Infrastructure deployed successfully"
        
        # Show outputs
        print_status "Infrastructure outputs:"
        terraform output
        
        # Save outputs to file
        OUTPUT_FILE="$ENV_DIR/terraform-outputs.json"
        terraform output -json > "$OUTPUT_FILE"
        print_status "Outputs saved to: $OUTPUT_FILE"
        
    elif [[ "$ACTION" == "destroy" ]]; then
        print_success "Infrastructure destroyed successfully"
    fi
else
    print_error "Terraform $ACTION failed"
    exit 1
fi

# Post-deployment actions
if [[ "$ACTION" == "apply" ]]; then
    print_status "Post-deployment information:"
    
    # Get instance information
    INSTANCE_IP=$(terraform output -raw instance_public_ip 2>/dev/null || echo "Not available")
    APP_URL=$(terraform output -raw application_url 2>/dev/null || echo "Not available")
    SSH_COMMAND=$(terraform output -raw ssh_connection_command 2>/dev/null || echo "Not available")
    
    echo "  Instance IP: $INSTANCE_IP"
    echo "  Application URL: $APP_URL"
    echo "  SSH Command: $SSH_COMMAND"
    
    print_status "Next steps:"
    echo "  1. Wait for the instance to fully initialize (5-10 minutes)"
    echo "  2. Check application health: curl $APP_URL/health"
    echo "  3. Deploy your application code using the deployment script"
    echo "  4. Monitor logs: ssh to instance and check /var/log/book-review-api/"
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        print_warning "Production deployment completed. Please:"
        echo "  - Verify all services are running correctly"
        echo "  - Test all critical functionality"
        echo "  - Monitor application metrics and logs"
        echo "  - Set up alerting and monitoring dashboards"
    fi
fi

print_success "Deployment script completed successfully"
