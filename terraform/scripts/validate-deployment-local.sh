#!/bin/bash
# Local Deployment Validation Script for Book Review Platform
# This script validates that AWS deployment would work without actually deploying

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
SIMULATE_DEPLOY=false
CHECK_BACKEND=false

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

Validate AWS deployment locally without actually deploying

OPTIONS:
    -e, --environment ENV    Environment to validate (dev, staging, prod)
    -v, --verbose           Enable verbose output
    -s, --simulate          Simulate full deployment process
    -b, --check-backend     Check backend connectivity
    -h, --help              Show this help message

EXAMPLES:
    $0                      # Basic validation for dev environment
    $0 -e prod -v -s        # Full simulation for production
    $0 -b                   # Check backend services connectivity

VALIDATION CHECKS:
    - Terraform configuration validation
    - AWS credentials and permissions
    - Required services connectivity (MongoDB, OpenAI)
    - Resource capacity and limits
    - Security configuration
    - Cost estimation
    - Deployment simulation (dry-run)
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
        -s|--simulate)
            SIMULATE_DEPLOY=true
            shift
            ;;
        -b|--check-backend)
            CHECK_BACKEND=true
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

print_status "Starting local deployment validation for $ENVIRONMENT environment"
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

# Check prerequisites
print_status "=== PREREQUISITE CHECKS ==="

# Check required tools
REQUIRED_TOOLS=("terraform" "aws" "jq" "curl" "git")
for tool in "${REQUIRED_TOOLS[@]}"; do
    if command -v "$tool" &> /dev/null; then
        print_success "$tool is installed"
        increment_success
    else
        print_error "$tool is not installed"
        increment_error
    fi
done

# Check Terraform version
if command -v terraform &> /dev/null; then
    TF_VERSION=$(terraform version -json 2>/dev/null | jq -r '.terraform_version' 2>/dev/null || terraform version | head -1 | cut -d' ' -f2 | sed 's/v//')
    REQUIRED_VERSION="1.0.0"
    
    if [[ "$(printf '%s\n' "$REQUIRED_VERSION" "$TF_VERSION" | sort -V | head -n1)" == "$REQUIRED_VERSION" ]]; then
        print_success "Terraform version $TF_VERSION meets requirements"
        increment_success
    else
        print_error "Terraform version $TF_VERSION is below minimum requirement ($REQUIRED_VERSION)"
        increment_error
    fi
fi

# Check AWS credentials
print_status "=== AWS CREDENTIALS AND PERMISSIONS ==="
if aws sts get-caller-identity &> /dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    AWS_REGION=$(aws configure get region || echo "us-east-1")
    print_success "AWS credentials configured (Account: $ACCOUNT_ID, Region: $AWS_REGION)"
    increment_success
    
    # Check basic AWS permissions
    print_status "Checking AWS permissions..."
    
    # Check EC2 permissions
    if aws ec2 describe-regions --region "$AWS_REGION" &> /dev/null; then
        print_success "EC2 permissions verified"
        increment_success
    else
        print_error "EC2 permissions insufficient"
        increment_error
    fi
    
    # Check VPC permissions
    if aws ec2 describe-vpcs --region "$AWS_REGION" &> /dev/null; then
        print_success "VPC permissions verified"
        increment_success
    else
        print_error "VPC permissions insufficient"
        increment_error
    fi
    
    # Check IAM permissions
    if aws iam get-user &> /dev/null || aws sts get-caller-identity &> /dev/null; then
        print_success "IAM permissions verified"
        increment_success
    else
        print_warning "IAM permissions may be limited"
        increment_warning
    fi
    
else
    print_error "AWS credentials not configured"
    increment_error
fi

# Check environment configuration
print_status "=== ENVIRONMENT CONFIGURATION ==="
ENV_DIR="$TERRAFORM_DIR/environments/$ENVIRONMENT"
TFVARS_FILE="$ENV_DIR/terraform.tfvars"

if [[ -f "$TFVARS_FILE" ]]; then
    print_success "Environment configuration found: $TFVARS_FILE"
    increment_success
else
    print_error "Environment configuration not found: $TFVARS_FILE"
    increment_error
fi

