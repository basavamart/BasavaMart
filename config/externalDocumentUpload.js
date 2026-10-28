const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDirectory = path.join(__dirname, '../uploads/external-documents');
fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDirectory),
  filename: (req, file, callback) => {
    const extension = path.extname(path.basename(file.originalname)).toLowerCase();
    callback(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
    files: 4,
  },
});

const parseExternalDocumentFiles = (req, res, next) => {
  upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'documents', maxCount: 3 }])(
    req,
    res,
    (error) => {
      if (error) {
        return res.status(400).json({ success: false, message: error.message });
      }
      next();
    }
  );
};

module.exports = { parseExternalDocumentFiles, uploadDirectory };
