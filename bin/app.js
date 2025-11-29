#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { StockTradingStack } = require('../lib/stock-trading-stack');

const app = new cdk.App();
new StockTradingStack(app, 'StockTradingStack', {
  env: {
    region: 'ap-south-1', // Mumbai region
    account: process.env.CDK_DEFAULT_ACCOUNT
  },
  description: 'Mock Stock Trading App - Indian Stock Market'
});

