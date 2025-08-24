# Book Review Platform - Deployment Guide

This guide provides step-by-step instructions for deploying the Book Review Platform infrastructure and application to AWS.

## 📋 Prerequisites Checklist

Before starting the deployment, ensure you have completed all prerequisites:

### ✅ Required Accounts and Services

- [ ] AWS Account with billing enabled
- [ ] MongoDB Atlas account with M0 cluster created
- [ ] OpenAI API account with API key
- [ ] GitHub repository with your code

### ✅ Local Development Environment

- [ ] Terraform installed (>= 1.0.0)
- [ ] AWS CLI installed and configured
- [ ] jq installed for JSON processing
- [ ] SSH key pair created for EC2 access
- [ ] Git configured with your repository

### ✅ AWS Configuration

- [ ] AWS credentials configured (`aws configure`)
- [ ] IAM user has required permissions
- [ ] EC2 key pair created in target region
- [ ] Default VPC and security groups available

## 🚀 Step-by-Step Deployment

### Step 1: Environment Setup

1. **Clone the repository and navigate to terraform directory**
   ```bash
   git clone https://github.com/your-username/be-review-platform.git
   cd be-review-platform/terraform
   ```

2. **Create environment configuration**
   ```bash
   # Copy the example configuration
   cp environments/dev/terraform.tfvars environments/dev/terraform.tfvars.backup
   
   # Edit the configuration file
   nano environments/dev/terraform.tfvars
   ```

3. **Update terraform.tfvars for development**
   ```hcl
   # Required configurations
   environment = "dev"
   aws_region  = "us-east-1"
   
   # EC2 Configuration
   instance_type = "t3.micro"
   key_pair_name = "your-ec2-key-pair-name"  # Replace with your key pair
   
   # Security Configuration
   ssh_allowed_ips = ["YOUR_IP_ADDRESS/32"]  # Replace with your IP
   
   # Application Configuration (set via environment variables instead)
   # mongodb_uri    = "your-mongodb-connection-string"
   # jwt_secret     = "your-jwt-secret"
   # openai_api_key = "your-openai-api-key"
   ```

4. **Set environment variables for sensitive data**
   ```bash
   # Create a .env file (DO NOT commit this)
   cat > .env << EOF
   export TF_VAR_mongodb_uri="mongodb+srv://username:password@cluster.mongodb.net/bookreviews_dev"
   export TF_VAR_jwt_secret="your-super-secret-jwt-key-at-least-32-characters"
   export TF_VAR_openai_api_key="sk-your-openai-api-key"
   EOF
   
   # Load environment variables
   source .env
   ```

### Step 2: Validation

1. **Run local validation**
   ```bash
   ./scripts/validate-local.sh -e dev -v
   ```

2. **Fix any issues found**
   ```bash
   # Fix formatting issues automatically
   ./scripts/validate-local.sh -e dev -f
   ```

3. **Verify AWS connectivity**
   ```bash
   aws sts get-caller-identity
   aws ec2 describe-regions --region us-east-1
   ```

### Step 3: Infrastructure Deployment

1. **Plan the deployment**
   ```bash
   ./scripts/deploy-infrastructure.sh -e dev -a plan
   ```

2. **Review the plan output carefully**
   - Check resource counts
   - Verify no unexpected deletions
   - Confirm estimated costs

3. **Apply the infrastructure**
   ```bash
   ./scripts/deploy-infrastructure.sh -e dev -a apply
   ```

4. **Wait for deployment completion (5-10 minutes)**
   - EC2 instance creation
   - User data script execution
   - Service initialization

5. **Verify infrastructure deployment**
   ```bash
   # Check Terraform outputs
   cd terraform
   terraform output
   
   # Test SSH connectivity
   ssh -i ~/.ssh/your-key.pem ec2-user@$(terraform output -raw instance_public_ip)
   ```

### Step 4: Application Deployment

1. **Deploy the application code**
   ```bash
   ./scripts/deploy-application.sh \
     -e dev \
     -r your-username/be-review-platform \
     -b main \
     -k ~/.ssh/your-key.pem
   ```

2. **Monitor deployment progress**
   - The script will show real-time progress
   - Wait for health checks to pass
   - Deployment typically takes 3-5 minutes

