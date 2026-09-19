const express = require('express');
const router = express.Router();
const accessController = require('../controllers/accessController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.get('/api/access-requests', requireAuth, accessController.getAccessRequests);
router.post('/api/access-requests', requireAuth, accessController.createAccessRequest);
router.put('/api/access-requests/:id/approve', requireAuth, accessController.approveAccessRequest);
router.put('/api/access-requests/:id/reject', requireAuth, accessController.rejectAccessRequest);

router.get('/api/document-access/:docId', requireRole('admin', 'secretary'), accessController.getDocumentAccessList);
router.post('/api/document-access', requireRole('admin', 'secretary'), accessController.createDocumentAccess);
router.delete('/api/document-access/:id', requireRole('admin'), accessController.deleteDocumentAccess);

module.exports = router;
