import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.AADHAAR_ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 32 bytes
const IV_LENGTH = 16;

/**
 * Encrypts a string using AES-256-CBC.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

/**
 * Decrypts a string using AES-256-CBC.
 */
export function decrypt(text: string): string {
  const textParts = text.split(':');
  const ivStr = textParts.shift();
  if (!ivStr) throw new Error('Invalid encryption format');
  
  const iv = Buffer.from(ivStr, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

/**
 * Masks an Aadhaar string, showing only the last 4 digits.
 * e.g., "123456789012" -> "XXXX XXXX 9012"
 */
export function maskAadhaar(aadhaar: string): string {
  const clean = aadhaar.replace(/\D/g, '');
  if (clean.length !== 12) return aadhaar; // Return as-is if invalid length
  return `XXXX XXXX ${clean.slice(8, 12)}`;
}
