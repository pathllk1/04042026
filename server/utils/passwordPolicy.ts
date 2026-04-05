// server/utils/passwordPolicy.ts
import bcrypt from 'bcryptjs';

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
  score: number;
}

export interface PasswordPolicy {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  preventCommonPasswords: boolean;
  preventUserInfo: boolean;
  historyCheck: number; // Number of previous passwords to check against
}

// Default password policy
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommonPasswords: true,
  preventUserInfo: true,
  historyCheck: 5
};

// Common weak passwords to prevent
const COMMON_PASSWORDS = [
  'password', '123456', '123456789', 'qwerty', 'abc123', 'password123',
  'admin', 'letmein', 'welcome', 'monkey', '1234567890', 'password1',
  'qwerty123', 'admin123', 'root', 'toor', 'pass', '12345678',
  'football', 'baseball', 'basketball', 'superman', 'batman',
  'master', 'jordan', 'harley', 'ranger', 'shadow', 'mustang'
];

export class PasswordPolicyValidator {
  private policy: PasswordPolicy;

  constructor(policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY) {
    this.policy = policy;
  }

  /**
   * Validate password against policy
   */
  validatePassword(
    password: string, 
    userInfo?: { username?: string; email?: string; fullname?: string },
    passwordHistory?: string[]
  ): PasswordValidationResult {
    const errors: string[] = [];
    let score = 0;

    // Length validation
    if (password.length < this.policy.minLength) {
      errors.push(`Password must be at least ${this.policy.minLength} characters long`);
    } else {
      score += Math.min(password.length * 2, 20); // Max 20 points for length
    }

    if (password.length > this.policy.maxLength) {
      errors.push(`Password must not exceed ${this.policy.maxLength} characters`);
    }

    // Character requirements
    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    } else if (/[A-Z]/.test(password)) {
      score += 10;
    }

    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    } else if (/[a-z]/.test(password)) {
      score += 10;
    }

    if (this.policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    } else if (/\d/.test(password)) {
      score += 10;
    }

    if (this.policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    } else if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      score += 15;
    }

    // Common password check
    if (this.policy.preventCommonPasswords) {
      const lowerPassword = password.toLowerCase();
      if (COMMON_PASSWORDS.includes(lowerPassword)) {
        errors.push('Password is too common. Please choose a more unique password');
      } else {
        score += 10;
      }
    }

    // User info check
    if (this.policy.preventUserInfo && userInfo) {
      const lowerPassword = password.toLowerCase();
      const checks = [
        userInfo.username?.toLowerCase(),
        userInfo.email?.toLowerCase().split('@')[0],
        userInfo.fullname?.toLowerCase().replace(/\s+/g, '')
      ].filter(Boolean);

      for (const check of checks) {
        if (check && check.length > 2 && lowerPassword.includes(check)) {
          errors.push('Password should not contain your personal information');
          break;
        }
      }

      if (!errors.some(e => e.includes('personal information'))) {
        score += 10;
      }
    }

    // Password history check
    if (passwordHistory && passwordHistory.length > 0) {
      for (const oldPassword of passwordHistory.slice(0, this.policy.historyCheck)) {
        if (bcrypt.compareSync(password, oldPassword)) {
          errors.push(`Password cannot be the same as your last ${this.policy.historyCheck} passwords`);
          break;
        }
      }
    }

    // Additional complexity checks for scoring
    const hasConsecutiveChars = /(.)\1{2,}/.test(password);
    const hasSequentialChars = this.hasSequentialChars(password);
    const hasVariedChars = new Set(password).size / password.length > 0.6;

    if (!hasConsecutiveChars) score += 5;
    if (!hasSequentialChars) score += 5;
    if (hasVariedChars) score += 10;

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong';
    if (score < 40) {
      strength = 'weak';
    } else if (score < 70) {
      strength = 'medium';
    } else {
      strength = 'strong';
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength,
      score: Math.min(score, 100)
    };
  }

  /**
   * Check for sequential characters (abc, 123, etc.)
   */
  private hasSequentialChars(password: string): boolean {
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      '0123456789',
      'qwertyuiopasdfghjklzxcvbnm'
    ];

    for (const sequence of sequences) {
      for (let i = 0; i <= sequence.length - 3; i++) {
        const subseq = sequence.substring(i, i + 3);
        if (password.toLowerCase().includes(subseq)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Generate password strength feedback
   */
  getPasswordFeedback(result: PasswordValidationResult): string[] {
    const feedback: string[] = [];

    if (result.strength === 'weak') {
      feedback.push('Your password is weak. Consider making it longer and more complex.');
    } else if (result.strength === 'medium') {
      feedback.push('Your password is moderately strong. You can improve it further.');
    } else {
      feedback.push('Your password is strong!');
    }

    if (result.score < 100) {
      feedback.push('Tips to improve your password:');
      
      if (!/[A-Z]/.test('')) feedback.push('• Add uppercase letters');
      if (!/[a-z]/.test('')) feedback.push('• Add lowercase letters');
      if (!/\d/.test('')) feedback.push('• Add numbers');
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test('')) feedback.push('• Add special characters');
      feedback.push('• Make it longer');
      feedback.push('• Avoid common words and patterns');
    }

    return feedback;
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length: number = 12): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
    
    let password = '';
    let charset = '';

    // Ensure at least one character from each required set
    if (this.policy.requireUppercase) {
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      charset += uppercase;
    }
    
    if (this.policy.requireLowercase) {
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      charset += lowercase;
    }
    
    if (this.policy.requireNumbers) {
      password += numbers[Math.floor(Math.random() * numbers.length)];
      charset += numbers;
    }
    
    if (this.policy.requireSpecialChars) {
      password += special[Math.floor(Math.random() * special.length)];
      charset += special;
    }

    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

// Export default instance
export const passwordValidator = new PasswordPolicyValidator();
