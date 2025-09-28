# GitHub Actions Build Fix

## Issue
The GitHub Actions deployment is failing during the build step because:

1. The workflow uses `npm ci --production` which excludes devDependencies
2. TypeScript compilation requires type definitions that are in devDependencies
3. Missing `@types/*` packages cause TypeScript compilation to fail

## Root Cause
```yaml
# In .github/workflows/deploy-application.yml
- name: Install dependencies
  run: npm ci --production  # <- This excludes devDependencies
```

## Solution

### Option 1: Fix the Workflow (Recommended)
Change the workflow to install all dependencies for the build step:

```yaml
# Change this:
- name: Install dependencies
  run: npm ci --production

# To this:
- name: Install dependencies
  run: npm ci  # Install all dependencies including devDependencies

# Then for deployment, create production build:
- name: Create production build
  run: |
    npm run build
    npm prune --production  # Remove devDependencies after build
```

### Option 2: Alternative Build Script
Add a production build script that handles dependencies:

```json
{
  "scripts": {
    "build:ci": "npm install && npm run build && npm prune --production"
  }
}
```

Then update the workflow to use:
```yaml
- name: Build for production
  run: npm run build:ci
```

## Files Fixed
- ✅ `tsconfig.json` - Added DOM lib and Node types for proper compilation
- ✅ `package.json` - Added production build script
- ✅ All TypeScript errors resolved locally

## Required Changes
You need to manually edit `.github/workflows/deploy-application.yml`:

1. **Find line ~92** with `npm ci --production`
2. **Change it to** `npm ci` (remove --production)
3. **Commit and push** the change

## Why This Works
- `npm ci` installs ALL dependencies (including devDependencies)
- TypeScript compilation gets the required `@types/*` packages
- Build succeeds and creates the `dist/` folder
- Deployment can proceed normally

## Test Locally
```bash
cd backend
npm ci --production  # This will fail to build
npm run build        # Will show TypeScript errors

npm ci               # This will work
npm run build        # Will succeed
```

The build now works locally with the TypeScript configuration fixes I made.
