const express = require('express');
const router = express.Router();
const { Vendor } = require('../models/Basket');
const { BasketItem } = require('../models/Basket');

// Public: get vendor form info (by token + item ids)
router.get('/form/:token', async (req, res) => {
  try {
    const requestVendor = await Vendor.findOne({ formToken: req.params.token })
      .populate({ path: 'miniRequest', select: 'productName qty description note media' });

    if (requestVendor?.miniRequest) {
      return res.json({
        success: true,
        mode: 'request',
        request: requestVendor.miniRequest,
      });
    }

    const { items } = req.query;
    const itemIds = items ? items.split(',') : [];
    const basketItems = await BasketItem.find({ _id: { $in: itemIds } })
      .populate('product', 'name images')
      .select('productSnapshot variant quantity product');
    res.json({ success: true, basketItems });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public: submit vendor price
router.post('/submit', async (req, res) => {
  try {
    const { formToken, vendorName, vendorEmail, vendorPhone, prices } = req.body;

    const requestVendor = await Vendor.findOne({ formToken, miniRequest: { $exists: true, $ne: null } });
    if (requestVendor) {
      const price = prices?.[0];
      if (!price?.pricePerUnit || price.pricePerUnit <= 0) {
        return res.status(400).json({ success: false, message: 'Please enter a valid price' });
      }

      const pricePerUnit = Number(price.pricePerUnit);
      const gstPercent = Number(price.gstPercent) || 0;
      const finalPrice = +(pricePerUnit + (pricePerUnit * gstPercent) / 100).toFixed(2);
      requestVendor.vendorName = vendorName;
      requestVendor.vendorEmail = vendorEmail;
      requestVendor.vendorPhone = vendorPhone;
      requestVendor.submittedPrices = [{
        pricePerUnit,
        gstPercent,
        gstType: price.gstType || 'CGST+SGST',
        finalPrice,
      }];
      requestVendor.submitted = true;
      requestVendor.submittedAt = new Date();
      await requestVendor.save();
      return res.json({ success: true, vendor: requestVendor });
    }

    const results = [];
    for (const price of prices) {
      const { basketItemId, ...priceData } = price;
      const vendor = await Vendor.findOneAndUpdate(
        { formToken: `${formToken}-${basketItemId}`, basketItem: basketItemId },
        { vendorName, vendorEmail, vendorPhone, submittedPrices: priceData, submitted: true, submittedAt: new Date() },
        { new: true, upsert: true }
      );
      results.push(vendor);
    }
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
