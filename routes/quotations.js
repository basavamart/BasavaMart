const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const Quotation = require('../models/Quotation');
const { Settings } = require('../models/Misc');
const { protectAdmin } = require('../middleware/auth');

const router = express.Router();
const uploadsDir = path.join(__dirname, '../uploads/quotations');
const itemImagesDir = path.join(uploadsDir, 'items');
const transportationNote = 'Transportation charges will be calculated separately based on the quantity, and the same shall be payable by the client.';
function findQuotationLogoPath() {
  return [
    process.env.QUOTATION_LOGO_PATH,
    path.join(__dirname, '../assets/BasavaMartLogo.jpg'),
    path.join(__dirname, '../../frontend/public/assets/logo/BasavaMartLogo.jpeg'),
  ].find(candidate => candidate && fs.existsSync(candidate));
}

fs.mkdirSync(itemImagesDir, { recursive: true });

function findFontPath(candidates) {
  return candidates.find(candidate => candidate && fs.existsSync(candidate));
}

function registerQuotationFonts(doc) {
  const regularPath = findFontPath([
    process.env.QUOTATION_FONT_REGULAR,
    'C:\\Windows\\Fonts\\arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
  ]);
  const boldPath = findFontPath([
    process.env.QUOTATION_FONT_BOLD,
    'C:\\Windows\\Fonts\\arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf',
  ]);

  if (regularPath) doc.registerFont('Quotation-Regular', regularPath);
  if (boldPath) doc.registerFont('Quotation-Bold', boldPath);
  return {
    regular: regularPath ? 'Quotation-Regular' : 'Helvetica',
    bold: boldPath ? 'Quotation-Bold' : 'Helvetica-Bold',
    supportsRupee: Boolean(regularPath && boldPath),
  };
}

