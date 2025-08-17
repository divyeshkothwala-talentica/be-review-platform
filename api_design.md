# API Design Document
# Book Review Platform

**Version:** 1.0  
**Date:** December 2024  
**Status:** API Design Specification

---

## Table of Contents
1. [API Overview](#1-api-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Endpoint Design](#3-endpoint-design)
4. [Data Models & Schemas](#4-data-models--schemas)
5. [Error Handling](#5-error-handling)
6. [API Features](#6-api-features)
7. [Documentation & Examples](#7-documentation--examples)

---

## 1. API Overview

### 1.1 Base Configuration
- **Base URL:** `https://api.bookreview.com/v1`
- **Protocol:** HTTPS only
- **Data Format:** JSON
- **Authentication:** JWT Bearer tokens
- **Versioning:** URL path versioning (`/v1/`)
- **Rate Limiting:** 100 requests per minute per user

### 1.2 HTTP Methods & Usage
- **GET:** Retrieve resources (idempotent)
- **POST:** Create new resources
- **PUT:** Update entire resources (idempotent)
- **PATCH:** Partial resource updates
- **DELETE:** Remove resources (idempotent)

### 1.3 Standard Headers
```http
Content-Type: application/json
Authorization: Bearer <jwt_token>
Accept: application/json
X-API-Version: v1
```

---

## 2. Authentication & Authorization

### 2.1 Authentication Strategy

#### JWT Token Structure
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "iat": 1640995200,
    "exp": 1641081600,
    "iss": "book-review-platform",
    "aud": "book-review-users"
  }
}
```

#### Token Lifecycle
- **Expiration:** 24 hours
- **Refresh:** Client must re-authenticate
- **Storage:** Client-side (localStorage/sessionStorage)
- **Transmission:** Authorization header with Bearer scheme

### 2.2 Authorization Levels

#### Public Access (No Authentication)
- Browse books catalog
- Read book details and reviews
- Search functionality
- View public user profiles

#### Authenticated Users
- Create, edit, delete own reviews
- Manage favorites list
- Access personalized recommendations
- Update profile information

#### Admin Users (Future Scope)
- Manage book catalog
- Moderate reviews
- User management

### 2.3 Authentication Endpoints

#### POST /auth/register
Register a new user account.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User registered successfully"
}
```

#### POST /auth/login
Authenticate user and receive JWT token.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

#### POST /auth/logout
Invalidate current session (client-side token removal).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### GET /auth/me
Get current user information (requires authentication).

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

---

## 3. Endpoint Design

### 3.1 Books Resource

#### GET /books
Retrieve paginated list of books with filtering and sorting.

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 12, max: 50): Items per page
- `search` (string): Search by title or author
- `genres` (array): Filter by genres
- `sort` (string): Sort options (newest, rating, reviews)
- `author` (string): Filter by specific author

**Example Request:**
```http
GET /v1/books?page=1&limit=12&search=harry&genres=fantasy,adventure&sort=rating
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "books": [
      {
        "id": "book-uuid-1",
        "title": "Harry Potter and the Philosopher's Stone",
        "author": "J.K. Rowling",
        "description": "The first book in the Harry Potter series...",
        "coverImageUrl": "https://cdn.example.com/covers/hp1.jpg",
        "genres": ["fantasy", "adventure", "young-adult"],
        "publishedYear": 1997,
        "averageRating": 4.7,
        "totalReviews": 1250,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-15T12:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 8,
      "totalItems": 95,
      "itemsPerPage": 12,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### GET /books/{bookId}
Retrieve detailed information about a specific book.

**Path Parameters:**
- `bookId` (UUID, required): Unique book identifier

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "book": {
      "id": "book-uuid-1",
      "title": "Harry Potter and the Philosopher's Stone",
      "author": "J.K. Rowling",
      "description": "The first book in the Harry Potter series follows Harry Potter, a young wizard who discovers his magical heritage on his eleventh birthday...",
      "coverImageUrl": "https://cdn.example.com/covers/hp1.jpg",
      "genres": ["fantasy", "adventure", "young-adult"],
      "publishedYear": 1997,
      "averageRating": 4.7,
      "totalReviews": 1250,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T12:00:00Z"
    }
  }
}
```

#### GET /books/{bookId}/reviews
Get reviews for a specific book with pagination.

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 10, max: 50): Items per page
- `sort` (string): Sort by newest, oldest, rating_high, rating_low

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review-uuid-1",
        "bookId": "book-uuid-1",
        "userId": "user-uuid-1",
        "userName": "Alice Johnson",
        "text": "An absolutely magical start to the series. Rowling's world-building is exceptional...",
        "rating": 5,
        "createdAt": "2024-01-10T14:30:00Z",
        "updatedAt": "2024-01-10T14:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 125,
      "totalItems": 1250,
      "itemsPerPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### GET /books/genres
Get list of available genres for filtering.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "genres": [
      "fiction",
      "non-fiction",
      "mystery",
      "thriller",
      "romance",
      "fantasy",
      "science-fiction",
      "biography",
      "history",
      "self-help"
    ]
  }
}
```

### 3.2 Reviews Resource

#### POST /reviews
Create a new book review (requires authentication).

**Request:**
```json
{
  "bookId": "book-uuid-1",
  "text": "This book completely changed my perspective on fantasy literature. The character development is outstanding...",
  "rating": 5
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "review": {
      "id": "review-uuid-new",
      "bookId": "book-uuid-1",
      "userId": "user-uuid-1",
      "text": "This book completely changed my perspective on fantasy literature...",
      "rating": 5,
      "createdAt": "2024-01-15T16:45:00Z",
      "updatedAt": "2024-01-15T16:45:00Z"
    }
  },
  "message": "Review created successfully"
}
```

#### PUT /reviews/{reviewId}
Update an existing review (requires authentication, own review only).

**Path Parameters:**
- `reviewId` (UUID, required): Review identifier

**Request:**
```json
{
  "text": "Updated review text with more detailed thoughts...",
  "rating": 4
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "review": {
      "id": "review-uuid-1",
      "bookId": "book-uuid-1",
      "userId": "user-uuid-1",
      "text": "Updated review text with more detailed thoughts...",
      "rating": 4,
      "createdAt": "2024-01-10T14:30:00Z",
      "updatedAt": "2024-01-15T17:00:00Z"
    }
  },
  "message": "Review updated successfully"
}
```

#### DELETE /reviews/{reviewId}
Delete a review (requires authentication, own review only).

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

#### GET /reviews/user/{userId}
Get all reviews by a specific user.

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 10, max: 50): Items per page

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "id": "review-uuid-1",
        "bookId": "book-uuid-1",
        "bookTitle": "Harry Potter and the Philosopher's Stone",
        "bookCoverUrl": "https://cdn.example.com/covers/hp1.jpg",
        "text": "An absolutely magical start to the series...",
        "rating": 5,
        "createdAt": "2024-01-10T14:30:00Z",
        "updatedAt": "2024-01-10T14:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 25,
      "itemsPerPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### 3.3 Favorites Resource

#### GET /favorites
Get user's favorite books (requires authentication).

**Query Parameters:**
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 12, max: 50): Items per page

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "favorites": [
      {
        "id": "favorite-uuid-1",
        "bookId": "book-uuid-1",
        "book": {
          "id": "book-uuid-1",
          "title": "Harry Potter and the Philosopher's Stone",
          "author": "J.K. Rowling",
          "coverImageUrl": "https://cdn.example.com/covers/hp1.jpg",
          "averageRating": 4.7,
          "totalReviews": 1250
        },
        "createdAt": "2024-01-12T09:15:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalItems": 15,
      "itemsPerPage": 12,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### POST /favorites
Add a book to favorites (requires authentication).

**Request:**
```json
{
  "bookId": "book-uuid-1"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "favorite": {
      "id": "favorite-uuid-new",
      "userId": "user-uuid-1",
      "bookId": "book-uuid-1",
      "createdAt": "2024-01-15T18:00:00Z"
    }
  },
  "message": "Book added to favorites"
}
```

#### DELETE /favorites/{bookId}
Remove a book from favorites (requires authentication).

**Path Parameters:**
- `bookId` (UUID, required): Book identifier to remove from favorites

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Book removed from favorites"
}
```

