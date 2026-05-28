const express = require('express');
const router = express.Router();
const translateController = require('../controllers/translateController');

router.post('/', translateController.translateTexts);

module.exports = router;
