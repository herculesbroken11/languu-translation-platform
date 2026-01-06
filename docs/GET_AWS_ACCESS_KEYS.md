# How to Get AWS Access Key ID and Secret Access Key

## Step-by-Step Guide

### Step 1: Log in to AWS Console

1. Go to: https://console.aws.amazon.com
2. Or use the client's console URL: https://513158237458.signin.aws.amazon.com/console
3. Sign in with:
   - **User name**: `Hercules`
   - **Password**: `a]tO1W'O`

---

### Step 2: Navigate to IAM (Identity and Access Management)

**Option A: Using Search**
1. In the top search bar, type: `IAM`
2. Click on **"IAM"** service

**Option B: Direct Navigation**
1. Click on **"Services"** (top left)
2. Under **"Security, Identity, & Compliance"**, click **"IAM"**

---

### Step 3: Access Your User's Security Credentials

**Method 1: From IAM Dashboard**
1. In the left sidebar, click **"Users"**
2. Click on your username: **"Hercules"**
3. Click on the **"Security credentials"** tab

**Method 2: Direct Link**
1. Click on your username (top right corner)
2. Click **"Security credentials"**

---

### Step 4: Create Access Key

1. Scroll down to the **"Access keys"** section
2. Click **"Create access key"** button

3. **Choose use case:**
   - Select: **"Command Line Interface (CLI)"**
   - Click **"Next"**

4. **Add description (optional):**
   - Description: `LANGUU Development` or `CLI Access`
   - Click **"Next"**

5. **Review and create:**
   - Review the settings
   - Click **"Create access key"**

---

### Step 5: Save Your Credentials

**⚠️ IMPORTANT: Save these immediately!**

You'll see a screen with:

1. **Access key ID**
   - Example: `AKIAIOSFODNN7EXAMPLE`
   - **Copy this immediately**

2. **Secret access key**
   - Example: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`
   - **Copy this immediately**
   - ⚠️ **You can only see this once!** If you close this page, you'll need to create a new key.

3. **Download credentials (Recommended)**
   - Click **"Download .csv file"** to save both keys
   - Store this file securely (password manager, encrypted folder)

4. Click **"Done"**

---

## Visual Guide

```
AWS Console
├── Search "IAM" → Click IAM
├── Users → Click "Hercules"
├── Security credentials tab
├── Access keys section
├── Create access key
├── Choose: "Command Line Interface (CLI)"
├── Add description (optional)
├── Create access key
└── ⚠️ COPY BOTH KEYS IMMEDIATELY!
```

---

## After Getting Your Keys

### Configure AWS CLI

```powershell
aws configure
```

Enter:
1. **AWS Access Key ID**: Paste the Access Key ID you copied
2. **AWS Secret Access Key**: Paste the Secret Access Key you copied
3. **Default region name**: `us-east-1` (or your preferred region)
4. **Default output format**: `json`

### Verify Configuration

```powershell
aws sts get-caller-identity
```

Should show:
```json
{
    "UserId": "AIDAEXAMPLE",
    "Account": "513158237458",
    "Arn": "arn:aws:iam::513158237458:user/Hercules"
}
```

---

## Security Best Practices

### ✅ DO:
- **Save credentials securely** (password manager, encrypted file)
- **Use for development only** - Don't use in production code
- **Rotate keys regularly** (every 90 days recommended)
- **Delete unused keys**
- **Use IAM roles** in production (instead of access keys)

### ❌ DON'T:
- **Commit keys to Git** (they're in `.gitignore`)
- **Share keys via email/chat**
- **Store in plain text files** (unless encrypted)
- **Use root account keys** (always use IAM user keys)
- **Leave keys in code comments**

---

## Troubleshooting

### "Access Denied" when creating keys

**Possible causes:**
1. Your user doesn't have permission to create access keys
2. You're using a restricted account

**Solution:**
- Contact AWS account administrator
- Request IAM permissions

### "You already have 2 access keys"

**Solution:**
1. Delete an unused access key first
2. Then create a new one
3. Maximum 2 access keys per user

### Can't find "Security credentials" tab

**Solution:**
- Make sure you're viewing your own user (Hercules)
- Not viewing another user or role
- Click on your username in top right → Security credentials

### Lost your Secret Access Key

**Solution:**
- You cannot recover it
- You must create a new access key
- Delete the old one if you're not using it

---

## Managing Access Keys

### View Your Access Keys

1. Go to IAM → Users → Hercules → Security credentials
2. Scroll to "Access keys" section
3. You'll see all your access keys (but not the secret)

### Delete an Access Key

1. Go to IAM → Users → Hercules → Security credentials
2. Find the access key you want to delete
3. Click the **"Delete"** button (trash icon)
4. Confirm deletion

### Deactivate an Access Key (Temporary)

1. Go to IAM → Users → Hercules → Security credentials
2. Find the access key
3. Click **"Make inactive"**
4. Can reactivate later if needed

---

## Alternative: Using AWS Console Directly

If you don't need CLI access, you can:
- Use AWS Console web interface
- No access keys needed
- Just log in with username/password

But for CDK deployment, you **need** access keys for AWS CLI.

---

## Quick Reference

**Where to get keys:**
1. AWS Console → IAM → Users → Your User → Security credentials
2. Access keys section → Create access key

**What you need:**
- Access Key ID (starts with `AKIA...`)
- Secret Access Key (long random string)

**What to do with them:**
```powershell
aws configure
# Enter both keys when prompted
```

**Verify it works:**
```powershell
aws sts get-caller-identity
```

---

## Need Help?

If you encounter issues:
1. Check you're logged in as the correct user (Hercules)
2. Verify you have IAM permissions
3. Try creating the key again
4. Contact AWS account administrator if needed