### 3.4 Recommendations Resource

#### GET /recommendations
Get AI-powered book recommendations for authenticated user.

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "book": {
          "id": "book-uuid-5",
          "title": "The Name of the Wind",
          "author": "Patrick Rothfuss",
          "coverImageUrl": "https://cdn.example.com/covers/notw.jpg",
          "averageRating": 4.5,
          "totalReviews": 890,
          "genres": ["fantasy", "adventure"]
        },
        "reason": "Based on your love for Harry Potter, you'll enjoy this beautifully written fantasy with rich world-building and compelling magic system.",
        "confidence": 0.92
      },
      {
        "book": {
          "id": "book-uuid-6",
          "title": "The Hobbit",
          "author": "J.R.R. Tolkien",
          "coverImageUrl": "https://cdn.example.com/covers/hobbit.jpg",
          "averageRating": 4.6,
          "totalReviews": 2100,
          "genres": ["fantasy", "adventure", "classic"]
        },
        "reason": "A timeless fantasy classic that shares the adventure and magical elements you enjoy.",
        "confidence": 0.88
      },
      {
        "book": {
          "id": "book-uuid-7",
          "title": "Mistborn: The Final Empire",
          "author": "Brandon Sanderson",
          "coverImageUrl": "https://cdn.example.com/covers/mistborn.jpg",
          "averageRating": 4.4,
          "totalReviews": 1560,
          "genres": ["fantasy", "adventure"]
        },
        "reason": "Features an innovative magic system and strong character development similar to your favorite reads.",
        "confidence": 0.85
      }
    ],
    "generatedAt": "2024-01-15T18:30:00Z",
    "basedOn": {
      "favoriteGenres": ["fantasy", "adventure", "young-adult"],
      "favoriteBooks": 5,
      "totalReviews": 12
    }
  }
}
```

### 3.5 Users Resource

#### GET /users/profile
Get current user's profile information (requires authentication).

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid-1",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-15T14:30:00Z",
      "stats": {
        "totalReviews": 12,
        "totalFavorites": 8,
        "averageRating": 4.2
      }
    }
  }
}
```

