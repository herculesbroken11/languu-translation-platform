# AWS CLI Configuration Guide

## Step 1: Install AWS CLI

### Windows

**Option A: Using MSI Installer (Recommended)**
1. Download the AWS CLI MSI installer:
   - Go to: https://awscli.amazonaws.com/AWSCLIV2.msi
   - Or search "AWS CLI Windows installer" in your browser

2. Run the installer and follow the prompts

3. Verify installation:
   ```powershell
   aws --version
   ```
   Should show: `aws-cli/2.x.x`

**Option B: Using PowerShell**
```powershell
# Download and install
Invoke-WebRequest -Uri "https://awscli.amazonaws.com/AWSCLIV2.msi" -OutFile "$env:TEMP\AWSCLIV2.msi"
Start-Process msiexec.exe -ArgumentList "/i $env:TEMP\AWSCLIV2.msi /quiet" -Wait
```

### macOS
```bash
brew install awscli
```

### Linux
```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

---

## Step 2: Get AWS Credentials

You need:
- **AWS Access Key ID**
- **AWS Secret Access Key**

### If you already have credentials:
- Use the credentials provided by the client (Hercules user)

### If you need to create new credentials:

1. **Log in to AWS Console**
   - Go to: https://console.aws.amazon.com
   - Sign in with your account

2. **Navigate to IAM**
   - Search for "IAM" in the top search bar
   - Click on "IAM" service

3. **Create Access Key**
   - Click on your username (top right) → "Security credentials"
   - Scroll to "Access keys" section
   - Click "Create access key"
   - Choose use case: "Command Line Interface (CLI)"
   - Click "Next"
   - Add description (optional): "LANGUU Development"
   - Click "Create access key"

4. **Save Credentials**
   - **IMPORTANT**: Copy both:
     - Access key ID
     - Secret access key
   - ⚠️ You won't be able to see the secret key again!
   - Save them securely (password manager, encrypted file)

---

## Step 3: Configure AWS CLI

### Quick Configuration

Run this command:
```powershell
aws configure
```

You'll be prompted for:

1. **AWS Access Key ID**
   ```
   AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
   ```

2. **AWS Secret Access Key**
   ```
   AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

3. **Default region name**
   ```
   Default region name [None]: us-east-1
   ```
   Common regions:
   - `us-east-1` (N. Virginia) - Recommended
   - `us-west-2` (Oregon)
   - `eu-west-1` (Ireland)
   - `ap-southeast-1` (Singapore)

4. **Default output format**
   ```
   Default output format [None]: json
   ```
   Options: `json`, `yaml`, `text`, `table`

### Example Session

```powershell
PS C:\> aws configure
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-east-1
Default output format [None]: json
```

---

## Step 4: Verify Configuration

### Test Your Configuration

```powershell
# Check your identity
aws sts get-caller-identity
```

Expected output:
```json
{
    "UserId": "AIDAEXAMPLE",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/Hercules"
}
```

### Test Access to Services

```powershell
# List S3 buckets (if you have permission)
aws s3 ls

# List Lambda functions (if you have permission)
aws lambda list-functions

# Check your region
aws configure get region
```

---

## Step 5: Configure Multiple Profiles (Optional)

If you need multiple AWS accounts or roles:

### Create Named Profile

```powershell
aws configure --profile staging
aws configure --profile production
```

### Use Named Profile

```powershell
# Use specific profile
aws s3 ls --profile staging

# Set as default
$env:AWS_PROFILE = "staging"
aws s3 ls
```

### List All Profiles

```powershell
aws configure list-profiles
```

---

## Step 6: Configure for CDK

### Set Environment Variables (Optional)

```powershell
# Set default region
$env:AWS_DEFAULT_REGION = "us-east-1"

# Set default profile
$env:AWS_PROFILE = "default"
```

### Verify CDK Can Access AWS

```powershell
# Install CDK CLI (if not already installed)
npm install -g aws-cdk

# Verify CDK can access AWS
cdk bootstrap
```

If successful, you'll see:
```
 ⏳  Bootstrapping environment aws://123456789012/us-east-1...
 ✅  Environment aws://123456789012/us-east-1 bootstrapped
```

---

## Troubleshooting

### Error: "Unable to locate credentials"

**Solution:**
```powershell
# Check if credentials file exists
Test-Path ~\.aws\credentials

# If missing, run configure again
aws configure
```

### Error: "Access Denied" or "Unauthorized"

**Possible causes:**
1. Wrong credentials
2. Insufficient IAM permissions
3. Wrong region

**Solution:**
- Verify credentials: `aws sts get-caller-identity`
- Check IAM permissions in AWS Console
- Verify region: `aws configure get region`

### Error: "aws: command not found"

**Solution:**
- Verify AWS CLI is installed: `aws --version`
- If not found, reinstall AWS CLI
- Restart terminal/PowerShell after installation

### Check Configuration Files

**Location:**
- Windows: `C:\Users\YourUsername\.aws\`
- Files:
  - `credentials` - Your access keys
  - `config` - Region and output format

**View configuration:**
```powershell
# View credentials (be careful - contains secrets!)
cat ~\.aws\credentials

# View config
cat ~\.aws\config
```

---

## Security Best Practices

### ✅ DO:
- Use IAM users with least-privilege permissions
- Rotate access keys regularly
- Use named profiles for different environments
- Store credentials securely (password manager)
- Use temporary credentials when possible (IAM roles)

### ❌ DON'T:
- Commit credentials to Git (they're in `.gitignore`)
- Share credentials via email/chat
- Use root account credentials
- Hardcode credentials in code
- Leave credentials in plain text files

---

## Quick Reference

### Common Commands

```powershell
# Configure AWS CLI
aws configure

# View current configuration
aws configure list

# Change region
aws configure set region us-west-2

# Change output format
aws configure set output table

# Test connection
aws sts get-caller-identity

# List S3 buckets
aws s3 ls

# List Lambda functions
aws lambda list-functions

# Check CDK version
cdk --version
```

### Configuration File Locations

**Windows:**
- Credentials: `C:\Users\YourUsername\.aws\credentials`
- Config: `C:\Users\YourUsername\.aws\config`

**macOS/Linux:**
- Credentials: `~/.aws/credentials`
- Config: `~/.aws/config`

---

## Next Steps

After configuring AWS CLI:

1. **Verify CDK can access AWS:**
   ```powershell
   cd backend/infrastructure
   cdk bootstrap
   ```

2. **Deploy infrastructure:**
   ```powershell
   STAGE=staging cdk deploy
   ```

3. **Check deployment outputs:**
   - API Gateway URL
   - WebSocket API URL
   - S3 bucket name
   - DynamoDB table name

---

## Need Help?

If you encounter issues:

1. **Check AWS CLI version:**
   ```powershell
   aws --version
   ```

2. **Check your identity:**
   ```powershell
   aws sts get-caller-identity
   ```

3. **Check permissions:**
   - Go to AWS Console → IAM → Users → Your User
   - Check attached policies
   - Verify you have necessary permissions

4. **Check region:**
   ```powershell
   aws configure get region
   ```

For more help, see: https://docs.aws.amazon.com/cli/latest/userguide/
