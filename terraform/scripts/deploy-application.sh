#!/bin/bash
# Application Deployment Script for Book Review Platform
# This script deploys the Node.js application to the provisioned infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT=""
GITHUB_REPO=""
GITHUB_BRANCH="main"
TERRAFORM_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_KEY=""
SKIP_BUILD=false
ROLLBACK=false

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

Deploy Node.js application to Book Review Platform infrastructure

OPTIONS:
    -e, --environment ENV    Environment to deploy to (dev, staging, prod)
    -r, --repo REPO         GitHub repository (owner/repo)
    -b, --branch BRANCH     Git branch to deploy (default: main)
    -k, --ssh-key PATH      Path to SSH private key
    -s, --skip-build        Skip npm build step
    --rollback              Rollback to previous deployment
    -h, --help              Show this help message

EXAMPLES:
    $0 -e dev -r myuser/be-review-platform -k ~/.ssh/my-key.pem
    $0 -e staging -r myuser/be-review-platform -b develop
    $0 -e prod -r myuser/be-review-platform --rollback

PREREQUISITES:
    - Infrastructure must be deployed using deploy-infrastructure.sh
    - SSH key must be configured for EC2 access
    - GitHub repository must be accessible
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--repo)
            GITHUB_REPO="$2"
            shift 2
            ;;
        -b|--branch)
            GITHUB_BRANCH="$2"
            shift 2
            ;;
        -k|--ssh-key)
            SSH_KEY="$2"
            shift 2
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
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

if [[ "$ROLLBACK" != true && -z "$GITHUB_REPO" ]]; then
    print_error "GitHub repository is required for deployment. Use -r or --repo"
    show_usage
    exit 1
fi

# Environment-specific configurations
ENV_DIR="$TERRAFORM_DIR/environments/$ENVIRONMENT"
OUTPUTS_FILE="$ENV_DIR/terraform-outputs.json"

print_status "Starting application deployment for $ENVIRONMENT environment"

# Check if Terraform outputs exist
if [[ ! -f "$OUTPUTS_FILE" ]]; then
    print_error "Terraform outputs file not found: $OUTPUTS_FILE"
    print_error "Please run deploy-infrastructure.sh first"
    exit 1
fi

# Extract instance information from Terraform outputs
if ! command -v jq &> /dev/null; then
    print_error "jq is required but not installed. Please install jq first."
    exit 1
fi

INSTANCE_IP=$(jq -r '.instance_public_ip.value' "$OUTPUTS_FILE" 2>/dev/null || echo "")
SSH_USER="ec2-user"
APP_DIR="/opt/book-review-api"

if [[ -z "$INSTANCE_IP" || "$INSTANCE_IP" == "null" ]]; then
    print_error "Could not get instance IP from Terraform outputs"
    exit 1
fi

print_status "Target instance: $INSTANCE_IP"
print_status "SSH user: $SSH_USER"
print_status "Application directory: $APP_DIR"

# Build SSH command
SSH_CMD="ssh"
if [[ -n "$SSH_KEY" ]]; then
    if [[ ! -f "$SSH_KEY" ]]; then
        print_error "SSH key file not found: $SSH_KEY"
        exit 1
    fi
    SSH_CMD="$SSH_CMD -i $SSH_KEY"
fi
SSH_CMD="$SSH_CMD -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
SSH_CMD="$SSH_CMD $SSH_USER@$INSTANCE_IP"

# Test SSH connection
print_status "Testing SSH connection..."
if ! $SSH_CMD "echo 'SSH connection successful'" &>/dev/null; then
    print_error "Cannot connect to instance via SSH"
    print_error "Please check:"
    print_error "  - Instance is running and accessible"
    print_error "  - SSH key is correct and has proper permissions"
    print_error "  - Security groups allow SSH access from your IP"
    exit 1
fi

print_success "SSH connection established"

# Function to execute remote commands
execute_remote() {
    local command="$1"
    local description="$2"
    
    if [[ -n "$description" ]]; then
        print_status "$description"
    fi
    
    if ! $SSH_CMD "$command"; then
        print_error "Failed to execute: $command"
        return 1
    fi
}

# Function to copy files to remote
copy_to_remote() {
    local local_path="$1"
    local remote_path="$2"
    local description="$3"
    
    if [[ -n "$description" ]]; then
        print_status "$description"
    fi
    
    local SCP_CMD="scp"
    if [[ -n "$SSH_KEY" ]]; then
        SCP_CMD="$SCP_CMD -i $SSH_KEY"
    fi
    SCP_CMD="$SCP_CMD -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
    
    if ! $SCP_CMD "$local_path" "$SSH_USER@$INSTANCE_IP:$remote_path"; then
        print_error "Failed to copy $local_path to $remote_path"
        return 1
    fi
}

