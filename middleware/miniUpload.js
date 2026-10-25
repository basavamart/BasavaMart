const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure mini uploads directory exists
const miniUploadsDir = path.join(__dirname, '../uploads/mini');
if (!fs.existsSync(miniUploadsDir)) {
  fs.mkdirSync(miniUploadsDir, { recursive: true });
}

// Create subdirectories for different entities
const miniSubDirs = ['users', 'products', 'requests'];
miniSubDirs.forEach(dir => {
  const dirPath = path.join(miniUploadsDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Storage configuration for mini products
const miniProductStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(miniUploadsDir, 'products'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// Storage configuration for mini requests
const miniRequestStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(miniUploadsDir, 'requests'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// Storage configuration for mini users (avatar/profile pics)
const miniUserStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(miniUploadsDir, 'users'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  },
});

// File filter for images and videos
const miniFileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
  const allowedVideoTypes = /mp4|mov|avi|webm/;
  const allowedDocumentTypes = /pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv/;
  const ext = path.extname(file.originalname).toLowerCase();
  const mimetype = file.mimetype;

  const isImage = allowedImageTypes.test(ext) && mimetype.startsWith('image/');
  const isVideo = allowedVideoTypes.test(ext) && mimetype.startsWith('video/');
  const isDocument = allowedDocumentTypes.test(ext) && (
    mimetype.includes('pdf') ||
    mimetype.includes('word') ||
    mimetype.includes('sheet') ||
    mimetype.includes('presentation') ||
    mimetype.includes('text') ||
    mimetype.includes('csv') ||
    mimetype.includes('document')
  );

  if (isImage || isVideo || isDocument) {
    cb(null, true);
  } else {
    cb(new Error('Only image, video, and document files are allowed'), false);
  }
};

// Create multer instances
const miniProductUpload = multer({
  storage: miniProductStorage,
  fileFilter: miniFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
});

const miniRequestUpload = multer({
  storage: miniRequestStorage,
  fileFilter: miniFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
});

const miniUserUpload = multer({
  storage: miniUserStorage,
  fileFilter: miniFileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

module.exports = {
  miniProductUpload,
  miniRequestUpload,
  miniUserUpload,
};
