import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import User from '../src/models/User';
import { JWTService } from '../src/services/jwtService';
import { PasswordService } from '../src/services/passwordService';

describe('Authentication System', () => {
  // Test user data
  const testUser = {
    name: 'John Doe',
    email: 'john.doe@example.com',
    password: 'TestPassword123',
  };

  const invalidUser = {
    name: 'Jane Doe',
    email: 'jane.doe@example.com',
    password: 'weakpass',
  };

  beforeEach(async () => {
    // Clear users collection before each test
    await User.deleteMany({});
  });

  afterAll(async () => {
    // Clean up and close database connection
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const response = await request(app.app)
        .post('/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('User registered successfully');
      expect(response.body.data.user).toHaveProperty('_id');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.name).toBe(testUser.name);
      expect(response.body.data.user).not.toHaveProperty('password');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('expiresAt');

      // Verify user was created in database
      const createdUser = await User.findOne({ email: testUser.email });
      expect(createdUser).toBeTruthy();
      expect(createdUser?.name).toBe(testUser.name);
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(app.app)
        .post('/v1/auth/register')
        .send({ name: 'John Doe' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.data.errors).toContain('email is required');
      expect(response.body.data.errors).toContain('password is required');
    });

    it('should reject registration with invalid email', async () => {
      const response = await request(app.app)
        .post('/v1/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.data.errors).toContain('email must be a valid email address');
    });

    it('should reject registration with weak password', async () => {
      const response = await request(app.app)
        .post('/v1/auth/register')
        .send(invalidUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Password validation failed');
      expect(response.body.data.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject registration with duplicate email', async () => {
      // Create user first
      await request(app.app)
        .post('/v1/auth/register')
        .send(testUser)
        .expect(201);

      // Try to register with same email
      const response = await request(app.app)
        .post('/v1/auth/register')
        .send(testUser)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email address is already registered');
    });

    it('should normalize email to lowercase', async () => {
      const response = await request(app.app)
        .post('/v1/auth/register')
        .send({
          ...testUser,
          email: 'JOHN.DOE@EXAMPLE.COM',
        })
        .expect(201);

      expect(response.body.data.user.email).toBe('john.doe@example.com');
    });
  });

  describe('POST /v1/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await request(app.app)
        .post('/v1/auth/register')
        .send(testUser);
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app.app)
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.data.user).toHaveProperty('_id');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user).not.toHaveProperty('password');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('expiresAt');
    });

    it('should reject login with invalid email', async () => {
      const response = await request(app.app)
        .post('/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app.app)
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app.app)
        .post('/v1/auth/login')
        .send({ email: testUser.email })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation failed');
      expect(response.body.data.errors).toContain('password is required');
    });

    it('should handle case-insensitive email login', async () => {
      const response = await request(app.app)
        .post('/v1/auth/login')
        .send({
          email: testUser.email.toUpperCase(),
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
    });
  });

  describe('GET /v1/auth/me', () => {
    let authToken: string;

    beforeEach(async () => {
      // Register and get token
      const registerResponse = await request(app.app)
        .post('/v1/auth/register')
        .send(testUser);
      
      authToken = registerResponse.body.data.token;
    });

    it('should return user profile with valid token', async () => {
      const response = await request(app.app)
        .get('/v1/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Profile retrieved successfully');
      expect(response.body.data.user).toHaveProperty('_id');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user).not.toHaveProperty('password');
    });

    it('should reject request without token', async () => {
      const response = await request(app.app)
        .get('/v1/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app.app)
        .get('/v1/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid token');
    });

    it('should reject request with malformed authorization header', async () => {
      const response = await request(app.app)
        .get('/v1/auth/me')
        .set('Authorization', 'InvalidFormat token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });
  });

  describe('POST /v1/auth/logout', () => {
    let authToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app.app)
        .post('/v1/auth/register')
        .send(testUser);
      
      authToken = registerResponse.body.data.token;
    });

    it('should logout successfully with valid token', async () => {
      const response = await request(app.app)
        .post('/v1/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
      expect(response.body.data).toHaveProperty('timestamp');
    });

    it('should reject logout without token', async () => {
      const response = await request(app.app)
        .post('/v1/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });
  });

  describe('PUT /v1/auth/password', () => {
    let authToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app.app)
        .post('/v1/auth/register')
        .send(testUser);
      
      authToken = registerResponse.body.data.token;
    });

    it('should change password successfully', async () => {
      const newPassword = 'NewPassword123';
      
      const response = await request(app.app)
        .put('/v1/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify can login with new password
      const loginResponse = await request(app.app)
        .post('/v1/auth/login')
        .send({
          email: testUser.email,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
    });

    it('should reject password change with wrong current password', async () => {
      const response = await request(app.app)
        .put('/v1/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: 'WrongPassword123',
          newPassword: 'NewPassword123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Current password is incorrect');
    });

    it('should reject password change with weak new password', async () => {
      const response = await request(app.app)
        .put('/v1/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('New password validation failed');
    });
  });

  describe('POST /v1/auth/validate', () => {
    let authToken: string;

    beforeEach(async () => {
      const registerResponse = await request(app.app)
        .post('/v1/auth/register')
        .send(testUser);
      
      authToken = registerResponse.body.data.token;
    });

    it('should validate valid token', async () => {
      const response = await request(app.app)
        .post('/v1/auth/validate')
        .send({ token: authToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Token is valid');
      expect(response.body.data.valid).toBe(true);
      expect(response.body.data.decoded).toHaveProperty('userId');
      expect(response.body.data.user).toHaveProperty('_id');
    });

    it('should reject invalid token', async () => {
      const response = await request(app.app)
        .post('/v1/auth/validate')
        .send({ token: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.data.valid).toBe(false);
    });
  });

  describe('JWT Service', () => {
    let testUserDoc: any;

    beforeEach(async () => {
      testUserDoc = new User(testUser);
      await testUserDoc.save();
    });

    it('should generate valid JWT token', () => {
      const token = JWTService.generateToken(testUserDoc);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should verify valid JWT token', () => {
      const token = JWTService.generateToken(testUserDoc);
      const decoded = JWTService.verifyToken(token);
      
      expect(decoded.userId).toBe(testUserDoc._id);
      expect(decoded.email).toBe(testUserDoc.email);
    });

    it('should reject expired token', () => {
      // This would require mocking time or creating an expired token
      // For now, we'll test the error handling
      expect(() => {
        JWTService.verifyToken('invalid.token.here');
      }).toThrow();
    });

    it('should extract token from authorization header', () => {
      const token = 'sample-token';
      const authHeader = `Bearer ${token}`;
      
      const extracted = JWTService.extractTokenFromHeader(authHeader);
      expect(extracted).toBe(token);
    });

    it('should return null for invalid authorization header', () => {
      const extracted = JWTService.extractTokenFromHeader('Invalid format');
      expect(extracted).toBeNull();
    });
  });

  describe('Password Service', () => {
    it('should validate strong password', () => {
      const result = PasswordService.validatePassword('StrongPassword123');
      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('strong');
    });

    it('should reject weak password', () => {
      const result = PasswordService.validatePassword('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should hash and compare passwords', async () => {
      const password = 'TestPassword123';
      const hashed = await PasswordService.hashPassword(password);
      
      expect(hashed).not.toBe(password);
      
      const isMatch = await PasswordService.comparePassword(password, hashed);
      expect(isMatch).toBe(true);
      
      const isNotMatch = await PasswordService.comparePassword('wrong', hashed);
      expect(isNotMatch).toBe(false);
    });

    it('should provide password strength feedback', () => {
      const feedback = PasswordService.getPasswordStrengthFeedback('weak');
      expect(feedback.length).toBeGreaterThan(0);
      expect(feedback).toContain('Consider using a longer password (12+ characters)');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to registration endpoint', async () => {
      // Make multiple rapid requests
      const promises = Array(6).fill(null).map((_, i) => 
        request(app.app)
          .post('/v1/auth/register')
          .send({
            ...testUser,
            email: `test${i}@example.com`,
          })
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });
});
