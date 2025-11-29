const AWS = require('aws-sdk');
const session = require('express-session');

class DynamoDBStore extends session.Store {
  constructor(options = {}) {
    super();
    this.table = options.table || 'StockTradingSessions';
    this.region = options.region || 'ap-south-1';
    this.client = new AWS.DynamoDB.DocumentClient({ region: this.region });
  }

  async get(sid, callback) {
    const params = {
      TableName: this.table,
      Key: { id: sid }
    };

    try {
      const result = await this.client.get(params).promise();
      if (result.Item && result.Item.data) {
        const sessionData = JSON.parse(result.Item.data);
        // Check if expired
        if (result.Item.expires && new Date(result.Item.expires) < new Date()) {
          await this.destroy(sid);
          return callback(null, null);
        }
        return callback(null, sessionData);
      }
      callback(null, null);
    } catch (error) {
      callback(error);
    }
  }

  async set(sid, sessionData, callback) {
    const expires = sessionData.cookie && sessionData.cookie.expires
      ? new Date(sessionData.cookie.expires).getTime()
      : Date.now() + (24 * 60 * 60 * 1000); // 24 hours default

    const params = {
      TableName: this.table,
      Item: {
        id: sid,
        data: JSON.stringify(sessionData),
        expires: new Date(expires).toISOString(),
        ttl: Math.floor(expires / 1000) // TTL in seconds
      }
    };

    try {
      await this.client.put(params).promise();
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async destroy(sid, callback) {
    const params = {
      TableName: this.table,
      Key: { id: sid }
    };

    try {
      await this.client.delete(params).promise();
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  async touch(sid, sessionData, callback) {
    await this.set(sid, sessionData, callback);
  }
}

module.exports = DynamoDBStore;

