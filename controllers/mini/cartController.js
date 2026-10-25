const MiniCart = require('../../models/mini/MiniCart');
const MiniProduct = require('../../models/mini/MiniProduct');

// GET: Mini user's cart
const getCart = async (req, res) => {
  try {
    const miniUserId = req.miniUser._id;

    let cart = await MiniCart.findOne({ miniUserId }).populate({
      path: 'items.productId',
      select: 'productName description brandName categoryName price unit qty media miniUserId status',
    });

    if (cart) {
      cart.items = cart.items.filter((item) => item.productId &&
        String(item.productId.miniUserId) === String(miniUserId) &&
        item.productId.status === 'published');
    }

    if (!cart) {
      // Create empty cart if doesn't exist
      cart = await MiniCart.create({
        miniUserId,
        items: [],
      });
    }

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    console.error('Error fetching cart:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST: Add item to cart
const addToCart = async (req, res) => {
  try {
    const miniUserId = req.miniUser._id;
    const { productId, qty } = req.body;

    if (!productId || !qty || qty < 1) {
      return res.status(400).json({ success: false, message: 'Invalid product or quantity' });
    }

    // Verify product exists
    const product = await MiniProduct.findOne({
      _id: productId,
      miniUserId,
      status: 'published',
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    let cart = await MiniCart.findOne({ miniUserId });

    if (!cart) {
      cart = await MiniCart.create({
        miniUserId,
        items: [{ productId, qty }],
      });
    } else {
      const existingItem = cart.items.find(item => item.productId.toString() === productId);

      if (existingItem) {
        existingItem.qty += qty;
      } else {
        cart.items.push({ productId, qty });
      }

      await cart.save();
    }

    const populated = await MiniCart.findById(cart._id).populate({
      path: 'items.productId',
      select: 'productName description brandName categoryName price unit qty media',
    });

    res.status(200).json({
      success: true,
      message: 'Item added to cart',
      data: populated,
    });
  } catch (error) {
    console.error('Error adding to cart:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// PUT: Update cart item quantity
const updateCartItem = async (req, res) => {
  try {
    const miniUserId = req.miniUser._id;
    const { productId, qty } = req.body;

    if (!productId || !qty) {
      return res.status(400).json({ success: false, message: 'ProductId and quantity are required' });
    }

    if (qty < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const cart = await MiniCart.findOne({ miniUserId });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const item = cart.items.find(i => i.productId.toString() === productId);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not in cart' });
    }

    item.qty = qty;
    await cart.save();

    const populated = await MiniCart.findById(cart._id).populate({
      path: 'items.productId',
      select: 'productName description brandName categoryName price unit qty media',
    });

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      data: populated,
    });
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// DELETE: Remove item from cart
const removeFromCart = async (req, res) => {
  try {
    const miniUserId = req.miniUser._id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'ProductId is required' });
    }

    const cart = await MiniCart.findOne({ miniUserId });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = cart.items.filter(item => item.productId.toString() !== productId);
    await cart.save();

    const populated = await MiniCart.findById(cart._id).populate({
      path: 'items.productId',
      select: 'productName description brandName categoryName price unit qty media',
    });

    res.status(200).json({
      success: true,
      message: 'Item removed from cart',
      data: populated,
    });
  } catch (error) {
    console.error('Error removing from cart:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// DELETE: Clear entire cart
const clearCart = async (req, res) => {
  try {
    const miniUserId = req.miniUser._id;

    const cart = await MiniCart.findOne({ miniUserId });

    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    cart.items = [];
    await cart.save();

    res.status(200).json({
      success: true,
      message: 'Cart cleared',
      data: cart,
    });
  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
