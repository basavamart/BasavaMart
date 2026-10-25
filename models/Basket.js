const mongoose = require('mongoose');

// Member Basket Item
const basketItemSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', default: null },
  paymentBatch: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteBasketPayment', default: null },
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productSnapshot: {
    name: String,
    image: String,
    brandName: String,
    categoryName: String,
    subcategoryName: String,
  },
  variant: {
    variantId: mongoose.Schema.Types.ObjectId,
    name: String,
    unit: String,
    weight: Number,
  },
  quantity: { type: Number, default: 1 },

  adminStatus: {
    type: String,
    enum: ['pending', 'available', 'not_available', 'give_time', '7_days', '15_days'],
    default: 'pending',
  },
  adminStatusMessage: { type: String, default: '' },

  // Price set by admin after vendor selection
  pricingSet: { type: Boolean, default: false },
  vendorPrice: {
    listPrice: Number,
    discountPercent: Number,
    profitPercent: Number,
    gstPercent: Number,
    gstType: { type: String, enum: ['CGST+SGST', 'IGST'] },
    basePrice: Number,
    discountAmount: Number,
    profitAmount: Number,
    gstAmount: Number,
    finalPrice: Number,
    weight: Number,
    stock: Number,
  },
  selectedVendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },

  paymentEnabled: { type: Boolean, default: false },
  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'pay_later'], default: 'pending' },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  paidAt: Date,

  packageBreakdown: {
    tertiary: { qty: Number, count: Number, total: Number },
    secondary: { qty: Number, count: Number, total: Number },
    primary: { qty: Number, count: Number, total: Number },
    remainder: { count: Number },
  },
attachments: [{
  url: String,
  name: String,
  fileType: String,
}],
memberNote: { type: String, default: '' },

  deliveryStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
  },
  deliveryUpdates: [{
    status: String,
    message: String,
    updatedAt: { type: Date, default: Date.now },
  }],

  invoicePath: String,
  orderNumber: String,
}, { timestamps: true });

// Vendor model (for basket pricing)
const vendorSchema = new mongoose.Schema({
  basketItem: { type: mongoose.Schema.Types.ObjectId, ref: 'BasketItem' },
  miniRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'MiniRequest' },
  formToken: { type: String, unique: true },
  vendorName: String,
  vendorEmail: String,
  vendorPhone: String,
  submittedPrices: [{
    variantId: mongoose.Schema.Types.ObjectId,
    variantName: String,
    pricePerUnit: Number,
    gstPercent: Number,
    gstType: String,
    finalPrice: Number,
  }],
  submitted: { type: Boolean, default: false },
  submittedAt: Date,
}, { timestamps: true });

const BasketItem = mongoose.model('BasketItem', basketItemSchema);
const Vendor = mongoose.model('Vendor', vendorSchema);

module.exports = { BasketItem, Vendor };
