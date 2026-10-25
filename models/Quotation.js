const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  productId: { type: String, default: '' },
  variantId: { type: String, default: '' },
  image: { type: String, default: '' },
  productName: { type: String, required: true, trim: true },
  variantName: { type: String, default: '', trim: true },
  hsnCode: { type: String, default: '', trim: true },
  price: { type: Number, required: true, min: 0 },
  quantity: { type: Number, required: true, min: 0.01, default: 1 },
  unit: { type: String, default: 'No.', trim: true },
}, { _id: false });

const quotationSchema = new mongoose.Schema({
  quoteNumber: { type: String, required: true, unique: true },
  clientName: { type: String, required: true, trim: true },
  companyName: { type: String, default: '', trim: true },
  phone: { type: String, required: true, trim: true },
  address: { type: String, default: '', trim: true },
  gstin: { type: String, default: '', trim: true },
  items: { type: [quotationItemSchema], required: true },
  gstPercent: { type: Number, min: 0, max: 100, default: 18 },
  subtotal: { type: Number, required: true, min: 0 },
  cgstAmount: { type: Number, required: true, min: 0 },
  sgstAmount: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  pdfUrl: { type: String, default: '' },
  pdfFile: { type: String, default: '' },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Quotation', quotationSchema);
