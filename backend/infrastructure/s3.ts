import { Bucket, BucketEncryption, BlockPublicAccess, CorsRule, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface S3Config {
  stage: string;
}

export function createS3Bucket(
  scope: Construct,
  config: S3Config
): Bucket {
  const bucket = new Bucket(scope, `LanguuMediaBucket-${config.stage}`, {
    bucketName: `languu-${config.stage}-media`,
    encryption: BucketEncryption.S3_MANAGED,
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    removalPolicy:
      config.stage === 'production'
        ? RemovalPolicy.RETAIN
        : RemovalPolicy.DESTROY,
    autoDeleteObjects: config.stage !== 'production',
    cors: [
      {
        allowedOrigins: ['*'], // In production, replace with specific domain
        allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST, HttpMethods.HEAD, HttpMethods.DELETE],
        allowedHeaders: ['*'],
        exposedHeaders: ['ETag', 'x-amz-server-side-encryption', 'x-amz-request-id', 'x-amz-id-2'],
        maxAge: 3000,
      },
    ],
  });

  return bucket;
}
