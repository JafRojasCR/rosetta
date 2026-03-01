const express = require('express');
const router = express.Router();
const {
	getSubjects,
	createSubject,
	updateSubject,
	deleteSubject,
} = require('../controllers/subjectController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.get('/', getSubjects);
router.post('/', protect, adminOnly, createSubject);
router.put('/:subjectId', protect, adminOnly, updateSubject);
router.delete('/:subjectId', protect, adminOnly, deleteSubject);

module.exports = router;
