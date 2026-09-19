const db = require('../config/db');
const { formatDoc } = require('../services/cryptoService');
const { logActivity } = require('../services/activityService');

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

module.exports = {
  requireAuth,
  requireRole,
  requireSignerPermission
};
