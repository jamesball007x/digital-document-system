const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { logActivity, createNotification } = require('../services/activityService');
const { sanitize } = require('../services/cryptoService');

exports.getCertificates = async (req, res) => {
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
};

exports.getCertificateById = async (req, res) => {
  try {
    const certs = await db.query('SELECT * FROM certificates WHERE id = ?', [req.params.id]);
    if (!certs.length) return res.status(404).json({ error: 'ไม่พบใบรับรอง' });
    res.json(certs[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.createCertificate = async (req, res) => {
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
};

exports.updateCertificate = async (req, res) => {
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
};

exports.revokeCertificate = async (req, res) => {
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
};

exports.deleteCertificate = async (req, res) => {
  try {
    const certs = await db.query('SELECT * FROM certificates WHERE id = ?', [req.params.id]);
    if (!certs.length) return res.status(404).json({ error: 'ไม่พบใบรับรอง' });

    await db.query('DELETE FROM certificates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};
