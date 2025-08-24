# Local AWS Deployment Testing Guide

This guide provides comprehensive methods to validate your AWS deployment locally without actually deploying to AWS. This approach saves costs, reduces risk, and allows for rapid iteration during development.

## 🎯 Overview

Instead of deploying to AWS for testing, you can:
1. **Validate Configuration**: Ensure Terraform configs are correct
2. **Test Deployment Process**: Simulate the deployment workflow
3. **Verify Application**: Test the application in a production-like environment
4. **Check Integration**: Validate external service connectivity
5. **Performance Testing**: Basic load and performance testing

## 🛠️ Available Testing Methods

### 1. Configuration Validation (`validate-deployment-local.sh`)

**Purpose**: Comprehensive validation of Terraform configuration and deployment readiness

**Usage**:
```bash
# Basic validation
./scripts/validate-deployment-local.sh

# Full validation with backend connectivity
./scripts/validate-deployment-local.sh -e dev -v -s -b

# Production validation
./scripts/validate-deployment-local.sh -e prod -v -s
```

**What it checks**:
- ✅ Terraform syntax and configuration
- ✅ AWS credentials and permissions
- ✅ Required tools and dependencies
- ✅ Environment variable configuration
- ✅ Security settings and best practices
- ✅ Cost estimation
- ✅ Backend service connectivity (MongoDB, OpenAI)
- ✅ Deployment simulation (terraform plan)

### 2. Docker-based Deployment Testing (`test-deployment-docker.sh`)

**Purpose**: Simulate AWS EC2 deployment using Docker containers

**Usage**:
```bash
# Test development environment
./scripts/test-deployment-docker.sh

# Test with verbose output
./scripts/test-deployment-docker.sh -e dev -v

# Test staging environment
./scripts/test-deployment-docker.sh -e staging -v

# Clean up Docker resources
./scripts/test-deployment-docker.sh -c
```

**What it simulates**:
- 🐳 EC2 instance with Node.js application
- 🔄 PM2 process management
- 🌐 Nginx reverse proxy
- 📊 Application monitoring
- 🗄️ Local MongoDB (optional)
- 🔍 Health checks and load testing

### 3. Standard Terraform Validation (`validate-local.sh`)

**Purpose**: Basic Terraform configuration validation

**Usage**:
```bash
# Basic validation
./scripts/validate-local.sh

# Validation with auto-fix
./scripts/validate-local.sh -e dev -f -v
```

## 📋 Step-by-Step Local Testing Process

### Step 1: Initial Setup

1. **Setup local environment**:
   ```bash
   cd terraform
   ./scripts/setup-local.sh
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.template .env
   # Edit .env with your actual values
   nano .env
   source .env
   ```

3. **Update terraform variables**:
   ```bash
   # Edit environment-specific configuration
   nano environments/dev/terraform.tfvars
   ```

### Step 2: Configuration Validation

1. **Run comprehensive validation**:
   ```bash
   ./scripts/validate-deployment-local.sh -e dev -v -s -b
   ```

2. **Fix any issues found**:
   - Configuration errors
   - Missing environment variables
   - Security warnings
   - Permission issues

3. **Verify all checks pass**:
   ```bash
   # Should show "DEPLOYMENT READY"
   ./scripts/validate-deployment-local.sh -e dev
   ```

### Step 3: Docker Deployment Testing

1. **Start Docker deployment test**:
   ```bash
   ./scripts/test-deployment-docker.sh -e dev -v
   ```

2. **Test the running application**:
   ```bash
   # Health check
   curl http://localhost:8080/health
   
   # API endpoints
   curl http://localhost:8080/api/v1/books
   
   # Load testing
   for i in {1..10}; do curl -s http://localhost:8080/health & done
   ```

3. **Monitor application**:
   ```bash
   # View logs
   docker logs book-review-app-dev -f
   
   # Check processes
   docker exec book-review-app-dev pm2 monit
   
   # Resource usage
   docker stats book-review-app-dev
   ```

### Step 4: Integration Testing

1. **Test external services**:
   ```bash
   # MongoDB connectivity
   curl http://localhost:8080/api/v1/books
   
   # OpenAI API (if configured)
   curl http://localhost:8080/api/v1/recommendations
   ```

2. **Test application features**:
   ```bash
   # Create test data
   curl -X POST http://localhost:8080/api/v1/books \
     -H "Content-Type: application/json" \
     -d '{"title":"Test Book","author":"Test Author"}'
   
   # Retrieve data
   curl http://localhost:8080/api/v1/books
   ```

### Step 5: Performance Testing

1. **Basic load testing**:
   ```bash
   # Simple concurrent requests
   for i in {1..50}; do
     curl -s -o /dev/null -w "%{http_code},%{time_total}\n" \
       http://localhost:8080/health &
   done | wait
   ```

2. **Memory and CPU monitoring**:
   ```bash
   # Monitor resource usage during load
   docker stats book-review-app-dev --no-stream
   ```

### Step 6: Cleanup

1. **Stop and remove containers**:
   ```bash
   ./scripts/test-deployment-docker.sh -c
   ```

2. **Clean up temporary files**:
   ```bash
   rm -f terraform.tfstate.* tfplan.* backend_override.tf
   ```

## 🔍 Validation Checklist

### Pre-Deployment Validation
- [ ] All required tools installed (Terraform, AWS CLI, Docker, jq)
- [ ] AWS credentials configured and tested
- [ ] Environment variables set correctly
- [ ] Terraform configuration validates successfully
- [ ] Security settings appropriate for environment
- [ ] Cost estimation within budget
- [ ] External services accessible (MongoDB, OpenAI)

