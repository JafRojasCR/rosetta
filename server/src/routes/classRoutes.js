const express = require('express');
const router = express.Router();
const classChunkRawLimit = process.env.VERCEL ? '4mb' : '40mb';
const {
  getClasses,
  getClassByCode,
  createClass,
  initClassRecordingUpload,
  uploadClassRecordingChunk,
  completeClassRecordingUpload,
  updateClass,
  deleteClass,
  getClassEmbedToken,
  getClassEmbedByToken,
  getClassEmbedStreamByToken,
  setClassVote,
} = require('../controllers/classController');
const { protect, adminOnly, optionalAuth, studentOnly } = require('../middlewares/authMiddleware');
const uploadClassFiles = require('../middlewares/uploadClassFiles');

router.get('/', getClasses);
router.post('/recording-upload/init', protect, adminOnly, initClassRecordingUpload);
router.post('/recording-upload/complete', protect, adminOnly, completeClassRecordingUpload);
router.put(
  '/recording-upload/chunk',
  protect,
  adminOnly,
  express.raw({ type: 'application/octet-stream', limit: classChunkRawLimit }),
  uploadClassRecordingChunk
);
router.get('/embed/:token/stream', getClassEmbedStreamByToken);
router.get('/embed/:token', getClassEmbedByToken);
router.get('/:classCode/embed-token', protect, getClassEmbedToken);
router.patch('/:classCode/vote', protect, studentOnly, setClassVote);
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
