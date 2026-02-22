const express = require('express');
const router = express.Router();
const {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  deleteDocument,
} = require('../controllers/documentController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/upload');

router.get('/', getDocuments);
router.get('/:docId', getDocumentById);
router.post('/', protect, adminOnly, upload.single('file'), createDocument);
router.put('/:docId', protect, adminOnly, updateDocument);
router.delete('/:docId', protect, adminOnly, deleteDocument);

module.exports = router;
