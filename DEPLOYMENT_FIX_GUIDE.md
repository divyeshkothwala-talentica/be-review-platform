# Deployment Fix Guide - HTTPS Configuration

## Issues Identified and Fixed

### 1. Network Binding Issue ✅ FIXED
**Problem**: The application was binding to `127.0.0.1` (localhost only) instead of `0.0.0.0` (all interfaces).

**Solution**: Updated `backend/src/app.ts` to bind to all interfaces:
```typescript
// Before
this.app.listen(config.port, () => { ... });

// After  
this.app.listen(config.port, '0.0.0.0', () => { ... });
```

### 2. HTTPS Configuration ✅ ADDED
**Problem**: Application needed HTTPS access with self-signed certificate, but no reverse proxy was configured.

**Solution**: Added nginx reverse proxy with SSL termination:
- Nginx proxy on ports 443 and 5000
- Self-signed SSL certificate generation
- Proper CORS headers for CloudFront
- HTTP to HTTPS redirects

### 3. GitHub Actions Workflow ✅ UPDATED
**Problem**: Current deployment workflow had issues with SSM execution and didn't support HTTPS.

**Solution**: Updated workflow `.github/workflows/deploy-main.yml` with:
- HTTPS reverse proxy setup during deployment
- SSL certificate generation
- HTTPS connectivity verification
- Support for both port 443 and 5000
- Proper error handling and logging

### 4. Security Group Configuration ✅ UPDATED
**Problem**: Missing HTTPS ports for secure access.

**Solution**: Updated Terraform configuration to allow:
- Port 443 (Standard HTTPS)
- Port 5000 (Backend API HTTPS)
- Port 80 (HTTP redirects)
- Port 22 (SSH access)

## Deployment Process

### Step 1: Apply Infrastructure Changes
```bash
cd /Users/divyeshk/learning/deployment/scripts
./update-security-group.sh
```

### Step 2: Push Code Changes
The new workflow will trigger automatically when you push to the main branch:

```bash
cd /Users/divyeshk/learning/be-review-platform
git add .
git commit -m "Fix network binding and improve deployment workflow"
git push origin main
```

### Step 3: Monitor Deployment
1. Go to GitHub Actions tab in your repository
2. Watch the "Deploy to Production" workflow
3. The workflow will:
   - Build and test the application
   - Deploy via AWS Systems Manager
   - Verify external connectivity

## Expected Results

After successful deployment:
- ✅ **Primary HTTPS URL**: `https://44.194.207.22` (port 443)
- ✅ **Alternative HTTPS URL**: `https://44.194.207.22:5000`
- ✅ **Health endpoint**: `https://44.194.207.22/health`
- ✅ **API endpoints**: `https://44.194.207.22/api/v1/`
- ✅ **HTTP redirects**: `http://44.194.207.22` → `https://44.194.207.22`

### HTTPS Architecture
```
Browser → HTTPS (443/5000) → Nginx Reverse Proxy → Node.js App (5000)
                ↑
        Self-signed SSL Certificate
```

## Troubleshooting

### If deployment fails:
1. Check GitHub Actions logs for detailed error messages
2. SSH to server and check application logs:
   ```bash
   ssh ec2-user@44.194.207.22
   sudo tail -f /var/log/book-review-api.log
   ```

### If application is not accessible externally:
1. Verify security group allows port 5000
2. Check if application is running:
   ```bash
   ps aux | grep node
   ```
3. Test local connectivity on server:
   ```bash
   curl http://localhost:5000/health
   ```

### Manual deployment (if needed):
```bash
ssh ec2-user@44.194.207.22
cd /opt/book-review-api/current/backend
sudo git pull origin main
sudo npm ci
sudo npm run build
sudo pkill -f "node.*app.js"
cd dist
sudo nohup node app.js > /var/log/book-review-api.log 2>&1 &
```

## Key Improvements

1. **Network Binding**: Application now binds to all interfaces (`0.0.0.0`)
2. **Robust Deployment**: New workflow with better error handling
3. **Connectivity Verification**: Automatic external connectivity testing
4. **Proper Logging**: Centralized logging to `/var/log/book-review-api.log`
5. **Process Management**: Better process cleanup and startup verification

## Next Steps

1. Apply the infrastructure changes using the provided script
2. Push the code changes to trigger the new deployment workflow
3. Monitor the deployment process in GitHub Actions
4. Verify the application is accessible externally

The deployment should now work correctly and the application should be accessible from external connections.
