const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const env = require('../config/env.config');
const { UPLOADS_DIR, PUBLISHED_DIR } = require('../config/directories.config');

const appRoutes = require('./routes');
const errorMiddleware = require('../middleware/error.middleware');
const notFoundMiddleware = require('../middleware/notFound.middleware');
const { globalLimiter } = require('../middleware/rateLimit.middleware');

const app = express();

// Security and utility Middlewares
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Rate Limiting
app.use(globalLimiter);

const ThumbnailService = require('../modules/asset/thumbnail.service');
const TileGeneratorService = require('../modules/asset/tileGenerator.service');

// On-demand tile generation middleware for /uploads/:tourId/tiles/:imageFolder/level_:level/:tileFile
app.use('/uploads/:tourId/tiles/:imageFolder/level_:level/:tileFile', async (req, res, next) => {
  const { tourId, imageFolder, level, tileFile } = req.params;
  const targetPath = path.join(UPLOADS_DIR, tourId, 'tiles', imageFolder, `level_${level}`, tileFile);
  if (fs.existsSync(targetPath)) return next();

  // Extract row and col from filename: e.g. "0_1.webp" -> row 0, col 1
  const parts = tileFile.replace(/\.[^.]+$/, '').split('_');
  if (parts.length === 2) {
    const row = parseInt(parts[0], 10);
    const col = parseInt(parts[1], 10);
    const candidateExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.PNG', '.JPEG'];
    let masterPath = null;
    for (const cExt of candidateExtensions) {
      const candidate = path.join(UPLOADS_DIR, tourId, `${imageFolder}${cExt}`);
      if (fs.existsSync(candidate)) {
        masterPath = candidate;
        break;
      }
    }

    if (masterPath) {
      try {
        const generatedPath = await TileGeneratorService.generateSingleTile(masterPath, tourId, level, row, col);
        if (generatedPath && fs.existsSync(generatedPath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return res.sendFile(generatedPath);
        }
      } catch (e) {
        console.warn(`[Asset] Dynamic tile generation notice for ${tileFile}:`, e.message);
      }
    }
  }
  next();
});

// On-demand thumbnail & preview generation for legacy tours or newly requested derivatives
app.use('/uploads/:tourId/thumbnails/:filename', async (req, res, next) => {
  const { tourId, filename } = req.params;
  const targetPath = path.join(UPLOADS_DIR, tourId, 'thumbnails', filename);
  if (fs.existsSync(targetPath)) return next();

  // Try finding master asset
  const ext = path.extname(filename);
  const base = path.basename(filename, ext).replace(/\.thumb$/, '');
  const candidateExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.PNG', '.JPEG'];
  let masterPath = null;
  for (const cExt of candidateExtensions) {
    const candidate = path.join(UPLOADS_DIR, tourId, `${base}${cExt}`);
    if (fs.existsSync(candidate)) {
      masterPath = candidate;
      break;
    }
  }

  if (masterPath) {
    try {
      const result = await ThumbnailService.generateThumbnail(masterPath, tourId);
      if (result && fs.existsSync(result.thumbnailDiskPath)) {
        return res.sendFile(result.thumbnailDiskPath);
      }
    } catch (e) {
      console.warn(`[Asset] Dynamic thumbnail generation failed for ${filename}:`, e.message);
    }
  }
  next();
});

app.use('/uploads/:tourId/previews/:filename', async (req, res, next) => {
  const { tourId, filename } = req.params;
  const targetPath = path.join(UPLOADS_DIR, tourId, 'previews', filename);
  if (fs.existsSync(targetPath)) return next();

  // Try finding master asset
  const ext = path.extname(filename);
  const base = path.basename(filename, ext).replace(/\.preview$/, '');
  const candidateExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.PNG', '.JPEG'];
  let masterPath = null;
  for (const cExt of candidateExtensions) {
    const candidate = path.join(UPLOADS_DIR, tourId, `${base}${cExt}`);
    if (fs.existsSync(candidate)) {
      masterPath = candidate;
      break;
    }
  }

  if (masterPath) {
    try {
      const result = await ThumbnailService.generatePreview(masterPath, tourId);
      if (result && fs.existsSync(result.previewDiskPath)) {
        return res.sendFile(result.previewDiskPath);
      }
    } catch (e) {
      console.warn(`[Asset] Dynamic preview generation failed for ${filename}:`, e.message);
    }
  }
  next();
});

// Static file serving with caching headers for tiles
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.includes(path.sep + 'tiles' + path.sep) || filePath.includes('/tiles/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Static file serving for published versions with immutable caching
app.use('/published', (req, res, next) => {
  // Prevent directory traversal on published route
  if (req.path.includes('..') || req.path.includes('//')) {
    return res.status(403).json({ error: 'Security violation: Access denied' });
  }
  next();
}, express.static(PUBLISHED_DIR, {
  setHeaders: (res, filePath) => {
    // Immutable cache headers for published version assets
    if (!filePath.endsWith('manifest.json')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    }
  }
}));

// API Routes
app.use('/api', appRoutes);

// APP_IS_PACKAGED='true'  → packaged EXE: use resourcesPath (inside .asar)
// APP_IS_PACKAGED='false' → dev mode (npm start): use relative path from __dirname
const frontendBuildDir = process.env.APP_IS_PACKAGED === 'true'
  ? path.join(process.env.ELECTRON_RESOURCES_PATH, 'app.asar', 'frontend', 'build')
  : path.resolve(__dirname, '../../../frontend/build');

if (fs.existsSync(frontendBuildDir)) {
  // 1. Intercept relative static asset requests from nested client-side routes (e.g. /viewer/static/*, /editor/static/*)
  app.use((req, res, next) => {
    const staticIdx = req.path.indexOf('/static/');
    if (staticIdx !== -1) {
      const relStaticPath = req.path.substring(staticIdx + 1);
      const targetFilePath = path.join(frontendBuildDir, relStaticPath);
      if (fs.existsSync(targetFilePath)) {
        return res.sendFile(targetFilePath);
      }
    }

    const knownRootAssets = ['favicon.png', 'logo.png', 'manifest.json', 'robots.txt'];
    const pathBase = path.basename(req.path);
    if (knownRootAssets.includes(pathBase)) {
      const assetPath = path.join(frontendBuildDir, pathBase);
      if (fs.existsSync(assetPath)) {
        return res.sendFile(assetPath);
      }
    }

    next();
  });

  // 2. Serve root static assets
  app.use(express.static(frontendBuildDir));

  // 3. Fallback for SPA HTML5 client-side routing
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/published')) return next();
    res.sendFile(path.join(frontendBuildDir, 'index.html'));
  });
} else {
  // Helpful root endpoint when running in split dev mode
  const pkg = require('../../package.json');
  app.get('/', (req, res) => {
    res.json({
      status: 'online',
      message: 'Virtual Tour Backend API is running',
      version: pkg.version || '1.1.4',
      frontendUrl: env.CLIENT_URL || 'http://localhost:3000',
      apiPrefix: '/api',
      endpoints: {
        version: '/api/version',
        tours: '/api/tours',
        hotspots: '/api/hotspots'
      }
    });
  });
}

// 404 Handler
app.use(notFoundMiddleware);

// Global Error Handler
app.use(errorMiddleware);

module.exports = app;
