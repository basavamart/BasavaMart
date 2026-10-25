const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const { protectUser, protectAdmin } = require('../middleware/auth');
const paymentProofUpload = require('../middleware/paymentProofUpload');

const parseFormValue = (value) => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
};

// Package breakdown helper
function calcPackageBreakdown(qty, variant) {
  const { tertiaryThreshold: t = 0, secondaryThreshold: s = 0, primaryThreshold: p = 0 } = variant;
  let remaining = qty;
  const result = { tertiary: { qty: t, count: 0, total: 0 }, secondary: { qty: s, count: 0, total: 0 }, primary: { qty: p, count: 0, total: 0 }, remainder: { count: 0 } };
  if (t > 0) { result.tertiary.count = Math.floor(remaining / t); remaining = remaining % t; result.tertiary.total = result.tertiary.count * t; }
  if (s > 0) { result.secondary.count = Math.floor(remaining / s); remaining = remaining % s; result.secondary.total = result.secondary.count * s; }
  if (p > 0) { result.primary.count = Math.floor(remaining / p); remaining = remaining % p; result.primary.total = result.primary.count * p; }
  result.remainder.count = remaining;
  return result;
}

// CREATE order (after payment or pay-later)
router.post('/', protectUser, paymentProofUpload.single('paymentProof'), async (req, res) => {
  try {
    const items = parseFormValue(req.body.items);
    const billingAddress = parseFormValue(req.body.billingAddress);
    const shippingAddress = parseFormValue(req.body.shippingAddress);
    const { paymentMethod, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const isBankTransfer = paymentMethod === 'bank_transfer';

    if (!Array.isArray(items) || !items.length || !billingAddress || !shippingAddress) {
      return res.status(400).json({ success: false, message: 'Order items and addresses are required' });
    }
    if (isBankTransfer && !req.file) {
      return res.status(400).json({ success: false, message: 'Payment screenshot is required' });
    }

    let subtotal = 0, totalDiscount = 0, totalGst = 0, totalAmount = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId).populate('brand', 'name').populate('category', 'name');
      if (!product) continue;
      const variant = product.variants.id(item.variantId);
      if (!variant) continue;

      const itemTotal = variant.finalPrice * item.quantity;
      subtotal += variant.listPrice * item.quantity;
      totalDiscount += variant.discountAmount * item.quantity;
      totalGst += variant.gstAmount * item.quantity;
      totalAmount += itemTotal;

      processedItems.push({
        product: product._id,
        productName: product.name,
        productImage: product.images[0] || '',
        brandName: product.brand?.name || '',
        categoryName: product.category?.name || '',
        variant: {
          variantId: variant._id,
          name: variant.name,
          unit: variant.unit,
          weight: variant.weight,
          listPrice: variant.listPrice,
          discountPercent: variant.discountPercent,
          discountAmount: variant.discountAmount,
          gstPercent: variant.gstPercent,
          gstType: variant.gstType,
          gstAmount: variant.gstAmount,
          finalPrice: variant.finalPrice,
        },
        quantity: item.quantity,
        itemTotal,
        packageBreakdown: calcPackageBreakdown(item.quantity, variant),
      });

      await Product.findByIdAndUpdate(product._id, { $inc: { totalOrders: item.quantity, totalRevenue: itemTotal } });
      await Brand.findByIdAndUpdate(product.brand?._id, { $inc: { totalOrders: item.quantity, totalRevenue: itemTotal } });
    }

    const isPaid = paymentMethod === 'razorpay' && razorpayPaymentId;
    const paymentSubmittedAt = isBankTransfer ? new Date() : undefined;

    const order = await Order.create({
      user: req.user._id,
      userName: req.user.name,
      userEmail: req.user.email,
      userPhone: req.user.phone || billingAddress.mobile,
      items: processedItems,
      billingAddress,
      shippingAddress,
      subtotal: +subtotal.toFixed(2),
      totalDiscount: +totalDiscount.toFixed(2),
      totalGst: +totalGst.toFixed(2),
      totalAmount: +totalAmount.toFixed(2),
      paymentMethod,
      paymentStatus: isPaid ? 'paid' : 'pending',
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      paymentProof: req.file ? {
        url: `/uploads/payment-proofs/${req.file.filename}`,
        originalName: req.file.originalname,
        uploadedAt: paymentSubmittedAt,
      } : undefined,
      paymentSubmittedAt,
      paymentReviewDeadline: paymentSubmittedAt ? new Date(paymentSubmittedAt.getTime() + 20 * 60 * 1000) : undefined,
      paidAt: isPaid ? new Date() : undefined,
      deliveryStatus: 'order_placed',
      deliveryUpdates: [{ status: 'order_placed', message: 'Order placed successfully', updatedAt: new Date() }],
    });

    // Emit real-time alert to admin
    const io = req.app.get('io');
    io.to('admin-room').emit('new-order', { orderNumber: order.orderNumber, userName: req.user.name, amount: order.totalAmount });

    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET user orders
router.get('/my', protectUser, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Pay now (pay-later to paid)
router.post('/:id/pay', protectUser, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { paymentStatus: 'paid', razorpayOrderId, razorpayPaymentId, razorpaySignature, paidAt: new Date() },
      { new: true }
    );
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== ADMIN ======
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { status, paymentStatus, search, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.deliveryStatus = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (search) query.$or = [{ orderNumber: { $regex: search, $options: 'i' } }, { userName: { $regex: search, $options: 'i' } }];
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const orders = await Order.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit));
    const total = await Order.countDocuments(query);
    res.json({ success: true, orders, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/payment-verifications', protectAdmin, async (req, res) => {
  try {
    const orders = await Order.find({
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending',
      'paymentProof.url': { $exists: true, $ne: '' },
    }).sort({ paymentSubmittedAt: 1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admin/:id', protectAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/admin/:id/mark-paid', protectAdmin, async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending',
      'paymentProof.url': { $exists: true, $ne: '' },
    });
    if (!order) return res.status(404).json({ success: false, message: 'Pending payment verification not found' });

    order.paymentStatus = 'paid';
    order.paidAt = new Date();
    order.paymentReviewDeadline = undefined;
    await order.save();
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin update delivery status
router.put('/admin/:id/delivery', protectAdmin, async (req, res) => {
  try {
    const { status, message, adminNote } = req.body;
    const update = {
      deliveryStatus: status,
      $push: { deliveryUpdates: { status, message, adminNote, updatedAt: new Date() } },
    };
    if (adminNote) update.adminNotes = adminNote;
    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', protectUser, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
