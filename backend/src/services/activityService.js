const db = require('../config/db');

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

module.exports = {
  logActivity,
  createNotification,
  checkDocumentExpiry
};
