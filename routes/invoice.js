const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const Order = require('../models/Order');
const { BasketItem } = require('../models/Basket');
const { Settings } = require('../models/Misc');
const { protectUser, protectMember, protectAdmin } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

const PRIMARY_COLOR = '#e26a26';

async function getSettings() {
  const settings = await Settings.find({ key: { $in: ['invoiceDetails', 'logo', 'logoText'] } });
  const result = {};
  settings.forEach(s => { result[s.key] = s.value; });
  return result;
}

function drawHeader(doc, settings, orderNumber) {
  // Logo area
  doc.rect(0, 0, doc.page.width, 100).fill('#f8f8f8');
  doc.fillColor(PRIMARY_COLOR).fontSize(24).font('Helvetica-Bold').text(settings.logoText || 'Basava Mart', 40, 30);
  doc.fillColor('#666').fontSize(10).font('Helvetica').text('Your Trusted Shopping Partner', 40, 58);

  // Invoice title
  doc.fillColor(PRIMARY_COLOR).fontSize(18).font('Helvetica-Bold').text('TAX INVOICE', 380, 30, { align: 'right', width: 175 });
  doc.fillColor('#333').fontSize(10).font('Helvetica').text(`Invoice #: ${orderNumber}`, 380, 58, { align: 'right', width: 175 });
  doc.fillColor('#333').fontSize(10).text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 380, 72, { align: 'right', width: 175 });

  // Divider
  doc.moveTo(40, 105).lineTo(555, 105).strokeColor(PRIMARY_COLOR).lineWidth(2).stroke();
}

function drawCompanyInfo(doc, settings) {
  const inv = settings.invoiceDetails || {};
  doc.moveDown(0.5);
  doc.fillColor('#333').fontSize(9).font('Helvetica-Bold').text('From:', 40, 115);
  doc.font('Helvetica').text(inv.companyName || 'Basava Mart', 40, 128);
  doc.text(inv.address || 'Address', 40, 140);
  doc.text(`GSTIN: ${inv.gstin || 'N/A'}`, 40, 152);
  doc.text(`Email: ${inv.email || 'support@basavamart.com'}`, 40, 164);
  doc.text(`Phone: ${inv.phone || ''}`, 40, 176);
}

function drawBillingInfo(doc, billingAddress) {
  doc.fillColor('#333').fontSize(9).font('Helvetica-Bold').text('Bill To:', 300, 115);
  doc.font('Helvetica').text(billingAddress.name || '', 300, 128);
  doc.text(`${billingAddress.addressLine1 || ''} ${billingAddress.addressLine2 || ''}`, 300, 140);
  doc.text(`${billingAddress.city || ''}, ${billingAddress.state || ''} - ${billingAddress.pincode || ''}`, 300, 152);
  doc.text(`Phone: ${billingAddress.mobile || ''}`, 300, 164);
  doc.text(`Email: ${billingAddress.email || ''}`, 300, 176);
}

function drawItemsTable(doc, items, startY) {
  const cols = { sno: 40, name: 75, variant: 205, qty: 295, price: 335, disc: 378, gst: 420, total: 465 };

  // Table header
  doc.rect(40, startY, 515, 22).fill(PRIMARY_COLOR);
  doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold');
  doc.text('S.No', cols.sno, startY + 7);
  doc.text('Product', cols.name, startY + 7);
  doc.text('Variant', cols.variant, startY + 7);
  doc.text('Qty', cols.qty, startY + 7);
  doc.text('Price', cols.price, startY + 7);
  doc.text('Disc', cols.disc, startY + 7);
  doc.text('GST', cols.gst, startY + 7);
  doc.text('Total', cols.total, startY + 7);

  let y = startY + 22;
  items.forEach((item, i) => {
    const rowHeight = 32;
    if (i % 2 === 0) doc.rect(40, y, 515, rowHeight).fill('#fafafa');
    doc.fillColor('#333').fontSize(7.5).font('Helvetica');
    doc.text(String(i + 1), cols.sno, y + 5);
    doc.text(item.productName?.substring(0, 18) || '', cols.name, y + 5, { width: 125 });
    doc.text(item.variant?.name?.substring(0, 15) || '', cols.variant, y + 5, { width: 85 });
    doc.text(String(item.quantity), cols.qty, y + 5);
    doc.text(`₹${item.variant?.listPrice?.toFixed(2) || '0.00'}`, cols.price, y + 5);
    doc.text(`${item.variant?.discountPercent || 0}%`, cols.disc, y + 5);
    doc.text(`${item.variant?.gstPercent || 0}% (${item.variant?.gstType || ''})`, cols.gst, y + 5, { width: 42 });
    doc.text(`₹${item.itemTotal?.toFixed(2) || '0.00'}`, cols.total, y + 5);

    // Package breakdown
    const pb = item.packageBreakdown;
    if (pb) {
      let pbText = [];
      if (pb.tertiary?.count > 0) pbText.push(`${pb.tertiary.count}×${pb.tertiary.qty}`);
      if (pb.secondary?.count > 0) pbText.push(`${pb.secondary.count}×${pb.secondary.qty}`);
      if (pb.primary?.count > 0) pbText.push(`${pb.primary.count}×${pb.primary.qty}`);
      if (pb.remainder?.count > 0) pbText.push(`${pb.remainder.count} loose`);
      if (pbText.length) {
        doc.fillColor('#888').fontSize(6.5).text(`Pkg: ${pbText.join(' + ')}`, cols.name, y + 18, { width: 250 });
      }
    }

    doc.moveTo(40, y + rowHeight).lineTo(555, y + rowHeight).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
    y += rowHeight;
  });

  return y;
}

