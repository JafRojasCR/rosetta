const express = require('express');
const router = express.Router();
const {
	register,
	login,
	resend2FA,
	verify2FA,
	requestPasswordReset,
	verifyPasswordResetCode,
	resetPassword,
	getMe,
	changePassword,
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/resend-2fa', resend2FA);
router.post('/verify-2fa', verify2FA);
router.post('/forgot-password', requestPasswordReset);
router.post('/verify-reset-code', verifyPasswordResetCode);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;
