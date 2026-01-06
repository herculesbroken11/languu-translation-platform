import {
  WebSocketApi,
  WebSocketStage,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface WebSocketApiConfig {
  interpretationFunction: IFunction;
  stage: string;
}

export function createWebSocketApi(
  scope: Construct,
  config: WebSocketApiConfig
): { api: WebSocketApi; stage: WebSocketStage; url: string } {
  const api = new WebSocketApi(scope, `LanguuWebSocketApi-${config.stage}`, {
    apiName: `languu-${config.stage}-websocket`,
    description: `LANGUU Real-time Interpretation WebSocket API - ${config.stage}`,
    connectRouteOptions: {
      integration: new WebSocketLambdaIntegration('ConnectIntegration', config.interpretationFunction),
    },
    disconnectRouteOptions: {
      integration: new WebSocketLambdaIntegration('DisconnectIntegration', config.interpretationFunction),
    },
    defaultRouteOptions: {
      integration: new WebSocketLambdaIntegration('MessageIntegration', config.interpretationFunction),
    },
  });

  const stage = new WebSocketStage(scope, `LanguuWebSocketStage-${config.stage}`, {
    webSocketApi: api,
    stageName: config.stage === 'production' ? 'prod' : 'dev',
    autoDeploy: true,
  });

  // Grant API Gateway permission to invoke Lambda
  config.interpretationFunction.addPermission('WebSocketInvoke', {
    principal: new (require('aws-cdk-lib/aws-iam').ServicePrincipal)('apigateway.amazonaws.com'),
    sourceArn: api.arnForExecuteApi(),
  });

  // Return both API and stage for URL access
  return {
    api,
    stage,
    url: `${api.apiEndpoint}/${stage.stageName}`,
  };
}
