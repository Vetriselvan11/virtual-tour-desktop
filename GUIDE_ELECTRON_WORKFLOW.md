# 360TOOL Electron Workflow Guide
**Developer:** Vettriselvan (Full Stack Developer & MERN Stack Developer)

This guide covers the architecture of the packaged Windows Executable (Electron) and its interaction with the frontend and backend.

## 1. Multi-Process Architecture

To achieve zero-stutter performance in a desktop environment, the 360TOOL executable is divided into multiple completely isolated processes.

### Main Process (`main.js`)
- Responsible for native OS integrations (Window creation, auto-updates).
- **GPU Handling:** No forced GPU flags (`force_high_performance_gpu`) are allowed. We rely strictly on Chromium's native heuristics to avoid SwiftShader software rendering fallbacks.

### UI Renderer (React Frontend)
- Runs inside a Chromium window without Node Integration.
- Handles WebGL rendering, DOM interactions, and the specialized Electron-only `TileManager` for multi-resolution streaming.

### Backend Process (Express Server)
- The Express server (`server.js`) is spawned as a detached child process using `child_process.fork()`.
- **Why?** Node.js is single-threaded. If the backend (running inside the main process) attempts to write a 100MB panorama to disk, it blocks the event loop, freezing the entire frontend UI. By forking it, file I/O is completely decoupled from the rendering engine.

## 2. IPC Communication

Because the Backend is a separate process, the Main Process must discover which port the Express server randomly bound to.
- The Backend uses `process.send({ type: 'server-started', port: PORT })`.
- The Main Process listens via `backendProcess.on('message')` and then passes the dynamic port to the React frontend.

## 3. Packaging & Distribution

The application is bundled using `electron-builder`.

**Build Sequence:**
1. `npm run build:frontend` $\rightarrow$ Compiles React to `frontend/build`.
2. `npm run dist` $\rightarrow$ Packages the Electron wrapper, Node.js backend, and compiled frontend into a single `Virtual Tour Engine Setup X.X.X.exe`.

> [!CAUTION]
> If `npm run dist` fails with an "Access is denied" error on `.dll` or `.exe` files, it means an instance of the application is running in the background. Use the Task Manager to force-kill `virtual-tour-desktop.exe` or `Virtual Tour Engine.exe` before rebuilding.
