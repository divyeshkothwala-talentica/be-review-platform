#!/bin/bash
# Local Validation Script for Book Review Platform Infrastructure
# This script validates the Terraform configuration locally before deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERBOSE=false
FIX_ISSUES=false

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

Validate Terraform infrastructure configuration locally

OPTIONS:
    -e, --environment ENV    Environment to validate (dev, staging, prod)
    -v, --verbose           Enable verbose output
    -f, --fix               Attempt to fix formatting issues
    -h, --help              Show this help message

EXAMPLES:
    $0                      # Validate development environment
    $0 -e staging -v        # Validate staging with verbose output
    $0 -e prod -f           # Validate production and fix formatting

VALIDATION CHECKS:
    - Terraform syntax validation
    - Code formatting check
    - Security best practices
    - Resource naming conventions
    - Required variables check
    - Cost estimation
    - Documentation completeness
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--fix)
            FIX_ISSUES=true
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

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    print_error "Invalid environment: $ENVIRONMENT. Must be dev, staging, or prod"
    exit 1
fi

print_status "Starting local validation for $ENVIRONMENT environment"
print_status "Terraform directory: $TERRAFORM_DIR"

# Change to Terraform directory
cd "$TERRAFORM_DIR"

# Validation counters
ERRORS=0
WARNINGS=0
CHECKS_PASSED=0

# Function to increment counters
increment_error() {
    ((ERRORS++))
}

increment_warning() {
    ((WARNINGS++))
}

increment_success() {
    ((CHECKS_PASSED++))
}

# Check if required tools are installed
print_status "Checking required tools..."

check_tool() {
    local tool=$1
    local install_cmd=$2
    
    if command -v "$tool" &> /dev/null; then
        print_success "$tool is installed"
        increment_success
    else
        print_error "$tool is not installed. Install with: $install_cmd"
        increment_error
    fi
}

check_tool "terraform" "https://learn.hashicorp.com/tutorials/terraform/install-cli"
check_tool "aws" "https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
check_tool "jq" "sudo apt-get install jq (Ubuntu) or brew install jq (macOS)"

# Check Terraform version
if command -v terraform &> /dev/null; then
    TF_VERSION=$(terraform version -json | jq -r '.terraform_version')
    REQUIRED_VERSION="1.0.0"
    
    if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$TF_VERSION" | sort -V | head -n1)" == "$REQUIRED_VERSION" ]]; then
        print_success "Terraform version $TF_VERSION meets minimum requirement ($REQUIRED_VERSION)"
        increment_success
    else
        print_error "Terraform version $TF_VERSION is below minimum requirement ($REQUIRED_VERSION)"
        increment_error
    fi
fi

# Check AWS credentials
print_status "Checking AWS credentials..."
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    print_success "AWS credentials configured (Account: $ACCOUNT_ID)"
    increment_success
else
    print_error "AWS credentials not configured. Run 'aws configure' first."
    increment_error
fi

# Check Terraform syntax
print_status "Validating Terraform syntax..."
if terraform init -backend=false &> /dev/null; then
    print_success "Terraform initialization successful"
    increment_success
else
    print_error "Terraform initialization failed"
    increment_error
fi

if terraform validate &> /dev/null; then
    print_success "Terraform syntax validation passed"
    increment_success
else
    print_error "Terraform syntax validation failed"
    terraform validate
    increment_error
fi

# Check code formatting
print_status "Checking code formatting..."
if terraform fmt -check -recursive &> /dev/null; then
    print_success "Code formatting is correct"
    increment_success
else
    print_warning "Code formatting issues found"
    increment_warning
    
    if [[ "$FIX_ISSUES" == true ]]; then
        print_status "Fixing formatting issues..."
        terraform fmt -recursive
        print_success "Formatting issues fixed"
    else
        print_status "Run with -f flag to fix formatting issues automatically"
        terraform fmt -check -recursive
    fi
