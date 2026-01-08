import { APIGatewayProxyWebsocketEventV2, Context } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { connectHandler, disconnectHandler, messageHandler } from './streaming';

const endpoint = process.env.WEBSOCKET_API_ENDPOINT || '';
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: endpoint.replace('wss://', 'https://').replace('ws://', 'http://'),
});

export const handler = async (
  event: APIGatewayProxyWebsocketEventV2,
  context: Context
): Promise<{ statusCode: number; body?: string }> => {
  // CRITICAL: Log at the very start to ensure we can see if Lambda is invoked
  console.log('=== WebSocket Handler Invoked ===');
  console.log('Route Key:', event.requestContext.routeKey);
  console.log('Connection ID:', event.requestContext.connectionId);
  console.log('Request ID:', context.requestId);
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const routeKey = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId!;

  try {
    console.log(`Processing route: ${routeKey} for connection: ${connectionId}`);
    
    switch (routeKey) {
      case '$connect':
        console.log('Handling $connect');
        return await connectHandler(event, context);
      
      case '$disconnect':
        console.log('Handling $disconnect');
        return await disconnectHandler(event, context);
      
      case '$default':
        console.log('Handling $default (message)');
        return await messageHandler(event, context);
      
      default:
        console.log(`Unknown route: ${routeKey}`);
        return { statusCode: 404, body: JSON.stringify({ error: 'Route not found' }) };
    }
  } catch (error) {
    console.error('=== WebSocket handler error ===');
    console.error('Error:', error);
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace');
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};

// Helper function to send message to WebSocket connection
export async function sendToConnection(connectionId: string, data: any) {
  try {
    await apiGatewayClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(data),
    }));
  } catch (error) {
    console.error('Failed to send message to connection', error);
    throw error;
  }
}
