const express = require('express');
const router = express.Router();
const documentChunkRawLimit = process.env.VERCEL ? '4mb' : '40mb';
const {
  getDocuments,
  getDocumentById,
  getDocumentEmbedToken,
  getDocumentEmbedByToken,
  getDocumentEmbedStreamByToken,
  initDocumentUpload,
  uploadDocumentChunk,
  completeDocumentUpload,
  createDocument,
  updateDocument,
  deleteDocument,
} = require('../controllers/documentController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const uploadDocument = require('../middlewares/uploadDocument');

router.get('/', getDocuments);
router.get('/embed/:token/stream', getDocumentEmbedStreamByToken);
router.get('/embed/:token', getDocumentEmbedByToken);
router.post('/upload/init', protect, adminOnly, initDocumentUpload);
router.put(
  '/upload/chunk',
  protect,
  adminOnly,
  express.raw({ type: 'application/octet-stream', limit: documentChunkRawLimit }),
  uploadDocumentChunk
);
router.post('/upload/complete', protect, adminOnly, completeDocumentUpload);
router.get('/:docId/embed-token', protect, getDocumentEmbedToken);
router.get('/:docId', getDocumentById);
router.post('/', protect, adminOnly, uploadDocument.single('file'), createDocument);
router.put('/:docId', protect, adminOnly, updateDocument);
router.delete('/:docId', protect, adminOnly, deleteDocument);

module.exports = router;
