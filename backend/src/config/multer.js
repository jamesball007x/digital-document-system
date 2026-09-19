const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Ensure uploads directory exists
const rootDir = path.resolve(__dirname, '..', '..', '..');
const uploadsDir = path.join(rootDir, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Multer config for PDF upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueName = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('อนุญาตเฉพาะไฟล์ PDF เท่านั้น'), false);
  }
});

// Multer config for signature image upload (memory storage)
const uploadSignature = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('อนุญาตเฉพาะไฟล์รูปภาพ (png/jpg) เท่านั้น'), false);
  }
});

module.exports = {
  uploadsDir,
  upload,
  uploadSignature
};
