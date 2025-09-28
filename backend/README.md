# Book Review Platform API

A RESTful API for book discovery, reviews, and recommendations built with Node.js, Express, and TypeScript.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 8.0.0

### Installation

1. Clone the repository and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:5001`

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers (future)
│   ├── middleware/      # Express middleware
│   ├── models/          # Data models (future)
│   ├── routes/          # API routes
│   ├── services/        # Business logic (future)
│   ├── utils/           # Utility functions
│   └── app.ts           # Main application file
├── tests/               # Test files
├── docs/                # Documentation
└── scripts/             # Build and deployment scripts
```

## 🛠 Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the TypeScript project
- `npm start` - Start production server
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run typecheck` - Run TypeScript type checking

## 🔧 Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Server Configuration
PORT=5001
NODE_ENV=development
API_VERSION=v1

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
```

## 🏥 Health Checks

The API provides several health check endpoints:

- `GET /health` - Basic health status
- `GET /health/ready` - Readiness probe (for Kubernetes)
- `GET /health/live` - Liveness probe (for Kubernetes)

Example response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T10:30:00Z",
    "uptime": 3600,
    "environment": "development",
    "version": "v1",
    "services": {
      "database": "not_connected",
      "redis": "not_connected"
    }
  },
  "message": "Service is healthy"
}
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run tests in watch mode during development:
```bash
npm run test:watch
```

## 📝 Code Quality

This project uses ESLint and Prettier for code quality and formatting:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Check formatting
npm run format:check

# Format code
npm run format
```

## 🔒 Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - Request rate limiting
- **Input Validation** - Request validation (future)
- **JWT Authentication** - Token-based auth (future)

## 📊 Logging

The application uses a custom logger with different log levels:
- `error` - Error messages
- `warn` - Warning messages
- `info` - Informational messages
- `debug` - Debug messages

Configure log level with the `LOG_LEVEL` environment variable.

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Docker (Future)

Docker configuration will be added in future tasks.

## 📚 API Documentation

API documentation will be available at `/docs` once implemented. The API follows RESTful conventions and returns JSON responses.

### Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": {},
  "message": "Optional message",
  "meta": {
    "pagination": {}
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "timestamp": "2024-01-15T10:30:00Z",
    "path": "/api/endpoint",
    "method": "GET"
  },
  "requestId": "unique-request-id"
}
```

## 🔄 Development Workflow

1. Create feature branch
2. Make changes
3. Run tests: `npm test`
4. Check linting: `npm run lint`
5. Check formatting: `npm run format:check`
6. Build project: `npm run build`
7. Commit and push changes

## 🤝 Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation as needed
4. Ensure all checks pass before submitting PR

## 📄 License

This project is licensed under the MIT License.# Deployment Test - Sun Sep 28 18:16:39 IST 2025
# Test connection after key setup - Sun Sep 28 18:18:41 IST 2025
# SSM Deployment Test - Sun Sep 28 19:03:37 IST 2025
