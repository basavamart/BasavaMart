const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const { BasketItem } = require('../models/Basket');
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const User = require('../models/User');
const Member = require('../models/Member');
const { protectAdmin, protectMember } = require('../middleware/auth');

// ===== ADMIN DASHBOARD =====
router.get('/admin', protectAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const [
      totalProducts, totalMemberProducts, totalBrands, totalUsers, totalMembers,
      totalOrders, totalMemberOrders,
      userRevenue, memberRevenue,
      pendingOrders, deliveredOrders,
      recentOrders,
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ accessLevel: { $in: ['member', 'both'] } }),
      Brand.countDocuments(),
      User.countDocuments(),
      Member.countDocuments(),
      Order.countDocuments(dateFilter),
      BasketItem.countDocuments({ paymentStatus: 'paid', ...dateFilter }),
      Order.aggregate([{ $match: { paymentStatus: 'paid', ...dateFilter } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
      BasketItem.aggregate([{ $match: { paymentStatus: 'paid', ...dateFilter } }, { $group: { _id: null, total: { $sum: '$vendorPrice.finalPrice' } } }]),
      Order.countDocuments({ deliveryStatus: 'order_placed', ...dateFilter }),
      Order.countDocuments({ deliveryStatus: 'delivered', ...dateFilter }),
      Order.find().sort({ createdAt: -1 }).limit(10).select('orderNumber userName totalAmount deliveryStatus createdAt'),
    ]);

    // Monthly revenue trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyRevenue = await Order.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: sixMonthsAgo } } },
      { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      success: true,
      stats: {
        totalProducts,
        totalMemberProducts,
        totalBrands,
        totalUsers,
        totalMembers,
        memberProducts: totalMemberProducts,
        totalOrders: totalOrders + totalMemberOrders,
        totalRevenue: (userRevenue[0]?.total || 0) + (memberRevenue[0]?.total || 0),
        pendingOrders, deliveredOrders,
        recentOrders, monthlyRevenue,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER DASHBOARD =====
router.get('/member', protectMember, async (req, res) => {
  try {
    const memberId = req.member._id;
    const [basketTotal, paidOrders, pendingBasket, deliveredOrders] = await Promise.all([
      BasketItem.countDocuments({ member: memberId }),
      BasketItem.countDocuments({ member: memberId, paymentStatus: 'paid' }),
      BasketItem.countDocuments({ member: memberId, adminStatus: 'pending' }),
      BasketItem.countDocuments({ member: memberId, deliveryStatus: 'delivered' }),
    ]);

    const revenueAgg = await BasketItem.aggregate([
      { $match: { member: memberId, paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$vendorPrice.finalPrice' } } },
    ]);

    res.json({
      success: true,
      stats: { basketTotal, paidOrders, pendingBasket, deliveredOrders, totalRevenue: revenueAgg[0]?.total || 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
