const mongoose = require('mongoose');

const externalDocumentSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, index: true },
  brandName: { type: String, required: true, trim: true },
  brandLogo: { type: String, required: true },
  brandDescription: { type: String, default: '' },
  heading: { type: String, default: '' },
  documents: [{
    originalName: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
  }],
  allowDownload: { type: Boolean, default: false },
  blurContent: { type: Boolean, default: false },
  status: { type: String, enum: ['published', 'draft'], default: 'published' },
}, { timestamps: true });

module.exports = mongoose.model('ExternalDocument', externalDocumentSchema);
