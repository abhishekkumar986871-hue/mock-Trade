# Quick Deployment Guide

## Prerequisites
```bash
npm install -g aws-cdk
npm install
```

## First Time Setup

1. **Configure AWS CLI**
```bash
aws configure
# Enter your AWS credentials
# Default region: ap-south-1 (Mumbai)
```

2. **Bootstrap CDK** (one-time setup)
```bash
cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-south-1
```

3. **Deploy**
```bash
npm run deploy
```

## CI/CD Setup

1. **Add GitHub Secrets:**
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_ACCOUNT_ID`

2. **Push to main branch** - deployment happens automatically!

## What Gets Deployed

- ✅ Lambda Function (Node.js 18)
- ✅ API Gateway (REST API)
- ✅ DynamoDB Tables (Mumbai region):
  - StockTradingUsers
  - StockTradingTrades
  - StockTradingHoldings
  - StockTradingSessions
- ✅ S3 Bucket + CloudFront (Static website)

## Outputs

After deployment, you'll get:
- API Gateway URL
- CloudFront Distribution URL
- S3 Bucket Name

## Update Frontend API URL

After first deployment, update `public/index.html` to use the API Gateway URL instead of relative paths, then redeploy.

