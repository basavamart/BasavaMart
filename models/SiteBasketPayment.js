const mongoose = require('mongoose');

const siteBasketPaymentSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  site: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  basketItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'BasketItem', required: true }],
  amount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['bank_transfer', 'razorpay'], default: 'bank_transfer' },
  status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
  paymentProof: {
    url: String,
    originalName: String,
    uploadedAt: Date,
  },
  paymentSubmittedAt: Date,
  paymentReviewDeadline: Date,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  paidAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('SiteBasketPayment', siteBasketPaymentSchema);