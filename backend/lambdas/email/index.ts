import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Logger } from '../../shared/utils/logger';
import { createSuccessResponse, createErrorResponse, createCorsResponse } from '../../shared/utils/response';
import { sesClient } from '../../shared/config/aws';

const logger = new Logger({ function: 'email' });

interface EmailRequest {
  to?: string;
  subject: string;
  body: string;
  originalFile?: string;
  transcript?: string;
  translation?: string;
  fileUrl?: string;
}

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

    const request: EmailRequest = JSON.parse(event.body);

    // Validate request (to is optional, will use default)
    if (!request.subject || !request.body) {
      return createErrorResponse(400, 'Subject and body are required');
    }

    // Default recipient is team@languu.com (use provided 'to' or fallback to default)
    const recipientEmail = request.to || process.env.TEAM_EMAIL || 'team@languu.com';

    logger.info('Sending email', {
      to: recipientEmail,
      subject: request.subject,
      hasOriginalFile: !!request.originalFile,
      hasTranscript: !!request.transcript,
      hasTranslation: !!request.translation,
    });

    // Build email body
    let emailBody = request.body;
    
    if (request.originalFile) {
      emailBody += `\n\n--- Original File ---\n${request.originalFile}`;
    }
    
    if (request.fileUrl) {
      emailBody += `\n\n--- File URL ---\n${request.fileUrl}`;
    }
    
    if (request.transcript) {
      emailBody += `\n\n--- Transcript ---\n${request.transcript}`;
    }
    
    if (request.translation) {
      emailBody += `\n\n--- Translation ---\n${request.translation}`;
    }

    // Send email using SES
    const sendEmailCommand = new SendEmailCommand({
      Source: process.env.FROM_EMAIL || 'noreply@languu.com',
      Destination: {
        ToAddresses: [recipientEmail],
      },
      Message: {
        Subject: {
          Data: request.subject,
          Charset: 'UTF-8',
        },
        Body: {
          Text: {
            Data: emailBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    const result = await sesClient.send(sendEmailCommand);

    logger.info('Email sent successfully', {
      messageId: result.MessageId,
    });

    return createSuccessResponse({
      success: true,
      messageId: result.MessageId,
      message: 'Email sent successfully',
    });
  } catch (error) {
    logger.error('Failed to send email', error);
    
    // Handle SES-specific errors
    if (error instanceof Error) {
      if (error.name === 'MessageRejected') {
        return createErrorResponse(400, 'Email was rejected. Please verify the sender email is verified in SES.');
      }
      if (error.name === 'MailFromDomainNotVerifiedException') {
        return createErrorResponse(400, 'Sender domain not verified in SES.');
      }
    }
    
    return createErrorResponse(
      500,
      'Failed to send email. Please try again.',
      error
    );
  }
};
