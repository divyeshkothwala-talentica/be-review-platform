# API Integration Documentation PRD
# Book Review Platform - Frontend Integration Guide

**Version:** 1.0  
**Date:** December 2024  
**Status:** API Integration Specification  
**Target Audience:** Frontend Development Team

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [API Overview](#2-api-overview)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Core API Endpoints](#4-core-api-endpoints)
5. [Data Models & Response Schemas](#5-data-models--response-schemas)
6. [Error Handling](#6-error-handling)
7. [Frontend Integration Guidelines](#7-frontend-integration-guidelines)
8. [State Management Recommendations](#8-state-management-recommendations)
9. [Performance & Caching](#9-performance--caching)
10. [Testing & Development](#10-testing--development)

---

## 1. Executive Summary

### 1.1 Purpose
This document provides comprehensive API integration guidelines for the frontend development team to successfully integrate with the Book Review Platform backend API. It includes detailed endpoint documentation, data schemas, authentication flows, and best practices for optimal user experience.

### 1.2 API Characteristics
- **Architecture:** RESTful API with JSON responses
- **Base URL:** `http://localhost:5000/api/v1` (development)
- **Authentication:** JWT Bearer token-based
- **Rate Limiting:** Implemented per endpoint
- **Response Format:** Standardized JSON with consistent structure
- **Error Handling:** HTTP status codes with detailed error messages

### 1.3 Key Integration Points
- **User Authentication:** Registration, login, profile management
- **Book Discovery:** Search, filtering, pagination
- **Review System:** CRUD operations with real-time rating updates
- **Favorites Management:** Add/remove books from user favorites
- **AI Recommendations:** Personalized book suggestions
- **User Profiles:** Statistics and activity tracking

---

## 2. API Overview

### 2.1 Base Configuration
```javascript
const API_CONFIG = {
  baseURL: 'http://localhost:5000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
};
```

### 2.2 Standard Response Format
All API responses follow this consistent structure:

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Resource-specific data
  },
  "message": "Optional success message",
  "pagination": {
    // Pagination info (for paginated endpoints)
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "details": "Additional error details"
  }
}
```

### 2.3 HTTP Status Codes
- **200 OK:** Successful GET, PUT, DELETE operations
- **201 Created:** Successful POST operations
- **400 Bad Request:** Invalid request data
- **401 Unauthorized:** Authentication required
- **403 Forbidden:** Insufficient permissions
- **404 Not Found:** Resource not found
- **409 Conflict:** Resource conflict (duplicate data)
- **422 Unprocessable Entity:** Validation errors
- **429 Too Many Requests:** Rate limit exceeded
- **500 Internal Server Error:** Server error

---

## 3. Authentication & Authorization

### 3.1 Authentication Flow

#### Registration Flow
```javascript
// POST /auth/register
const registerUser = async (userData) => {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: userData.name,
      email: userData.email,
      password: userData.password
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    // Store token and user data
    localStorage.setItem('authToken', result.data.token);
    localStorage.setItem('user', JSON.stringify(result.data.user));
  }
  
  return result;
};
```

#### Login Flow
```javascript
// POST /auth/login
const loginUser = async (credentials) => {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: credentials.email,
      password: credentials.password
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    localStorage.setItem('authToken', result.data.token);
    localStorage.setItem('user', JSON.stringify(result.data.user));
  }
  
  return result;
};
```

### 3.2 Token Management
```javascript
// Token utilities
const TokenManager = {
  getToken: () => localStorage.getItem('authToken'),
  
  setToken: (token) => localStorage.setItem('authToken', token),
  
  removeToken: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  },
  
  isTokenValid: () => {
    const token = TokenManager.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  },
  
  getAuthHeaders: () => {
    const token = TokenManager.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
};
```

### 3.3 Protected Route Implementation
```javascript
// Axios interceptor for automatic token attachment
axios.interceptors.request.use(
  (config) => {
    const token = TokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for token expiration handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      TokenManager.removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 4. Core API Endpoints

### 4.1 Authentication Endpoints

#### POST /auth/register
**Purpose:** Register a new user account

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user-uuid-123",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User registered successfully"
}
```

#### POST /auth/login
**Purpose:** Authenticate user and receive JWT token

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user-uuid-123",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

#### GET /auth/me
**Purpose:** Get current user profile
**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user-uuid-123",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

#### POST /auth/logout
**Purpose:** Logout user (client-side token invalidation)
**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 4.2 Books Endpoints

#### GET /books
**Purpose:** Get paginated list of books with filtering and sorting

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 12, max: 50): Items per page
- `search` (string): Search by title, author, or description
- `genres` (string): Comma-separated list of genres
- `sort` (string): Sort options - `newest`, `rating`, `reviews`, `title`, `author`
- `author` (string): Filter by specific author
- `minRating` (number): Minimum average rating filter
- `publishedYear` (number): Filter by publication year

**Example Request:**
```javascript
const getBooks = async (params = {}) => {
  const queryString = new URLSearchParams({
    page: params.page || 1,
    limit: params.limit || 12,
    ...(params.search && { search: params.search }),
    ...(params.genres && { genres: params.genres.join(',') }),
    ...(params.sort && { sort: params.sort }),
    ...(params.author && { author: params.author }),
    ...(params.minRating && { minRating: params.minRating }),
    ...(params.publishedYear && { publishedYear: params.publishedYear })
  }).toString();
  
  const response = await fetch(`${API_BASE}/books?${queryString}`);
  return response.json();
};
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "books": [
      {
        "_id": "book-uuid-1",
        "title": "The Great Gatsby",
        "author": "F. Scott Fitzgerald",
        "description": "A classic American novel set in the Jazz Age...",
        "coverImageUrl": "https://example.com/covers/gatsby.jpg",
        "genres": ["Fiction", "Classic"],
        "publishedYear": 1925,
        "averageRating": 4.2,
        "totalReviews": 1250,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-15T12:00:00Z"
      }
    ]
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 8,
    "totalItems": 95,
    "itemsPerPage": 12,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### GET /books/:bookId
**Purpose:** Get detailed information about a specific book

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "book": {
      "_id": "book-uuid-1",
      "title": "The Great Gatsby",
      "author": "F. Scott Fitzgerald",
      "description": "A classic American novel set in the Jazz Age that explores themes of wealth, love, idealism, and moral decay in America during the Roaring Twenties.",
      "coverImageUrl": "https://example.com/covers/gatsby.jpg",
      "genres": ["Fiction", "Classic"],
      "publishedYear": 1925,
      "averageRating": 4.2,
      "totalReviews": 1250,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T12:00:00Z"
    }
  }
}
```

#### GET /books/genres
**Purpose:** Get list of available genres for filtering

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "genres": [
      "Fiction",
      "Non-Fiction",
      "Mystery",
      "Thriller",
      "Romance",
      "Science Fiction",
      "Fantasy",
      "Horror",
      "Biography",
      "History",
      "Self-Help",
      "Business"
    ]
  }
}
```

#### GET /books/:bookId/reviews
**Purpose:** Get paginated reviews for a specific book

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10, max: 50): Items per page
- `sort` (string): Sort options - `newest`, `oldest`, `rating_high`, `rating_low`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "_id": "review-uuid-1",
        "bookId": "book-uuid-1",
        "userId": "user-uuid-1",
        "text": "A masterpiece of American literature. Fitzgerald's prose is beautiful and the themes are timeless.",
        "rating": 5,
        "createdAt": "2024-01-10T14:30:00Z",
        "updatedAt": "2024-01-10T14:30:00Z",
        "user": {
          "_id": "user-uuid-1",
          "name": "Alice Johnson"
        }
      }
    ]
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 125,
    "totalItems": 1250,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 4.3 Reviews Endpoints

