# Task 007: User Profile API Endpoints

## Overview
Implement user profile management endpoints allowing users to view and update their profile information and statistics.

## Scope
- User profile retrieval
- Profile information updates
- User statistics calculation
- Profile data validation
- Authorization for profile operations

## Deliverables

### 1. GET /users/profile - Get User Profile Endpoint
- Authenticated endpoint (JWT required)
- Return current user's profile information
- Include user statistics:
  - Total reviews count
  - Total favorites count
  - Average rating given
  - Account creation date
- Exclude sensitive information (password hash)
- Proper error handling for invalid tokens

### 2. PUT /users/profile - Update User Profile Endpoint
- Authenticated endpoint (JWT required)
- Request validation:
  - `name` (string, optional, 2-100 chars, letters and spaces only)
  - `email` (string, optional, valid email format, unique)
- Business logic:
  - Partial update support
  - Email uniqueness validation
  - Input sanitization
  - Updated timestamp generation
- Response: Updated user profile with 200 status

### 3. User Statistics Service
- Real-time statistics calculation
- Efficient aggregation queries
- Statistics caching for performance
- Statistics update triggers
- Historical data tracking preparation

### 4. Profile Validation Service
- Name format validation (letters and spaces only)
- Email format and uniqueness validation
- Input length constraints
- Sanitization for XSS prevention
- Business rule enforcement

### 5. Profile Data Transformation
- Sensitive data exclusion (password)
- Statistics calculation and inclusion
- Timestamp formatting
- Response structure standardization
- Data privacy compliance

### 6. Authorization Implementation
- JWT token validation
- User context extraction
- Self-profile access only
- Permission verification
- Unauthorized access prevention

### 7. Database Operations
- Efficient user data retrieval
- Statistics aggregation queries
- Profile update operations
- Email uniqueness checking
- Transaction support for updates

### 8. Caching Strategy
- User profile caching
- Statistics caching
- Cache invalidation on updates
- Performance optimization
- Memory usage optimization

### 9. Error Handling
- Invalid token scenarios
- Email uniqueness violations
- Validation error responses
- Database operation failures
- Network and service errors

### 10. Response Formatting
- Consistent JSON structure
- Complete profile information
- Statistics inclusion
- Timestamp standardization
- Error response consistency

## User Statistics Calculation

### Statistics to Include:
- `totalReviews`: Count of reviews written by user
- `totalFavorites`: Count of books in user's favorites
- `averageRating`: Average rating given by user across all reviews
- `memberSince`: Account creation date
- `lastActive`: Last login or activity timestamp (future)

### Aggregation Queries:
```typescript
// Example statistics calculation
{
  totalReviews: await Review.countDocuments({ userId }),
  totalFavorites: await Favorite.countDocuments({ userId }),
  averageRating: await Review.aggregate([
    { $match: { userId } },
    { $group: { _id: null, avg: { $avg: "$rating" } } }
  ])
}
```

## Acceptance Criteria
- [ ] Users can retrieve their complete profile information
- [ ] Users can update their name and email
- [ ] Profile statistics are calculated accurately
- [ ] Email uniqueness is enforced on updates
- [ ] Only authenticated users can access profiles
- [ ] Input validation prevents invalid data
- [ ] Sensitive information is excluded from responses
- [ ] Statistics are calculated efficiently
- [ ] Error handling covers all scenarios
- [ ] Performance meets requirements (<500ms)
- [ ] Profile updates are atomic operations

## Dependencies
- Task 001: Project Setup and Infrastructure
- Task 002: Database Setup and Models
- Task 003: Authentication and Authorization
- Task 005: Reviews API Endpoints
- Task 006: Favorites API Endpoints

## Estimated Time
6-8 hours

## Notes
- Consider implementing profile picture upload in future phases
- Add comprehensive input validation and sanitization
- Implement efficient caching for user statistics
- Consider adding user preferences and settings
- Add proper logging for profile operations
- Test email uniqueness edge cases thoroughly
- Consider implementing profile privacy settings in future
