// const express = require('express');
// const router = express.Router();
// const Product = require('../models/Product');
// const Brand = require('../models/Brand');
// const { Category, Subcategory } = require('../models/Category');
// const { protectAdmin, protectUser, protectMember } = require('../middleware/auth');
// const upload = require('../config/multer');
// const ExcelJS = require('exceljs');
// const path = require('path');
// const fs = require('fs');

// // Helper: calculate variant pricing
// function calculateVariantPricing(variant) {
//   const { listPrice, discountPercent, profitPercent, gstPercent } = variant;
//   const discountAmount = (listPrice * discountPercent) / 100;
//   const priceAfterDiscount = listPrice - discountAmount;
//   const profitAmount = (priceAfterDiscount * profitPercent) / 100;
//   const basePrice = priceAfterDiscount + profitAmount;
//   const gstAmount = (basePrice * gstPercent) / 100;
//   const finalPrice = basePrice + gstAmount;
//   return {
//     ...variant,
//     discountAmount: +discountAmount.toFixed(2),
//     profitAmount: +profitAmount.toFixed(2),
//     basePrice: +basePrice.toFixed(2),
//     gstAmount: +gstAmount.toFixed(2),
//     finalPrice: +finalPrice.toFixed(2),
//   };
// }

// // GET all products (public, with filters)
// router.get('/', async (req, res) => {
//   try {
//     const { search, brand, category, subcategory, accessLevel, page = 1, limit = 20 } = req.query;
//     const query = { status: 'published' };
//     if (search) query.$text = { $search: search };
//     if (brand) query.brand = brand;
//     if (category) query.category = category;
//     if (subcategory) query.subcategory = subcategory;
//     if (accessLevel) query.accessLevel = { $in: [accessLevel, 'both'] };
//     else query.accessLevel = { $in: ['user', 'both'] };

//     const products = await Product.find(query)
//       .populate('brand', 'name logo')
//       .populate('category', 'name')
//       .populate('subcategory', 'name')
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(Number(limit));

//     const total = await Product.countDocuments(query);
//     res.json({ success: true, products, total, pages: Math.ceil(total / limit) });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // GET member products (no prices)
// router.get('/member', protectMember, async (req, res) => {
//   try {
//     const { search, brand, category, subcategory, page = 1, limit = 20 } = req.query;
//     const query = { status: 'published', accessLevel: { $in: ['member', 'both'] } };
//     if (search) query.$text = { $search: search };
//     if (brand) query.brand = brand;
//     if (category) query.category = category;
//     if (subcategory) query.subcategory = subcategory;

//     const products = await Product.find(query)
//       .populate('brand', 'name logo')
//       .populate('category', 'name')
//       .populate('subcategory', 'name')
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(Number(limit))
//       .select('-variants.finalPrice -variants.listPrice -variants.discountPercent -variants.profitPercent');

//     const total = await Product.countDocuments(query);
//     res.json({ success: true, products, total, pages: Math.ceil(total / limit) });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // GET single product
// router.get('/:id', async (req, res) => {
//   try {
//     const product = await Product.findById(req.params.id)
//       .populate('brand', 'name logo')
//       .populate('category', 'name')
//       .populate('subcategory', 'name');
//     if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
//     res.json({ success: true, product });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // Track recent view
// router.post('/:id/view', async (req, res) => {
//   try {
//     await Product.findByIdAndUpdate(req.params.id, { $inc: { totalViews: 1 } });
//     const { userId, memberId } = req.body;
//     if (userId) {
//       const User = require('../models/User');
//       await User.findByIdAndUpdate(userId, {
//         $pull: { recentViews: req.params.id },
//       });
//       await User.findByIdAndUpdate(userId, {
//         $push: { recentViews: { $each: [req.params.id], $position: 0, $slice: 20 } },
//       });
//     }
//     if (memberId) {
//       const Member = require('../models/Member');
//       await Member.findByIdAndUpdate(memberId, {
//         $pull: { recentViews: req.params.id },
//       });
//       await Member.findByIdAndUpdate(memberId, {
//         $push: { recentViews: { $each: [req.params.id], $position: 0, $slice: 20 } },
//       });
//     }
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // ====== ADMIN ROUTES ======

