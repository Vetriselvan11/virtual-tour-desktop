# Virtual Tour Studio — UI & Editor Documentation

Welcome to the official documentation for the **Virtual Tour Studio UI Editor and Viewer System**. This guide provides a complete reference for all interface components, controls, hotspot authoring panels, scene transition animation settings, and iconography.

---

## 1. Visual Aesthetics & Design System

The application is engineered with modern WebGL architecture, glassmorphic UI overlays, dark mode aesthetics, and crisp vector iconography.

- **Iconography (`react-icons` & `lucide-react`)**: All legacy text emojis have been replaced with vector SVG icons from FontAwesome 6 (`fa6`) and Lucide React.
- **Animations (`framer-motion`)**: Tab transitions, inspector panels, dialog modals, and floating toolbars use delta-timed spring and slide animations.
- **Responsive Layout**: Adapts automatically across desktop, tablet, and mobile browsers.

---

## 2. Editor Workspace Overview

```
 ┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
 │                                       EDITOR TOPBAR                                              │
 ├──────────────┬──────────────────────────────────────────────────────────────────┬────────────────┤
 │              │                                                                  │                │
 │   ROOMS      │                                                                  │   RIGHT        │
 │  SIDEBAR     │                    3D PANORAMA VIEWPORT                          │  INSPECTOR     │
 │  (Left)      │                   (WebGL 95° Wide View)                          │   PANEL        │
 │              │                                                                  │  (Right)       │
 │              │                                                                  │                │
 ├──────────────┴──────────────────────────────────────────────────────────────────┴────────────────┤
 │                                  BOTTOM SEQUENCER & TIMELINE                                     │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Topbar Controls (`EditorTopbar.jsx`)

The top navigation bar provides high-level workspace actions:

| Action / Button | Icon | Functionality |
| :--- | :---: | :--- |
| **Tour Title** | `Pencil` | Double-click to rename tour title inline |
| **Edit / Preview Toggle** | `Pencil` / `Eye` | Switches between interactive editing and instant preview mode |
| **Save Status** | `Check` / `RefreshCw` | Indicates live auto-save synchronization state |
| **Bulk Import** | `FolderOpen` | Imports folder of room panorama images simultaneously |
| **Ambient / Narration Audio** | `Volume2` / `Mic` | Audio panel quick toggles |
| **Guided Walk Recorder** | `Clapperboard` | Record and preview automated camera walkthroughs |
| **Open Standalone Viewer** | `ExternalLink` | Launches the tour in standalone presentation mode |
| **Export Tour** | `Download` | Exports offline ZIP bundle or standalone package |

---

## 4. Left Sidebar: Rooms Gallery (`ScenesSidebar.js`)

Manage all panoramic room scenes in your virtual tour:

- **Start Scene Badge (`Crown`)**: Marks the initial entry room when viewers open the tour.
- **Hotspot Count Badge (`Link2`)**: Displays the number of active interactive hotspots in each scene.
- **Room Search**: Filter rooms by name or audio content.
- **Add Room (`Plus`)**: Upload single panorama image or 360 sphere asset.

---

## 5. Central 3D Panorama Viewport (`PanoramaViewer.js` & `ViewerCore.js`)

The main WebGL 3D canvas renders high-resolution equirectangular 360° panoramas:

- **Unzoomed 95° Wide Perspective**: Opens in a standard wide-angle FOV perspective to show the full room skyline and horizon.
- **Interactive Panning**: Click and drag to look around in 360° space.
- **Mouse Wheel Zoom**: Scroll to zoom in (`25° FOV`) or zoom out (`105° FOV`).
- **Context Menu**: Right-click anywhere on the panorama to add a hotspot, paste style, or set room orientation.

---

## 6. Floating Hotspot Toolbar (`FloatingHotspotToolbar.jsx`)

When a hotspot is selected in the 3D viewport, a floating glassmorphic toolbar appears for quick edits:

1. **Hotspot Icon Picker**: Change icon glyphs directly on the canvas (`Arrow`, `Up`, `Down`, `Info`, `Link`, `Video`, `Star`, `Circle`, `Stairs`, `Door`, `Sound`, `Eye`).
2. **Color Palette Swatches**: Select custom hex color fills and glowing radial halos.
3. **Animation Presets**: Apply `Static`, `Pulse`, `Glow`, `Bounce`, or `Spin` motion effects.
4. **Target Room Navigation Dropdown**: Select target room for navigation hotspots.
5. **Delete Button**: Remove hotspot from scene.

---

## 7. Right Inspector Panel (`EditorPage.js` & `SceneSettingsPanel.jsx`)

The right sidebar features 4 animated inspector tabs (`framer-motion` slide transitions):

### A. Hotspot Tab (`HotspotPanel.js`)
- **Type Selection**: `Navigation`, `Information`, `External Link`, `Video`, or `Audio`.
- **Coordinates Mixer**: Fine-tune `Yaw` (horizontal angle) and `Pitch` (vertical elevation).
- **Styling**: Customize Size (`20px` to `80px`), Opacity (`0.1` to `1.0`), Fill Color, and Icon Glyph.
- **Tooltip Label**: Set text label displayed on hover.

### B. Scene Tab (`SceneSettingsPanel.jsx`)
- **Room Renaming**: Edit scene name inline.
- **Start Scene Action**: Set room as the default starting tour entry point (`Crown`).
- **360 Camera FOV Slider**: Adjust baseline unzoomed perspective angle (`60°` to `105°`, default `95°`).
- **Scene Transition Animations**:
  - `Smooth Fade`: Crossfade to dark backdrop and fade into target room.
  - `Zoom In Focus`: Forward camera focal push transition.
  - `Zoom Pull Back`: Cinematic wide pull-back zoom transition.
  - `Portal Warp`: Hyperspace camera FOV acceleration effect.
  - `Transition Duration Slider`: Adjust speed from `0.2s` to `2.0s`.
- **Capture Start Angle Button (`Target`)**: Locks current 3D view orientation (yaw/pitch) as the room's default starting view angle.

### C. Audio Tab (`AudioPanel.jsx`)
- **Ambient Background Audio**: Upload spatial background music/ambient sounds.
- **Voiceover Narration**: Add room voiceover audio tracks.
- **Subtitles & Cues**: Synchronize timed subtitle text cues.

### D. Timeline Tab (`KeyframeTimeline.jsx`)
- **Camera Keyframes**: Record camera position snapshots (`Yaw`, `Pitch`, `FOV`, `Duration`).
- **Cinematic Sequencer**: Play back keyframe animations automatically during guided walks.

---

## 8. Hotspot 3D Canvas Vector Glyphs (`HotspotIcons.js`)

All hotspot icons are dynamically rendered onto anti-aliased 2D canvas textures and mapped to 3D Three.js sphere sprites:

| Icon Name | Vector Glyph Renderer | Visual Description |
| :--- | :---: | :--- |
| `door` | Door Frame & Knob | Closed door outline with circular brass knob |
| `stairs` | Staircase Steps | Step-by-step staircase vector path |
| `sound` / `audio` | Speaker & Sound Waves | Speaker cone with outer audio wave arcs |
| `eye` | Eye & Pupil | Almond eye outline with centered pupil dot |
| `circle` | Target Circle | Solid filled inner target circle |
| `star` | 5-Point Star | Geometric 5-pointed star fill |
| `info` | Vector Info Symbol | Clean info 'i' mark |
| `link` | Interlocking Chain Links | Dual interlocking chain link rings |
| `video` | Play Triangle | Centered play triangle button |
| `arrow` / `arrow-up` / `arrow-down` | Navigation Chevrons | Directional pathway navigation chevrons |

---

## 9. Viewer Presentation Mode (`ViewerPage.js` & `ViewerControls.jsx`)

When viewers open the published tour:

- **Top Bar**: Displays Tour Title, Room Subtitle, and **Fullscreen Toggle (`Compress` / `Expand`)**.
- **Cinematic Walk Overlay**: Play, Pause, Skip Back, and Skip Forward controls for automated tours.
- **Floorplan Minimap Overlay (`MiniMap`)**: Interactive radar floorplan overlay showing current room location and camera yaw direction.
- **Directional Pad Console**: 8-way directional navigation pad, auto-rotate toggle, and zoom controls.
- **Information Dialog (`ViewerInfoModal`)**: Modal dialog for viewing embedded videos (YouTube/native), audio clips, and detailed text notes.

---

## Summary of Verification & Quality Assurance

- **Build Status**: Verified via `npm run build` with **0 errors**.
- **Iconography**: 100% vector SVG icons (`react-icons/fa6` & `lucide-react`).
- **360 Camera View**: Default **95° wide-angle FOV** unzoomed perspective.
