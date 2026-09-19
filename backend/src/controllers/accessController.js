const db = require('../config/db');
const { createNotification } = require('../services/activityService');
const { formatDoc, sanitize } = require('../services/cryptoService');

exports.getAccessRequests = async (req, res) => {
  try {
    const user = req.session.user;
    let requests = [];
    if (user.role === 'admin') {
      requests = await db.query('SELECT * FROM access_requests ORDER BY createdAt DESC');
    } else {
      requests = await db.query(
        'SELECT * FROM access_requests WHERE userId = ? OR documentOwnerId = ? ORDER BY createdAt DESC',
        [user.id, user.id]
      );
    }
    res.json(requests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.createAccessRequest = async (req, res) => {
  try {
    const user = req.session.user;
    const { documentId, reason, requestedLevel, expiryDate } = req.body;

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

    const level = requestedLevel || 'view';
    const newReq = {
      id: 'req' + Date.now(),
      userId: user.id,
      userName: user.name,
      documentId,
      documentTitle: doc.title,
      requestedLevel: level,
      expiryDate: expiryDate || null,
      documentOwnerId: doc.uploadedBy || null,
      reason: sanitize(reason) || '',
      status: 'pending',
      statusText: 'รอดำเนินการ',
      createdAt: new Date().toISOString()
    };

    await db.query(
      `INSERT INTO access_requests (id, userId, userName, documentId, documentTitle, requestedLevel, expiryDate, documentOwnerId, reason, status, statusText, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newReq.id, newReq.userId, newReq.userName, newReq.documentId, newReq.documentTitle, newReq.requestedLevel, newReq.expiryDate, newReq.documentOwnerId, newReq.reason, newReq.status, newReq.statusText, newReq.createdAt]
    );

    const notifyUsers = new Set();
    if (doc.uploadedBy) notifyUsers.add(doc.uploadedBy);
    const admins = await db.query('SELECT id FROM users WHERE role = "admin"');
    admins.forEach(admin => notifyUsers.add(admin.id));

    const levelText = level === 'sign' ? 'ลงนาม' : level === 'edit' ? 'แก้ไข' : 'ดูอย่างเดียว';
    notifyUsers.forEach(uid => {
      createNotification(uid, 'access_request', 'คำร้องขอสิทธิ์ใหม่', `${user.name} ขอสิทธิ์เข้าถึงเอกสาร "${doc.title}" (ระดับ: ${levelText})`, documentId);
    });

    res.json({ success: true, request: newReq });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสร้างคำร้องขอสิทธิ์' });
  }
};

exports.approveAccessRequest = async (req, res) => {
  try {
    const user = req.session.user;
    const reqs = await db.query('SELECT * FROM access_requests WHERE id = ?', [req.params.id]);
    if (!reqs.length) return res.status(404).json({ error: 'ไม่พบคำร้อง' });
    const request = reqs[0];

    // Permission check: admin or document owner
    if (user.role !== 'admin' && request.documentOwnerId !== user.id) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ในการอนุมัติคำร้องนี้' });
    }

    const reviewedAt = new Date().toISOString();
    await db.query(
      `UPDATE access_requests SET status = "approved", statusText = "อนุมัติแล้ว", reviewedBy = ?, reviewedByName = ?, reviewedAt = ? WHERE id = ?`,
      [user.id, user.name, reviewedAt, request.id]
    );

    const docs = await db.query('SELECT * FROM documents WHERE id = ?', [request.documentId]);
    if (docs.length > 0) {
      const doc = formatDoc(docs[0]);
      if (!doc.assignedTo.includes(request.userId)) {
        doc.assignedTo.push(request.userId);
        await db.query('UPDATE documents SET assignedTo = ? WHERE id = ?', [JSON.stringify(doc.assignedTo), doc.id]);
      }

      // Record in document_access table
      const level = request.requestedLevel || 'view';
      const canView = 1;
      const canDownload = 1;
      const canEdit = (level === 'edit' || level === 'sign') ? 1 : 0;
      const canSign = level === 'sign' ? 1 : 0;

      const accId = 'acc' + Date.now();
      await db.query(
        `INSERT INTO document_access (id, docId, docTitle, userId, userName, canView, canDownload, canEdit, canSign, expiryDate, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [accId, doc.id, doc.title, request.userId, request.userName, canView, canDownload, canEdit, canSign, request.expiryDate || null, reviewedAt]
      );
    }

    createNotification(request.userId, 'access_approved', 'คำร้องได้รับอนุมัติ', `คำร้องขอสิทธิ์เข้าถึงเอกสาร "${request.documentTitle}" ได้รับอนุมัติเรียบร้อยแล้ว`, request.documentId);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอนุมัติคำร้อง' });
  }
};

exports.rejectAccessRequest = async (req, res) => {
  try {
    const user = req.session.user;
    const reqs = await db.query('SELECT * FROM access_requests WHERE id = ?', [req.params.id]);
    if (!reqs.length) return res.status(404).json({ error: 'ไม่พบคำร้อง' });
    const request = reqs[0];

    // Permission check: admin or document owner
    if (user.role !== 'admin' && request.documentOwnerId !== user.id) {
      return res.status(403).json({ error: 'คุณไม่มีสิทธิ์ในการปฏิเสธคำร้องนี้' });
    }

    const reviewedAt = new Date().toISOString();
    await db.query(
      `UPDATE access_requests SET status = "rejected", statusText = "ปฏิเสธ", reviewedBy = ?, reviewedByName = ?, reviewedAt = ? WHERE id = ?`,
      [user.id, user.name, reviewedAt, request.id]
    );

    createNotification(request.userId, 'access_rejected', 'คำร้องถูกปฏิเสธ', `คำร้องขอสิทธิ์เข้าถึงเอกสาร "${request.documentTitle}" ถูกปฏิเสธ`, request.documentId);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการปฏิเสธคำร้อง' });
  }
};

exports.getDocumentAccessList = async (req, res) => {
  try {
    const accesses = await db.query('SELECT * FROM document_access WHERE docId = ?', [req.params.docId]);
    res.json(accesses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.createDocumentAccess = async (req, res) => {
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
};

exports.deleteDocumentAccess = async (req, res) => {
  try {
    await db.query('DELETE FROM document_access WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};
