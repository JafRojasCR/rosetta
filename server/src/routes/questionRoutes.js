const express = require('express');
const router = express.Router();
const {
  initQuestionImageUpload,
  completeQuestionImageUpload,
  getQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/', protect, getQuestions);
router.post('/image-upload/init', protect, adminOnly, initQuestionImageUpload);
router.post('/image-upload/complete', protect, adminOnly, completeQuestionImageUpload);
router.post('/', protect, adminOnly, createQuestion);
router.put('/:id', protect, adminOnly, updateQuestion);
router.delete('/:id', protect, adminOnly, deleteQuestion);

module.exports = router;
