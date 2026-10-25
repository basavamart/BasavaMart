const mongoose = require('mongoose');

const packageBreakdownSchema = new mongoose.Schema({
  tertiary: { qty: Number, count: Number, total: Number },
  secondary: { qty: Number, count: Number, total: Number },
  primary: { qty: Number, count: Number, total: Number },
  remainder: { count: Number },
});

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: String,
  productImage: String,
  brandName: String,
  categoryName: String,
  variant: {
    variantId: mongoose.Schema.Types.ObjectId,
    name: String,
    unit: String,
    weight: Number,
    listPrice: Number,
    discountPercent: Number,
    discountAmount: Number,
    gstPercent: Number,
    gstType: String,
    gstAmount: Number,
    finalPrice: Number,
  },
  quantity: { type: Number, required: true },
  itemTotal: { type: Number, required: true },
  packageBreakdown: packageBreakdownSchema,
});

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userEmail: String,
  userPhone: String,

  items: [orderItemSchema],

  billingAddress: {
    name: String, mobile: String, email: String,
    addressLine1: String, addressLine2: String,
    city: String, state: String, pincode: String, country: String,
  },
  shippingAddress: {
    name: String, mobile: String, email: String,
    addressLine1: String, addressLine2: String,
    city: String, state: String, pincode: String, country: String,
  },

  subtotal: { type: Number, default: 0 },
  totalDiscount: { type: Number, default: 0 },
  totalGst: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },

  paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  paymentMethod: { type: String, enum: ['razorpay', 'pay_later', 'bank_transfer'], default: 'razorpay' },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  paymentProof: {
    url: String,
    originalName: String,
    uploadedAt: Date,
  },
  paymentSubmittedAt: Date,
  paymentReviewDeadline: Date,
  paidAt: Date,

  deliveryStatus: {
    type: String,
    enum: ['order_placed', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'],
    default: 'order_placed',
  },
  deliveryUpdates: [{
    status: String,
    message: String,
    adminNote: String,
    updatedAt: { type: Date, default: Date.now },
  }],

  adminNotes: String,
  invoicePath: String,
}, { timestamps: true });

// Auto-generate order number
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `BM-ORD-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
