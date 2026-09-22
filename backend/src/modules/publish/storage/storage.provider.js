/**
 * Abstract StorageProvider Interface.
 * Defines the contract for published tour version storage.
 * Easily extensible to S3/Cloud storage in future phases without altering publishing workflows.
 */
class StorageProvider {
  /**
   * Initializes storage directories or containers for a tour.
   * @param {string} tourId
   * @returns {Promise<void>}
   */
  async initTour(tourId) {
    throw new Error('StorageProvider.initTour must be implemented');
  }

  /**
   * Creates a dedicated immutable version directory/namespace.
   * @param {string} tourId
   * @param {string} versionId
   * @returns {Promise<string>} Version root path or identifier
   */
  async createVersion(tourId, versionId) {
    throw new Error('StorageProvider.createVersion must be implemented');
  }

  /**
   * Writes the sanitized public manifest.json into the version storage.
   * @param {string} tourId
   * @param {string} versionId
   * @param {Object} manifestObj
   * @returns {Promise<string>} Manifest path or URL
   */
  async saveManifest(tourId, versionId, manifestObj) {
    throw new Error('StorageProvider.saveManifest must be implemented');
  }

  /**
   * Reads and parses manifest.json for a specific version.
   * @param {string} tourId
   * @param {string} versionId
   * @returns {Promise<Object>}
   */
  async readManifest(tourId, versionId) {
    throw new Error('StorageProvider.readManifest must be implemented');
  }

  /**
   * Copies, links, or uploads an asset into the version storage.
   * @param {string} tourId
   * @param {string} versionId
   * @param {string} sourceDiskPath
   * @param {string} targetRelativePath
   * @param {Object} [options]
   * @returns {Promise<{ relativePath: string, sizeBytes: number, hash: string }>}
   */
  async storeAsset(tourId, versionId, sourceDiskPath, targetRelativePath, options = {}) {
    throw new Error('StorageProvider.storeAsset must be implemented');
  }

  /**
   * Stores a multi-resolution tile pyramid directory structure for a scene.
   * @param {string} tourId
   * @param {string} versionId
   * @param {string} sceneBase
   * @param {string} sourceTilesDir
   * @returns {Promise<{ totalTiles: number, sizeBytes: number }>}
   */
  async storeTilePyramid(tourId, versionId, sceneBase, sourceTilesDir) {
    throw new Error('StorageProvider.storeTilePyramid must be implemented');
  }

  /**
   * Resolves safe disk path for serving a published asset.
   * @param {string} tourId
   * @param {string} versionId
   * @param {string} targetRelativePath
   * @returns {string} Absolute disk path
   */
  getAssetDiskPath(tourId, versionId, targetRelativePath) {
    throw new Error('StorageProvider.getAssetDiskPath must be implemented');
  }

  /**
   * Deletes a specific published version.
   * @param {string} tourId
   * @param {string} versionId
   * @returns {Promise<boolean>}
   */
  async deleteVersion(tourId, versionId) {
    throw new Error('StorageProvider.deleteVersion must be implemented');
  }
}

module.exports = StorageProvider;
