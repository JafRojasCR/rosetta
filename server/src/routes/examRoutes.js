const express = require('express');
const router = express.Router();
const {
  getExams,
  getExamById,
  createExam,
  updateExam,
  deleteExam,
} = require('../controllers/examController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/', protect, getExams);
router.get('/:id', protect, getExamById);
router.post('/', protect, adminOnly, createExam);
router.put('/:id', protect, adminOnly, updateExam);
router.delete('/:id', protect, adminOnly, deleteExam);

module.exports = router;