# Check required variables
REQUIRED_VARS=("environment" "aws_region" "instance_type")
SENSITIVE_VARS=("mongodb_uri" "jwt_secret" "openai_api_key")

for var in "${REQUIRED_VARS[@]}"; do
    if grep -q "^$var\s*=" "$TFVARS_FILE" 2>/dev/null; then
        print_success "Required variable '$var' is configured"
        increment_success
    else
        print_error "Required variable '$var' is missing"
        increment_error
    fi
done

for var in "${SENSITIVE_VARS[@]}"; do
    if [[ -n "${!var}" ]] || [[ -n "$(eval echo \$TF_VAR_$var)" ]]; then
        print_success "Sensitive variable '$var' is set via environment"
        increment_success
    else
        print_warning "Sensitive variable '$var' is not set (required for deployment)"
        increment_warning
    fi
done

# Terraform configuration validation
print_status "=== TERRAFORM CONFIGURATION VALIDATION ==="

# Initialize Terraform
if terraform init -backend=false &> /dev/null; then
    print_success "Terraform initialization successful"
    increment_success
else
    print_error "Terraform initialization failed"
    terraform init -backend=false
    increment_error
fi

# Validate syntax
if terraform validate &> /dev/null; then
    print_success "Terraform syntax validation passed"
    increment_success
else
    print_error "Terraform syntax validation failed"
    terraform validate
    increment_error
fi

# Check formatting
if terraform fmt -check -recursive &> /dev/null; then
    print_success "Terraform formatting is correct"
    increment_success
else
    print_warning "Terraform formatting issues found"
    increment_warning
    if [[ "$VERBOSE" == true ]]; then
        terraform fmt -check -recursive
    fi
fi

# Backend services connectivity check
if [[ "$CHECK_BACKEND" == true ]]; then
    print_status "=== BACKEND SERVICES CONNECTIVITY ==="
    
    # Check MongoDB connectivity
    if [[ -n "${TF_VAR_mongodb_uri}" ]]; then
        print_status "Testing MongoDB connectivity..."
        
        # Create a simple Node.js script to test MongoDB connection
        cat > /tmp/test_mongo.js << 'EOF'
const { MongoClient } = require('mongodb');

async function testConnection() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI not provided');
        process.exit(1);
    }
    
    const client = new MongoClient(uri);
    
    try {
        await client.connect();
        console.log('MongoDB connection successful');
        await client.db().admin().ping();
        console.log('MongoDB ping successful');
        process.exit(0);
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        process.exit(1);
    } finally {
        await client.close();
    }
}

testConnection();
EOF
        
        if command -v node &> /dev/null; then
            if MONGODB_URI="${TF_VAR_mongodb_uri}" timeout 10 node /tmp/test_mongo.js 2>/dev/null; then
                print_success "MongoDB connectivity verified"
                increment_success
            else
                print_warning "MongoDB connectivity test failed (may be network/auth issue)"
                increment_warning
            fi
        else
            print_warning "Node.js not available for MongoDB connectivity test"
            increment_warning
        fi
        
        rm -f /tmp/test_mongo.js
    else
        print_warning "MongoDB URI not set, skipping connectivity test"
        increment_warning
    fi
    
    # Check OpenAI API connectivity
    if [[ -n "${TF_VAR_openai_api_key}" ]]; then
        print_status "Testing OpenAI API connectivity..."
        
        if curl -s -H "Authorization: Bearer ${TF_VAR_openai_api_key}" \
           "https://api.openai.com/v1/models" | jq -e '.data' &> /dev/null; then
            print_success "OpenAI API connectivity verified"
            increment_success
        else
            print_warning "OpenAI API connectivity test failed (may be invalid key)"
            increment_warning
        fi
    else
        print_warning "OpenAI API key not set, skipping connectivity test"
        increment_warning
    fi
fi

# AWS resource capacity and limits check
print_status "=== AWS RESOURCE CAPACITY CHECK ==="