#### PUT /users/profile
Update user profile information (requires authentication).

**Request:**
```json
{
  "name": "John Smith",
  "email": "johnsmith@example.com"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid-1",
      "name": "John Smith",
      "email": "johnsmith@example.com",
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-15T19:00:00Z"
    }
  },
  "message": "Profile updated successfully"
}
```

---

## 4. Data Models & Schemas

### 4.1 Core Data Models

#### User Model
```json
{
  "id": "UUID (primary key)",
  "name": "string (required, 2-100 chars)",
  "email": "string (required, unique, valid email)",
  "password": "string (hashed, min 8 chars)",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

#### Book Model
```json
{
  "id": "UUID (primary key)",
  "title": "string (required, 1-200 chars)",
  "author": "string (required, 1-100 chars)",
  "description": "string (required, 10-2000 chars)",
  "coverImageUrl": "string (required, valid URL)",
  "genres": "array of strings (required, 1-5 items)",
  "publishedYear": "integer (1000-current year)",
  "averageRating": "decimal (0.0-5.0, 1 decimal place)",
  "totalReviews": "integer (default: 0)",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

#### Review Model
```json
{
  "id": "UUID (primary key)",
  "bookId": "UUID (foreign key, required)",
  "userId": "UUID (foreign key, required)",
  "text": "string (required, 1-2000 chars)",
  "rating": "integer (1-5, required)",
  "createdAt": "ISO 8601 timestamp",
  "updatedAt": "ISO 8601 timestamp"
}
```

#### Favorite Model
```json
{
  "id": "UUID (primary key)",
  "userId": "UUID (foreign key, required)",
  "bookId": "UUID (foreign key, required)",
  "createdAt": "ISO 8601 timestamp"
}
```

### 4.2 Validation Rules

#### User Registration
```json
{
  "name": {
    "required": true,
    "type": "string",
    "minLength": 2,
    "maxLength": 100,
    "pattern": "^[a-zA-Z\\s]+$"
  },
  "email": {
    "required": true,
    "type": "string",
    "format": "email",
    "unique": true
  },
  "password": {
    "required": true,
    "type": "string",
    "minLength": 8,
    "pattern": "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d@$!%*?&]{8,}$"
  }
}
```

#### Review Creation
```json
{
  "bookId": {
    "required": true,
    "type": "string",
    "format": "uuid"
  },
  "text": {
    "required": true,
    "type": "string",
    "minLength": 1,
    "maxLength": 2000,
    "sanitize": true
  },
  "rating": {
    "required": true,
    "type": "integer",
    "minimum": 1,
    "maximum": 5
  }
}
```

### 4.3 Response Schemas

#### Standard Success Response
```json
{
  "success": true,
  "data": {
    // Resource-specific data
  },
  "message": "Optional success message",
  "meta": {
    // Optional metadata (pagination, etc.)
  }
}
```

#### Pagination Schema
```json
{
  "pagination": {
    "currentPage": "integer",
    "totalPages": "integer",
    "totalItems": "integer",
    "itemsPerPage": "integer",
    "hasNextPage": "boolean",
    "hasPrevPage": "boolean"
  }
}
```

---

## 5. Error Handling

### 5.1 Standard Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error details (optional)",
    "field": "Specific field causing error (for validation errors)",
    "timestamp": "2024-01-15T20:00:00Z",
    "path": "/v1/reviews",
    "method": "POST"
  },
  "requestId": "req-uuid-12345"
}
```

### 5.2 HTTP Status Codes

#### Success Codes
- **200 OK:** Successful GET, PUT, DELETE operations
- **201 Created:** Successful POST operations
- **204 No Content:** Successful DELETE with no response body

#### Client Error Codes
- **400 Bad Request:** Invalid request format or parameters
- **401 Unauthorized:** Missing or invalid authentication
- **403 Forbidden:** Valid auth but insufficient permissions
- **404 Not Found:** Resource doesn't exist
- **409 Conflict:** Resource conflict (duplicate review, etc.)
- **422 Unprocessable Entity:** Validation errors
- **429 Too Many Requests:** Rate limit exceeded

#### Server Error Codes
- **500 Internal Server Error:** Unexpected server error
- **502 Bad Gateway:** External service unavailable
- **503 Service Unavailable:** Server temporarily unavailable

### 5.3 Error Code Definitions

#### Authentication Errors
```json
{
  "INVALID_CREDENTIALS": "Email or password is incorrect",
  "TOKEN_EXPIRED": "JWT token has expired",
  "TOKEN_INVALID": "JWT token is malformed or invalid",
  "UNAUTHORIZED": "Authentication required for this endpoint"
}
```

#### Validation Errors
```json
{
  "VALIDATION_ERROR": "Request validation failed",
  "REQUIRED_FIELD": "Required field is missing",
  "INVALID_FORMAT": "Field format is invalid",
  "DUPLICATE_ENTRY": "Resource already exists"
}
```

#### Resource Errors
```json
{
  "BOOK_NOT_FOUND": "Book with specified ID does not exist",
  "REVIEW_NOT_FOUND": "Review with specified ID does not exist",
  "USER_NOT_FOUND": "User with specified ID does not exist",
  "REVIEW_EXISTS": "User has already reviewed this book"
}
```

#### Rate Limiting Errors
```json
{
  "RATE_LIMIT_EXCEEDED": "Too many requests. Please try again later",
  "DAILY_LIMIT_EXCEEDED": "Daily API limit reached"
}
```

### 5.4 Validation Error Examples

#### Multiple Field Validation Errors
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email format is invalid",
        "value": "invalid-email"
      },
      {
        "field": "password",
        "message": "Password must be at least 8 characters",
        "value": "123"
      }
    ],
    "timestamp": "2024-01-15T20:00:00Z",
    "path": "/v1/auth/register",
    "method": "POST"
  },
  "requestId": "req-uuid-12345"
}
```

