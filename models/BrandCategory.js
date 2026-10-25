const mongoose = require('mongoose');

const brandCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true },
  description: { type: String, default: '', trim: true, maxlength: 1000 },
  icon: { type: String, required: true },
  brands: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Brand' }],
  status: { type: String, enum: ['published', 'draft'], default: 'published' },
  order: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('BrandCategory', brandCategorySchema);