#### POST /reviews
**Purpose:** Create a new book review
**Authentication:** Required

**Request Body:**
```json
{
  "bookId": "book-uuid-1",
  "text": "This book completely changed my perspective on American literature. The symbolism is incredible.",
  "rating": 5
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "review": {
      "_id": "review-uuid-new",
      "bookId": "book-uuid-1",
      "userId": "user-uuid-1",
      "text": "This book completely changed my perspective on American literature. The symbolism is incredible.",
      "rating": 5,
      "createdAt": "2024-01-15T16:45:00Z",
      "updatedAt": "2024-01-15T16:45:00Z"
    }
  },
  "message": "Review created successfully"
}
```

#### PUT /reviews/:reviewId
**Purpose:** Update an existing review
**Authentication:** Required (owner only)

**Request Body:**
```json
{
  "text": "Updated review text with more detailed thoughts...",
  "rating": 4
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "review": {
      "_id": "review-uuid-1",
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

#### DELETE /reviews/:reviewId
**Purpose:** Delete a review
**Authentication:** Required (owner only)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Review deleted successfully"
}
```

#### GET /reviews/user/:userId
**Purpose:** Get all reviews by a specific user

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 10, max: 50): Items per page
- `sort` (string): Sort options - `newest`, `oldest`, `rating_high`, `rating_low`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "_id": "review-uuid-1",
        "bookId": "book-uuid-1",
        "userId": "user-uuid-1",
        "text": "A masterpiece of American literature...",
        "rating": 5,
        "createdAt": "2024-01-10T14:30:00Z",
        "updatedAt": "2024-01-10T14:30:00Z",
        "book": {
          "_id": "book-uuid-1",
          "title": "The Great Gatsby",
          "author": "F. Scott Fitzgerald",
          "coverImageUrl": "https://example.com/covers/gatsby.jpg"
        }
      }
    ]
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalItems": 25,
    "itemsPerPage": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### GET /reviews/check/:bookId
