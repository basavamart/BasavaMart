const mongoose = require('mongoose');

const miniCartSchema = new mongoose.Schema({
  miniUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MiniUser',
    required: true,
    unique: true,
  },
  items: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MiniProduct',
        required: true,
      },
      qty: {
        type: Number,
        required: true,
        min: 1,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

miniCartSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('MiniCart', miniCartSchema);
