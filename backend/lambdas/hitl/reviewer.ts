import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { dynamoDocClient, resourceNames } from '../../shared/config/aws';
import { sendToConnection } from '../interpretation/websocket-handler';

const logger = new Logger({ function: 'hitl-reviewer' });

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return createCorsResponse();
  }

  try {
    const path = event.path || '';
    const method = event.httpMethod;

    // Get pending reviews
    if (method === 'GET' && path.includes('/pending')) {
      return await getPendingReviews();
    }

    // Submit review
    if (method === 'POST' && path.includes('/submit')) {
      return await submitReview(event);
    }

    // Get review by ID
    if (method === 'GET' && path.includes('/review/')) {
      const segmentId = path.split('/review/')[1];
      return await getReview(segmentId);
    }

    return createErrorResponse(404, 'Endpoint not found');
  } catch (error) {
    logger.error('HITL reviewer handler failed', error);
    return createErrorResponse(500, 'Internal server error', error);
  }
};

async function getPendingReviews(): Promise<APIGatewayProxyResult> {
  try {
    // Query all pending HITL tasks
    // Note: This requires a GSI on status field for production
    // For now, we'll query by prefix and filter
    const queryCommand = new QueryCommand({
      TableName: resourceNames.dynamoTable,
      KeyConditionExpression: 'begins_with(pk, :prefix)',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':prefix': 'HITL#',
        ':status': 'pending',
      },
      Limit: 50,
      ScanIndexForward: false, // Most recent first
    });

    const result = await dynamoDocClient.send(queryCommand);

    return createSuccessResponse({
      reviews: result.Items || [],
      count: result.Items?.length || 0,
    });
  } catch (error) {
    logger.error('Failed to get pending reviews', error);
    return createErrorResponse(500, 'Failed to fetch pending reviews', error);
  }
}

async function submitReview(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return createErrorResponse(400, 'Request body is required');
    }

    const { segmentId, approvedText, reviewerId, feedback } = JSON.parse(event.body);

    if (!segmentId) {
      return createErrorResponse(400, 'Segment ID is required');
    }

    if (!approvedText) {
      return createErrorResponse(400, 'Approved text is required');
    }

    // Update HITL task
    const updateCommand = new UpdateCommand({
      TableName: resourceNames.dynamoTable,
      Key: {
        pk: `HITL#${segmentId}`,
        sk: 'TASK',
      },
      UpdateExpression: 'SET #status = :status, #approvedText = :approvedText, #reviewerId = :reviewerId, #reviewedAt = :reviewedAt, #feedback = :feedback',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#approvedText': 'approvedText',
        '#reviewerId': 'reviewerId',
        '#reviewedAt': 'reviewedAt',
        '#feedback': 'feedback',
      },
      ExpressionAttributeValues: {
        ':status': 'reviewed',
        ':approvedText': approvedText,
        ':reviewerId': reviewerId || 'anonymous',
        ':reviewedAt': new Date().toISOString(),
        ':feedback': feedback || '',
      },
      ReturnValues: 'ALL_NEW',
    });

    const updateResult = await dynamoDocClient.send(updateCommand);
    const task = updateResult.Attributes;

    if (!task) {
      return createErrorResponse(404, 'Review task not found');
    }

    // Update the original segment
    const sessionId = task.sessionId;
    if (sessionId) {
      const segmentUpdateCommand = new UpdateCommand({
        TableName: resourceNames.dynamoTable,
        Key: {
          pk: `SESSION#${sessionId}`,
          sk: `SEGMENT#${segmentId}`,
        },
        UpdateExpression: 'SET #translatedText = :approvedText, #status = :status, #reviewedBy = :reviewerId',
        ExpressionAttributeNames: {
          '#translatedText': 'translatedText',
          '#status': 'status',
          '#reviewedBy': 'reviewedBy',
        },
        ExpressionAttributeValues: {
          ':approvedText': approvedText,
          ':status': 'approved',
          ':reviewerId': reviewerId || 'anonymous',
        },
      });

      await dynamoDocClient.send(segmentUpdateCommand);

      // Send real-time update to active session (if connection exists)
      // In production, you'd look up the connection ID from the session
      // and send via WebSocket
      try {
        // This would be: await sendToConnection(connectionId, { ... });
        logger.info('Review submitted, would send WebSocket update', { segmentId, sessionId });
      } catch (error) {
        logger.warn('Failed to send WebSocket update', { error });
        // Don't fail the request if WebSocket fails
      }
    }

    return createSuccessResponse({
      message: 'Review submitted successfully',
      segmentId,
      approvedText,
    });
  } catch (error) {
    logger.error('Failed to submit review', error);
    return createErrorResponse(500, 'Failed to submit review', error);
  }
}

async function getReview(segmentId: string): Promise<APIGatewayProxyResult> {
  try {
    const queryCommand = new QueryCommand({
      TableName: resourceNames.dynamoTable,
      KeyConditionExpression: 'pk = :pk AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': `HITL#${segmentId}`,
        ':sk': 'TASK',
      },
    });

    const result = await dynamoDocClient.send(queryCommand);

    if (!result.Items || result.Items.length === 0) {
      return createErrorResponse(404, 'Review not found');
    }

    return createSuccessResponse(result.Items[0]);
  } catch (error) {
    logger.error('Failed to get review', error);
    return createErrorResponse(500, 'Failed to fetch review', error);
  }
}
