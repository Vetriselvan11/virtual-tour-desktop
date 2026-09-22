const fs = require('fs');
const path = require('path');

const srcLoader = path.resolve(__dirname, '../frontend/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
const srcUtils = path.resolve(__dirname, '../frontend/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js');

let loaderContent = fs.readFileSync(srcLoader, 'utf8');
let utilsContent = fs.readFileSync(srcUtils, 'utf8');

// Extract toTrianglesDrawMode function from utils
const match = utilsContent.match(/function toTrianglesDrawMode\s*\([\s\S]*?\n\}/);
const toTrianglesDrawModeFunc = match ? match[0] : '';

// Replace imports in loaderContent
loaderContent = loaderContent.replace(/from\s+['"]three['"];?/g, "from './three.module.min.js';");
loaderContent = loaderContent.replace(/import\s*\{\s*toTrianglesDrawMode\s*\}\s*from\s*['"][^'"]+['"];?/g, toTrianglesDrawModeFunc);

const destVendor = path.resolve(__dirname, 'export/vendor/GLTFLoader.js');
fs.writeFileSync(destVendor, loaderContent, 'utf8');
console.log('Created standalone vendor GLTFLoader.js:', fs.statSync(destVendor).size, 'bytes');
