/**
 * Password validation utilities
 */

export interface PasswordStrength {
  score: number // 0-4 (0=very weak, 4=very strong)
  feedback: string[]
  isValid: boolean
}

export interface PasswordRequirements {
  minLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
}

/**
 * Check if password meets all requirements
 */
export function validatePasswordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  }
}

/**
 * Calculate password strength
 */
export function calculatePasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, feedback: ['Enter a password'], isValid: false }
  }

  const requirements = validatePasswordRequirements(password)
  const feedback: string[] = []
  let score = 0

  // Check length
  if (!requirements.minLength) {
    feedback.push('At least 8 characters')
  } else {
    score += 1
  }

  // Check character types
  if (!requirements.hasLowercase) {
    feedback.push('Include lowercase letters')
  } else {
    score += 1
  }

  if (!requirements.hasUppercase) {
    feedback.push('Include uppercase letters')
  } else {
    score += 1
  }

  if (!requirements.hasNumber) {
    feedback.push('Include numbers')
  } else {
    score += 1
  }

  if (!requirements.hasSpecialChar) {
    feedback.push('Include special characters (!@#$%^&*)')
  } else {
    score += 1
  }

  // Additional checks for stronger passwords
  if (password.length >= 12) score += 0.5
  if (password.length >= 16) score += 0.5

  // Common patterns check
  if (isCommonPassword(password)) {
    feedback.push('Avoid common passwords')
    score = Math.max(0, score - 2)
  }

  const finalScore = Math.min(4, Math.floor(score))
  const isValid = Object.values(requirements).every(Boolean)

  return { score: finalScore, feedback, isValid }
}

/**
 * Get password strength label and color
 */
export function getPasswordStrengthDisplay(score: number): { label: string; color: string } {
  switch (score) {
    case 0:
      return { label: 'Very Weak', color: 'text-red-600' }
    case 1:
      return { label: 'Weak', color: 'text-red-500' }
    case 2:
      return { label: 'Fair', color: 'text-yellow-500' }
    case 3:
      return { label: 'Good', color: 'text-blue-600' }
    case 4:
      return { label: 'Strong', color: 'text-green-600' }
    default:
      return { label: 'Unknown', color: 'text-gray-400' }
  }
}

/**
 * Check if password is commonly used
 */
function isCommonPassword(password: string): boolean {
  const common = [
    'password', '123456', '12345678', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    '1234567890', 'iloveyou', 'sunshine', 'master', 'shadow'
  ]
  return common.includes(password.toLowerCase())
}