**Purpose:** Check if current user has reviewed a specific book
**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "hasReviewed": true,
    "review": {
      "_id": "review-uuid-1",
      "text": "My review text...",
      "rating": 4,
      "createdAt": "2024-01-10T14:30:00Z",
      "updatedAt": "2024-01-10T14:30:00Z"
    }
  }
}
```

### 4.4 Favorites Endpoints

#### GET /favorites
**Purpose:** Get user's favorite books
**Authentication:** Required

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 12, max: 50): Items per page

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "favorites": [
      {
        "_id": "favorite-uuid-1",
        "userId": "user-uuid-1",
        "bookId": "book-uuid-1",
        "createdAt": "2024-01-12T09:15:00Z",
        "book": {
          "_id": "book-uuid-1",
          "title": "The Great Gatsby",
          "author": "F. Scott Fitzgerald",
          "coverImageUrl": "https://example.com/covers/gatsby.jpg",
          "averageRating": 4.2,
          "totalReviews": 1250,
          "genres": ["Fiction", "Classic"]
        }
      }
    ]
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 2,
    "totalItems": 15,
    "itemsPerPage": 12,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

#### POST /favorites
**Purpose:** Add a book to favorites
**Authentication:** Required

**Request Body:**
```json
{
  "bookId": "book-uuid-1"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "favorite": {
      "_id": "favorite-uuid-new",
      "userId": "user-uuid-1",
      "bookId": "book-uuid-1",
      "createdAt": "2024-01-15T18:00:00Z"
    }
  },
  "message": "Book added to favorites"
}
```

#### DELETE /favorites/:bookId
**Purpose:** Remove a book from favorites
**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "message": "Book removed from favorites"
}
```

#### GET /favorites/check/:bookId
**Purpose:** Check if a book is in user's favorites
**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "isFavorited": true,
    "favoriteId": "favorite-uuid-1"
  }
}
```

### 4.5 User Profile Endpoints

#### GET /users/profile
**Purpose:** Get current user's complete profile with statistics
**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user-uuid-1",
      "name": "John Doe",
      "email": "john@example.com",
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-15T14:30:00Z"
    },
    "statistics": {
      "totalReviews": 12,
      "totalFavorites": 8,
      "averageRating": 4.2,
      "genrePreferences": [
        { "genre": "Fiction", "count": 5 },
        { "genre": "Mystery", "count": 3 },
        { "genre": "Science Fiction", "count": 2 }
      ]
    }
  }
}
```

#### PUT /users/profile
**Purpose:** Update user profile information
**Authentication:** Required

**Request Body:**
```json
{
  "name": "John Smith",
  "email": "johnsmith@example.com"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user-uuid-1",
      "name": "John Smith",
      "email": "johnsmith@example.com",
      "createdAt": "2024-01-01T10:00:00Z",
      "updatedAt": "2024-01-15T19:00:00Z"
    }
  },
  "message": "Profile updated successfully"
}
```

### 4.6 Recommendations Endpoints

