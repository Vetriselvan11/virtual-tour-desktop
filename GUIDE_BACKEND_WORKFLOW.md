# 360TOOL Backend Workflow Guide
**Developer:** Vettriselvan (Full Stack Developer & MERN Stack Developer)

This guide details the internal logic of the isolated Express server.

## 1. Upload & Validation Pipeline

When a user drags and drops a folder of panoramas, the following pipeline activates:

1. **Multer Ingestion:** `multer` receives the binary stream and writes the original Master image directly to the disk (`/uploads/master/`).
2. **Sharp Validation:** The `sharp` image processor scans the Master to verify dimensions. Files that are too small or not equirectangular are rejected.
3. **Thumbnail Generation:** A lightweight thumbnail is immediately generated and sent back to the frontend so the React UI can update instantly.
4. **Preview Generation:** A slightly larger Level 2 preview is generated for initial scene loading.

## 2. Multi-Resolution Tile Generation

If the uploaded image is exceptionally large (e.g., width >= 3840px), the `TileGeneratorService` kicks in.

- **Pyramid Slicing:** The service calculates multiple Levels of Detail (LODs) (e.g., 8K $\rightarrow$ 4K $\rightarrow$ 2K) and slices the image into 512x512 pixel tiles.
- **Metadata Generation:** A `tiles` configuration object containing the max LOD and grid layout is constructed.
- **Important Link:** The backend *must* attach this `tiles` object to the scene metadata before passing it to the frontend. Without this property, the frontend `SceneManager` will not know tiles exist and will forcefully download the 150MB master file, causing severe lag.

## 3. Data Persistence

The backend exclusively uses a local File System / JSON database approach. 
- No MongoDB or external databases are required. 
- Project structure remains entirely portable (ready for standalone ZIP export).
