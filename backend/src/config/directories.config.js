const env = require('./env.config');
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '../../');
const baseDataDir = process.env.VIRTUAL_TOUR_DATA_DIR || ROOT_DIR;
const TOURS_DIR = path.join(baseDataDir, env.TOURS_DIR || 'tours');
const UPLOADS_DIR = path.join(baseDataDir, env.UPLOAD_DIR || 'uploads');
const EXPORT_DIR = path.join(baseDataDir, env.EXPORT_DIR || 'export');
const PUBLISHED_DIR = path.join(baseDataDir, env.PUBLISHED_DIR || 'data/published');
const ANALYSIS_DIR = path.join(baseDataDir, env.ANALYSIS_DIR || 'data/scene-analysis');
const ANALYTICS_DIR = path.join(baseDataDir, env.ANALYTICS_DIR || 'data/analytics');

if (!fs.existsSync(TOURS_DIR)) fs.mkdirSync(TOURS_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });
if (!fs.existsSync(PUBLISHED_DIR)) fs.mkdirSync(PUBLISHED_DIR, { recursive: true });
if (!fs.existsSync(ANALYSIS_DIR)) fs.mkdirSync(ANALYSIS_DIR, { recursive: true });
if (!fs.existsSync(ANALYTICS_DIR)) fs.mkdirSync(ANALYTICS_DIR, { recursive: true });

module.exports = {
  ROOT_DIR,
  TOURS_DIR,
  UPLOADS_DIR,
  EXPORT_DIR,
  PUBLISHED_DIR,
  ANALYSIS_DIR,
  ANALYTICS_DIR
};
