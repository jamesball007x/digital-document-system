const express = require('express');
const router = express.Router();
const systemController = require('../controllers/systemController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.get('/api/logs/me', requireAuth, systemController.getMyLogs);
router.get('/api/logs', requireRole('admin'), systemController.getAllLogs);
router.get('/api/stats', requireAuth, systemController.getStats);

router.get('/api/notifications', requireAuth, systemController.getNotifications);
router.get('/api/notifications/unread-count', requireAuth, systemController.getUnreadNotificationCount);
router.put('/api/notifications/read-all', requireAuth, systemController.markAllNotificationsRead);
router.put('/api/notifications/:id/read', requireAuth, systemController.markNotificationRead);

router.post('/api/backup', requireRole('admin'), systemController.createBackup);
router.get('/api/backups', requireRole('admin'), systemController.getBackups);
router.post('/api/restore/:name', requireRole('admin'), systemController.restoreBackup);
router.get('/api/system/status', requireRole('admin'), systemController.getSystemStatus);

module.exports = router;
