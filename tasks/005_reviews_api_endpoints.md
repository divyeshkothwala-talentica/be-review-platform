# Task 005: Reviews API Endpoints

## Overview
Implement complete CRUD operations for book reviews with proper validation, authorization, and rating aggregation.

## Scope
- Review creation, reading, updating, and deletion
- User authorization for review operations
- Rating aggregation and book statistics updates
- Review validation and sanitization
- User review history management

## Deliverables

### 1. POST /reviews - Create Review Endpoint
- Authenticated endpoint (JWT required)
- Request validation:
  - `bookId` (UUID, required, must exist)
  - `text` (string, required, 1-2000 chars)
  - `rating` (integer, required, 1-5)
- Business logic:
  - One review per user per book constraint
  - Input sanitization for review text
  - Automatic timestamp generation
- Response: Created review with 201 status

### 2. PUT /reviews/{reviewId} - Update Review Endpoint
- Authenticated endpoint (JWT required)
- Authorization: User can only update own reviews
- Request validation:
  - `text` (string, optional, 1-2000 chars)
  - `rating` (integer, optional, 1-5)
- Business logic:
  - Partial update support
  - Input sanitization
  - Updated timestamp generation
- Response: Updated review with 200 status

### 3. DELETE /reviews/{reviewId} - Delete Review Endpoint
- Authenticated endpoint (JWT required)
- Authorization: User can only delete own reviews
- Business logic:
  - Soft delete or hard delete (configurable)
  - Rating aggregation update
  - Cleanup related data
- Response: Success confirmation with 200 status

### 4. GET /reviews/user/{userId} - User Reviews Endpoint
- Public endpoint (no authentication required)
- Paginated user review history
- Query parameters:
  - `page` (integer, default: 1)
  - `limit` (integer, default: 10, max: 50)
  - `sort` (string) - newest, oldest, rating_high, rating_low
- Include book information in response
- Proper pagination metadata

### 5. Review Validation Service
- Text content validation and sanitization
- Rating range validation (1-5)
- Book existence validation
- Duplicate review prevention
- Input length constraints
- XSS prevention measures

### 6. Rating Aggregation Service
- Automatic average rating calculation
- Total review count updates
- Real-time book statistics updates
- Efficient aggregation queries
- Transaction support for data consistency

### 7. Authorization Middleware
- Review ownership validation
- JWT token verification
- User context injection
- Permission checking for operations
- Error handling for unauthorized access

### 8. Review Response Formatting
- Consistent JSON structure
- User information inclusion (name only)
- Book information for user reviews
- Timestamp formatting
- Pagination metadata

### 9. Business Logic Implementation
- One review per user per book enforcement
- Review text sanitization
- Rating validation and constraints
- Book statistics updates on review changes
- Proper error handling for edge cases

### 10. Performance Optimization
- Efficient database queries
- Proper indexing utilization
- Batch operations for aggregations
- Caching for frequently accessed data
- Query optimization for user reviews

## Acceptance Criteria
- [ ] Users can create reviews with proper validation
- [ ] Users can update only their own reviews
- [ ] Users can delete only their own reviews
- [ ] One review per user per book is enforced
- [ ] Rating aggregation updates automatically
- [ ] User review history is properly paginated
- [ ] All input validation works correctly
- [ ] Authorization prevents unauthorized operations
- [ ] Review text is properly sanitized
- [ ] Book statistics update in real-time
- [ ] Error handling covers all scenarios
- [ ] Performance meets requirements (<500ms)

## Dependencies
- Task 001: Project Setup and Infrastructure
- Task 002: Database Setup and Models
- Task 003: Authentication and Authorization

## Estimated Time
10-12 hours

## Notes
- Implement database transactions for rating aggregation
- Consider implementing review moderation hooks for future
- Add comprehensive input sanitization to prevent XSS
- Ensure proper error messages for validation failures
- Test edge cases like concurrent review submissions
- Consider implementing review editing history
- Add logging for all review operations for analytics