if [[ -n "$ACCOUNT_ID" ]]; then
    # Check EC2 limits
    print_status "Checking EC2 service limits..."
    
    # Get current instance count
    CURRENT_INSTANCES=$(aws ec2 describe-instances --region "$AWS_REGION" \
        --query 'Reservations[*].Instances[?State.Name==`running`]' \
        --output json | jq '. | flatten | length' 2>/dev/null || echo "0")
    
    print_status "Current running EC2 instances: $CURRENT_INSTANCES"
    
    if [[ $CURRENT_INSTANCES -lt 20 ]]; then
        print_success "EC2 instance capacity available"
        increment_success
    else
        print_warning "High number of EC2 instances, check service limits"
        increment_warning
    fi
    
    # Check VPC limits
    CURRENT_VPCS=$(aws ec2 describe-vpcs --region "$AWS_REGION" \
        --query 'Vpcs | length(@)' --output text 2>/dev/null || echo "0")
    
    print_status "Current VPCs: $CURRENT_VPCS"
    
    if [[ $CURRENT_VPCS -lt 5 ]]; then
        print_success "VPC capacity available"
        increment_success
    else
        print_warning "Multiple VPCs exist, check service limits"
        increment_warning
    fi
fi

# Security configuration validation
print_status "=== SECURITY CONFIGURATION VALIDATION ==="

# Check SSH access configuration
if grep -q "ssh_allowed_ips.*0\.0\.0\.0/0" "$TFVARS_FILE" 2>/dev/null; then
    if [[ "$ENVIRONMENT" == "prod" ]]; then
        print_error "Production environment allows SSH from anywhere (security risk)"
        increment_error
    else
        print_warning "SSH access is open to the world (consider restricting)"
        increment_warning
    fi
else
    print_success "SSH access is properly restricted"
    increment_success
fi

# Check encryption settings for production
if [[ "$ENVIRONMENT" == "prod" ]]; then
    if grep -q "enable_encryption.*true" "$TFVARS_FILE" 2>/dev/null; then
        print_success "Encryption is enabled for production"
        increment_success
    else
        print_error "Encryption should be enabled for production"
        increment_error
    fi
fi

# Check monitoring settings
if [[ "$ENVIRONMENT" == "prod" ]]; then
    if grep -q "enable_monitoring.*true" "$TFVARS_FILE" 2>/dev/null; then
        print_success "Monitoring is enabled for production"
        increment_success
    else
        print_warning "Monitoring should be enabled for production"
        increment_warning
    fi
fi

# Cost estimation
print_status "=== COST ESTIMATION ==="

INSTANCE_TYPE=$(grep "instance_type" "$TFVARS_FILE" | cut -d'"' -f2 2>/dev/null || echo "t3.micro")
ENABLE_ALB=$(grep "enable_load_balancer.*true" "$TFVARS_FILE" &>/dev/null && echo "true" || echo "false")
ENABLE_EIP=$(grep "enable_elastic_ip.*true" "$TFVARS_FILE" &>/dev/null && echo "true" || echo "false")

# Calculate estimated costs
case $INSTANCE_TYPE in
    "t3.micro")
        INSTANCE_COST="8.50"
        ;;
    "t3.small")
        INSTANCE_COST="17.00"
        ;;
    "t3.medium")
        INSTANCE_COST="34.00"
        ;;
    "t3.large")
        INSTANCE_COST="68.00"
        ;;
    *)
        INSTANCE_COST="Variable"
        ;;
esac

ALB_COST=$([ "$ENABLE_ALB" == "true" ] && echo "16.20" || echo "0.00")
EIP_COST=$([ "$ENABLE_EIP" == "true" ] && echo "3.65" || echo "0.00")

if [[ "$INSTANCE_COST" != "Variable" ]]; then
    TOTAL_COST=$(echo "$INSTANCE_COST + $ALB_COST + $EIP_COST + 5.00" | bc 2>/dev/null || echo "Variable")
    print_status "Estimated monthly cost: \$${TOTAL_COST} USD"
    print_status "  - EC2 ($INSTANCE_TYPE): \$${INSTANCE_COST}"
    print_status "  - Load Balancer: \$${ALB_COST}"
    print_status "  - Elastic IP: \$${EIP_COST}"
    print_status "  - Storage/Misc: \$5.00"
else
    print_status "Cost estimation: Variable (custom instance type)"
