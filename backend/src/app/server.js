const env = require('../config/env.config');
const app = require('./app');
const { connectDatabase } = require('../database/connection');

console.log('--- Environment Configuration ---');
console.log(`PORT: ${env.PORT}`);
console.log(`NODE_ENV: ${env.NODE_ENV}`);
console.log(`CLIENT_URL: ${env.CLIENT_URL}`);
console.log('---------------------------------');

// Helper to listen on port with automatic fallback if EADDRINUSE occurs
function listenOnPort(targetPort) {
  return new Promise((resolve, reject) => {
    const server = app.listen(targetPort, '127.0.0.1', () => {
      console.log(`✅ Virtual Tour Backend running on http://127.0.0.1:${targetPort}`);
      process.env.PORT = String(targetPort);
      resolve({ server, port: targetPort });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`⚠️ Port ${targetPort} is occupied. Automatically trying port ${targetPort + 1}...`);
        // Seamlessly try next available port
        resolve(listenOnPort(targetPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

async function startServer() {
  try {
    // 1. Connect to Database (Mongo or local JSON fallback)
    await connectDatabase();

    // 2. Start Express Server with automatic port increment on conflict
    const initialPort = parseInt(process.env.PORT || env.PORT || 5000, 10);
    const { port } = await listenOnPort(initialPort);
    
    if (process.send) {
      process.send({ type: 'PORT', port });
    }
    
    return port;
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    if (process.send) {
      process.send({ type: 'ERROR', error: error.message });
    }
    throw error;
  }
}

// Export the promise resolving to the active port
module.exports = startServer();
