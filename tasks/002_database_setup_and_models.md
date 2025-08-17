# Task 002: Database Setup and Models

## Overview
Set up MongoDB database connection and create all data models with proper schemas, validation, and relationships.

## Scope
- Database connection setup
- User, Book, Review, and Favorite models
- Schema validation and constraints
- Database indexing strategy
- Seed data preparation

## Deliverables

### 1. Database Connection Setup
- Configure MongoDB connection using Mongoose
- Set up connection pooling and error handling
- Create database configuration for different environments
- Implement connection retry logic
- Add database health check

### 2. User Model Implementation
```typescript
// User schema structure
{
  id: UUID (primary key)
  name: string (required, 2-100 chars)
  email: string (required, unique, valid email)
  password: string (hashed, min 8 chars)
  createdAt: ISO 8601 timestamp
  updatedAt: ISO 8601 timestamp
}
```
- Implement password hashing middleware
- Add email validation and uniqueness constraint
- Create user instance methods (comparePassword, etc.)

### 3. Book Model Implementation
```typescript
// Book schema structure
{
  id: UUID (primary key)
  title: string (required, 1-200 chars)
  author: string (required, 1-100 chars)
  description: string (required, 10-2000 chars)
  coverImageUrl: string (required, valid URL)
  genres: array of strings (required, 1-5 items)
  publishedYear: integer (1000-current year)
  averageRating: decimal (0.0-5.0, 1 decimal place)
  totalReviews: integer (default: 0)
  createdAt: ISO 8601 timestamp
  updatedAt: ISO 8601 timestamp
}
```
- Add text search indexes for title and author
- Implement genre validation
- Add virtual fields for computed properties

### 4. Review Model Implementation
```typescript
// Review schema structure
{
  id: UUID (primary key)
  bookId: UUID (foreign key, required)
  userId: UUID (foreign key, required)
  text: string (required, 1-2000 chars)
  rating: integer (1-5, required)
  createdAt: ISO 8601 timestamp
  updatedAt: ISO 8601 timestamp
}
```
- Create compound unique index on (userId, bookId)
- Add population for user and book references
- Implement rating aggregation hooks

### 5. Favorite Model Implementation
```typescript
// Favorite schema structure
{
  id: UUID (primary key)
  userId: UUID (foreign key, required)
  bookId: UUID (foreign key, required)
  createdAt: ISO 8601 timestamp
}
```
- Create compound unique index on (userId, bookId)
- Add reference validation

### 6. Database Indexing Strategy
- Text search indexes for books (title, author)
- Performance indexes for common queries
- Unique constraints where needed
- Compound indexes for relationships

### 7. Seed Data Preparation
- Create initial book catalog (100 books)
- Prepare genre taxonomy
- Create admin user accounts
- Implement seeding scripts

## Acceptance Criteria
- [ ] MongoDB connection is established and stable
- [ ] All models are created with proper validation
- [ ] Indexes are created for optimal query performance
- [ ] Model relationships work correctly
- [ ] Password hashing is implemented securely
- [ ] Seed data scripts are functional
- [ ] Database health check passes
- [ ] All model validations work as expected

## Dependencies
- Task 001: Project Setup and Infrastructure

## Estimated Time
8-10 hours

## Notes
- Use Mongoose for ODM with TypeScript support
- Implement proper error handling for database operations
- Consider using UUID v4 for all primary keys
- Set up proper validation messages for user feedback
- Ensure all sensitive data is properly encrypted