---

## 6. API Features

### 6.1 Pagination Strategy

#### Query Parameters
- `page`: Page number (default: 1, min: 1)
- `limit`: Items per page (default: varies by endpoint, max: 50)

#### Response Format
```json
{
  "data": {
    "items": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalItems": 95,
      "itemsPerPage": 10,
      "hasNextPage": true,
      "hasPrevPage": false,
      "nextPage": 2,
      "prevPage": null
    }
  }
}
```

#### Link Headers (Optional)
```http
Link: <https://api.bookreview.com/v1/books?page=2&limit=12>; rel="next",
      <https://api.bookreview.com/v1/books?page=8&limit=12>; rel="last"
```

### 6.2 Filtering and Sorting

#### Books Filtering
```http
GET /v1/books?genres=fantasy,adventure&author=tolkien&publishedYear=1954&minRating=4.0
```

#### Sorting Options
- `newest`: Sort by creation date (newest first)
- `oldest`: Sort by creation date (oldest first)
- `rating`: Sort by average rating (highest first)
- `rating_low`: Sort by average rating (lowest first)
- `reviews`: Sort by review count (most reviewed first)
- `title`: Sort alphabetically by title
- `author`: Sort alphabetically by author

#### Complex Query Example
```http
GET /v1/books?search=harry&genres=fantasy&sort=rating&page=1&limit=12
```