3. **Verify application deployment**
   ```bash
   # Get instance IP
   INSTANCE_IP=$(cd terraform && terraform output -raw instance_public_ip)
   
   # Test health endpoint
   curl http://$INSTANCE_IP:5000/health
   
   # Test API endpoints
   curl http://$INSTANCE_IP:5000/api/v1/books
   ```

### Step 5: Post-Deployment Verification

1. **Check all services are running**
   ```bash
   ssh -i ~/.ssh/your-key.pem ec2-user@$INSTANCE_IP << 'EOF'
   # Check PM2 status
   pm2 list
   
   # Check systemd service
   sudo systemctl status book-review-api
   
   # Check Nginx status
   sudo systemctl status nginx
   
   # Check application logs
   tail -n 20 /var/log/book-review-api/combined.log
   EOF
   ```

2. **Test API functionality**
   ```bash
   # Health check
   curl -f http://$INSTANCE_IP:5000/health
   
   # Books endpoint
   curl -f http://$INSTANCE_IP:5000/api/v1/books
   
   # Test with verbose output
   curl -v http://$INSTANCE_IP:5000/api/v1/books | jq .
   ```

3. **Monitor resource usage**
   ```bash
   ssh -i ~/.ssh/your-key.pem ec2-user@$INSTANCE_IP << 'EOF'
   # Check system resources
   htop -n 1
   df -h
   free -h
   
   # Check application metrics
   pm2 monit
   EOF
   ```

## 🔄 Staging and Production Deployment

### Staging Environment

1. **Update staging configuration**
   ```bash
   # Edit staging configuration
   nano environments/staging/terraform.tfvars
   
   # Set staging environment variables
   export TF_VAR_mongodb_uri="mongodb+srv://username:password@cluster.mongodb.net/bookreviews_staging"
   export TF_VAR_jwt_secret="your-staging-jwt-secret"
   ```

2. **Deploy staging infrastructure**
   ```bash
   ./scripts/deploy-infrastructure.sh -e staging -a apply
   ```

3. **Deploy staging application**
   ```bash
   ./scripts/deploy-application.sh -e staging -r your-username/be-review-platform -k ~/.ssh/your-key.pem
   ```

### Production Environment

1. **Update production configuration**
   ```bash
   # Edit production configuration
   nano environments/prod/terraform.tfvars
   
   # Set production environment variables
   export TF_VAR_mongodb_uri="mongodb+srv://username:password@cluster.mongodb.net/bookreviews_prod"
   export TF_VAR_jwt_secret="your-production-jwt-secret-very-secure"
   ```

2. **Deploy production infrastructure**
   ```bash
   ./scripts/deploy-infrastructure.sh -e prod -a apply
   ```

3. **Deploy production application**
   ```bash
   ./scripts/deploy-application.sh -e prod -r your-username/be-review-platform -k ~/.ssh/your-key.pem
   ```

## 🔧 Troubleshooting Common Issues

### Issue 1: Terraform Init Fails

**Symptoms:**
```
Error: Failed to install provider
```

**Solution:**
```bash
# Clear Terraform cache
rm -rf .terraform .terraform.lock.hcl

# Reinitialize
terraform init
```

### Issue 2: SSH Connection Refused

**Symptoms:**
```
ssh: connect to host X.X.X.X port 22: Connection refused
```

**Solutions:**
```bash
# Check security group allows your IP
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx

# Verify instance is running
aws ec2 describe-instances --instance-ids i-xxxxxxxxx

# Check user data script completion
aws ec2 get-console-output --instance-id i-xxxxxxxxx
```

### Issue 3: Application Not Starting

**Symptoms:**
```
curl: (7) Failed to connect to X.X.X.X port 5000: Connection refused
```

**Solutions:**
```bash
# SSH to instance and check logs
ssh -i ~/.ssh/your-key.pem ec2-user@$INSTANCE_IP

# Check PM2 status
pm2 list
pm2 logs book-review-api

# Check system service
sudo systemctl status book-review-api
sudo journalctl -u book-review-api -f

# Check application logs
tail -f /var/log/book-review-api/error.log
```

### Issue 4: Database Connection Issues

**Symptoms:**
```
MongooseError: Could not connect to MongoDB
```

**Solutions:**
```bash
# Verify MongoDB URI is correct
echo $TF_VAR_mongodb_uri

# Test connection from instance
ssh -i ~/.ssh/your-key.pem ec2-user@$INSTANCE_IP
node -e "
const mongoose = require('mongoose');
mongoose.connect('$TF_VAR_mongodb_uri')
  .then(() => console.log('Connected'))
  .catch(err => console.error('Error:', err));
"

# Check MongoDB Atlas network access
# Ensure 0.0.0.0/0 is allowed or add instance IP
```

