const express = require('express');
const router = express.Router();
const certController = require('../controllers/certController');
const { requireAuth, requireRole } = require('../middlewares/auth');

router.get('/', requireAuth, certController.getCertificates);
router.get('/:id', requireAuth, certController.getCertificateById);
router.post('/', requireRole('admin', 'executive'), certController.createCertificate);
router.put('/:id', requireRole('admin'), certController.updateCertificate);
router.put('/:id/revoke', requireRole('admin'), certController.revokeCertificate);
router.delete('/:id', requireRole('admin'), certController.deleteCertificate);

module.exports = router;
