const express = require('express');
const router = express.Router();
const { BasketItem, Vendor } = require('../models/Basket');
const Product = require('../models/Product');
const SiteBasketPayment = require('../models/SiteBasketPayment');
const { Site } = require('../models/Misc');
const { protectMember, protectAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const paymentProofUpload = require('../middleware/paymentProofUpload');

const upload = require('../middleware/basketUpload');

// Helper: package breakdown
function calcPackageBreakdown(qty, t = 0, s = 0, p = 0) {
  let remaining = qty;
  const result = { tertiary: { qty: t, count: 0, total: 0 }, secondary: { qty: s, count: 0, total: 0 }, primary: { qty: p, count: 0, total: 0 }, remainder: { count: 0 } };
  if (t > 0) { result.tertiary.count = Math.floor(remaining / t); remaining %= t; result.tertiary.total = result.tertiary.count * t; }
  if (s > 0) { result.secondary.count = Math.floor(remaining / s); remaining %= s; result.secondary.total = result.secondary.count * s; }
  if (p > 0) { result.primary.count = Math.floor(remaining / p); remaining %= p; result.primary.total = result.primary.count * p; }
  result.remainder.count = remaining;
  return result;
}

// ===== MEMBER: Move product to basket ("Know the Price") =====
router.post('/add', protectMember, upload.array('files', 7), async (req, res) => {
  try {
    const { productId, variantId, quantity, memberNote } = req.body;
    const product = await Product.findById(productId).populate('brand', 'name').populate('category', 'name').populate('subcategory', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const variant = product.variants.id(variantId);
    if (!variant) return res.status(404).json({ success: false, message: 'Variant not found' });

    const attachments = (req.files || []).map(f => ({
      url: `/uploads/basket/${f.filename}`,
      name: f.originalname,
      fileType: f.mimetype,
    }));

    const existing = await BasketItem.findOne({ member: req.member._id, product: productId, 'variant.variantId': variantId });
    if (existing) {
      existing.quantity = quantity;
      if (memberNote) existing.memberNote = memberNote;
      if (attachments.length) existing.attachments = [...(existing.attachments || []), ...attachments];
      await existing.save();
      console.log('>>> LIVE — attachments caster:', BasketItem.schema.path('attachments').caster?.instance);
      console.log('>>> LIVE — attachments about to save:', JSON.stringify(attachments));
      return res.json({ success: true, basketItem: existing });
    }

    const orderCount = await BasketItem.countDocuments({ member: req.member._id });
    const basketItem = await BasketItem.create({
      member: req.member._id,
      product: productId,
      productSnapshot: {
        name: product.name,
        image: product.images[0] || '',
        brandName: product.brand?.name || '',
        categoryName: product.category?.name || '',
        subcategoryName: product.subcategory?.name || '',
      },
      variant: { variantId: variant._id, name: variant.name, unit: variant.unit, weight: variant.weight },
      quantity,
      memberNote: memberNote || '',
      attachments,
      orderNumber: `BM-BSKT-${req.member.memberId}-${String(orderCount + 1).padStart(3, '0')}`,
      packageBreakdown: calcPackageBreakdown(quantity, variant.tertiaryThreshold, variant.secondaryThreshold, variant.primaryThreshold),
    });

    res.status(201).json({ success: true, basketItem });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Get basket =====
router.get('/my', protectMember, async (req, res) => {
  try {
    const items = await BasketItem.find({ member: req.member._id })
      .populate('product', 'name images brand category subcategory variants')
      .populate('site', 'siteName siteLocation')
      .sort({ createdAt: -1 });
    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Assign basket items to a site =====
router.post('/site/:siteId/assign', protectMember, async (req, res) => {
  try {
    const { basketItemIds } = req.body;
    if (!Array.isArray(basketItemIds) || !basketItemIds.length) {
      return res.status(400).json({ success: false, message: 'Select at least one basket item' });
    }
    const site = await Site.findOne({ _id: req.params.siteId, member: req.member._id });
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });

    const result = await BasketItem.updateMany({
      _id: { $in: basketItemIds },
      member: req.member._id,
      paymentStatus: { $ne: 'paid' },
      paymentBatch: null,
    }, { $set: { site: site._id } });

    if (result.matchedCount !== basketItemIds.length) {
      return res.status(409).json({ success: false, message: 'Some items are paid, under verification, or unavailable' });
    }
    res.json({ success: true, site });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Submit bank-transfer proof for a site's priced basket items =====
router.post('/site/:siteId/bank-payment', protectMember, paymentProofUpload.single('paymentProof'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Payment screenshot is required' });
    const site = await Site.findOne({ _id: req.params.siteId, member: req.member._id });
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });

    const items = await BasketItem.find({
      member: req.member._id,
      site: site._id,
      paymentStatus: { $ne: 'paid' },
      paymentBatch: null,
      pricingSet: true,
      paymentEnabled: true,
    });
    if (!items.length) return res.status(400).json({ success: false, message: 'No priced, payable basket items are assigned to this site' });

    const amount = items.reduce((sum, item) => sum + (item.vendorPrice?.finalPrice || 0) * item.quantity, 0);
    if (amount <= 0) return res.status(400).json({ success: false, message: 'The site payment amount must be greater than zero' });
    const submittedAt = new Date();
    const payment = await SiteBasketPayment.create({
      member: req.member._id,
      site: site._id,
      basketItems: items.map(item => item._id),
      amount: +amount.toFixed(2),
      paymentProof: {
        url: `/uploads/payment-proofs/${req.file.filename}`,
        originalName: req.file.originalname,
        uploadedAt: submittedAt,
      },
      paymentSubmittedAt: submittedAt,
      paymentReviewDeadline: new Date(submittedAt.getTime() + 20 * 60 * 1000),
    });
    await BasketItem.updateMany({ _id: { $in: items.map(item => item._id) }, member: req.member._id, paymentBatch: null }, { $set: { paymentBatch: payment._id } });
    res.status(201).json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Create a Razorpay order for priced items assigned to a site =====
router.post('/site/:siteId/razorpay-order', protectMember, async (req, res) => {
  try {
    const site = await Site.findOne({ _id: req.params.siteId, member: req.member._id });
    if (!site) return res.status(404).json({ success: false, message: 'Site not found' });
    const items = await BasketItem.find({ member: req.member._id, site: site._id, paymentStatus: { $ne: 'paid' }, paymentBatch: null, pricingSet: true, paymentEnabled: true });
    if (!items.length) return res.status(400).json({ success: false, message: 'No priced, payable basket items are assigned to this site' });

    const amount = +(items.reduce((sum, item) => sum + (item.vendorPrice?.finalPrice || 0) * item.quantity, 0)).toFixed(2);
    if (amount <= 0) return res.status(400).json({ success: false, message: 'The site payment amount must be greater than zero' });
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await razorpay.orders.create({ amount: Math.round(amount * 100), currency: 'INR', receipt: `site-${site._id}-${Date.now()}` });
    const payment = await SiteBasketPayment.create({ member: req.member._id, site: site._id, basketItems: items.map(item => item._id), amount, paymentMethod: 'razorpay', razorpayOrderId: order.id });
    await BasketItem.updateMany({ _id: { $in: items.map(item => item._id) }, member: req.member._id, paymentBatch: null }, { $set: { paymentBatch: payment._id } });
    res.status(201).json({ success: true, paymentId: payment._id, key: process.env.RAZORPAY_KEY_ID, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Verify a Razorpay site payment =====
router.post('/site-payment/:id/verify', protectMember, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const payment = await SiteBasketPayment.findOne({ _id: req.params.id, member: req.member._id, paymentMethod: 'razorpay', status: 'pending' });
    if (!payment || payment.razorpayOrderId !== razorpay_order_id) return res.status(404).json({ success: false, message: 'Pending site payment not found' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
    if (expected !== razorpay_signature) return res.status(400).json({ success: false, message: 'Invalid Razorpay payment signature' });

    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const capturedPayment = await razorpay.payments.fetch(razorpay_payment_id);
    if (capturedPayment.order_id !== payment.razorpayOrderId || capturedPayment.amount !== Math.round(payment.amount * 100) || capturedPayment.status !== 'captured') {
      return res.status(400).json({ success: false, message: 'Razorpay payment is not captured for the expected amount' });
    }

    payment.status = 'paid';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.paidAt = new Date();
    await payment.save();
    await BasketItem.updateMany({ _id: { $in: payment.basketItems }, paymentBatch: payment._id }, { $set: { paymentStatus: 'paid', paidAt: payment.paidAt, razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id } });
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Release a dismissed Razorpay site payment =====
router.post('/site-payment/:id/cancel', protectMember, async (req, res) => {
  try {
    const payment = await SiteBasketPayment.findOneAndUpdate({ _id: req.params.id, member: req.member._id, paymentMethod: 'razorpay', status: 'pending' }, { status: 'cancelled' }, { new: true });
    if (!payment) return res.status(404).json({ success: false, message: 'Pending site payment not found' });
    await BasketItem.updateMany({ _id: { $in: payment.basketItems }, paymentBatch: payment._id }, { $set: { paymentBatch: null } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Check site bank-payment verification =====
router.get('/site-payment/:id', protectMember, async (req, res) => {
  try {
    const payment = await SiteBasketPayment.findOne({ _id: req.params.id, member: req.member._id }).populate('site', 'siteName');
    if (!payment) return res.status(404).json({ success: false, message: 'Site payment not found' });
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== MEMBER: Remove basket item =====
router.delete('/:id', protectMember, async (req, res) => {
  try {
    const item = await BasketItem.findOne({ _id: req.params.id, member: req.member._id });
    if (!item) return res.status(404).json({ success: false, message: 'Basket item not found' });
    if (item.paymentStatus === 'paid' || item.paymentBatch) {
      return res.status(409).json({ success: false, message: 'Paid items or items under payment review cannot be removed' });
    }
    await item.deleteOne();
    res.json({ success: true, message: 'Removed from basket' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Get all basket items =====
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { memberId, status, page = 1, limit = 20, startDate, endDate } = req.query;
    const query = {};
    if (memberId) query.member = memberId;
    if (status) query.adminStatus = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const items = await BasketItem.find(query)
      .populate('member', 'name memberId email phone')
      .populate('product', 'name images')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await BasketItem.countDocuments(query);
    res.json({ success: true, items, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: List site bank payments awaiting verification =====
router.get('/admin/site-payments/pending', protectAdmin, async (req, res) => {
  try {
    const payments = await SiteBasketPayment.find({ status: 'pending', paymentMethod: 'bank_transfer' })
      .populate('member', 'name memberId email phone')
      .populate('site', 'siteName siteLocation')
      .populate({ path: 'basketItems', select: 'productSnapshot variant quantity vendorPrice', populate: { path: 'product', select: 'images' } })
      .sort({ paymentSubmittedAt: 1 });
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Verify a site bank payment and close its basket items =====
router.patch('/admin/site-payments/:id/mark-paid', protectAdmin, async (req, res) => {
  try {
    const payment = await SiteBasketPayment.findOne({ _id: req.params.id, status: 'pending', paymentMethod: 'bank_transfer' });
    if (!payment) return res.status(404).json({ success: false, message: 'Pending site payment not found' });

    payment.status = 'paid';
    payment.paidAt = new Date();
    payment.paymentReviewDeadline = undefined;
    await payment.save();
    await BasketItem.updateMany({ _id: { $in: payment.basketItems }, paymentBatch: payment._id }, {
      $set: { paymentStatus: 'paid', paidAt: payment.paidAt },
    });
    res.json({ success: true, payment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Update basket item status =====
router.put('/admin/:id/status', protectAdmin, async (req, res) => {
  try {
    const { adminStatus, adminStatusMessage } = req.body;
    const item = await BasketItem.findByIdAndUpdate(req.params.id, { adminStatus, adminStatusMessage }, { new: true });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Set vendor price and enable payment =====
router.put('/admin/:id/price', protectAdmin, async (req, res) => {
  try {
    const { vendorPrice, selectedVendorId, paymentEnabled } = req.body;

    // Calculate final price
    const { listPrice, discountPercent, profitPercent, gstPercent, gstType } = vendorPrice;
    const discountAmount = (listPrice * discountPercent) / 100;
    const priceAfterDiscount = listPrice - discountAmount;
    const profitAmount = (priceAfterDiscount * profitPercent) / 100;
    const basePrice = priceAfterDiscount + profitAmount;
    const gstAmount = (basePrice * gstPercent) / 100;
    const finalPrice = basePrice + gstAmount;

    const calculatedPrice = {
      ...vendorPrice,
      discountAmount: +discountAmount.toFixed(2),
      profitAmount: +profitAmount.toFixed(2),
      basePrice: +basePrice.toFixed(2),
      gstAmount: +gstAmount.toFixed(2),
      finalPrice: +finalPrice.toFixed(2),
    };

    const item = await BasketItem.findByIdAndUpdate(req.params.id, {
      vendorPrice: calculatedPrice,
      selectedVendorId,
      pricingSet: true,
      paymentEnabled: paymentEnabled !== undefined ? paymentEnabled : true,
      adminStatus: 'available',
    }, { new: true });

    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Generate vendor form link =====
router.post('/admin/vendor-form', protectAdmin, async (req, res) => {
  try {
    const { basketItemIds } = req.body;
    const token = uuidv4();
    const items = await BasketItem.find({ _id: { $in: basketItemIds } }).populate('product', 'name images');

    // Create vendor entries
    const vendorForms = await Promise.all(items.map(item =>
      Vendor.create({ basketItem: item._id, formToken: `${token}-${item._id}` })
    ));

    const shareLink = `${process.env.CLIENT_URL}/vendor-form/${token}?items=${basketItemIds.join(',')}`;
    res.json({ success: true, shareLink, token, vendorForms });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== VENDOR: Submit price (public route) =====
router.post('/vendor/submit', async (req, res) => {
  try {
    const { formToken, vendorName, vendorEmail, vendorPhone, submittedPrices, basketItemId } = req.body;
    const vendor = await Vendor.findOneAndUpdate(
      { formToken, basketItem: basketItemId },
      { vendorName, vendorEmail, vendorPhone, submittedPrices, submitted: true, submittedAt: new Date() },
      { new: true, upsert: true }
    );
    res.json({ success: true, vendor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Get vendors for a basket item =====
router.get('/admin/:id/vendors', protectAdmin, async (req, res) => {
  try {
    const vendors = await Vendor.find({ basketItem: req.params.id, submitted: true });
    res.json({ success: true, vendors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});





// ===== MEMBER: Update Payment Status =====
router.patch('/:id', protectMember, upload.array('files', 7), async (req, res) => {
  try {
    const updateData = { ...req.body };
    const newFiles = (req.files || []).map(f => ({
      url: `/uploads/basket/${f.filename}`,
      name: f.originalname,
      type: f.mimetype,
    }));

    const item = await BasketItem.findOne({ _id: req.params.id, member: req.member._id });
    if (!item) return res.status(404).json({ success: false, message: 'Basket item not found' });

    if (updateData.paymentStatus !== undefined) {
      if (updateData.paymentStatus !== 'pay_later' || !item.paymentEnabled || !item.pricingSet || item.paymentBatch || item.paymentStatus === 'paid') {
        return res.status(400).json({ success: false, message: 'Payment status can only be changed through the payment flow' });
      }
      item.paymentStatus = 'pay_later';
    }

    if (updateData.quantity !== undefined) {
      const quantity = Number(updateData.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ success: false, message: 'Quantity must be a positive whole number' });
      }
      if (item.paymentStatus === 'paid' || item.paymentBatch) {
        return res.status(409).json({ success: false, message: 'Paid items or items under payment review cannot be changed' });
      }
      const product = await Product.findById(item.product);
      const variant = product?.variants.id(item.variant?.variantId);
      if (!variant) return res.status(404).json({ success: false, message: 'Product variant not found' });
      item.quantity = quantity;
      item.packageBreakdown = calcPackageBreakdown(quantity, variant.tertiaryThreshold, variant.secondaryThreshold, variant.primaryThreshold);
    }

    if (newFiles.length) item.attachments = [...(item.attachments || []), ...newFiles];
    if (updateData.memberNote !== undefined) item.memberNote = updateData.memberNote;

    await item.save();
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ===== MEMBER: Get paid basket orders =====
router.get('/my/orders', protectMember, async (req, res) => {
  try {
    const orders = await BasketItem.find({ member: req.member._id, paymentStatus: 'paid' })
      .populate('product', 'name images')
      .sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== ADMIN: Update member delivery status =====
router.put('/admin/:id/delivery', protectAdmin, async (req, res) => {
  try {
    const { status, message } = req.body;
    const item = await BasketItem.findByIdAndUpdate(req.params.id, {
      deliveryStatus: status,
      $push: { deliveryUpdates: { status, message, updatedAt: new Date() } },
    }, { new: true });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
