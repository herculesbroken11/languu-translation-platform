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
  transcribeStatusFunction: IFunction;
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

  // Use proxy integration to pass through all headers from Lambda (including CORS)
  const createProxyIntegration = (fn: IFunction) => {
    return new LambdaIntegration(fn, { proxy: true });
  };

  // Translate endpoint
  const translateResource = api.root.addResource('translate');
  translateResource.addMethod('POST', createProxyIntegration(config.translateFunction));

  // Transcribe endpoints
  const transcribeResource = api.root.addResource('transcribe');
  transcribeResource.addMethod('POST', createProxyIntegration(config.transcribeFunction));

  const transcribeUploadResource = transcribeResource.addResource('upload');
  transcribeUploadResource.addMethod('POST', createProxyIntegration(config.transcribeUploadFunction));

  const transcribeStatusResource = transcribeResource.addResource('status');
  const transcribeStatusJobResource = transcribeStatusResource.addResource('{jobId}');
  transcribeStatusJobResource.addMethod('GET', createProxyIntegration(config.transcribeStatusFunction));

  // Interpretation endpoint
  const interpretationResource = api.root.addResource('interpretation');
  interpretationResource.addMethod('GET', createProxyIntegration(config.interpretationFunction));

  // TTS endpoint
  const ttsResource = api.root.addResource('tts');
  ttsResource.addMethod('POST', createProxyIntegration(config.ttsFunction));

  // HITL endpoint
  const hitlResource = api.root.addResource('hitl');
  hitlResource.addMethod('POST', createProxyIntegration(config.hitlFunction));

  return api;
}
