const fs = require('fs');
const path = require('path');
const os = require('os');
const archiver = require('archiver');
const { AppError, ValidationError } = require('../src/shared/errors/AppError');

/**
 * Production-Grade Standalone Virtual Tour Exporter for 360TOOL.
 * Compiles a self-contained, deployment-agnostic WebGL/HTML5 virtual tour player bundle
 * with zero broken paths, single-source-of-truth asset resolution, strict asset validation,
 * and deterministic manifest generation.
 */
class ExportCompiler {
  /**
   * Main compilation entry point.
   */
  async compile(tourId, config, toursDir, uploadsDir, outputZipPath) {
    if (!tourId || typeof tourId !== 'string') throw new ValidationError('Invalid tourId provided for compilation');
    if (!config || typeof config !== 'object') throw new ValidationError('Invalid configuration object provided');
    if (!uploadsDir) throw new AppError('Uploads directory path is missing', 500);

    const stagingDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `export_${tourId}_${Date.now()}_`));

    try {
      const frontendBuildDir = path.resolve(__dirname, '../../frontend/build');
      
      if (!fs.existsSync(frontendBuildDir)) {
        throw new AppError('Frontend build directory not found. Please run "npm run build" in the frontend folder first.', 500);
      }

      // 1. Copy the entire React build to the staging directory
      this._copyDirectoryRecursiveSync(frontendBuildDir, stagingDir);

      // Ensure frontend public icons (e.g. chevron-blue.png) are also fully synchronized in staging/icons
      const frontendPublicIcons = path.resolve(__dirname, '../../frontend/public/icons');
      const stagingIconsDir = path.join(stagingDir, 'icons');
      if (fs.existsSync(frontendPublicIcons)) {
        if (!fs.existsSync(stagingIconsDir)) fs.mkdirSync(stagingIconsDir, { recursive: true });
        this._copyDirectoryRecursiveSync(frontendPublicIcons, stagingIconsDir);
      }

      // 2. Process Configuration & Localize Media Assets
      const exportedConfig = JSON.parse(JSON.stringify(config)); // Deep clone
      const mediaDestDir = path.join(stagingDir, 'assets', 'media');
      if (!fs.existsSync(mediaDestDir)) {
        fs.mkdirSync(mediaDestDir, { recursive: true });
      }

      // Guarantee essential preset icons (chevron-blue.png) are pre-populated in assets/media
      const chevronPreset = path.join(frontendPublicIcons, 'chevron-blue.png');
      if (fs.existsSync(chevronPreset)) {
        const destChevron = path.join(mediaDestDir, 'chevron-blue.png');
        if (!fs.existsSync(destChevron)) {
          fs.copyFileSync(chevronPreset, destChevron);
        }
      }

      const mediaPromises = [];
      const assetManifest = [];
      const copiedFilenames = new Set();

      /**
       * Process, validate, and localize a media asset.
       * @param {string} url - The asset reference URL
       * @param {string} assetType - Type of asset (e.g. 'panorama', 'thumbnail', 'audio', 'logo')
       * @param {boolean} isRequired - Whether missing asset triggers fatal export failure
       */
      const processAsset = (url, assetType = 'media', isRequired = false) => {
        if (!url || typeof url !== 'string') return url;
        if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
          return url;
        }

        // Directory traversal defense: reject attempts to escape
        if (url.includes('..')) {
          throw new ValidationError(`Directory traversal detected in asset URL: ${url}`);
        }

        const normalized = url.startsWith('/') ? url.substring(1) : url;

        // Comprehensive candidate search across uploads, build, and public directories
        const candidatePaths = [
          path.normalize(path.join(uploadsDir, '..', normalized)),
          path.normalize(path.join(uploadsDir, normalized)),
          path.normalize(path.join(frontendBuildDir, normalized)),
          path.normalize(path.join(frontendBuildDir, '..', 'public', normalized)),
          path.normalize(path.join(stagingDir, normalized)),
          path.normalize(path.join(__dirname, '../../frontend/public', normalized)),
        ];

        let sourcePath = null;
        for (const candidate of candidatePaths) {
          if (fs.existsSync(candidate) && !fs.statSync(candidate).isDirectory()) {
            sourcePath = candidate;
            break;
          }
        }

        // Search by basename across all relevant asset directories
        if (!sourcePath) {
          const basename = path.basename(normalized);
          const strippedBasename = basename.replace(/^\d+_/, '');
          const searchIn = [
            uploadsDir,
            path.join(uploadsDir, '..'),
            path.join(uploadsDir, 'icons'),
            path.join(frontendBuildDir, 'icons'),
            path.join(frontendBuildDir, '..', 'public', 'icons'),
            path.join(stagingDir, 'icons'),
            stagingIconsDir
          ];
          outer: for (const dir of searchIn) {
            if (!fs.existsSync(dir)) continue;
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
              const sub = path.join(dir, entry);
              if (fs.statSync(sub).isDirectory()) {
                const candidate1 = path.join(sub, basename);
                const candidate2 = path.join(sub, strippedBasename);
                if (fs.existsSync(candidate1) && !fs.statSync(candidate1).isDirectory()) { sourcePath = candidate1; break outer; }
                if (fs.existsSync(candidate2) && !fs.statSync(candidate2).isDirectory()) { sourcePath = candidate2; break outer; }
              } else {
                if (entry === basename || entry === strippedBasename) {
                  sourcePath = sub;
                  break outer;
                }
              }
            }
          }
        }

        if (sourcePath) {
          const filename = path.basename(sourcePath);
          const destPath = path.join(mediaDestDir, filename);

          // Verify destination stays strictly within mediaDestDir (Directory traversal check)
          const resolvedDest = path.resolve(destPath);
          if (!resolvedDest.startsWith(path.resolve(stagingDir))) {
            throw new ValidationError(`Asset destination path escaped export staging directory: ${filename}`);
          }

          if (!copiedFilenames.has(filename)) {
            copiedFilenames.add(filename);
            const stat = fs.statSync(sourcePath);
            mediaPromises.push(fs.promises.copyFile(sourcePath, destPath));
            assetManifest.push({
              source: sourcePath,
              destination: `assets/media/${filename}`,
              type: assetType,
              sizeBytes: stat.size,
              reference: url
            });
          }

          return `./assets/media/${filename}`;
        }

        // If asset is strictly required (such as panorama or configured media), fail export
        if (isRequired) {
          throw new ValidationError(`Required ${assetType} asset is missing from disk: "${url}". Export aborted to prevent broken tour package.`);
        }

        console.warn(`[ExportCompiler] Optional asset not found during export: ${url}`);
        const fallbackFilename = path.basename(normalized);
        return `./assets/media/${fallbackFilename}`;
      };

      // Process Scene Assets
      if (exportedConfig.scenes && Array.isArray(exportedConfig.scenes)) {
        for (let i = 0; i < exportedConfig.scenes.length; i++) {
          const sc = exportedConfig.scenes[i];
          if (sc.image) sc.image = processAsset(sc.image, 'panorama', true);
          if (sc.thumbnail) sc.thumbnail = processAsset(sc.thumbnail, 'thumbnail', false);
          if (sc.preview) sc.preview = processAsset(sc.preview, 'preview', false);
          if (sc.ambientAudio) sc.ambientAudio = processAsset(sc.ambientAudio, 'audio', false);
          if (sc.narrationAudio) sc.narrationAudio = processAsset(sc.narrationAudio, 'audio', false);

          if (sc.hotspots && Array.isArray(sc.hotspots)) {
            for (let j = 0; j < sc.hotspots.length; j++) {
              const hs = sc.hotspots[j];
              if (hs.mediaUrl) hs.mediaUrl = processAsset(hs.mediaUrl, 'hotspot_media', false);
              if (hs.imageUrl) hs.imageUrl = processAsset(hs.imageUrl, 'hotspot_image', false);
              if (hs.videoUrl) hs.videoUrl = processAsset(hs.videoUrl, 'hotspot_video', false);
              if (hs.audioUrl) hs.audioUrl = processAsset(hs.audioUrl, 'hotspot_audio', false);
              if (hs.iconUrl) hs.iconUrl = processAsset(hs.iconUrl, 'hotspot_icon', false);
              if (hs.customIcon) hs.customIcon = processAsset(hs.customIcon, 'hotspot_icon', false);
              if (hs.icon && typeof hs.icon === 'string' && (hs.icon.includes('/') || hs.icon.includes('.'))) {
                hs.icon = processAsset(hs.icon, 'hotspot_icon', false);
              }
            }
          }
        }
      }

      // Process Global Assets
      if (exportedConfig.clientLogo) exportedConfig.clientLogo = processAsset(exportedConfig.clientLogo, 'client_logo', false);
      if (exportedConfig.ambientAudio) exportedConfig.ambientAudio = processAsset(exportedConfig.ambientAudio, 'ambient_audio', false);
      
      // Process floorplan (can be string URL or object with .image)
      if (typeof exportedConfig.floorplan === 'string') {
        exportedConfig.floorplan = processAsset(exportedConfig.floorplan, 'floorplan', false);
      } else if (exportedConfig.floorplan && exportedConfig.floorplan.image) {
        exportedConfig.floorplan.image = processAsset(exportedConfig.floorplan.image, 'floorplan', false);
      }

      if (typeof exportedConfig.floor2Plan === 'string') {
        exportedConfig.floor2Plan = processAsset(exportedConfig.floor2Plan, 'floorplan', false);
      } else if (exportedConfig.floor2Plan && exportedConfig.floor2Plan.image) {
        exportedConfig.floor2Plan.image = processAsset(exportedConfig.floor2Plan.image, 'floorplan', false);
      }

      // Comprehensive recursive sweep for any remaining /uploads/ or /icons/ references in custom properties
      const sweepObject = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          if (typeof val === 'string' && (val.includes('/uploads/') || val.includes('/icons/'))) {
            obj[key] = processAsset(val, key, false);
          } else if (typeof val === 'object') {
            sweepObject(val);
          }
        }
      };
      sweepObject(exportedConfig);

      // Wait for all file copies to complete
      await Promise.all(mediaPromises);

      // Audit exported configuration for leaked development or filesystem paths
      const serializedConfig = JSON.stringify(exportedConfig);
      const leakedPatterns = [
        /localhost:\d+/i,
        /127\.0\.0\.1:\d+/i,
        /[A-Z]:\\[^"'\s]+/i,
        /\/uploads\//i
      ];
      for (const pattern of leakedPatterns) {
        if (pattern.test(serializedConfig)) {
          throw new ValidationError(`Exported configuration contains forbidden absolute or environment path matching: ${pattern}`);
        }
      }

      // 3. Save deterministic config/tour.json
      const configDir = path.join(stagingDir, 'config');
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(path.join(configDir, 'tour.json'), JSON.stringify(exportedConfig, null, 2), 'utf8');

      // 4. Save manifest.json
      fs.writeFileSync(path.join(stagingDir, 'manifest.json'), JSON.stringify({
        tourId,
        title: exportedConfig.title,
        exportedAt: new Date().toISOString(),
        totalAssets: assetManifest.length,
        assets: assetManifest
      }, null, 2), 'utf8');

      // 5. Inject config into the React index.html
      const indexHtmlPath = path.join(stagingDir, 'index.html');
      if (fs.existsSync(indexHtmlPath)) {
        let htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
        const injection = `<script>window.__TOUR_CONFIG__ = ${JSON.stringify(exportedConfig)};</script>`;
        
        if (htmlContent.includes('</head>')) {
          htmlContent = htmlContent.replace('</head>', `${injection}</head>`);
        } else {
          htmlContent = htmlContent + injection;
        }
        
        fs.writeFileSync(indexHtmlPath, htmlContent, 'utf8');
      }

      // 6. Create ZIP archive
      const outputZipDir = path.dirname(outputZipPath);
      if (!fs.existsSync(outputZipDir)) {
        fs.mkdirSync(outputZipDir, { recursive: true });
      }
      await this._createZipArchive(stagingDir, outputZipPath);

    } finally {
      // Cleanup staging directory
      try {
        if (fs.existsSync(stagingDir)) {
          fs.rmSync(stagingDir, { recursive: true, force: true });
        }
      } catch (cleanupErr) {
        console.error(`[ExportCompiler] Failed to clean up staging directory: ${stagingDir}`, cleanupErr);
      }
    }

    const stat = fs.statSync(outputZipPath);
    return {
      zipPath: outputZipPath,
      totalFiles: fs.existsSync(outputZipPath) ? 1 : 0,
      sizeBytes: stat.size
    };
  }

  /**
   * Zips the entire staging directory tree into outputZipPath.
   * @private
   */
  _createZipArchive(sourceDir, outputZipPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputZipPath);
      const archive = typeof archiver === 'function'
        ? archiver('zip', { zlib: { level: 0 } })
        : new (archiver.ZipArchive || archiver.Archiver)({ zlib: { level: 0 } });

      output.on('close', () => {
        resolve();
      });

      output.on('error', (err) => {
        reject(err);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize().catch((err) => {
        reject(err);
      });
    });
  }

  /**
   * Helper to recursively copy a directory
   * @private
   */
  _copyDirectoryRecursiveSync(source, target) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    if (fs.lstatSync(source).isDirectory()) {
      const files = fs.readdirSync(source);
      files.forEach(file => {
        const curSource = path.join(source, file);
        const curTarget = path.join(target, file);
        if (fs.lstatSync(curSource).isDirectory()) {
          this._copyDirectoryRecursiveSync(curSource, curTarget);
        } else {
          fs.copyFileSync(curSource, curTarget);
        }
      });
    }
  }
}

module.exports = new ExportCompiler();
