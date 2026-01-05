import {
  Table,
  BillingMode,
  AttributeType,
} from 'aws-cdk-lib/aws-dynamodb';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface DynamoDBConfig {
  stage: string;
}

export function createDynamoDBTable(
  scope: Construct,
  config: DynamoDBConfig
): Table {
  const table = new Table(scope, `LanguuJobsTable-${config.stage}`, {
    tableName: `languu-${config.stage}-jobs`,
    partitionKey: {
      name: 'jobId',
      type: AttributeType.STRING,
    },
    billingMode: BillingMode.PAY_PER_REQUEST,
    removalPolicy:
      config.stage === 'production'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
  });

  return table;
}
