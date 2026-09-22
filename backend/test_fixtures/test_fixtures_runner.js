const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const {
  createValidPng,
  createValidEquirectangularJpeg,
  createValidMp3,
  createValidMp4,
  createValidSvg
} = require('./media_fixtures');
const { validateImageFile, inspectMagicBytes } = require('../src/shared/utils/imageValidator.util');

const tmpDir = path.join(os.tmpdir(), `fixtures_test_${Date.now()}`);
fs.mkdirSync(tmpDir, { recursive: true });

console.log('Testing Media Fixtures Generation...');

// 1. JPEG
const jpegPath = path.join(tmpDir, 'pano_test.jpg');
fs.writeFileSync(jpegPath, createValidEquirectangularJpeg(512, 256));
const jpegInfo = validateImageFile(jpegPath);
console.log('JPEG Info:', jpegInfo);
assert.strictEqual(jpegInfo.format, 'jpeg');
assert.strictEqual(jpegInfo.width, 512);
assert.strictEqual(jpegInfo.height, 256);
assert.strictEqual(jpegInfo.isEquirectangular, true);

// 2. PNG
const pngPath = path.join(tmpDir, 'floor_test.png');
fs.writeFileSync(pngPath, createValidPng(200, 150));
const pngInfo = validateImageFile(pngPath);
console.log('PNG Info:', pngInfo);
assert.strictEqual(pngInfo.format, 'png');
assert.strictEqual(pngInfo.width, 200);
assert.strictEqual(pngInfo.height, 150);

// 3. MP3
const mp3Path = path.join(tmpDir, 'audio_test.mp3');
fs.writeFileSync(mp3Path, createValidMp3());
const mp3Magic = inspectMagicBytes(fs.readFileSync(mp3Path));
console.log('MP3 Magic:', mp3Magic);
assert.strictEqual(mp3Magic.format, 'mp3');

// 4. MP4
const mp4Path = path.join(tmpDir, 'video_test.mp4');
fs.writeFileSync(mp4Path, createValidMp4());
const mp4Magic = inspectMagicBytes(fs.readFileSync(mp4Path));
console.log('MP4 Magic:', mp4Magic);
assert.strictEqual(mp4Magic.format, 'mp4');

// 5. SVG
const svgPath = path.join(tmpDir, 'icon_test.svg');
fs.writeFileSync(svgPath, createValidSvg());
const svgInfo = validateImageFile(svgPath);
console.log('SVG Info:', svgInfo);
assert.strictEqual(svgInfo.format, 'svg');

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('✅ ALL MEDIA FIXTURES ARE 100% VALID STANDARD BINARY DATA!');