fi

# Check environment-specific configuration
ENV_DIR="$TERRAFORM_DIR/environments/$ENVIRONMENT"
TFVARS_FILE="$ENV_DIR/terraform.tfvars"

print_status "Checking environment configuration..."
if [[ -f "$TFVARS_FILE" ]]; then
    print_success "Environment configuration file found: $TFVARS_FILE"
    increment_success
else
    print_error "Environment configuration file not found: $TFVARS_FILE"
    increment_error
fi

# Check required variables
print_status "Checking required variables..."
REQUIRED_VARS=("environment" "aws_region" "instance_type")
SENSITIVE_VARS=("mongodb_uri" "jwt_secret" "openai_api_key")

for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^$var\s*=" "$TFVARS_FILE" 2>/dev/null; then
        print_success "Required variable '$var' is set"
        increment_success
    else
        print_error "Required variable '$var' is not set in $TFVARS_FILE"
        increment_error
    fi
done

for var in "${SENSITIVE_VARS[@]}"; do
    if grep -q "^$var\s*=" "$TFVARS_FILE" 2>/dev/null; then
        print_warning "Sensitive variable '$var' is set in tfvars file (consider using environment variables)"
        increment_warning
    elif [[ -n "${!var}" ]]; then
        print_success "Sensitive variable '$var' is set via environment variable"
        increment_success
    else
        print_warning "Sensitive variable '$var' is not set (required for deployment)"
        increment_warning
    fi
done

# Security checks
print_status "Running security checks..."

# Check SSH access configuration
if grep -q "ssh_allowed_ips.*0\.0\.0\.0/0" "$TFVARS_FILE" 2>/dev/null; then
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        print_error "Production environment allows SSH from anywhere (0.0.0.0/0)"
        increment_error
    else
        print_warning "SSH access is open to the world (0.0.0.0/0). Consider restricting to your IP."
        increment_warning
    fi
else
    print_success "SSH access is properly restricted"
    increment_success
fi

# Check encryption settings
if [[ "$ENVIRONMENT" == "prod" ]]; then
    if grep -q "enable_encryption.*true" "$TFVARS_FILE" 2>/dev/null; then
        print_success "Encryption is enabled for production"
        increment_success
    else
        print_error "Encryption should be enabled for production environment"
        increment_error
    fi
fi

# Check monitoring settings
if [[ "$ENVIRONMENT" == "prod" ]]; then
    if grep -q "enable_monitoring.*true" "$TFVARS_FILE" 2>/dev/null; then
        print_success "Monitoring is enabled for production"
        increment_success
    else
        print_warning "Monitoring should be enabled for production environment"
        increment_warning
    fi
fi

# Resource naming convention check
print_status "Checking resource naming conventions..."
if grep -q "project_name.*book-review" "$TFVARS_FILE" 2>/dev/null || grep -q "book-review" main.tf; then
    print_success "Resource naming follows project conventions"
    increment_success
else
    print_warning "Resource naming may not follow project conventions"
    increment_warning
fi

# Cost estimation (basic)
print_status "Performing basic cost estimation..."
INSTANCE_TYPE=$(grep "instance_type" "$TFVARS_FILE" | cut -d'"' -f2 2>/dev/null || echo "t3.micro")
case $INSTANCE_TYPE in
    "t3.micro")
        MONTHLY_COST="~$8.50"
        ;;
    "t3.small")
        MONTHLY_COST="~$17.00"
        ;;
    "t3.medium")
        MONTHLY_COST="~$34.00"
        ;;
    *)
        MONTHLY_COST="Variable"
        ;;
esac

print_status "Estimated monthly cost for $INSTANCE_TYPE: $MONTHLY_COST (EC2 only, excludes data transfer and storage)"

