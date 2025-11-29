# Mock Stock Trading App - Indian Stock Market

A full-featured mock stock trading application for the Indian stock market with user authentication, portfolio tracking, and real-time profit/loss calculations.

## Features

- 🔐 **User Authentication** - Login/Signup system with session management
- 📊 **Live Stock Prices** - Fetch real-time prices using Yahoo Finance API
- 💰 **Buy/Sell Stocks** - Execute mock trades with proper validation
- 📈 **Portfolio Tracking** - View all holdings with current values
- 💵 **Profit/Loss Calculation** - Real-time P&L tracking per stock and overall
- 📋 **Trade History** - View all executed trades
- 🎨 **Modern UI** - Responsive design with beautiful dashboard

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Access the App**
   - Open your browser and go to: `http://localhost:3000`
   - Create an account or login to start trading

## API Endpoints

### Authentication

**POST** `/api/auth/signup`
- Create a new user account
- Body: `{ "username": "string", "password": "string" }`

**POST** `/api/auth/login`
- Login to existing account
- Body: `{ "username": "string", "password": "string" }`

**POST** `/api/auth/logout`
- Logout current user

**GET** `/api/auth/me`
- Get current user info (requires authentication)

### Stock Operations

**GET** `/api/price/:ticker`
- Fetch current stock price
- Example: `GET /api/price/RELIANCE.NS`

**POST** `/api/buy`
- Buy stocks (requires authentication)
- Body: `{ "ticker": "RELIANCE.NS", "quantity": 10 }`

**POST** `/api/sell`
- Sell stocks (requires authentication)
- Body: `{ "ticker": "RELIANCE.NS", "quantity": 5 }`

### Portfolio

**GET** `/api/portfolio`
- Get user's portfolio with current values and P&L (requires authentication)

**GET** `/api/trades`
- Get user's trade history (requires authentication)

## Usage

### Getting Started

1. **Sign Up**: Create a new account with a username and password
2. **Login**: Use your credentials to access the dashboard
3. **Buy Stocks**: Enter a ticker symbol (e.g., `RELIANCE.NS`) and quantity
4. **Sell Stocks**: Sell shares you own (must have sufficient holdings)
5. **View Portfolio**: See all your holdings with real-time profit/loss

### Popular Indian Stock Tickers

- `RELIANCE.NS` - Reliance Industries
- `TCS.NS` - Tata Consultancy Services
- `INFY.NS` - Infosys
- `HDFCBANK.NS` - HDFC Bank
- `ICICIBANK.NS` - ICICI Bank
- `HINDUNILVR.NS` - Hindustan Unilever
- `SBIN.NS` - State Bank of India
- `BHARTIARTL.NS` - Bharti Airtel

### Portfolio Features

- **Total Invested**: Sum of all your purchases
- **Current Value**: Real-time value of all holdings
- **Total P&L**: Overall profit or loss with percentage
- **Per-Stock P&L**: Individual profit/loss for each holding

## Tech Stack

- **Backend**: Node.js + Express
- **Session Management**: express-session
- **API**: yahoo-finance2
- **Frontend**: HTML + JavaScript (Vanilla)
- **Storage**: In-memory (can be replaced with database)

## Notes

- Stock prices are fetched in real-time from Yahoo Finance
- All trades are mock trades (no actual transactions)
- User data is stored in-memory (will be lost on server restart)
- The `.NS` suffix is required for Indian stocks on Yahoo Finance
- Average price is calculated using weighted average for multiple buys
- Profit/Loss is calculated based on average purchase price vs current price

## Future Enhancements

- Database integration (MongoDB/PostgreSQL)
- JWT authentication
- Order history with filters
- Watchlist feature
- Price alerts
- Charts and graphs
