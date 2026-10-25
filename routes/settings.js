const express = require('express');
const router = express.Router();
const { Settings } = require('../models/Misc');
const { protectAdmin } = require('../middleware/auth');
const upload = require('../config/multer');
const bcrypt = require('bcryptjs');

// GET all settings (public subset)
router.get('/public', async (req, res) => {
  try {
    const keys = ['logo', 'logoText', 'taglines', 'broadcastUser', 'broadcastMember', 'qrCode', 'invoiceDetails'];
    const settings = await Settings.find({ key: { $in: keys } });
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json({ success: true, settings: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all settings (admin)
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const settings = await Settings.find();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    res.json({ success: true, settings: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPSERT setting
router.put('/admin/:key', protectAdmin, upload.single('file'), async (req, res) => {
  try {
    const { key } = req.params;
    let value = req.body.value;
    if (req.file) value = `/uploads/settings/${req.file.filename}`;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { /* keep as string */ }
    }
    const setting = await Settings.findOneAndUpdate(
      { key },
      { key, value, updatedAt: new Date() },
      { new: true, upsert: true }
    );
    res.json({ success: true, setting });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Change admin password
router.post('/admin/change-password', protectAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (currentPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(400).json({ success: false, message: 'Current password incorrect' });
    }
    // In real app, store hashed password in DB; here we update env (simplified)
    process.env.ADMIN_PASSWORD = newPassword;
    res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
