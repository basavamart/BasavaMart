const express = require('express');
const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
const router = express.Router();
const BrandCategory = require('../models/BrandCategory');
const Brand = require('../models/Brand');
const { protectAdmin } = require('../middleware/auth');
const upload = require('../config/multer');

const validBrandIds = async (brandIds) => {
  if (!Array.isArray(brandIds) || brandIds.some(id => !mongoose.Types.ObjectId.isValid(id))) {
    return null;
  }
  const brands = await Brand.find({ _id: { $in: brandIds } }).select('_id');
  return brands.length === new Set(brandIds.map(String)).size
    ? brands.map(brand => brand._id)
    : null;
};

const removeUploadedIcon = (file) => {
  if (file?.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
};

const removeStoredIcon = (icon) => {
  if (typeof icon !== 'string' || !icon.startsWith('/uploads/brand-categories/')) return;
  const iconPath = path.join(__dirname, '../uploads/brand-categories', path.basename(icon));
  if (fs.existsSync(iconPath)) fs.unlinkSync(iconPath);
};

router.get('/', async (req, res) => {
  try {
    const audience = req.query.accessLevel === 'member' ? 'member' : 'user';
    const categories = await BrandCategory.find({ status: 'published' })
      .sort({ order: 1, createdAt: -1 })
      .populate({
        path: 'brands',
        match: { status: 'published', accessLevel: { $in: [audience, 'both'] } },
        select: 'name logo status accessLevel order',
        options: { sort: { order: 1, name: 1 } },
      });
    res.json({
      success: true,
      brandCategories: categories.filter(category => category.brands.length > 0),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};
    const categories = await BrandCategory.find(query)
      .sort({ order: 1, createdAt: -1 })
      .populate('brands', 'name logo status accessLevel');
    res.json({ success: true, brandCategories: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/', protectAdmin, upload.single('icon'), async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      removeUploadedIcon(req.file);
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    if (!req.file || !req.file.mimetype.startsWith('image/')) {
      removeUploadedIcon(req.file);
      return res.status(400).json({ success: false, message: 'Please upload an icon image' });
    }
    if (req.body.status && !['published', 'draft'].includes(req.body.status)) {
      removeUploadedIcon(req.file);
      return res.status(400).json({ success: false, message: 'Status must be published or draft' });
    }
    const existing = await BrandCategory.findOne({ name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
    if (existing) {
      removeUploadedIcon(req.file);
      return res.status(400).json({ success: false, message: 'A category with this name already exists' });
    }
    const icon = `/uploads/brand-categories/${path.basename(req.file.path)}`;
    const category = await BrandCategory.create({
      name,
      description: String(req.body.description || '').trim(),
      icon,
      status: req.body.status === 'draft' ? 'draft' : 'published',
      order: await BrandCategory.countDocuments(),
    });
    res.status(201).json({ success: true, brandCategory: category });
  } catch (err) {
    removeUploadedIcon(req.file);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', protectAdmin, upload.single('icon'), async (req, res) => {
  try {
    const category = await BrandCategory.findById(req.params.id);
    if (!category) {
      removeUploadedIcon(req.file);
      return res.status(404).json({ success: false, message: 'Brand category not found' });
    }

    const update = {};
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        removeUploadedIcon(req.file);
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }
      const duplicate = await BrandCategory.findOne({ _id: { $ne: category._id }, name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      if (duplicate) {
        removeUploadedIcon(req.file);
        return res.status(400).json({ success: false, message: 'A category with this name already exists' });
      }
      update.name = name;
    }
    if (req.body.description !== undefined) {
      update.description = String(req.body.description).trim();
    }
    if (req.body.status !== undefined) {
      if (!['published', 'draft'].includes(req.body.status)) {
        removeUploadedIcon(req.file);
        return res.status(400).json({ success: false, message: 'Status must be published or draft' });
      }
      update.status = req.body.status;
    }
    if (req.body.brandIds !== undefined) {
      let brandIds;
      try {
        brandIds = typeof req.body.brandIds === 'string' ? JSON.parse(req.body.brandIds) : req.body.brandIds;
      } catch {
        removeUploadedIcon(req.file);
        return res.status(400).json({ success: false, message: 'brandIds must be a valid array' });
      }
      const brands = await validBrandIds(brandIds);
      if (!brands) {
        removeUploadedIcon(req.file);
        return res.status(400).json({ success: false, message: 'One or more selected brands are invalid' });
      }
      update.brands = brands;
    }
    if (req.file) {
      if (!req.file.mimetype.startsWith('image/')) {
        removeUploadedIcon(req.file);
        return res.status(400).json({ success: false, message: 'Please upload an icon image' });
      }
      update.icon = `/uploads/brand-categories/${path.basename(req.file.path)}`;
    }

    const previousIcon = category.icon;
    Object.assign(category, update);
    await category.save();
    if (req.file && previousIcon !== category.icon) removeStoredIcon(previousIcon);
    res.json({ success: true, brandCategory: category });
  } catch (err) {
    removeUploadedIcon(req.file);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/status', protectAdmin, async (req, res) => {
  try {
    if (!['published', 'draft'].includes(req.body.status)) {
      return res.status(400).json({ success: false, message: 'Status must be published or draft' });
    }
    const category = await BrandCategory.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true },
    );
    if (!category) return res.status(404).json({ success: false, message: 'Brand category not found' });
    res.json({ success: true, brandCategory: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const category = await BrandCategory.findByIdAndDelete(req.params.id);
    if (!category) return res.status(404).json({ success: false, message: 'Brand category not found' });
    removeStoredIcon(category.icon);
    res.json({ success: true, message: 'Brand category deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
