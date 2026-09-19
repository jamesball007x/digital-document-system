require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('./db');
const { PDFDocument } = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer config for PDF upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('อนุญาตเฉพาะไฟล์ PDF เท่านั้น'), false);
  }
});

// Multer config for signature image upload (memory storage)
const uploadSignature = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (png/jpg) เท่านั้น'), false);
  }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'docms-secret-key-2569',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ========================
// HELPERS & SECURITY
// ========================
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
  const hash = crypto.pbkdf2Sync(String(pin), salt, 100000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPinForUser(user, pin) {
  if (!user || !user.pinHash || !user.pinSalt || !pin) return false;
  const storedHash = String(user.pinHash).trim();
  const storedSalt = String(user.pinSalt).trim();
  if (!storedHash || !storedSalt) return false;
  const derived = crypto.pbkdf2Sync(String(pin), storedSalt, 100000, 32, 'sha256').toString('hex');
  const bufDerived = Buffer.from(derived, 'hex');
  const bufPinHash = Buffer.from(storedHash, 'hex');
  if (bufDerived.length !== bufPinHash.length) return false;
  return crypto.timingSafeEqual(bufDerived, bufPinHash);
}

// Password helpers for PBKDF2
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedPassword) {
  if (!password || !storedPassword) return false;
  const parts = String(storedPassword).trim().split(':');
  if (parts.length !== 2) {
    // Fallback for plain text password (graceful migration)
    return password === storedPassword;
  }
  const [salt, hash] = parts;
  const derived = crypto.pbkdf2Sync(String(password), salt, 100000, 32, 'sha256').toString('hex');
  const bufDerived = Buffer.from(derived, 'hex');
  const bufHash = Buffer.from(hash, 'hex');
  if (bufDerived.length !== bufHash.length) return false;
  return crypto.timingSafeEqual(bufDerived, bufHash);
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

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์เข้าถึง' });
    }
    next();
  };
}

// Helper: Format doc row from MySQL
function formatDoc(doc) {
  if (!doc) return null;
  return {
    ...doc,
    assignedTo: typeof doc.assignedTo === 'string' ? JSON.parse(doc.assignedTo || '[]') : (doc.assignedTo || []),
    versionHistory: typeof doc.versionHistory === 'string' ? JSON.parse(doc.versionHistory || '[]') : (doc.versionHistory || []),
    signatures: typeof doc.signatures === 'string' ? JSON.parse(doc.signatures || '[]') : (doc.signatures || []),
    comments: typeof doc.comments === 'string' ? JSON.parse(doc.comments || '[]') : (doc.comments || []),
    approvalWorkflow: typeof doc.approvalWorkflow === 'string' ? JSON.parse(doc.approvalWorkflow || '[]') : (doc.approvalWorkflow || [])
  };
}

// Helper: Log Activity to MySQL
async function logActivity(userId, userName, action, actionText, target = '', targetName = '', ip = '') {
  try {
    const id = 'log' + Date.now() + Math.random().toString(36).substr(2, 4);
    const timestamp = new Date().toISOString();
    await db.query(
      `INSERT INTO activity_logs (id, userId, userName, action, actionText, target, targetName, timestamp, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId || '', userName || '', action || '', actionText || '', target || '', targetName || '', timestamp, ip || '']
    );
    return id;
  } catch (err) {
    console.error('[Log Error]', err.message);
  }
}

// Helper: create notification
async function createNotification(userId, type, title, message, documentId = null) {
  try {
    const id = 'notif' + Date.now() + Math.random().toString(36).substr(2, 4);
    const createdAt = new Date().toISOString();
    await db.query(
      `INSERT INTO notifications (id, userId, type, title, message, documentId, isRead, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      [id, userId, type, title, message || '', documentId || null, createdAt]
    );
    return id;
  } catch (err) {
    console.error('[Notification Error]', err.message);
  }
}

// Helper: check & update expired documents
async function checkDocumentExpiry() {
  try {
    const now = new Date();
    const rows = await db.query('SELECT id, title, uploadedBy, expiryDate, status FROM documents WHERE expiryDate IS NOT NULL AND status != "expired"');
    for (const doc of rows) {
      if (new Date(doc.expiryDate) < now) {
        await db.query('UPDATE documents SET status = "expired", statusText = "หมดอายุ" WHERE id = ?', [doc.id]);
        await createNotification(doc.uploadedBy, 'status_change', 'เอกสารหมดอายุ', `เอกสาร "${doc.title}" หมดอายุแล้ว`, doc.id);
      }
    }
  } catch (err) {
    console.error('[Expiry Check Error]', err.message);
  }
}

// Middleware: ensure the current user is authorized to sign the document
async function requireSignerPermission(req, res, next) {
  try {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });

    const doc = formatDoc(docs[0]);
    const userId = req.session.user.id;
    const role = req.session.user.role;
    const isOwner = doc.uploadedBy === userId;
    const isAssigned = Array.isArray(doc.assignedTo) && doc.assignedTo.includes(userId);
    const isHighLevel = role === 'admin' || role === 'executive';

    if (isOwner || isAssigned || isHighLevel) return next();

    // Log denied signing attempt
    await logActivity(userId, req.session.user.name, 'sign_denied', 'ปฏิเสธการลงนาม (ไม่มีสิทธิ์)', doc.id, doc.title, req.ip);

    return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ลงนามเอกสารนี้' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดขณะตรวจสอบสิทธิ์' });
  }
}

const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 นาที
  max: 5, // จำกัด 5 ครั้งต่อ IP
  message: { error: 'เข้าสู่ระบบผิดพลาดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================
// AUTH ROUTES
// ========================
app.post('/api/auth/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const users = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = users[0];

    if (!user) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }

    // Account lockout check
    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const remaining = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res.status(403).json({ error: `บัญชีถูกล็อก กรุณารอ ${remaining} นาที` });
    }

    // Wrong password
    if (!verifyPassword(password, user.password)) {
      const newAttempts = (user.failedAttempts || 0) + 1;
      if (newAttempts >= 5) {
        const lockedUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        await db.query('UPDATE users SET failedAttempts = 0, lockedUntil = ? WHERE id = ?', [lockedUntil, user.id]);
        return res.status(403).json({ error: 'รหัสผ่านผิด 5 ครั้ง บัญชีถูกล็อก 15 นาที' });
      }
      await db.query('UPDATE users SET failedAttempts = ? WHERE id = ?', [newAttempts, user.id]);
      return res.status(401).json({ error: `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (เหลือ ${5 - newAttempts} ครั้ง)` });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'บัญชีถูกระงับ' });
    }

    // Success - reset failed attempts & update lastLogin
    const lastLogin = new Date().toISOString();
    await db.query('UPDATE users SET failedAttempts = 0, lockedUntil = NULL, lastLogin = ? WHERE id = ?', [lastLogin, user.id]);

    // Log
    await logActivity(user.id, user.name, 'login', 'เข้าสู่ระบบ', '', '', req.ip);

    const { password: _, failedAttempts: _f, lockedUntil: _l, pinHash: _ph, pinSalt: _ps, ...safeUser } = user;
    safeUser.hasPin = !!(user.pinHash && user.pinSalt);
    safeUser.lastLogin = lastLogin;
    req.session.user = safeUser;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  if (req.session.user) {
    await logActivity(req.session.user.id, req.session.user.name, 'logout', 'ออกจากระบบ', '', '', req.ip);
  }
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth/me', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบ' });
  }
  const users = await db.query('SELECT pinHash, pinSalt FROM users WHERE id = ?', [req.session.user.id]);
  if (users.length) {
    req.session.user.hasPin = !!(users[0].pinHash && users[0].pinSalt);
  }
  res.json({ user: req.session.user });
});