# Rollback function
perform_rollback() {
    print_status "Performing rollback..."
    
    execute_remote "
        cd $APP_DIR
        if [[ -d backup_previous ]]; then
            sudo systemctl stop book-review-api || true
            pm2 stop book-review-api || true
            
            # Backup current version
            if [[ -d current ]]; then
                rm -rf backup_current
                mv current backup_current
            fi
            
            # Restore previous version
            mv backup_previous current
            cd current
            
            # Restart application
            pm2 start ecosystem.config.js --env production
            sudo systemctl start book-review-api
            
            echo 'Rollback completed'
        else
            echo 'No previous version available for rollback'
            exit 1
        fi
    " "Rolling back to previous version"
    
    if [[ $? -eq 0 ]]; then
        print_success "Rollback completed successfully"
    else
        print_error "Rollback failed"
        exit 1
    fi
}

# Main deployment function
perform_deployment() {
    print_status "Starting deployment process..."
    
    # Create backup of current deployment
    execute_remote "
        cd $APP_DIR
        if [[ -d current ]]; then
            rm -rf backup_previous
            cp -r current backup_previous
            echo 'Current deployment backed up'
        fi
    " "Backing up current deployment"
    
    # Clone/update repository
    execute_remote "
        cd $APP_DIR
        if [[ -d temp_deploy ]]; then
            rm -rf temp_deploy
        fi
        
        git clone https://github.com/$GITHUB_REPO.git temp_deploy
        cd temp_deploy
        git checkout $GITHUB_BRANCH
        
        echo 'Repository cloned successfully'
    " "Cloning repository from GitHub"
    
    # Install dependencies and build
    if [[ "$SKIP_BUILD" != true ]]; then
        execute_remote "
            cd $APP_DIR/temp_deploy/backend
            
            # Install dependencies
            npm ci --production
            
            # Build application
            if grep -q '\"build\"' package.json; then
                npm run build
                echo 'Application built successfully'
            else
                echo 'No build script found, skipping build'
            fi
        " "Installing dependencies and building application"
    else
        print_status "Skipping build step as requested"
    fi
    
    # Stop current application
    execute_remote "
        sudo systemctl stop book-review-api || true
        pm2 stop book-review-api || true
        echo 'Application stopped'
    " "Stopping current application"
    
    # Deploy new version
    execute_remote "
        cd $APP_DIR
        
        # Remove old current deployment
        if [[ -d current ]]; then
            rm -rf current
        fi
        
        # Move new deployment to current
        mv temp_deploy/backend current
        cd current
        
        # Copy environment file
        if [[ -f ../.env ]]; then
            cp ../.env .env
        fi
        
        # Set proper permissions
        chown -R appuser:appuser .
        
        echo 'New version deployed'
    " "Deploying new version"
    
    # Start application
    execute_remote "
        cd $APP_DIR/current
        
        # Start with PM2
        pm2 start ecosystem.config.js --env production
        
        # Start systemd service
        sudo systemctl start book-review-api
        
        # Wait for application to start
        sleep 10
        
        echo 'Application started'
    " "Starting application"
    
    # Health check
    print_status "Performing health check..."
    sleep 15  # Give the application more time to start
    
    local health_check_passed=false
    for i in {1..5}; do
        if execute_remote "curl -f -s http://localhost:5000/health > /dev/null" "Health check attempt $i"; then
            health_check_passed=true
            break
        fi
        sleep 10
    done
    
    if [[ "$health_check_passed" == true ]]; then
        print_success "Health check passed"
        
        # Clean up old backup
        execute_remote "
            cd $APP_DIR
            if [[ -d backup_previous && -d backup_current ]]; then
                rm -rf backup_current
            fi
        " "Cleaning up old backups"
        
    else
        print_error "Health check failed. Rolling back..."
        perform_rollback
        exit 1
    fi
}

# Main execution
if [[ "$ROLLBACK" == true ]]; then
    perform_rollback
else
    perform_deployment
fi

# Final status check
print_status "Checking final application status..."
execute_remote "
    echo '=== PM2 Status ==='
    pm2 list
    
    echo '=== Service Status ==='
    sudo systemctl status book-review-api --no-pager -l
    
    echo '=== Application Logs (last 10 lines) ==='
    tail -n 10 /var/log/book-review-api/combined.log || echo 'No logs available yet'
    
    echo '=== Disk Usage ==='
    df -h $APP_DIR
" "Final status check"

# Show deployment summary
print_success "Deployment completed successfully!"
print_status "Deployment Summary:"
echo "  Environment: $ENVIRONMENT"
echo "  Repository: $GITHUB_REPO"
echo "  Branch: $GITHUB_BRANCH"
echo "  Instance IP: $INSTANCE_IP"
echo "  Application URL: http://$INSTANCE_IP:5000"
echo "  Health Check URL: http://$INSTANCE_IP:5000/health"

print_status "Next steps:"
echo "  1. Test the application: curl http://$INSTANCE_IP:5000/health"
echo "  2. Check application logs: $SSH_CMD 'tail -f /var/log/book-review-api/combined.log'"
echo "  3. Monitor application: $SSH_CMD 'pm2 monit'"

if [[ "$ENVIRONMENT" == "prod" ]]; then
    print_warning "Production deployment completed. Please:"
    echo "  - Perform thorough testing of all functionality"
    echo "  - Monitor application metrics and error rates"
    echo "  - Verify database connectivity and performance"
    echo "  - Check external API integrations (OpenAI)"
fi
