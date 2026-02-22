const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const classRoutes = require('./classRoutes');
const paymentRoutes = require('./paymentRoutes');
const documentRoutes = require('./documentRoutes');
const adminRoutes = require('./adminRoutes');

router.use('/auth', authRoutes);
router.use('/classes', classRoutes);
router.use('/payments', paymentRoutes);
router.use('/documents', documentRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
