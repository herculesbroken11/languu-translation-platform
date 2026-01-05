import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { LanguuStack } from './cdk-stack';

const app = new cdk.App();

const stage = process.env.STAGE || 'staging';

new LanguuStack(app, `LanguuStack-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
});
