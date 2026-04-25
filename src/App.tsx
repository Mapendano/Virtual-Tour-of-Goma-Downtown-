import { useEffect, useRef, useState } from 'react';
import { APP_DATA } from './data';

const enTranslations: Record<string, string> = {
  "Rond point 3": "Roundabout 3",
  "Rond point 2": "Roundabout 2",
  "Rond point bdgl 1": "Roundabout BDGL 1",
  "Palais diplomatique ": "Diplomatic Palace",
  "Hôtel ": "Hotel",
  "Rond point de la paix - RDC and R ": "Peace Roundabout - DRC/Rwanda",
  "Rond point BDGL": "Roundabout BDGL",
  "Une fon point du centre ville de Goma&nbsp;": "A central roundabout in Goma city&nbsp;",
  "Route allant vers birere": "Road to Birere",
  "Text": "View of the route towards Birere neighborhood.",
  "Immeuble diplomatique&nbsp;": "Diplomatic Building",
  "Abrite les plus des entreprises technologique à Goma": "Houses most tech companies in Goma",
  "Russina Hôtel&nbsp;": "Russina Hotel&nbsp;",
  "Un hôtel encore frais (piscine, salle de fête, réception) faisant la concurrence des anciens grand hôtel du centre ville.&nbsp;": "A new hotel (pool, party hall, reception) competing with older grand hotels downtown.&nbsp;",
  "Rond point de la paix": "Peace Roundabout",
  "Rond situé à 100 mettre de la frontière entre RDC - Rwanda (Grande barrière)": "Roundabout located 100 meters from the DRC - Rwanda border (Grande Barrière)",
  "Centre ville de Goma ": "Downtown Goma "
};

function translate(text: string, lang: 'fr' | 'en') {
  if (lang === 'fr') return text;
  return enTranslations[text.trim()] || enTranslations[text] || text;
}

