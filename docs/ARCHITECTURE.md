# LANGUU Architecture Documentation

## Overview

LANGUU is a serverless, AWS-native translation platform built with a clear separation between frontend and backend.

## Architecture Principles

1. **Serverless-First**: All backend functions are AWS Lambda
2. **Stateless**: No server state, all state in DynamoDB/S3
3. **Scalable**: Auto-scaling Lambda functions
4. **Secure**: IAM least-privilege, encrypted storage
5. **Frontend/Backend Separation**: Clear boundaries, API-only communication

## System Architecture

```
┌─────────────────┐
│   Next.js App   │  (Frontend)
│   (React/TS)    │
└────────┬────────┘
         │ HTTPS
         │ REST API
         ▼
┌─────────────────┐
│  API Gateway    │  (REST API)
└────────┬────────┘
         │
         ├──► Translate Lambda ──► Amazon Translate
         ├──► Transcribe Lambda ──► Amazon Transcribe ──► S3
         ├──► Interpretation Lambda ──► Transcribe Streaming + Translate
         ├──► TTS Lambda ──► Amazon Polly ──► S3
         └──► HITL Lambda ──► DynamoDB ──► Amazon A2I
```

## Components

### Frontend

- **Framework**: Next.js 14 with React 18
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **API Client**: Axios

**Structure**:
- `/src/components` - Reusable UI components
- `/src/pages` - Next.js pages/routes
- `/src/layouts` - Layout components
- `/src/services` - API service layer
- `/src/utils` - Utility functions and constants

### Backend

- **Runtime**: Node.js 20
- **Framework**: AWS Lambda
- **Language**: TypeScript
- **Infrastructure**: AWS CDK

**Structure**:
- `/lambdas` - Lambda function handlers
  - `translate` - Text translation
  - `transcribe` - Audio/video transcription
  - `interpretation` - Real-time interpretation
  - `tts` - Text-to-speech
  - `hitl` - Human-in-the-loop
- `/shared` - Shared utilities and types
- `/infrastructure` - CDK infrastructure code

## AWS Services

### Core Services

1. **Amazon Translate**
   - Text-to-text translation
   - Language detection
   - Supports 75+ languages

2. **Amazon Transcribe**
   - Audio-to-text transcription
   - Video transcription (via audio extraction)
   - Batch and streaming modes

3. **Amazon Polly**
   - Text-to-speech synthesis
   - Neural voices
   - Multiple languages and voices

4. **Amazon Comprehend**
   - Sentiment analysis
   - Entity detection
   - NLP classification for HITL triggers

5. **Amazon A2I (Augmented AI)**
   - Human-in-the-loop workflows
   - Review interfaces
   - Quality assurance

### Infrastructure Services

1. **AWS Lambda**
   - Serverless compute
   - Auto-scaling
   - Pay-per-use

2. **API Gateway**
   - REST API endpoints
   - CORS handling
   - Request/response transformation

3. **Amazon S3**
   - Media file storage
   - Transcription outputs
   - TTS audio files

4. **DynamoDB**
   - Job tracking
   - HITL workflow state
   - Metadata storage

5. **CloudWatch**
   - Logging
   - Monitoring
   - Alarms

## Data Flow

### Translation Flow

1. User enters text in frontend
2. Frontend calls `/translate` API endpoint
3. API Gateway routes to Translate Lambda
4. Lambda calls Amazon Translate
5. Response returned to frontend

### Transcription Flow

1. User uploads audio/video file
2. Frontend uploads to S3 (presigned URL)
3. Frontend calls `/transcribe` API endpoint
4. API Gateway routes to Transcribe Lambda
5. Lambda starts Transcribe job
6. Lambda polls for completion
7. Lambda translates transcript (optional)
8. Response returned to frontend

### Interpretation Flow (Future)

1. User starts interpretation session
2. Frontend establishes WebSocket connection
3. Audio stream sent to Interpretation Lambda
4. Lambda uses Transcribe Streaming
5. Real-time translation via Translate
6. Sentiment analysis via Comprehend
7. Low confidence triggers A2I workflow
8. Results streamed back to frontend

## Security

### IAM Policies

- Least-privilege access
- Service-specific permissions
- No cross-service access unless required

### Data Protection

- S3 encryption at rest
- DynamoDB encryption at rest
- HTTPS for all API calls
- No sensitive data in logs

## Deployment

### Staging

```bash
STAGE=staging cdk deploy --all
```

### Production

```bash
STAGE=production cdk deploy --all
```

## Monitoring

- CloudWatch Logs for all Lambda functions
- CloudWatch Metrics for API Gateway
- Error tracking and alerting
- Performance monitoring

## Future Enhancements

1. WebSocket API for real-time interpretation
2. Cognito authentication
3. Usage analytics
4. Multi-region deployment
5. Caching layer (ElastiCache)
