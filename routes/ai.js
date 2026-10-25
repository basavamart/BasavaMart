const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Note: AI features use Anthropic API (set ANTHROPIC_API_KEY in .env)
// For now implemented with smart logic + optional LLM integration

// Smart product search with suggestions
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, suggestions: [] });

    const products = await Product.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
        { hsnCode: { $regex: q, $options: 'i' } },
      ],
      status: 'published',
    })
      .populate('brand', 'name')
      .select('name brand images variants')
      .limit(10);

    const suggestions = products.map(p => ({
      id: p._id,
      name: p.name,
      brand: p.brand?.name,
      image: p.images[0] || '',
      minPrice: Math.min(...p.variants.map(v => v.finalPrice || 0)),
    }));

    res.json({ success: true, suggestions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// AI product description generator
router.post('/generate-description', async (req, res) => {
  try {
    const { productName, category, brand, keywords } = req.body;
    // Structured description generation
    const descriptions = [
      {
        heading: `${productName} — Premium Quality`,
        subHeading: `Trusted by ${brand} | Category: ${category}`,
        paragraph: `Experience the finest quality with our ${productName}. Carefully crafted to meet the highest standards, this product delivers exceptional performance and reliability. ${keywords ? `Key features include: ${keywords}.` : ''} Perfect for both personal and professional use.`,
      },
      {
        heading: 'Product Specifications',
        subHeading: 'Detailed Technical Information',
        paragraph: `Our ${productName} comes with superior build quality and is designed for longevity. Available in multiple variants to suit your specific requirements.`,
      },
    ];

    // Auto-generate tags
    const tags = [productName.toLowerCase(), category?.toLowerCase(), brand?.toLowerCase(), ...(keywords?.split(',').map(k => k.trim().toLowerCase()) || [])].filter(Boolean);

    res.json({ success: true, descriptions, tags });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Smart price recommendation
router.post('/price-recommendation', async (req, res) => {
  try {
    const { productName, category, listPrice, competitors } = req.body;

    // Find similar products for reference
    const similar = await Product.find({
      category,
      status: 'published',
    }).select('variants').limit(10);

    const allPrices = similar.flatMap(p => p.variants.map(v => v.finalPrice)).filter(Boolean);
    const avgPrice = allPrices.length ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : listPrice;

    const recommendation = {
      suggestedDiscount: listPrice > avgPrice * 1.2 ? 15 : 10,
      suggestedProfit: 12,
      suggestedGst: 18,
      competitivePrice: +(avgPrice * 0.95).toFixed(2),
      marketAverage: +avgPrice.toFixed(2),
      insight: listPrice > avgPrice
        ? `Your list price is above market average. Consider a ${Math.round((listPrice - avgPrice) / avgPrice * 100)}% discount to stay competitive.`
        : `Your list price is competitive. A standard 10% discount and 12% profit margin is recommended.`,
    };

    res.json({ success: true, recommendation });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// AI chatbot for users
router.post('/chatbot', async (req, res) => {
  try {
    const { message, context } = req.body;
    const lowerMsg = message.toLowerCase();

    let response = '';

    if (lowerMsg.includes('order') && lowerMsg.includes('track')) {
      response = 'To track your order, go to My Orders page and click on your order to see real-time delivery status updates.';
    } else if (lowerMsg.includes('return') || lowerMsg.includes('refund')) {
      response = 'For returns and refunds, please contact our support team via the Report/Query section in your profile page.';
    } else if (lowerMsg.includes('payment') || lowerMsg.includes('pay')) {
      response = 'We accept payments via Razorpay (Credit/Debit Cards, UPI, Net Banking). You can also choose Pay Later option and pay when convenient.';
    } else if (lowerMsg.includes('membership') || lowerMsg.includes('member')) {
      response = 'To become a member, visit the Membership section in your profile. Submit your application and our team will review and provide you with member credentials.';
    } else if (lowerMsg.includes('delivery') || lowerMsg.includes('shipping')) {
      response = 'Delivery timelines vary by product and location. You can track your delivery status in real-time from the My Orders page.';
    } else if (lowerMsg.includes('invoice') || lowerMsg.includes('bill')) {
      response = 'Invoices are available for download from the My Orders page after your payment is confirmed.';
    } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
      response = `Hello! Welcome to Basava Mart. I'm here to help you with product queries, order tracking, payments, and more. What can I help you with?`;
    } else {
      // Search for relevant products
      const products = await Product.find({
        $text: { $search: message },
        status: 'published',
        accessLevel: { $in: ['user', 'both'] },
      }).limit(3).select('name brand').populate('brand', 'name');

      if (products.length) {
        response = `I found these products that might interest you: ${products.map(p => p.name).join(', ')}. You can search for them in our product catalog.`;
      } else {
        response = `I'm not sure about that. You can browse our products, or contact support via the Query section in your profile. Is there anything else I can help you with?`;
      }
    }

    res.json({ success: true, response });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Auto-tag generation
router.post('/generate-tags', async (req, res) => {
  try {
    const { productName, description, category, subcategory, brand } = req.body;
    const text = `${productName} ${description} ${category} ${subcategory} ${brand}`;
    const words = text.toLowerCase().split(/\s+/)
      .filter(w => w.length > 3)
      .filter(w => !['with', 'from', 'this', 'that', 'have', 'will', 'been', 'were', 'they', 'their', 'than', 'then', 'when', 'also', 'into', 'your', 'more', 'very', 'just', 'each', 'both', 'come', 'does', 'made', 'most', 'some'].includes(w));

    const uniqueTags = [...new Set(words)].slice(0, 15);
    res.json({ success: true, tags: uniqueTags });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
