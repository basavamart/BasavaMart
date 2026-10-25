const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ProductRequest = require('../models/ProductRequest');
const { protectAdmin } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '../uploads/requests');
fs.mkdirSync(uploadDir, { recursive: true });

const allowedExtensions = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp',
  '.heic', '.heif', '.bmp',
  '.mp4', '.mov', '.avi', '.webm', '.mkv', '.3gp',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.txt', '.rtf',
]);
const allowedMimeTypes = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/bmp',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska', 'video/3gpp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain', 'application/rtf', 'text/rtf', 'application/octet-stream',
]);

const removeUploadedFiles = async files => Promise.all(files.map(file => fs.promises.unlink(file.path).catch(error => {
  console.error('Unable to remove rejected request upload:', error.message);
})));

const requestUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${require('crypto').randomBytes(12).toString('hex')}${extension}`);
    },
  }),
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.has(extension) && allowedMimeTypes.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error('Unsupported file. Upload images, videos, PDF, Word, Excel, or text documents.'));
  },
  limits: {
    files: 8,
    fileSize: 25 * 1024 * 1024,
  },
});

router.post('/', (req, res, next) => {
  requestUpload.array('files', 8)(req, res, error => {
    if (error) {
      removeUploadedFiles(req.files || []).then(() => {
        res.status(400).json({ success: false, message: error.message });
      });
      return;
    }
    next();
  });
}, async (req, res) => {
  const uploadedFiles = req.files || [];
  try {
    const { requestType, name, phone, email, productName, description = '' } = req.body;
    if (!['product', 'quotation'].includes(requestType)) {
      await removeUploadedFiles(uploadedFiles);
      res.status(400).json({ success: false, message: 'Select a valid request type.' });
      return;
    }

    const cleanName = typeof name === 'string' ? name.trim() : '';
    const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    const cleanProductName = typeof productName === 'string' ? productName.trim() : '';
    const cleanDescription = typeof description === 'string' ? description.trim() : '';
    if (!cleanName || !cleanPhone || !cleanEmail || !cleanProductName) {
      await removeUploadedFiles(uploadedFiles);
      res.status(400).json({ success: false, message: 'Name, phone, email, and product name are required.' });
      return;
    }
    if (cleanName.length > 120 || cleanPhone.length > 30 || cleanEmail.length > 254 || cleanProductName.length > 200 || cleanDescription.length > 5000) {
      await removeUploadedFiles(uploadedFiles);
      res.status(400).json({ success: false, message: 'One or more fields exceed the allowed length.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      await removeUploadedFiles(uploadedFiles);
      res.status(400).json({ success: false, message: 'Enter a valid email address.' });
      return;
    }

    const request = await ProductRequest.create({
      requestType,
      name: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      productName: cleanProductName,
      description: cleanDescription,
      files: uploadedFiles.map(file => ({
        name: path.basename(file.originalname),
        url: `/uploads/requests/${file.filename}`,
        mimeType: file.mimetype,
        size: file.size,
      })),
    });

    res.status(201).json({ success: true, message: 'Your request has been submitted.', requestId: request._id });
  } catch (error) {
    await Promise.all(uploadedFiles.map(file => fs.promises.unlink(file.path).catch(unlinkError => {
      console.error('Unable to remove failed request upload:', unlinkError.message);
    })));
    console.error('Unable to create product request:', error.message);
    res.status(500).json({ success: false, message: 'Unable to submit your request. Please try again.' });
  }
});

router.get('/admin/all', protectAdmin, async (_req, res) => {
  try {
    const requests = await ProductRequest.find().sort({ createdAt: -1 }).limit(500).lean();
    res.json({ success: true, requests });
  } catch (error) {
    console.error('Unable to load product requests:', error.message);
    res.status(500).json({ success: false, message: 'Unable to load requests.' });
  }
});

module.exports = router;
