const mongoose = require('mongoose');

// Ad model
const adSchema = new mongoose.Schema({
  name: { type: String, required: true },
  files: [{ type: String }],
  description: String,
  heading: String,
  title: String,
  externalLink: String,
  mobileNumber: String,
  placement: { type: String, enum: ['top', 'bottom', 'left', 'right'], required: true },
  behavior: { type: String, enum: ['skippable', 'fixed'], default: 'skippable' },
  status: { type: String, enum: ['published', 'draft'], default: 'published' },
  displayOrder: { type: Number, default: 0 },
}, { timestamps: true });

// Settings model
const settingsSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: mongoose.Schema.Types.Mixed,
  updatedAt: { type: Date, default: Date.now },
});

// Report/Query model
const reportSchema = new mongoose.Schema({
  submittedBy: {
    userId: mongoose.Schema.Types.ObjectId,
    memberId: mongoose.Schema.Types.ObjectId,
    name: String,
    email: String,
    phone: String,
    panelType: { type: String, enum: ['user', 'member'] },
  },
  type: { type: String, enum: ['spam', 'query', 'report'], required: true },
  subject: String,
  message: String,
  status: { type: String, enum: ['open', 'resolved', 'closed'], default: 'open' },
  adminResponse: String,
  adminRespondedAt: Date,
}, { timestamps: true });

// Site model (member)
const siteSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  siteName: String,
  siteLocation: String,
  timeline: String,
  estimatedBudget: Number,
  notes: String,
  selectedProducts: [{
    productId: mongoose.Schema.Types.ObjectId,
    productName: String,
    source: { type: String, enum: ['basket', 'order'] },
    sourceId: mongoose.Schema.Types.ObjectId,
  }],
  status: { type: String, enum: ['submitted', 'in_review', 'approved', 'in_progress', 'completed', 'cancelled'], default: 'submitted' },
  statusUpdates: [{
    status: String,
    note: String,
    updatedAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

// Membership Application (separate from user schema for admin view)
const membershipApplicationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: String,
  userEmail: String,
  userPhone: String,
  businessName: String,
  gstNumber: String,
  address: String,
  phone: String,
  status: { type: String, enum: ['pending', 'on_hold', 'approved', 'rejected'], default: 'pending' },
  approvedMemberId: String,
  approvedPassword: String, // plain text before member creation, then cleared
  adminNote: String,
  processedAt: Date,
}, { timestamps: true });

const Ad = mongoose.model('Ad', adSchema);
const Settings = mongoose.model('Settings', settingsSchema);
const Report = mongoose.model('Report', reportSchema);
const Site = mongoose.model('Site', siteSchema);
const MembershipApplication = mongoose.model('MembershipApplication', membershipApplicationSchema);

module.exports = { Ad, Settings, Report, Site, MembershipApplication };