#### GET /recommendations
**Purpose:** Get AI-powered book recommendations for authenticated user
**Authentication:** Required

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "book": {
          "_id": "book-uuid-5",
          "title": "To Kill a Mockingbird",
          "author": "Harper Lee",
          "coverImageUrl": "https://example.com/covers/mockingbird.jpg",
          "averageRating": 4.5,
          "totalReviews": 890,
          "genres": ["Fiction", "Classic"]
        },
        "reason": "Based on your love for classic American literature, you'll appreciate this powerful story about justice and morality.",
        "confidence": 0.92
      },
      {
        "book": {
          "_id": "book-uuid-6",
          "title": "1984",
          "author": "George Orwell",
          "coverImageUrl": "https://example.com/covers/1984.jpg",
          "averageRating": 4.6,
          "totalReviews": 2100,
          "genres": ["Fiction", "Dystopian"]
        },
        "reason": "A thought-provoking dystopian novel that complements your interest in literature with social commentary.",
        "confidence": 0.88
      }
    ],
    "generatedAt": "2024-01-15T18:30:00Z",
    "basedOn": {
      "favoriteGenres": ["Fiction", "Classic", "Mystery"],
      "favoriteBooks": 5,
      "totalReviews": 12
    }
  }
}
```

---

## 5. Data Models & Response Schemas

### 5.1 User Model
```typescript
interface User {
  _id: string;
  name: string;
  email: string;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

interface UserWithStats extends User {
  statistics: {
    totalReviews: number;
    totalFavorites: number;
    averageRating: number;
    genrePreferences: Array<{
      genre: string;
      count: number;
    }>;
  };
}
```

### 5.2 Book Model
```typescript
interface Book {
  _id: string;
  title: string;
  author: string;
  description: string;
  coverImageUrl: string;
  genres: string[];
  publishedYear: number;
  averageRating: number; // 0.0 to 5.0, rounded to 1 decimal
  totalReviews: number;
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

// Available genres
const VALID_GENRES = [
  'Fiction', 'Non-Fiction', 'Mystery', 'Thriller', 'Romance',
  'Science Fiction', 'Fantasy', 'Horror', 'Biography', 'History',
  'Self-Help', 'Business', 'Health', 'Travel', 'Cooking',
  'Art', 'Poetry', 'Drama', 'Adventure', 'Young Adult',
  'Children', 'Philosophy', 'Religion', 'Politics', 'Science', 'Technology'
];
```

### 5.3 Review Model
```typescript
interface Review {
  _id: string;
  bookId: string;
  userId: string;
  text: string;
  rating: number; // 1 to 5
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

interface ReviewWithUser extends Review {
  user: {
    _id: string;
    name: string;
  };
}

interface ReviewWithBook extends Review {
  book: {
    _id: string;
    title: string;
    author: string;
    coverImageUrl: string;
  };
}
```

### 5.4 Favorite Model
```typescript
interface Favorite {
  _id: string;
  userId: string;
  bookId: string;
  createdAt: string; // ISO 8601 timestamp
}

interface FavoriteWithBook extends Favorite {
  book: Book;
}
```

### 5.5 Recommendation Model
```typescript
interface Recommendation {
  book: Book;
  reason: string;
  confidence: number; // 0.0 to 1.0
}

interface RecommendationResponse {
  recommendations: Recommendation[];
  generatedAt: string; // ISO 8601 timestamp
  basedOn: {
    favoriteGenres: string[];
    favoriteBooks: number;
    totalReviews: number;
  };
}
```

### 5.6 Pagination Model
```typescript
interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface PaginatedResponse<T> {
  success: true;
  data: {
    [key: string]: T[]; // e.g., books: Book[], reviews: Review[]
  };
  pagination: Pagination;
}
```

---

## 6. Error Handling

### 6.1 Error Response Structure
```typescript
interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: string | object;
  };
}
```

### 6.2 Common Error Codes
```typescript
const ERROR_CODES = {
  // Authentication Errors
  INVALID_CREDENTIALS: 'Email or password is incorrect',
  TOKEN_EXPIRED: 'JWT token has expired',
  TOKEN_INVALID: 'JWT token is malformed or invalid',
  UNAUTHORIZED: 'Authentication required for this endpoint',
  
  // Validation Errors
  VALIDATION_ERROR: 'Request validation failed',
  REQUIRED_FIELD: 'Required field is missing',
  INVALID_FORMAT: 'Field format is invalid',
  DUPLICATE_ENTRY: 'Resource already exists',
  
  // Resource Errors
  BOOK_NOT_FOUND: 'Book with specified ID does not exist',
  REVIEW_NOT_FOUND: 'Review with specified ID does not exist',
  USER_NOT_FOUND: 'User with specified ID does not exist',
  REVIEW_EXISTS: 'User has already reviewed this book',
  FAVORITE_EXISTS: 'Book is already in favorites',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests. Please try again later',
  
  // Server Errors
  INTERNAL_ERROR: 'Internal server error occurred',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable'
};
```

### 6.3 Error Handling Implementation
```javascript
// Global error handler for API calls
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return {
          type: 'VALIDATION_ERROR',
          message: data.error?.message || 'Invalid request data',
          details: data.error?.details
        };
      
      case 401:
        TokenManager.removeToken();
        window.location.href = '/login';
        return {
          type: 'UNAUTHORIZED',
          message: 'Please log in to continue'
        };
      
      case 403:
        return {
          type: 'FORBIDDEN',
          message: 'You do not have permission to perform this action'
        };
      
      case 404:
        return {
          type: 'NOT_FOUND',
          message: data.error?.message || 'Resource not found'
        };
      
      case 409:
        return {
          type: 'CONFLICT',
          message: data.error?.message || 'Resource conflict'
        };
      
      case 422:
        return {
          type: 'VALIDATION_ERROR',
          message: 'Please check your input and try again',
          details: data.error?.details
        };
      
      case 429:
        return {
          type: 'RATE_LIMIT',
          message: 'Too many requests. Please wait before trying again'
        };
      
      case 500:
      default:
        return {
          type: 'SERVER_ERROR',
          message: 'Something went wrong. Please try again later'
        };
    }
  } else if (error.request) {
    // Network error
    return {
      type: 'NETWORK_ERROR',
      message: 'Unable to connect to server. Please check your internet connection'
    };
  } else {
    // Other error
    return {
      type: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred'
    };
  }
};