// // GET admin all products
// router.get('/admin/all', protectAdmin, async (req, res) => {
//   try {
//     const { search, brand, category, subcategory, status, startDate, endDate, page = 1, limit = 20 } = req.query;
//     const query = {};
//     if (search) query.$text = { $search: search };
//     if (brand) query.brand = brand;
//     if (category) query.category = category;
//     if (subcategory) query.subcategory = subcategory;
//     if (status) query.status = status;
//     if (req.query.accessLevel) {
//       query.accessLevel = req.query.accessLevel;
//     }
//     if (startDate || endDate) {
//       query.createdAt = {};
//       if (startDate) query.createdAt.$gte = new Date(startDate);
//       if (endDate) query.createdAt.$lte = new Date(endDate);
//     }
//     const products = await Product.find(query)
//       .populate('brand', 'name logo')
//       .populate('category', 'name')
//       .populate('subcategory', 'name')
//       .sort({ createdAt: -1 })
//       .skip((page - 1) * limit)
//       .limit(Number(limit));
//     const total = await Product.countDocuments(query);
//     res.json({ success: true, products, total, pages: Math.ceil(total / limit) });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // CREATE product
// router.post('/', protectAdmin, upload.fields([
//   { name: 'images', maxCount: 7 },
//   { name: 'catalogs', maxCount: 20 },
// ]), async (req, res) => {
//   try {
//     const body = req.body;
//     const images = req.files?.images?.map(f => `/uploads/products/${f.filename}`) || [];
//     const catalogs = req.files?.catalogs?.map(f => ({
//       name: f.originalname,
//       path: `/uploads/catalogs/${f.filename}`,
//     })) || [];

//     let variants = [];
//     if (body.variants) {
//       const parsed = typeof body.variants === 'string' ? JSON.parse(body.variants) : body.variants;
//       variants = parsed.map(v => calculateVariantPricing(v));
//     }

//     let descriptions = [];
//     if (body.descriptions) {
//       descriptions = typeof body.descriptions === 'string' ? JSON.parse(body.descriptions) : body.descriptions;
//     }

//     let videoLinks = [];
//     if (body.videoLinks) {
//       videoLinks = typeof body.videoLinks === 'string' ? JSON.parse(body.videoLinks) : body.videoLinks;
//     }

//     const product = await Product.create({
//       name: body.name,
//       hsnCode: body.hsnCode,
//       brand: body.brandId,
//       category: body.categoryId,
//       subcategory: body.subcategoryId || undefined,
//       accessLevel: body.accessLevel || 'both',
//       descriptions,
//       videoLinks,
//       images,
//       catalogs,
//       variants,
//       tags: body.tags ? JSON.parse(body.tags) : [],
//       status: body.status || 'published',
//     });

//     await Brand.findByIdAndUpdate(body.brandId, { $inc: { totalProducts: 1 } });

//     const populated = await Product.findById(product._id)
//       .populate('brand', 'name logo')
//       .populate('category', 'name')
//       .populate('subcategory', 'name');

//     res.status(201).json({ success: true, product: populated });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // UPDATE product
// router.put('/:id', protectAdmin, upload.fields([
//   { name: 'images', maxCount: 7 },
//   { name: 'catalogs', maxCount: 20 },
// ]), async (req, res) => {
//   try {
//     const body = req.body;
//     const product = await Product.findById(req.params.id);
//     if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

//     if (req.files?.images?.length) {
//       const newImages = req.files.images.map(f => `/uploads/products/${f.filename}`);
//       body.images = [...(product.images || []), ...newImages];
//     }
//     if (req.files?.catalogs?.length) {
//       const newCatalogs = req.files.catalogs.map(f => ({ name: f.originalname, path: `/uploads/catalogs/${f.filename}` }));
//       body.catalogs = [...(product.catalogs || []), ...newCatalogs];
//     }
//     if (body.variants) {
//       const parsed = typeof body.variants === 'string' ? JSON.parse(body.variants) : body.variants;
//       body.variants = parsed.map(v => calculateVariantPricing(v));
//     }
//     if (body.descriptions && typeof body.descriptions === 'string') body.descriptions = JSON.parse(body.descriptions);
//     if (body.videoLinks && typeof body.videoLinks === 'string') body.videoLinks = JSON.parse(body.videoLinks);

