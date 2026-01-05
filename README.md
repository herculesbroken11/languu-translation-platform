# LANGUU – AI Translation & Interpretation Platform

A production-grade AI translation, transcription, and interpretation platform built with AWS-native services.

## Project Structure

```
/frontend          # Next.js React frontend
/backend           # AWS Lambda backend functions
/docs              # Documentation
```

## Features

### Current Phase (Phase 1)

1. **Translation**
   - Text-to-text translation
   - Language detection
   - Multiple language support
   - Amazon Translate integration

2. **Transcription**
   - Audio-to-text transcription
   - Video-to-text transcription
   - Automatic translation
   - Amazon Transcribe integration

3. **AI Interpretation (Human Backed)**
   - Real-time interpretation
   - Continuous processing
   - NLP classification
   - Human-in-the-Loop escalation

4. **Text-to-Speech**
   - Multiple voices
   - Neural engine
   - Amazon Polly integration

5. **Human-in-the-Loop**
   - Real-time escalation
   - Post-processing review
   - Amazon A2I integration

## Tech Stack

### Frontend
- Next.js 14
- React 18
- TypeScript
- Tailwind CSS
- Axios

### Backend
- AWS Lambda
- API Gateway
- Amazon Translate
- Amazon Transcribe
- Amazon Polly
- Amazon Comprehend
- Amazon S3
- DynamoDB
- AWS CDK

## Getting Started

### Prerequisites

- Node.js 20+
- AWS CLI configured
- AWS CDK CLI installed (`npm install -g aws-cdk`)

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:3000`

### Backend Setup

```bash
cd backend
npm install
npm run build
```

### Infrastructure Deployment

```bash
cd backend/infrastructure
npm install
cdk bootstrap  # First time only
cdk deploy --all
```

Set the `STAGE` environment variable for staging/production:

```bash
STAGE=staging cdk deploy --all
```

## Environment Variables

### Frontend

Create `.env.local`:

```
NEXT_PUBLIC_API_URL=https://your-api-gateway-url.amazonaws.com
```

### Backend

Set via CDK environment variables or AWS Systems Manager Parameter Store.

## Architecture

- **Serverless-first**: All backend functions are AWS Lambda
- **Stateless**: No server state, all state in DynamoDB/S3
- **Scalable**: Auto-scaling Lambda functions
- **Secure**: IAM least-privilege, encrypted storage

## Development

### Project Structure Rules

- Frontend and backend **must never be mixed**
- Frontend communicates with backend **only via APIs**
- Backend must be stateless and serverless-first

## Deployment

### Staging

```bash
STAGE=staging cdk deploy --all
```

### Production

```bash
STAGE=production cdk deploy --all
```

## Out of Scope (Phase 1)

- Subscriptions
- Payments
- Plans/tiers
- Seat management
- Org billing
- Usage-based pricing

These features are planned for Phase 2.

## License

Proprietary - All rights reserved