// Usage example
const createReview = async (reviewData) => {
  try {
    const response = await api.post('/reviews', reviewData);
    return { success: true, data: response.data };
  } catch (error) {
    const errorInfo = handleApiError(error);
    return { success: false, error: errorInfo };
  }
};
```

---

## 7. Frontend Integration Guidelines

### 7.1 API Client Setup
```javascript
// api/client.js
import axios from 'axios';
import { TokenManager } from '../utils/auth';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = TokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      TokenManager.removeToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

### 7.2 Service Layer Implementation
```javascript
// services/bookService.js
import apiClient from '../api/client';

export const bookService = {
  // Get books with filtering and pagination
  getBooks: async (params = {}) => {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          queryParams.append(key, value.join(','));
        } else {
          queryParams.append(key, value.toString());
        }
      }
    });
    
    return apiClient.get(`/books?${queryParams.toString()}`);
  },
  
  // Get book by ID
  getBookById: async (bookId) => {
    return apiClient.get(`/books/${bookId}`);
  },
  
  // Get book reviews
  getBookReviews: async (bookId, params = {}) => {
    const queryParams = new URLSearchParams(params);
    return apiClient.get(`/books/${bookId}/reviews?${queryParams.toString()}`);
  },
  
  // Get available genres
  getGenres: async () => {
    return apiClient.get('/books/genres');
  },
  
  // Search books
  searchBooks: async (searchTerm, filters = {}) => {
    return bookService.getBooks({
      search: searchTerm,
      ...filters
    });
  }
};

// services/reviewService.js
export const reviewService = {
  // Create review
  createReview: async (reviewData) => {
    return apiClient.post('/reviews', reviewData);
  },
  
  // Update review
  updateReview: async (reviewId, reviewData) => {
    return apiClient.put(`/reviews/${reviewId}`, reviewData);
  },
  
  // Delete review
  deleteReview: async (reviewId) => {
    return apiClient.delete(`/reviews/${reviewId}`);
  },
  
  // Get user reviews
  getUserReviews: async (userId, params = {}) => {
    const queryParams = new URLSearchParams(params);
    return apiClient.get(`/reviews/user/${userId}?${queryParams.toString()}`);
  },
  
  // Check if user has reviewed book
  checkUserBookReview: async (bookId) => {
    return apiClient.get(`/reviews/check/${bookId}`);
  }
};

// services/favoriteService.js
export const favoriteService = {
  // Get user favorites
  getFavorites: async (params = {}) => {
    const queryParams = new URLSearchParams(params);
    return apiClient.get(`/favorites?${queryParams.toString()}`);
  },
  
  // Add to favorites
  addToFavorites: async (bookId) => {
    return apiClient.post('/favorites', { bookId });
  },
  
  // Remove from favorites
  removeFromFavorites: async (bookId) => {
    return apiClient.delete(`/favorites/${bookId}`);
  },
  
  // Check favorite status
  checkFavoriteStatus: async (bookId) => {
    return apiClient.get(`/favorites/check/${bookId}`);
  },
  
  // Toggle favorite (utility function)
  toggleFavorite: async (bookId, isFavorited) => {
    if (isFavorited) {
      return favoriteService.removeFromFavorites(bookId);
    } else {
      return favoriteService.addToFavorites(bookId);
    }
  }
};

// services/userService.js
export const userService = {
  // Get user profile
  getProfile: async () => {
    return apiClient.get('/users/profile');
  },
  
  // Update profile
  updateProfile: async (profileData) => {
    return apiClient.put('/users/profile', profileData);
  },
  
  // Get user statistics
  getStatistics: async () => {
    return apiClient.get('/users/profile/statistics');
  }
};

// services/recommendationService.js
export const recommendationService = {
  // Get recommendations
  getRecommendations: async () => {
    return apiClient.get('/recommendations');
  },
  
  // Clear recommendation cache
  clearCache: async () => {
    return apiClient.delete('/recommendations/cache');
  }
};
```

