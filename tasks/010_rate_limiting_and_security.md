# Task 010: Rate Limiting and Security

## Overview
Implement comprehensive security measures including rate limiting, security headers, CORS configuration, and protection against common web vulnerabilities.

## Scope
- Rate limiting implementation
- Security headers configuration
- CORS setup
- Input sanitization
- Security middleware
- Vulnerability protection

## Deliverables

### 1. Rate Limiting Implementation
- Tiered rate limiting based on user type
- Endpoint-specific rate limits
- Rate limit headers in responses
- Redis-based rate limiting storage
- Graceful rate limit error responses

#### Rate Limit Tiers:
- **Anonymous Users**: 60 requests per hour
- **Authenticated Users**: 100 requests per minute
- **Auth Endpoints**: 5 requests per 15 minutes
- **AI Recommendations**: 10 requests per hour per user

### 2. Rate Limiting Middleware
```typescript
// Rate limit configuration
const rateLimitConfig = {
  general: {
    windowMs: 60 * 1000, // 1 minute
    max: 100, // requests per window
    standardHeaders: true,
    legacyHeaders: false
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // requests per window
    skipSuccessfulRequests: true
  },
  recommendations: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // requests per window
    keyGenerator: (req) => req.user.userId
  }
};
```

### 3. Security Headers Implementation
- Helmet.js integration for security headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options protection
- X-Content-Type-Options
- Referrer Policy configuration

```typescript
// Security headers configuration
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.openai.com"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
};
```

### 4. CORS Configuration
- Environment-specific CORS settings
- Allowed origins configuration
- Credentials support
- Preflight request handling
- Method and header restrictions

```typescript
// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000', // Development
    'https://bookreview.com', // Production
    'https://staging.bookreview.com' // Staging
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};
```

### 5. Input Sanitization and Validation
- XSS prevention measures
- SQL injection protection (NoSQL injection)
- HTML sanitization for user content
- Parameter pollution protection
- File upload security (future)

### 6. Authentication Security Enhancements
- JWT secret rotation capability
- Token blacklisting mechanism
- Brute force protection
- Account lockout policies
- Secure session management

### 7. API Security Middleware Stack
```typescript
// Security middleware pipeline
app.use(helmet(helmetConfig));
app.use(cors(corsOptions));
app.use(rateLimiter.general);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize()); // NoSQL injection prevention
app.use(xss()); // XSS protection
```

### 8. Request Logging and Monitoring
- Comprehensive request logging
- Security event logging
- Suspicious activity detection
- IP-based monitoring
- Request pattern analysis

### 9. Error Handling Security
- Secure error responses
- Information disclosure prevention
- Stack trace sanitization
- Debug information control
- Error logging without exposure

### 10. Environment-Specific Security
- Development vs production configurations
- Secret management
- Environment variable validation
- Secure defaults
- Configuration validation

## Rate Limiting Response Headers

### Standard Headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 60
Retry-After: 45
```

### Rate Limit Exceeded Response:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retryAfter": 45,
    "limit": 100,
    "window": 60,
    "timestamp": "2024-01-15T20:00:00Z"
  },
  "requestId": "req-uuid-12345"
}
```

## Security Vulnerabilities Protection

### 1. Cross-Site Scripting (XSS)
- Input sanitization
- Output encoding
- Content Security Policy
- XSS protection headers

### 2. Cross-Site Request Forgery (CSRF)
- CSRF token implementation (if needed)
- SameSite cookie attributes
- Origin header validation
- Referer header checking

### 3. NoSQL Injection
- Input validation and sanitization
- Parameterized queries
- Mongoose schema validation
- Query sanitization

### 4. Denial of Service (DoS)
- Rate limiting implementation
- Request size limits
- Connection limits
- Resource usage monitoring

### 5. Information Disclosure
- Error message sanitization
- Debug information control
- Sensitive data exclusion
- Proper logging practices

## Acceptance Criteria
- [ ] Rate limiting is enforced for all endpoint categories
- [ ] Security headers are properly configured
- [ ] CORS allows only authorized origins
- [ ] Input sanitization prevents XSS attacks
- [ ] NoSQL injection protection is implemented
- [ ] Rate limit headers are included in responses
- [ ] Brute force protection works for auth endpoints
- [ ] Error responses don't leak sensitive information
- [ ] Security logging captures relevant events
- [ ] Environment-specific configurations work correctly
- [ ] Performance impact of security measures is minimal

## Dependencies
- Task 001: Project Setup and Infrastructure
- Task 003: Authentication and Authorization
- Task 009: Error Handling and Validation

## Estimated Time
8-10 hours

## Notes
- Use Redis for distributed rate limiting if scaling horizontally
- Implement security headers early in the middleware stack
- Test security measures with security scanning tools
- Consider implementing API key authentication for future
- Add comprehensive security logging for monitoring
- Regular security audits and dependency updates
- Consider implementing Web Application Firewall (WAF) rules
- Test with various attack scenarios and edge cases