### Issue 5: OpenAI API Issues

**Symptoms:**
```
OpenAI API Error: Invalid API key
```

**Solutions:**
```bash
# Verify API key is set
echo $TF_VAR_openai_api_key

# Test API key
curl -H "Authorization: Bearer $TF_VAR_openai_api_key" \
  https://api.openai.com/v1/models

# Check application environment
ssh -i ~/.ssh/your-key.pem ec2-user@$INSTANCE_IP
cat /opt/book-review-api/.env | grep OPENAI
```

## 📊 Monitoring and Maintenance

### Daily Monitoring

1. **Check application health**
   ```bash
   curl http://$INSTANCE_IP:5000/health
   ```

2. **Monitor resource usage**
   ```bash
   # CPU and memory
   ssh -i ~/.ssh/your-key.pem ec2-user@$INSTANCE_IP 'top -n 1'
   
   # Disk usage
   ssh -i ~/.ssh/your-key.pem ec2-user@$INSTANCE_IP 'df -h'
   ```

3. **Check logs for errors**
   ```bash
   ssh -i ~/.ssh/your-key.pem ec2-user@$INSTANCE_IP \
     'tail -n 100 /var/log/book-review-api/error.log | grep -i error'
   ```

### Weekly Maintenance

1. **Update system packages**
   ```bash
   ssh -i ~/.ssh/your-key.pem ec2-user@$INSTANCE_IP << 'EOF'
   sudo yum update -y
   sudo systemctl restart book-review-api
   EOF
   ```

2. **Rotate logs**
   ```bash
   ssh -i ~/.ssh/your-key.pem ec2-user@$INSTANCE_IP \
     'sudo logrotate -f /etc/logrotate.d/book-review-api'
   ```

3. **Check backup status**
   ```bash
   aws ec2 describe-snapshots --owner-ids self --query 'Snapshots[?StartTime>=`2024-01-01`]'
   ```

## 🚨 Emergency Procedures

### Application Rollback

```bash
# Rollback to previous version
./scripts/deploy-application.sh -e prod --rollback -k ~/.ssh/your-key.pem
```

### Infrastructure Recovery

```bash
# Create emergency snapshot
aws ec2 create-snapshot --volume-id vol-xxxxxxxxx --description "Emergency backup"

# Launch new instance from snapshot if needed
# (Use AWS Console or create new Terraform configuration)
```

### Database Recovery

```bash
# MongoDB Atlas has automatic backups
# Restore from Atlas dashboard if needed
```

## 📈 Scaling Considerations

### Vertical Scaling (Upgrade Instance)

1. **Update terraform.tfvars**
   ```hcl
   instance_type = "t3.small"  # or t3.medium
   ```

2. **Apply changes**
   ```bash
   ./scripts/deploy-infrastructure.sh -e prod -a apply
   ```

### Horizontal Scaling (Multiple Instances)

1. **Enable auto scaling in terraform.tfvars**
   ```hcl
   enable_auto_scaling = true
   min_instances      = 2
   max_instances      = 5
   ```

2. **Enable load balancer**
   ```hcl
   enable_load_balancer = true
   ```

## 💰 Cost Optimization

### Development Environment
- **Estimated Cost**: $8.50/month
- **Optimization**: Use t3.micro, disable monitoring

### Staging Environment
- **Estimated Cost**: $25/month
- **Optimization**: Use t3.small, basic monitoring

### Production Environment
- **Estimated Cost**: $50/month
- **Optimization**: Right-size based on usage, use reserved instances

### Cost Monitoring

```bash
# Check current costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost
```

## 📞 Support and Resources

### Documentation
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS EC2 User Guide](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)

### Community Support
- [Terraform Community](https://discuss.hashicorp.com/c/terraform-core/)
- [AWS Forums](https://forums.aws.amazon.com/)
- [Node.js Community](https://nodejs.org/en/get-involved/)

### Emergency Contacts
- AWS Support (if you have a support plan)
- MongoDB Atlas Support
- OpenAI Support

---

**Remember**: Always test deployments in development environment first, keep backups, and monitor your applications closely after deployment.
