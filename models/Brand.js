const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  logo: { type: String, default: '' },
  status: { type: String, enum: ['published', 'draft', 'hold'], default: 'published' },
  accessLevel: { type: String, enum: ['user', 'member', 'both'], default: 'both' },
  description: { type: String, default: '' },
  order: { type: Number, default: 0 },
  totalProducts: { type: Number, default: 0 },
  totalOrders: { type: Number, default: 0 },
  totalRevenue: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
}, { timestamps: true });

module.exports = mongoose.model('Brand', brandSchema);
