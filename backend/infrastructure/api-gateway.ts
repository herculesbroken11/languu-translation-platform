import {
  RestApi,
  Cors,
  LambdaIntegration,
  EndpointType,
} from 'aws-cdk-lib/aws-apigateway';
import { IFunction } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface ApiGatewayConfig {
  translateFunction: IFunction;
  transcribeFunction: IFunction;
  transcribeUploadFunction: IFunction;
  interpretationFunction: IFunction;
  ttsFunction: IFunction;
  hitlFunction: IFunction;
  stage: string;
}

export function createApiGateway(
  scope: Construct,
  config: ApiGatewayConfig
): RestApi {
  const api = new RestApi(scope, `LanguuApi-${config.stage}`, {
    restApiName: `languu-${config.stage}-api`,
    description: `LANGUU Translation Platform API - ${config.stage}`,
    endpointConfiguration: {
      types: [EndpointType.REGIONAL],
    },
    defaultCorsPreflightOptions: {
      allowOrigins: Cors.ALL_ORIGINS,
      allowMethods: Cors.ALL_METHODS,
      allowHeaders: ['Content-Type', 'Authorization'],
    },
  });

  // Translate endpoint
  const translateResource = api.root.addResource('translate');
  translateResource.addMethod(
    'POST',
    new LambdaIntegration(config.translateFunction)
  );
  translateResource.addMethod('OPTIONS', new LambdaIntegration(config.translateFunction));

  // Transcribe endpoints
  const transcribeResource = api.root.addResource('transcribe');
  transcribeResource.addMethod(
    'POST',
    new LambdaIntegration(config.transcribeFunction)
  );
  transcribeResource.addMethod('OPTIONS', new LambdaIntegration(config.transcribeFunction));

  const transcribeUploadResource = transcribeResource.addResource('upload');
  transcribeUploadResource.addMethod(
    'POST',
    new LambdaIntegration(config.transcribeUploadFunction)
  );
  transcribeUploadResource.addMethod('OPTIONS', new LambdaIntegration(config.transcribeUploadFunction));

  // Interpretation endpoint
  const interpretationResource = api.root.addResource('interpretation');
  interpretationResource.addMethod(
    'GET',
    new LambdaIntegration(config.interpretationFunction)
  );
  interpretationResource.addMethod('OPTIONS', new LambdaIntegration(config.interpretationFunction));

  // TTS endpoint
  const ttsResource = api.root.addResource('tts');
  ttsResource.addMethod(
    'POST',
    new LambdaIntegration(config.ttsFunction)
  );
  ttsResource.addMethod('OPTIONS', new LambdaIntegration(config.ttsFunction));

  // HITL endpoint
  const hitlResource = api.root.addResource('hitl');
  hitlResource.addMethod(
    'POST',
    new LambdaIntegration(config.hitlFunction)
  );
  hitlResource.addMethod('OPTIONS', new LambdaIntegration(config.hitlFunction));

  return api;
}
