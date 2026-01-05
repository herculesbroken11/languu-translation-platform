# Deployment Guide

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Node.js 20+** installed
4. **AWS CDK CLI** installed globally: `npm install -g aws-cdk`

## Initial Setup

### 1. Configure AWS CLI

```bash
aws configure
```

Enter your AWS Access Key ID, Secret Access Key, region, and output format.

### 2. Bootstrap CDK (First Time Only)

```bash
cd backend/infrastructure
npm install
cdk bootstrap
```

This creates the necessary S3 bucket and IAM roles for CDK deployments.

## Backend Deployment

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Deploy Infrastructure

#### Staging Environment

```bash
cd infrastructure
STAGE=staging cdk deploy --all
```

#### Production Environment

```bash
cd infrastructure
STAGE=production cdk deploy --all
```

### 4. Note API Gateway URL

After deployment, CDK will output the API Gateway URL. Save this for frontend configuration.

Example output:
```
LanguuStack-staging.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod
```

## Frontend Deployment

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Environment Variables

Create `.env.local`:

```env
NEXT_PUBLIC_API_URL=https://your-api-gateway-url.amazonaws.com/prod
```

Replace with your actual API Gateway URL from the backend deployment.

### 3. Development

```bash
npm run dev
```

Frontend will be available at `http://localhost:3000`

### 4. Production Build

```bash
npm run build
npm start
```

### 5. Deploy to Vercel/Netlify (Optional)

1. Connect your repository
2. Set environment variable `NEXT_PUBLIC_API_URL`
3. Deploy

## Verification

### Test Translation

1. Navigate to the Translate page
2. Enter text in the input field
3. Select source and target languages
4. Click "Translate"
5. Verify translated text appears

### Test Transcription

1. Navigate to the Transcribe page
2. Upload an audio file
3. Select languages
4. Click "Transcribe & Translate"
5. Wait for processing
6. Verify transcript and translation appear

## Troubleshooting

### Lambda Function Errors

Check CloudWatch Logs:
```bash
aws logs tail /aws/lambda/languu-staging-translate --follow
```

### API Gateway Issues

1. Check API Gateway console for endpoint configuration
2. Verify CORS settings
3. Check Lambda integration settings

### Frontend API Errors

1. Verify `NEXT_PUBLIC_API_URL` is set correctly
2. Check browser console for CORS errors
3. Verify API Gateway is deployed and accessible

## Rollback

If deployment fails:

```bash
cd backend/infrastructure
STAGE=staging cdk destroy
```

Then redeploy after fixing issues.

## Cost Optimization

### Staging

- Use smaller Lambda memory sizes
- Shorter log retention
- Delete unused resources regularly

### Production

- Right-size Lambda functions
- Enable S3 lifecycle policies
- Use CloudWatch log retention policies
- Monitor and optimize DynamoDB usage