// Forgot password (reset by username + email)
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { username, email } = req.body;
    if (!username || !email) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้ใช้และอีเมล' });
    }

    const users = await db.query('SELECT * FROM users WHERE username = ? AND email = ?', [username, email]);
    const user = users[0];

    if (!user) {
      return res.status(404).json({ error: 'ไม่พบบัญชีที่ตรงกับชื่อผู้ใช้และอีเมลนี้' });
    }

    // Generate random password
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    let newPw = '';
    for (let i = 0; i < 8; i++) newPw += chars[Math.floor(Math.random() * chars.length)];
    newPw += Math.floor(Math.random() * 90 + 10);

    const hashedPw = hashPassword(newPw);
    await db.query('UPDATE users SET password = ?, failedAttempts = 0, lockedUntil = NULL WHERE id = ?', [hashedPw, user.id]);

    // Log
    await logActivity(user.id, user.name, 'reset_password', 'รีเซ็ตรหัสผ่าน', '', '', req.ip);

    res.json({ success: true, newPassword: newPw, message: `รหัสผ่านใหม่ของคุณคือ: ${newPw}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน' });
  }
});

// Self-registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password, name, email, department } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ (ชื่อผู้ใช้, รหัสผ่าน, ชื่อ-นามสกุล)' });
    }

    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const existing = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
    }

    const newUser = {
      id: 'u' + Date.now(),
      username: sanitize(username),
      password: hashPassword(password),
      name: sanitize(name),
      email: sanitize(email) || '',
      role: 'user',
      roleName: 'ผู้ใช้งานทั่วไป',
      department: sanitize(department) || '',
      status: 'active',
      avatar: '',
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    await db.query(
      `INSERT INTO users (id, username, password, name, email, role, roleName, department, status, avatar, failedAttempts, lockedUntil, createdAt, lastLogin)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newUser.id, newUser.username, newUser.password, newUser.name, newUser.email, newUser.role,
        newUser.roleName, newUser.department, newUser.status, newUser.avatar, 0, null, newUser.createdAt, null
      ]
    );

    // Log
    await logActivity(newUser.id, newUser.name, 'register', 'สมัครสมาชิกใหม่', '', '', req.ip);

    const { password: _, failedAttempts: _f, lockedUntil: _l, ...safeUser } = newUser;
    req.session.user = safeUser;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
});

// ========================
// USER MANAGEMENT ROUTES (Admin only)
// ========================
app.get('/api/users', requireRole('admin'), async (req, res) => {
  try {
    const users = await db.query('SELECT id, username, name, email, role, roleName, department, status, avatar, createdAt, lastLogin FROM users ORDER BY createdAt DESC');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' });
  }
});

app.get('/api/users/all-basic', requireAuth, async (req, res) => {
  try {
    const users = await db.query('SELECT id, name, role, roleName, department FROM users WHERE status = "active"');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้' });
  }
});

app.post('/api/users', requireRole('admin'), async (req, res) => {
  try {
    const { username, password, name, email, role, department, position, phone } = req.body;

    if (!username || !username.trim() || !password || !name || !name.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อผู้ใช้, รหัสผ่าน, ชื่อ-นามสกุล)' });
    }

    const existing = await db.query('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
    }

    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ error: pwErr });

    const roleNames = {
      admin: 'ผู้ดูแลระบบ',
      secretary: 'ธุรการ',
      user: 'ผู้ใช้งานทั่วไป',
      executive: 'ผู้บริหารระดับสูง'
    };

    const newUser = {
      id: 'u' + Date.now(),
      username: sanitize(username),
      password: hashPassword(password),
      name: sanitize(name),
      email: sanitize(email) || '',
      role: role || 'user',
      roleName: roleNames[role] || role,
      department: sanitize(department) || '',
      position: sanitize(position) || '',
      phone: sanitize(phone) || '',
      status: 'active',
      avatar: '',
      createdAt: new Date().toISOString()
    };

    await db.query(
      `INSERT INTO users (id, username, password, name, email, role, roleName, department, position, phone, status, avatar, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newUser.id, newUser.username, newUser.password, newUser.name, newUser.email, newUser.role, newUser.roleName, newUser.department, newUser.position, newUser.phone, newUser.status, newUser.avatar, newUser.createdAt]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'create_user', 'สร้างผู้ใช้ใหม่', newUser.id, newUser.name, req.ip);

    const { password: _, ...safeUser } = newUser;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' });
  }
});

app.put('/api/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const users = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!users.length) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    const roleNames = {
      admin: 'ผู้ดูแลระบบ',
      secretary: 'ธุรการ',
      user: 'ผู้ใช้งานทั่วไป',
      executive: 'ผู้บริหารระดับสูง'
    };

    const updates = req.body;
    const name = updates.name ? sanitize(updates.name) : users[0].name;
    const email = updates.email ? sanitize(updates.email) : users[0].email;
    const department = updates.department ? sanitize(updates.department) : users[0].department;
    const position = updates.position !== undefined ? sanitize(updates.position) : (users[0].position || '');
    const phone = updates.phone !== undefined ? sanitize(updates.phone) : (users[0].phone || '');
    const role = updates.role || users[0].role;
    const roleName = roleNames[role] || role;
    const status = updates.status || users[0].status;

    let password = users[0].password;
    if (updates.password) {
      const pwErr = validatePassword(updates.password);
      if (pwErr) return res.status(400).json({ error: pwErr });
      password = hashPassword(updates.password);
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อ-นามสกุล' });
    }

    await db.query(
      `UPDATE users SET name = ?, email = ?, department = ?, position = ?, phone = ?, role = ?, roleName = ?, status = ?, password = ? WHERE id = ?`,
      [name, email, department, position, phone, role, roleName, status, password, req.params.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'update_user', 'แก้ไขข้อมูลผู้ใช้', req.params.id, name, req.ip);

    const updatedUser = { ...users[0], name, email, department, position, phone, role, roleName, status };
    delete updatedUser.password;
    res.json({ success: true, user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขผู้ใช้' });
  }
});

app.delete('/api/users/:id', requireRole('admin'), async (req, res) => {
  try {
    const users = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!users.length) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    await db.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    await logActivity(req.session.user.id, req.session.user.name, 'delete_user', 'ลบผู้ใช้', users[0].id, users[0].name, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบผู้ใช้' });
  }
});

// ========================
// DOCUMENT ROUTES
// ========================
app.get('/api/documents', requireAuth, async (req, res) => {
  try {
    await checkDocumentExpiry();
    const user = req.session.user;
    const docs = await db.query('SELECT * FROM documents ORDER BY createdAt DESC');
    let documents = docs.map(formatDoc);

    let filtered = [];
    if (user.role === 'admin' || user.role === 'executive' || user.role === 'secretary') {
      filtered = documents;
    } else {
      // General user: see assigned documents or owned documents or document_access granted
      const granted = await db.query('SELECT docId FROM document_access WHERE userId = ?', [user.id]);
      const grantedDocIds = granted.map(g => g.docId);
      filtered = documents.filter(d => (d.assignedTo && d.assignedTo.includes(user.id)) || d.uploadedBy === user.id || grantedDocIds.includes(d.id));
    }

    const { search, category, status } = req.query;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(d => (d.title && d.title.toLowerCase().includes(s)) || (d.description && d.description.toLowerCase().includes(s)));
    }
    if (category) filtered = filtered.filter(d => d.category === category);
    if (status) filtered = filtered.filter(d => d.status === status);

    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงเอกสาร' });
  }
});

// Get pending documents count for badge notification
app.get('/api/documents/pending-count', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    const docs = await db.query('SELECT * FROM documents WHERE status IN ("pending_approval", "pending_signature")');
    const formatted = docs.map(formatDoc);
    let count = 0;
    if (user.role === 'admin' || user.role === 'executive' || user.role === 'secretary') {
      count = formatted.length;
    } else {
      count = formatted.filter(d => d.assignedTo && d.assignedTo.includes(user.id)).length;
    }
    res.json({ count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ count: 0 });
  }
});

// Get all documents for admin/secretary (for sharing/access request)
app.get('/api/documents/all', requireRole('admin', 'secretary'), async (req, res) => {
  try {
    const docs = await db.query('SELECT id, title, category FROM documents ORDER BY createdAt DESC');
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.get('/api/documents/:id', requireAuth, async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    res.json(formatDoc(docs[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// Create document WITH file upload
app.post('/api/documents', requireRole('secretary', 'admin'), upload.single('file'), async (req, res) => {
  try {
    const { title, description, category, assignedTo, priority, deadline, expiryDate } = req.body;

    let assignedList = [];
    if (assignedTo) {
      assignedList = typeof assignedTo === 'string' ? JSON.parse(assignedTo) : assignedTo;
    }

    // แก้ปัญหา multer ส่ง originalname มาเป็น Latin-1 ต้อง decode เป็น UTF-8
    const fixFileName = (name) => name ? Buffer.from(name, 'latin1').toString('utf8') : '';

    const newDoc = {
      id: 'doc' + Date.now(),
      title: sanitize(title),
      description: sanitize(description),
      category: category || 'ทั่วไป',
      fileName: req.file ? fixFileName(req.file.originalname) : '',
      fileStorageName: req.file ? req.file.filename : '',
      fileSize: req.file ? req.file.size : 0,
      uploadedBy: req.session.user.id,
      uploadedByName: req.session.user.name,
      assignedTo: assignedList,
      status: 'draft',
      statusText: 'ฉบับร่าง',
      priority: priority || 'medium',
      version: 1,
      versionHistory: [],
      signatures: [],
      comments: [],
      approvalWorkflow: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deadline: deadline || null,
      expiryDate: expiryDate || null
    };

    const execs = await db.query('SELECT * FROM users WHERE role = "executive" LIMIT 1');
    newDoc.approvalWorkflow = [
      { step: 1, role: req.session.user.role, roleName: 'ผู้สร้างเอกสาร (ธุรการ)', name: req.session.user.name, status: 'approved', timestamp: new Date().toISOString() },
      { step: 2, role: 'executive', roleName: 'ผู้อำนวยการ/ผู้บริหาร', name: execs.length ? execs[0].name : 'ผู้บริหาร', status: 'pending', timestamp: null }
    ];

    await db.query(
      `INSERT INTO documents (id, title, description, category, fileName, fileStorageName, fileSize, uploadedBy, uploadedByName, assignedTo, status, statusText, priority, version, versionHistory, signatures, comments, approvalWorkflow, createdAt, updatedAt, deadline, expiryDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newDoc.id, newDoc.title, newDoc.description, newDoc.category, newDoc.fileName, newDoc.fileStorageName,
        newDoc.fileSize, newDoc.uploadedBy, newDoc.uploadedByName, JSON.stringify(newDoc.assignedTo),
        newDoc.status, newDoc.statusText, newDoc.priority, newDoc.version, JSON.stringify(newDoc.versionHistory),
        JSON.stringify(newDoc.signatures), JSON.stringify(newDoc.comments), JSON.stringify(newDoc.approvalWorkflow), newDoc.createdAt, newDoc.updatedAt,
        newDoc.deadline, newDoc.expiryDate
      ]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'upload', 'สร้างเอกสารใหม่', newDoc.id, newDoc.title, req.ip);

    res.json({ success: true, document: newDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างเอกสาร' });
  }
});

