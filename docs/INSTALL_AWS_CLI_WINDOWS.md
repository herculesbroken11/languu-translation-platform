# Install AWS CLI on Windows - Quick Guide

## Method 1: MSI Installer (Recommended - Easiest)

### Step 1: Download Installer

1. Open your browser and go to:
   ```
   https://awscli.amazonaws.com/AWSCLIV2.msi
   ```

2. Or visit: https://aws.amazon.com/cli/
   - Click "Download the AWS CLI MSI installer for Windows (64-bit)"

### Step 2: Run Installer

1. Double-click the downloaded `AWSCLIV2.msi` file
2. Follow the installation wizard:
   - Click "Next"
   - Accept the license agreement
   - Choose installation location (default is fine)
   - Click "Install"
   - Wait for installation to complete
   - Click "Finish"

### Step 3: Verify Installation

**Close and reopen PowerShell**, then run:

```powershell
aws --version
```

You should see something like:
```
aws-cli/2.15.0 Python/3.11.9 Windows/10 exe/AMD64
```

---

## Method 2: Using PowerShell (Automated)

Run this in PowerShell (as Administrator):

```powershell
# Download installer
Invoke-WebRequest -Uri "https://awscli.amazonaws.com/AWSCLIV2.msi" -OutFile "$env:TEMP\AWSCLIV2.msi"

# Install silently
Start-Process msiexec.exe -ArgumentList "/i $env:TEMP\AWSCLIV2.msi /quiet /norestart" -Wait

# Verify installation (restart PowerShell first)
aws --version
```

**Note:** You may need to restart PowerShell after installation.

---

## Method 3: Using Chocolatey (If you have it)

```powershell
choco install awscli
```

---

## After Installation

### 1. Restart PowerShell

**Important:** Close and reopen PowerShell after installation.

### 2. Verify Installation

```powershell
aws --version
```

### 3. Configure AWS CLI

```powershell
aws configure
```

You'll need:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., `us-east-1`)
- Default output format (e.g., `json`)

---

## Troubleshooting

### "aws: command not found" after installation

**Solution:**
1. Close PowerShell completely
2. Open a new PowerShell window
3. Try `aws --version` again

If still not working:
1. Check if AWS CLI is in PATH:
   ```powershell
   $env:PATH -split ';' | Select-String -Pattern 'aws'
   ```

2. Manually add to PATH (if needed):
   - AWS CLI is usually installed at: `C:\Program Files\Amazon\AWSCLIV2\`
   - Add this to your system PATH environment variable

### Check Installation Location

```powershell
# Find where AWS CLI was installed
Get-Command aws | Select-Object -ExpandProperty Source
```

Should show something like:
```
C:\Program Files\Amazon\AWSCLIV2\aws.exe
```

---

## Quick Test

After installation and configuration:

```powershell
# Test AWS CLI
aws sts get-caller-identity
```

This should show your AWS account information if configured correctly.

---

## Next Steps

Once AWS CLI is installed:

1. **Configure it:**
   ```powershell
   aws configure
   ```

2. **Verify it works:**
   ```powershell
   aws sts get-caller-identity
   ```

3. **Continue with CDK setup:**
   ```powershell
   npm install -g aws-cdk
   cd backend\infrastructure
   npm install
   cdk bootstrap
   ```
