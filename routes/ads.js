const express = require('express');
const router = express.Router();
const { Ad } = require('../models/Misc');
const { protectAdmin } = require('../middleware/auth');
const upload = require('../config/multer');

// GET ads (public, by placement)
router.get('/', async (req, res) => {
  try {
    const { placement } = req.query;
    const query = { status: 'published' };
    if (placement) query.placement = placement;
    const ads = await Ad.find(query).sort({ displayOrder: 1, createdAt: -1 });
    res.json({ success: true, ads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ADMIN: Get all ads
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const ads = await Ad.find().sort({ createdAt: -1 });
    res.json({ success: true, ads });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CREATE ad
router.post('/', protectAdmin, upload.array('files', 5), async (req, res) => {
  try {
    const files = req.files?.map(f => `/uploads/ads/${f.filename}`) || [];
    const { name, description, heading, title, externalLink, mobileNumber, placement, behavior, status } = req.body;
    const ad = await Ad.create({ name, description, heading, title, externalLink, mobileNumber, placement, behavior, status: status || 'published', files });
    res.status(201).json({ success: true, ad });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE ad
router.put('/:id', protectAdmin, upload.array('files', 5), async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (req.files?.length) updateData.files = req.files.map(f => `/uploads/ads/${f.filename}`);
    const ad = await Ad.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json({ success: true, ad });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// STATUS update
router.patch('/:id/status', protectAdmin, async (req, res) => {
  try {
    const ad = await Ad.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ success: true, ad });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE ad
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    await Ad.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Ad deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
