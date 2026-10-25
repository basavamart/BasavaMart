const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const memberSchema = new mongoose.Schema({
  memberId: { type: String, unique: true }, // e.g. BM001
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String },
  phone: { type: String },
  reference1: { type: String, default: '' },
  reference2: { type: String, default: '' },
  memberImage: { type: String, default: '' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // original user who applied
  status: { type: String, enum: ['active', 'suspended', 'inactive'], default: 'active' },

  // Business profile
  businessProfile: {
    companyName: String,
    companyLogoText: String,
    companyLogo: String,
    companyDescription: String,
    gstCertificate: String,
    aadhaarCard: String,
    gstNumber: String,
    address: String,
  },

  addresses: [{
    type: { type: String, enum: ['billing', 'shipping'] },
    name: String, mobile: String, email: String,
    addressLine1: String, addressLine2: String,
    city: String, state: String, pincode: String,
    country: { type: String, default: 'India' },
    isDefault: { type: Boolean, default: false },
  }],

  recentViews: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

memberSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

memberSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Member', memberSchema);
