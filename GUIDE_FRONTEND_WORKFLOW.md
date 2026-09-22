# 360TOOL Frontend Workflow Guide
**Developer:** Vettriselvan (Full Stack Developer & MERN Stack Developer)

This guide details the React UI structure and the WebGL rendering architecture.

## 1. Scene Management (`SceneManager.js`)

The `SceneManager` handles the seamless transition between panoramas without jarring black screens or flashes.

**Loading Sequence:**
1. **Preview Load:** Immediately loads a lightweight, blurred preview image into GPU RAM to give instant visual feedback.
2. **Atomic Swap:** Smoothly fades the texture opacity instead of destroying the WebGL geometry.
3. **Master Upgrade:** 
   - *In Browser:* Queues a background download of the massive Master image and atomically replaces the preview when decoded.
   - *In Electron:* Routes the high-resolution Master into the `TileManager` for multi-resolution streaming.

## 2. WebGL Core (`ViewerCore.js`)

The application uses a single authoritative `THREE.WebGLRenderer` context.

**Rules:**
- Never instantiate multiple `WebGLRenderer` objects. Browsers strictly limit active contexts (usually ~8-16), and each context claims heavy GPU resources.
- Demand-driven rendering: The `requestAnimationFrame` loop only draws a new frame when the camera angle changes, an animation plays, or a texture is updated. When idle, rendering halts.

## 3. React UI Optimization

With large projects (500+ scenes), standard React patterns can cause severe lag.

**Optimizations:**
- **Virtualized Lists:** The sidebar and timeline only render the components currently visible on screen.
- **Batched State Commits:** During a massive folder import, the frontend receives file events. Instead of triggering a global React state update for every single file, updates are grouped and batched.
- **Decoupled Camera:** Camera rotations (yaw/pitch) bypass React entirely to prevent 60fps re-renders of the DOM.
