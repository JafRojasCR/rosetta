const express = require('express');
const router = express.Router();
const {
	register,
	login,
	send2FA,
	verify2FA,
	getMe,
	changePassword,
} = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/send-2fa', send2FA);
router.post('/verify-2fa', verify2FA);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;
