const express = require('express');
const router = express.Router();
const { Report } = require('../models/Misc');
const { protectUser, protectMember, protectAdmin } = require('../middleware/auth');

router.post('/', async (req, res) => {
  try {
    const { type, subject, message, userId, memberId, name, email, phone, panelType } = req.body;
    const report = await Report.create({ type, subject, message, submittedBy: { userId, memberId, name, email, phone, panelType } });
    res.status(201).json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { type, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    const reports = await Report.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total = await Report.countDocuments(query);
    res.json({ success: true, reports, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/admin/:id/respond', protectAdmin, async (req, res) => {
  try {
    const { adminResponse, status } = req.body;
    const report = await Report.findByIdAndUpdate(req.params.id, { adminResponse, status, adminRespondedAt: new Date() }, { new: true });
    res.json({ success: true, report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
