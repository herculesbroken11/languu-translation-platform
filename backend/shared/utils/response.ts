import { LambdaResponse } from '../types';

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const createResponse = (
  statusCode: number,
  body: any,
  headers: Record<string, string> = {}
): LambdaResponse => {
  return {
    statusCode,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
    body: JSON.stringify(body),
  };
};

export const createSuccessResponse = (data: any): LambdaResponse => {
  return createResponse(200, { success: true, data });
};

export const createErrorResponse = (
  statusCode: number,
  message: string,
  error?: any
): LambdaResponse => {
  return createResponse(statusCode, {
    success: false,
    message,
    ...(error && { error: error instanceof Error ? error.message : String(error) }),
  });
};

export const createCorsResponse = (): LambdaResponse => {
  return createResponse(200, {}, {});
};
