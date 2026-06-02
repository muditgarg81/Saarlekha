"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.maskAadhaar = maskAadhaar;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.AADHAAR_ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 32 bytes
const IV_LENGTH = 16;
/**
 * Encrypts a string using AES-256-CBC.
 */
function encrypt(text) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}
/**
 * Decrypts a string using AES-256-CBC.
 */
function decrypt(text) {
    const textParts = text.split(':');
    const ivStr = textParts.shift();
    if (!ivStr)
        throw new Error('Invalid encryption format');
    const iv = Buffer.from(ivStr, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto_1.default.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
/**
 * Masks an Aadhaar string, showing only the last 4 digits.
 * e.g., "123456789012" -> "XXXX XXXX 9012"
 */
function maskAadhaar(aadhaar) {
    const clean = aadhaar.replace(/\D/g, '');
    if (clean.length !== 12)
        return aadhaar; // Return as-is if invalid length
    return `XXXX XXXX ${clean.slice(8, 12)}`;
}
