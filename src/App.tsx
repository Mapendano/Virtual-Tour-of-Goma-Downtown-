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

  // We keep a ref to the viewer and controls to manipulate them outside of the init effect
  const viewerRef = useRef<any>(null);
  const scenesRef = useRef<any[]>([]);
  const screenfullRef = useRef<any>(null);
  const autorotateLogicRef = useRef<any>(null);

  useEffect(() => {
    if (!panoRef.current || viewerRef.current) return; // Prevent double initialization

    const Marzipano = (window as any).Marzipano;
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
    if (bowser.msie && parseFloat(bowser.version) < 11) {
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
      const urlPrefix = "/tiles";
      const source = Marzipano.ImageUrlSource.fromString(
        urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
        { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
      const geometry = new Marzipano.CubeGeometry(data.levels);

      // Limiter allowing looking fully up and down (pitch limits)
      // The traditional limiter constrained this. We expand maxPitch to Math.PI (180 deg)
      const limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, 100*Math.PI/180, Math.PI);
      const view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

      const scene = viewer.createScene({
        source: source,
        geometry: geometry,
        view: view,
        pinFirstLevel: true
      });

      return { data, scene, view };
    });
    
    scenesRef.current = scenes;

    // View controls
    const velocity = 0.7;
    const friction = 3;
    const controls = viewer.controls();
    controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(document.querySelector('#viewUp'),     'y', -velocity, friction), true);
    controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(document.querySelector('#viewDown'),   'y',  velocity, friction), true);
    controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(document.querySelector('#viewLeft'),   'x', -velocity, friction), true);
    controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(document.querySelector('#viewRight'),  'x',  velocity, friction), true);
    controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(document.querySelector('#viewIn'),  'zoom', -velocity, friction), true);
    controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(document.querySelector('#viewOut'), 'zoom',  velocity, friction), true);

    // Device orientation (gyroscope)
    const DeviceOrientationControlMethod = (window as any).DeviceOrientationControlMethod;
    if (DeviceOrientationControlMethod) {
      controls.registerMethod('deviceOrientation', new DeviceOrientationControlMethod());
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
        icon.src = '/img/link.png';
        icon.classList.add('link-hotspot-icon');
        icon.style.transform = 'rotate(' + hotspot.rotation + 'rad)';

        wrapper.addEventListener('click', () => {
          const targetScene = scenesRef.current.find(s => s.data.id === hotspot.target);
          if (targetScene) {
            targetScene.view.setParameters(targetScene.data.initialViewParameters);
            targetScene.scene.switchTo();
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
        icon.src = '/img/info.png';
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
        closeIcon.src = '/img/close.png';
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
      targetScene.view.setParameters(targetScene.data.initialViewParameters);
      targetScene.scene.switchTo();
      
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
    <div className={`multiple-scenes view-control-buttons ${sceneListEnabled ? 'scene-list-enabled' : ''} ${autorotate ? 'autorotate-enabled' : ''} ${fullscreen ? 'fullscreen-active' : ''}`}>
      {/* Right side language toggle - moved down to stay below top controls */}
      <div className="absolute top-[60px] md:top-[70px] right-2 z-50 flex gap-2">
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
        <img className="icon off" src="/img/play.png" alt="Play" />
        <img className="icon on" src="/img/pause.png" alt="Pause" />
      </a>

      <a href="#" id="fullscreenToggle" className={fullscreen ? 'enabled' : ''} onClick={(e) => { e.preventDefault(); toggleFullscreen(); }}>
        <img className="icon off" src="/img/fullscreen.png" alt="Fullscreen" />
        <img className="icon on" src="/img/windowed.png" alt="Windowed" />
      </a>

      <a href="#" id="sceneListToggle" className={sceneListEnabled ? 'enabled' : ''} onClick={(e) => { e.preventDefault(); toggleSceneList(); }}>
        <img className="icon off" src="/img/expand.png" alt="Expand" />
        <img className="icon on" src="/img/collapse.png" alt="Collapse" />
      </a>

      <a href="#" id="viewUp" className="viewControlButton viewControlButton-1" onClick={e => e.preventDefault()}>
        <img className="icon" src="/img/up.png" alt="Up" />
      </a>
      <a href="#" id="viewDown" className="viewControlButton viewControlButton-2" onClick={e => e.preventDefault()}>
        <img className="icon" src="/img/down.png" alt="Down" />
      </a>
      <a href="#" id="viewLeft" className="viewControlButton viewControlButton-3" onClick={e => e.preventDefault()}>
        <img className="icon" src="/img/left.png" alt="Left" />
      </a>
      <a href="#" id="viewRight" className="viewControlButton viewControlButton-4" onClick={e => e.preventDefault()}>
        <img className="icon" src="/img/right.png" alt="Right" />
      </a>
      <a href="#" id="viewIn" className="viewControlButton viewControlButton-5" onClick={e => e.preventDefault()}>
        <img className="icon" src="/img/plus.png" alt="Zoom in" />
      </a>
      <a href="#" id="viewOut" className="viewControlButton viewControlButton-6" onClick={e => e.preventDefault()}>
        <img className="icon" src="/img/minus.png" alt="Zoom out" />
      </a>

      {/* Gyroscope/Compass Toggle */}
      <button 
        onClick={toggleGyro}
        className={`absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-14 h-14 md:w-12 md:h-12 rounded-full shadow flex items-center justify-center text-3xl md:text-2xl transition-all duration-300 active:scale-95 border border-black/5 ${gyroEnabled ? 'bg-blue-500 shadow-blue-500/40 md:hover:scale-105 md:hover:bg-blue-600' : 'bg-white/90 backdrop-blur md:hover:bg-white text-gray-800 md:hover:scale-105 hover:shadow-lg'}`}
        title={gyroEnabled ? (lang === 'fr' ? 'Désactiver boussole' : 'Disable compass') : (lang === 'fr' ? 'Activer boussole' : 'Enable compass')}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        {gyroEnabled ? <span style={{filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'}}>🧭</span> : <span className="opacity-90">🧭</span>}
      </button>
    </div>
  );
}

