const express = require('express');
const router = express.Router();
const {
  getDocuments,
  getDocumentById,
  getDocumentEmbedToken,
  getDocumentEmbedByToken,
  getDocumentEmbedStreamByToken,
  createDocument,
  updateDocument,
  deleteDocument,
} = require('../controllers/documentController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const uploadDocument = require('../middlewares/uploadDocument');

router.get('/', getDocuments);
router.get('/embed/:token/stream', getDocumentEmbedStreamByToken);
router.get('/embed/:token', getDocumentEmbedByToken);
router.get('/:docId/embed-token', protect, getDocumentEmbedToken);
router.get('/:docId', getDocumentById);
router.post('/', protect, adminOnly, uploadDocument.single('file'), createDocument);
router.put('/:docId', protect, adminOnly, updateDocument);
router.delete('/:docId', protect, adminOnly, deleteDocument);

module.exports = router;
