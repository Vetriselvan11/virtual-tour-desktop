# 360TOOL Performance Standards

**Developer:** Vettriselvan  
**Project:** 360TOOL / Virtual Tour Engine  
**Purpose:** Professional 360° Virtual Tour Authoring and Viewing Platform  
**Performance Principle:** *"Every version must remain as smooth as the current stable version, while preserving maximum visual and export quality."*

---

## Current Baseline

**Browser:**
- Smooth
- Existing optimized rendering architecture

**Electron:**
- Smooth
- Existing optimized Electron runtime

---

## Core Rules

- One renderer
- One authoritative render loop
- Bounded GPU cache
- Virtualized scene lists
- Virtualized timeline
- Camera state isolated from React
- Thumbnail/preview/master separation
- Controlled upload concurrency
- Controlled decoding
- Controlled GPU uploads
- No unnecessary full-resolution panorama loading
- No uncontrolled memory growth
- No speculative Electron GPU flags
- Master quality preserved

---

## Large Project Target

The editor must remain responsive with:
- 100+ scenes
- 200+ scenes
- 500+ scenes
- multi-GB projects
- high-resolution panoramas

---

## Quality Rule

Master originals must never be permanently modified for performance. Editor performance and final output quality are separate systems. The user must receive full-quality output.

---

## Browser Rule

Browser performance must not regress. Browser behavior must remain unchanged unless there is a proven reason. Electron-specific logic MUST remain isolated from browser logic.

---

## Electron Rule

Electron performance must not regress. DO NOT blindly add Chromium performance flags unless actual profiling proves the flag is required and improves performance on the supported hardware. 

---

## Development Rule

Every performance-sensitive change requires runtime verification. Do NOT modify performance-critical code just because it "might be faster". First identify the actual bottleneck, measure evidence, and implement the smallest safe change.

---

## Regression Rule

If a new feature causes performance regression:

**STOP.**

Do not continue adding features on top of the regression.
Identify and fix the regression first. Every new version must be the same or better in performance than the previous version.
