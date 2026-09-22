# 360TOOL Performance Guide
**Developer:** Vettriselvan (Full Stack Developer & MERN Stack Developer)

This guide covers the core architectural principles, optimization techniques, and debugging strategies required to maintain the Zero-Stutter Performance Architecture.

## 1. Multi-Resolution Tile Streaming (`TileManager`)

The `TileManager` is the most critical performance component for rendering massive panoramas (8K, 12K, 16K) inside the Electron runtime without freezing the event loop or exceeding GPU VRAM limits.

**Core Principles:**
- **Demand-Driven Loading:** Tiles are only loaded when they enter the camera's viewport (Frustum Culling).
- **Viewport Priority:** Tiles directly in the center of the camera's direction are prioritized over peripheral tiles using a dot-product sorting algorithm.
- **Bounded Concurrency:** The maximum number of simultaneous network requests or file reads is strictly bounded (e.g., `maxConcurrentLoads = 4`). This prevents V8 garbage collection spikes and CPU locking.
- **Strict LRU Cache:** Old tiles are aggressively evicted from GPU memory.

**Important Rule:** The `TileManager` is explicitly enabled **only for the Electron runtime**. The browser relies on a different, natively smooth progressive loading pipeline.

## 2. Device Profiling (`DeviceProfile.js`)

The `DeviceProfile` module acts as an automatic throttle for hardware limitations.

**Capabilities Adjusted:**
- **`effectiveDpr`**: Device Pixel Ratio is artificially capped to `1.0` on low-end integrated graphics to prevent 4K screens from causing WebGL context loss.
- **`maxGpuTextures`**: High-end machines can cache 5 adjacent panoramas in VRAM, while low-end machines are restricted to 2.
- **`maxAdjacentPreloads`**: Determines how many neighboring scenes the application should pre-fetch in the background over the network.

*To force test the low-end profile locally:*
```javascript
localStorage.setItem('editor_performance_profile', 'low');
```

## 3. Memory Lifecycle & Leaks

WebGL applications in React are incredibly prone to severe memory leaks due to "abandoned" textures.

### The Problem
If a component unmounts but leaves behind a `THREE.Texture` reference, the browser's garbage collector cannot clear the VRAM.

### The Solution
Every single texture, material, and geometry must have an explicit disposal lifecycle.
- Call `.dispose()` on all Three.js objects when a scene transitions.
- Destroy `ImageBitmap` objects immediately after uploading them to the GPU.
- Revoke `Blob` or `ObjectURLs` as soon as the image loads.

## 4. Debugging Frame Drops (Stuttering)

If the application drops below 60fps (or stutters above 16.67ms frame times), investigate the following pipeline stages:

1. **Decoding (CPU):** Are too many high-resolution `ImageBitmap` decodes happening synchronously? (Fix: Check `uploadConcurrency`).
2. **GPU Upload (PCIe):** Is the application trying to send a massive 8K image to the GPU in a single frame? (Fix: Ensure TileManager is active).
3. **React Thrashing (Main Thread):** Is the camera's `yaw` and `pitch` bound to a React `useState` hook, causing the entire editor to re-render 60 times a second? (Fix: Keep camera variables strictly in imperative Three.js space or use `useRef`).
