import { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/apigatewaymanagementapi';
import { connectHandler, disconnectHandler, messageHandler } from './streaming';

const endpoint = process.env.WEBSOCKET_API_ENDPOINT || '';
const apiGatewayClient = new ApiGatewayManagementApiClient({
  endpoint: endpoint.replace('wss://', 'https://').replace('ws://', 'http://'),
});

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  const routeKey = event.requestContext.routeKey;
  const connectionId = event.requestContext.connectionId!;

  try {
    switch (routeKey) {
      case '$connect':
        return await connectHandler(event);
      
      case '$disconnect':
        return await disconnectHandler(event);
      
      case '$default':
      case 'processMessage':
        return await messageHandler(event);
      
      default:
        return { statusCode: 404, body: JSON.stringify({ error: 'Route not found' }) };
    }
  } catch (error) {
    console.error('WebSocket handler error:', error);
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
