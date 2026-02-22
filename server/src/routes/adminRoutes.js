const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentByEmail,
  updateStudent,
  deleteStudent,
  updateMyProfile,
  deleteMyAccount,
} = require('../controllers/adminController');
const { protect, adminOnly, studentOnly } = require('../middlewares/authMiddleware');

// Student self-service profile routes
router.put('/profile', protect, studentOnly, updateMyProfile);
router.delete('/profile', protect, studentOnly, deleteMyAccount);

// Admin-only student management routes
router.get('/students', protect, adminOnly, getStudents);
router.get('/students/:email', protect, adminOnly, getStudentByEmail);
router.put('/students/:email', protect, adminOnly, updateStudent);
router.delete('/students/:email', protect, adminOnly, deleteStudent);

module.exports = router;