### Application Testing
- [ ] Application builds successfully
- [ ] Health endpoint responds correctly
- [ ] API endpoints accessible
- [ ] Database connectivity working
- [ ] Logging configured and working
- [ ] Process management (PM2) functional
- [ ] Reverse proxy (Nginx) working
- [ ] Basic load testing passes

### Integration Testing
- [ ] MongoDB operations successful
- [ ] OpenAI API integration working
- [ ] JWT authentication functional
- [ ] Error handling working correctly
- [ ] Monitoring and alerting configured

## 🚨 Common Issues and Solutions

### Issue 1: Terraform Validation Fails

**Symptoms**:
```
Error: Invalid configuration
```

**Solutions**:
```bash
# Check syntax
terraform validate

# Format code
terraform fmt -recursive

# Check for typos in variable names
grep -r "TF_VAR_" .
```

### Issue 2: AWS Credentials Issues

**Symptoms**:
```
Error: No valid credential sources found
```

**Solutions**:
```bash
# Configure AWS CLI
aws configure

# Test credentials
aws sts get-caller-identity

# Check environment variables
env | grep AWS
```

### Issue 3: Docker Build Fails

**Symptoms**:
```
Error: failed to build application Docker image
```

**Solutions**:
```bash
# Check backend directory exists
ls -la ../backend/

# Verify package.json
cat ../backend/package.json

# Build manually for debugging
cd ../backend && docker build -f Dockerfile.test -t test .
```

### Issue 4: Application Won't Start

**Symptoms**:
```
Application failed to start within timeout
```

**Solutions**:
```bash
# Check container logs
docker logs book-review-app-dev

# Check environment variables
docker exec book-review-app-dev env | grep -E "(NODE_ENV|MONGODB_URI|PORT)"

# Test manually
docker exec -it book-review-app-dev /bin/bash
```

### Issue 5: External Service Connectivity

**Symptoms**:
```
MongoDB connectivity test failed
OpenAI API connectivity test failed
```

**Solutions**:
```bash
# Test MongoDB URI
echo $TF_VAR_mongodb_uri

# Test OpenAI API key
curl -H "Authorization: Bearer $TF_VAR_openai_api_key" \
  https://api.openai.com/v1/models

# Check network connectivity
ping google.com
```

## 📊 Understanding Test Results

### Validation Script Results

**Success (Exit Code 0)**:
```
🎉 DEPLOYMENT READY: All checks passed!
Success Rate: 100%
```

**Warnings (Exit Code 2)**:
```
⚠️ DEPLOYMENT READY WITH WARNINGS: X warnings found
Success Rate: 85%
```

**Errors (Exit Code 1)**:
```
❌ DEPLOYMENT NOT READY: X errors must be fixed
Success Rate: 60%
```

### Docker Test Results

**Healthy Application**:
```
✅ Health check passed
✅ Books API endpoint accessible
✅ Application logs are being generated
✅ PM2 process manager is running application
✅ Load test passed
```

**Application Issues**:
```
❌ Health check failed
⚠️ Books API endpoint test failed
⚠️ Application logs not found
```

## 🎯 Best Practices

### 1. Regular Testing
- Run validation before any configuration changes
- Test after updating dependencies
- Validate before creating pull requests

### 2. Environment Parity
- Test with production-like data volumes
- Use similar resource constraints
- Test with realistic network latency

### 3. Automated Testing
- Integrate validation into CI/CD pipeline
- Run tests on every commit
- Use GitHub Actions for automated validation

### 4. Documentation
- Document any configuration changes
- Keep test results for reference
- Share findings with team members

## 🔄 Integration with CI/CD

### GitHub Actions Integration

The validation scripts integrate with your existing GitHub Actions workflows:

```yaml
# In .github/workflows/validate.yml
- name: Validate Deployment Configuration
  run: |
    cd terraform
    ./scripts/validate-deployment-local.sh -e dev -v -s

- name: Test Docker Deployment
  run: |
    cd terraform
    ./scripts/test-deployment-docker.sh -e dev -v
```

### Pre-commit Hooks

Add validation to pre-commit hooks:

```bash
# .git/hooks/pre-commit
#!/bin/bash
cd terraform
./scripts/validate-deployment-local.sh -e dev
```

## 📈 Performance Benchmarks

### Expected Performance (Local Docker)
- **Startup Time**: < 30 seconds
- **Health Check Response**: < 100ms
- **API Response Time**: < 200ms
- **Memory Usage**: < 512MB
- **CPU Usage**: < 50% under load

### Load Testing Targets
- **Concurrent Requests**: 10-50 requests/second
- **Success Rate**: > 95%
- **Response Time**: < 500ms (95th percentile)
- **Error Rate**: < 1%

## 🎉 Success Criteria

Your local testing is successful when:

1. **Configuration Validation**: All checks pass with 0 errors
2. **Application Deployment**: Docker containers start and run healthy
3. **API Functionality**: All endpoints respond correctly
4. **External Integration**: MongoDB and OpenAI connectivity works
5. **Performance**: Load testing meets targets
6. **Monitoring**: Logs and metrics are generated correctly

## 📞 Getting Help

If you encounter issues:

1. **Check Documentation**: Review README.md and DEPLOYMENT_GUIDE.md
2. **Run Verbose Mode**: Use `-v` flag for detailed output
3. **Check Logs**: Review application and container logs
4. **Validate Step by Step**: Run each validation separately
5. **Clean and Retry**: Clean up and start fresh

---

**Remember**: Local testing validates your configuration and deployment process, giving you confidence that AWS deployment will succeed. This approach saves time, money, and reduces deployment risks.
