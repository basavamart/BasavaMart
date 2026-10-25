const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDir = path.join(__dirname, '..', 'uploads', 'payment-proofs');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['.jpg', '.jpeg', '.png', '.webp']);
    if (allowed.has(path.extname(file.originalname).toLowerCase()) && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Upload a JPG, PNG, or WebP payment screenshot'));
    }
  },
});

module.exports = upload;