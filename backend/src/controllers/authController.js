const db = require('../config/db');
const { logActivity } = require('../services/activityService');
const { validatePassword, sanitize } = require('../services/cryptoService');

exports.login = async (req, res) => {
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
    if (user.password !== password) {
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
    safeUser.lastLogin = lastLogin;
    req.session.user = safeUser;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' });
  }
};

exports.logout = async (req, res) => {
  if (req.session.user) {
    await logActivity(req.session.user.id, req.session.user.name, 'logout', 'ออกจากระบบ', '', '', req.ip);
  }
  req.session.destroy();
  res.json({ success: true });
};

exports.getMe = (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'ไม่ได้เข้าสู่ระบบ' });
  }
  res.json({ user: req.session.user });
};

exports.forgotPassword = async (req, res) => {
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

    await db.query('UPDATE users SET password = ?, failedAttempts = 0, lockedUntil = NULL WHERE id = ?', [newPw, user.id]);

    // Log
    await logActivity(user.id, user.name, 'reset_password', 'รีเซ็ตรหัสผ่าน', '', '', req.ip);

    res.json({ success: true, newPassword: newPw, message: `รหัสผ่านใหม่ของคุณคือ: ${newPw}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน' });
  }
};

exports.register = async (req, res) => {
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
      password,
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
    res.json({ success: true, message: 'สมัครสมาชิกสำเร็จ', user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
};
