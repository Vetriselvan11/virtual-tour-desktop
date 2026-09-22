const env = require('./env.config');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { UPLOADS_DIR } = require('./directories.config');
const { isPathSafe } = require('../shared/utils/assetPath.util');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let tourId = req.params.tourId || req.body.tourId || 'temp';
    
    // Prevent path traversal
    if (tourId.includes('..') || tourId.includes('/') || tourId.includes('\\')) {
      return cb(new Error('Invalid tour ID'));
    }

    const tourDir = path.join(UPLOADS_DIR, tourId);
    if (!isPathSafe(UPLOADS_DIR, tourDir)) {
      return cb(new Error('Security violation: Invalid upload path'));
    }

    if (!fs.existsSync(tourDir)) fs.mkdirSync(tourDir, { recursive: true });
    cb(null, tourDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const rawName = path.basename(file.originalname, ext);
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'panorama';
    cb(null, `${safeName}_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|svg|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype === 'image/svg+xml';
    if (ext || mime) return cb(null, true);
    cb(new Error('Only image files (JPEG, PNG, WEBP, SVG, GIF) are allowed'));
  },
  limits: { fileSize: env.MAX_FILE_SIZE }
});

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const audioDir = path.join(UPLOADS_DIR, 'audio');
    if (!fs.existsSync(audioDir)) fs.mkdirSync(audioDir, { recursive: true });
    cb(null, audioDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const rawName = path.basename(file.originalname, ext);
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'media';
    cb(null, `${safeName}_${Date.now()}${ext}`);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: (req, file, cb) => {
    const allowed = /mp3|mp4|wav|ogg|aac|m4a|flac|webm|mov|avi|mkv|wmv/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    if (ext) return cb(null, true);
    cb(new Error('Only audio and video files are allowed'));
  },
  limits: { fileSize: 100 * 1024 * 1024 }
});

const iconStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const iconDir = path.join(UPLOADS_DIR, 'icons');
    if (!fs.existsSync(iconDir)) fs.mkdirSync(iconDir, { recursive: true });
    cb(null, iconDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const rawName = path.basename(file.originalname, ext);
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'icon';
    cb(null, `icon_${Date.now()}_${safeName}${ext}`);
  }
});

const iconUpload = multer({
  storage: iconStorage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|svg|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype) || file.mimetype === 'image/svg+xml';
    if (ext || mime) return cb(null, true);
    cb(new Error('Only image files (PNG, SVG, GIF, JPG, WebP) are allowed for icons'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});

const modelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let tourId = req.params.tourId || req.body.tourId || 'temp';
    
    // Prevent path traversal
    if (tourId.includes('..') || tourId.includes('/') || tourId.includes('\\')) {
      return cb(new Error('Invalid tour ID'));
    }

    const modelsDir = path.join(UPLOADS_DIR, tourId, 'models');
    if (!isPathSafe(UPLOADS_DIR, modelsDir)) {
      return cb(new Error('Security violation: Invalid upload path'));
    }

    if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
    cb(null, modelsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const rawName = path.basename(file.originalname, ext);
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'model';
    cb(null, `${safeName}_${Date.now()}${ext}`);
  }
});

const modelUpload = multer({
  storage: modelStorage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    const allowed = ['glb', 'gltf', 'bin', 'jpeg', 'jpg', 'png', 'webp'];
    if (allowed.includes(ext) || file.mimetype.includes('gltf') || file.mimetype.includes('octet-stream')) {
      return cb(null, true);
    }
    cb(new Error('Only 3D model files (.glb, .gltf) and textures are allowed'));
  },
  limits: { fileSize: 150 * 1024 * 1024 }
});

module.exports = {
  upload,
  audioUpload,
  iconUpload,
  modelUpload
};
