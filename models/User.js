const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: { type: String, sparse: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  avatar: { type: String, default: '' },
  authProvider: { type: String, enum: ['google'], default: 'google' },
  phone: { type: String, default: '' },
  lastLoginAt: { type: Date, default: null },
  lastSeenAt: { type: Date, default: null },
  isOnline: { type: Boolean, default: false },
  cartSnapshot: {
    items: [{
      productId: String,
      variantId: String,
      name: String,
      variantName: String,
      quantity: Number,
      price: Number,
    }],
    itemCount: { type: Number, default: 0 },
    totalAmount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: null },
  },
  loginHistory: [{
    loginAt: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
  }],
  addresses: [{
    type: { type: String, enum: ['billing', 'shipping'], default: 'billing' },
    name: String,
    mobile: String,
    email: String,
    addressLine1: String,
    addressLine2: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false },
  }],
  recentViews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  membershipStatus: {
    type: String,
    enum: ['none', 'pending', 'approved', 'rejected'],
    default: 'none',
  },
  membershipApplication: {
    businessName: String,
    gstNumber: String,
    address: String,
    phone: String,
    submittedAt: Date,
  },
  isActive: { type: Boolean, default: true },
  broadcastRead: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Settings' }],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
