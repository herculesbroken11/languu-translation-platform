# Command Reference - Where to Run Commands

This guide shows exactly where to run each command in your project.

## Project Structure

```
languu-translation-platform/
├── frontend/              # Next.js frontend
├── backend/               # Lambda functions
│   ├── lambdas/          # Lambda function code
│   ├── shared/           # Shared utilities
│   └── infrastructure/   # CDK infrastructure code
└── docs/                 # Documentation
```

---

## Step-by-Step: Where to Run Commands

### 1. Initial Setup (Project Root)

**Location:** `C:\Users\Admin\Documents\Project\2026\Jan\languu-translation-platform\`

```powershell
# You should already be here
pwd
# Should show: C:\Users\Admin\Documents\Project\2026\Jan\languu-translation-platform
```

---

### 2. Configure AWS CLI (Anywhere)

**Location:** Any directory (works globally)

```powershell
# Run from anywhere
aws configure
```

---

### 3. Install CDK CLI (Anywhere - One Time)

**Location:** Any directory (installs globally)

```powershell
# Run from anywhere (one time only)
npm install -g aws-cdk

# Verify installation
cdk --version
```

---

### 4. Frontend Setup

**Location:** `frontend/` directory

```powershell
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Create .env.local (copy from .env.example)
# Then edit with your actual API URLs

# Run development server
npm run dev

# Build for production
npm run build
```

**Full path:** `C:\Users\Admin\Documents\Project\2026\Jan\languu-translation-platform\frontend\`

---

### 5. Backend Lambda Functions Setup

**Location:** `backend/` directory

```powershell
# Navigate to backend
cd backend

# Install dependencies
npm install

# Build TypeScript
npm run build
```

**Full path:** `C:\Users\Admin\Documents\Project\2026\Jan\languu-translation-platform\backend\`

---

### 6. Infrastructure Deployment (CDK)

**Location:** `backend/infrastructure/` directory

```powershell
# Navigate to infrastructure
cd backend/infrastructure

# Install dependencies
npm install

# Bootstrap CDK (first time only)
cdk bootstrap

# Deploy to staging
STAGE=staging cdk deploy

# Or deploy to production
STAGE=production cdk deploy

# View what will be created (without deploying)
cdk synth

# See differences
cdk diff
```

**Full path:** `C:\Users\Admin\Documents\Project\2026\Jan\languu-translation-platform\backend\infrastructure\`

---

## Complete Setup Workflow

### First Time Setup

```powershell
# 1. Start at project root
cd C:\Users\Admin\Documents\Project\2026\Jan\languu-translation-platform

# 2. Configure AWS CLI (from anywhere)
aws configure

# 3. Install CDK globally (from anywhere, one time)
npm install -g aws-cdk

# 4. Setup Frontend
cd frontend
npm install
# Create .env.local with API URLs (after backend is deployed)
cd ..

# 5. Setup Backend
cd backend
npm install
npm run build
cd ..

# 6. Deploy Infrastructure
cd backend/infrastructure
npm install
cdk bootstrap
STAGE=staging cdk deploy
cd ../..
```

---

## Quick Reference: Command Locations

| Command | Location | Purpose |
|---------|----------|---------|
| `aws configure` | Anywhere | Configure AWS credentials |
| `npm install -g aws-cdk` | Anywhere | Install CDK globally |
| `npm install` | `frontend/` | Install frontend dependencies |
| `npm install` | `backend/` | Install backend dependencies |
| `npm install` | `backend/infrastructure/` | Install CDK dependencies |
| `npm run dev` | `frontend/` | Start frontend dev server |
| `npm run build` | `frontend/` | Build frontend for production |
| `npm run build` | `backend/` | Build TypeScript |
| `cdk bootstrap` | `backend/infrastructure/` | Initialize CDK |
| `cdk deploy` | `backend/infrastructure/` | Deploy infrastructure |
| `cdk synth` | `backend/infrastructure/` | Generate CloudFormation |
| `cdk diff` | `backend/infrastructure/` | Show changes |

---

## Visual Guide

```
languu-translation-platform/          ← START HERE (project root)
│
├── frontend/                          ← Run: npm install, npm run dev
│   ├── src/
│   └── package.json
│
├── backend/                           ← Run: npm install, npm run build
│   ├── lambdas/
│   ├── shared/
│   │
│   └── infrastructure/                ← Run: npm install, cdk deploy
│       ├── cdk-stack.ts
│       └── package.json
│
└── docs/
```

---

## Common Mistakes to Avoid

### ❌ Wrong: Running CDK commands from wrong directory
```powershell
# DON'T do this
cd frontend
cdk deploy  # ❌ ERROR: CDK not found here
```

### ✅ Correct: Run CDK from infrastructure directory
```powershell
# DO this
cd backend/infrastructure
cdk deploy  # ✅ Works!
```

### ❌ Wrong: Running npm install in wrong place
```powershell
# DON'T do this
cd languu-translation-platform
npm install  # ❌ Installs in wrong location
```

### ✅ Correct: Run npm install in each subdirectory
```powershell
# DO this
cd frontend
npm install  # ✅ Installs frontend dependencies

cd ../backend
npm install  # ✅ Installs backend dependencies

cd infrastructure
npm install  # ✅ Installs CDK dependencies
```

---

## PowerShell Navigation Tips

```powershell
# Check current directory
pwd
# or
Get-Location

# List files in current directory
ls
# or
Get-ChildItem

# Navigate to project root
cd C:\Users\Admin\Documents\Project\2026\Jan\languu-translation-platform

# Navigate to frontend
cd frontend

# Go back one level
cd ..

# Go to infrastructure
cd backend\infrastructure

# Go to project root from anywhere
cd $env:USERPROFILE\Documents\Project\2026\Jan\languu-translation-platform
```

---

## Example: Complete First-Time Setup

```powershell
# 1. Open PowerShell and navigate to project
cd C:\Users\Admin\Documents\Project\2026\Jan\languu-translation-platform

# 2. Verify you're in the right place
pwd
# Should show: C:\Users\Admin\Documents\Project\2026\Jan\languu-translation-platform

# 3. Configure AWS (from anywhere)
aws configure

# 4. Install CDK (one time, from anywhere)
npm install -g aws-cdk

# 5. Setup Frontend
cd frontend
npm install
cd ..

# 6. Setup Backend
cd backend
npm install
npm run build
cd ..

# 7. Deploy Infrastructure
cd backend\infrastructure
npm install
cdk bootstrap
STAGE=staging cdk deploy

# 8. After deployment, get API URLs from output
# Then go back to frontend and create .env.local
cd ..\..\frontend
# Create .env.local with API URLs
# Then run:
npm run dev
```

---

## Troubleshooting

### "Command not found" errors

**If `aws` not found:**
- AWS CLI not installed
- Restart PowerShell after installation

**If `cdk` not found:**
- CDK not installed globally
- Run: `npm install -g aws-cdk`
- Restart PowerShell

**If `npm` not found:**
- Node.js not installed
- Install from: https://nodejs.org/

### "Cannot find module" errors

**Solution:** Make sure you're in the correct directory and run `npm install` there.

```powershell
# Check you're in the right place
pwd

# Install dependencies
npm install
```

---

## Summary

**Most Important:**
- **Frontend commands** → Run in `frontend/` directory
- **Backend commands** → Run in `backend/` directory  
- **CDK commands** → Run in `backend/infrastructure/` directory
- **AWS CLI** → Run from anywhere
- **CDK CLI install** → Run from anywhere (one time)

**Remember:** Always check your current directory with `pwd` before running commands!