# Documentation checks
print_status "Checking documentation..."
DOC_FILES=("README.md" "terraform/README.md")
for doc in "${DOC_FILES[@]}"; do
    if [[ -f "$doc" ]]; then
        print_success "Documentation file found: $doc"
        increment_success
    else
        print_warning "Documentation file missing: $doc"
        increment_warning
    fi
done

# Module structure check
print_status "Checking module structure..."
MODULES=("networking" "security" "ec2")
for module in "${MODULES[@]}"; do
    MODULE_DIR="modules/$module"
    if [[ -d "$MODULE_DIR" ]]; then
        if [[ -f "$MODULE_DIR/main.tf" && -f "$MODULE_DIR/variables.tf" && -f "$MODULE_DIR/outputs.tf" ]]; then
            print_success "Module '$module' has complete structure"
            increment_success
        else
            print_warning "Module '$module' is missing required files (main.tf, variables.tf, outputs.tf)"
            increment_warning
        fi
    else
        print_error "Module directory not found: $MODULE_DIR"
        increment_error
    fi
done

# Terraform plan dry run (if credentials are available)
if [[ $ERRORS -eq 0 && -n "$ACCOUNT_ID" ]]; then
    print_status "Running Terraform plan dry run..."
    
    # Create temporary backend configuration for local validation
    cat > backend_override.tf << EOF
terraform {
  backend "local" {
    path = "terraform.tfstate.temp"
  }
}
EOF
    
    if terraform init &> /dev/null; then
        if terraform plan -var-file="$TFVARS_FILE" -out=tfplan.temp &> /dev/null; then
            print_success "Terraform plan validation passed"
            increment_success
            
            # Show plan summary if verbose
            if [[ "$VERBOSE" == true ]]; then
                print_status "Plan summary:"
                terraform show -no-color tfplan.temp | head -20
            fi
        else
            print_error "Terraform plan validation failed"
            if [[ "$VERBOSE" == true ]]; then
                terraform plan -var-file="$TFVARS_FILE"
            fi
            increment_error
        fi
    fi
    
    # Cleanup
    rm -f backend_override.tf tfplan.temp terraform.tfstate.temp
fi

# Generate validation report
print_status "Generating validation report..."

TOTAL_CHECKS=$((CHECKS_PASSED + WARNINGS + ERRORS))
SUCCESS_RATE=$((CHECKS_PASSED * 100 / TOTAL_CHECKS))

echo ""
echo "=================================="
echo "    VALIDATION REPORT SUMMARY"
echo "=================================="
echo "Environment: $ENVIRONMENT"
echo "Total Checks: $TOTAL_CHECKS"
echo "Passed: $CHECKS_PASSED"
echo "Warnings: $WARNINGS"
echo "Errors: $ERRORS"
echo "Success Rate: $SUCCESS_RATE%"
echo "=================================="

# Recommendations
if [[ $WARNINGS -gt 0 || $ERRORS -gt 0 ]]; then
    echo ""
    print_status "Recommendations:"
    
    if [[ $ERRORS -gt 0 ]]; then
        echo "  - Fix all errors before deploying to any environment"
        echo "  - Review Terraform documentation for syntax issues"
        echo "  - Ensure all required tools are installed and configured"
    fi
    
    if [[ $WARNINGS -gt 0 ]]; then
        echo "  - Address warnings to improve security and best practices"
        echo "  - Consider using environment variables for sensitive data"
        echo "  - Review security settings, especially for production"
    fi
    
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        echo "  - Production deployments require zero errors and minimal warnings"
        echo "  - Ensure all security features are enabled"
        echo "  - Verify monitoring and backup configurations"
    fi
fi

# Exit with appropriate code
if [[ $ERRORS -gt 0 ]]; then
    print_error "Validation failed with $ERRORS errors"
    exit 1
elif [[ $WARNINGS -gt 0 ]]; then
    print_warning "Validation completed with $WARNINGS warnings"
    exit 0
else
    print_success "All validation checks passed!"
    exit 0
fi
