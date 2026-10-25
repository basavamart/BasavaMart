// const multer = require('multer');
// const path = require('path');
// const fs = require('fs');

// // Ensure uploads directory exists
// const uploadsDir = path.join(__dirname, '../uploads');
// if (!fs.existsSync(uploadsDir)) {
//   fs.mkdirSync(uploadsDir, { recursive: true });
// }

// const subDirs = ['products', 'brands', 'categories', 'ads', 'members', 'settings', 'catalogs', 'temp'];
// subDirs.forEach(dir => {
//   const dirPath = path.join(uploadsDir, dir);
//   if (!fs.existsSync(dirPath)) {
//     fs.mkdirSync(dirPath, { recursive: true });
//   }
// });

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     let folder = 'temp';
//     const url = req.originalUrl;

//     if (url.includes('/brands')) folder = 'brands';
//     else if (url.includes('/categories')) folder = 'categories';
//     else if (url.includes('/products') && file.mimetype.includes('pdf')) folder = 'catalogs';
//     else if (url.includes('/products')) folder = 'products';
//     else if (url.includes('/ads')) folder = 'ads';
//     else if (url.includes('/members') || url.includes('/member')) folder = 'members';
//     else if (url.includes('/settings')) folder = 'settings';

//     cb(null, path.join(uploadsDir, folder));
//   },
//   filename: (req, file, cb) => {
//     const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
//     cb(null, uniqueName);
//   },
// });

// const fileFilter = (req, file, cb) => {
//   const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|pdf|doc|docx|xlsx|xls/;
//   const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
//   const mimetype = /image|video|application\/pdf|application\/msword|application\/vnd/.test(file.mimetype);

//   if (extname || mimetype) {
//     cb(null, true);
//   } else {
//     cb(new Error('File type not supported'), false);
//   }
// };

// const upload = multer({
//   storage,
//   fileFilter,
//   limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
// });

// module.exports = upload;




//august 26

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const subDirs = ['products', 'variants', 'pipes', 'pipeVariants', 'pipeCatalogs', 'brands', 'brand-categories', 'categories', 'ads', 'members', 'settings', 'catalogs', 'quotations', 'temp'];
subDirs.forEach(dir => {
  const dirPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'temp';
    const url = req.originalUrl;

    if (url.includes('/brand-categories')) folder = 'brand-categories';
    else if (url.includes('/pipes') && file.fieldname && (file.fieldname.startsWith('variantImages_') || file.fieldname.startsWith('variantDocuments_'))) folder = 'pipeVariants';
    else if (file.fieldname && (file.fieldname.startsWith('variantImages_') || file.fieldname.startsWith('variantDocuments_'))) folder = 'variants';
    else if (url.includes('/brands')) folder = 'brands';
    else if (url.includes('/categories')) folder = 'categories';
    else if (url.includes('/pipes') && file.fieldname === 'catalogs') folder = 'pipeCatalogs';
    else if (file.fieldname === 'catalogs' || (url.includes('/products') && file.mimetype.includes('pdf'))) folder = 'catalogs';
    else if (url.includes('/pipes')) folder = 'pipes';
    else if (url.includes('/products')) folder = 'products';
    else if (url.includes('/ads')) folder = 'ads';
    else if (url.includes('/members') || url.includes('/member')) folder = 'members';
    else if (url.includes('/settings')) folder = 'settings';

    cb(null, path.join(uploadsDir, folder));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|mov|avi|pdf|doc|docx|xlsx|xls/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /image|video|application\/pdf|application\/msword|application\/vnd/.test(file.mimetype);

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('File type not supported'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

module.exports = upload;