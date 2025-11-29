const express = require('express');
const yahooFinance = require('yahoo-finance2').default;
const path = require('path');
const session = require('express-session');
const db = require('./db');
const DynamoDBStore = require('./session-store');

const app = express();
const PORT = process.env.PORT || 3000;

// Use DynamoDB for storage (Mumbai region - ap-south-1)

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Session configuration - use DynamoDB store for Lambda compatibility
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'mock-stock-trading-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // HTTPS in production
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    httpOnly: true,
    sameSite: 'lax'
  }
};

// Use DynamoDB store if in Lambda environment, otherwise use memory store
if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.SESSIONS_TABLE) {
  try {
    sessionConfig.store = new DynamoDBStore({
      table: process.env.SESSIONS_TABLE || 'StockTradingSessions',
      region: process.env.AWS_REGION || 'ap-south-1'
    });
  } catch (e) {
    console.warn('Failed to initialize DynamoDB store, using memory store:', e.message);
  }
}

app.use(session(sessionConfig));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized', message: 'Please login first' });
  }
};

// Helper function to calculate portfolio value
const calculatePortfolio = async (userId) => {
  const userHoldings = await db.getHoldings(userId);
  
  let totalInvested = 0;
  let currentValue = 0;
  let totalProfitLoss = 0;
  const holdingsList = [];

  // Calculate from holdings
  for (const [ticker, holding] of Object.entries(userHoldings)) {
    totalInvested += holding.quantity * holding.avgPrice;
    holdingsList.push({
      ticker,
      quantity: holding.quantity,
      avgPrice: holding.avgPrice,
      invested: holding.quantity * holding.avgPrice
    });
  }

  return {
    holdings: holdingsList,
    totalInvested,
    currentValue, // Will be calculated with live prices
    totalProfitLoss
  };
};

// Authentication Routes
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await db.getUser(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await db.createUser(username, password, userId);

    req.session.userId = userId;
    req.session.username = username;

    res.json({ 
      success: true, 
      message: 'Account created successfully',
      username 
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.getUser(username);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.userId;
    req.session.username = username;

    res.json({ 
      success: true, 
      message: 'Login successful',
      username 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, message: 'Logged out successfully' });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ 
    username: req.session.username,
    userId: req.session.userId 
  });
});

// Stock Price Endpoint
app.get('/api/price/:ticker', async (req, res) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    
    // Validate Indian stock (must end with .NS)
    if (!ticker.endsWith('.NS')) {
      return res.status(400).json({
        error: 'Invalid ticker symbol',
        message: 'Only Indian stocks are supported. Please use tickers ending with .NS (e.g., RELIANCE.NS, TCS.NS)'
      });
    }
    
    const quote = await yahooFinance.quote(ticker);
    
    if (!quote || !quote.regularMarketPrice) {
      return res.status(404).json({
        error: 'Stock not found',
        message: `Unable to fetch price for ${ticker}. Please check the ticker symbol.`
      });
    }

    res.json({
      ticker: ticker,
      price: quote.regularMarketPrice,
      currency: quote.currency || 'INR',
      name: quote.longName || quote.shortName || ticker,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching stock price:', error);
    
    if (error.message && error.message.includes('Invalid')) {
      return res.status(400).json({
        error: 'Invalid ticker symbol',
        message: `The ticker symbol "${req.params.ticker}" is invalid.`
      });
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch stock price. Please try again later.'
    });
  }
});