### 6.3 API Versioning

#### URL Path Versioning
- Current version: `/v1/`
- Future versions: `/v2/`, `/v3/`
- Version header support: `X-API-Version: v1`

#### Version Compatibility
- **Backward Compatibility:** Maintained for at least 12 months
- **Deprecation Notice:** 6 months advance notice via headers
- **Migration Guide:** Provided for major version changes

#### Deprecation Headers
```http
X-API-Deprecation-Warning: This API version will be deprecated on 2024-12-31
X-API-Migration-Guide: https://docs.bookreview.com/migration/v1-to-v2
```

### 6.4 Rate Limiting

#### Rate Limit Tiers
- **Anonymous Users:** 60 requests per hour
- **Authenticated Users:** 100 requests per minute
- **Premium Users (Future):** 500 requests per minute

#### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 60
```

#### Rate Limit Response (429)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retryAfter": 45,
    "limit": 100,
    "window": 60
  }
}
```

### 6.5 Caching Strategy

#### Cache Headers
```http
Cache-Control: public, max-age=300
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Last-Modified: Wed, 15 Jan 2024 12:00:00 GMT
```

#### Caching Rules
- **Book Listings:** 5 minutes
- **Book Details:** 15 minutes
- **Reviews:** 2 minutes
- **User Profile:** Private, no cache
- **Static Data (genres):** 1 hour

#### Conditional Requests
```http
GET /v1/books/book-uuid-1
If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
If-Modified-Since: Wed, 15 Jan 2024 12:00:00 GMT
```

**Response (304 Not Modified):**
```http
HTTP/1.1 304 Not Modified
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Cache-Control: public, max-age=900
```

---

## 7. Documentation & Examples

### 7.1 OpenAPI/Swagger Specification

#### Basic Info
```yaml
openapi: 3.0.3
info:
  title: Book Review Platform API
  description: RESTful API for book discovery, reviews, and recommendations
  version: 1.0.0
  contact:
    name: API Support
    email: api-support@bookreview.com
    url: https://docs.bookreview.com
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://api.bookreview.com/v1
    description: Production server
  - url: https://staging-api.bookreview.com/v1
    description: Staging server
  - url: http://localhost:5000/v1
    description: Development server
```

#### Security Schemes
```yaml
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: JWT token obtained from /auth/login endpoint

security:
  - BearerAuth: []
```

### 7.2 Complete CRUD Example: Reviews

#### Create Review
```bash
curl -X POST https://api.bookreview.com/v1/reviews \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "bookId": "550e8400-e29b-41d4-a716-446655440001",
    "text": "An incredible journey through Middle-earth. Tolkien'\''s world-building is unmatched.",
    "rating": 5
  }'
```

#### Read Review
```bash
curl -X GET https://api.bookreview.com/v1/books/550e8400-e29b-41d4-a716-446655440001/reviews?page=1&limit=10 \
  -H "Accept: application/json"
```

#### Update Review
```bash
curl -X PUT https://api.bookreview.com/v1/reviews/review-uuid-123 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "text": "Updated: An incredible journey through Middle-earth with even more appreciation after re-reading.",
    "rating": 5
  }'
```

#### Delete Review
```bash
curl -X DELETE https://api.bookreview.com/v1/reviews/review-uuid-123 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 7.3 Complex Query Examples

#### Advanced Book Search
```bash
# Search for fantasy books by multiple authors with high ratings
curl -X GET "https://api.bookreview.com/v1/books?search=dragon&genres=fantasy,adventure&minRating=4.0&sort=rating&page=1&limit=20" \
  -H "Accept: application/json"
```

#### User's Reading History
```bash
# Get user's reviews with book details
curl -X GET "https://api.bookreview.com/v1/reviews/user/user-uuid-123?page=1&limit=10&sort=newest" \
  -H "Accept: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

