const express = require('express');
const router = express.Router();
const signatureController = require('../controllers/signatureController');
const { uploadSignature } = require('../config/multer');
const { requireAuth } = require('../middlewares/auth');

router.post('/api/signatures/upload', requireAuth, uploadSignature.single('signature'), signatureController.uploadSignature);
router.get('/api/signatures/:userId', requireAuth, signatureController.getSignatureByUserId);
router.post('/api/signatures/:userId/signed-url', requireAuth, signatureController.generateSignedUrl);
router.get('/s/signature', signatureController.renderPublicSignature);

module.exports = router;
