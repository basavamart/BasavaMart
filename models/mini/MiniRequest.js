const mongoose = require('mongoose');

const miniRequestSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  media: [
    {
      url: String,
      type: {
        type: String,
        enum: ['image', 'video', 'document'],
      },
      name: String,
    },
  ],
  note: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  qty: {
    type: Number,
    default: 1,
  },
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['new', 'reviewed'],
    default: 'new',
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

// Validation: max 10 media items
miniRequestSchema.pre('save', function (next) {
  if (this.media && this.media.length > 10) {
    throw new Error('Maximum 10 media items allowed');
  }
  next();
});

miniRequestSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('MiniRequest', miniRequestSchema);