fi

# Deployment simulation
if [[ "$SIMULATE_DEPLOY" == true && $ERRORS -eq 0 ]]; then
    print_status "=== DEPLOYMENT SIMULATION ==="
    
    # Create temporary backend configuration for simulation
    cat > backend_override.tf << EOF
terraform {
  backend "local" {
    path = "terraform.tfstate.simulation"
  }
}
EOF
    
    print_status "Running Terraform plan simulation..."
    
    # Build terraform plan command
    PLAN_CMD="terraform plan -var-file=\"$TFVARS_FILE\""
    
    # Add environment variables if set
    for var in "${SENSITIVE_VARS[@]}"; do
        if [[ -n "$(eval echo \$TF_VAR_$var)" ]]; then
            PLAN_CMD="$PLAN_CMD -var=\"$var=$(eval echo \$TF_VAR_$var)\""
        fi
    done
    
    PLAN_CMD="$PLAN_CMD -out=tfplan.simulation"
    
    if terraform init &> /dev/null; then
        if eval "$PLAN_CMD" &> /tmp/terraform_plan.log; then
            print_success "Terraform plan simulation successful"
            increment_success
            
            # Parse plan output
            RESOURCES_TO_ADD=$(grep "to be created" /tmp/terraform_plan.log | wc -l || echo "0")
            RESOURCES_TO_CHANGE=$(grep "to be updated" /tmp/terraform_plan.log | wc -l || echo "0")
            RESOURCES_TO_DESTROY=$(grep "to be destroyed" /tmp/terraform_plan.log | wc -l || echo "0")
            
            print_status "Plan summary:"
            print_status "  - Resources to create: $RESOURCES_TO_ADD"
            print_status "  - Resources to update: $RESOURCES_TO_CHANGE"
            print_status "  - Resources to destroy: $RESOURCES_TO_DESTROY"
            
            if [[ "$VERBOSE" == true ]]; then
                print_status "Detailed plan output:"
                cat /tmp/terraform_plan.log | head -50
            fi
            
        else
            print_error "Terraform plan simulation failed"
            if [[ "$VERBOSE" == true ]]; then
                cat /tmp/terraform_plan.log
            fi
            increment_error
        fi
    else
        print_error "Terraform initialization failed for simulation"
        increment_error
    fi
    
    # Cleanup simulation files
    rm -f backend_override.tf tfplan.simulation terraform.tfstate.simulation /tmp/terraform_plan.log
fi

# Application deployment validation
print_status "=== APPLICATION DEPLOYMENT VALIDATION ==="

# Check if backend code exists and is valid
BACKEND_DIR="$TERRAFORM_DIR/../backend"
if [[ -d "$BACKEND_DIR" ]]; then
    print_success "Backend application directory found"
    increment_success
    
    # Check package.json
    if [[ -f "$BACKEND_DIR/package.json" ]]; then
        print_success "package.json found"
        increment_success
        
        # Check for required scripts
        if grep -q '"start"' "$BACKEND_DIR/package.json"; then
            print_success "Start script found in package.json"
            increment_success
        else
            print_warning "Start script not found in package.json"
            increment_warning
        fi
        
        if grep -q '"build"' "$BACKEND_DIR/package.json"; then
            print_success "Build script found in package.json"
            increment_success
        else
            print_warning "Build script not found in package.json"
            increment_warning
        fi
    else
        print_error "package.json not found in backend directory"
        increment_error
    fi
    
    # Check TypeScript configuration
    if [[ -f "$BACKEND_DIR/tsconfig.json" ]]; then
        print_success "TypeScript configuration found"
        increment_success
    else
        print_warning "TypeScript configuration not found"
        increment_warning
    fi
    
    # Check main application file
    if [[ -f "$BACKEND_DIR/src/app.ts" ]]; then
        print_success "Main application file found"
        increment_success
    else
        print_error "Main application file (src/app.ts) not found"
        increment_error
    fi
    
else
    print_error "Backend application directory not found: $BACKEND_DIR"
    increment_error
fi

# GitHub Actions workflow validation
print_status "=== CI/CD PIPELINE VALIDATION ==="