// Download document file
app.get('/api/documents/:id/download', requireAuth, async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = docs[0];
    if (!doc.fileStorageName) return res.status(404).json({ error: 'ไม่มีไฟล์แนบ' });

    const filePath = path.join(uploadsDir, doc.fileStorageName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'ไม่พบไฟล์' });

    await logActivity(req.session.user.id, req.session.user.name, 'download', 'ดาวน์โหลดเอกสาร', doc.id, doc.title, req.ip);

    // ใช้ RFC 5987 encoding เพื่อรองรับชื่อไฟล์ภาษาไทยและ Unicode
    const encodedFileName = encodeURIComponent(doc.fileName).replace(/'/g, '%27');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดาวน์โหลดเอกสาร' });
  }
});

// Upload new version
app.post('/api/documents/:id/upload-version', requireRole('secretary', 'admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'กรุณาแนบไฟล์' });

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });

    const doc = formatDoc(docs[0]);
    const history = doc.versionHistory || [];
    history.push({
      version: doc.version,
      fileName: doc.fileName,
      fileStorageName: doc.fileStorageName,
      fileSize: doc.fileSize,
      uploadedBy: doc.uploadedBy,
      uploadedByName: doc.uploadedByName,
      uploadedAt: doc.updatedAt
    });

    const newVersion = (doc.version || 1) + 1;
    const updatedAt = new Date().toISOString();

    const fixFileNameV = (name) => name ? Buffer.from(name, 'latin1').toString('utf8') : '';
    const fixedFileName = fixFileNameV(req.file.originalname);

    await db.query(
      `UPDATE documents SET version = ?, fileName = ?, fileStorageName = ?, fileSize = ?, versionHistory = ?, updatedAt = ? WHERE id = ?`,
      [newVersion, fixedFileName, req.file.filename, req.file.size, JSON.stringify(history), updatedAt, doc.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'upload_version', `อัพโหลดเวอร์ชัน ${newVersion}`, doc.id, doc.title, req.ip);

    // Notify assigned users
    doc.assignedTo.forEach(uid => {
      if (uid !== req.session.user.id) {
        createNotification(uid, 'status_change', 'เอกสารเวอร์ชันใหม่', `เอกสาร "${doc.title}" ถูกอัพเดทเป็นเวอร์ชัน ${newVersion}`, doc.id);
      }
    });

    doc.version = newVersion;
    doc.fileName = fixedFileName;
    doc.fileStorageName = req.file.filename;
    doc.fileSize = req.file.size;
    doc.versionHistory = history;
    doc.updatedAt = updatedAt;

    res.json({ success: true, document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปโหลดเวอร์ชันใหม่' });
  }
});