//     const updated = await Product.findByIdAndUpdate(req.params.id, body, { new: true })
//       .populate('brand', 'name logo')
//       .populate('category', 'name')
//       .populate('subcategory', 'name');

//     res.json({ success: true, product: updated });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // STATUS update
// router.patch('/:id/status', protectAdmin, async (req, res) => {
//   try {
//     const product = await Product.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
//     res.json({ success: true, product });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // DELETE product
// router.delete('/:id', protectAdmin, async (req, res) => {
//   try {
//     const product = await Product.findByIdAndDelete(req.params.id);
//     if (product) await Brand.findByIdAndUpdate(product.brand, { $inc: { totalProducts: -1 } });
//     res.json({ success: true, message: 'Product deleted' });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // ====== EXCEL DOWNLOAD TEMPLATE ======
// router.post('/excel/template', protectAdmin, async (req, res) => {
//   try {
//     const { brandId, categoryId, subcategoryId, productName, hsnCode } = req.body;
//     const brand = await Brand.findById(brandId);
//     const category = await Category.findById(categoryId);
//     const subcategory = subcategoryId ? await Subcategory.findById(subcategoryId) : null;

//     const workbook = new ExcelJS.Workbook();
//     const sheet = workbook.addWorksheet('Variants');

//     sheet.columns = [
//       { header: 'Brand', key: 'brand', width: 20 },
//       { header: 'Category', key: 'category', width: 20 },
//       { header: 'Subcategory', key: 'subcategory', width: 20 },
//       { header: 'Product Name', key: 'productName', width: 25 },
//       { header: 'HSN Code', key: 'hsnCode', width: 15 },
//       { header: 'Variant Name', key: 'variantName', width: 20 },
//       { header: 'Stock', key: 'stock', width: 10 },
//       { header: 'Unit', key: 'unit', width: 10 },
//       { header: 'Weight (kg)', key: 'weight', width: 12 },
//       { header: 'List Price', key: 'listPrice', width: 12 },
//       { header: 'Discount %', key: 'discountPercent', width: 12 },
//       { header: 'Profit %', key: 'profitPercent', width: 12 },
//       { header: 'GST %', key: 'gstPercent', width: 10 },
//       { header: 'GST Type (CGST+SGST or IGST)', key: 'gstType', width: 28 },
//       { header: 'Primary Threshold', key: 'primaryThreshold', width: 18 },
//       { header: 'Secondary Threshold', key: 'secondaryThreshold', width: 20 },
//       { header: 'Tertiary Threshold', key: 'tertiaryThreshold', width: 18 },
//     ];

//     // Style header
//     sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
//     sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE26A26' } };

//     // Add sample row
//     sheet.addRow({
//       brand: brand?.name || '',
//       category: category?.name || '',
//       subcategory: subcategory?.name || '',
//       productName: productName || '',
//       hsnCode: hsnCode || '',
//       variantName: 'Sample Variant',
//       stock: 100,
//       unit: 'pcs',
//       weight: 0.5,
//       listPrice: 1000,
//       discountPercent: 10,
//       profitPercent: 15,
//       gstPercent: 18,
//       gstType: 'CGST+SGST',
//       primaryThreshold: 2,
//       secondaryThreshold: 5,
//       tertiaryThreshold: 10,
//     });

//     const filePath = path.join(__dirname, '../uploads/temp', `variant-template-${Date.now()}.xlsx`);
//     await workbook.xlsx.writeFile(filePath);
//     res.download(filePath, 'variant-template.xlsx', () => fs.unlinkSync(filePath));
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // ====== EXCEL UPLOAD PARSE ======
// router.post('/excel/upload', protectAdmin, upload.single('excel'), async (req, res) => {
//   try {
//     const workbook = new ExcelJS.Workbook();
//     await workbook.xlsx.readFile(req.file.path);
//     const sheet = workbook.getWorksheet('Variants');
//     const variants = [];