function drawTotals(doc, order, y) {
  y += 10;
  const labelX = 380, valueX = 490;

  doc.fillColor('#333').fontSize(9).font('Helvetica');
  doc.text('Subtotal:', labelX, y); doc.text(`₹${order.subtotal?.toFixed(2) || '0.00'}`, valueX, y, { align: 'right', width: 65 });
  y += 16;
  doc.text('Discount:', labelX, y); doc.fillColor('green').text(`- ₹${order.totalDiscount?.toFixed(2) || '0.00'}`, valueX, y, { align: 'right', width: 65 });
  y += 16;
  doc.fillColor('#333').text('GST:', labelX, y); doc.text(`₹${order.totalGst?.toFixed(2) || '0.00'}`, valueX, y, { align: 'right', width: 65 });
  y += 5;

  doc.moveTo(380, y + 5).lineTo(555, y + 5).strokeColor(PRIMARY_COLOR).lineWidth(1.5).stroke();
  y += 14;

  doc.fillColor(PRIMARY_COLOR).fontSize(12).font('Helvetica-Bold');
  doc.text('TOTAL:', labelX, y);
  doc.text(`₹${order.totalAmount?.toFixed(2) || '0.00'}`, valueX, y, { align: 'right', width: 65 });

  return y + 30;
}

function drawFooter(doc, settings) {
  const inv = settings.invoiceDetails || {};
  const y = doc.page.height - 60;
  doc.moveTo(40, y - 10).lineTo(555, y - 10).strokeColor('#ddd').lineWidth(1).stroke();
  doc.fillColor('#888').fontSize(8).font('Helvetica').text(inv.footer || 'Thank you for shopping with Basava Mart! For queries, contact support@basavamart.com', 40, y, { align: 'center', width: 515 });
  doc.text('This is a computer generated invoice and does not require a signature.', 40, y + 14, { align: 'center', width: 515 });
}

// Generate invoice for user order
router.get('/user/:orderId', protectUser, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.paymentStatus !== 'paid') return res.status(403).json({ success: false, message: 'Invoice available only for paid orders' });

    const settings = await getSettings();
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
    doc.pipe(res);

    drawHeader(doc, settings, order.orderNumber);
    drawCompanyInfo(doc, settings);
    drawBillingInfo(doc, order.billingAddress);

    let y = 200;
    doc.moveTo(40, y).lineTo(555, y).strokeColor('#ddd').lineWidth(1).stroke();
    y += 10;

    y = drawItemsTable(doc, order.items, y);
    y = drawTotals(doc, order, y);
    drawFooter(doc, settings);
    doc.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Generate invoice for member basket order
router.get('/member/:basketItemId', protectMember, async (req, res) => {
  try {
    const item = await BasketItem.findOne({ _id: req.params.basketItemId, member: req.member._id })
      .populate('product', 'name images brand category')
      .populate({ path: 'product', populate: { path: 'brand', select: 'name' } });

    if (!item) return res.status(404).json({ success: false, message: 'Order not found' });
    if (item.paymentStatus !== 'paid') return res.status(403).json({ success: false, message: 'Invoice available only for paid orders' });

    const settings = await getSettings();
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${item.orderNumber}.pdf`);
    doc.pipe(res);

    const fakeOrder = {
      orderNumber: item.orderNumber,
      subtotal: item.vendorPrice?.listPrice * item.quantity || 0,
      totalDiscount: item.vendorPrice?.discountAmount * item.quantity || 0,
      totalGst: item.vendorPrice?.gstAmount * item.quantity || 0,
      totalAmount: item.vendorPrice?.finalPrice * item.quantity || 0,
      billingAddress: req.member.addresses?.find(a => a.isDefault) || {},
    };

    const fakeItems = [{
      productName: item.productSnapshot?.name,
      variant: { name: item.variant?.name, listPrice: item.vendorPrice?.listPrice, discountPercent: item.vendorPrice?.discountPercent, gstPercent: item.vendorPrice?.gstPercent, gstType: item.vendorPrice?.gstType },
      quantity: item.quantity,
      itemTotal: (item.vendorPrice?.finalPrice || 0) * item.quantity,
      packageBreakdown: item.packageBreakdown,
    }];

    drawHeader(doc, settings, fakeOrder.orderNumber || 'MEMBER-ORDER');
    drawCompanyInfo(doc, settings);
    drawBillingInfo(doc, fakeOrder.billingAddress);
    doc.moveTo(40, 200).lineTo(555, 200).strokeColor('#ddd').lineWidth(1).stroke();
    const y = drawItemsTable(doc, fakeItems, 210);
    drawTotals(doc, fakeOrder, y);
    drawFooter(doc, settings);
    doc.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: download invoice for any order
router.get('/admin/order/:orderId', protectAdmin, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const settings = await getSettings();
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderNumber}.pdf`);
    doc.pipe(res);

    drawHeader(doc, settings, order.orderNumber);
    drawCompanyInfo(doc, settings);
    drawBillingInfo(doc, order.billingAddress);
    doc.moveTo(40, 200).lineTo(555, 200).strokeColor('#ddd').lineWidth(1).stroke();
    const y = drawItemsTable(doc, order.items, 210);
    drawTotals(doc, order, y);
    drawFooter(doc, settings);
    doc.end();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
