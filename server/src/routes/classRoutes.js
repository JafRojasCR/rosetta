const express = require('express');
const router = express.Router();
const {
  getClasses,
  getClassByCode,
  createClass,
  updateClass,
  deleteClass,
} = require('../controllers/classController');
const { protect, adminOnly, optionalAuth } = require('../middlewares/authMiddleware');

router.get('/', getClasses);
router.get('/:classCode', optionalAuth, getClassByCode);
router.post('/', protect, adminOnly, createClass);
router.put('/:classCode', protect, adminOnly, updateClass);
router.delete('/:classCode', protect, adminOnly, deleteClass);

module.exports = router;