//     sheet.eachRow((row, rowNumber) => {
//       if (rowNumber === 1) return; // skip header
//       const variantName = row.getCell(6).value;
//       if (!variantName) return;
//       const v = {
//         name: String(variantName),
//         stock: Number(row.getCell(7).value) || 0,
//         unit: String(row.getCell(8).value || 'pcs'),
//         weight: Number(row.getCell(9).value) || 0,
//         listPrice: Number(row.getCell(10).value) || 0,
//         discountPercent: Number(row.getCell(11).value) || 0,
//         profitPercent: Number(row.getCell(12).value) || 0,
//         gstPercent: Number(row.getCell(13).value) || 0,
//         gstType: String(row.getCell(14).value || 'CGST+SGST'),
//         primaryThreshold: Number(row.getCell(15).value) || 0,
//         secondaryThreshold: Number(row.getCell(16).value) || 0,
//         tertiaryThreshold: Number(row.getCell(17).value) || 0,
//       };
//       variants.push(calculateVariantPricing(v));
//     });

//     fs.unlinkSync(req.file.path);
//     res.json({ success: true, variants });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // ====== DOWNLOAD PRODUCT DATA ======
// router.post('/admin/download', protectAdmin, async (req, res) => {
//   try {
//     const { brandIds, startDate, endDate } = req.body;
//     const query = {};
//     if (brandIds?.length) query.brand = { $in: brandIds };
//     if (startDate || endDate) {
//       query.createdAt = {};
//       if (startDate) query.createdAt.$gte = new Date(startDate);
//       if (endDate) query.createdAt.$lte = new Date(endDate);
//     }

//     const products = await Product.find(query)
//       .populate('brand', 'name logo')
//       .populate('category', 'name')
//       .populate('subcategory', 'name');

//     const workbook = new ExcelJS.Workbook();
//     const sheet = workbook.addWorksheet('Products');
//     sheet.columns = [
//       { header: 'Product Name', key: 'name', width: 30 },
//       { header: 'Brand', key: 'brand', width: 20 },
//       { header: 'Category', key: 'category', width: 20 },
//       { header: 'Subcategory', key: 'subcategory', width: 20 },
//       { header: 'HSN Code', key: 'hsnCode', width: 15 },
//       { header: 'Access Level', key: 'accessLevel', width: 15 },
//       { header: 'Status', key: 'status', width: 12 },
//       { header: 'Variant Name', key: 'variantName', width: 20 },
//       { header: 'Stock', key: 'stock', width: 10 },
//       { header: 'Unit', key: 'unit', width: 10 },
//       { header: 'List Price', key: 'listPrice', width: 12 },
//       { header: 'Discount %', key: 'discountPercent', width: 12 },
//       { header: 'Final Price', key: 'finalPrice', width: 12 },
//       { header: 'GST %', key: 'gstPercent', width: 10 },
//       { header: 'Primary Threshold', key: 'primaryThreshold', width: 18 },
//       { header: 'Secondary Threshold', key: 'secondaryThreshold', width: 20 },
//       { header: 'Tertiary Threshold', key: 'tertiaryThreshold', width: 18 },
//     ];

//     sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
//     sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE26A26' } };

//     products.forEach(p => {
//       if (!p.variants.length) {
//         sheet.addRow({ name: p.name, brand: p.brand?.name, category: p.category?.name, subcategory: p.subcategory?.name, hsnCode: p.hsnCode, accessLevel: p.accessLevel, status: p.status });
//       } else {
//         p.variants.forEach(v => {
//           sheet.addRow({
//             name: p.name, brand: p.brand?.name, category: p.category?.name, subcategory: p.subcategory?.name,
//             hsnCode: p.hsnCode, accessLevel: p.accessLevel, status: p.status,
//             variantName: v.name, stock: v.stock, unit: v.unit, listPrice: v.listPrice,
//             discountPercent: v.discountPercent, finalPrice: v.finalPrice, gstPercent: v.gstPercent,
//             primaryThreshold: v.primaryThreshold, secondaryThreshold: v.secondaryThreshold, tertiaryThreshold: v.tertiaryThreshold,
//           });
//         });
//       }
//     });

//     const filePath = path.join(__dirname, '../uploads/temp', `products-${Date.now()}.xlsx`);
//     await workbook.xlsx.writeFile(filePath);
//     res.download(filePath, 'products.xlsx', () => fs.unlinkSync(filePath));
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// module.exports = router;




//august 26

