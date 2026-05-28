const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const classRoutes = require('./classRoutes');
const paymentRoutes = require('./paymentRoutes');
const documentRoutes = require('./documentRoutes');
const subjectRoutes = require('./subjectRoutes');
const adminRoutes = require('./adminRoutes');
const translateRoutes = require('./translateRoutes');

router.use('/auth', authRoutes);
router.use('/classes', classRoutes);
router.use('/payments', paymentRoutes);
router.use('/documents', documentRoutes);
router.use('/subjects', subjectRoutes);
router.use('/admin', adminRoutes);
router.use('/translate', translateRoutes);

module.exports = router;