### 7.3 Custom Hooks for Data Fetching
```javascript
// hooks/useBooks.js
import { useState, useEffect } from 'react';
import { bookService } from '../services/bookService';

export const useBooks = (params = {}) => {
  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchBooks = async (newParams = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await bookService.getBooks({ ...params, ...newParams });
      setBooks(response.data.books);
      setPagination(response.pagination);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchBooks();
  }, [JSON.stringify(params)]);
  
  return {
    books,
    pagination,
    loading,
    error,
    refetch: fetchBooks
  };
};

// hooks/useBook.js
export const useBook = (bookId) => {
  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!bookId) return;
    
    const fetchBook = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await bookService.getBookById(bookId);
        setBook(response.data.book);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBook();
  }, [bookId]);
  
  return { book, loading, error };
};

// hooks/useFavorites.js
export const useFavorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const fetchFavorites = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await favoriteService.getFavorites();
      setFavorites(response.data.favorites);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };
  
  const toggleFavorite = async (bookId) => {
    try {
      const isFavorited = favorites.some(fav => fav.bookId === bookId);
      await favoriteService.toggleFavorite(bookId, isFavorited);
      await fetchFavorites(); // Refresh list
      return !isFavorited;
    } catch (err) {
      setError(err);
      throw err;
    }
  };
  
  useEffect(() => {
    fetchFavorites();
  }, []);
  
  return {
    favorites,
    loading,
    error,
    toggleFavorite,
    refetch: fetchFavorites
  };
};
```

---

## 8. State Management Recommendations

### 8.1 Redux Store Structure
```javascript
// store/index.js
import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import booksSlice from './slices/booksSlice';
import reviewsSlice from './slices/reviewsSlice';
import favoritesSlice from './slices/favoritesSlice';
import uiSlice from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice,
    books: booksSlice,
    reviews: reviewsSlice,
    favorites: favoritesSlice,
    ui: uiSlice
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST']
      }
    })
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

### 8.2 Auth Slice Example
```javascript
// store/slices/authSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { authService } from '../../services/authService';
import { TokenManager } from '../../utils/auth';

// Async thunks
export const loginUser = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);
      TokenManager.setToken(response.data.token);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const registerUser = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData);
      TokenManager.setToken(response.data.token);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const getCurrentUser = createAsyncThunk(
  'auth/getCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.getCurrentUser();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: TokenManager.getToken(),
    isAuthenticated: TokenManager.isTokenValid(),
    loading: false,
    error: null
  },
  reducers: {
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      TokenManager.removeToken();
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Register
      .addCase(registerUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Get current user
      .addCase(getCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload.user;
      });
  }
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
```

### 8.3 Books Slice Example
```javascript
// store/slices/booksSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { bookService } from '../../services/bookService';

