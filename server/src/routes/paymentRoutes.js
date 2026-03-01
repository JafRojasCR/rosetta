const express = require('express');
const router = express.Router();
const {
  getMyPayments,
  getAllPayments,
  createPayment,
  updatePaymentStatus,
  cancelMyPendingPayment,
} = require('../controllers/paymentController');
const { protect, adminOnly, studentOnly } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

router.get('/my', protect, studentOnly, getMyPayments);
router.get('/all', protect, adminOnly, getAllPayments);
router.post('/', protect, studentOnly, upload.single('bill'), createPayment);
router.delete('/:paymentId', protect, studentOnly, cancelMyPendingPayment);
router.patch('/:paymentId/status', protect, adminOnly, updatePaymentStatus);

module.exports = router;
