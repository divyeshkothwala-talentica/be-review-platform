import bcrypt from 'bcryptjs';

/**
 * Password validation rules interface
 */
export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}

/**
 * Password strength configuration
 */
const PASSWORD_CONFIG = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: false, // Made optional for better UX
  saltRounds: 12,
};

/**
 * Password Service for hashing, validation, and strength checking
 */
export class PasswordService {
  /**
   * Hash password using bcrypt
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, PASSWORD_CONFIG.saltRounds);
    } catch {
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Compare password with hashed password
   */
  static async comparePassword(
    password: string,
    hashedPassword: string
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch {
      throw new Error('Password comparison failed');
    }
  }

  /**
   * Validate password strength and requirements
   */
  static validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];
    let strength: 'weak' | 'medium' | 'strong' = 'weak';

    // Check length
    if (!password || password.length < PASSWORD_CONFIG.minLength) {
      errors.push(`Password must be at least ${PASSWORD_CONFIG.minLength} characters long`);
    }

    if (password && password.length > PASSWORD_CONFIG.maxLength) {
      errors.push(`Password cannot exceed ${PASSWORD_CONFIG.maxLength} characters`);
    }

    if (password) {
      // Check for uppercase letters
      if (PASSWORD_CONFIG.requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }

      // Check for lowercase letters
      if (PASSWORD_CONFIG.requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }

      // Check for numbers
      if (PASSWORD_CONFIG.requireNumbers && !/\d/.test(password)) {
        errors.push('Password must contain at least one number');
      }

      // Check for special characters (optional)
      if (PASSWORD_CONFIG.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }

      // Calculate strength
      strength = this.calculatePasswordStrength(password);
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength,
    };
  }

  /**
   * Calculate password strength based on various criteria
   */
  private static calculatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
    let score = 0;

    // Length scoring
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Character variety scoring
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

    // Pattern complexity
    if (!/(.)\1{2,}/.test(password)) score += 1; // No repeated characters
    if (!/^(.{1,2})\1+$/.test(password)) score += 1; // No simple patterns

    // Determine strength
    if (score >= 7) return 'strong';
    if (score >= 4) return 'medium';
    return 'weak';
  }

  /**
   * Generate password strength feedback
   */
  static getPasswordStrengthFeedback(password: string): string[] {
    const feedback: string[] = [];

    if (password.length < 12) {
      feedback.push('Consider using a longer password (12+ characters)');
    }

    if (!/[A-Z]/.test(password)) {
      feedback.push('Add uppercase letters for better security');
    }

    if (!/[a-z]/.test(password)) {
      feedback.push('Add lowercase letters for better security');
    }

    if (!/\d/.test(password)) {
      feedback.push('Add numbers for better security');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      feedback.push('Consider adding special characters for maximum security');
    }

    if (/(.)\1{2,}/.test(password)) {
      feedback.push('Avoid repeating characters');
    }

    if (/^(.{1,2})\1+$/.test(password)) {
      feedback.push('Avoid simple patterns');
    }

    return feedback;
  }

  /**
   * Check if password meets minimum requirements
   */
  static meetsMinimumRequirements(password: string): boolean {
    const validation = this.validatePassword(password);
    return validation.isValid;
  }

  /**
   * Generate secure random password (for testing/admin purposes)
   */
  static generateSecurePassword(length: number = 12): string {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const special = '!@#$%^&*(),.?":{}|<>';
    
    const allChars = lowercase + uppercase + numbers + special;
    let password = '';

    // Ensure at least one character from each required set
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];

    // Fill the rest randomly
    for (let i = 3; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

export default PasswordService;
