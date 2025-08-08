import bcrypt from 'bcryptjs'

/**
 * Hash a password using bcrypt
 * @param password - Plain text password to hash
 * @param saltRounds - Number of salt rounds (default: 12 for production security)
 * @returns Promise<string> - Hashed password
 */
export async function hashPassword(password: string, saltRounds: number = 12): Promise<string> {
  try {
    if (!password) {
      throw new Error('Password is required')
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long')
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds)
    return hashedPassword
  } catch (error) {
    console.error('Password hashing failed:', error)
    throw new Error('Failed to hash password')
  }
}

/**
 * Compare a plain text password with a hashed password
 * @param password - Plain text password to verify
 * @param hashedPassword - Previously hashed password from database
 * @returns Promise<boolean> - True if passwords match, false otherwise
 */
export async function comparePasswords(password: string, hashedPassword: string): Promise<boolean> {
  try {
    if (!password || !hashedPassword) {
      throw new Error('Password and hashed password are required')
    }

    const isMatch = await bcrypt.compare(password, hashedPassword)
    return isMatch
  } catch (error) {
    console.error('Password comparison failed:', error)
    return false
  }
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns object with validation results
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean
  errors: string[]
  score: number
} {
  const errors: string[] = []
  let score = 0

  if (!password) {
    errors.push('Password is required')
    return { isValid: false, errors, score: 0 }
  }

  // Minimum length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  } else {
    score += 1
  }

  // Maximum length check (prevent DoS attacks)
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters long')
  }

  // Character type checks
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  } else {
    score += 1
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  } else {
    score += 1
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  } else {
    score += 1
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  } else {
    score += 1
  }

  // Common password checks
  const commonPasswords = [
    'password', '123456', '12345678', 'qwerty', 'abc123', 
    'password123', 'admin', 'letmein', 'welcome', 'monkey'
  ]
  
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a more unique password')
    score = Math.max(0, score - 2)
  }

  // Sequential characters check
  if (/123456|abcdef|qwerty/i.test(password)) {
    errors.push('Password should not contain sequential characters')
    score = Math.max(0, score - 1)
  }

  return {
    isValid: errors.length === 0,
    errors,
    score: Math.min(5, score) // Cap at 5
  }
}

/**
 * Generate a secure random password
 * @param length - Password length (default: 12)
 * @param includeSpecialChars - Whether to include special characters
 * @returns string - Generated password
 */
export function generateSecurePassword(
  length: number = 12, 
  includeSpecialChars: boolean = true
): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?'
  
  let charset = lowercase + uppercase + numbers
  if (includeSpecialChars) {
    charset += specialChars
  }

  // Ensure password contains at least one character from each category
  let password = ''
  password += lowercase[Math.floor(Math.random() * lowercase.length)]
  password += uppercase[Math.floor(Math.random() * uppercase.length)]
  password += numbers[Math.floor(Math.random() * numbers.length)]
  
  if (includeSpecialChars) {
    password += specialChars[Math.floor(Math.random() * specialChars.length)]
  }

  // Fill remaining length with random characters
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)]
  }

  // Shuffle the password to randomize character positions
  return password.split('').sort(() => 0.5 - Math.random()).join('')
}

/**
 * Check if password needs to be rehashed (for security updates)
 * @param hashedPassword - Current hashed password
 * @param saltRounds - Current salt rounds requirement
 * @returns boolean - True if password should be rehashed
 */
export function shouldRehashPassword(hashedPassword: string, saltRounds: number = 12): boolean {
  try {
    const currentRounds = bcrypt.getRounds(hashedPassword)
    return currentRounds < saltRounds
  } catch (error) {
    console.error('Error checking password hash rounds:', error)
    return true // Rehash if we can't determine current rounds
  }
}
