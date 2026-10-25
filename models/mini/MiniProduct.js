const mongoose = require('mongoose');

const miniProductSchema = new mongoose.Schema({
  miniUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MiniUser',
    default: null,
  },
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  brandName: {
    type: String,
    default: '',
  },
  categoryName: {
    type: String,
    default: '',
  },
  subCategoryName: {
    type: String,
    default: '',
  },
  hsnCode: {
    type: String,
    default: '',
  },
  accessLevel: {
    type: String,
    enum: ['user', 'member', 'both'],
    default: 'both',
  },
  media: [
    {
      url: String,
      type: {
        type: String,
        enum: ['image', 'video', 'document'],
      },
    },
  ],
  catalogs: [
    {
      url: String,
      name: String,
    },
  ],
  descriptions: [
    {
      heading: String,
      subHeading: String,
      paragraph: String,
    },
  ],
  videoLinks: [
    {
      title: String,
      url: String,
    },
  ],
  tags: {
    type: [String],
    default: [],
  },
  description: {
    type: String,
    default: '',
  },
  unit: {
    type: String,
    default: 'piece',
  },
  qty: {
    type: Number,
    default: 0,
  },
  price: {
    type: Number,
    required: true,
  },
  variants: [
    new mongoose.Schema({
      name: { type: String, trim: true, default: '' },
      date: { type: String, default: '' },
      stock: { type: Number, default: 0 },
      unit: { type: String, default: 'pcs' },
      weight: { type: Number, default: 0 },
      listPrice: { type: Number, default: 0 },
      discountPercent: { type: Number, default: 0 },
      profitPercent: { type: Number, default: 0 },
      gstPercent: { type: Number, default: 18 },
      gstType: { type: String, default: 'CGST+SGST' },
      primaryThreshold: { type: Number, default: 0 },
      primaryThresholdUnit: { type: String, default: 'pcs' },
      secondaryThreshold: { type: Number, default: 0 },
      secondaryThresholdUnit: { type: String, default: 'pcs' },
      tertiaryThreshold: { type: Number, default: 0 },
      tertiaryThresholdUnit: { type: String, default: 'pcs' },
      discountAmount: { type: Number, default: 0 },
      profitAmount: { type: Number, default: 0 },
      basePrice: { type: Number, default: 0 },
      gstAmount: { type: Number, default: 0 },
      finalPrice: { type: Number, default: 0 },
      finalDiscountPercent: { type: Number, default: 0 },
    }),
  ],
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Validation: max 5 media items and 3 catalogues
miniProductSchema.pre('save', function (next) {
  if (this.media && this.media.length > 5) {
    throw new Error('Maximum 5 media items allowed');
  }
  if (this.catalogs && this.catalogs.length > 3) {
    throw new Error('Maximum 3 catalogues allowed');
  }
  next();
});

miniProductSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('MiniProduct', miniProductSchema);
