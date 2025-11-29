# AWS Lambda Deployment Guide

This guide explains how to deploy the Mock Stock Trading App to AWS Lambda using CDK.

## Prerequisites

1. **AWS Account** with appropriate permissions
2. **AWS CLI** installed and configured
3. **Node.js 18+** installed
4. **AWS CDK CLI** installed globally: `npm install -g aws-cdk`

## Architecture

- **Lambda Function**: Node.js 18 runtime, handles all API requests
- **API Gateway**: REST API for Lambda integration
- **DynamoDB**: Three tables for users, trades, and holdings (Mumbai region - ap-south-1)
- **S3 + CloudFront**: Static website hosting for frontend
- **CI/CD**: GitHub Actions for automated deployment

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure AWS Credentials

```bash
aws configure
```

Or set environment variables:
```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export AWS_DEFAULT_REGION=ap-south-1
```

### 3. Bootstrap CDK (First Time Only)

```bash
cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-south-1
```

### 4. Build and Deploy

```bash
# Build CDK stack
npm run build:cdk

# Deploy to AWS
npm run deploy
```

Or use CDK directly:
```bash
cdk deploy --region ap-south-1
```

### 5. Get Deployment Outputs

After deployment, CDK will output:
- **ApiUrl**: API Gateway endpoint URL
- **WebsiteUrl**: CloudFront distribution URL
- **S3BucketName**: S3 bucket name for static files

## CI/CD Setup (GitHub Actions)

### 1. Add GitHub Secrets

Go to your GitHub repository → Settings → Secrets and add:

- `AWS_ACCESS_KEY_ID`: Your AWS access key
- `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- `AWS_ACCOUNT_ID`: Your AWS account ID

### 2. Push to Main Branch

The workflow will automatically:
1. Install dependencies
2. Build CDK stack
3. Deploy to AWS Lambda
4. Update API Gateway

## DynamoDB Tables

Three tables are created in Mumbai region (ap-south-1):

1. **StockTradingUsers**
   - Partition Key: `username` (String)
   - Stores user credentials

2. **StockTradingTrades**
   - Partition Key: `tradeId` (String)
   - GSI: `userId-index` (for querying by userId)
   - Stores all trade transactions

3. **StockTradingHoldings**
   - Partition Key: `userId` (String)
   - Sort Key: `ticker` (String)
   - Stores user portfolio holdings

## Environment Variables

Lambda function uses these environment variables:
- `USERS_TABLE`: DynamoDB table name for users
- `TRADES_TABLE`: DynamoDB table name for trades
- `HOLDINGS_TABLE`: DynamoDB table name for holdings
- `AWS_REGION`: ap-south-1 (Mumbai)
- `NODE_ENV`: production

## Updating Frontend API URL

After deployment, update the frontend to use the API Gateway URL:

1. Get the API URL from CDK outputs
2. Update `public/index.html` to use the API Gateway URL instead of relative paths
3. Redeploy static files to S3

Or use environment-based configuration in the frontend.

## Cost Estimation

- **Lambda**: Pay per request (very low for this app)
- **API Gateway**: Pay per API call
- **DynamoDB**: Pay per request (on-demand pricing)
- **S3 + CloudFront**: Minimal cost for static hosting

## Troubleshooting

### CDK Bootstrap Error
```bash
cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-south-1
```

### Lambda Timeout
Increase timeout in `lib/stock-trading-stack.js`:
```javascript
timeout: cdk.Duration.seconds(60) // Increase from 30
```

### DynamoDB Permissions
Ensure Lambda execution role has DynamoDB read/write permissions (handled by CDK).

### CORS Issues
CORS is configured in API Gateway. Check `defaultCorsPreflightOptions` in CDK stack.

## Destroy Stack

To remove all resources:
```bash
cdk destroy
```

**Warning**: This will delete all DynamoDB tables and data!

## Manual Deployment

If CI/CD is not set up:

```bash
# Build
npm run build:cdk

# Deploy
cdk deploy StockTradingStack --region ap-south-1
```

## Monitoring

- **CloudWatch Logs**: View Lambda function logs
- **API Gateway Metrics**: Monitor API usage
- **DynamoDB Metrics**: Monitor table performance

## Security Notes

1. **Session Secret**: Change the session secret in production
2. **CORS**: Restrict CORS origins in production
3. **API Keys**: Consider adding API key authentication
4. **HTTPS**: All traffic is HTTPS via API Gateway and CloudFront

