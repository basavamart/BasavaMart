const express = require('express');
const router = express.Router();
const Brand = require('../models/Brand');
const { protectAdmin } = require('../middleware/auth');
const upload = require('../config/multer');


// GET all brands (public)
router.get('/', async (req, res) => {
  try {
    const { search, status, accessLevel, page = 1, limit = 50 } = req.query;
    const query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (status) query.status = status;
    else query.status = 'published'; // public only sees published
    if (accessLevel === 'user' || accessLevel === 'member') query.accessLevel = { $in: [accessLevel, 'both'] };

    const brands = await Brand.find(query)
      .sort({ order: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Brand.countDocuments(query);

    res.json({ success: true, brands, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET all brands for admin (with all statuses)
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { search, status, startDate, endDate } = req.query;
    const query = {};
    if (search) query.name = { $regex: search, $options: 'i' };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const brands = await Brand.find(query).sort({ order: 1, createdAt: -1 });
    res.json({ success: true, brands, total: brands.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CREATE brand
router.post('/', protectAdmin, upload.single('logo'), async (req, res) => {
  try {
    const { name, description, status, accessLevel } = req.body;
    const existing = await Brand.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) return res.status(400).json({ success: false, message: 'Brand already exists' });

    const logo = req.file ? `/uploads/brands/${req.file.filename}` : '';
    const order = await Brand.countDocuments();
    const brand = await Brand.create({ name, description, logo, status: status || 'published', accessLevel: accessLevel || 'both', order });
    res.status(201).json({ success: true, brand });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// REORDER brands
router.patch('/reorder', protectAdmin, async (req, res) => {
  try {
    const { items } = req.body; // [{ _id, order }]
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ success: false, message: 'items array required' });
    }
    const ops = items.map(({ _id, order }) => ({
      updateOne: { filter: { _id }, update: { $set: { order } } }
    }));
    await Brand.bulkWrite(ops);
    res.json({ success: true, message: 'Order updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE brand
router.put('/:id', protectAdmin, upload.single('logo'), async (req, res) => {
  try {
    const { name, description, status, accessLevel } = req.body;
    const updateData = { name, description, status, accessLevel: accessLevel || 'both' };
    if (req.file) updateData.logo = `/uploads/brands/${req.file.filename}`;

    const brand = await Brand.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
    res.json({ success: true, brand });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE brand
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const brand = await Brand.findByIdAndDelete(req.params.id);
    if (!brand) return res.status(404).json({ success: false, message: 'Brand not found' });
    res.json({ success: true, message: 'Brand deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE status
router.patch('/:id/status', protectAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const brand = await Brand.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json({ success: true, brand });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
