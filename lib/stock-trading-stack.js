const cdk = require('aws-cdk-lib');
const { Construct } = require('constructs');
const lambda = require('aws-cdk-lib/aws-lambda');
const apigateway = require('aws-cdk-lib/aws-apigateway');
const dynamodb = require('aws-cdk-lib/aws-dynamodb');
const s3 = require('aws-cdk-lib/aws-s3');
const s3deploy = require('aws-cdk-lib/aws-s3-deployment');
const cloudfront = require('aws-cdk-lib/aws-cloudfront');
const origins = require('aws-cdk-lib/aws-cloudfront-origins');

class StockTradingStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // DynamoDB Tables - Mumbai region
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'StockTradingUsers',
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Change to RETAIN for production
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false }
    });

    const tradesTable = new dynamodb.Table(this, 'TradesTable', {
      tableName: 'StockTradingTrades',
      partitionKey: { name: 'tradeId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false }
    });

    // Add GSI for querying trades by userId
    tradesTable.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING }
    });

    const holdingsTable = new dynamodb.Table(this, 'HoldingsTable', {
      tableName: 'StockTradingHoldings',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ticker', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: false }
    });

    // Sessions table for Lambda
    const sessionsTable = new dynamodb.Table(this, 'SessionsTable', {
      tableName: 'StockTradingSessions',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      timeToLiveAttribute: 'ttl'
    });

    // S3 Bucket for static files (private, accessed via CloudFront)
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `stock-trading-app-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`,
      websiteIndexDocument: 'index.html',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL, // Keep bucket private, CloudFront will serve it
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // Deploy static files to S3
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset('./public')],
      destinationBucket: websiteBucket
    });

    // Create OAI for CloudFront to access private S3 bucket
    const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: 'OAI for Stock Trading App'
    });

    // Grant OAI read access to bucket
    websiteBucket.grantRead(originAccessIdentity);

    // CloudFront Distribution for S3
    const distribution = new cloudfront.Distribution(this, 'WebsiteDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(websiteBucket, {
          originAccessIdentity: originAccessIdentity
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html'
        }
      ]
    });

    // Lambda Function
    const stockTradingLambda = new lambda.Function(this, 'StockTradingLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset('.', {
        exclude: [
          'node_modules',
          '.git',
          'cdk.out',
          '*.md',
          'lib',
          'bin',
          'test',
          '.gitignore',
          'cdk.json',
          'tsconfig.json'
        ]
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        USERS_TABLE: usersTable.tableName,
        TRADES_TABLE: tradesTable.tableName,
        HOLDINGS_TABLE: holdingsTable.tableName,
        SESSIONS_TABLE: sessionsTable.tableName,
        NODE_ENV: 'production',
        SESSION_SECRET: process.env.SESSION_SECRET || 'change-this-in-production'
      }
    });

    // Grant Lambda permissions to DynamoDB
    usersTable.grantReadWriteData(stockTradingLambda);
    tradesTable.grantReadWriteData(stockTradingLambda);
    holdingsTable.grantReadWriteData(stockTradingLambda);
    sessionsTable.grantReadWriteData(stockTradingLambda);

    // API Gateway
    const api = new apigateway.RestApi(this, 'StockTradingApi', {
      restApiName: 'Stock Trading API',
      description: 'API for Mock Stock Trading App',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key']
      },
      deployOptions: {
        stageName: 'prod',
        tracingEnabled: true,
        metricsEnabled: true
      }
    });

    // Lambda Integration
    const lambdaIntegration = new apigateway.LambdaIntegration(stockTradingLambda, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' }
    });

    // API Routes
    api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL'
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL'
    });

    new cdk.CfnOutput(this, 'S3BucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 Bucket for static files'
    });
  }
}

module.exports = { StockTradingStack };

