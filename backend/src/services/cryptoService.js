 const crypto = require('crypto');

const AES_ALGO = 'aes-256-gcm';

function getSignKey() {
  const k = process.env.SIGN_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  if (/^[0-9a-fA-F]+$/.test(k) && k.length === 64) return Buffer.from(k, 'hex');
  return Buffer.from(k, 'base64');
}

function encryptBuffer(buf) {
  const key = getSignKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(AES_ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(buf), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { encrypted, iv: iv.toString('hex'), tag: tag.toString('hex') };
}

function decryptBuffer(encryptedBuf, ivHex, tagHex) {
  const key = getSignKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(AES_ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
}

// PIN helpers for MFA (PBKDF2)
function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(pin, salt, 100000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPinForUser(user, pin) {
  if (!user || !user.pinHash || !user.pinSalt) return false;
  const derived = crypto.pbkdf2Sync(pin, user.pinSalt, 100000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(user.pinHash, 'hex'));
}

// XSS Sanitize
function sanitize(str) {
  if (!str) return str;
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Password policy: min 8 chars, must have letter + number
function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  if (!/[a-zA-Zก-๙]/.test(pw)) return 'รหัสผ่านต้องมีตัวอักษร';
  if (!/[0-9]/.test(pw)) return 'รหัสผ่านต้องมีตัวเลข';
  return null;
}

function fixMojibake(str) {
  if (!str || typeof str !== 'string') return str;
  if (str.includes('à¸') || str.includes('à¹') || str.includes('Ã')) {
    try {
      return Buffer.from(str, 'latin1').toString('utf8');
    } catch (e) {
      return str;
    }
  }
  return str;
}

// Helper: Format doc row from MySQL
function formatDoc(doc) {
  if (!doc) return null;
  const fileName = fixMojibake(doc.fileName);
  const title = fixMojibake(doc.title);
  return {
    ...doc,
    title,
    fileName,
    assignedTo: typeof doc.assignedTo === 'string' ? JSON.parse(doc.assignedTo || '[]') : (doc.assignedTo || []),
    versionHistory: typeof doc.versionHistory === 'string' ? JSON.parse(doc.versionHistory || '[]') : (doc.versionHistory || []),
    signatures: typeof doc.signatures === 'string' ? JSON.parse(doc.signatures || '[]') : (doc.signatures || []),
    comments: typeof doc.comments === 'string' ? JSON.parse(doc.comments || '[]') : (doc.comments || []),
    approvalWorkflow: typeof doc.approvalWorkflow === 'string' ? JSON.parse(doc.approvalWorkflow || '[]') : (doc.approvalWorkflow || [])
  };
}

module.exports = {
  encryptBuffer,
  decryptBuffer,
  hashPin,
  verifyPinForUser,
  sanitize,
  validatePassword,
  formatDoc,
  fixMojibake
};
