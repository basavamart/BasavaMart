const express = require('express');
const fs = require('fs');
const path = require('path');
const ExternalDocument = require('../models/ExternalDocument');
const { protectAdmin } = require('../middleware/auth');
const { parseExternalDocumentFiles, uploadDirectory } = require('../config/externalDocumentUpload');

const router = express.Router();
const fileUrl = (filename) => `/api/external-documents/files/${filename}`;
const getUploadedFiles = (req) => Object.values(req.files || {}).flat();

const removeUploadedFiles = async (files) => {
  await Promise.all(files.map(async (file) => {
    try {
      await fs.promises.unlink(file.path);
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('External document cleanup failed:', error.message);
    }
  }));
};

const removeStoredUrl = async (url) => {
  const prefix = '/api/external-documents/files/';
  if (!url || !url.startsWith(prefix)) return;
  const filename = path.basename(url.slice(prefix.length));
  const filePath = path.resolve(uploadDirectory, filename);
  if (path.dirname(filePath) !== path.resolve(uploadDirectory)) return;
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('External document cleanup failed:', error.message);
  }
};

const makeSlug = async (brandName) => {
  const base = brandName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'brand';
  const year = new Date().getFullYear();
  const stem = `${base}${year}`;
  let slug = stem;
  let suffix = 2;
  while (await ExternalDocument.exists({ slug })) {
    slug = `${stem}-${suffix}`;
    suffix += 1;
  }
  return slug;
};

const readExistingDocumentIds = (value) => {
  if (value === undefined) return null;
  const ids = JSON.parse(value);
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    throw new Error('Invalid existing documents list');
  }
  return ids;
};

const isAllowedLogo = (file) => file
  && ['.png', '.jpg', '.jpeg', '.webp'].includes(path.extname(file.originalname).toLowerCase())
  && file.mimetype.startsWith('image/');

router.get('/admin/all', protectAdmin, async (req, res) => {
  try {
    const records = await ExternalDocument.find().sort({ createdAt: -1 });
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/public/:slug', async (req, res) => {
  try {
    const record = await ExternalDocument.findOne({ slug: req.params.slug, status: 'published' })
      .select('-__v -status');
    if (!record) return res.status(404).json({ success: false, message: 'External page not found' });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/files/:filename', async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const url = fileUrl(filename);
    const record = await ExternalDocument.exists({
      $or: [{ brandLogo: url }, { 'documents.url': url }],
    });
    if (!record) return res.status(404).json({ success: false, message: 'File not found' });

    const filePath = path.resolve(uploadDirectory, filename);
    if (path.dirname(filePath) !== path.resolve(uploadDirectory)) {
      return res.status(400).json({ success: false, message: 'Invalid file path' });
    }

    const extension = path.extname(filename).toLowerCase();
    const inlineTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
    };
    const contentType = inlineTypes[extension] || 'application/octet-stream';
    const disposition = inlineTypes[extension] ? 'inline' : 'attachment';
    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `${disposition}; filename="${encodeURIComponent(filename)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) res.status(error.statusCode || 404).json({ success: false, message: 'File not found' });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', protectAdmin, parseExternalDocumentFiles, async (req, res) => {
  const uploadedFiles = getUploadedFiles(req);
  const logo = req.files?.logo?.[0];
  try {
    const brandName = String(req.body.brandName || '').trim();
    if (!brandName) {
      await removeUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }
    if (!isAllowedLogo(logo)) {
      await removeUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Upload a PNG, JPG, JPEG, or WEBP brand logo' });
    }

    const documents = req.files?.documents || [];
    const record = await ExternalDocument.create({
      slug: await makeSlug(brandName),
      brandName,
      brandLogo: fileUrl(logo.filename),
      brandDescription: String(req.body.brandDescription || '').trim(),
      heading: String(req.body.heading || '').trim(),
      documents: documents.map((file) => ({
        originalName: file.originalname,
        url: fileUrl(file.filename),
        mimeType: file.mimetype,
        size: file.size,
      })),
      allowDownload: req.body.allowDownload === 'true',
      blurContent: req.body.blurContent === 'true',
      status: req.body.status === 'draft' ? 'draft' : 'published',
    });
    res.status(201).json({ success: true, record });
  } catch (error) {
    await removeUploadedFiles(uploadedFiles);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', protectAdmin, parseExternalDocumentFiles, async (req, res) => {
  const uploadedFiles = getUploadedFiles(req);
  const newLogo = req.files?.logo?.[0];
  try {
    const record = await ExternalDocument.findById(req.params.id);
    if (!record) {
      await removeUploadedFiles(uploadedFiles);
      return res.status(404).json({ success: false, message: 'External page not found' });
    }

    const brandName = String(req.body.brandName || '').trim();
    if (!brandName) {
      await removeUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Brand name is required' });
    }
    if (newLogo && !isAllowedLogo(newLogo)) {
      await removeUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Upload a PNG, JPG, JPEG, or WEBP brand logo' });
    }

    let existingIds;
    try {
      existingIds = readExistingDocumentIds(req.body.existingDocuments);
    } catch (error) {
      await removeUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: error.message });
    }
    const existingDocuments = existingIds === null
      ? record.documents
      : record.documents.filter((document) => existingIds.includes(document._id.toString()));
    if (existingIds !== null && existingDocuments.length !== new Set(existingIds).size) {
      await removeUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'Invalid existing documents list' });
    }

    const documents = [...existingDocuments, ...(req.files?.documents || []).map((file) => ({
      originalName: file.originalname,
      url: fileUrl(file.filename),
      mimeType: file.mimetype,
      size: file.size,
    }))];
    if (documents.length > 3) {
      await removeUploadedFiles(uploadedFiles);
      return res.status(400).json({ success: false, message: 'A maximum of 3 documents is allowed' });
    }

    const oldLogo = record.brandLogo;
    const retainedUrls = new Set(documents.map((document) => document.url));
    const removedUrls = record.documents.filter((document) => !retainedUrls.has(document.url)).map((document) => document.url);
    record.brandName = brandName;
    record.brandLogo = newLogo ? fileUrl(newLogo.filename) : oldLogo;
    record.brandDescription = String(req.body.brandDescription || '').trim();
    record.heading = String(req.body.heading || '').trim();
    record.documents = documents;
    record.allowDownload = req.body.allowDownload === 'true';
    record.blurContent = req.body.blurContent === 'true';
    if (req.body.status === 'draft' || req.body.status === 'published') record.status = req.body.status;
    await record.save();

    if (newLogo) await removeStoredUrl(oldLogo);
    await Promise.all(removedUrls.map(removeStoredUrl));
    res.json({ success: true, record });
  } catch (error) {
    await removeUploadedFiles(uploadedFiles);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/:id/status', protectAdmin, async (req, res) => {
  try {
    if (!['published', 'draft'].includes(req.body.status)) {
      return res.status(400).json({ success: false, message: 'Status must be published or draft' });
    }
    const record = await ExternalDocument.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true, runValidators: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'External page not found' });
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const record = await ExternalDocument.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ success: false, message: 'External page not found' });
    await Promise.all([
      removeStoredUrl(record.brandLogo),
      ...record.documents.map((document) => removeStoredUrl(document.url)),
    ]);
    res.json({ success: true, message: 'External page deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
