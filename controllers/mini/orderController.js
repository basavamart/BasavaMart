const MiniOrder = require('../../models/mini/MiniOrder');
const MiniCart = require('../../models/mini/MiniCart');
const MiniProduct = require('../../models/mini/MiniProduct');

// GET: All user's mini orders
const getUserOrders = async (req, res) => {
  try {
    const miniUserId = req.miniUser._id;

    const orders = await MiniOrder.find({ miniUserId })
      .populate({
        path: 'items.productId',
        select: 'productName price unit',
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST: Create a new mini order from cart
const createOrder = async (req, res) => {
  try {
    const miniUserId = req.miniUser._id;
    const { billingAddress, shippingAddress } = req.body;

    if (!billingAddress || !shippingAddress) {
      return res.status(400).json({
        success: false,
        message: 'Billing and shipping addresses are required',
      });
    }

    const cart = await MiniCart.findOne({ miniUserId }).populate('items.productId');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Build order items and calculate subtotal
    let subtotal = 0;
    const orderItems = [];

    for (const cartItem of cart.items) {
      const product = cartItem.productId;
      const itemTotal = product.price * cartItem.qty;
      subtotal += itemTotal;

      orderItems.push({
        productId: product._id,
        name: product.productName,
        qty: cartItem.qty,
        price: product.price,
        unit: product.unit,
      });
    }

    // Calculate GST (server-side)
    const gstRate = 18;
    const gstAmount = Math.round((subtotal * gstRate) / 100);
    const total = subtotal + gstAmount;

    const newOrder = await MiniOrder.create({
      miniUserId,
      items: orderItems,
      subtotal,
      gstRate,
      gstAmount,
      total,
      billingAddress,
      shippingAddress,
      payment: {
        status: 'pending',
      },
      orderStatus: 'placed',
    });

    // Clear cart after order creation
    await MiniCart.findByIdAndUpdate(cart._id, { items: [] });

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: newOrder,
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// GET: Single order details
const getOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const miniUserId = req.miniUser._id;

    const order = await MiniOrder.findOne({
      _id: orderId,
      miniUserId,
    }).populate({
      path: 'items.productId',
      select: 'productName price unit',
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST: Add note to order (user)
const addOrderNote = async (req, res) => {
  try {
    const { orderId } = req.params;
    const miniUserId = req.miniUser._id;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Note message is required' });
    }

    const order = await MiniOrder.findOne({
      _id: orderId,
      miniUserId,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.notes.push({
      sender: 'user',
      message: message.trim(),
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Note added to order',
      data: order,
    });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getUserOrders,
  createOrder,
  getOrder,
  addOrderNote,
};
