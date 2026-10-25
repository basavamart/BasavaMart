const express = require('express');
const router = express.Router();
const { protectAdmin, protectUser } = require('../middleware/auth');
const User = require('../models/User');
const Member = require('../models/Member');
const Order = require('../models/Order');

// Get all users
router.get('/users', protectAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const query = search ? { $or: [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] } : {};
    const users = await User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total = await User.countDocuments(query);
    res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user-tracking', protectAdmin, async (req, res) => {
  try {
    const { search = '', startDate = '', endDate = '', limit = 200 } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    if (startDate || endDate) {
      query.lastSeenAt = {};
      if (startDate) query.lastSeenAt.$gte = new Date(startDate);
      if (endDate) query.lastSeenAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const users = await User.find(query).sort({ lastSeenAt: -1, createdAt: -1 }).limit(Number(limit));
    const userIds = users.map((user) => user._id);
    const orders = await Order.find({ user: { $in: userIds } }).sort({ createdAt: -1 });

    const ordersByUser = new Map();
    for (const order of orders) {
      const key = String(order.user);
      const arr = ordersByUser.get(key) || [];
      arr.push(order);
      ordersByUser.set(key, arr);
    }

    const userRows = users.map((user) => {
      const userOrders = ordersByUser.get(String(user._id)) || [];
      const totalSpent = userOrders.reduce((sum, order) => sum + (Number(order.totalAmount) || 0), 0);
      const pendingPayments = userOrders.filter((order) => ['pending', 'failed'].includes(order.paymentStatus)).length;
      const orderHistory = userOrders.map((order) => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        paymentStatus: order.paymentStatus,
        deliveryStatus: order.deliveryStatus,
        createdAt: order.createdAt,
      }));

      const onlineStatus = user.isOnline ? 'online' : user.lastSeenAt && Date.now() - new Date(user.lastSeenAt).getTime() < 30 * 60 * 1000 ? 'active' : 'offline';

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone || '-',
        isOnline: user.isOnline,
        status: onlineStatus,
        lastLoginAt: user.lastLoginAt,
        lastSeenAt: user.lastSeenAt,
        cartItems: user.cartSnapshot?.items?.length || 0,
        cartValue: Number(user.cartSnapshot?.totalAmount || 0),
        orderCount: userOrders.length,
        totalSpent,
        pendingPayments,
        orderHistory,
        loginHistory: user.loginHistory || [],
      };
    });

    res.json({ success: true, users: userRows, total: userRows.length, pages: 1 });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/user/cart-sync', protectUser, async (req, res) => {
  try {
    const { items = [] } = req.body;
    const itemList = (items || []).slice(0, 50).map((item) => ({
      productId: item.productId || item._id || '',
      variantId: item.variantId || '',
      name: item.productName || item.name || 'Product',
      variantName: item.variantName || item.variant || '',
      quantity: Number(item.quantity || 1),
      price: Number(item.finalPrice || item.price || 0),
    }));

    const totalAmount = itemList.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity || 1)), 0);
    const payload = {
      items: itemList,
      itemCount: itemList.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
      totalAmount,
      updatedAt: new Date(),
    };

    const user = await User.findByIdAndUpdate(req.user._id, {
      cartSnapshot: payload,
      lastSeenAt: new Date(),
      isOnline: true,
    }, { new: true });

    res.json({ success: true, cart: payload, user: { name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