const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Product = require('../models/Product');
const Brand = require('../models/Brand');
const { Category, Subcategory } = require('../models/Category');
const { protectAdmin, protectUser, protectMember } = require('../middleware/auth');
const upload = require('../config/multer');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function applyCatalogVisibility(query, audience) {
  const access = { $in: [audience, 'both'] };
  const [brands, categories, subcategories] = await Promise.all([
    Brand.find({ status: 'published', accessLevel: access }).select('_id'),
    Category.find({ status: 'published', accessLevel: access }).select('_id brand'),
    Subcategory.find({ status: 'published', accessLevel: access }).select('_id category brand'),
  ]);
  const brandIds = brands.map(item => item._id);
  const categoryIds = categories.filter(item => brandIds.some(id => String(id) === String(item.brand))).map(item => item._id);
  const subcategoryIds = subcategories.filter(item => categoryIds.some(id => String(id) === String(item.category)) && brandIds.some(id => String(id) === String(item.brand))).map(item => item._id);
  query.$and = [
    { brand: { $in: brandIds } },
    { category: { $in: categoryIds } },
    { $or: [{ subcategory: { $in: subcategoryIds } }, { subcategory: { $exists: false } }, { subcategory: null }] },
  ];
}

// Helper: calculate variant pricing
function calculateVariantPricing(variant) {
  const { listPrice, discountPercent, profitPercent, gstPercent } = variant;
  const discountAmount = (listPrice * discountPercent) / 100;
  const priceAfterDiscount = listPrice - discountAmount;
  const profitAmount = (priceAfterDiscount * profitPercent) / 100;
  const basePrice = priceAfterDiscount + profitAmount;
  const gstAmount = (basePrice * gstPercent) / 100;
  const finalPrice = basePrice + gstAmount;
  return {
    ...variant,
    discountAmount: +discountAmount.toFixed(2),
    profitAmount: +profitAmount.toFixed(2),
    basePrice: +basePrice.toFixed(2),
    gstAmount: +gstAmount.toFixed(2),
    finalPrice: +finalPrice.toFixed(2),
  };
}

// Helper: given req.files (from upload.any()) and the parsed variants array,
// merge each variant's kept "existing" image paths (already present on
// variant.images from the client) with newly uploaded files posted under the
// field name `variantImages_<index>` (index matches the variant's position
// in the submitted variants array).
function attachVariantImages(variants, files) {
  return variants.map((v, idx) => {
    const existingImages = Array.isArray(v.images) ? v.images : [];
    const newFiles = (files || []).filter(f => f.fieldname === `variantImages_${idx}`);
    const newImages = newFiles.map(f => `/uploads/variants/${f.filename}`);
    const existingDocuments = Array.isArray(v.documents) ? v.documents : [];
    const newDocuments = (files || [])
      .filter(f => f.fieldname === `variantDocuments_${idx}`)
      .map(f => ({ name: f.originalname, path: `/uploads/variants/${f.filename}` }));
    return { ...v, images: [...existingImages, ...newImages], documents: [...existingDocuments, ...newDocuments] };
  });
}

