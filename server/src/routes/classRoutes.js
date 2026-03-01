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
const uploadClassFiles = require('../middlewares/uploadClassFiles');

router.get('/', getClasses);
router.get('/:classCode', optionalAuth, getClassByCode);
router.post(
  '/',
  protect,
  adminOnly,
  uploadClassFiles.fields([
    { name: 'recordingFile', maxCount: 1 },
    { name: 'canvaFile', maxCount: 1 },
  ]),
  createClass
);
router.put(
  '/:classCode',
  protect,
  adminOnly,
  uploadClassFiles.fields([
    { name: 'recordingFile', maxCount: 1 },
    { name: 'canvaFile', maxCount: 1 },
  ]),
  updateClass
);
router.delete('/:classCode', protect, adminOnly, deleteClass);

module.exports = router;