export const fetchBooks = createAsyncThunk(
  'books/fetchBooks',
  async (params, { rejectWithValue }) => {
    try {
      const response = await bookService.getBooks(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchBookById = createAsyncThunk(
  'books/fetchBookById',
  async (bookId, { rejectWithValue }) => {
    try {
      const response = await bookService.getBookById(bookId);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const booksSlice = createSlice({
  name: 'books',
  initialState: {
    items: [],
    currentBook: null,
    pagination: null,
    filters: {
      search: '',
      genres: [],
      sort: 'newest',
      page: 1,
      limit: 12
    },
    loading: false,
    error: null
  },
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearCurrentBook: (state) => {
      state.currentBook = null;
    },
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBooks.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBooks.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.data.books;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchBooks.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchBookById.fulfilled, (state, action) => {
        state.currentBook = action.payload.book;
      });
  }
});

export const { setFilters, clearCurrentBook, clearError } = booksSlice.actions;
export default booksSlice.reducer;
```

---

## 9. Performance & Caching

### 9.1 Client-Side Caching Strategy
```javascript
// utils/cache.js
class CacheManager {
  constructor() {
    this.cache = new Map();
    this.ttl = new Map(); // Time to live
  }
  
  set(key, value, ttlMs = 5 * 60 * 1000) { // Default 5 minutes
    this.cache.set(key, value);
    this.ttl.set(key, Date.now() + ttlMs);
  }
  
  get(key) {
    if (!this.cache.has(key)) return null;
    
    const expiry = this.ttl.get(key);
    if (Date.now() > expiry) {
      this.cache.delete(key);
      this.ttl.delete(key);
      return null;
    }
    
    return this.cache.get(key);
  }
  
  invalidate(pattern) {
    const keys = Array.from(this.cache.keys());
    keys.forEach(key => {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        this.ttl.delete(key);
      }
    });
  }
  
  clear() {
    this.cache.clear();
    this.ttl.clear();
  }
}

export const cache = new CacheManager();

// Enhanced API client with caching
const createCachedApiClient = () => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000
  });
  
  client.interceptors.request.use((config) => {
    // Only cache GET requests
    if (config.method === 'get') {
      const cacheKey = `${config.url}?${config.params ? new URLSearchParams(config.params).toString() : ''}`;
      const cachedResponse = cache.get(cacheKey);
      
      if (cachedResponse) {
        // Return cached response
        return Promise.resolve(cachedResponse);
      }
      
      // Store cache key for response interceptor
      config.metadata = { cacheKey };
    }
    
    return config;
  });
  
  client.interceptors.response.use((response) => {
    // Cache successful GET responses
    if (response.config.method === 'get' && response.config.metadata?.cacheKey) {
      const ttl = getCacheTTL(response.config.url);
      cache.set(response.config.metadata.cacheKey, response, ttl);
    }
    
    return response;
  });
  
  return client;
};

// Cache TTL configuration
const getCacheTTL = (url) => {
  if (url.includes('/books/genres')) return 60 * 60 * 1000; // 1 hour
  if (url.includes('/books/')) return 15 * 60 * 1000; // 15 minutes
  if (url.includes('/reviews/')) return 2 * 60 * 1000; // 2 minutes
  return 5 * 60 * 1000; // Default 5 minutes
};
```

### 9.2 Optimistic Updates
```javascript
// hooks/useOptimisticReviews.js
import { useState } from 'react';
import { reviewService } from '../services/reviewService';

export const useOptimisticReviews = (initialReviews = []) => {
  const [reviews, setReviews] = useState(initialReviews);
  const [loading, setLoading] = useState(false);
  
  const addReview = async (reviewData) => {
    // Optimistic update
    const tempReview = {
      _id: `temp-${Date.now()}`,
      ...reviewData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: { name: 'You' } // Current user
    };
    
    setReviews(prev => [tempReview, ...prev]);
    
    try {
      const response = await reviewService.createReview(reviewData);
      
      // Replace temp review with actual review
      setReviews(prev => 
        prev.map(review => 
          review._id === tempReview._id ? response.data.review : review
        )
      );
      
      return response;
    } catch (error) {
      // Remove temp review on error
      setReviews(prev => 
        prev.filter(review => review._id !== tempReview._id)
      );
      throw error;
    }
  };
  
  const updateReview = async (reviewId, reviewData) => {
    // Store original review for rollback
    const originalReview = reviews.find(r => r._id === reviewId);
    
    // Optimistic update
    setReviews(prev =>
      prev.map(review =>
        review._id === reviewId
          ? { ...review, ...reviewData, updatedAt: new Date().toISOString() }
          : review
      )
    );
    
    try {
      const response = await reviewService.updateReview(reviewId, reviewData);
      
      // Update with server response
      setReviews(prev =>
        prev.map(review =>
          review._id === reviewId ? response.data.review : review
        )
      );
      
      return response;
    } catch (error) {
      // Rollback on error
      setReviews(prev =>
        prev.map(review =>
          review._id === reviewId ? originalReview : review
        )
      );
      throw error;
    }
  };
  
  const deleteReview = async (reviewId) => {
    // Store original review for rollback
    const originalReview = reviews.find(r => r._id === reviewId);
    
    // Optimistic update
    setReviews(prev => prev.filter(review => review._id !== reviewId));
    
    try {
      await reviewService.deleteReview(reviewId);
    } catch (error) {
      // Rollback on error
      setReviews(prev => [...prev, originalReview].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      ));
      throw error;
    }
  };
  
  return {
    reviews,
    loading,
    addReview,
    updateReview,
    deleteReview
  };
};
```

### 9.3 Pagination Implementation
```javascript
// hooks/usePagination.js
import { useState, useCallback } from 'react';

export const usePagination = (fetchFunction, initialParams = {}) => {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [params, setParams] = useState({
    page: 1,
    limit: 12,
    ...initialParams
  });
  
  const fetchData = useCallback(async (newParams = {}) => {
    setLoading(true);
    setError(null);
    
    const finalParams = { ...params, ...newParams };
    
    try {
      const response = await fetchFunction(finalParams);
      
      if (finalParams.page === 1) {
        setData(response.data[Object.keys(response.data)[0]]);
      } else {
        // Append for infinite scroll
        setData(prev => [...prev, ...response.data[Object.keys(response.data)[0]]]);
      }
      
      setPagination(response.pagination);
      setParams(finalParams);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction, params]);
  
  const loadMore = useCallback(() => {
    if (pagination?.hasNextPage && !loading) {
      fetchData({ page: pagination.currentPage + 1 });
    }
  }, [fetchData, pagination, loading]);
  
  const refresh = useCallback(() => {
    fetchData({ page: 1 });
  }, [fetchData]);
  
  const updateParams = useCallback((newParams) => {
    fetchData({ ...newParams, page: 1 });
  }, [fetchData]);
  
  return {
    data,
    pagination,
    loading,
    error,
    loadMore,
    refresh,
    updateParams,
    hasMore: pagination?.hasNextPage || false
  };
};

// Usage example
const BookList = () => {
  const {
    data: books,
    pagination,
    loading,
    error,
    loadMore,
    updateParams,
    hasMore
  } = usePagination(bookService.getBooks, {
    limit: 12,
    sort: 'newest'
  });
  
  const handleSearch = (searchTerm) => {
    updateParams({ search: searchTerm });
  };
  
  const handleFilterChange = (filters) => {
    updateParams(filters);
  };
  
  return (
    <div>
      <SearchBar onSearch={handleSearch} />
      <FilterPanel onFilterChange={handleFilterChange} />
      
      <BookGrid books={books} />
      
      {hasMore && (
        <LoadMoreButton onClick={loadMore} loading={loading} />
      )}
      
      {error && <ErrorMessage error={error} />}
    </div>
  );
};
```

---

## 10. Testing & Development

### 10.1 API Testing Utilities
```javascript
// utils/testHelpers.js
export const createMockApiResponse = (data, success = true) => ({
  success,
  data,
  ...(success ? {} : { error: { message: 'Mock error', code: 'MOCK_ERROR' } })
});

export const mockApiCall = (response, delay = 100) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(response), delay);
  });
};

