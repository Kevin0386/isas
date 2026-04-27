/**
 * Validate Botswana Omang number
 * Rules:
 * - Must be exactly 9 digits
 * - 5th digit (position 4) must be 1 (male) or 2 (female)
 */

export const validateOmang = (omang) => {
  if (!omang || typeof omang !== 'string') {
    return { valid: false, gender: null, message: 'Omang is required' };
  }
  if (!/^\d+$/.test(omang)) {
    return { valid: false, gender: null, message: 'Omang must contain only digits' };
  }
  if (omang.length !== 9) {
    return { valid: false, gender: null, message: 'Omang must be exactly 9 digits' };
  }
  const fifthDigit = omang.charAt(4);
  if (fifthDigit === '1') {
    return { valid: true, gender: 'male', message: 'Valid Omang' };
  } else if (fifthDigit === '2') {
    return { valid: true, gender: 'female', message: 'Valid Omang' };
  } else {
    return { valid: false, gender: null, message: 'Invalid Omang: 5th digit must be 1 (male) or 2 (female)' };
  }
};

export const formatOmang = (omang) => {
  return omang.replace(/\D/g, '').slice(0, 9);
};