# CI/CD Setup Guide

This guide will help you set up automated deployment using GitHub Actions.

## Prerequisites

1. **GitHub Repository** - Your code should be in a GitHub repository
2. **AWS Account** - With appropriate permissions
3. **AWS CLI** - Installed and configured locally (for initial setup)

## Step-by-Step Setup

### 1. Push Your Code to GitHub

If you haven't already, initialize git and push to GitHub:

```bash
# Initialize git (if not done)
git init
git add .
git commit -m "Initial commit: Stock Trading App with CDK"

# Add your GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### 2. Create AWS IAM User for CI/CD

You need an IAM user with deployment permissions:

1. Go to AWS Console → IAM → Users → Create User
2. Name: `github-actions-deployer`
3. Attach policies:
   - `AWSLambda_FullAccess`
   - `IAMFullAccess` (or create a custom policy with limited permissions)
   - `AmazonAPIGatewayAdministrator`
   - `AmazonDynamoDBFullAccess`
   - `AmazonS3FullAccess`
   - `CloudFrontFullAccess`
   - `AWSCloudFormationFullAccess`

4. Create Access Key:
   - Go to Security credentials tab
   - Create access key
   - **Save both Access Key ID and Secret Access Key** (you'll need them)

### 3. Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add these secrets:

   - **Name**: `AWS_ACCESS_KEY_ID`
     **Value**: Your IAM user's Access Key ID

   - **Name**: `AWS_SECRET_ACCESS_KEY`
     **Value**: Your IAM user's Secret Access Key

   - **Name**: `AWS_ACCOUNT_ID`
     **Value**: Your AWS Account ID (12-digit number)
     - Find it: AWS Console → Support → Support Center (top right)

### 4. Verify Workflow File

The workflow file is already created at `.github/workflows/deploy.yml`. It will:
- Trigger on push to `main` or `master` branch
- Install dependencies
- Build and deploy CDK stack
- Deploy to Mumbai region (ap-south-1)

### 5. Test the Deployment

1. **Make a small change** to trigger the workflow:
   ```bash
   echo "# Test deployment" >> README.md
   git add README.md
   git commit -m "Test CI/CD deployment"
   git push
   ```

2. **Check GitHub Actions**:
   - Go to your repository on GitHub
   - Click **Actions** tab
   - You should see the workflow running
   - Click on it to see the progress

### 6. Monitor Deployment

The workflow will:
- ✅ Checkout code
- ✅ Install dependencies
- ✅ Configure AWS credentials
- ✅ Bootstrap CDK (first time only)
- ✅ Build CDK stack
- ✅ Deploy to AWS
- ✅ Output API URL

## Workflow Triggers

The workflow runs automatically when:
- You push to `main` or `master` branch
- You manually trigger it (Actions → Deploy to AWS Lambda → Run workflow)

## Troubleshooting

### Bootstrap Error
If bootstrap fails, run it manually first:
```bash
cdk bootstrap aws://YOUR_ACCOUNT_ID/ap-south-1
```

### Permission Errors
Make sure your IAM user has all required permissions (see Step 2).

### Region Mismatch
Ensure all resources are in `ap-south-1` (Mumbai). The workflow is configured for this region.

### CDK Stack Name
The stack name is `StockTradingStack`. If you change it, update the workflow file.

## Manual Deployment (Alternative)

If you prefer manual deployment:

```bash
# Install dependencies
npm install

# Build
npm run build:cdk

# Deploy
npm run deploy
```

## Security Best Practices

1. **Rotate Access Keys** regularly
2. **Use IAM Roles** instead of access keys if using AWS CodePipeline
3. **Limit IAM Permissions** - Only grant what's needed
4. **Use Secrets Manager** for sensitive data (optional)
5. **Enable MFA** on your AWS account

## Next Steps

After successful deployment:
1. Get the API Gateway URL from CDK outputs
2. Update frontend to use the API Gateway URL
3. Test the deployed application
4. Monitor CloudWatch logs for any issues

## Workflow File Location

The workflow is at: `.github/workflows/deploy.yml`

You can customize it as needed for your requirements.