// Get version history
app.get('/api/documents/:id/versions', requireAuth, async (req, res) => {
  try {
    const docs = await db.query('SELECT version, versionHistory FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);
    res.json({
      currentVersion: doc.version,
      history: doc.versionHistory || []
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.put('/api/documents/:id', requireAuth, async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });

    const updates = req.body;
    const title = updates.title ? sanitize(updates.title) : docs[0].title;
    const description = updates.description !== undefined ? sanitize(updates.description) : docs[0].description;
    const category = updates.category || docs[0].category;
    const priority = updates.priority || docs[0].priority;
    const deadline = updates.deadline !== undefined ? updates.deadline : docs[0].deadline;
    const expiryDate = updates.expiryDate !== undefined ? updates.expiryDate : docs[0].expiryDate;
    const updatedAt = new Date().toISOString();

    await db.query(
      `UPDATE documents SET title = ?, description = ?, category = ?, priority = ?, deadline = ?, expiryDate = ?, updatedAt = ? WHERE id = ?`,
      [title, description, category, priority, deadline, expiryDate, updatedAt, req.params.id]
    );

    const updated = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    res.json({ success: true, document: formatDoc(updated[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการแก้ไขเอกสาร' });
  }
});

app.put('/api/documents/:id/submit', requireRole('secretary', 'admin'), async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const updatedAt = new Date().toISOString();
    await db.query('UPDATE documents SET status = "pending_approval", statusText = "รออนุมัติ", updatedAt = ? WHERE id = ?', [updatedAt, doc.id]);

    await logActivity(req.session.user.id, req.session.user.name, 'submit', 'ส่งเอกสารเพื่ออนุมัติ', doc.id, doc.title, req.ip);

    // Notify assigned users
    doc.assignedTo.forEach(uid => {
      createNotification(uid, 'status_change', 'เอกสารรออนุมัติ', `เอกสาร "${doc.title}" ถูกส่งเพื่อรออนุมัติ`, doc.id);
    });

    doc.status = 'pending_approval';
    doc.statusText = 'รออนุมัติ';
    doc.updatedAt = updatedAt;
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.put('/api/documents/:id/approve', requireRole('user', 'executive', 'admin'), async (req, res) => {
  try {
    const { pin, comment } = req.body;

    // Fetch user to verify PIN
    const users = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    if (!users.length) return res.status(401).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
    const user = users[0];

    // Enforce PIN setup and verification
    if (!user.pinHash || !user.pinSalt) {
      return res.status(400).json({ error: 'คุณยังไม่ได้ตั้งค่ารหัส PIN กรุณาไปตั้งค่า PIN ที่หน้าโปรไฟล์ก่อนอนุมัติ' });
    }
    if (!pin) {
      return res.status(400).json({ error: 'กรุณากรอกรหัส PIN ยืนยันตัวตน' });
    }
    if (!verifyPinForUser(user, pin)) {
      return res.status(400).json({ error: 'รหัส PIN ไม่ถูกต้อง' });
    }

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const updatedAt = new Date().toISOString();
    const comments = doc.comments || [];
    if (comment) {
      comments.push({
        by: req.session.user.id,
        byName: req.session.user.name,
        text: sanitize(comment),
        at: updatedAt
      });
    }

    let isFullyApproved = true;
    let workflow = doc.approvalWorkflow || [];
    let nextRole = null;
    if (workflow.length > 0) {
      const currentStepIndex = workflow.findIndex(w => w.status === 'pending');
      if (currentStepIndex !== -1) {
        workflow[currentStepIndex].status = 'approved';
        workflow[currentStepIndex].name = req.session.user.name;
        workflow[currentStepIndex].timestamp = updatedAt;
        
        if (currentStepIndex < workflow.length - 1) {
          isFullyApproved = false;
          nextRole = workflow[currentStepIndex + 1].role;
        }
      }
    }

    const newStatus = isFullyApproved ? 'approved' : 'pending_approval';
    const newStatusText = isFullyApproved ? 'อนุมัติแล้ว' : 'รออนุมัติตามสายงาน';

    await db.query(
      `UPDATE documents SET status = ?, statusText = ?, comments = ?, approvalWorkflow = ?, updatedAt = ? WHERE id = ?`,
      [newStatus, newStatusText, JSON.stringify(comments), JSON.stringify(workflow), updatedAt, doc.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'approve', isFullyApproved ? 'อนุมัติเอกสารเสร็จสิ้น' : 'อนุมัติเอกสาร (ตามสายงาน)', doc.id, doc.title, req.ip);

    // Notify uploader
    createNotification(doc.uploadedBy, 'status_change', isFullyApproved ? 'เอกสารได้รับอนุมัติ' : 'เอกสารผ่านการอนุมัติตามสายงาน', `เอกสาร "${doc.title}" ${isFullyApproved ? 'ได้รับอนุมัติเสร็จสิ้นแล้ว' : 'ได้รับการอนุมัติขั้นต้น และรอการอนุมัติขั้นต่อไป'}`, doc.id);

    doc.status = newStatus;
    doc.statusText = newStatusText;
    doc.comments = comments;
    doc.approvalWorkflow = workflow;
    doc.updatedAt = updatedAt;
    res.json({
      success: true,
      document: doc,
      isFullyApproved,
      message: isFullyApproved ? 'อนุมัติเอกสารเสร็จสิ้นเรียบร้อยแล้ว' : 'อนุมัติขั้นตอนเรียบร้อยแล้ว (ส่งต่อขั้นตอนถัดไปในสายงาน)'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.put('/api/documents/:id/reject', requireRole('user', 'executive', 'admin'), async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const reason = sanitize(req.body.reason || req.body.comment || '');
    const updatedAt = new Date().toISOString();
    const comments = doc.comments || [];
    if (reason) {
      comments.push({
        by: req.session.user.id,
        byName: req.session.user.name,
        text: `[ปฏิเสธ] ${reason}`,
        at: updatedAt
      });
    }

    let workflow = doc.approvalWorkflow || [];
    if (workflow.length > 0) {
      const currentStepIndex = workflow.findIndex(w => w.status === 'pending');
      if (currentStepIndex !== -1) {
        workflow[currentStepIndex].status = 'rejected';
        workflow[currentStepIndex].name = req.session.user.name;
        workflow[currentStepIndex].timestamp = updatedAt;
      }
    }

    await db.query(
      `UPDATE documents SET status = "rejected", statusText = "ปฏิเสธ", rejectReason = ?, comments = ?, approvalWorkflow = ?, updatedAt = ? WHERE id = ?`,
      [reason, JSON.stringify(comments), JSON.stringify(workflow), updatedAt, doc.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'reject', 'ปฏิเสธเอกสาร', doc.id, doc.title, req.ip);

    // Notify uploader
    createNotification(doc.uploadedBy, 'status_change', 'เอกสารไม่ได้รับอนุมัติ', `เอกสาร "${doc.title}" ถูกปฏิเสธ: ${reason}`, doc.id);

    doc.status = 'rejected';
    doc.statusText = 'ปฏิเสธ';
    doc.rejectReason = reason;
    doc.comments = comments;
    doc.approvalWorkflow = workflow;
    doc.updatedAt = updatedAt;
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// Standard sign route
app.put('/api/documents/:id/sign', requireSignerPermission, async (req, res) => {
  try {
    const { pin, signatureData, stampDataUrl, pageNumber, posX, posY, width, height } = req.body;

    // Fetch user to verify PIN
    const users = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    if (!users.length) return res.status(401).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
    const user = users[0];

    // Enforce PIN setup and verification
    if (!user.pinHash || !user.pinSalt) {
      return res.status(400).json({ error: 'คุณยังไม่ได้ตั้งค่ารหัส PIN กรุณาไปตั้งค่า PIN ที่หน้าโปรไฟล์ก่อนลงนาม' });
    }
    if (!pin) {
      return res.status(400).json({ error: 'กรุณากรอกรหัส PIN ยืนยันตัวตน' });
    }
    if (!verifyPinForUser(user, pin)) {
      return res.status(400).json({ error: 'รหัส PIN ไม่ถูกต้อง' });
    }

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const timestamp = new Date().toISOString();
    const certs = await db.query('SELECT * FROM certificates WHERE userId = ? AND certStatus = "active" ORDER BY createdAt DESC', [req.session.user.id]);
    const userCert = certs[0];

    const sigEntry = {
      signedBy: req.session.user.id,
      signedByName: req.session.user.name,
      signedAt: timestamp,
      signatureData: signatureData || 'signed',
      pageNumber: pageNumber || 1,
      posX: posX || 0,
      posY: posY || 0,
      width: width || 180,
      height: height || 75,
      serverTimestamp: timestamp,
      certificateId: userCert ? userCert.id : 'CERT-' + Date.now().toString(36).toUpperCase(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'Unknown Device'
    };

    const signatures = doc.signatures || [];
    signatures.push(sigEntry);

    // ===== Stamp signature directly onto the PDF file =====
    const stampToUse = stampDataUrl || signatureData;
    if (doc.fileStorageName && stampToUse && stampToUse.startsWith('data:image')) {
      try {
        const filePath = path.join(uploadsDir, doc.fileStorageName);
        if (fs.existsSync(filePath)) {
          const existingPdfBytes = fs.readFileSync(filePath);
          const pdfDoc = await PDFDocument.load(existingPdfBytes);
          const pages = pdfDoc.getPages();

          const pgNum = (sigEntry.pageNumber && sigEntry.pageNumber <= pages.length && sigEntry.pageNumber > 0) ? sigEntry.pageNumber : pages.length;
          const targetPage = pages[pgNum - 1];
          const { width: pageW, height: pageH } = targetPage.getSize();

          // Extract PNG/JPEG bytes from data URL
          const base64Data = stampToUse.split(',')[1];
          const imgBytes = Buffer.from(base64Data, 'base64');

          let embeddedImg;
          if (stampToUse.includes('image/png')) {
            embeddedImg = await pdfDoc.embedPng(imgBytes);
          } else {
            embeddedImg = await pdfDoc.embedJpg(imgBytes);
          }

          // Calculate stamp position & size
          const stampW = sigEntry.width || 180;
          const stampH = sigEntry.height || 75;
          const xPos = sigEntry.posX || 0;
          // Convert from top-left origin (browser) to bottom-left origin (PDF)
          const yPos = pageH - (sigEntry.posY || 0) - stampH;

          targetPage.drawImage(embeddedImg, {
            x: xPos,
            y: yPos,
            width: stampW,
            height: stampH,
          });

          const stampedPdfBytes = await pdfDoc.save();
          fs.writeFileSync(filePath, Buffer.from(stampedPdfBytes));
          console.log(`[SIGN] Signature stamped onto PDF: ${doc.fileStorageName}`);
        }
      } catch (stampErr) {
        console.error('[SIGN] Error stamping PDF (metadata still saved):', stampErr.message);
        // Continue — metadata is still saved even if stamping fails
      }
    }

    await db.query(
      `UPDATE documents SET signatures = ?, status = "signed", statusText = "ลงนามแล้ว", updatedAt = ? WHERE id = ?`,
      [JSON.stringify(signatures), timestamp, doc.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'sign', 'ลงนามเอกสาร (ยืนยัน PIN)', doc.id, doc.title, req.ip);

    // Notify uploader
    createNotification(doc.uploadedBy, 'status_change', 'เอกสารได้รับการลงนาม', `เอกสาร "${doc.title}" ได้รับการลงนามโดย ${req.session.user.name}`, doc.id);

    doc.signatures = signatures;
    doc.status = 'signed';
    doc.statusText = 'ลงนามแล้ว';
    doc.updatedAt = timestamp;
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงนาม' });
  }
});

// Signature Upload
app.post('/api/signatures/upload', requireAuth, uploadSignature.single('signature'), async (req, res) => {
  try {
    const userId = req.session.user.id;
    let signatureData = '';
    let signatureType = req.body.signatureType || 'draw';

    if (req.file) {
      signatureData = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      signatureType = 'image';
    } else if (req.body.signatureData) {
      signatureData = req.body.signatureData;
    }

    if (!signatureData) {
      return res.status(400).json({ error: 'กรุณาระบุข้อมูลลายมือชื่อ' });
    }

    const updatedAt = new Date().toISOString();
    const existing = await db.query('SELECT id FROM signatures WHERE userId = ?', [userId]);

    if (existing.length > 0) {
      await db.query(
        `UPDATE signatures SET signatureType = ?, signatureData = ?, updatedAt = ? WHERE userId = ?`,
        [signatureType, signatureData, updatedAt, userId]
      );
    } else {
      const id = 'sig' + Date.now();
      await db.query(
        `INSERT INTO signatures (id, userId, signatureType, signatureData, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, userId, signatureType, signatureData, updatedAt, updatedAt]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.get('/api/signatures/:userId', requireAuth, async (req, res) => {
  try {
    const sigs = await db.query('SELECT * FROM signatures WHERE userId = ?', [req.params.userId]);
    if (!sigs.length) return res.json({ exists: false });
    res.json({ exists: true, signature: sigs[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// Signed URL generator & verify for signature sharing
app.post('/api/signatures/:userId/signed-url', requireAuth, (req, res) => {
  try {
    const userId = req.params.userId;
    const expires = Date.now() + 60 * 60 * 1000; // 1 hr
    const hmac = crypto.createHmac('sha256', getSignKey());
    hmac.update(`${userId}:${expires}`);
    const token = hmac.digest('hex');
    const url = `/s/signature?userId=${userId}&expires=${expires}&token=${token}`;
    res.json({ success: true, url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.get('/s/signature', async (req, res) => {
  try {
    const { userId, expires, token } = req.query;
    if (!userId || !expires || !token) return res.status(400).send('Invalid link');
    if (Date.now() > parseInt(expires, 10)) return res.status(403).send('Link expired');

    const hmac = crypto.createHmac('sha256', getSignKey());
    hmac.update(`${userId}:${expires}`);
    const expected = hmac.digest('hex');
    if (token !== expected) return res.status(403).send('Invalid signature token');

    const sigs = await db.query('SELECT signatureData FROM signatures WHERE userId = ?', [userId]);
    if (!sigs.length || !sigs[0].signatureData) return res.status(404).send('Signature not found');

    const data = sigs[0].signatureData;
    if (data.startsWith('data:image/png;base64,')) {
      const img = Buffer.from(data.replace('data:image/png;base64,', ''), 'base64');
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': img.length });
      return res.end(img);
    }
    res.json({ signatureData: data });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
});

// Share document (Add assigned users)
app.post('/api/documents/:id/share', requireRole('admin', 'secretary'), async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) return res.status(400).json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' });

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const currentAssigned = new Set(doc.assignedTo || []);
    userIds.forEach(uid => currentAssigned.add(uid));
    const newAssigned = Array.from(currentAssigned);

    const updatedAt = new Date().toISOString();
    await db.query('UPDATE documents SET assignedTo = ?, updatedAt = ? WHERE id = ?', [JSON.stringify(newAssigned), updatedAt, doc.id]);

    // Notify newly assigned users
    userIds.forEach(uid => {
      createNotification(uid, 'status_change', 'ได้รับสิทธิ์เอกสาร', `คุณได้รับสิทธิ์เข้าถึงเอกสาร "${doc.title}"`, doc.id);
    });

    res.json({ success: true, assignedTo: newAssigned });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.delete('/api/documents/:id', requireRole('admin', 'secretary'), async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = docs[0];

    // Remove file if exists
    if (doc.fileStorageName) {
      const p = path.join(uploadsDir, doc.fileStorageName);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }

    await db.query('DELETE FROM documents WHERE id = ?', [req.params.id]);
    await db.query('DELETE FROM document_access WHERE docId = ?', [req.params.id]);
    await db.query('DELETE FROM access_requests WHERE documentId = ?', [req.params.id]);

    await logActivity(req.session.user.id, req.session.user.name, 'delete_document', 'ลบเอกสาร', doc.id, doc.title, req.ip);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบเอกสาร' });
  }
});

// ========================
// LOGS & STATS
// ========================
app.get('/api/logs/me', requireAuth, async (req, res) => {
  try {
    const logs = await db.query('SELECT * FROM activity_logs WHERE userId = ? ORDER BY timestamp DESC LIMIT 100', [req.session.user.id]);
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.get('/api/logs', requireRole('admin'), async (req, res) => {
  try {
    const logs = await db.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 500');
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users WHERE status = "active"');
    const logsCount = await db.query('SELECT COUNT(*) as count FROM activity_logs');

    let totalDocuments = 0, pendingApproval = 0, signed = 0, approved = 0, rejected = 0, draft = 0, pendingSignature = 0;
    const monthly = {}, categories = {};

    const isPrivileged = user.role === 'admin' || user.role === 'executive' || user.role === 'secretary';

    if (isPrivileged) {
      // admin/secretary/executive: ใช้ GROUP BY นับครั้งเดียว
      const statusCounts = await db.query('SELECT status, COUNT(*) as count FROM documents GROUP BY status');
      statusCounts.forEach(row => {
        totalDocuments += row.count;
        if (row.status === 'pending_approval') pendingApproval = row.count;
        else if (row.status === 'signed') signed = row.count;
        else if (row.status === 'approved') approved = row.count;
        else if (row.status === 'rejected') rejected = row.count;
        else if (row.status === 'draft') draft = row.count;
        else if (row.status === 'pending_signature') pendingSignature = row.count;
      });
      // ดึงแค่ field ที่ใช้สำหรับ chart
      const docsMeta = await db.query('SELECT category, createdAt FROM documents');
      docsMeta.forEach(d => {
        if (d.createdAt) {
          const month = new Date(d.createdAt).toISOString().substring(0, 7);
          monthly[month] = (monthly[month] || 0) + 1;
        }
        if (d.category) categories[d.category] = (categories[d.category] || 0) + 1;
      });
    } else {
      // user ทั่วไป: ดึงเฉพาะ field ที่ใช้ แล้วกรอง assignedTo ใน JS
      const docs = await db.query('SELECT id, status, category, createdAt, assignedTo, uploadedBy FROM documents');
      const visibleDocs = docs.filter(d => {
        const assigned = typeof d.assignedTo === 'string' ? JSON.parse(d.assignedTo || '[]') : (d.assignedTo || []);
        return assigned.includes(user.id) || d.uploadedBy === user.id;
      });
      totalDocuments = visibleDocs.length;
      visibleDocs.forEach(d => {
        if (d.status === 'pending_approval') pendingApproval++;
        else if (d.status === 'signed') signed++;
        else if (d.status === 'approved') approved++;
        else if (d.status === 'rejected') rejected++;
        else if (d.status === 'draft') draft++;
        else if (d.status === 'pending_signature') pendingSignature++;
        if (d.createdAt) {
          const month = new Date(d.createdAt).toISOString().substring(0, 7);
          monthly[month] = (monthly[month] || 0) + 1;
        }
        if (d.category) categories[d.category] = (categories[d.category] || 0) + 1;
      });
    }

    let pendingAccessRequests = 0;
    try {
      const pendingAccessReq = await db.query('SELECT COUNT(*) as count FROM document_access WHERE status = "pending"');
      if (pendingAccessReq && pendingAccessReq.length) pendingAccessRequests = pendingAccessReq[0].count;
    } catch (e) {
      // Ignore if table doesn't exist or error
    }

    const recentLogs = await db.query(
      'SELECT * FROM activity_logs WHERE userId = ? ORDER BY timestamp DESC LIMIT 5',
      [user.id]
    );
    const allRecentLogs = user.role === 'admin'
      ? await db.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 5')
      : recentLogs;

    res.json({
      totalDocuments,
      pendingApproval,
      signed,
      approved,
      rejected,
      draft,
      pendingSignature,
      pendingAccessRequests,
      totalUsers: usersCount[0].count,
      totalLogs: logsCount[0].count,
      monthly,
      categories,
      recentLogs: allRecentLogs
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// Profile Update
app.put('/api/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.id;
    const users = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!users.length) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    const { name, email, department, position, phone, avatar, password, currentPassword } = req.body;
    let newPassword = users[0].password;

    if (password) {
      if (currentPassword && !verifyPassword(currentPassword, users[0].password)) {
        return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      }
      const pwErr = validatePassword(password);
      if (pwErr) return res.status(400).json({ error: pwErr });
      newPassword = hashPassword(password);
    }

    const updatedName = name ? sanitize(name) : users[0].name;
    const updatedEmail = email ? sanitize(email) : users[0].email;
    const updatedDept = department ? sanitize(department) : users[0].department;
    const updatedPosition = position !== undefined ? sanitize(position) : (users[0].position || '');
    const updatedPhone = phone !== undefined ? sanitize(phone) : (users[0].phone || '');
    const updatedAvatar = avatar !== undefined ? avatar : users[0].avatar;

    await db.query(
      `UPDATE users SET name = ?, email = ?, department = ?, position = ?, phone = ?, avatar = ?, password = ? WHERE id = ?`,
      [updatedName, updatedEmail, updatedDept, updatedPosition, updatedPhone, updatedAvatar, newPassword, userId]
    );

    await logActivity(userId, updatedName, 'update_profile', 'แก้ไขข้อมูลส่วนตัว', userId, updatedName, req.ip);

    const safeUser = {
      ...users[0],
      name: updatedName,
      email: updatedEmail,
      department: updatedDept,
      position: updatedPosition,
      phone: updatedPhone,
      avatar: updatedAvatar,
      hasPin: !!(users[0].pinHash && users[0].pinSalt)
    };
    delete safeUser.password;
    delete safeUser.pinHash;
    delete safeUser.pinSalt;
    req.session.user = { ...req.session.user, ...safeUser };

    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
  }
});

// Set PIN for MFA
app.post('/api/profile/set-pin', requireAuth, async (req, res) => {
  try {
    const { pin } = req.body;
    const pinStr = String(pin || '');
    if (!pinStr || pinStr.length < 4 || pinStr.length > 6 || !/^\d+$/.test(pinStr)) {
      return res.status(400).json({ error: 'PIN ต้องเป็นตัวเลข 4-6 หลัก' });
    }

    const { salt, hash } = hashPin(pinStr);
    await db.query('UPDATE users SET pinHash = ?, pinSalt = ? WHERE id = ?', [hash, salt, req.session.user.id]);
    req.session.user.hasPin = true;

    await logActivity(req.session.user.id, req.session.user.name, 'set_pin', 'ตั้งค่ารหัส PIN', req.session.user.id, '', req.ip);

    res.json({ success: true, message: 'ตั้งค่า PIN สำเร็จ', hasPin: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// Reset PIN for MFA (forgot PIN - verify with login password)
app.post('/api/profile/reset-pin', requireAuth, async (req, res) => {
  try {
    const { password, newPin } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสผ่านเข้าระบบเพื่อยืนยันตัวตน' });
    }
    const newPinStr = String(newPin || '');
    if (!newPinStr || newPinStr.length < 4 || newPinStr.length > 6 || !/^\d+$/.test(newPinStr)) {
      return res.status(400).json({ error: 'PIN ใหม่ต้องเป็นตัวเลข 4-6 หลัก' });
    }
    const users = await db.query('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    if (!users.length) return res.status(401).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
    if (!verifyPassword(password, users[0].password)) {
      return res.status(401).json({ error: 'รหัสผ่านเข้าระบบไม่ถูกต้อง ไม่สามารถรีเซ็ต PIN ได้' });
    }
    const { salt, hash } = hashPin(newPinStr);
    await db.query('UPDATE users SET pinHash = ?, pinSalt = ? WHERE id = ?', [hash, salt, req.session.user.id]);
    req.session.user.hasPin = true;
    await logActivity(req.session.user.id, req.session.user.name, 'reset_pin', 'รีเซ็ตรหัส PIN (ลืม PIN)', req.session.user.id, '', req.ip);
    res.json({ success: true, message: 'รีเซ็ตรหัส PIN สำเร็จ', hasPin: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// Add comment to document
app.post('/api/documents/:id/comment', requireAuth, async (req, res) => {
  try {
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'กรุณากรอกข้อความ' });

    const comments = doc.comments || [];
    const newComment = {
      by: req.session.user.id,
      byName: req.session.user.name,
      text: sanitize(text.trim()),
      at: new Date().toISOString()
    };
    comments.push(newComment);

    const updatedAt = new Date().toISOString();
    await db.query('UPDATE documents SET comments = ?, updatedAt = ? WHERE id = ?', [JSON.stringify(comments), updatedAt, doc.id]);

    await logActivity(req.session.user.id, req.session.user.name, 'comment', 'แสดงความคิดเห็น', doc.id, doc.title, req.ip);

    res.json({ success: true, comment: newComment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ========================
// ACCESS REQUESTS
// ========================
app.get('/api/access-requests', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    let requests = [];
    if (user.role === 'admin') {
      requests = await db.query('SELECT * FROM access_requests ORDER BY createdAt DESC');
    } else {
      requests = await db.query('SELECT * FROM access_requests WHERE userId = ? ORDER BY createdAt DESC', [user.id]);
    }
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.get('/api/access-requests/pending-count', requireAuth, async (req, res) => {
  try {
    const reqs = await db.query('SELECT COUNT(*) as count FROM access_requests WHERE status = "pending"');
    res.json({ count: reqs[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ count: 0 });
  }
});

app.post('/api/access-requests', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    const { documentId, reason } = req.body;

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [documentId]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    if (doc.assignedTo && doc.assignedTo.includes(user.id)) {
      return res.status(400).json({ error: 'คุณมีสิทธิ์เข้าถึงเอกสารนี้อยู่แล้ว' });
    }

    const existing = await db.query('SELECT id FROM access_requests WHERE userId = ? AND documentId = ? AND status = "pending"', [user.id, documentId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'คุณมีคำร้องที่รอดำเนินการอยู่แล้ว' });
    }

    const newReq = {
      id: 'req' + Date.now(),
      userId: user.id,
      userName: user.name,
      documentId,
      documentTitle: doc.title,
      reason: sanitize(reason) || '',
      status: 'pending',
      statusText: 'รอดำเนินการ',
      createdAt: new Date().toISOString()
    };

    await db.query(
      `INSERT INTO access_requests (id, userId, userName, documentId, documentTitle, reason, status, statusText, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newReq.id, newReq.userId, newReq.userName, newReq.documentId, newReq.documentTitle, newReq.reason, newReq.status, newReq.statusText, newReq.createdAt]
    );

    // Notify admins
    const admins = await db.query('SELECT id FROM users WHERE role = "admin"');
    admins.forEach(admin => {
      createNotification(admin.id, 'access_request', 'คำร้องขอสิทธิ์ใหม่', `${user.name} ขอสิทธิ์เข้าถึงเอกสาร "${doc.title}"`, documentId);
    });

    res.json({ success: true, request: newReq });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.put('/api/access-requests/:id/approve', requireRole('admin'), async (req, res) => {
  try {
    const reqs = await db.query('SELECT * FROM access_requests WHERE id = ?', [req.params.id]);
    if (!reqs.length) return res.status(404).json({ error: 'ไม่พบคำร้อง' });
    const request = reqs[0];

    const reviewedAt = new Date().toISOString();
    await db.query(
      `UPDATE access_requests SET status = "approved", statusText = "อนุมัติแล้ว", reviewedBy = ?, reviewedByName = ?, reviewedAt = ? WHERE id = ?`,
      [req.session.user.id, req.session.user.name, reviewedAt, request.id]
    );

    // Add user to assignedTo in documents
    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [request.documentId]);
    if (docs.length > 0) {
      const doc = formatDoc(docs[0]);
      if (!doc.assignedTo.includes(request.userId)) {
        doc.assignedTo.push(request.userId);
        await db.query('UPDATE documents SET assignedTo = ? WHERE id = ?', [JSON.stringify(doc.assignedTo), doc.id]);
      }
    }

    createNotification(request.userId, 'access_approved', 'คำร้องได้รับอนุมัติ', `คำร้องขอสิทธิ์เข้าถึงเอกสาร "${request.documentTitle}" ได้รับอนุมัติแล้ว`, request.documentId);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.put('/api/access-requests/:id/reject', requireRole('admin'), async (req, res) => {
  try {
    const reqs = await db.query('SELECT * FROM access_requests WHERE id = ?', [req.params.id]);
    if (!reqs.length) return res.status(404).json({ error: 'ไม่พบคำร้อง' });
    const request = reqs[0];

    const reviewedAt = new Date().toISOString();
    await db.query(
      `UPDATE access_requests SET status = "rejected", statusText = "ปฏิเสธ", reviewedBy = ?, reviewedByName = ?, reviewedAt = ? WHERE id = ?`,
      [req.session.user.id, req.session.user.name, reviewedAt, request.id]
    );

    createNotification(request.userId, 'access_rejected', 'คำร้องถูกปฏิเสธ', `คำร้องขอสิทธิ์เข้าถึงเอกสาร "${request.documentTitle}" ถูกปฏิเสธ`, request.documentId);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ========================
// NOTIFICATIONS
// ========================
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const notifs = await db.query('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC', [req.session.user.id]);
    res.json(notifs.map(n => ({ ...n, read: !!n.isRead })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.get('/api/notifications/unread-count', requireAuth, async (req, res) => {
  try {
    const count = await db.query('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0', [req.session.user.id]);
    res.json({ count: count[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// *** read-all ต้องมาก่อน /:id/read เพื่อป้องกัน Express ตีความ "read-all" ว่า id ***
app.put('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET isRead = 1 WHERE userId = ?', [req.session.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
  try {
    await db.query('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?', [req.params.id, req.session.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM notifications WHERE id = ? AND userId = ?', [req.params.id, req.session.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ========================
// CERTIFICATE MANAGEMENT (CA Management)
// ========================
app.get('/api/certificates', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    let certs = [];
    if (user.role === 'admin') {
      certs = await db.query('SELECT * FROM certificates ORDER BY createdAt DESC');
    } else {
      certs = await db.query('SELECT * FROM certificates WHERE userId = ? ORDER BY createdAt DESC', [user.id]);
    }
    res.json(certs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.get('/api/certificates/:id', requireAuth, async (req, res) => {
  try {
    const certs = await db.query('SELECT * FROM certificates WHERE id = ?', [req.params.id]);
    if (!certs.length) return res.status(404).json({ error: 'ไม่พบใบรับรอง' });
    res.json(certs[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.post('/api/certificates', requireRole('admin', 'executive'), async (req, res) => {
  try {
    const { userId, certSerial, issuedBy, issuedDate, expiredDate } = req.body;
    const targetUserId = userId || req.session.user.id;

    const users = await db.query('SELECT name FROM users WHERE id = ?', [targetUserId]);
    if (!users.length) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    const serial = sanitize(certSerial) || 'CERT-' + Date.now().toString(36).toUpperCase();
    const existing = await db.query('SELECT id FROM certificates WHERE certSerial = ?', [serial]);
    if (existing.length > 0) return res.status(400).json({ error: 'หมายเลขใบรับรองซ้ำ' });

    const newCert = {
      id: 'cert' + Date.now(),
      userId: targetUserId,
      userName: users[0].name,
      certSerial: serial,
      issuedBy: sanitize(issuedBy) || 'DocMS Internal CA',
      issuedDate: issuedDate || new Date().toISOString().split('T')[0],
      expiredDate: expiredDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      certStatus: 'active',
      publicKey: 'RSA-' + uuidv4().replace(/-/g, '').toUpperCase(),
      createdAt: new Date().toISOString()
    };

    await db.query(
      `INSERT INTO certificates (id, userId, userName, certSerial, issuedBy, issuedDate, expiredDate, certStatus, publicKey, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newCert.id, newCert.userId, newCert.userName, newCert.certSerial, newCert.issuedBy, newCert.issuedDate, newCert.expiredDate, newCert.certStatus, newCert.publicKey, newCert.createdAt]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'create_cert', 'สร้างใบรับรองดิจิทัล', newCert.id, `${users[0].name} (${newCert.certSerial})`, req.ip);

    res.json({ success: true, certificate: newCert });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างใบรับรอง' });
  }
});

app.put('/api/certificates/:id', requireRole('admin'), async (req, res) => {
  try {
    const certs = await db.query('SELECT * FROM certificates WHERE id = ?', [req.params.id]);
    if (!certs.length) return res.status(404).json({ error: 'ไม่พบใบรับรอง' });

    const updates = req.body;
    if (updates.certStatus && !['active', 'revoked', 'expired'].includes(updates.certStatus)) {
      return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    }

    const certStatus = updates.certStatus || certs[0].certStatus;
    const issuedBy = updates.issuedBy ? sanitize(updates.issuedBy) : certs[0].issuedBy;
    const expiredDate = updates.expiredDate || certs[0].expiredDate;

    await db.query(
      `UPDATE certificates SET certStatus = ?, issuedBy = ?, expiredDate = ? WHERE id = ?`,
      [certStatus, issuedBy, expiredDate, req.params.id]
    );

    await logActivity(req.session.user.id, req.session.user.name, 'update_cert', 'แก้ไขใบรับรองดิจิทัล', req.params.id, certs[0].certSerial, req.ip);

    res.json({ success: true, certificate: { ...certs[0], certStatus, issuedBy, expiredDate } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.put('/api/certificates/:id/revoke', requireRole('admin'), async (req, res) => {
  try {
    const certs = await db.query('SELECT * FROM certificates WHERE id = ?', [req.params.id]);
    if (!certs.length) return res.status(404).json({ error: 'ไม่พบใบรับรอง' });

    await db.query('UPDATE certificates SET certStatus = "revoked" WHERE id = ?', [req.params.id]);

    createNotification(certs[0].userId, 'status_change', 'ใบรับรองถูกเพิกถอน', `ใบรับรอง ${certs[0].certSerial} ถูกเพิกถอน`, null);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.delete('/api/certificates/:id', requireRole('admin'), async (req, res) => {
  try {
    const certs = await db.query('SELECT * FROM certificates WHERE id = ?', [req.params.id]);
    if (!certs.length) return res.status(404).json({ error: 'ไม่พบใบรับรอง' });

    await db.query('DELETE FROM certificates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ========================
// MFA / OTP ROUTES
// ========================
const otpStore = {};

app.post('/api/otp/generate', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore[user.id] = { otp, expiresAt, used: false };

    await logActivity(user.id, user.name, 'generate_otp', 'สร้างรหัส OTP', '', '', req.ip);

    res.json({ success: true, message: `รหัส OTP ถูกส่งแล้ว`, otp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.post('/api/otp/verify', requireAuth, (req, res) => {
  const user = req.session.user;
  const { otp } = req.body;

  const stored = otpStore[user.id];
  if (!stored) return res.status(400).json({ error: 'ไม่พบรหัส OTP กรุณาสร้างใหม่' });
  if (stored.used) return res.status(400).json({ error: 'รหัส OTP นี้ถูกใช้แล้ว' });
  if (Date.now() > stored.expiresAt) {
    delete otpStore[user.id];
    return res.status(400).json({ error: 'รหัส OTP หมดอายุ กรุณาสร้างใหม่' });
  }
  if (stored.otp !== otp) {
    return res.status(400).json({ error: 'รหัส OTP ไม่ถูกต้อง' });
  }

  stored.used = true;
  res.json({ success: true, verified: true });
});

// Enhanced sign with OTP verification
app.put('/api/documents/:id/sign-with-otp', requireAuth, async (req, res) => {
  try {
    const user = req.session.user;

    const stored = otpStore[user.id];
    if (!stored || !stored.used || Date.now() > stored.expiresAt + 60000) {
      return res.status(400).json({ error: 'กรุณายืนยัน OTP ก่อนลงนาม' });
    }

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [req.params.id]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    const certs = await db.query('SELECT * FROM certificates WHERE userId = ? AND certStatus = "active" ORDER BY createdAt DESC', [user.id]);
    const userCert = certs[0];

    const timestamp = new Date().toISOString();
    const signatures = doc.signatures || [];
    signatures.push({
      signedBy: user.id,
      signedByName: user.name,
      signedAt: timestamp,
      signatureData: req.body.signatureData || 'signed',
      serverTimestamp: timestamp,
      certificateId: userCert ? userCert.id : 'CERT-' + Date.now().toString(36).toUpperCase(),
      certSerial: userCert ? userCert.certSerial : 'N/A',
      mfaVerified: true,
      signatureType: req.body.signatureType || 'approve',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'Unknown Device'
    });

    await db.query(
      `UPDATE documents SET signatures = ?, status = "signed", statusText = "ลงนามแล้ว", updatedAt = ? WHERE id = ?`,
      [JSON.stringify(signatures), timestamp, doc.id]
    );

    delete otpStore[user.id];

    await logActivity(user.id, user.name, 'sign', 'ลงนามเอกสาร (MFA)', doc.id, doc.title, req.ip);

    createNotification(doc.uploadedBy, 'status_change', 'เอกสารได้รับการลงนาม', `เอกสาร "${doc.title}" ได้รับการลงนามโดย ${user.name} (ยืนยัน MFA)`, doc.id);

    doc.signatures = signatures;
    doc.status = 'signed';
    doc.statusText = 'ลงนามแล้ว';
    doc.updatedAt = timestamp;
    res.json({ success: true, document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลงนาม' });
  }
});

// ========================
// DOCUMENT ACCESS CONTROL
// ========================
app.get('/api/document-access/:docId', requireRole('admin', 'secretary'), async (req, res) => {
  try {
    const accesses = await db.query('SELECT * FROM document_access WHERE docId = ?', [req.params.docId]);
    res.json(accesses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.post('/api/document-access', requireRole('admin', 'secretary'), async (req, res) => {
  try {
    const { docId, roleId, userId, canView, canDownload, canEdit, canSign } = req.body;

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [docId]);
    if (!docs.length) return res.status(404).json({ error: 'ไม่พบเอกสาร' });
    const doc = formatDoc(docs[0]);

    let targetUserName = '';
    if (userId) {
      const u = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
      if (u.length) targetUserName = u[0].name;
    }

    const newAccess = {
      id: 'acc' + Date.now(),
      docId,
      docTitle: doc.title,
      roleId: roleId || null,
      userId: userId || null,
      userName: targetUserName,
      canView: canView !== false ? 1 : 0,
      canDownload: canDownload !== false ? 1 : 0,
      canEdit: canEdit ? 1 : 0,
      canSign: canSign ? 1 : 0,
      createdAt: new Date().toISOString()
    };

    await db.query(
      `INSERT INTO document_access (id, docId, docTitle, roleId, userId, userName, canView, canDownload, canEdit, canSign, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newAccess.id, newAccess.docId, newAccess.docTitle, newAccess.roleId, newAccess.userId, newAccess.userName, newAccess.canView, newAccess.canDownload, newAccess.canEdit, newAccess.canSign, newAccess.createdAt]
    );

    if (userId && !doc.assignedTo.includes(userId)) {
      doc.assignedTo.push(userId);
      await db.query('UPDATE documents SET assignedTo = ? WHERE id = ?', [JSON.stringify(doc.assignedTo), docId]);
      createNotification(userId, 'status_change', 'ได้รับสิทธิ์เอกสาร', `คุณได้รับสิทธิ์เข้าถึงเอกสาร "${doc.title}"`, docId);
    }

    res.json({ success: true, access: newAccess });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.delete('/api/document-access/:id', requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM document_access WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// ========================
// BACKUP & RESTORE
// ========================
app.post('/api/backup', requireRole('admin'), async (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(backupDir, backupName);
    fs.mkdirSync(backupPath, { recursive: true });

    // Export current MySQL tables to JSON files in the backup directory
    const tables = ['users', 'documents', 'signatures', 'certificates', 'notifications', 'access_requests', 'document_access', 'activity_logs'];
    for (const table of tables) {
      const rows = await db.query(`SELECT * FROM ${table}`);
      fs.writeFileSync(path.join(backupPath, `${table}.json`), JSON.stringify(rows, null, 2), 'utf8');
    }

    await logActivity(req.session.user.id, req.session.user.name, 'backup', 'สำรองข้อมูล', backupName, backupName, req.ip);

    res.json({ success: true, backupName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสำรองข้อมูล' });
  }
});

app.get('/api/backups', requireRole('admin'), (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) return res.json([]);
    const backups = fs.readdirSync(backupDir)
      .filter(f => fs.statSync(path.join(backupDir, f)).isDirectory())
      .map(f => ({
        name: f,
        createdAt: fs.statSync(path.join(backupDir, f)).mtime.toISOString()
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(backups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

app.post('/api/restore/:name', requireRole('admin'), async (req, res) => {
  try {
    const backupPath = path.join(__dirname, 'backups', req.params.name);
    if (!fs.existsSync(backupPath)) return res.status(404).json({ error: 'ไม่พบไฟล์สำรอง' });

    // Restore tables from JSON in backup folder
    const tables = ['users', 'documents', 'signatures', 'certificates', 'notifications', 'access_requests', 'document_access', 'activity_logs'];
    for (const table of tables) {
      const filePath = path.join(backupPath, `${table}.json`);
      if (fs.existsSync(filePath)) {
        const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        await db.query(`TRUNCATE TABLE ${table}`);
        if (rows.length > 0) {
          const keys = Object.keys(rows[0]);
          const placeholders = keys.map(() => '?').join(', ');
          const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
          for (const row of rows) {
            const values = keys.map(k => {
              if (typeof row[k] === 'object' && row[k] !== null) return JSON.stringify(row[k]);
              return row[k];
            });
            await db.query(sql, values);
          }
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการกู้คืนข้อมูล' });
  }
});

// ========================
// SYSTEM STATUS ROUTE
// ========================
app.get('/api/system/status', requireRole('admin'), async (req, res) => {
  try {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    const uploadsSize = fs.existsSync(uploadsDir)
      ? fs.readdirSync(uploadsDir).reduce((acc, f) => {
        const stat = fs.statSync(path.join(uploadsDir, f));
        return acc + stat.size;
      }, 0) : 0;

    const certs = await db.query('SELECT * FROM certificates');
    const activeCerts = certs.filter(c => c.certStatus === 'active').length;
    const expiredCerts = certs.filter(c => {
      if (c.certStatus === 'expired') return true;
      if (c.expiredDate && new Date(c.expiredDate) < new Date()) return true;
      return false;
    }).length;

    res.json({
      serverUptime: Math.floor(uptime),
      memoryUsage: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024)
      },
      storageUsed: Math.round(uploadsSize / 1024 / 1024),
      nodeVersion: process.version,
      platform: process.platform,
      database: 'MySQL (' + (process.env.DB_NAME || 'docms_db') + ')',
      certificates: { active: activeCerts, expired: expiredCerts, total: certs.length }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
});

// Serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database & Start Server
async function startServer() {
  try {
    await db.initDB();
  } catch (err) {
    console.error('\n⚠️  [Database Warning] Could not connect to MySQL server at ' + (process.env.DB_HOST || 'localhost') + ':' + (process.env.DB_PORT || '3306'));
    console.error('👉 กรุณาตรวจสอบว่า Service MySQL (เช่น MySQL80 หรือ XAMPP) กำลังทำงาน และรหัสผ่านในไฟล์ .env ถูกต้อง\n');
  }

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  ระบบจัดการเอกสารดิจิทัล (Digital Document Management)  ║
║  Backend: Node.js / Express + MySQL Database             ║
║  Server running at http://localhost:${PORT}               ║
╚══════════════════════════════════════════════════════════╝
    `);
  });
}

startServer();
