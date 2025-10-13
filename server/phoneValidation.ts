/**
 * Phone Validation Module
 * Replicates the PHP formatPhoneAPI.php logic for Argentina phone numbers
 *
 * Features:
 * - Cleans phone numbers (removes non-digit characters)
 * - Validates and formats Argentina phone numbers
 * - Validates area codes against known list
 * - Integrates with numverify API to check if number is mobile
 * - Persists both original and formatted phone numbers
 */

import { checkAreaCode, isValidAreaCode } from './areaCodes';
import fs from 'fs';
import path from 'path';

const NUMVERIFY_API_KEY = process.env.NUMVERIFY_API_KEY || '14284677a0d7d87fada312eed3aaf6ca';
const NUMVERIFY_API_URL = 'https://apilayer.net/api/validate';

/**
 * Interface for phone validation result
 */
export interface PhoneValidationResult {
  isValid: boolean;
  originalPhone: string;
  formattedPhone: string | null;
  cleanedPhone: string;
  errorReason?: string;
  isMobile?: boolean;
}

/**
 * Interface for numverify API response
 */
interface NumverifyResponse {
  valid: boolean;
  number: string;
  local_format: string;
  international_format: string;
  country_prefix: string;
  country_code: string;
  country_name: string;
  location: string;
  carrier: string;
  line_type: 'mobile' | 'landline' | 'special_services' | 'toll_free' | 'premium_rate';
}

/**
 * Log formatting operations for debugging
 */
function logFormatApi(logType: string, message: string): void {
  const now = new Date();
  const dateStr = now.toISOString().replace('T', ' ').substring(0, 19);
  const logDir = path.join(process.cwd(), 'logs_scripts');

  try {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, `${logType}-${now.toISOString().substring(0, 10).replace(/-/g, '_')}.log`);
    const logMessage = `${dateStr}: ${message}\n`;

    fs.appendFileSync(logFile, logMessage);
  } catch (error) {
    console.error('Error writing to log file:', error);
  }
}

/**
 * Clean phone number - remove all non-digit characters
 * Equivalent to clean_phone() in PHP
 */
export function cleanPhone(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Check if phone number starts with "15" and convert to "11" format
 * Equivalent to checkQuince() in PHP
 */
function checkQuince(phone: string): string {
  if (phone.startsWith('15') && phone.length >= 10) {
    const restNumber = phone.substring(2);
    return '11' + restNumber;
  }
  return phone;
}

/**
 * Check if a phone number is mobile using numverify API
 * Equivalent to isMobile() in PHP
 */
async function isMobile(phone: string, countryCode: string = 'AR', retries: number = 0): Promise<boolean> {
  if (retries > 10) {
    logFormatApi('ismobile', `Max retries reached for ${phone}`);
    return false;
  }

  try {
    const endpoint = `${NUMVERIFY_API_URL}?access_key=${NUMVERIFY_API_KEY}&number=${phone}&country_code=${countryCode}&format=1`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeout);

    logFormatApi('ismobile', `StatusCode: [${response.status}] - ${phone} - attempt ${retries}`);

    if (response.status !== 200) {
      if (retries < 10) {
        return await isMobile(phone, countryCode, retries + 1);
      }
      return false;
    }

    const data: NumverifyResponse = await response.json();

    // Log API response for debugging
    if (data.valid !== undefined && data.line_type !== undefined) {
      logFormatApi('apilayer_debug', `${phone},${data.valid},${data.line_type}`);
    } else {
      logFormatApi('apilayer_debug', `${phone},ERROR,No valid in response,NA`);
    }

    // For Argentina, check if international format contains "9" after country code
    if (countryCode === 'AR') {
      if (data.international_format && data.international_format.length > 3) {
        const charAfterCountryCode = data.international_format.charAt(3);
        return charAfterCountryCode === '9';
      }
      return false;
    } else if (countryCode === 'MX') {
      return data.valid === true;
    }

    return false;
  } catch (error: any) {
    logFormatApi('ismobile', `ERROR: ${error.message} - ${phone} - attempt ${retries}`);
    if (retries < 10) {
      return await isMobile(phone, countryCode, retries + 1);
    }
    return false;
  }
}

/**
 * Validate and clean Argentina phone number
 * Equivalent to isValidAR() in PHP
 */
