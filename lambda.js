const serverless = require('serverless-http');
const app = require('./server');

// Export the handler for Lambda
exports.handler = serverless(app, {
  binary: ['image/*', 'application/pdf', 'application/octet-stream']
});

