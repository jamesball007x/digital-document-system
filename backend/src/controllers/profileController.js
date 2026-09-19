const db = require('../config/db');
const { logActivity, createNotification } = require('../services/activityService');
const { hashPin, validatePassword, sanitize, formatDoc } = require('../services/cryptoService');

const otpStore = {};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const users = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!users.length) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });

    const { name, email, department, avatar, password, currentPassword } = req.body;
    let newPassword = users[0].password;

    if (password) {
      if (currentPassword && currentPassword !== users[0].password) {
        return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      }
      const pwErr = validatePassword(password);
      if (pwErr) return res.status(400).json({ error: pwErr });
      newPassword = password;
    }

    const updatedName = name ? sanitize(name) : users[0].name;
    const updatedEmail = email ? sanitize(email) : users[0].email;
    const updatedDept = department ? sanitize(department) : users[0].department;
    const updatedAvatar = avatar !== undefined ? avatar : users[0].avatar;

    await db.query(
      `UPDATE users SET name = ?, email = ?, department = ?, avatar = ?, password = ? WHERE id = ?`,
      [updatedName, updatedEmail, updatedDept, updatedAvatar, newPassword, userId]
    );

    await logActivity(userId, updatedName, 'update_profile', 'แก้ไขข้อมูลส่วนตัว', userId, updatedName, req.ip);

    const safeUser = {
      ...users[0],
      name: updatedName,
      email: updatedEmail,
      department: updatedDept,
      avatar: updatedAvatar
    };
    delete safeUser.password;
    delete safeUser.pinHash;
    delete safeUser.pinSalt;
    req.session.user = safeUser;

    res.json({ success: true, user: safeUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตโปรไฟล์' });
  }
};

exports.setPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      return res.status(400).json({ error: 'PIN ต้องเป็นตัวเลข 4-6 หลัก' });
    }

    const { salt, hash } = hashPin(pin);
    await db.query('UPDATE users SET pinHash = ?, pinSalt = ? WHERE id = ?', [hash, salt, req.session.user.id]);

    await logActivity(req.session.user.id, req.session.user.name, 'set_pin', 'ตั้งค่ารหัส PIN', req.session.user.id, '', req.ip);

    res.json({ success: true, message: 'ตั้งค่า PIN สำเร็จ' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.generateOtp = async (req, res) => {
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
};

exports.verifyOtp = (req, res) => {
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
};

exports.signWithOtp = async (req, res) => {
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
};
