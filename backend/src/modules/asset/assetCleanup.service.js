const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR } = require('../../config/directories.config');
const { isPathSafe } = require('../../shared/utils/assetPath.util');
const AssetScannerService = require('./assetScanner.service');
const AssetReferenceService = require('./assetReference.service');

const DEFAULT_GRACE_PERIOD_MS = 5 * 60 * 1000; // 5 minutes

class AssetCleanupService {
  /**
   * Cleans up confirmed orphan assets and stale temporary files.
   * Enforces safety buffer, double reference re-check, and path security.
   * 
   * @param {Object} [options]
   * @param {string} [options.tourId] - Optional specific tour to scope cleanup to
   * @param {number} [options.gracePeriodMs=300000] - Safety grace buffer in milliseconds
   * @param {boolean} [options.dryRun=false] - If true, simulates deletion without removing files
   * @returns {Promise<Object>} Execution result report
   */
  static async cleanupOrphanAssets({
    tourId = null,
    gracePeriodMs = DEFAULT_GRACE_PERIOD_MS,
    dryRun = false
  } = {}) {
    // 1. Initial scan
    const scanReport = await AssetScannerService.scanOrphanAssets({ tourId });
    
    // 2. Fresh re-verification of active references to prevent race conditions
    const { activePaths } = await AssetReferenceService.getAllActiveAssetReferences();

    const now = Date.now();
    const deletedFiles = [];
    const skippedFiles = [];
    const failedFiles = [];
    let reclaimedBytes = 0;

    const allCandidates = [...scanReport.orphanAssets, ...scanReport.tempAssets];

    for (const candidate of allCandidates) {
      const { relativePath, absolutePath, sizeBytes, ageMinutes, isTemp } = candidate;

      // Security check: Ensure file is strictly inside UPLOADS_DIR
      if (!isPathSafe(UPLOADS_DIR, relativePath)) {
        failedFiles.push({
          relativePath,
          reason: 'Security violation: Path outside uploads root'
        });
        continue;
      }

      // Fresh reference re-check: Guarantee 0 references exist
      if (!isTemp && activePaths.has(relativePath)) {
        skippedFiles.push({
          relativePath,
          reason: 'Active reference detected in database during final confirmation'
        });
        continue;
      }

      // Age / Grace period check
      const ageMs = (ageMinutes || 0) * 60 * 1000;
      if (ageMs < gracePeriodMs) {
        skippedFiles.push({
          relativePath,
          reason: `Protected by grace period (age ${ageMinutes}m < ${(gracePeriodMs / 60000)}m)`
        });
        continue;
      }

      // Execute or simulate deletion
      if (dryRun) {
        deletedFiles.push({
          relativePath,
          sizeBytes,
          simulated: true
        });
        reclaimedBytes += sizeBytes;
      } else {
        try {
          if (fs.existsSync(absolutePath)) {
            fs.unlinkSync(absolutePath);
            deletedFiles.push({
              relativePath,
              sizeBytes,
              deletedAt: new Date().toISOString()
            });
            reclaimedBytes += sizeBytes;
          }
        } catch (delErr) {
          failedFiles.push({
            relativePath,
            reason: delErr.message
          });
        }
      }
    }

    // 3. Clean up empty subdirectories if not dryRun
    if (!dryRun) {
      this._removeEmptyDirectories(UPLOADS_DIR);
    }

    return {
      timestamp: new Date().toISOString(),
      dryRun,
      gracePeriodMinutes: gracePeriodMs / 60000,
      scope: tourId ? `tour:${tourId}` : 'all',
      summary: {
        totalScanned: scanReport.summary.totalFilesCount,
        candidatesCount: allCandidates.length,
        deletedCount: deletedFiles.length,
        skippedCount: skippedFiles.length,
        failedCount: failedFiles.length,
        reclaimedBytes,
        reclaimedMB: Math.round((reclaimedBytes / (1024 * 1024)) * 100) / 100
      },
      deletedFiles,
      skippedFiles,
      failedFiles
    };
  }

  /**
   * Recursively removes empty subdirectories in uploads directory,
   * preserving standard shared directories (audio, icons).
   * 
   * @private
   * @param {string} dirPath
   */
  static _removeEmptyDirectories(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const reservedDirs = ['audio', 'icons'];
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullSubDir = path.join(dirPath, entry.name);
        this._removeEmptyDirectories(fullSubDir);

        try {
          // Check if directory became empty
          const remaining = fs.readdirSync(fullSubDir);
          if (remaining.length === 0 && !reservedDirs.includes(entry.name) && fullSubDir !== UPLOADS_DIR) {
            fs.rmdirSync(fullSubDir);
          }
        } catch {
          // Ignore errors removing non-empty or locked dirs
        }
      }
    }
  }
}

module.exports = AssetCleanupService;
