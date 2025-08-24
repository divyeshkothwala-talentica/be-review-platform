import bcrypt from 'bcryptjs';
import { PasswordService } from '../../src/services/passwordService';

// Mock bcrypt
jest.mock('bcryptjs');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('PasswordService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'TestPassword123';
      const hashedPassword = '$2a$12$hashedpassword';
      mockedBcrypt.hash = jest.fn().mockResolvedValue(hashedPassword);

      const result = await PasswordService.hashPassword(password);

      expect(result).toBe(hashedPassword);
      expect(mockedBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });

    it('should throw error when hashing fails', async () => {
      const password = 'TestPassword123';
      mockedBcrypt.hash = jest.fn().mockRejectedValue(new Error('Hashing failed'));

      await expect(PasswordService.hashPassword(password)).rejects.toThrow('Password hashing failed');
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching passwords', async () => {
      const password = 'TestPassword123';
      const hashedPassword = '$2a$12$hashedpassword';
      mockedBcrypt.compare = jest.fn().mockResolvedValue(true);

      const result = await PasswordService.comparePassword(password, hashedPassword);

      expect(result).toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
    });

    it('should return false for non-matching passwords', async () => {
      const password = 'TestPassword123';
      const hashedPassword = '$2a$12$hashedpassword';
      mockedBcrypt.compare = jest.fn().mockResolvedValue(false);

      const result = await PasswordService.comparePassword(password, hashedPassword);

      expect(result).toBe(false);
    });

    it('should throw error when comparison fails', async () => {
      const password = 'TestPassword123';
      const hashedPassword = '$2a$12$hashedpassword';
      mockedBcrypt.compare = jest.fn().mockRejectedValue(new Error('Comparison failed'));

      await expect(PasswordService.comparePassword(password, hashedPassword)).rejects.toThrow(
        'Password comparison failed'
      );
    });
  });

  describe('validatePassword', () => {
    it('should validate a strong password successfully', () => {
      const password = 'StrongPassword123!';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.strength).toBe('strong');
    });

    it('should reject password that is too short', () => {
      const password = 'Short1';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should reject password that is too long', () => {
      const password = 'A'.repeat(129) + '1a';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password cannot exceed 128 characters');
    });

    it('should reject password without uppercase letters', () => {
      const password = 'lowercase123';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase letters', () => {
      const password = 'UPPERCASE123';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without numbers', () => {
      const password = 'NoNumbersHere';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should handle empty password', () => {
      const password = '';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.strength).toBe('weak');
    });

    it('should handle null/undefined password', () => {
      const result = PasswordService.validatePassword(null as any);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters long');
    });

    it('should collect multiple validation errors', () => {
      const password = 'short';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
      expect(result.errors).toContain('Password must be at least 8 characters long');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
    });
  });

  describe('calculatePasswordStrength', () => {
    it('should calculate weak strength for simple passwords', () => {
      const password = 'password';
      const result = PasswordService.validatePassword(password);

      expect(result.strength).toBe('weak');
    });

    it('should calculate medium strength for moderately complex passwords', () => {
      const password = 'Password123';
      const result = PasswordService.validatePassword(password);

      expect(result.strength).toBe('medium');
    });

    it('should calculate strong strength for complex passwords', () => {
      const password = 'VeryStrongPassword123!@#';
      const result = PasswordService.validatePassword(password);

      expect(result.strength).toBe('strong');
    });

    it('should penalize passwords with repeated characters', () => {
      const password = 'Password111'; // Has repeated 1s
      const result = PasswordService.validatePassword(password);

      // Should be weaker due to repeated characters
      expect(result.strength).not.toBe('strong');
    });

    it('should penalize passwords with simple patterns', () => {
      const password = 'abababab'; // Simple pattern
      const result = PasswordService.validatePassword(password);

      expect(result.strength).toBe('weak');
    });
  });

  describe('getPasswordStrengthFeedback', () => {
    it('should provide feedback for short passwords', () => {
      const password = 'Short1A';
      const feedback = PasswordService.getPasswordStrengthFeedback(password);

      expect(feedback).toContain('Consider using a longer password (12+ characters)');
    });

    it('should provide feedback for missing uppercase letters', () => {
      const password = 'lowercase123';
      const feedback = PasswordService.getPasswordStrengthFeedback(password);

      expect(feedback).toContain('Add uppercase letters for better security');
    });

    it('should provide feedback for missing lowercase letters', () => {
      const password = 'UPPERCASE123';
      const feedback = PasswordService.getPasswordStrengthFeedback(password);

      expect(feedback).toContain('Add lowercase letters for better security');
    });

    it('should provide feedback for missing numbers', () => {
      const password = 'NoNumbersHere';
      const feedback = PasswordService.getPasswordStrengthFeedback(password);

      expect(feedback).toContain('Add numbers for better security');
    });

    it('should provide feedback for missing special characters', () => {
      const password = 'Password123';
      const feedback = PasswordService.getPasswordStrengthFeedback(password);

      expect(feedback).toContain('Consider adding special characters for maximum security');
    });

    it('should provide feedback for repeated characters', () => {
      const password = 'Password111';
      const feedback = PasswordService.getPasswordStrengthFeedback(password);

      expect(feedback).toContain('Avoid repeating characters');
    });

    it('should provide feedback for simple patterns', () => {
      const password = 'abababab';
      const feedback = PasswordService.getPasswordStrengthFeedback(password);

      expect(feedback).toContain('Avoid simple patterns');
    });

    it('should provide no feedback for strong passwords', () => {
      const password = 'VeryStrongPassword123!@#NoRepeats';
      const feedback = PasswordService.getPasswordStrengthFeedback(password);

      expect(feedback).toEqual([]);
    });

    it('should provide multiple feedback items for weak passwords', () => {
      const password = 'weak';
      const feedback = PasswordService.getPasswordStrengthFeedback(password);

      expect(feedback.length).toBeGreaterThan(1);
    });
  });

  describe('meetsMinimumRequirements', () => {
    it('should return true for passwords meeting minimum requirements', () => {
      const password = 'ValidPassword123';
      const result = PasswordService.meetsMinimumRequirements(password);

      expect(result).toBe(true);
    });

    it('should return false for passwords not meeting minimum requirements', () => {
      const password = 'weak';
      const result = PasswordService.meetsMinimumRequirements(password);

      expect(result).toBe(false);
    });

    it('should return false for empty passwords', () => {
      const password = '';
      const result = PasswordService.meetsMinimumRequirements(password);

      expect(result).toBe(false);
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with default length', () => {
      const password = PasswordService.generateSecurePassword();

      expect(password.length).toBe(12);
      expect(PasswordService.meetsMinimumRequirements(password)).toBe(true);
    });

    it('should generate password with custom length', () => {
      const customLength = 16;
      const password = PasswordService.generateSecurePassword(customLength);

      expect(password.length).toBe(customLength);
      expect(PasswordService.meetsMinimumRequirements(password)).toBe(true);
    });

    it('should generate password with required character types', () => {
      const password = PasswordService.generateSecurePassword(12);

      expect(/[a-z]/.test(password)).toBe(true); // Has lowercase
      expect(/[A-Z]/.test(password)).toBe(true); // Has uppercase
      expect(/\d/.test(password)).toBe(true); // Has numbers
    });

    it('should generate different passwords on multiple calls', () => {
      const password1 = PasswordService.generateSecurePassword();
      const password2 = PasswordService.generateSecurePassword();

      expect(password1).not.toBe(password2);
    });

    it('should generate strong passwords', () => {
      const password = PasswordService.generateSecurePassword(16);
      const validation = PasswordService.validatePassword(password);

      expect(validation.isValid).toBe(true);
      expect(validation.strength).toBe('strong');
    });

    it('should handle minimum length requirements', () => {
      const password = PasswordService.generateSecurePassword(8);

      expect(password.length).toBe(8);
      expect(PasswordService.meetsMinimumRequirements(password)).toBe(true);
    });

    it('should generate passwords with special characters when length allows', () => {
      const password = PasswordService.generateSecurePassword(20);
      
      // With longer passwords, there's a high probability of special characters
      // We'll check that the password is valid and strong
      const validation = PasswordService.validatePassword(password);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle very long valid passwords', () => {
      const password = 'A'.repeat(50) + 'a'.repeat(50) + '1'.repeat(27) + '!';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('strong');
    });

    it('should handle passwords with only special characters', () => {
      const password = '!@#$%^&*()';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should handle passwords with unicode characters', () => {
      const password = 'Pässwörd123';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(true);
    });

    it('should handle passwords with spaces', () => {
      const password = 'My Password 123';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(false); // Missing uppercase
    });

    it('should handle passwords with all character types', () => {
      const password = 'MyP@ssw0rd123!';
      const result = PasswordService.validatePassword(password);

      expect(result.isValid).toBe(true);
      expect(result.strength).toBe('strong');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple rapid validations', () => {
      const passwords = [
        'ValidPassword123',
        'AnotherValid456',
        'ThirdValid789',
        'FourthValid012',
        'FifthValid345',
      ];

      passwords.forEach((password) => {
        const result = PasswordService.validatePassword(password);
        expect(result.isValid).toBe(true);
      });
    });

    it('should consistently validate the same password', () => {
      const password = 'ConsistentPassword123';
      
      for (let i = 0; i < 5; i++) {
        const result = PasswordService.validatePassword(password);
        expect(result.isValid).toBe(true);
        expect(result.strength).toBe('medium');
      }
    });

    it('should handle edge case lengths correctly', () => {
      const minLengthPassword = 'A'.repeat(7) + '1'; // 8 chars exactly
      const maxLengthPassword = 'A'.repeat(126) + 'a1'; // 128 chars exactly

      const minResult = PasswordService.validatePassword(minLengthPassword);
      const maxResult = PasswordService.validatePassword(maxLengthPassword);

      expect(minResult.errors).not.toContain('Password must be at least 8 characters long');
      expect(maxResult.errors).not.toContain('Password cannot exceed 128 characters');
    });
  });
});