const imageUpload = multer({
  storage: multer.diskStorage({
    destination: itemImagesDir,
    filename: (req, file, callback) => {
      callback(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) return callback(new Error('Please upload an image file'));
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

const money = (value, supportsRupee = false) => `${supportsRupee ? '\u20B9' : 'Rs.'} ${Number(value || 0).toLocaleString('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const safeString = value => typeof value === 'string' ? value.trim() : '';

function normalizeProductUrl(value) {
  const productUrl = safeString(value);
  if (!productUrl) return '';
  let parsedUrl;
  try {
    parsedUrl = new URL(productUrl);
  } catch {
    throw new Error('Product link must be a valid HTTP or HTTPS URL');
  }
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Product link must be a valid HTTP or HTTPS URL');
  }
  return parsedUrl.toString();
}

function normalizeQuotation(body) {
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    throw new Error('Add at least one quotation item');
  }

  const items = body.items.map(item => {
    const productName = safeString(item.productName);
    const price = Number(item.price);
    const quantity = Number(item.quantity);
    if (!productName || !Number.isFinite(price) || price < 0 || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Each item needs a product name, a valid price, and a quantity greater than zero');
    }
    return {
      productId: safeString(item.productId),
      variantId: safeString(item.variantId),
      productUrl: normalizeProductUrl(item.productUrl),
      image: safeString(item.image),
      productName,
      variantName: safeString(item.variantName),
      hsnCode: safeString(item.hsnCode),
      price,
      quantity,
      unit: safeString(item.unit) || 'No.',
    };
  });

  const gstPercent = Number(body.gstPercent);
  if (!Number.isFinite(gstPercent) || gstPercent < 0 || gstPercent > 100) {
    throw new Error('GST percentage must be between 0 and 100');
  }

  const subtotal = Number(items.reduce((sum, item) => sum + Number((item.price * item.quantity).toFixed(2)), 0).toFixed(2));
  const tax = Number((subtotal * gstPercent / 100 / 2).toFixed(2));
  return {
    clientName: safeString(body.clientName),
    companyName: safeString(body.companyName),
    phone: safeString(body.phone),
    address: safeString(body.address),
    gstin: safeString(body.gstin),
    items,
    gstPercent,
    subtotal,
    cgstAmount: tax,
    sgstAmount: tax,
    total: Number((subtotal + tax * 2).toFixed(2)),
  };
}

function drawCell(doc, x, y, width, height, text, options = {}) {
  doc.rect(x, y, width, height).lineWidth(0.5).strokeColor('#171717').stroke();
  const padding = options.padding === undefined ? 4 : options.padding;
  doc.font(options.bold ? doc._qtFonts.bold : doc._qtFonts.regular)
    .fontSize(options.fontSize || 8)
    .fillColor(options.color || '#111111')
    .text(String(text || ''), x + padding, y + padding, {
      width: width - padding * 2,
      height: height - padding * 2,
      align: options.align || 'left',
      valign: 'center',
      lineBreak: true,
      ellipsis: true,
      link: options.link,
      underline: Boolean(options.link),
    });
}

function drawSectionTitle(doc, text, x, y, width) {
  doc.rect(x, y, width, 17).fillAndStroke('#09295f', '#171717');
  doc.fillColor('#ffffff').font(doc._qtFonts.bold).fontSize(9)
    .text(text, x + 4, y + 4, { width: width - 8, align: 'center' });
}

function tableColumns(pageWidth) {
  const widths = [27, 82, 48, 174, 42, 68, 35, 71];
  const scale = pageWidth / widths.reduce((sum, width) => sum + width, 0);
  return widths.map(width => width * scale);
}

function drawItemsHeader(doc, x, y, widths) {
  const labels = ['Sr. No.', 'Product details', 'HSN Code', 'Item Description', 'Qty.\n(Nos.)', 'Unit Rate\n(Rs.)', 'Unit', 'Amount\n(Rs.)'];
  let cursor = x;
  labels.forEach((label, index) => {
    drawCell(doc, cursor, y, widths[index], 29, label, { bold: true, align: index < 3 ? 'left' : 'center', fontSize: 8 });
    cursor += widths[index];
  });
  return y + 29;
}

async function getInvoiceDetails() {
  const settings = await Settings.find({ key: { $in: ['invoiceDetails', 'logo', 'logoText'] } });
  const values = {};
  settings.forEach(setting => { values[setting.key] = setting.value; });
  return {
    logoText: values.logoText || 'BASAVA MART',
    logo: findQuotationLogoPath(),
    invoice: {
      companyName: 'Basava Mart',
      address: 'Sy No 97/98 Adur Village, Virgonagar Post, Bidarahalli Hobli, Bengaluru East, Taluk Bangalore 560045',
      gstin: '29AKRPB0846N1ZN',
      email: 'info@basavamart.com',
      website: 'www.basavamart.com',
      phone: '98441 92551',
      ...(values.invoiceDetails || {}),
    },
  };
}

function drawDocumentHeader(doc, quote, company, continued = false) {
  const left = 24;
  const right = doc.page.width - 24;
  const width = right - left;
  const top = 22;
  const logoWidth = 100;
  const titleHeight = 96;

  doc.rect(left, top, logoWidth, titleHeight).strokeColor('#171717').lineWidth(0.7).stroke();
  doc.rect(left + logoWidth, top, width - logoWidth, titleHeight).strokeColor('#171717').lineWidth(0.7).stroke();
  const centerX = left + logoWidth;
  const centerWidth = width - logoWidth;
  doc.fillColor('#d84913').font(doc._qtFonts.bold).fontSize(22)
    .text(company.logoText.toUpperCase(), centerX + 8, top + 21, { width: centerWidth - 16, align: 'center' });
  doc.fillColor('#344052').font(doc._qtFonts.regular).fontSize(9)
    .text('Your Trusted Shopping Partner', centerX + 8, top + 53, { width: centerWidth - 16, align: 'center' });
  doc.fillColor('#132d53').font(doc._qtFonts.bold).fontSize(8)
    .text(continued ? 'QUOTATION — CONTINUED' : 'SALES QUOTATION', centerX + 8, top + 73, { width: centerWidth - 16, align: 'center' });
  if (company.logo) {
    doc.image(company.logo, left + 6, top + 6, { fit: [logoWidth - 12, titleHeight - 12], align: 'center', valign: 'center' });
  } else {
    doc.fillColor('#d84913').font(doc._qtFonts.bold).fontSize(11)
      .text(company.logoText.toUpperCase(), left + 6, top + 39, { width: logoWidth - 12, align: 'center' });
  }
  if (!continued) {
    const y = top + titleHeight;
    const leftWidth = width * 0.68;
    drawSectionTitle(doc, 'Buyer (Bill to)', left, y, leftWidth);
    drawSectionTitle(doc, 'Quotation Details', left + leftWidth, y, width - leftWidth);
    const buyerInfo = [
      `${quote.clientName}${quote.companyName ? ` — ${quote.companyName}` : ''}`,
      quote.address,
      `Phone : ${quote.phone}`,
      `GSTIN : ${quote.gstin || '—'}`,
      '',
    ];
    const sellerInfo = [
      `Bill No. : ${quote.quoteNumber}`,
      `Date : ${new Date(quote.createdAt || Date.now()).toLocaleDateString('en-IN')}`,
      `GSTIN : ${company.invoice.gstin || '—'}`,
      company.invoice.email,
      `${company.invoice.website || ''}    Phone : ${company.invoice.phone || ''}`,
    ];
    buyerInfo.forEach((value, index) => {
      const rowY = y + 17 + index * 22;
      drawCell(doc, left, rowY, leftWidth, 22, value, { fontSize: 7.5 });
      drawCell(doc, left + leftWidth, rowY, width - leftWidth, 22, sellerInfo[index], { fontSize: 7.2 });
    });

    const deliveryY = y + 127;
    const deliveryLeftWidth = width * 0.68;
    drawSectionTitle(doc, 'Delivery Address Consignee (Ship to)', left, deliveryY, deliveryLeftWidth);
    drawSectionTitle(doc, company.invoice.companyName || 'Basava Mart', left + deliveryLeftWidth, deliveryY, width - deliveryLeftWidth);
    drawCell(doc, left, deliveryY + 17, deliveryLeftWidth, 40,
      [quote.companyName, quote.clientName, quote.address, `Phone : ${quote.phone}`].filter(Boolean).join('\n'),
      { fontSize: 7.3, padding: 5 });
    drawCell(doc, left + deliveryLeftWidth, deliveryY + 17, width - deliveryLeftWidth, 40, company.invoice.address, { fontSize: 7, padding: 5 });
    return deliveryY + 57;
  }
  return top + titleHeight;
}

function drawSummaryAndFooter(doc, quote, company, startY) {
  const left = 24;
  const width = doc.page.width - 48;
  const totalWidth = width * 0.68;
  let y = startY;
  const amountX = left + totalWidth;
  const amountWidth = width - totalWidth;

  [
    [`Output CGST @ ${quote.gstPercent / 2}%`, quote.cgstAmount],
    [`Output SGST @ ${quote.gstPercent / 2}%`, quote.sgstAmount],
  ].forEach(([label, amount]) => {
    drawCell(doc, left, y, totalWidth, 19, '', { fontSize: 8 });
    drawCell(doc, amountX, y, amountWidth, 19, money(amount, doc._qtFonts.supportsRupee), { bold: true, align: 'right', fontSize: 8 });
    doc.fillColor('#142f8a').font(doc._qtFonts.bold).fontSize(8.5).text(String(label), left + totalWidth - 150, y + 5, { width: 145, align: 'right' });
    y += 19;
  });
  drawCell(doc, left, y, totalWidth, 23, 'Grand Total : only', { bold: true, color: '#111111', fontSize: 9 });
  drawCell(doc, amountX, y, amountWidth, 23, money(quote.total, doc._qtFonts.supportsRupee), { bold: true, align: 'right', color: '#111111', fontSize: 10 });
  doc.rect(left, y, width, 23).fillOpacity(0.7).fill('#f7943e').fillOpacity(1);
  drawCell(doc, left, y, totalWidth, 23, 'Grand Total : only', { bold: true, fontSize: 9 });
  drawCell(doc, amountX, y, amountWidth, 23, money(quote.total, doc._qtFonts.supportsRupee), { bold: true, align: 'right', fontSize: 10 });
  y += 23;

  const gap = 0;
  const columnWidth = (width - gap) / 2;
  const detailsHeight = 92;
  drawSectionTitle(doc, 'Bank Details', left, y, columnWidth);
  drawSectionTitle(doc, 'Declaration', left + columnWidth, y, columnWidth);
  const details = company.invoice;
  const bankText = details.bankDetails || [
    "A/c Holder's Name : Basava Mart.",
    'ICICI Bank, Basaveshwaranagar Bangalore.',
    'Current A/c NO: 230105001976.',
    'IFSC CODE : ICIC0002301.',
    '',
    "A/c Holder's Name : Basava Mart.",
    'Bank of Maharashtra, Rajajinagar Bangalore.',
    'C.C & L.C A/c NO: 60424170962.',
    'IFSC CODE : MAHB0001147.',
  ].join('\n');
  const declaration = details.declaration || 'We declare that this quotation shows the actual price of the goods described and that all particulars are true and correct.\n\nThis is a computer generated quotation.';
  drawCell(doc, left, y + 17, columnWidth, detailsHeight, bankText, { fontSize: 7, padding: 6 });
  drawCell(doc, left + columnWidth, y + 17, columnWidth, detailsHeight, declaration, { fontSize: 7.2, padding: 6 });
  y += 17 + detailsHeight;

  const transportationHeight = 24;
  doc.rect(left, y, width, transportationHeight).fillAndStroke('#fff8ef', '#171717');
  doc.fillColor('#252a31').font(doc._qtFonts.bold).fontSize(7.5)
    .text(transportationNote, left + 6, y + 7, { width: width - 12, align: 'left', lineBreak: true });
  y += transportationHeight;

  const signHeight = 53;
  const signatureWidth = width * 0.68;
  drawCell(doc, left, y, signatureWidth, signHeight, 'Customer Seal and Signature', { fontSize: 8 });
  drawCell(doc, left + signatureWidth, y, width - signatureWidth, signHeight, 'for Basava Mart\n\nAuthorised Signatory', { bold: true, align: 'right', fontSize: 8 });
  y += signHeight;
  drawCell(doc, left, y, width, 17, 'SUBJECT TO KARNATAKA STATE JURISDICTION', { bold: true, align: 'center', fontSize: 8 });
  return y + 17;
}

async function writeQuotationPdf(quote) {
  const company = await getInvoiceDetails();
  const fileName = `${quote._id}-${Date.now()}.pdf`;
  const destination = path.join(uploadsDir, fileName);
  const doc = new PDFDocument({ size: 'A4', margin: 24, bufferPages: true });
  doc._qtFonts = registerQuotationFonts(doc);
  const stream = fs.createWriteStream(destination);
  doc.pipe(stream);
  const left = 24;
  const width = doc.page.width - 48;
  const columns = tableColumns(width);
  let y = drawDocumentHeader(doc, quote, company);
  y = drawItemsHeader(doc, left, y, columns);

  const drawLine = (item, index) => {
    const description = [item.productName, item.variantName].filter(Boolean).join(' — ');
    doc.font(doc._qtFonts.regular).fontSize(8);
    const descriptionHeight = doc.heightOfString(description, { width: columns[3] - 8 });
    doc.fontSize(6.5);
    const productLinkLabel = item.productUrl ? 'Click Here to view product details' : '';
    const productLinkHeight = productLinkLabel
      ? doc.heightOfString(productLinkLabel, { width: columns[1] - 8 })
      : 0;
    const rowHeight = Math.max(22, descriptionHeight + 8, productLinkHeight + 8);
    if (y + rowHeight > doc.page.height - 260) {
      doc.addPage();
      y = drawDocumentHeader(doc, quote, company, true);
      y = drawItemsHeader(doc, left, y, columns);
    }
    const values = [
      String(index + 1),
      productLinkLabel,
      item.hsnCode || '',
      description,
      item.quantity.toLocaleString('en-IN'),
      money(item.price, doc._qtFonts.supportsRupee),
      item.unit || 'No.',
      money(item.price * item.quantity, doc._qtFonts.supportsRupee),
    ];
    let x = left;
    values.forEach((value, columnIndex) => {
      drawCell(doc, x, y, columns[columnIndex], rowHeight, value, {
        bold: columnIndex === 3 || columnIndex === 5 || columnIndex === 7,
        align: columnIndex === 5 || columnIndex === 7 ? 'right' : (columnIndex === 3 ? 'left' : 'center'),
        fontSize: columnIndex === 1 ? 6.5 : 8,
        color: columnIndex === 1 && item.productUrl ? '#0563c1' : undefined,
        link: columnIndex === 1 ? item.productUrl : undefined,
      });
      x += columns[columnIndex];
    });
    y += rowHeight;
  };
  quote.items.forEach(drawLine);

  for (let index = quote.items.length; index < 9; index += 1) {
    const rowHeight = 22;
    if (y + rowHeight > doc.page.height - 260) {
      doc.addPage();
      y = drawDocumentHeader(doc, quote, company, true);
      y = drawItemsHeader(doc, left, y, columns);
    }
    let x = left;
    const values = [String(index + 1), '', '', '', '', '', '', ''];
    values.forEach((value, columnIndex) => {
      drawCell(doc, x, y, columns[columnIndex], rowHeight, value, {
        align: columnIndex === 3 ? 'left' : 'center',
        fontSize: 7.5,
      });
      x += columns[columnIndex];
    });
    y += rowHeight;
  }

  const footerHeight = 61 + 17 + 92 + 24 + 53 + 17;
  if (y + footerHeight > doc.page.height - 24) {
    doc.addPage();
    y = drawDocumentHeader(doc, quote, company, true);
    y += 12;
  } else {
    y += 8;
  }
  const footerY = doc.page.height - 24 - footerHeight;
  if (y > footerY) y = footerY;
  drawSummaryAndFooter(doc, quote, company, y);
  doc.end();

  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);
  });
  return { fileName, destination };
}

function buildQuoteNumber() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `QT-${date}-${Date.now().toString().slice(-6)}`;
}

function runImageUpload(req, res, next) {
  imageUpload.single('image')(req, res, error => {
    if (error) return res.status(400).json({ success: false, message: error.message });
    next();
  });
}

router.post('/upload-image', protectAdmin, runImageUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'An image file is required' });
  res.status(201).json({ success: true, image: `/uploads/quotations/items/${req.file.filename}` });
});

router.get('/', protectAdmin, async (req, res) => {
  try {
    const query = {};
    const search = safeString(req.query.search);
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { quoteNumber: { $regex: escaped, $options: 'i' } },
        { clientName: { $regex: escaped, $options: 'i' } },
        { companyName: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ];
    }
    if (req.query.startDate || req.query.endDate) {
      query.createdAt = {};
      if (req.query.startDate) query.createdAt.$gte = new Date(`${req.query.startDate}T00:00:00.000Z`);
      if (req.query.endDate) query.createdAt.$lte = new Date(`${req.query.endDate}T23:59:59.999Z`);
    }
    const quotations = await Quotation.find(query).sort({ createdAt: -1 }).limit(200);
    res.json({ success: true, quotations, total: await Quotation.countDocuments(query) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protectAdmin, async (req, res) => {
  let quotation;
  let pdf;
  try {
    const values = normalizeQuotation(req.body);
    if (!values.clientName || !values.phone) {
      return res.status(400).json({ success: false, message: 'Client name and phone number are required' });
    }
    quotation = await Quotation.create({
      ...values,
      quoteNumber: buildQuoteNumber(),
      createdBy: req.admin.id,
    });
    pdf = await writeQuotationPdf(quotation);
    quotation.pdfUrl = `/api/quotations/${quotation._id}/pdf`;
    quotation.pdfFile = pdf.fileName;
    await quotation.save();
    res.status(201).json({ success: true, quotation });
  } catch (error) {
    if (pdf && fs.existsSync(pdf.destination)) fs.unlinkSync(pdf.destination);
    if (quotation) await Quotation.findByIdAndDelete(quotation._id);
    const status = /required|valid|GST|Add at least|Each item/i.test(error.message) ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

router.put('/:id', protectAdmin, async (req, res) => {
  let pdf;
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    const values = normalizeQuotation(req.body);
    if (!values.clientName || !values.phone) {
      return res.status(400).json({ success: false, message: 'Client name and phone number are required' });
    }
    const updatedValues = { ...quotation.toObject(), ...values, _id: quotation._id };
    pdf = await writeQuotationPdf(updatedValues);
    const previousPdf = quotation.pdfFile ? path.join(uploadsDir, path.basename(quotation.pdfFile)) : '';
    Object.assign(quotation, values, { pdfUrl: `/api/quotations/${quotation._id}/pdf` });
    quotation.pdfFile = pdf.fileName;
    await quotation.save();
    if (previousPdf.startsWith(uploadsDir) && previousPdf !== pdf.destination && fs.existsSync(previousPdf)) fs.unlinkSync(previousPdf);
    res.json({ success: true, quotation });
  } catch (error) {
    if (pdf && fs.existsSync(pdf.destination)) fs.unlinkSync(pdf.destination);
    const status = /required|valid|GST|Add at least|Each item/i.test(error.message) ? 400 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
});

router.get('/:id/pdf', protectAdmin, async (req, res) => {
  try {
    const quotation = await Quotation.findById(req.params.id);
    if (!quotation || !quotation.pdfUrl) return res.status(404).json({ success: false, message: 'Quotation PDF not found' });
    const fileName = path.basename(quotation.pdfFile || '');
    if (!fileName) return res.status(404).json({ success: false, message: 'Quotation PDF not found' });
    const filePath = path.join(uploadsDir, fileName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Quotation PDF file is missing' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quotation.quoteNumber}.pdf"`);
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);
    if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
    const filePath = quotation.pdfFile ? path.join(uploadsDir, path.basename(quotation.pdfFile)) : '';
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true, message: 'Quotation deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
