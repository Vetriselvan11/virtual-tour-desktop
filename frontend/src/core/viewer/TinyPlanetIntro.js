import * as THREE from 'three';

/**
 * Ultra-High Performance GLSL Shaders for Stereographic Tiny Planet to Rectilinear 360 Panorama Morph.
 * Optimized for 60+ FPS stutter-free rendering with GPU pre-warming and C2-continuous ray interpolation.
 */
const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Direct NDC full-screen quad (clip space)
    gl_Position = vec4(position.xy, -0.999, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D tMap;
  uniform float uAspect;
  uniform float uWarp;          // 1.0 = stereographic tiny planet, 0.0 = rectilinear perspective
  uniform float uScale;         // Planet size / zoom factor (0.38 -> 1.55 -> 1.0)
  uniform float uPitch;         // Camera pitch in radians (-PI/2 nadir -> target pitch)
  uniform float uYaw;           // Camera yaw in radians
  uniform float uFov;           // Target field of view in radians
  uniform float uAtmosphere;    // Atmosphere rim glow factor (1.0 -> 0.0)
  uniform vec3 uAtmosphereColor;// Halo color
  uniform vec3 uBgColor;        // Space background color
  uniform float uOpacity;

  varying vec2 vUv;

  const float PI = 3.14159265358979323846;
  const float TWO_PI = 6.28318530717958647692;
  const float INV_TWO_PI = 0.15915494309189535; // 1.0 / (2.0 * PI)
  const float INV_PI = 0.3183098861837907;      // 1.0 / PI

  void main() {
    // Screen coords centered at (0, 0), corrected for aspect ratio
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= uAspect;

    float r2 = dot(p, p);
    float r = sqrt(r2);
    float angle = atan(p.y, p.x);

    // ──────────────────────────────────────────────────────────────────────────
    // 1. RECTILINEAR (STANDARD PERSPECTIVE) VIEW RAY
    // ──────────────────────────────────────────────────────────────────────────
    float cosP = cos(uPitch);
    float sinP = sin(uPitch);
    float cosY = cos(uYaw);
    float sinY = sin(uYaw);

    vec3 camF = vec3(cosP * cosY, sinP, cosP * sinY);
    vec3 camR = vec3(-sinY, 0.0, cosY);
    vec3 camU = vec3(-sinP * cosY, cosP, -sinP * sinY);

    float tanHalfFov = tan(uFov * 0.5);
    vec3 rayRect = normalize(camF + (p.x * tanHalfFov) * camR + (p.y * tanHalfFov) * camU);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. STEREOGRAPHIC (TINY PLANET) VIEW RAY
    // ──────────────────────────────────────────────────────────────────────────
    // Screen center (p = 0) is nadir (looking straight down: 0, -1, 0)
    // Top of screen (py > 0) is aligned directly with user set target heading (cosY, 0, sinY)
    // Right of screen (px > 0) aligns with camera right (-sinY, 0, cosY)
    float effectiveScale = max(0.001, uScale);
    float theta = 2.0 * atan(r / (2.0 * effectiveScale));
    float sinTheta = sin(theta);
    float cosTheta = cos(theta);

    vec2 dirScreen = (r > 0.0001) ? (p / r) : vec2(0.0, 1.0);

    vec3 horizDir = vec3(
      dirScreen.y * cosY - dirScreen.x * sinY,
      0.0,
      dirScreen.y * sinY + dirScreen.x * cosY
    );

    vec3 rayStereo = vec3(
      sinTheta * horizDir.x,
      -cosTheta,
      sinTheta * horizDir.z
    );

    // ──────────────────────────────────────────────────────────────────────────
    // 3. SEAMLESS RAY-SPACE PROJECTION MORPH
    // ──────────────────────────────────────────────────────────────────────────
    vec3 worldRay;
    if (uWarp >= 0.999) {
      worldRay = rayStereo;
    } else if (uWarp <= 0.001) {
      worldRay = rayRect;
    } else {
      worldRay = normalize(mix(rayRect, rayStereo, uWarp));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 4. EQUIRECTANGULAR UV MAPPING (Exact 1:1 match with Three.js SphereGeometry)
    // ──────────────────────────────────────────────────────────────────────────
    float longitude = atan(worldRay.z, worldRay.x);
    float latitude = asin(clamp(worldRay.y, -1.0, 1.0));

    vec2 uv = vec2(
      fract(longitude * INV_TWO_PI),
      latitude * INV_PI + 0.5
    );

    vec4 texColor = texture2D(tMap, uv);
    vec3 finalColor = texColor.rgb;

    // ──────────────────────────────────────────────────────────────────────────
    // 5. ATMOSPHERIC RIM GLOW & CLEAN SPACE BACKGROUND
    // ──────────────────────────────────────────────────────────────────────────
    float rHorizon = 2.0 * effectiveScale;

    if (uAtmosphere > 0.001 && uWarp > 0.05) {
      float distNorm = (r - rHorizon) / max(0.01, rHorizon);

      // Soft rim halo along the spherical planet edge
      float rimGlow = exp(-abs(distNorm) * 6.5) * 0.9 * uAtmosphere;

      // Soft outer aura radiating into space
      float outerHalo = exp(-max(0.0, distNorm) * 2.8) * 0.5 * uAtmosphere;

      // Clean cosmic background fade beyond outer atmosphere
      float spaceFactor = smoothstep(1.05, 2.4, r / max(0.01, rHorizon)) * uAtmosphere;

      vec3 glow = uAtmosphereColor * (rimGlow + outerHalo);
      finalColor = mix(finalColor + glow, uBgColor, spaceFactor * 0.35);
    }

    gl_FragColor = vec4(finalColor, uOpacity);
  }
`;

/**
 * Controller for the Cinematic "Tiny Planet to 360° World" Intro Animation.
 */
export default class TinyPlanetIntro {
  /**
   * @param {ViewerCore} viewerCore
   */
  constructor(viewerCore) {
    this.viewerCore = viewerCore;
    this.renderLoop = viewerCore.renderLoop;
    this.scene = viewerCore.scene;

    this.isPlaying = false;
    this.progress = 0;
    this.duration = 5.0; // Total duration in seconds (slow, luxurious, cinematic)
    this.holdDuration = 0.9;
    this.elapsed = 0;
    this.hookId = `tiny_planet_intro_${Date.now()}`;

    // Target end state
    this.targetYaw = 0;
    this.targetPitch = 0;
    this.targetFovDegrees = 95;
    this.targetFov = 95 * (Math.PI / 180);
    this.wideFov = 108 * (Math.PI / 180);
    this.startYaw = 0;

    // Callbacks
    this.onProgressCallback = null;
    this.onCompleteCallback = null;

    // Full-screen quad geometry and shader material
    const geom = new THREE.PlaneGeometry(2, 2);
    this.uniforms = {
      tMap: { value: null },
      uAspect: { value: 1.0 },
      uWarp: { value: 1.0 },
      uScale: { value: 0.38 },
      uPitch: { value: -Math.PI / 2 },
      uYaw: { value: 0.0 },
      uFov: { value: 108 * (Math.PI / 180) },
      uAtmosphere: { value: 1.0 },
      uAtmosphereColor: { value: new THREE.Vector3(0.42, 0.68, 1.0) },
      uBgColor: { value: new THREE.Vector3(0.02, 0.02, 0.035) },
      uOpacity: { value: 1.0 }
    };

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      transparent: true
    });

    this.quad = new THREE.Mesh(geom, this.material);
    this.quad.frustumCulled = false;
    this.quad.renderOrder = 999;
    this.quad.visible = false;
    this.scene.add(this.quad);

    this.updateAspect();
  }

  /**
   * Updates aspect ratio uniform from mount container or window.
   */
  updateAspect() {
    const mount = this.viewerCore?.mount;
    const W = mount ? mount.clientWidth : window.innerWidth;
    const H = mount ? mount.clientHeight : window.innerHeight;
    this.uniforms.uAspect.value = (W && H) ? W / H : 1.777;
  }

  /**
   * Hermite C2-continuous smoothstep (zero jerk at boundaries).
   */
  _smoothstep(x) {
    const t = Math.max(0, Math.min(1, x));
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Starts the Cinematic Tiny Planet intro animation.
   */
  play({
    texture,
    targetYaw = 0,
    targetPitch = 0,
    targetFov = 95,
    duration = 5.0,
    holdDuration = 0.9,
    onProgress,
    onComplete
  } = {}) {
    if (!texture) {
      if (onComplete) onComplete();
      return;
    }

    this.stop(); // Stop any in-flight intro

    this.isPlaying = true;
    this.duration = Math.max(2.5, duration);
    this.holdDuration = Math.min(this.duration * 0.3, holdDuration);
    this.elapsed = 0;
    this.progress = 0;
    this.targetYaw = targetYaw;
    this.targetPitch = targetPitch;
    this.targetFovDegrees = targetFov || 95;
    this.targetFov = this.targetFovDegrees * (Math.PI / 180);
    this.wideFov = Math.max(this.targetFov, 108 * (Math.PI / 180));

    // Calculate start yaw so rotation glides seamlessly into targetYaw
    const totalSpinDelta = 0.35; // ~20 degrees slow cinematic rotation
    this.startYaw = targetYaw - totalSpinDelta;
    this.holdEnd = this.holdDuration / this.duration; // ~0.18

    this.onProgressCallback = onProgress;
    this.onCompleteCallback = onComplete;

    // Configure uniforms
    this.updateAspect();
    this.uniforms.tMap.value = texture;
    this.uniforms.uFov.value = this.wideFov;
    this.uniforms.uOpacity.value = 1.0;
    this.uniforms.uWarp.value = 1.0;
    this.uniforms.uScale.value = 0.38;
    this.uniforms.uPitch.value = -Math.PI / 2;
    this.uniforms.uYaw.value = this.startYaw;
    this.uniforms.uAtmosphere.value = 1.0;

    // Pre-warm texture and compile shader to GPU before the first frame
    if (this.viewerCore?.renderer) {
      try {
        if (this.viewerCore.renderer.initTexture) {
          this.viewerCore.renderer.initTexture(texture);
        }
        if (this.viewerCore.renderer.compile && this.scene && this.viewerCore.camera) {
          this.viewerCore.renderer.compile(this.scene, this.viewerCore.camera);
        }
      } catch (e) {}
    }

    // Hide background sphere to save GPU fill-rate during intro quad pass
    if (this.viewerCore?.sphere) {
      this.viewerCore.sphere.visible = false;
    }

    // Show the intro quad overlay and hide hotspots
    this.quad.visible = true;
    if (this.viewerCore?.hotspotManager?.renderer) {
      this.viewerCore.hotspotManager.renderer.meshes.forEach((m) => {
        m.sprite.visible = false;
        if (m.ring) m.ring.visible = false;
      });
    }

    // Wake and register render loop hook
    this.renderLoop.setContinuousDemand('tiny_planet_intro', true);
    this.renderLoop.registerHook(this.hookId, (time, delta) => {
      return this._tick(delta);
    });
  }

  /**
   * Per-frame animation ticker: Single continuous slow, graceful glide from beginning to end.
   * @private
   */
  _tick(delta) {
    if (!this.isPlaying) return false;

    // Clamp delta to 50ms to prevent frame jumps on transient browser hitches
    const safeDelta = Math.min(delta, 0.05);
    this.elapsed += safeDelta;
    const p = Math.min(1.0, this.elapsed / this.duration);
    this.progress = p;

    const holdEnd = this.holdEnd;

    if (p <= holdEnd) {
      // Phase 1: Pure Tiny Planet Hold & slow atmospheric float
      const t = p / Math.max(0.01, holdEnd);
      this.uniforms.uScale.value = 0.38;
      this.uniforms.uWarp.value = 1.0;
      this.uniforms.uPitch.value = -Math.PI / 2;
      this.uniforms.uAtmosphere.value = 1.0;
      this.uniforms.uFov.value = this.wideFov;
      this.uniforms.uYaw.value = this.startYaw + p * 0.20;
      this.uniforms.uOpacity.value = Math.min(1.0, t * 2.5);
    } else {
      // Phase 2: Single, unified, slow cinematic approach and continuous unwrap
      // Everything glides together in harmony from beginning to end with zero sudden switches
      const u = (p - holdEnd) / (1.0 - holdEnd); // 0.0 -> 1.0

      // Quintic Hermite smoothstep for velvet-smooth continuous acceleration and deceleration
      const ease = this._smoothstep(u);

      // Pitch begins tilting up continuously from nadir (-90 deg) to user set pitch across the glide
      const pitchEase = this._smoothstep(Math.pow(u, 1.35));
      this.uniforms.uPitch.value = -Math.PI / 2 + (this.targetPitch - (-Math.PI / 2)) * pitchEase;

      // Scale expands continuously and smoothly from 0.38 up to 1.0
      this.uniforms.uScale.value = 0.38 + (1.0 - 0.38) * ease;

      // Warp unbends fisheye distortion gradually across the glide
      const warpEase = this._smoothstep(Math.max(0.0, (u - 0.12) / 0.88));
      this.uniforms.uWarp.value = 1.0 - warpEase;

      // FOV smoothly transitions from wide entry into user target FOV
      this.uniforms.uFov.value = this.wideFov + (this.targetFov - this.wideFov) * ease;

      // Atmosphere dissolves gradually as camera dives into the world
      this.uniforms.uAtmosphere.value = Math.max(0.0, (1.0 - ease) * 1.0);

      // Yaw smoothly rotates into exact user target yaw with zero jerk
      const spinBase = this.startYaw + holdEnd * 0.20;
      this.uniforms.uYaw.value = spinBase + (this.targetYaw - spinBase) * ease;
      this.uniforms.uOpacity.value = 1.0;
    }

    if (this.onProgressCallback) {
      this.onProgressCallback(p);
    }

    if (p >= 1.0) {
      this._complete();
    }

    return true; // Demands continuous rendering
  }

  /**
   * Finalizes intro and transitions seamlessly to standard 360 viewer controls.
   * @private
   */
  _complete() {
    this.isPlaying = false;
    this.progress = 1.0;

    this.renderLoop.unregisterHook(this.hookId);
    this.renderLoop.setContinuousDemand('tiny_planet_intro', false);

    // Hide intro shader quad
    this.quad.visible = false;

    // Restore main sphere visibility and opacity
    if (this.viewerCore?.sphere) {
      this.viewerCore.sphere.visible = true;
      if (this.viewerCore.sphere.material) {
        this.viewerCore.sphere.material.opacity = 1;
      }
    }

    // Sync ViewerCore spherical angles and FOV with the exact user set frame
    if (this.viewerCore) {
      this.viewerCore.targetTheta = this.targetYaw;
      this.viewerCore.targetPhi = Math.PI / 2 - this.targetPitch;
      this.viewerCore.baseTargetPhi = this.viewerCore.targetPhi;
      this.viewerCore.spherical.theta = this.targetYaw;
      this.viewerCore.spherical.phi = this.viewerCore.targetPhi;
      if (this.viewerCore._setFov) {
        this.viewerCore._setFov(this.targetFovDegrees);
      } else if (this.viewerCore.camera) {
        this.viewerCore.fov = this.targetFovDegrees;
        this.viewerCore.camera.fov = this.targetFovDegrees;
        this.viewerCore.camera.updateProjectionMatrix();
      }
      this.viewerCore.updateCameraFromSpherical();

      // Smoothly reveal hotspots
      if (this.viewerCore.hotspotManager?.renderer) {
        this.viewerCore.hotspotManager.renderer.meshes.forEach((m) => {
          m.sprite.visible = true;
          if (m.ring) m.ring.visible = true;
        });
      }

      // Trigger high-resolution tile streaming for the final viewport
      if (this.viewerCore.tileManager && this.viewerCore.tileManager.enabled) {
        this.viewerCore.tileManager.updateViewport(true);
      }

      this.viewerCore.userInteracting = false;
      this.viewerCore.renderLoop.requestRender(5);
    }

    if (this.onCompleteCallback) {
      this.onCompleteCallback();
      this.onCompleteCallback = null;
    }
  }

  /**
   * Swiftly skips the remaining intro animation smoothly without visual glitches.
   */
  skip() {
    if (!this.isPlaying) return;
    this._complete();
  }

  /**
   * Stops the animation and hides the intro overlay.
   */
  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.renderLoop.unregisterHook(this.hookId);
    this.renderLoop.setContinuousDemand('tiny_planet_intro', false);
    this.quad.visible = false;
    if (this.viewerCore?.sphere) {
      this.viewerCore.sphere.visible = true;
    }
  }

  /**
   * Disposes GPU allocations.
   */
  dispose() {
    this.stop();
    if (this.scene && this.quad) {
      this.scene.remove(this.quad);
    }
    if (this.quad) {
      this.quad.geometry.dispose();
      this.material.dispose();
    }
  }
}

