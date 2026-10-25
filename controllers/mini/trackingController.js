const MiniOrder = require('../../models/mini/MiniOrder');
const MiniCart = require('../../models/mini/MiniCart');
const MiniWishlist = require('../../models/mini/MiniWishlist');
const MiniUser = require('../../models/mini/MiniUser');

// GET: Tracking dashboard for one mini user (admin only)
const getTrackingDashboard = async (req, res) => {
  try {
    const { userId } = req.params;

    const [user, cart, wishlist, orders] = await Promise.all([
      MiniUser.findById(userId).select('miniId name phone email address status createdAt').lean(),
      MiniCart.findOne({ miniUserId: userId }).populate({
        path: 'items.productId',
        select: 'productName description brandName categoryName price unit qty media status',
      }),
      MiniWishlist.findOne({ miniUserId: userId }).populate({
        path: 'items.productId',
        select: 'productName description brandName categoryName price unit qty media status',
      }),
      MiniOrder.find({ miniUserId: userId })
        .populate({
          path: 'items.productId',
          select: 'productName description brandName categoryName price unit qty media status',
        })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const tracking = {
      user: user || null,
      cart: cart || { items: [] },
      wishlist: wishlist || { items: [] },
      orders: orders || [],
      summary: {
        totalOrders: orders.length,
        totalSpent: orders.reduce((sum, order) => sum + (order.total || 0), 0),
        pendingOrders: orders.filter(o => o.orderStatus !== 'delivered' && o.orderStatus !== 'cancelled').length,
        paidOrders: orders.filter(o => o.payment && o.payment.status === 'paid').length,
      },
    };

    res.status(200).json({
      success: true,
      data: tracking,
    });
  } catch (error) {
    console.error('Error fetching tracking dashboard:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST: Admin reply to order note
const addAdminNote = async (req, res) => {
  try {
    const { userId, orderId } = req.params;
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Note message is required' });
    }

    const order = await MiniOrder.findOne({
      _id: orderId,
      miniUserId: userId,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.notes.push({
      sender: 'admin',
      message: message.trim(),
    });

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Admin note added to order',
      data: order,
    });
  } catch (error) {
    console.error('Error adding admin note:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  getTrackingDashboard,
  addAdminNote,
};
