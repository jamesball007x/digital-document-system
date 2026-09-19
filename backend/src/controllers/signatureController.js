const crypto = require('crypto');
const db = require('../config/db');

function getSignKey() {
  const k = process.env.SIGN_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  if (/^[0-9a-fA-F]+$/.test(k) && k.length === 64) return Buffer.from(k, 'hex');
  return Buffer.from(k, 'base64');
}

exports.uploadSignature = async (req, res) => {
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
};

exports.getSignatureByUserId = async (req, res) => {
  try {
    const sigs = await db.query('SELECT * FROM signatures WHERE userId = ?', [req.params.userId]);
    if (!sigs.length) return res.json({ exists: false });
    res.json({ exists: true, signature: sigs[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.generateSignedUrl = (req, res) => {
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
};

exports.renderPublicSignature = async (req, res) => {
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
};
