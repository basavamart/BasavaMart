const MiniWishlist = require('../../models/mini/MiniWishlist');
const MiniProduct = require('../../models/mini/MiniProduct');

// GET: Mini user's wishlist
const getWishlist = async (req, res) => {
  try {
    const miniUserId = req.miniUser._id;

    let wishlist = await MiniWishlist.findOne({ miniUserId }).populate({
      path: 'items.productId',
      select: 'productName price unit qty media',
    });

    if (!wishlist) {
      wishlist = await MiniWishlist.create({
        miniUserId,
        items: [],
      });
    }

    res.status(200).json({
      success: true,
      data: wishlist,
    });
  } catch (error) {
    console.error('Error fetching wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST: Add item to wishlist
const addToWishlist = async (req, res) => {
  try {
    const miniUserId = req.miniUser._id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'ProductId is required' });
    }

    const product = await MiniProduct.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let wishlist = await MiniWishlist.findOne({ miniUserId });

    if (!wishlist) {
      wishlist = await MiniWishlist.create({
        miniUserId,
        items: [{ productId }],
      });
    } else {
      const exists = wishlist.items.some(item => item.productId.toString() === productId);

      if (!exists) {
        wishlist.items.push({ productId });
        await wishlist.save();
      }
    }

    const populated = await MiniWishlist.findById(wishlist._id).populate({
      path: 'items.productId',
      select: 'productName price unit qty media',
    });

    res.status(200).json({
      success: true,
      message: 'Item added to wishlist',
      data: populated,
    });
  } catch (error) {
    console.error('Error adding to wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// DELETE: Remove item from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const miniUserId = req.miniUser._id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'ProductId is required' });
    }

    const wishlist = await MiniWishlist.findOne({ miniUserId });

    if (!wishlist) {
      return res.status(404).json({ success: false, message: 'Wishlist not found' });
    }

    wishlist.items = wishlist.items.filter(item => item.productId.toString() !== productId);
    await wishlist.save();

    const populated = await MiniWishlist.findById(wishlist._id).populate({
      path: 'items.productId',
      select: 'productName price unit qty media',
    });

    res.status(200).json({
      success: true,
      message: 'Item removed from wishlist',
      data: populated,
    });
  } catch (error) {
    console.error('Error removing from wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
};
