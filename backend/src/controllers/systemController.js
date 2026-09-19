const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { uploadsDir } = require('../config/multer');
const { logActivity } = require('../services/activityService');

exports.getMyLogs = async (req, res) => {
  try {
    const logs = await db.query('SELECT * FROM activity_logs WHERE userId = ? ORDER BY timestamp DESC LIMIT 100', [req.session.user.id]);
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.getAllLogs = async (req, res) => {
  try {
    const logs = await db.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 500');
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const user = req.session.user;
    const docs = await db.query('SELECT * FROM documents');
    const usersCount = await db.query('SELECT COUNT(*) as count FROM users WHERE status = "active"');
    const logsCount = await db.query('SELECT COUNT(*) as count FROM activity_logs');

    let visibleDocs = docs;
    if (user.role !== 'admin' && user.role !== 'executive' && user.role !== 'secretary') {
      visibleDocs = docs.filter(d => {
        const assigned = typeof d.assignedTo === 'string' ? JSON.parse(d.assignedTo || '[]') : (d.assignedTo || []);
        return assigned.includes(user.id) || d.uploadedBy === user.id;
      });
    }

    const total = visibleDocs.length;
    const pendingApproval = visibleDocs.filter(d => d.status === 'pending_approval').length;
    const signed = visibleDocs.filter(d => d.status === 'signed').length;
    const approved = visibleDocs.filter(d => d.status === 'approved').length;
    const rejected = visibleDocs.filter(d => d.status === 'rejected').length;
    const draft = visibleDocs.filter(d => d.status === 'draft').length;
    const pendingSignature = visibleDocs.filter(d => d.status === 'pending_signature').length;

    let pendingAccessRequests = 0;
    try {
      const pendingAccessReq = await db.query('SELECT COUNT(*) as count FROM document_access WHERE status = "pending"');
      if (pendingAccessReq && pendingAccessReq.length) pendingAccessRequests = pendingAccessReq[0].count;
    } catch (e) {
      // Ignore
    }

    const monthly = {};
    const categories = {};
    visibleDocs.forEach(d => {
      if (d.createdAt) {
        const month = new Date(d.createdAt).toISOString().substring(0, 7);
        monthly[month] = (monthly[month] || 0) + 1;
      }
      if (d.category) {
        categories[d.category] = (categories[d.category] || 0) + 1;
      }
    });

    const recentLogs = await db.query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 5');

    res.json({
      totalDocuments: total,
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
      recentLogs
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifs = await db.query('SELECT * FROM notifications WHERE userId = ? ORDER BY createdAt DESC', [req.session.user.id]);
    res.json(notifs.map(n => ({ ...n, read: !!n.isRead })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.getUnreadNotificationCount = async (req, res) => {
  try {
    const count = await db.query('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0', [req.session.user.id]);
    res.json({ count: count[0].count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await db.query('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?', [req.params.id, req.session.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.markAllNotificationsRead = async (req, res) => {
  try {
    await db.query('UPDATE notifications SET isRead = 1 WHERE userId = ?', [req.session.user.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาด' });
  }
};

exports.createBackup = async (req, res) => {
  try {
    const rootDir = path.join(__dirname, '..', '..');
    const backupDir = path.join(rootDir, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupPath = path.join(backupDir, backupName);
    fs.mkdirSync(backupPath, { recursive: true });

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
};

exports.getBackups = (req, res) => {
  try {
    const rootDir = path.join(__dirname, '..', '..');
    const backupDir = path.join(rootDir, 'backups');
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
};

exports.restoreBackup = async (req, res) => {
  try {
    const rootDir = path.join(__dirname, '..', '..');
    const backupPath = path.join(rootDir, 'backups', req.params.name);
    if (!fs.existsSync(backupPath)) return res.status(404).json({ error: 'ไม่พบไฟล์สำรอง' });

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
};

exports.getSystemStatus = async (req, res) => {
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
};