export default function App() {
  const panoRef = useRef<HTMLDivElement>(null);
  const [lang, setLang] = useState<'fr' | 'en'>('fr');
  const [gyroEnabled, setGyroEnabled] = useState(false);
  const [currentSceneId, setCurrentSceneId] = useState(APP_DATA.scenes[0].id);
  const [sceneName, setSceneName] = useState(APP_DATA.scenes[0].name);

  const [autorotate, setAutorotate] = useState(APP_DATA.settings.autorotateEnabled);
  const [fullscreen, setFullscreen] = useState(false);
  const [sceneListEnabled, setSceneListEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // We keep a ref to the viewer and controls to manipulate them outside of the init effect
  const viewerRef = useRef<any>(null);
  const scenesRef = useRef<any[]>([]);
  const screenfullRef = useRef<any>(null);
  const autorotateLogicRef = useRef<any>(null);

  const [error, setError] = useState<Error | null>(null);

  if (error) {
    throw error;
  }

  useEffect(() => {
    if (!panoRef.current || viewerRef.current) return; // Prevent double initialization

    try {
      const Marzipano = (window as any).Marzipano;
      
      if (!Marzipano) {
         throw new Error("La librairie Marzipano n'a pas pu être chargée. Veuillez vérifier votre connexion.");
      }

      const bowser = (window as any).bowser;
      const screenfull = (window as any).screenfull;
      screenfullRef.current = screenfull;

      const mql = window.matchMedia("(max-width: 500px), (max-height: 500px)");
    const setMode = () => {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    setMode();
    mql.addEventListener('change', setMode);

    document.body.classList.add('no-touch');
    const onTouchStart = () => {
      document.body.classList.remove('no-touch');
      document.body.classList.add('touch');
    };
    window.addEventListener('touchstart', onTouchStart);

    document.body.classList.add('multiple-scenes', 'view-control-buttons');

    // Use tooltip fallback mode on IE < 11.
    if (bowser && bowser.msie && parseFloat(bowser.version) < 11) {
      document.body.classList.add('tooltip-fallback');
    }

    const viewerOpts = {
      controls: {
        mouseViewMode: APP_DATA.settings.mouseViewMode
      }
    };

    const viewer = new Marzipano.Viewer(panoRef.current, viewerOpts);
    viewerRef.current = viewer;

    const scenes = APP_DATA.scenes.map(function(data) {
      const urlPrefix = "https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/tiles";
      const source = Marzipano.ImageUrlSource.fromString(
        urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
        { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
      const geometry = new Marzipano.CubeGeometry(data.levels);

      // Limiter allowing looking fully up and down (pitch limits)
      // The traditional limiter constrained this. We expand maxPitch to Math.PI (180 deg)
      const limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, 100*Math.PI/180, 120*Math.PI/180);
      const view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

      const scene = viewer.createScene({
        source: source,
        geometry: geometry,
        view: view,
        pinFirstLevel: true
      });

      // Handle texture errors gracefully (e.g. log or set error state if critical)
      if (scene && scene.layer && scene.layer() && scene.layer().textureStore()) {
        scene.layer().textureStore().addEventListener('textureError', (tile: any, err: any) => {
          console.error("Failed to load texture for tile:", tile, err);
          showToast("Certaines images de cette vue n'ont pas pu être chargées - Connexion instable.");
        });
      }

      return { data, scene, view };
    });
    
    scenesRef.current = scenes;

    // View controls
    const velocity = 0.4; // Very low velocity for smooth, controlled rotation via buttons/keys
    const friction = 10; // Extremely high friction for almost zero inertia, exactly like Google Street View
    const controls = viewer.controls();
    
    // Improve native drag and touch controls stabilization
    try {
      // High friction prevents the camera from "sliding" after dragging
      controls.enableMethod('drag', { friction: 10 });
      controls.enableMethod('pinch', { friction: 10 });
    } catch (e) {
      console.warn('Could not update default drag/pinch friction', e);
    }
    
    const tryRegister = (id: string, method: any) => {
      try {
        controls.registerMethod(id, method, true);
      } catch (e) {
        console.warn(`Could not register control method ${id}`, e);
      }
    };

    tryRegister('upElement',    new Marzipano.ElementPressControlMethod(document.querySelector('#viewUp'),     'y', -velocity, friction));
    tryRegister('downElement',  new Marzipano.ElementPressControlMethod(document.querySelector('#viewDown'),   'y',  velocity, friction));
    tryRegister('leftElement',  new Marzipano.ElementPressControlMethod(document.querySelector('#viewLeft'),   'x', -velocity, friction));
    tryRegister('rightElement', new Marzipano.ElementPressControlMethod(document.querySelector('#viewRight'),  'x',  velocity, friction));
    tryRegister('inElement',    new Marzipano.ElementPressControlMethod(document.querySelector('#viewIn'),  'zoom', -velocity, friction));
    tryRegister('outElement',   new Marzipano.ElementPressControlMethod(document.querySelector('#viewOut'), 'zoom',  velocity, friction));

    // Keyboard controls
    tryRegister('upArrow', new Marzipano.KeyControlMethod(38, 'y', -velocity, friction));
    tryRegister('downArrow', new Marzipano.KeyControlMethod(40, 'y', velocity, friction));
    tryRegister('leftArrow', new Marzipano.KeyControlMethod(37, 'x', -velocity, friction));
    tryRegister('rightArrow', new Marzipano.KeyControlMethod(39, 'x', velocity, friction));
    tryRegister('wKey', new Marzipano.KeyControlMethod(87, 'y', -velocity, friction));
    tryRegister('sKey', new Marzipano.KeyControlMethod(83, 'y', velocity, friction));
    tryRegister('aKey', new Marzipano.KeyControlMethod(65, 'x', -velocity, friction));
    tryRegister('dKey', new Marzipano.KeyControlMethod(68, 'x', velocity, friction));
    tryRegister('plusKey', new Marzipano.KeyControlMethod(187, 'zoom', -velocity, friction)); // =/+
    tryRegister('minusKey', new Marzipano.KeyControlMethod(189, 'zoom', velocity, friction)); // -/_

    // Device orientation (gyroscope)
    const DeviceOrientationControlMethod = (window as any).DeviceOrientationControlMethod;
    if (DeviceOrientationControlMethod) {
      tryRegister('deviceOrientation', new DeviceOrientationControlMethod());
    }

    // Setup autorotate
    const autorotateLogic = Marzipano.autorotate({
      yawSpeed: 0.03,
      targetPitch: 0,
      targetFov: Math.PI/2
    });
    autorotateLogicRef.current = autorotateLogic;

    // Switch to initial scene
    scenes[0].scene.switchTo();
    
    if (APP_DATA.settings.autorotateEnabled) {
      viewer.startMovement(autorotateLogic);
      viewer.setIdleMovement(3000, autorotateLogic);
    }
    
    // Set up fullscreen mode event listener
    if (screenfull && screenfull.enabled && APP_DATA.settings.fullscreenButton) {
      document.body.classList.add('fullscreen-enabled');
      screenfull.on('change', function() {
        setFullscreen(screenfull.isFullscreen);
      });
    } else {
      document.body.classList.add('fullscreen-disabled');
    }

    // Clean up
    return () => {
      viewer.destroy();
      viewerRef.current = null;
    };
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  // Update hotspots when language or scene changes
  useEffect(() => {
    if (!viewerRef.current) return;
    const Marzipano = (window as any).Marzipano;

    scenesRef.current.forEach(({ data, scene }) => {
      // Clear existing hotspots
      scene.hotspotContainer().listHotspots().forEach((hotspot: any) => {
        scene.hotspotContainer().destroyHotspot(hotspot);
      });

      // Prevent events
      const stopTouchAndScrollEventPropagation = (element: HTMLElement) => {
        const eventList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel', 'mousewheel' ];
        for (let i = 0; i < eventList.length; i++) {
          element.addEventListener(eventList[i], function(event) { event.stopPropagation(); });
        }
      };

      // Create link hotspots
      data.linkHotspots.forEach((hotspot: any) => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('hotspot', 'link-hotspot');

        const icon = document.createElement('img');
        icon.src = 'https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/link.png';
        icon.classList.add('link-hotspot-icon');
        icon.style.transform = 'rotate(' + hotspot.rotation + 'rad)';

        wrapper.addEventListener('click', () => {
          const targetScene = scenesRef.current.find(s => s.data.id === hotspot.target);
          if (targetScene) {
            // Apply a smooth transition parameter
            targetScene.scene.switchTo({ transitionDuration: 1000 });
            targetScene.view.setParameters(targetScene.data.initialViewParameters);
            setCurrentSceneId(targetScene.data.id);
            setSceneName(targetScene.data.name);
          }
        });

        stopTouchAndScrollEventPropagation(wrapper);

        const tooltip = document.createElement('div');
        tooltip.classList.add('hotspot-tooltip', 'link-hotspot-tooltip');
        const targetSceneData = APP_DATA.scenes.find(s => s.id === hotspot.target);
        tooltip.innerHTML = translate(targetSceneData?.name || '', lang);

        wrapper.appendChild(icon);
        wrapper.appendChild(tooltip);
        scene.hotspotContainer().createHotspot(wrapper, { yaw: hotspot.yaw, pitch: hotspot.pitch });
      });

      // Create info hotspots
      data.infoHotspots.forEach((hotspot: any) => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('hotspot', 'info-hotspot');

        const header = document.createElement('div');
        header.classList.add('info-hotspot-header');

        const iconWrapper = document.createElement('div');
        iconWrapper.classList.add('info-hotspot-icon-wrapper');
        const icon = document.createElement('img');
        icon.src = 'https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/info.png';
        icon.classList.add('info-hotspot-icon');
        iconWrapper.appendChild(icon);

        const titleWrapper = document.createElement('div');
        titleWrapper.classList.add('info-hotspot-title-wrapper');
        const title = document.createElement('div');
        title.classList.add('info-hotspot-title');
        title.innerHTML = translate(hotspot.title || '', lang);
        titleWrapper.appendChild(title);

        const closeWrapper = document.createElement('div');
        closeWrapper.classList.add('info-hotspot-close-wrapper');
        const closeIcon = document.createElement('img');
        closeIcon.src = 'https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/close.png';
        closeIcon.classList.add('info-hotspot-close-icon');
        closeWrapper.appendChild(closeIcon);

        header.appendChild(iconWrapper);
        header.appendChild(titleWrapper);
        header.appendChild(closeWrapper);

        const text = document.createElement('div');
        text.classList.add('info-hotspot-text');
        text.innerHTML = translate(hotspot.text || '', lang);

        wrapper.appendChild(header);
        wrapper.appendChild(text);

        // Mobile modal
        const modal = document.createElement('div');
        modal.innerHTML = wrapper.innerHTML;
        modal.classList.add('info-hotspot-modal');
        document.body.appendChild(modal);

        const toggle = () => {
          wrapper.classList.toggle('visible');
          modal.classList.toggle('visible');
        };

        wrapper.querySelector('.info-hotspot-header')?.addEventListener('click', toggle);
        modal.querySelector('.info-hotspot-close-wrapper')?.addEventListener('click', toggle);
        stopTouchAndScrollEventPropagation(wrapper);

        scene.hotspotContainer().createHotspot(wrapper, { yaw: hotspot.yaw, pitch: hotspot.pitch });
      });
    });
  }, [lang]);

  const toggleGyro = async () => {
    if (!viewerRef.current) return;
    const controls = viewerRef.current.controls();
    if (gyroEnabled) {
      controls.disableMethod('deviceOrientation');
      setGyroEnabled(false);
    } else {
      if (typeof (window as any).DeviceOrientationEvent !== 'undefined' && typeof (window as any).DeviceOrientationEvent.requestPermission === 'function') {
        try {
          const permissionState = await (window as any).DeviceOrientationEvent.requestPermission();
          if (permissionState === 'granted') {
            controls.enableMethod('deviceOrientation');
            setGyroEnabled(true);
          } else {
            alert('Permission denied for device orientation.');
          }
        } catch (e) {
          console.error(e);
          // Fallback if error occurs
          controls.enableMethod('deviceOrientation');
          setGyroEnabled(true);
        }
      } else {
        controls.enableMethod('deviceOrientation');
        setGyroEnabled(true);
      }
    }
  };

  const toggleAutorotate = () => {
    if (!viewerRef.current || !autorotateLogicRef.current) return;
    if (autorotate) {
      viewerRef.current.stopMovement();
      viewerRef.current.setIdleMovement(Infinity);
      setAutorotate(false);
    } else {
      viewerRef.current.startMovement(autorotateLogicRef.current);
      viewerRef.current.setIdleMovement(3000, autorotateLogicRef.current);
      setAutorotate(true);
    }
  };

  const toggleFullscreen = () => {
    if (screenfullRef.current && screenfullRef.current.enabled) {
      screenfullRef.current.toggle();
    }
  };

  const toggleSceneList = () => {
    setSceneListEnabled(!sceneListEnabled);
  };

  const handleSceneClick = (id: string, name: string) => {
    const targetScene = scenesRef.current.find(s => s.data.id === id);
    if (targetScene) {
      // stop autorotate before changing
      if (viewerRef.current) {
        viewerRef.current.stopMovement();
        viewerRef.current.setIdleMovement(Infinity);
      }
      targetScene.scene.switchTo({ transitionDuration: 1000 });
      targetScene.view.setParameters(targetScene.data.initialViewParameters);
      
      
      // restart autorotate
      if (autorotate && viewerRef.current && autorotateLogicRef.current) {
         viewerRef.current.startMovement(autorotateLogicRef.current);
         viewerRef.current.setIdleMovement(3000, autorotateLogicRef.current);
      }
      setCurrentSceneId(id);
      setSceneName(name);
      
      // on mobile, hide scene list after click
      if (typeof window !== 'undefined' && window.innerWidth <= 500) {
        setSceneListEnabled(false);
      }
    }
  };

  // Only run scene list active sync once
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth > 500) {
      setSceneListEnabled(true);
    } else {
      setSceneListEnabled(false); // hide on mobile initially
    }
  }, []);

  return (
    <div className={`w-full h-full relative multiple-scenes view-control-buttons ${sceneListEnabled ? 'scene-list-enabled' : ''} ${autorotate ? 'autorotate-enabled' : ''} ${fullscreen ? 'fullscreen-active' : ''}`}>
      {/* Right side language toggle - moved down to stay below top controls */}
      <div className="absolute top-[100px] md:top-[110px] right-2 z-50 flex gap-2">
        <div className="bg-white/80 backdrop-blur flex rounded-md shadow-md overflow-hidden text-sm font-medium border border-black/5">
          <button 
            className={`px-3 py-1.5 transition-colors ${lang === 'fr' ? 'bg-black text-white' : 'hover:bg-white/50'}`}
            onClick={() => setLang('fr')}
          >
            FR
          </button>
          <button 
            className={`px-3 py-1.5 transition-colors ${lang === 'en' ? 'bg-black text-white' : 'hover:bg-white/50'}`}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
      </div>

      <div id="pano" ref={panoRef} className="absolute inset-0"></div>

      <div id="sceneList" className={sceneListEnabled ? 'enabled' : ''}>
        <ul className="scenes">
          {APP_DATA.scenes.map(scene => (
            <a 
              key={scene.id} 
              href="#" 
              className={`scene ${currentSceneId === scene.id ? 'current' : ''}`} 
              data-id={scene.id}
              onClick={(e) => { e.preventDefault(); handleSceneClick(scene.id, scene.name); }}
            >
              <li className="text">{translate(scene.name, lang)}</li>
            </a>
          ))}
        </ul>
      </div>

      <div id="titleBar">
        <h1 className="sceneName">{translate(sceneName, lang)}</h1>
      </div>

      <a href="#" id="autorotateToggle" className={autorotate ? 'enabled' : ''} onClick={(e) => { e.preventDefault(); toggleAutorotate(); }}>
        <img className="icon off" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/play.png" alt="Play" />
        <img className="icon on" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/pause.png" alt="Pause" />
      </a>

      <a href="#" id="fullscreenToggle" className={fullscreen ? 'enabled' : ''} onClick={(e) => { e.preventDefault(); toggleFullscreen(); }}>
        <img className="icon off" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/fullscreen.png" alt="Fullscreen" />
        <img className="icon on" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/windowed.png" alt="Windowed" />
      </a>

      <a href="#" id="sceneListToggle" className={sceneListEnabled ? 'enabled' : ''} onClick={(e) => { e.preventDefault(); toggleSceneList(); }}>
        <img className="icon off" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/expand.png" alt="Expand" />
        <img className="icon on" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/collapse.png" alt="Collapse" />
      </a>

      <a href="#" id="viewUp" className="viewControlButton viewControlButton-1" onClick={e => e.preventDefault()}>
        <img className="icon" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/up.png" alt="Up" />
      </a>
      <a href="#" id="viewDown" className="viewControlButton viewControlButton-2" onClick={e => e.preventDefault()}>
        <img className="icon" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/down.png" alt="Down" />
      </a>
      <a href="#" id="viewLeft" className="viewControlButton viewControlButton-3" onClick={e => e.preventDefault()}>
        <img className="icon" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/left.png" alt="Left" />
      </a>
      <a href="#" id="viewRight" className="viewControlButton viewControlButton-4" onClick={e => e.preventDefault()}>
        <img className="icon" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/right.png" alt="Right" />
      </a>
      <a href="#" id="viewIn" className="viewControlButton viewControlButton-5" onClick={e => e.preventDefault()}>
        <img className="icon" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/plus.png" alt="Zoom in" />
      </a>
      <a href="#" id="viewOut" className="viewControlButton viewControlButton-6" onClick={e => e.preventDefault()}>
        <img className="icon" src="https://raw.githubusercontent.com/Mapendano/Centre-ville-Goma-Virtual-Tour/main/img/minus.png" alt="Zoom out" />
      </a>

      {/* Gyroscope/Compass Toggle */}
      <button 
        onClick={toggleGyro}
        className={`absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] w-16 h-16 md:w-14 md:h-14 rounded-full shadow-lg flex items-center justify-center text-3xl md:text-2xl transition-all duration-300 active:scale-95 border border-black/10 focus:outline-none focus:ring-4 focus:ring-blue-500/30 ${gyroEnabled ? 'bg-blue-600 shadow-blue-600/40 hover:bg-blue-700 hover:-translate-y-1' : 'bg-white/90 backdrop-blur hover:bg-white text-gray-800 hover:-translate-y-1 hover:shadow-xl'}`}
        title={gyroEnabled ? (lang === 'fr' ? 'Désactiver boussole' : 'Disable compass') : (lang === 'fr' ? 'Activer boussole' : 'Enable compass')}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {gyroEnabled ? <span className="opacity-100 drop-shadow-md">🧭</span> : <span className="opacity-80 grayscale">🧭</span>}
      </button>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-gray-900/90 text-white text-sm font-medium rounded-full shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-none">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