function isValidAR(
  phone: string,
  affi: string = 'NODEF',
  pubid: string = 'NODEF',
  recursive: boolean = false,
  phoneOriginal: string = ''
): string | null {
  if (!recursive) {
    phoneOriginal = phone;
    phone = cleanPhone(phone);
  }

  const flog = 'formatPhone_NULL_new';

  // Remove international prefix "54" (Argentina country code)
  if (phone.length > 9 && phone.startsWith('54')) {
    return isValidAR(phone.substring(2), affi, pubid, true, phoneOriginal);
  }

  // Remove leading "0"
  if (phone.length > 8 && phone.charAt(0) === '0') {
    return isValidAR(phone.substring(1), affi, pubid, true, phoneOriginal);
  }

  // Remove leading "9"
  if (phone.length > 8 && phone.charAt(0) === '9') {
    return isValidAR(phone.substring(1), affi, pubid, true, phoneOriginal);
  }

  // No more recursion - validate length
  const len = phone.length;

  switch (len) {
    case 10:
      // Perfect length for AR phone
      break;

    case 8:
      // Add Buenos Aires area code (11)
      phone = '11' + phone;
      break;

    case 12:
      // Remove "15" if present
      const pos15 = phone.indexOf('15');
      if (pos15 !== -1) {
        phone = phone.substring(0, pos15) + phone.substring(pos15 + 2);
        break;
      }
      // Fall through to default if no "15" found

    default:
      logFormatApi(flog, `${affi},${pubid},${phone},${phoneOriginal},${len} digits`);
      return null;
  }

  return phone;
}

/**
 * Format Argentina phone number with area code and mobile prefix
 * Equivalent to formatPhone() main logic in PHP
 */
export async function formatPhone(
  phoneInput: string,
  country: string = 'AR',
  affi: string = 'NODEF',
  pubid: string = 'NODEF'
): Promise<PhoneValidationResult> {
  const phoneOriginal = phoneInput;

  // Currently only supporting Argentina
  if (country !== 'AR') {
    return {
      isValid: false,
      originalPhone: phoneOriginal,
      formattedPhone: null,
      cleanedPhone: cleanPhone(phoneInput),
      errorReason: `Country ${country} not supported yet`
    };
  }

  // Validate and clean the phone number
  const cleanedPhone = isValidAR(phoneInput, affi, pubid);

  if (cleanedPhone === null) {
    return {
      isValid: false,
      originalPhone: phoneOriginal,
      formattedPhone: null,
      cleanedPhone: cleanPhone(phoneInput),
      errorReason: 'Invalid phone number format'
    };
  }

  // Check for "15" pattern and normalize
  const normalizedPhone = checkQuince(cleanedPhone);

  // Try to format with different area code lengths (4, 3, 2 digits)
  let formattedPhone: string | null = null;
  let isMobileNumber = false;

  try {
    // Check if it's a mobile number (this can be slow, so we do it once)
    isMobileNumber = await isMobile(normalizedPhone, country);

    const mobile = isMobileNumber ? '15' : '';

    // Try 4-digit area code first
    const areaCode4 = normalizedPhone.substring(0, 4);
    if (checkAreaCode(areaCode4)) {
      formattedPhone = areaCode4 + mobile + normalizedPhone.substring(4, 10);
    }
    // Try 3-digit area code
    else if (checkAreaCode(normalizedPhone.substring(0, 3))) {
      const areaCode3 = normalizedPhone.substring(0, 3);
      formattedPhone = areaCode3 + mobile + normalizedPhone.substring(3, 10);
    }
    // Default to 2-digit area code
    else {
      const areaCode2 = normalizedPhone.substring(0, 2);
      formattedPhone = areaCode2 + mobile + normalizedPhone.substring(2, 10);
    }

    // Final validation: check if formatted phone has valid area code
    if (formattedPhone && !isValidAreaCode(formattedPhone)) {
      logFormatApi('formatPhone_AreaCode_Fail', `${affi},${pubid},${phoneOriginal},${formattedPhone}`);
      return {
        isValid: false,
        originalPhone: phoneOriginal,
        formattedPhone: null,
        cleanedPhone: normalizedPhone,
        errorReason: 'Invalid area code',
        isMobile: isMobileNumber
      };
    }

    return {
      isValid: true,
      originalPhone: phoneOriginal,
      formattedPhone: formattedPhone,
      cleanedPhone: normalizedPhone,
      isMobile: isMobileNumber
    };
  } catch (error: any) {
    logFormatApi('formatPhone_Error', `${affi},${pubid},${phoneOriginal},${error.message}`);
    return {
      isValid: false,
      originalPhone: phoneOriginal,
      formattedPhone: null,
      cleanedPhone: normalizedPhone,
      errorReason: `Error during formatting: ${error.message}`
    };
  }
}

/**
 * Get WhatsApp format for a phone number
 * Equivalent to get_whatsapp_format() in PHP
 */
export function getWhatsAppFormat(phone: string): string | null {
  const pos15 = phone.indexOf('15', 2);

  if (pos15 === -1 || pos15 > 4) {
    return null;
  }

  let phoneRet = '549';
  phoneRet += phone.substring(0, pos15);
  phoneRet += phone.substring(pos15 + 2);

  if (phoneRet.length !== 13) {
    return null;
  }

  return phoneRet;
}