// GET all products (public, with filters)
router.get('/', async (req, res) => {
  try {
    const { search, brand, category, subcategory, accessLevel, page = 1, limit = 20 } = req.query;
    const query = { status: 'published' };
    await applyCatalogVisibility(query, accessLevel === 'member' ? 'member' : 'user');
    if (search) {
      const textPattern = new RegExp(search, 'i');
      const [matchingCategories, matchingSubcategories] = await Promise.all([
        Category.find({ name: textPattern, status: 'published' }).select('_id'),
        Subcategory.find({ name: textPattern, status: 'published' }).select('_id'),
      ]);
      query.$or = [
        { $text: { $search: search } },
        { category: { $in: matchingCategories.map(item => item._id) } },
        { subcategory: { $in: matchingSubcategories.map(item => item._id) } },
      ];
    }
    if (brand) {
      const brandIds = String(brand).split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
      if (brandIds.length !== String(brand).split(',').length) {
        return res.status(400).json({ success: false, message: 'One or more brand IDs are invalid' });
      }
      query.brand = brandIds.length > 1 ? { $in: brandIds } : brandIds[0];
    }
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (accessLevel) query.accessLevel = { $in: [accessLevel, 'both'] };
    else query.accessLevel = { $in: ['user', 'both'] };

    const products = await Product.find(query)
      .populate('brand', 'name logo')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);
    res.json({ success: true, products, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET member products (no prices)
router.get('/member', protectMember, async (req, res) => {
  try {
    const { search, brand, category, subcategory, page = 1, limit = 20 } = req.query;
    const query = { status: 'published', accessLevel: { $in: ['member', 'both'] } };
    await applyCatalogVisibility(query, 'member');
    if (search) query.$text = { $search: search };
    if (brand) query.brand = brand;
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;

    const products = await Product.find(query)
      .populate('brand', 'name logo')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Product.countDocuments(query);
    res.json({ success: true, products, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin routes with fixed paths must be registered before GET /:id below.
router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const { search, brand, category, subcategory, status, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    if (search) query.$text = { $search: search };
    if (brand) query.brand = brand;
    if (category) query.category = category;
    if (subcategory) query.subcategory = subcategory;
    if (status) query.status = status;
    if (req.query.accessLevel) query.accessLevel = req.query.accessLevel;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    const products = await Product.find(query)
      .populate('brand', 'name logo')
      .populate('category', 'name')
      .populate('subcategory', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Product.countDocuments(query);
    res.json({ success: true, products, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET single product
router.get('/:id', async (req, res) => {
  try {
    const detailQuery = { _id: req.params.id };
    if (req.query.accessLevel === 'user' || req.query.accessLevel === 'member') await applyCatalogVisibility(detailQuery, req.query.accessLevel);
    const product = await Product.findOne(detailQuery)
      .populate('brand', 'name logo')
      .populate('category', 'name')
      .populate('subcategory', 'name');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Track recent view
router.post('/:id/view', async (req, res) => {
  try {
    await Product.findByIdAndUpdate(req.params.id, { $inc: { totalViews: 1 } });
    const { userId, memberId } = req.body;
    if (userId) {
      const User = require('../models/User');
      await User.findByIdAndUpdate(userId, {
        $pull: { recentViews: req.params.id },
      });
      await User.findByIdAndUpdate(userId, {
        $push: { recentViews: { $each: [req.params.id], $position: 0, $slice: 20 } },
      });
    }
    if (memberId) {
      const Member = require('../models/Member');
      await Member.findByIdAndUpdate(memberId, {
        $pull: { recentViews: req.params.id },
      });
      await Member.findByIdAndUpdate(memberId, {
        $push: { recentViews: { $each: [req.params.id], $position: 0, $slice: 20 } },
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== ADMIN ROUTES ======

// CREATE product
router.post('/', protectAdmin, upload.any(), async (req, res) => {
  try {
    const body = req.body;
    const files = req.files || [];
    const images = files.filter(f => f.fieldname === 'images').map(f => `/uploads/products/${f.filename}`);
    const catalogs = files.filter(f => f.fieldname === 'catalogs').map(f => ({
      name: f.originalname,
      path: `/uploads/catalogs/${f.filename}`,
    }));

    let variants = [];
    if (body.variants) {
      const parsed = typeof body.variants === 'string' ? JSON.parse(body.variants) : body.variants;
      variants = attachVariantImages(parsed, files).map(v => calculateVariantPricing(v));
    }

    let descriptions = [];
    if (body.descriptions) {
      descriptions = typeof body.descriptions === 'string' ? JSON.parse(body.descriptions) : body.descriptions;
    }

    let videoLinks = [];
    if (body.videoLinks) {
      videoLinks = typeof body.videoLinks === 'string' ? JSON.parse(body.videoLinks) : body.videoLinks;
    }

    const product = await Product.create({
      name: body.name,
      hsnCode: body.hsnCode,
      brand: body.brandId,
      category: body.categoryId,
      subcategory: body.subcategoryId || undefined,
      accessLevel: body.accessLevel || 'both',
      descriptions,
      videoLinks,
      images,
      catalogs,
      variants,
      tags: body.tags ? JSON.parse(body.tags) : [],
      status: body.status || 'published',
    });

    await Brand.findByIdAndUpdate(body.brandId, { $inc: { totalProducts: 1 } });

    const populated = await Product.findById(product._id)
      .populate('brand', 'name logo')
      .populate('category', 'name')
      .populate('subcategory', 'name');

    res.status(201).json({ success: true, product: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CLONE product
router.post('/:id/clone', protectAdmin, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    delete product._id;
    delete product.createdAt;
    delete product.updatedAt;
    delete product.__v;
    product.name = `${product.name} (Copy)`;
    product.totalViews = 0;
    product.totalOrders = 0;
    product.totalRevenue = 0;

    const clonedProduct = await Product.create(product);
    await Brand.findByIdAndUpdate(clonedProduct.brand, { $inc: { totalProducts: 1 } });

    const populated = await Product.findById(clonedProduct._id)
      .populate('brand', 'name logo')
      .populate('category', 'name')
      .populate('subcategory', 'name');

    res.status(201).json({ success: true, product: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE product
router.put('/:id', protectAdmin, upload.any(), async (req, res) => {
  try {
    const body = req.body;
    const files = req.files || [];
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    const newImages = files.filter(f => f.fieldname === 'images').map(f => `/uploads/products/${f.filename}`);
    const keptImages = body.existingImages !== undefined
      ? (typeof body.existingImages === 'string' ? JSON.parse(body.existingImages) : body.existingImages)
      : (product.images || []);
    body.images = [...keptImages, ...newImages];

    const newCatalogs = files.filter(f => f.fieldname === 'catalogs').map(f => ({ name: f.originalname, path: `/uploads/catalogs/${f.filename}` }));
    const keptCatalogs = body.existingCatalogs !== undefined
      ? (typeof body.existingCatalogs === 'string' ? JSON.parse(body.existingCatalogs) : body.existingCatalogs)
      : (product.catalogs || []);
    // existingCatalogs from the client is an array of paths (strings); map back to {name, path} objects
    const keptCatalogObjs = keptCatalogs.map((c) => {
      if (typeof c === 'string') {
        const existing = (product.catalogs || []).find(pc => pc.path === c);
        return existing || { name: c.split('/').pop(), path: c };
      }
      return c;
    });
    body.catalogs = [...keptCatalogObjs, ...newCatalogs];
    if (body.variants) {
      const parsed = typeof body.variants === 'string' ? JSON.parse(body.variants) : body.variants;
      body.variants = attachVariantImages(parsed, files).map(v => calculateVariantPricing(v));
    }
    if (body.descriptions && typeof body.descriptions === 'string') body.descriptions = JSON.parse(body.descriptions);
    if (body.videoLinks && typeof body.videoLinks === 'string') body.videoLinks = JSON.parse(body.videoLinks);

    const updated = await Product.findByIdAndUpdate(req.params.id, body, { new: true })
      .populate('brand', 'name logo')
      .populate('category', 'name')
      .populate('subcategory', 'name');

    res.json({ success: true, product: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// STATUS update
router.patch('/:id/status', protectAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE product
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (product) await Brand.findByIdAndUpdate(product.brand, { $inc: { totalProducts: -1 } });
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== EXCEL DOWNLOAD TEMPLATE ======
router.post('/excel/template', protectAdmin, async (req, res) => {
  try {
    const { brandId, categoryId, subcategoryId, productName, hsnCode } = req.body;
    const brand = await Brand.findById(brandId);
    const category = await Category.findById(categoryId);
    const subcategory = subcategoryId ? await Subcategory.findById(subcategoryId) : null;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Variants');

    sheet.columns = [
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Subcategory', key: 'subcategory', width: 20 },
      { header: 'Product Name', key: 'productName', width: 25 },
      { header: 'HSN Code', key: 'hsnCode', width: 15 },
      { header: 'Variant Name', key: 'variantName', width: 20 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Weight (kg)', key: 'weight', width: 12 },
      { header: 'List Price', key: 'listPrice', width: 12 },
      { header: 'Discount %', key: 'discountPercent', width: 12 },
      { header: 'Profit %', key: 'profitPercent', width: 12 },
      { header: 'GST %', key: 'gstPercent', width: 10 },
      { header: 'GST Type (CGST+SGST or IGST)', key: 'gstType', width: 28 },
      { header: 'Primary Threshold', key: 'primaryThreshold', width: 18 },
      { header: 'Secondary Threshold', key: 'secondaryThreshold', width: 20 },
      { header: 'Tertiary Threshold', key: 'tertiaryThreshold', width: 18 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE26A26' } };

    // Add sample row
    sheet.addRow({
      brand: brand?.name || '',
      category: category?.name || '',
      subcategory: subcategory?.name || '',
      productName: productName || '',
      hsnCode: hsnCode || '',
      variantName: 'Sample Variant',
      stock: 100,
      unit: 'pcs',
      weight: 0.5,
      listPrice: 1000,
      discountPercent: 10,
      profitPercent: 15,
      gstPercent: 18,
      gstType: 'CGST+SGST',
      primaryThreshold: 2,
      secondaryThreshold: 5,
      tertiaryThreshold: 10,
    });

    const filePath = path.join(__dirname, '../uploads/temp', `variant-template-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, 'variant-template.xlsx', () => fs.unlinkSync(filePath));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== EXCEL UPLOAD PARSE ======
router.post('/excel/upload', protectAdmin, upload.single('excel'), async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.getWorksheet('Variants');
    const variants = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      const variantName = row.getCell(6).value;
      if (!variantName) return;
      const v = {
        name: String(variantName),
        stock: Number(row.getCell(7).value) || 0,
        unit: String(row.getCell(8).value || 'pcs'),
        weight: Number(row.getCell(9).value) || 0,
        listPrice: Number(row.getCell(10).value) || 0,
        discountPercent: Number(row.getCell(11).value) || 0,
        profitPercent: Number(row.getCell(12).value) || 0,
        gstPercent: Number(row.getCell(13).value) || 0,
        gstType: String(row.getCell(14).value || 'CGST+SGST'),
        primaryThreshold: Number(row.getCell(15).value) || 0,
        secondaryThreshold: Number(row.getCell(16).value) || 0,
        tertiaryThreshold: Number(row.getCell(17).value) || 0,
      };
      variants.push(calculateVariantPricing(v));
    });

    fs.unlinkSync(req.file.path);
    res.json({ success: true, variants });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ====== DOWNLOAD PRODUCT DATA ======
router.post('/admin/download', protectAdmin, async (req, res) => {
  try {
    const { brandIds, startDate, endDate } = req.body;
    const query = {};
    if (brandIds?.length) query.brand = { $in: brandIds };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const products = await Product.find(query)
      .populate('brand', 'name logo')
      .populate('category', 'name')
      .populate('subcategory', 'name');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Products');
    sheet.columns = [
      { header: 'Product Name', key: 'name', width: 30 },
      { header: 'Brand', key: 'brand', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Subcategory', key: 'subcategory', width: 20 },
      { header: 'HSN Code', key: 'hsnCode', width: 15 },
      { header: 'Access Level', key: 'accessLevel', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Variant Name', key: 'variantName', width: 20 },
      { header: 'Stock', key: 'stock', width: 10 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'List Price', key: 'listPrice', width: 12 },
      { header: 'Discount %', key: 'discountPercent', width: 12 },
      { header: 'Final Price', key: 'finalPrice', width: 12 },
      { header: 'GST %', key: 'gstPercent', width: 10 },
      { header: 'Primary Threshold', key: 'primaryThreshold', width: 18 },
      { header: 'Secondary Threshold', key: 'secondaryThreshold', width: 20 },
      { header: 'Tertiary Threshold', key: 'tertiaryThreshold', width: 18 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE26A26' } };

    products.forEach(p => {
      if (!p.variants.length) {
        sheet.addRow({ name: p.name, brand: p.brand?.name, category: p.category?.name, subcategory: p.subcategory?.name, hsnCode: p.hsnCode, accessLevel: p.accessLevel, status: p.status });
      } else {
        p.variants.forEach(v => {
          sheet.addRow({
            name: p.name, brand: p.brand?.name, category: p.category?.name, subcategory: p.subcategory?.name,
            hsnCode: p.hsnCode, accessLevel: p.accessLevel, status: p.status,
            variantName: v.name, stock: v.stock, unit: v.unit, listPrice: v.listPrice,
            discountPercent: v.discountPercent, finalPrice: v.finalPrice, gstPercent: v.gstPercent,
            primaryThreshold: v.primaryThreshold, secondaryThreshold: v.secondaryThreshold, tertiaryThreshold: v.tertiaryThreshold,
          });
        });
      }
    });

    const filePath = path.join(__dirname, '../uploads/temp', `products-${Date.now()}.xlsx`);
    await workbook.xlsx.writeFile(filePath);
    res.download(filePath, 'products.xlsx', () => fs.unlinkSync(filePath));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;