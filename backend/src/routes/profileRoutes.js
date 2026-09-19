const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { requireAuth } = require('../middlewares/auth');

router.put('/api/profile', requireAuth, profileController.updateProfile);
router.post('/api/profile/set-pin', requireAuth, profileController.setPin);
router.post('/api/otp/generate', requireAuth, profileController.generateOtp);
router.post('/api/otp/verify', requireAuth, profileController.verifyOtp);
router.put('/api/documents/:id/sign-with-otp', requireAuth, profileController.signWithOtp);

module.exports = router;
