import { Request, Response } from 'express';
import User from '../models/User';
import { JWTService } from '../services/jwtService';
import { PasswordService } from '../services/passwordService';
import { ApiResponse } from '../utils/response';

/**
 * Authentication Controller
 * Handles user registration, login, logout, and profile retrieval
 */
export class AuthController {
  /**
   * Register a new user
   * POST /auth/register
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password } = req.body;

      // Validate required fields
      if (!name || !email || !password) {
        res.status(400).json(
          ApiResponse.error('Name, email, and password are required', 400, 'MISSING_FIELDS')
        );
        return;
      }

      // Validate password strength
      const passwordValidation = PasswordService.validatePassword(password);
      if (!passwordValidation.isValid) {
        res.status(400).json(
          ApiResponse.error('Password validation failed', 400, 'INVALID_PASSWORD', {
            errors: passwordValidation.errors,
            strength: passwordValidation.strength,
            suggestions: PasswordService.getPasswordStrengthFeedback(password),
          })
        );
        return;
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        res.status(409).json(
          ApiResponse.error('Email address is already registered', 409, 'EMAIL_EXISTS')
        );
        return;
      }

      // Create new user (password will be hashed by pre-save middleware)
      const userData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
      };

      const user = new User(userData);
      await user.save();

      // Generate JWT token
      const token = JWTService.generateToken(user);

      // Return success response with user data and token
      res.status(201).json(
        ApiResponse.success(
          'User registered successfully',
          {
            user: user.toJSON(),
            token,
            expiresAt: JWTService.getTokenExpiration(token),
          },
          201
        )
      );
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle MongoDB duplicate key error
      if (error instanceof Error && error.message.includes('Email address is already registered')) {
        res.status(409).json(
          ApiResponse.error('Email address is already registered', 409, 'EMAIL_EXISTS')
        );
        return;
      }

      res.status(500).json(
        ApiResponse.error('Registration failed', 500, 'REGISTRATION_ERROR')
      );
    }
  }

  /**
   * Login user
   * POST /auth/login
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Validate required fields
      if (!email || !password) {
        res.status(400).json(
          ApiResponse.error('Email and password are required', 400, 'MISSING_CREDENTIALS')
        );
        return;
      }

      // Find user by email with password field
      const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
      if (!user) {
        res.status(401).json(
          ApiResponse.error('Invalid email or password', 401, 'INVALID_CREDENTIALS')
        );
        return;
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        res.status(401).json(
          ApiResponse.error('Invalid email or password', 401, 'INVALID_CREDENTIALS')
        );
        return;
      }

      // Generate JWT token
      const token = JWTService.generateToken(user);

      // Return success response with user data and token
      res.status(200).json(
        ApiResponse.success(
          'Login successful',
          {
            user: user.toJSON(),
            token,
            expiresAt: JWTService.getTokenExpiration(token),
          }
        )
      );
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json(
        ApiResponse.error('Login failed', 500, 'LOGIN_ERROR')
      );
    }
  }

  /**
   * Logout user (client-side token invalidation)
   * POST /auth/logout
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // For JWT tokens, logout is primarily handled client-side
      // The client should remove the token from storage
      
      // Log the logout event for security monitoring
      const userId = req.user?._id || 'unknown';
      console.info(`User logout: ${userId} at ${new Date().toISOString()}`);

      res.status(200).json(
        ApiResponse.success(
          'Logout successful',
          {
            message: 'Please remove the token from client storage',
            timestamp: new Date().toISOString(),
          }
        )
      );
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json(
        ApiResponse.error('Logout failed', 500, 'LOGOUT_ERROR')
      );
    }
  }

  /**
   * Get current user profile
   * GET /auth/me
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      // Return user profile data
      res.status(200).json(
        ApiResponse.success(
          'Profile retrieved successfully',
          {
            user: req.user.toJSON(),
          }
        )
      );
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json(
        ApiResponse.error('Failed to retrieve profile', 500, 'PROFILE_ERROR')
      );
    }
  }

  /**
   * Refresh token (for future implementation)
   * POST /auth/refresh
   */
  static async refreshToken(_req: Request, res: Response): Promise<void> {
    try {
      // This is a placeholder for future refresh token implementation
      res.status(501).json(
        ApiResponse.error('Refresh token not implemented yet', 501, 'NOT_IMPLEMENTED')
      );
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json(
        ApiResponse.error('Token refresh failed', 500, 'REFRESH_ERROR')
      );
    }
  }

  /**
   * Validate token endpoint (for debugging/testing)
   * POST /auth/validate
   */
  static async validateToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json(
          ApiResponse.error('Token is required', 400, 'MISSING_TOKEN')
        );
        return;
      }

      try {
        const decoded = JWTService.verifyToken(token);
        const user = await User.findById(decoded.userId);

        if (!user) {
          res.status(404).json(
            ApiResponse.error('User not found', 404, 'USER_NOT_FOUND')
          );
          return;
        }

        res.status(200).json(
          ApiResponse.success(
            'Token is valid',
            {
              valid: true,
              decoded,
              user: user.toJSON(),
              expiresAt: JWTService.getTokenExpiration(token),
            }
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid token';
        res.status(401).json(
          ApiResponse.error(message, 401, 'INVALID_TOKEN', {
            valid: false,
          })
        );
      }
    } catch (error) {
      console.error('Token validation error:', error);
      res.status(500).json(
        ApiResponse.error('Token validation failed', 500, 'VALIDATION_ERROR')
      );
    }
  }

  /**
   * Change password (for authenticated users)
   * PUT /auth/password
   */
  static async changePassword(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json(
          ApiResponse.error('Authentication required', 401, 'AUTH_REQUIRED')
        );
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json(
          ApiResponse.error('Current password and new password are required', 400, 'MISSING_PASSWORDS')
        );
        return;
      }

      // Get user with password
      const user = await User.findById(req.user._id).select('+password');
      if (!user) {
        res.status(404).json(
          ApiResponse.error('User not found', 404, 'USER_NOT_FOUND')
        );
        return;
      }

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        res.status(401).json(
          ApiResponse.error('Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD')
        );
        return;
      }

      // Validate new password
      const passwordValidation = PasswordService.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        res.status(400).json(
          ApiResponse.error('New password validation failed', 400, 'INVALID_NEW_PASSWORD', {
            errors: passwordValidation.errors,
            strength: passwordValidation.strength,
            suggestions: PasswordService.getPasswordStrengthFeedback(newPassword),
          })
        );
        return;
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.status(200).json(
        ApiResponse.success('Password changed successfully')
      );
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json(
        ApiResponse.error('Password change failed', 500, 'PASSWORD_CHANGE_ERROR')
      );
    }
  }
}

export default AuthController;
