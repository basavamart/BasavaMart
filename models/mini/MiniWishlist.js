const mongoose = require('mongoose');

const miniWishlistSchema = new mongoose.Schema({
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

miniWishlistSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: Date.now() });
  next();
});

module.exports = mongoose.model('MiniWishlist', miniWishlistSchema);