// Buy Stock Endpoint
app.post('/api/buy', requireAuth, async (req, res) => {
  try {
    const { ticker, quantity } = req.body;
    const userId = req.session.userId;

    if (!ticker || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Ticker and valid quantity are required' });
    }

    const upperTicker = ticker.toUpperCase();
    
    // Validate Indian stock (must end with .NS)
    if (!upperTicker.endsWith('.NS')) {
      return res.status(400).json({
        error: 'Invalid ticker symbol',
        message: 'Only Indian stocks are supported. Please use tickers ending with .NS (e.g., RELIANCE.NS, TCS.NS, INFY.NS)'
      });
    }
    
    // Fetch current price
    const quote = await yahooFinance.quote(upperTicker);
    
    if (!quote || !quote.regularMarketPrice) {
      return res.status(404).json({
        error: 'Stock not found',
        message: `Unable to fetch price for ${upperTicker}.`
      });
    }

    const price = quote.regularMarketPrice;
    const totalCost = price * quantity;

    // Record trade
    const trade = {
      ticker: upperTicker,
      quantity,
      price,
      totalCost,
      type: 'BUY'
    };
    await db.addTrade(userId, trade);

    // Update holdings
    const userHoldings = await db.getHoldings(userId);
    if (userHoldings[upperTicker]) {
      // Calculate new average price
      const oldQuantity = userHoldings[upperTicker].quantity;
      const oldAvgPrice = userHoldings[upperTicker].avgPrice;
      const newQuantity = oldQuantity + quantity;
      const newAvgPrice = ((oldQuantity * oldAvgPrice) + totalCost) / newQuantity;
      
      await db.updateHolding(userId, upperTicker, newQuantity, newAvgPrice);
    } else {
      await db.updateHolding(userId, upperTicker, quantity, price);
    }

    console.log(`Trade executed - User: ${req.session.username}, ${trade.type} ${quantity} ${upperTicker} @ ₹${price}`);

    res.json({
      success: true,
      message: 'Stock purchased successfully',
      trade: {
        ticker: upperTicker,
        quantity,
        price,
        totalCost,
        timestamp: trade.timestamp
      }
    });
  } catch (error) {
    console.error('Buy error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Sell Stock Endpoint
app.post('/api/sell', requireAuth, async (req, res) => {
  try {
    const { ticker, quantity } = req.body;
    const userId = req.session.userId;

    if (!ticker || !quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Ticker and valid quantity are required' });
    }

    const upperTicker = ticker.toUpperCase();
    
    // Check if user has enough holdings
    const userHoldings = await db.getHoldings(userId);
    const holding = userHoldings[upperTicker];
    
    if (!holding || holding.quantity < quantity) {
      return res.status(400).json({
        error: 'Insufficient holdings',
        message: `You only have ${holding?.quantity || 0} shares of ${upperTicker}`
      });
    }

    // For selling: Allow existing holdings (even non-Indian stocks) so users can clean up their portfolio
    // For new purchases, we restrict to .NS only (handled in buy endpoint)
    if (!upperTicker.endsWith('.NS')) {
      // Allow selling but note that new trades are restricted to Indian stocks
      console.log(`Note: Selling existing non-Indian stock ${upperTicker} - new trades restricted to Indian stocks (.NS) only`);
    }

    // Fetch current price
    const quote = await yahooFinance.quote(upperTicker);
    
    if (!quote || !quote.regularMarketPrice) {
      return res.status(404).json({
        error: 'Stock not found',
        message: `Unable to fetch price for ${upperTicker}.`
      });
    }

    const price = quote.regularMarketPrice;
    const totalValue = price * quantity;
    const avgPrice = holding.avgPrice;
    const profitLoss = (price - avgPrice) * quantity;

    // Record trade
    const trade = {
      ticker: upperTicker,
      quantity,
      price,
      totalValue,
      avgPrice,
      profitLoss,
      type: 'SELL'
    };
    await db.addTrade(userId, trade);

    // Update holdings
    const newQuantity = holding.quantity - quantity;
    await db.updateHolding(userId, upperTicker, newQuantity, avgPrice);

    console.log(`Trade executed - User: ${req.session.username}, ${trade.type} ${quantity} ${upperTicker} @ ₹${price}, P/L: ₹${profitLoss.toFixed(2)}`);

    res.json({
      success: true,
      message: 'Stock sold successfully',
      trade: {
        ticker: upperTicker,
        quantity,
        price,
        totalValue,
        profitLoss,
        timestamp: trade.timestamp
      }
    });
  } catch (error) {
    console.error('Sell error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Portfolio Endpoint
app.get('/api/portfolio', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const portfolio = await calculatePortfolio(userId);
    
    // Fetch current prices for all holdings
    let totalCurrentValue = 0;
    const holdingsWithPrices = [];

    for (const holding of portfolio.holdings) {
      try {
        // Only fetch prices for Indian stocks (.NS)
        if (!holding.ticker.endsWith('.NS')) {
          // Skip non-Indian stocks or mark them as invalid
          holdingsWithPrices.push({
            ...holding,
            currentPrice: null,
            currentValue: holding.invested,
            profitLoss: 0,
            profitLossPercent: 0,
            note: 'Non-Indian stock - trading restricted to Indian stocks only'
          });
          totalCurrentValue += holding.invested;
          continue;
        }
        
        const quote = await yahooFinance.quote(holding.ticker);
        if (quote && quote.regularMarketPrice) {
          const currentPrice = quote.regularMarketPrice;
          const currentValue = holding.quantity * currentPrice;
          const profitLoss = currentValue - holding.invested;
          const profitLossPercent = (profitLoss / holding.invested) * 100;

          holdingsWithPrices.push({
            ...holding,
            currentPrice,
            currentValue,
            profitLoss,
            profitLossPercent
          });

          totalCurrentValue += currentValue;
        }
      } catch (error) {
        console.error(`Error fetching price for ${holding.ticker}:`, error);
        holdingsWithPrices.push({
          ...holding,
          currentPrice: null,
          currentValue: holding.invested,
          profitLoss: 0,
          profitLossPercent: 0
        });
        totalCurrentValue += holding.invested;
      }
    }

    const totalProfitLoss = totalCurrentValue - portfolio.totalInvested;
    const totalProfitLossPercent = portfolio.totalInvested > 0 
      ? (totalProfitLoss / portfolio.totalInvested) * 100 
      : 0;

    res.json({
      holdings: holdingsWithPrices,
      summary: {
        totalInvested: portfolio.totalInvested,
        totalCurrentValue,
        totalProfitLoss,
        totalProfitLossPercent
      }
    });
  } catch (error) {
    console.error('Portfolio error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Trade History Endpoint
app.get('/api/trades', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const userTrades = await db.getTrades(userId);
    
    // Return last 50 trades (already sorted by timestamp desc)
    const recentTrades = userTrades.slice(0, 50);
    
    res.json({ trades: recentTrades });
  } catch (error) {
    console.error('Trades error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export app for Lambda (via lambda.js) or start server locally
if (require.main === module) {
  // Start server only if running directly (not imported by Lambda)
  app.listen(PORT, () => {
    console.log(`🚀 Mock Stock Trading App running on http://localhost:${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   GET  /api/price/:ticker`);
    console.log(`   POST /api/buy`);
    console.log(`   POST /api/sell`);
    console.log(`   GET  /api/portfolio`);
    console.log(`   GET  /api/trades`);
  });
}

module.exports = app;