// Mock data generators
export const mockBook = (overrides = {}) => ({
  _id: `book-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Mock Book Title',
  author: 'Mock Author',
  description: 'This is a mock book description for testing purposes.',
  coverImageUrl: 'https://via.placeholder.com/300x450',
  genres: ['Fiction'],
  publishedYear: 2020,
  averageRating: 4.2,
  totalReviews: 150,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

export const mockReview = (overrides = {}) => ({
  _id: `review-${Math.random().toString(36).substr(2, 9)}`,
  bookId: 'book-123',
  userId: 'user-123',
  text: 'This is a mock review for testing purposes.',
  rating: 4,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  user: { _id: 'user-123', name: 'Mock User' },
  ...overrides
});

export const mockUser = (overrides = {}) => ({
  _id: `user-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Mock User',
  email: 'mock@example.com',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});
```

### 10.2 Environment Configuration
```javascript
// config/environment.js
const config = {
  development: {
    API_BASE_URL: 'http://localhost:5000/api/v1',
    ENABLE_CACHE: true,
    CACHE_TTL: 5 * 60 * 1000, // 5 minutes
    ENABLE_MOCK_DATA: false,
    LOG_LEVEL: 'debug'
  },
  
  staging: {
    API_BASE_URL: 'https://staging-api.bookreview.com/api/v1',
    ENABLE_CACHE: true,
    CACHE_TTL: 10 * 60 * 1000, // 10 minutes
    ENABLE_MOCK_DATA: false,
    LOG_LEVEL: 'info'
  },
  
  production: {
    API_BASE_URL: 'https://api.bookreview.com/api/v1',
    ENABLE_CACHE: true,
    CACHE_TTL: 15 * 60 * 1000, // 15 minutes
    ENABLE_MOCK_DATA: false,
    LOG_LEVEL: 'error'
  }
};

const environment = process.env.NODE_ENV || 'development';
export default config[environment];
```

### 10.3 Development Tools
```javascript
// utils/devTools.js
export const logger = {
  debug: (...args) => {
    if (config.LOG_LEVEL === 'debug') {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info: (...args) => {
    if (['debug', 'info'].includes(config.LOG_LEVEL)) {
      console.info('[INFO]', ...args);
    }
  },
  
  error: (...args) => {
    console.error('[ERROR]', ...args);
  }
};

// API call logger
export const logApiCall = (method, url, data, response) => {
  logger.debug(`API ${method.toUpperCase()} ${url}`, {
    request: data,
    response: response?.data,
    status: response?.status
  });
};

// Performance monitoring
export const performanceMonitor = {
  start: (label) => {
    if (config.LOG_LEVEL === 'debug') {
      console.time(label);
    }
  },
  
  end: (label) => {
    if (config.LOG_LEVEL === 'debug') {
      console.timeEnd(label);
    }
  }
};
```

---

## Conclusion

This API Integration PRD provides comprehensive documentation for frontend developers to successfully integrate with the Book Review Platform backend. The document covers all essential aspects including:

### Key Takeaways:
1. **Standardized API Structure:** All endpoints follow consistent request/response patterns
2. **Robust Authentication:** JWT-based authentication with proper token management
3. **Comprehensive Error Handling:** Detailed error responses with actionable information
4. **Performance Optimization:** Caching strategies and optimistic updates
5. **Development Support:** Testing utilities and development tools

### Implementation Priority:
1. **Phase 1:** Authentication system and basic book listing
2. **Phase 2:** Review system and user profiles
3. **Phase 3:** Favorites and recommendations
4. **Phase 4:** Performance optimization and advanced features

### Best Practices:
- Always handle loading and error states
- Implement optimistic updates for better UX
- Use proper caching strategies
- Follow consistent naming conventions
- Maintain proper separation of concerns

This documentation should serve as the primary reference for all frontend development activities and ensure consistent, high-quality integration with the backend API.
