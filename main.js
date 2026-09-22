const { app, BrowserWindow, shell, dialog } = require('electron');
const { fork } = require('child_process');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');

// Configure auto updater logging
log.transports.file.level = 'info';
autoUpdater.logger = log;
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Ensure all console logs from backend and main process are saved to disk
if (log.functions) {
  Object.assign(console, log.functions);
}

process.on('uncaughtException', (err) => {
  log.error('Uncaught Exception in Main Process:', err);
  dialog.showErrorBox('Virtual Tour Engine Error', (err && err.stack) || String(err));
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection in Main Process:', reason);
});

// Set environment variables before booting backend
process.env.ELECTRON_RUN = 'true';
process.env.SKIP_MONGO = 'true';
process.env.NODE_ENV = 'production';
process.env.APP_IS_PACKAGED = app.isPackaged ? 'true' : 'false';
process.env.ELECTRON_RESOURCES_PATH = process.resourcesPath;

// Set data directory for saving tours and uploads safely
const userDataPath = app.getPath('userData');
process.env.VIRTUAL_TOUR_DATA_DIR = path.join(userDataPath, 'data');
if (!fs.existsSync(process.env.VIRTUAL_TOUR_DATA_DIR)) {
  fs.mkdirSync(process.env.VIRTUAL_TOUR_DATA_DIR, { recursive: true });
}

let mainWindow = null;
let serverPort = null;

function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    log.info('Checking for application updates...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info.version);
  });

  autoUpdater.on('update-not-available', () => {
    log.info('Application is up to date.');
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-Updater notice:', err == null ? 'unknown' : (err.stack || err).toString());
  });

  autoUpdater.on('download-progress', (progressObj) => {
    log.info(`Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent.toFixed(1)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info.version);
    if (mainWindow && !mainWindow.isDestroyed()) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: `Version ${info.version} has been downloaded.`,
        detail: 'Restart the application to apply the update immediately.',
        buttons: ['Restart Now', 'Update on Exit'],
        defaultId: 0,
        cancelId: 1
      }).then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall(false, true);
        }
      });
    }
  });

  // Check for updates on launch and hourly
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      log.warn('Auto-update check failed:', err.message);
    });
    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 60 * 60 * 1000);
  }
}

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Virtual Tour Engine',
    backgroundColor: '#0c0f0d',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webgl: true,
      backgroundThrottling: false,
    },
  });

  const appUrl = `http://127.0.0.1:${port}`;
  console.log(`Loading application from: ${appUrl}`);
  
  await mainWindow.loadURL(appUrl);

  // Open internal routes (like /viewer/*) in a hardware-accelerated Electron window,
  // while redirecting external links to the user's default browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isInternal = url.startsWith(`http://127.0.0.1:${port}`) ||
                       url.startsWith(`http://localhost:${port}`) ||
                       url.startsWith('http://127.0.0.1') ||
                       url.startsWith('http://localhost');

    if (isInternal) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 1360,
          height: 860,
          backgroundColor: '#0c0f0d',
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webgl: true,
            backgroundThrottling: false,
          }
        }
      };
    }

    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    // 1. Start the embedded backend server in a separate child process
    // This prevents heavy operations like large file uploads from blocking the UI thread
    serverPort = await new Promise((resolve, reject) => {
      const serverPath = path.join(__dirname, 'backend', 'src', 'app', 'server.js');
      const backendProcess = fork(serverPath, [], {
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
      });

      backendProcess.stdout.on('data', (data) => console.log(`[Backend] ${data}`));
      backendProcess.stderr.on('data', (data) => console.error(`[Backend] ${data}`));

      backendProcess.on('message', (msg) => {
        if (msg && msg.type === 'PORT') resolve(msg.port);
        if (msg && msg.type === 'ERROR') reject(new Error(msg.error));
      });

      backendProcess.on('error', reject);
      
      app.on('before-quit', () => {
        if (backendProcess) backendProcess.kill();
      });
    });
    
    console.log(`Backend initialized successfully on port ${serverPort}`);

    // 2. Open Desktop Window
    await createWindow(serverPort);

    // 3. Initialize Auto Updater
    setupAutoUpdater();
  } catch (err) {
    log.error('Failed to initialize desktop application:', err);
    dialog.showErrorBox(
      'Virtual Tour Engine - Launch Failed',
      `Failed to initialize desktop application:\n\n${(err && err.stack) || String(err)}`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && serverPort) {
    createWindow(serverPort);
  }
});