GITHUB_DIR="$TERRAFORM_DIR/../.github/workflows"
if [[ -d "$GITHUB_DIR" ]]; then
    print_success "GitHub Actions workflows directory found"
    increment_success
    
    # Check infrastructure workflow
    if [[ -f "$GITHUB_DIR/infrastructure.yml" ]]; then
        print_success "Infrastructure deployment workflow found"
        increment_success
    else
        print_warning "Infrastructure deployment workflow not found"
        increment_warning
    fi
    
    # Check application workflow
    if [[ -f "$GITHUB_DIR/deploy-application.yml" ]]; then
        print_success "Application deployment workflow found"
        increment_success
    else
        print_warning "Application deployment workflow not found"
        increment_warning
    fi
else
    print_warning "GitHub Actions workflows directory not found"
    increment_warning
fi

# Generate validation report
print_status "=== VALIDATION REPORT ==="

TOTAL_CHECKS=$((CHECKS_PASSED + WARNINGS + ERRORS))
if [[ $TOTAL_CHECKS -gt 0 ]]; then
    SUCCESS_RATE=$((CHECKS_PASSED * 100 / TOTAL_CHECKS))
else
    SUCCESS_RATE=0
fi

echo ""
echo "=========================================="
echo "    DEPLOYMENT VALIDATION REPORT"
echo "=========================================="
echo "Environment: $ENVIRONMENT"
echo "Total Checks: $TOTAL_CHECKS"
echo "Passed: $CHECKS_PASSED"
echo "Warnings: $WARNINGS"
echo "Errors: $ERRORS"
echo "Success Rate: $SUCCESS_RATE%"
echo "=========================================="

# Deployment readiness assessment
if [[ $ERRORS -eq 0 ]]; then
    if [[ $WARNINGS -eq 0 ]]; then
        print_success "🎉 DEPLOYMENT READY: All checks passed!"
        echo "Your infrastructure is ready for AWS deployment."
    else
        print_warning "⚠️  DEPLOYMENT READY WITH WARNINGS: $WARNINGS warnings found"
        echo "Deployment should work, but consider addressing warnings."
    fi
else
    print_error "❌ DEPLOYMENT NOT READY: $ERRORS errors must be fixed"
    echo "Please resolve all errors before attempting deployment."
fi

# Recommendations
if [[ $WARNINGS -gt 0 || $ERRORS -gt 0 ]]; then
    echo ""
    print_status "Recommendations:"
    
    if [[ $ERRORS -gt 0 ]]; then
        echo "  🔴 Critical Issues:"
        echo "    - Fix all configuration errors"
        echo "    - Ensure all required tools are installed"
        echo "    - Verify AWS credentials and permissions"
        echo "    - Check environment variable configuration"
    fi
    
    if [[ $WARNINGS -gt 0 ]]; then
        echo "  🟡 Improvements:"
        echo "    - Address security configuration warnings"
        echo "    - Set up monitoring for production environments"
        echo "    - Configure backup and disaster recovery"
        echo "    - Review cost optimization opportunities"
    fi
fi

# Next steps
echo ""
print_status "Next Steps:"
if [[ $ERRORS -eq 0 ]]; then
    echo "  1. ✅ Configuration validated successfully"
    echo "  2. 🚀 Ready to deploy with: ./scripts/deploy-infrastructure.sh -e $ENVIRONMENT -a apply"
    echo "  3. 📱 Deploy application with: ./scripts/deploy-application.sh -e $ENVIRONMENT -r your-repo -k your-key.pem"
    echo "  4. 🔍 Monitor deployment and verify functionality"
else
    echo "  1. 🔧 Fix all errors identified in this report"
    echo "  2. 🔄 Re-run validation: ./scripts/validate-deployment-local.sh -e $ENVIRONMENT -v"
    echo "  3. 📚 Check documentation: README.md and DEPLOYMENT_GUIDE.md"
    echo "  4. 🆘 Get help: Review troubleshooting section in documentation"
fi

# Exit with appropriate code
if [[ $ERRORS -gt 0 ]]; then
    exit 1
elif [[ $WARNINGS -gt 0 ]]; then
    exit 2
else
    exit 0
fi
