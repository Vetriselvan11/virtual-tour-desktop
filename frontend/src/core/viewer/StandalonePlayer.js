import ViewerCore from './ViewerCore.js';

class StandalonePlayer {
  constructor() {
    this.config = window.__TOUR_CONFIG__ || null;
    this.container = document.getElementById('viewer-container');
    
    if (!this.config || !this.container) return;
    
    // Initialize unified viewer core (1:1 with editor viewer)
    this.viewer = new ViewerCore(this.container, (url) => url);
    
    // Wire up configuration
    this.viewer.setAutoRotate(true);
    
    // Initialize scene
    if (this.config.scenes && this.config.scenes.length > 0) {
      const startSceneId = this.config.startScene || this.config.scenes[0].id;
      this.loadScene(startSceneId);
    }
    
    // UI Event listeners
    this.setupUI();
  }

  loadScene(sceneId) {
    const sceneConfig = this.config.scenes.find(s => s.id === sceneId);
    if (!sceneConfig) return;
    
    this.viewer.transitionManager.startTransition(sceneConfig.image, {
      fadeOut: 400,
      fadeIn: 400
    }).then(() => {
      this.viewer.hotspotManager.loadHotspots(sceneConfig.hotspots || []);
      // If we had object3d manager, load objects here too
    });
  }

  setupUI() {
    // Basic UI for standalone player
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.body.requestFullscreen().catch(()=>{});
        } else {
          document.exitFullscreen().catch(()=>{});
        }
      });
    }
    
    const vrBtn = document.getElementById('btn-vr');
    if (vrBtn && this.viewer.webXRManager) {
      this.viewer.webXRManager.checkSupported().then(supported => {
        if (supported) {
          vrBtn.style.display = 'flex';
          vrBtn.addEventListener('click', () => this.viewer.webXRManager.enterVR());
        }
      });
    }

    const gyroBtn = document.getElementById('btn-gyro');
    if (gyroBtn && this.viewer.inputManager) {
      if (typeof DeviceOrientationEvent !== 'undefined') {
        gyroBtn.style.display = 'flex';
        gyroBtn.addEventListener('click', async () => {
          if (this.viewer.inputManager.gyroEnabled) {
            this.viewer.inputManager.disableGyro();
          } else {
            await this.viewer.inputManager.requestGyroPermission();
          }
        });
      }
    }
    
    // Handle hotspot clicks (scene navigation fallback)
    this.viewer.hotspotManager.onHotspotClick = (hotspot) => {
      if (hotspot.action === 'scene' && hotspot.targetScene) {
        this.loadScene(hotspot.targetScene);
      }
    };
  }
}

window.onload = () => {
  new StandalonePlayer();
};
