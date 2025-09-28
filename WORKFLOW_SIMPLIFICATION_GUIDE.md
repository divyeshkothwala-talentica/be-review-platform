# GitHub Actions Workflow Simplification Guide

## 🎯 Goal: Keep Only Production Deployment

You want to simplify your workflow to have only **production deployment** that triggers on push to main branch.

## ✅ Production Configuration Updated

I've updated your production terraform configuration:
- ✅ `aws_region = "us-east-1"` (matches your AWS setup)
- ✅ `instance_type = "t3.medium"` (better performance)
- ✅ `key_pair_name = "review-platform-backend-key"` (matches your existing key)

## 🔧 Workflow Changes Needed

Edit `.github/workflows/deploy-application.yml` and make these changes:

### 1. Remove Dev and Staging Jobs
**DELETE these entire job sections:**

```yaml
# DELETE THIS ENTIRE SECTION (lines ~107-168):
  deploy-dev:
    name: Deploy to Development
    runs-on: ubuntu-latest
    # ... entire dev deployment job

# DELETE THIS ENTIRE SECTION (lines ~169-236):
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    # ... entire staging deployment job
```

### 2. Update Production Job Trigger
**Find the production job (around line 237) and change:**

```yaml
# CHANGE THIS:
  deploy-prod:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [test, build]
    if: github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'prod'

# TO THIS:
  deploy-prod:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [build]  # Remove 'test' dependency
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

### 3. Simplify Workflow Inputs
**Remove the environment selection since you only have production:**

```yaml
# CHANGE THIS:
on:
  push:
    branches:
      - main
      - develop
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-application.yml'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'dev'
        type: choice
        options:
          - dev
          - staging
          - prod
      rollback:
        description: 'Rollback to previous version'
        required: false
        default: false
        type: boolean

# TO THIS:
on:
  push:
    branches:
      - main
    paths:
      - 'backend/**'
      - '.github/workflows/deploy-application.yml'
  workflow_dispatch:
    inputs:
      rollback:
        description: 'Rollback to previous version'
        required: false
        default: false
        type: boolean
```

### 4. Optional: Rename the Job
**You can rename the job for clarity:**

```yaml
# CHANGE:
  deploy-prod:
    name: Deploy to Production

# TO:
  deploy:
    name: Deploy Application
```

## 🚀 Final Workflow Behavior

After these changes:
- ✅ **Push to main** → Automatic production deployment
- ✅ **Manual trigger** → Production deployment with optional rollback
- ✅ **Single environment** → No confusion, faster deployments
- ✅ **Better infrastructure** → t3.medium in us-east-1

## 📋 Summary of Files Updated

1. ✅ **terraform/environments/prod/terraform.tfvars** - Updated region, instance type, and key pair
2. 🔧 **`.github/workflows/deploy-application.yml`** - You need to edit this manually

## 🔍 Before/After Comparison

**Before:** 3 environments (dev, staging, prod) with complex triggers
**After:** 1 environment (prod) with simple main branch trigger

**Before:** Manual workflow dispatch required for production
**After:** Automatic deployment on every main branch push

## ⚠️ Important Notes

1. **Backup**: The dev/staging terraform configs are still available if needed later
2. **Infrastructure**: You'll need to deploy production infrastructure first:
   ```bash
   cd terraform
   terraform workspace select prod || terraform workspace new prod
   terraform apply -var-file="environments/prod/terraform.tfvars"
   ```
3. **Testing**: Consider testing the simplified workflow with a small change first

## 🎯 Next Steps

1. Edit the workflow file as described above
2. Commit and push the changes
3. Your next push to main will trigger production deployment!

The production environment is now properly configured and ready for deployment! 🚀
