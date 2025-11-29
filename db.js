const AWS = require('aws-sdk');

// Initialize DynamoDB - Mumbai region
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'ap-south-1'
});

const USERS_TABLE = process.env.USERS_TABLE || 'StockTradingUsers';
const TRADES_TABLE = process.env.TRADES_TABLE || 'StockTradingTrades';
const HOLDINGS_TABLE = process.env.HOLDINGS_TABLE || 'StockTradingHoldings';

// Users operations
async function getUser(username) {
  const params = {
    TableName: USERS_TABLE,
    Key: { username }
  };
  const result = await dynamodb.get(params).promise();
  return result.Item || null;
}

async function createUser(username, password, userId) {
  const params = {
    TableName: USERS_TABLE,
    Item: { username, password, userId, createdAt: new Date().toISOString() }
  };
  await dynamodb.put(params).promise();
  return params.Item;
}

// Trades operations
async function getTrades(userId) {
  const params = {
    TableName: TRADES_TABLE,
    IndexName: 'userId-index',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId },
    ScanIndexForward: false // Sort descending by timestamp
  };
  const result = await dynamodb.query(params).promise();
  return result.Items || [];
}

async function addTrade(userId, trade) {
  const params = {
    TableName: TRADES_TABLE,
    Item: {
      tradeId: `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      ...trade,
      timestamp: new Date().toISOString()
    }
  };
  await dynamodb.put(params).promise();
  return params.Item;
}

// Holdings operations
async function getHoldings(userId) {
  const params = {
    TableName: HOLDINGS_TABLE,
    FilterExpression: 'userId = :userId',
    ExpressionAttributeValues: { ':userId': userId }
  };
  const result = await dynamodb.scan(params).promise();
  
  // Convert array to object format
  const holdings = {};
  (result.Items || []).forEach(item => {
    holdings[item.ticker] = {
      quantity: item.quantity,
      avgPrice: item.avgPrice
    };
  });
  return holdings;
}

async function updateHolding(userId, ticker, quantity, avgPrice) {
  if (quantity === 0) {
    // Delete holding
    const params = {
      TableName: HOLDINGS_TABLE,
      Key: { userId, ticker }
    };
    await dynamodb.delete(params).promise();
    return null;
  } else {
    // Update or create holding
    const params = {
      TableName: HOLDINGS_TABLE,
      Item: {
        userId,
        ticker,
        quantity,
        avgPrice,
        updatedAt: new Date().toISOString()
      }
    };
    await dynamodb.put(params).promise();
    return params.Item;
  }
}

module.exports = {
  getUser,
  createUser,
  getTrades,
  addTrade,
  getHoldings,
  updateHolding
};

