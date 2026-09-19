const express = require('express');
const router = express.Router();
const docController = require('../controllers/docController');
const { upload } = require('../config/multer');
const { requireAuth, requireRole, requireSignerPermission } = require('../middlewares/auth');

router.get('/', requireAuth, docController.getDocuments);
router.get('/all', requireAuth, docController.getAllDocumentsBasic);
router.get('/:id', requireAuth, docController.getDocumentById);
router.post('/', requireRole('secretary', 'admin'), upload.single('file'), docController.createDocument);
router.get('/:id/download', requireAuth, docController.downloadDocument);
router.post('/:id/upload-version', requireRole('secretary', 'admin'), upload.single('file'), docController.uploadVersion);
router.get('/:id/versions', requireAuth, docController.getVersions);
router.put('/:id', requireAuth, docController.updateDocument);
router.put('/:id/submit', requireRole('secretary', 'admin'), docController.submitDocument);
router.put('/:id/approve', requireRole('user', 'executive', 'admin'), docController.approveDocument);
router.put('/:id/reject', requireRole('user', 'executive', 'admin'), docController.rejectDocument);
router.put('/:id/sign', requireSignerPermission, docController.signDocument);
router.post('/:id/share', requireRole('admin', 'secretary'), docController.shareDocument);
router.delete('/:id', requireRole('admin', 'secretary'), docController.deleteDocument);
router.post('/:id/comment', requireAuth, docController.addComment);

module.exports = router;
