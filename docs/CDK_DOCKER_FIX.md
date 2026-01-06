# Fix CDK Docker Error

## Problem
CDK is trying to use Docker to bundle Lambda functions, but Docker is not installed.

## Solution Options

### Option 1: Install Docker (Recommended for Production)

1. **Download Docker Desktop for Windows:**
   - Go to: https://www.docker.com/products/docker-desktop
   - Download and install Docker Desktop
   - Restart your computer
   - Start Docker Desktop

2. **Verify Docker is running:**
   ```powershell
   docker --version
   ```

3. **Then run CDK commands:**
   ```powershell
   cd backend/infrastructure
   cdk bootstrap
   cdk deploy
   ```

### Option 2: Use Local Bundling (No Docker Required)

The code has been configured to use local bundling with esbuild. However, you need to:

1. **Install esbuild in infrastructure:**
   ```powershell
   cd backend/infrastructure
   npm install esbuild --save-dev
   ```

2. **Set environment variable to skip Docker:**
   ```powershell
   $env:CDK_DOCKER = "false"
   ```

3. **Or use CDK with local bundling:**
   ```powershell
   cdk bootstrap
   cdk deploy
   ```

### Option 3: Pre-build Lambda Functions

Instead of using NodejsFunction (which bundles at deploy time), you can:

1. Build Lambda functions manually:
   ```powershell
   cd backend
   npm install
   npm run build
   ```

2. Use regular `Function` construct with pre-built code (requires changing CDK stack)

## Quick Fix (Try This First)

```powershell
# Install esbuild
cd backend/infrastructure
npm install esbuild --save-dev

# Set environment variable
$env:CDK_DOCKER = "false"

# Try bootstrap again
cdk bootstrap
```

## Why Docker is Needed

CDK's `NodejsFunction` uses Docker to:
- Bundle TypeScript/JavaScript code
- Install dependencies in a Linux environment (Lambda runs on Linux)
- Create optimized deployment packages

## Alternative: Use Docker Desktop

If you prefer to use Docker (recommended for production):

1. Install Docker Desktop from: https://www.docker.com/products/docker-desktop
2. Start Docker Desktop
3. Run `cdk bootstrap` again

Docker will be used automatically when available.
