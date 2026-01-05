import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { HITLRequest } from '../../shared/types';
import { awsConfig, resourceNames, dynamoDocClient } from '../../shared/config/aws';

const logger = new Logger({ function: 'hitl' });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }

    const request: HITLRequest = JSON.parse(event.body);

    // Validate request
    if (!request.jobId) {
      return createErrorResponse(400, 'Job ID is required');
    }

    if (!request.feedback) {
      return createErrorResponse(400, 'Feedback is required');
    }

    logger.info('HITL request received', {
      jobId: request.jobId,
      feedbackLength: request.feedback.length,
    });

    // Update job in DynamoDB with human review request
    const updateCommand = new UpdateCommand({
      TableName: resourceNames.dynamoTable,
      Key: {
        jobId: request.jobId,
      },
      UpdateExpression: 'SET #status = :status, #feedback = :feedback, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#feedback': 'feedback',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':status': 'pending_human_review',
        ':feedback': request.feedback,
        ':updatedAt': new Date().toISOString(),
      },
    });

    await dynamoDocClient.send(updateCommand);

    // In production, this would trigger:
    // 1. Amazon A2I workflow
    // 2. Notification to human reviewers
    // 3. Workflow state machine for review process

    logger.info('HITL request processed successfully', { jobId: request.jobId });

    return createSuccessResponse({
      message: 'Human review requested successfully',
      jobId: request.jobId,
    });
  } catch (error) {
    logger.error('HITL request failed', error);
    return createErrorResponse(
      500,
      'Failed to submit for human review. Please try again.',
      error
    );
  }
};
