/**
 * Validation Middleware and Utilities
 *
 * Provides robust validation for common input types to prevent
 * injection attacks and data manipulation.
 */

/**
 * Validates that a value is a positive integer
 * Throws an error if validation fails
 *
 * @param value - Value to validate (string or number)
 * @param fieldName - Name of the field for error messages
 * @returns Validated positive integer
 * @throws Error if value is not a valid positive integer
 */
export function validatePositiveInteger(value: any, fieldName: string): number {
  const num = parseInt(value, 10);

  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a number, received: ${value}`);
  }

  if (num <= 0) {
    throw new Error(`${fieldName} must be positive, received: ${num}`);
  }

  if (!Number.isInteger(num)) {
    throw new Error(`${fieldName} must be an integer, received: ${num}`);
  }

  // Additional safety check for extremely large numbers
  if (num > Number.MAX_SAFE_INTEGER) {
    throw new Error(`${fieldName} exceeds maximum safe integer value`);
  }

  return num;
}

/**
 * Validates that a value is a non-negative integer (0 or positive)
 *
 * @param value - Value to validate
 * @param fieldName - Name of the field for error messages
 * @returns Validated non-negative integer
 * @throws Error if value is not valid
 */
export function validateNonNegativeInteger(value: any, fieldName: string): number {
  const num = parseInt(value, 10);

  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a number`);
  }

  if (num < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }

  if (!Number.isInteger(num)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  return num;
}

/**
 * Whitelist of allowed settings fields that users can modify
 * This prevents mass assignment attacks where users could inject
 * malicious fields into the settings JSON object.
 */
const ALLOWED_SETTINGS_FIELDS = [
  'avatar',
  'theme',
  'language',
  'notifications',
  'timezone',
  'walletAddress',
  'wallets',
  'twoFactorEnabled',
  'emailNotifications',
  'smsNotifications',
  'currency',
  'dateFormat',
  'timeFormat'
] as const;

/**
 * Sanitizes user settings to prevent mass assignment attacks
 *
 * Only allows whitelisted fields to be set in the settings object.
 * This prevents injection of malicious fields like __proto__, role, etc.
 *
 * @param settings - Raw settings object from user input
 * @returns Sanitized settings object with only allowed fields
 */
export function sanitizeSettings(settings: any): Record<string, any> {
  if (!settings || typeof settings !== 'object') {
    return {};
  }

  // Prevent prototype pollution
  if ('__proto__' in settings || 'constructor' in settings || 'prototype' in settings) {
    console.warn('[Security] Prototype pollution attempt detected in settings:', {
      hasProto: '__proto__' in settings,
      hasConstructor: 'constructor' in settings,
      hasPrototype: 'prototype' in settings
    });
    // Remove dangerous fields
    delete settings.__proto__;
    delete settings.constructor;
    delete settings.prototype;
  }

  const sanitized: Record<string, any> = {};

  // Only copy whitelisted fields
  for (const key of ALLOWED_SETTINGS_FIELDS) {
    if (key in settings) {
      sanitized[key] = settings[key];
    }
  }

  // Log if non-whitelisted fields were attempted
  const attemptedFields = Object.keys(settings);
  const rejectedFields = attemptedFields.filter(
    field => !ALLOWED_SETTINGS_FIELDS.includes(field as any)
  );

  if (rejectedFields.length > 0) {
    console.warn('[Security] Non-whitelisted settings fields rejected:', {
      rejected: rejectedFields,
      timestamp: new Date().toISOString()
    });
  }

  return sanitized;
}

/**
 * Sanitizes custom fields to prevent JSON injection attacks
 *
 * @param customFields - Raw custom fields object
 * @returns Sanitized custom fields
 */
export function sanitizeCustomFields(customFields: any): Record<string, any> {
  if (!customFields || typeof customFields !== 'object') {
    return {};
  }

  // Prevent prototype pollution
  if ('__proto__' in customFields || 'constructor' in customFields) {
    console.warn('[Security] Prototype pollution attempt in custom fields');
    delete customFields.__proto__;
    delete customFields.constructor;
    delete customFields.prototype;
  }

  // Limit depth of nested objects to prevent DoS
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(customFields)) {
    // Skip dangerous keys
    if (key.includes('__proto__') || key.includes('constructor')) {
      continue;
    }

    // Limit string length to prevent DoS
    if (typeof value === 'string' && value.length > 10000) {
      sanitized[key] = value.substring(0, 10000);
      console.warn('[Security] Custom field value truncated:', { key, originalLength: value.length });
    } else if (typeof value === 'object' && value !== null) {
      // For nested objects, convert to string to prevent deep nesting attacks
      sanitized[key] = JSON.stringify(value).substring(0, 10000);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Validates an email address format
 *
 * @param email - Email to validate
 * @returns true if valid, false otherwise
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email regex - not perfect but good enough
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates that a string is not empty and within length limits
 *
 * @param value - String to validate
 * @param fieldName - Name of field for error messages
 * @param minLength - Minimum length (default: 1)
 * @param maxLength - Maximum length (default: 1000)
 * @returns Validated and trimmed string
 * @throws Error if validation fails
 */
export function validateString(
  value: any,
  fieldName: string,
  minLength: number = 1,
  maxLength: number = 1000
): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    throw new Error(`${fieldName} must be at least ${minLength} characters`);
  }

  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} must not exceed ${maxLength} characters`);
  }

  return trimmed;
}
