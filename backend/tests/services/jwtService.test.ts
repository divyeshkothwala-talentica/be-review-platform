import jwt from 'jsonwebtoken';
import { JWTService, JWTPayload } from '../../src/services/jwtService';
import { IUser } from '../../src/models/User';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../src/config', () => ({
  jwtSecret: 'test-secret',
  jwtExpiresIn: '1h',
}));

const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('JWTService', () => {
  const mockUser = {
    _id: 'user123',
    name: 'Test User',
    email: 'test@example.com',
    password: 'hashedpassword',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as IUser;

  const mockPayload: JWTPayload = {
    userId: 'user123',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      const expectedToken = 'mock.jwt.token';
      mockedJwt.sign = jest.fn().mockReturnValue(expectedToken);

      const token = JWTService.generateToken(mockUser);

      expect(token).toBe(expectedToken);
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        {
          userId: mockUser._id,
          email: mockUser.email,
        },
        'test-secret',
        {
          expiresIn: '1h',
          algorithm: 'HS256',
          issuer: 'book-review-platform',
          audience: 'book-review-users',
        }
      );
    });

    it('should include correct payload data', () => {
      mockedJwt.sign = jest.fn().mockReturnValue('token');

      JWTService.generateToken(mockUser);

      const [payload] = mockedJwt.sign.mock.calls[0];
      expect(payload).toEqual({
        userId: 'user123',
        email: 'test@example.com',
      });
    });
  });

  describe('verifyToken', () => {
    it('should verify and return decoded token payload', () => {
      mockedJwt.verify = jest.fn().mockReturnValue(mockPayload);

      const result = JWTService.verifyToken('valid.jwt.token');

      expect(result).toEqual(mockPayload);
      expect(mockedJwt.verify).toHaveBeenCalledWith('valid.jwt.token', 'test-secret', {
        algorithms: ['HS256'],
        issuer: 'book-review-platform',
        audience: 'book-review-users',
      });
    });

    it('should throw "Token has expired" for expired tokens', () => {
      mockedJwt.verify = jest.fn().mockImplementation(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      expect(() => JWTService.verifyToken('expired.token')).toThrow('Token has expired');
    });

    it('should throw "Invalid token" for malformed tokens', () => {
      mockedJwt.verify = jest.fn().mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      expect(() => JWTService.verifyToken('invalid.token')).toThrow('Invalid token');
    });

    it('should throw "Token not active" for not-before errors', () => {
      mockedJwt.verify = jest.fn().mockImplementation(() => {
        throw new jwt.NotBeforeError('Token not active', new Date());
      });

      expect(() => JWTService.verifyToken('notbefore.token')).toThrow('Token not active');
    });

    it('should throw generic error for other JWT errors', () => {
      mockedJwt.verify = jest.fn().mockImplementation(() => {
        throw new Error('Some other error');
      });

      expect(() => JWTService.verifyToken('error.token')).toThrow('Token verification failed');
    });
  });

  describe('extractTokenFromHeader', () => {
    it('should extract token from valid Bearer header', () => {
      const authHeader = 'Bearer valid.jwt.token';
      const result = JWTService.extractTokenFromHeader(authHeader);

      expect(result).toBe('valid.jwt.token');
    });

    it('should return null for undefined header', () => {
      const result = JWTService.extractTokenFromHeader(undefined);

      expect(result).toBeNull();
    });

    it('should return null for malformed header (missing Bearer)', () => {
      const authHeader = 'Token valid.jwt.token';
      const result = JWTService.extractTokenFromHeader(authHeader);

      expect(result).toBeNull();
    });

    it('should return null for malformed header (only Bearer)', () => {
      const authHeader = 'Bearer';
      const result = JWTService.extractTokenFromHeader(authHeader);

      expect(result).toBeNull();
    });

    it('should return null for malformed header (too many parts)', () => {
      const authHeader = 'Bearer token extra';
      const result = JWTService.extractTokenFromHeader(authHeader);

      expect(result).toBeNull();
    });

    it('should return null for empty header', () => {
      const authHeader = '';
      const result = JWTService.extractTokenFromHeader(authHeader);

      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid non-expired token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const validPayload = { ...mockPayload, exp: futureExp };
      mockedJwt.decode = jest.fn().mockReturnValue(validPayload);

      const result = JWTService.isTokenExpired('valid.token');

      expect(result).toBe(false);
    });

    it('should return true for expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const expiredPayload = { ...mockPayload, exp: pastExp };
      mockedJwt.decode = jest.fn().mockReturnValue(expiredPayload);

      const result = JWTService.isTokenExpired('expired.token');

      expect(result).toBe(true);
    });

    it('should return true for token without expiration', () => {
      const payloadWithoutExp = { userId: 'user123', email: 'test@example.com' };
      mockedJwt.decode = jest.fn().mockReturnValue(payloadWithoutExp);

      const result = JWTService.isTokenExpired('no.exp.token');

      expect(result).toBe(true);
    });

    it('should return true for null decoded token', () => {
      mockedJwt.decode = jest.fn().mockReturnValue(null);

      const result = JWTService.isTokenExpired('invalid.token');

      expect(result).toBe(true);
    });

    it('should return true for decode errors', () => {
      mockedJwt.decode = jest.fn().mockImplementation(() => {
        throw new Error('Decode error');
      });

      const result = JWTService.isTokenExpired('malformed.token');

      expect(result).toBe(true);
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      mockedJwt.decode = jest.fn().mockReturnValue(mockPayload);

      const result = JWTService.decodeToken('valid.token');

      expect(result).toEqual(mockPayload);
      expect(mockedJwt.decode).toHaveBeenCalledWith('valid.token');
    });

    it('should return null for decode errors', () => {
      mockedJwt.decode = jest.fn().mockImplementation(() => {
        throw new Error('Decode error');
      });

      const result = JWTService.decodeToken('invalid.token');

      expect(result).toBeNull();
    });

    it('should return null for null decoded result', () => {
      mockedJwt.decode = jest.fn().mockReturnValue(null);

      const result = JWTService.decodeToken('empty.token');

      expect(result).toBeNull();
    });
  });

  describe('getTokenExpiration', () => {
    it('should return expiration date for valid token', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const payloadWithExp = { ...mockPayload, exp };
      mockedJwt.decode = jest.fn().mockReturnValue(payloadWithExp);

      const result = JWTService.getTokenExpiration('valid.token');

      expect(result).toEqual(new Date(exp * 1000));
    });

    it('should return null for token without expiration', () => {
      const payloadWithoutExp = { userId: 'user123', email: 'test@example.com' };
      mockedJwt.decode = jest.fn().mockReturnValue(payloadWithoutExp);

      const result = JWTService.getTokenExpiration('no.exp.token');

      expect(result).toBeNull();
    });

    it('should return null for null decoded token', () => {
      mockedJwt.decode = jest.fn().mockReturnValue(null);

      const result = JWTService.getTokenExpiration('invalid.token');

      expect(result).toBeNull();
    });

    it('should return null for decode errors', () => {
      mockedJwt.decode = jest.fn().mockImplementation(() => {
        throw new Error('Decode error');
      });

      const result = JWTService.getTokenExpiration('malformed.token');

      expect(result).toBeNull();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a refresh token with correct payload', () => {
      const expectedToken = 'refresh.jwt.token';
      mockedJwt.sign = jest.fn().mockReturnValue(expectedToken);

      const token = JWTService.generateRefreshToken(mockUser);

      expect(token).toBe(expectedToken);
      expect(mockedJwt.sign).toHaveBeenCalledWith(
        {
          userId: mockUser._id,
          type: 'refresh',
        },
        'test-secret',
        {
          expiresIn: '7d',
          algorithm: 'HS256',
          issuer: 'book-review-platform',
          audience: 'book-review-users',
        }
      );
    });

    it('should include correct refresh token payload', () => {
      mockedJwt.sign = jest.fn().mockReturnValue('refresh.token');

      JWTService.generateRefreshToken(mockUser);

      const [payload] = mockedJwt.sign.mock.calls[0];
      expect(payload).toEqual({
        userId: 'user123',
        type: 'refresh',
      });
    });

    it('should set longer expiration for refresh tokens', () => {
      mockedJwt.sign = jest.fn().mockReturnValue('refresh.token');

      JWTService.generateRefreshToken(mockUser);

      const [, , options] = mockedJwt.sign.mock.calls[0];
      expect(options.expiresIn).toBe('7d');
    });
  });

  describe('JWT Configuration', () => {
    it('should use correct JWT configuration values', () => {
      mockedJwt.sign = jest.fn().mockReturnValue('token');

      JWTService.generateToken(mockUser);

      const [, secret, options] = mockedJwt.sign.mock.calls[0];
      expect(secret).toBe('test-secret');
      expect(options).toMatchObject({
        expiresIn: '1h',
        algorithm: 'HS256',
        issuer: 'book-review-platform',
        audience: 'book-review-users',
      });
    });

    it('should use correct verification options', () => {
      mockedJwt.verify = jest.fn().mockReturnValue(mockPayload);

      JWTService.verifyToken('token');

      const [, secret, options] = mockedJwt.verify.mock.calls[0];
      expect(secret).toBe('test-secret');
      expect(options).toMatchObject({
        algorithms: ['HS256'],
        issuer: 'book-review-platform',
        audience: 'book-review-users',
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with special characters in email', () => {
      const specialUser = {
        ...mockUser,
        email: 'test+special@example-domain.co.uk',
      } as IUser;
      mockedJwt.sign = jest.fn().mockReturnValue('token');

      JWTService.generateToken(specialUser);

      const [payload] = mockedJwt.sign.mock.calls[0];
      expect((payload as any).email).toBe('test+special@example-domain.co.uk');
    });

    it('should handle very long user IDs', () => {
      const longIdUser = {
        ...mockUser,
        _id: 'a'.repeat(100),
      } as IUser;
      mockedJwt.sign = jest.fn().mockReturnValue('token');

      JWTService.generateToken(longIdUser);

      const [payload] = mockedJwt.sign.mock.calls[0];
      expect((payload as any).userId).toBe('a'.repeat(100));
    });

    it('should handle token expiration edge case (exactly at current time)', () => {
      const currentTime = Math.floor(Date.now() / 1000);
      const edgeCasePayload = { ...mockPayload, exp: currentTime };
      mockedJwt.decode = jest.fn().mockReturnValue(edgeCasePayload);

      const result = JWTService.isTokenExpired('edge.case.token');

      expect(result).toBe(true); // Should be expired if exp equals current time
    });
  });
});
