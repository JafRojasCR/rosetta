const express = require('express');
const router = express.Router();
const {
  getQuestionSubtypes,
  createQuestionSubtype,
  deleteQuestionSubtype,
} = require('../controllers/questionSubtypeController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/', protect, getQuestionSubtypes);
router.post('/', protect, adminOnly, createQuestionSubtype);
router.delete('/:id', protect, adminOnly, deleteQuestionSubtype);

module.exports = router;