#### Personalized Recommendations
```bash
# Get AI-powered recommendations
curl -X GET https://api.bookreview.com/v1/recommendations \
  -H "Accept: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 7.4 Authentication Flow Example

#### Complete Authentication Workflow
```bash
# 1. Register new user
curl -X POST https://api.bookreview.com/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "password": "SecurePass123"
  }'

# 2. Login to get token
curl -X POST https://api.bookreview.com/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "alice@example.com",
    "password": "SecurePass123"
  }'

# 3. Use token for authenticated requests
curl -X GET https://api.bookreview.com/v1/auth/me \
  -H "Authorization: Bearer <token_from_login_response>"

# 4. Logout (client-side token removal)
curl -X POST https://api.bookreview.com/v1/auth/logout \
  -H "Authorization: Bearer <token>"
```

### 7.5 Error Handling Examples

#### Validation Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      {
        "field": "rating",
        "message": "Rating must be between 1 and 5",
        "value": 6
      }
    ],
    "timestamp": "2024-01-15T20:00:00Z",
    "path": "/v1/reviews",
    "method": "POST"
  },
  "requestId": "req-550e8400-e29b-41d4-a716-446655440000"
}
```

#### Resource Not Found
```json
{
  "success": false,
  "error": {
    "code": "BOOK_NOT_FOUND",
    "message": "Book with ID '550e8400-e29b-41d4-a716-446655440999' does not exist",
    "timestamp": "2024-01-15T20:00:00Z",
    "path": "/v1/books/550e8400-e29b-41d4-a716-446655440999",
    "method": "GET"
  },
  "requestId": "req-550e8400-e29b-41d4-a716-446655440001"
}
```

### 7.6 SDK/Client Library Considerations

#### JavaScript/TypeScript SDK Structure
```typescript
// Example SDK interface
interface BookReviewAPI {
  auth: {
    register(data: RegisterData): Promise<AuthResponse>;
    login(credentials: LoginCredentials): Promise<AuthResponse>;
    logout(): Promise<void>;
    getCurrentUser(): Promise<User>;
  };
  
  books: {
    list(params?: BookListParams): Promise<PaginatedBooks>;
    getById(id: string): Promise<Book>;
    getReviews(id: string, params?: ReviewListParams): Promise<PaginatedReviews>;
    getGenres(): Promise<string[]>;
  };
  
  reviews: {
    create(data: CreateReviewData): Promise<Review>;
    update(id: string, data: UpdateReviewData): Promise<Review>;
    delete(id: string): Promise<void>;
    getByUser(userId: string, params?: ReviewListParams): Promise<PaginatedReviews>;
  };
  
  favorites: {
    list(params?: PaginationParams): Promise<PaginatedFavorites>;
    add(bookId: string): Promise<Favorite>;
    remove(bookId: string): Promise<void>;
  };
  
  recommendations: {
    get(): Promise<Recommendation[]>;
  };
}
```

#### SDK Usage Example
```typescript
import { BookReviewAPI } from '@bookreview/sdk';

const api = new BookReviewAPI({
  baseURL: 'https://api.bookreview.com/v1',
  apiKey: 'your-api-key'
});

// Authenticate
const { token } = await api.auth.login({
  email: 'user@example.com',
  password: 'password'
});

// Search books
const books = await api.books.list({
  search: 'harry potter',
  genres: ['fantasy'],
  page: 1,
  limit: 12
});

// Create review
const review = await api.reviews.create({
  bookId: 'book-uuid-1',
  text: 'Great book!',
  rating: 5
});
```

---

## Conclusion

This comprehensive API design provides a solid foundation for the Book Review Platform with:

**Key Strengths:**
- **RESTful Design:** Follows HTTP standards and REST principles
- **Comprehensive Documentation:** Clear examples and specifications
- **Scalable Architecture:** Supports growth and feature expansion
- **Developer-Friendly:** Consistent patterns and error handling
- **Security-First:** JWT authentication and input validation
- **Performance-Optimized:** Caching, pagination, and rate limiting

**Implementation Priorities:**
1. Core authentication and authorization system
2. Book catalog and search functionality
3. Review CRUD operations with validation
4. User profiles and favorites management
5. AI-powered recommendations integration
6. Comprehensive error handling and monitoring

This API design balances immediate MVP requirements with long-term scalability, providing clear endpoints for all core functionality while maintaining flexibility for future enhancements.
