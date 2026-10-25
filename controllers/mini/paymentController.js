const Razorpay = require('razorpay');
const crypto = require('crypto');
const MiniOrder = require('../../models/mini/MiniOrder');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST: Create Razorpay order for mini order
const createRazorpayOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const miniUserId = req.miniUser._id;

    const order = await MiniOrder.findOne({
      _id: orderId,
      miniUserId,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.payment.status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Order is already paid',
      });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: order.total * 100, // Amount in paise
      currency: 'INR',
      receipt: `mini-${order._id}`,
      notes: {
        orderId: order._id.toString(),
        miniUserId: miniUserId.toString(),
      },
    });

    // Store Razorpay order ID in order document
    order.payment.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Razorpay order created',
      razorpayOrder: {
        id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
      },
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

// POST: Verify Razorpay payment
const verifyPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const miniUserId = req.miniUser._id;
    const { razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body;

    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification details',
      });
    }

    // Verify signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment signature verification failed',
      });
    }

    // Find and update order
    const order = await MiniOrder.findOne({
      _id: orderId,
      miniUserId,
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.payment.razorpayPaymentId = razorpayPaymentId;
    order.payment.razorpaySignature = razorpaySignature;
    order.payment.status = 'paid';
    order.orderStatus = 'processing';

    await order.save();

    res.status(200).json({
      success: true,
      message: 'Payment verified and order updated',
      data: order,
    });
  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
};

module.exports = {
  createRazorpayOrder,
  verifyPayment,
};
