const express = require('express');
const router = express.Router();
const { Site } = require('../models/Misc');
const { BasketItem } = require('../models/Basket');
const SiteBasketPayment = require('../models/SiteBasketPayment');
const { protectMember, protectAdmin } = require('../middleware/auth');

// Member: create site
router.post('/', protectMember, async (req, res) => {
  try {
    const { siteName, siteLocation, timeline, estimatedBudget, notes, selectedProducts } = req.body;
    const site = await Site.create({
      member: req.member._id,
      siteName, siteLocation, timeline, estimatedBudget, notes, selectedProducts,
      statusUpdates: [{ status: 'submitted', note: 'Site creation request submitted', updatedAt: new Date() }],
    });
    res.status(201).json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Member: get my sites
router.get('/my', protectMember, async (req, res) => {
  try {
    const sites = await Site.find({ member: req.member._id }).sort({ createdAt: -1 });
    res.json({ success: true, sites });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Member: update a site they own
router.put('/:id', protectMember, async (req, res) => {
  try {
    const site = await Site.findOne({ _id: req.params.id, member: req.member._id });
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });

    const { siteName, siteLocation, timeline, estimatedBudget, notes } = req.body;
    if (typeof siteName !== 'string' || !siteName.trim()) {
      return res.status(400).json({ success: false, message: 'Site name is required' });
    }
    site.siteName = siteName.trim();
    site.siteLocation = siteLocation || '';
    site.timeline = timeline || '';
    site.estimatedBudget = Number(estimatedBudget) || 0;
    site.notes = notes || '';
    await site.save();
    res.json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Member: delete a site they own
router.delete('/:id', protectMember, async (req, res) => {
  try {
    const site = await Site.findOne({ _id: req.params.id, member: req.member._id });
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });

    const paymentPending = await SiteBasketPayment.exists({ site: site._id, status: 'pending' });
    if (paymentPending) {
      return res.status(409).json({ success: false, message: 'This site has a payment awaiting verification and cannot be deleted yet' });
    }

    await BasketItem.updateMany({ member: req.member._id, site: site._id }, { $set: { site: null } });
    await site.deleteOne();
    res.json({ success: true, message: 'Site deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: get all sites
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { memberId, status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (memberId) query.member = memberId;
    if (status) query.status = status;
    const sites = await Site.find(query)
      .populate('member', 'name memberId email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Site.countDocuments(query);
    res.json({ success: true, sites, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: update site status
router.put('/admin/:id/status', protectAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    const site = await Site.findByIdAndUpdate(req.params.id, {
      status,
      $push: { statusUpdates: { status, note, updatedAt: new Date() } },
    }, { new: true });
    res.json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
