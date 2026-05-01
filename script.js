(function() {
  'use strict';

  // Security: Prevent console manipulation
  const originalLog = console.log;
  const originalError = console.error;

  // ─── IMPACT DATA CONFIG ────────────────────────────────────────────────────
  // Set `launched: true` and update the stats below to switch the Impact
  // section from "pre-launch" to live tracking mode after you go live.
  const IMPACT_DATA = {
    launched: false,
    chaptersUnlocked: 0,
    lbsRemoved: 0,
    milesCleaned: 0,
    donationsVerified: 0,
    donationUSD: 0,
    milestones: [
      // Example — add completed milestones here:
      // { date: '2025-Q3', title: 'Chapter 1 Unlocked', location: 'Mediterranean Sea, Italy', impact: '500 lbs removed' }
    ]
  };
  // ──────────────────────────────────────────────────────────────────────────
  
  // ─── AUTO LOADER ─────────────────────────────────────────────────────────
  var threeScene = null;

  function enterSite() {
    var entryScreen = document.getElementById('entry-screen');
    if (!entryScreen) return;
    if (threeScene) {
      threeScene.burst(function() {
        entryScreen.classList.add('zoom-exit');
        document.body.style.overflow = 'auto';
        // Keep Three.js scene alive for the full 1.2s crossfade,
        // then clean up once the entry screen is invisible
        setTimeout(function() {
          document.body.classList.remove('entry-active');
          entryScreen.style.display = 'none';
          threeScene.stop();
        }, 1250);
      });
    } else {
      entryScreen.classList.add('zoom-exit');
      document.body.style.overflow = 'auto';
      setTimeout(function() {
        document.body.classList.remove('entry-active');
        entryScreen.style.display = 'none';
      }, 1250);
    }
  }

  // ── Text exit: words slide up → title punches toward camera ──────────────
  function playTextExit(cb) {
    var sub   = document.querySelector('.entry-subtitle');
    var title = document.getElementById('shuffleTitle');

    // Subtitle gone, title fades back in from the mid-load fade
    if (sub)   { sub.style.transition = 'opacity 0.25s'; sub.style.opacity = '0'; }
    if (title) { title.style.transition = 'opacity 0.45s'; title.style.opacity = '1'; }

    setTimeout(function() {
      if (!title) { cb(); return; }

      // Split into clipped word spans
      var words = title.textContent.trim().split(/\s+/);
      title.innerHTML = '';
      title.setAttribute('aria-label', words.join(' '));
      words.forEach(function(word, i) {
        var outer = document.createElement('span');
        outer.className = 'lte-outer';
        var inner = document.createElement('span');
        inner.className = 'lte-inner';
        inner.textContent = word + (i < words.length - 1 ? '\u00A0' : '');
        inner.style.transitionDelay = (i * 0.13) + 's';
        outer.appendChild(inner);
        title.appendChild(outer);
      });

      // Double rAF ensures layout is ready before triggering transitions
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          title.classList.add('lte-reveal');
          var revealMs = words.length * 130 + 520;
          setTimeout(function() {
            title.classList.add('lte-zoom');
            setTimeout(cb, 780);
          }, revealMs);
        });
      });
    }, 480);
  }

  var LOADER_STATUSES = [
    'INITIALIZING',
    'LOADING ASSETS',
    'SYNCING LEDGER',
    'MAPPING ROUTE',
    'READY'
  ];

  function runLoader() {
    var fill       = document.getElementById('loaderBarFill');
    var pctEl      = document.getElementById('loaderPct');
    var statEl     = document.getElementById('loaderStatus');
    var logoWrap   = document.querySelector('.loader-logo-wrap');
    var entryTitle = document.querySelector('.entry-title');
    var entrySub   = document.querySelector('.entry-subtitle');
    var barWrap    = document.querySelector('.loader-bar-wrap');
    if (!fill || !pctEl) { enterSite(); return; }

    var pct      = 0;
    var duration = 2600; // total ms to reach 100%
    var start    = null;

    // Eased progress curve — fast start, slight pause mid, burst to 100
    function easedPct(t) {
      // t in [0,1] → pct in [0,100]
      if (t < 0.6) return 82 * (t / 0.6) * (2 - (t / 0.6)) * 0.5; // ease-in-out to ~82%
      return 82 + 18 * ((t - 0.6) / 0.4);                           // linear sprint to 100%
    }

    function updateStatus(p) {
      var idx = p < 20 ? 0 : p < 45 ? 1 : p < 65 ? 2 : p < 90 ? 3 : 4;
      if (statEl) statEl.textContent = LOADER_STATUSES[idx];
    }

    function tick(ts) {
      if (!start) start = ts;
      var elapsed = Math.min(ts - start, duration);
      var t       = elapsed / duration;
      pct         = easedPct(t);

      fill.style.width  = pct + '%';
      pctEl.textContent = Math.floor(pct) + '%';
      updateStatus(Math.floor(pct));

      // Drive Three.js camera zoom proportional to loading progress
      if (threeScene) threeScene.setProgress(pct);

      // Fade title + subtitle after 55%
      if (pct > 55) {
        var tf = Math.min((pct - 55) / 35, 1);
        if (entryTitle) entryTitle.style.opacity = String(1 - tf);
        if (entrySub)   entrySub.style.opacity   = String(1 - tf);
      }
      // Fade bar last — stays visible until nearly full
      if (pct > 85) {
        var bf = Math.min((pct - 85) / 15, 1);
        if (barWrap) barWrap.style.opacity = String(1 - bf);
      }

      if (pct < 100) {
        requestAnimationFrame(tick);
      } else {
        fill.style.width  = '100%';
        pctEl.textContent = '100%';
        if (statEl) statEl.textContent = 'READY';
        if (threeScene) {
          threeScene.startLanding(enterSite);
        } else {
          enterSite();
        }
      }
    }

    requestAnimationFrame(tick);
  }

  // ── Three.js Loading Screen Scene ─────────────────────────────────
  function createCosmicBackground() {
    // Hide old CSS background layers
    var cosmicBg = document.getElementById('cosmic-bg');
    var techGrid = document.querySelector('.tech-grid');
    if (cosmicBg) cosmicBg.style.display = 'none';
    if (techGrid) techGrid.style.display = 'none';
    // Hide HTML logo — 3D coin is the visual centrepiece
    var htmlLogo = document.querySelector('.loader-logo-wrap');
    if (htmlLogo) htmlLogo.style.visibility = 'hidden';

    if (typeof THREE === 'undefined') return null;

    var W = window.innerWidth;
    var H = window.innerHeight;

    // Renderer — already submerged: deep teal clear, denser fog
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x011e2c, 1);
    var canvas = renderer.domElement;
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;';
    var entryEl = document.getElementById('entry-screen');
    if (!entryEl) { renderer.dispose(); return null; }
    entryEl.insertBefore(canvas, entryEl.firstChild);

    // Scene & Camera — sitting just below the water line, looking slightly up toward the surface
    var scene  = new THREE.Scene();
    scene.fog  = new THREE.FogExp2(0x011e2c, 0.055);
    var camera = new THREE.PerspectiveCamera(62, W / H, 0.1, 500);
    camera.position.set(0, -0.4, 5);
    camera.lookAt(0, 1.2, 0);

    // Underwater lighting — bright surface dome, cool aqua wash, deep fill
    scene.add(new THREE.AmbientLight(0x0c2a3c, 2.4));
    var surfaceLight = new THREE.PointLight(0x80c8ff, 2.4, 40);
    surfaceLight.position.set(0, 12, 2);
    scene.add(surfaceLight);
    var aquaLight = new THREE.PointLight(0x00c8ff, 1.4, 30);
    aquaLight.position.set(-4, 2, 6);
    scene.add(aquaLight);
    var deepFill = new THREE.PointLight(0x0a3a55, 0.8, 30);
    deepFill.position.set(0, -8, -4);
    scene.add(deepFill);

    // Bioluminescent specks + bubble particles — replaces the old star canvas
    var pCount = 320;
    var pPos   = new Float32Array(pCount * 3);
    var pData  = [];
    for (var pi = 0; pi < pCount; pi++) {
      var px = (Math.random() - 0.5) * 28;
      var py = (Math.random() - 0.5) * 16;
      var pz = -Math.random() * 22 + 4;
      pPos[pi*3]   = px;
      pPos[pi*3+1] = py;
      pPos[pi*3+2] = pz;
      pData.push({ baseY: py, phase: Math.random() * Math.PI * 2, speed: 0.15 + Math.random() * 0.4, drift: 0.4 + Math.random() * 0.5 });
    }
    var pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    var pMat = new THREE.PointsMaterial({
      color: 0x70e0ff,
      size: 0.07,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    var particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // God rays from the surface — angled cylinders, additive
    var godRays = [];
    [[1.5,0,0.05,16],[-2.0,-2,-0.07,14],[3,-3,0.09,15],[-3.5,1,-0.05,13],[0.3,2,0.02,17]].forEach(function(p, i) {
      var geo = new THREE.CylinderGeometry(0.1, 1.6, p[3], 4);
      var mat = new THREE.MeshBasicMaterial({ color: 0x66c0ff, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p[0], 9 - p[3]/2, p[1]);
      mesh.rotation.z = p[2];
      scene.add(mesh);
      godRays.push({ mesh: mesh, mat: mat, phase: i * 1.1 });
    });

    // Surface plane viewed from below — translucent shimmer
    var surfaceGeo = new THREE.PlaneGeometry(80, 80, 30, 30);
    var surfaceMat = new THREE.MeshBasicMaterial({ color: 0x1a5a85, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
    var surface = new THREE.Mesh(surfaceGeo, surfaceMat);
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(0, 9, -4);
    scene.add(surface);
    var surfacePos = surface.geometry.attributes.position;

    // Wireframe wave layers BELOW camera — depth illusion as we descend
    var wRes = 60;
    function makeWavePlane(col, opacity, posY, posZ, phase) {
      var g    = new THREE.PlaneGeometry(100, 100, wRes, wRes);
      var mat  = new THREE.MeshBasicMaterial({ color: col, wireframe: true, transparent: true, opacity: opacity });
      var mesh = new THREE.Mesh(g, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, posY, posZ);
      scene.add(mesh);
      var pos   = g.attributes.position;
      var origZ = new Float32Array(pos.count);
      return { pos: pos, origZ: origZ, phase: phase, mat: mat, baseOpacity: opacity };
    }
    var wave1 = makeWavePlane(0x0b2d6e, 0.40, -3.0, -8,  0);
    var wave2 = makeWavePlane(0x061840, 0.28, -5.5, -18, 1.8);

    // Resize
    window.addEventListener('resize', function() {
      W = window.innerWidth; H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });

    // Animation state
    var clock      = new THREE.Clock();
    var running    = true;
    var rafId;
    var camTgtZ    = 5;
    var camTgtY    = -0.4;
    var burstMult  = 1;   // multiplied onto aqua light during burst flash
    var lookTgtY   = 1.2;

    // Multi-frequency wave — primary swell + cross-swell + chop + ripple
    function waveH(lx, ly, t, phase) {
      return (
        Math.sin(lx * 0.15 - t * 1.3 + phase)          * 1.1  +
        Math.sin(ly * 0.20 + t * 1.0 + phase * 0.6)    * 0.85 +
        Math.sin(lx * 0.38 + ly * 0.12 - t * 1.85)     * 0.45 +
        Math.sin(lx * 0.08 - ly * 0.32 + t * 0.7)      * 0.30 +
        Math.sin(lx * 0.60 + ly * 0.42 + t * 2.4)      * 0.14
      );
    }

    function animLoop() {
      if (!running) return;
      rafId = requestAnimationFrame(animLoop);
      var t = clock.getElapsedTime();

      // Wave height animation
      [wave1, wave2].forEach(function(w) {
        for (var vi = 0; vi < w.pos.count; vi++) {
          var lx = w.pos.getX(vi);
          var ly = w.pos.getY(vi);
          w.pos.setZ(vi, w.origZ[vi] + waveH(lx, ly, t, w.phase));
        }
        w.pos.needsUpdate = true;
      });

      // Surface (seen from below) — gentle ripple
      for (var si = 0; si < surfacePos.count; si++) {
        var sx = surfacePos.getX(si);
        var sy = surfacePos.getY(si);
        surfacePos.setZ(si, Math.sin(sx * 0.4 + t * 1.6) * 0.18 + Math.sin(sy * 0.3 - t * 1.1) * 0.15);
      }
      surfacePos.needsUpdate = true;

      // Particles drifting upward — bubble-like
      var pa = pGeo.attributes.position.array;
      for (var di = 0; di < pData.length; di++) {
        var d = pData[di];
        pa[di*3]     += Math.sin(t * d.drift + d.phase) * 0.004;
        pa[di*3 + 1] += d.speed * 0.012;
        if (pa[di*3 + 1] > 8) pa[di*3 + 1] = -8;
      }
      pGeo.attributes.position.needsUpdate = true;

      // God ray flicker
      godRays.forEach(function(r) {
        r.mat.opacity = 0.05 + Math.abs(Math.sin(t * 0.6 + r.phase)) * 0.06;
        r.mesh.rotation.y = Math.sin(t * 0.3 + r.phase) * 0.07;
      });

      // Light pulse — burstMult spikes during the burst flash
      aquaLight.intensity = (1.4 + Math.sin(t * 1.8) * 0.4) * burstMult;
      surfaceLight.intensity = 2.4 + Math.sin(t * 0.9) * 0.3;

      // Smooth camera ease toward target
      camera.position.z += (camTgtZ - camera.position.z) * 0.05;
      camera.position.y += (camTgtY - camera.position.y) * 0.05;
      camera.lookAt(0, lookTgtY, 0);

      renderer.render(scene, camera);
    }

    animLoop();

    return {
      setProgress: function(pct) {
        // We start submerged near the surface; descend deeper as loading progresses.
        var p = pct / 100;
        camTgtZ  = 5   - p * 1.8;     //  5  → 3.2  (gentle pull-in)
        camTgtY  = -0.4 - p * 1.6;    // -0.4 → -2.0 (sink)
        lookTgtY = 1.2  - p * 1.2;    //  1.2 → 0.0 (stop looking up at the surface)
      },
      startLanding: function(cb) {
        // ── Ledger typewriter on the loading screen ───────────────────────────
        // Runs over the waves while the camera sits in position.
        // When SYSTEM ONLINE finishes the globe swoops in.
        var lines = [
          'NAUTILUS LEDGER v1.0',
          'INITIALIZING OCEAN GRID...',
          'SYNCING CHAPTER NODES...',
          'TRACKING HASHWIND COORDINATES...',
          'SYSTEM ONLINE'
        ];

        var textEl = document.createElement('div');
        textEl.style.cssText = [
          'position:absolute',
          'top:40%',
          'left:50%',
          'transform:translate(-50%,-50%)',
          'color:#00d4ff',
          'font-family:"JetBrains Mono",monospace',
          'font-size:0.85rem',
          'letter-spacing:2px',
          'text-align:center',
          'line-height:2',
          'z-index:10',
          'pointer-events:none',
          'text-shadow:0 0 10px rgba(0,212,255,0.7)',
          'opacity:1',
          'transition:opacity 0.6s ease'
        ].join(';');
        var entryEl = document.getElementById('entry-screen');
        if (entryEl) entryEl.appendChild(textEl);

        var lineIdx = 0, charIdx = 0, current = '';
        var lineEl = document.createElement('div');
        lineEl.style.whiteSpace = 'nowrap';
        textEl.appendChild(lineEl);

        function typeLine() {
          if (lineIdx >= lines.length) {
            // All lines done — brief hold then swoop
            setTimeout(function() {
              // Fade typewriter text out
              textEl.style.opacity = '0';

              // Fade Three.js canvas so home page shows through
              var fadeDur = 950;
              var fadeStart = performance.now();
              function fadeCanvas(now) {
                if (!running) return;
                var p = Math.min((now - fadeStart) / fadeDur, 1);
                canvas.style.opacity = String(1 - p);
                if (p < 1) requestAnimationFrame(fadeCanvas);
              }
              requestAnimationFrame(fadeCanvas);

              // Position globe far away before it zooms
              if (window._globe) {
                window._globe.pointOfView({ lat: 20, lng: 10, altitude: 6.5 }, 0);
              }

              // Clear map boot overlay + reveal hero content
              var overlay = document.getElementById('mapBootOverlay');
              if (overlay) overlay.classList.add('boot-done');
              var heroContent = document.querySelector('.hero-content');
              if (heroContent) heroContent.classList.add('hero-revealed');
              var heroStats = document.querySelector('.hero-stats');
              if (heroStats) heroStats.classList.add('stats-revealed');

              // Slight delay so canvas starts fading before the globe swoops
              setTimeout(function() { if (cb) cb(); }, 200);
            }, 400);
            return;
          }

          var target = lines[lineIdx];
          if (charIdx < target.length) {
            current += target[charIdx];
            lineEl.textContent = current;
            charIdx++;
            setTimeout(typeLine, 14);
          } else {
            lineIdx++;
            charIdx = 0;
            current = '';
            var pause = lineIdx >= lines.length ? 300 : 90;
            setTimeout(function() {
              if (lineIdx < lines.length) {
                lineEl = document.createElement('div');
                lineEl.style.whiteSpace = 'nowrap';
                textEl.appendChild(lineEl);
              }
              typeLine();
            }, pause);
          }
        }

        // Small delay before typing starts so it feels intentional
        setTimeout(typeLine, 1000);
      },
      burst: function(onComplete) {
        // Zoom the globe from altitude 6.5 → 2.0 over exactly 1.2s —
        // synchronized with the entry screen dissolve so the globe
        // arrives in position just as the loading screen becomes invisible.
        if (window._globe) {
          window._globe.pointOfView({ lat: 20, lng: 10, altitude: 2.0 }, 1200);
        }
        // Final dive: camera plunges deeper as loader fades out
        camTgtZ = 1.5;
        camTgtY = -3.5;
        lookTgtY = -0.8;
        if (onComplete) onComplete();
      },
      stop: function() {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        renderer.dispose();
      }
    };
  }

  // (createOceanParticles defined later for bioluminescent particles)

  // Shuffle Text Animation
  function shuffleText(element) {
    if (!element) {
      originalError('Shuffle element not found');
      return;
    }
    
    const originalText = element.textContent;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    const length = originalText.length;
    let iteration = 0;
    
    const interval = setInterval(function() {
      element.textContent = originalText
        .split('')
        .map(function(char, index) {
          if (index < iteration) {
            return originalText[index];
          }
          if (char === ' ') return ' ';
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join('');
      
      if (iteration >= length) {
        clearInterval(interval);
        element.textContent = originalText;
      }
      
      iteration += 1 / 4.3;
    }, 30);
  }

  // Map Setup — 3D Globe (globe.gl)
  function initializeMap() {
    if (typeof Globe === 'undefined') {
      originalError('Globe.gl not loaded');
      return;
    }

    var mapEl = document.getElementById('map');
    if (!mapEl) return;

    var chapters = window._globeChapters = [
      { name: 'Port of Ostia',    lat: 41.73,        lng: 12.29,         unlocked: false, num: 1  },
      { name: 'Signals in Cairo', lat: 30.0444,       lng: 31.2357,       unlocked: false, num: 2  },
      { name: 'Arabian Tides',    lat: 20,            lng: 60,            unlocked: false, num: 3  },
      { name: 'Indian Abyss',     lat: -10,           lng: 80,            unlocked: false, num: 4  },
      { name: 'Philippine Sea',   lat: 15,            lng: 130,           unlocked: false, num: 5  },
      { name: 'South Pacific',    lat: -21.694129,    lng: -147.915508,   unlocked: false, num: 6  },
      { name: 'North Pacific',    lat: 40,            lng: -150,          unlocked: false, num: 7  },
      { name: 'Bering Sea',       lat: 58,            lng: -175,          unlocked: false, num: 8  },
      { name: 'North Atlantic',   lat: 45,            lng: -30,           unlocked: false, num: 9  },
      { name: 'Gulf of America',  lat: 25,            lng: -90,           unlocked: false, num: 10 },
      { name: 'South Atlantic',   lat: -20,           lng: -30,           unlocked: false, num: 11 },
      { name: 'Return to Ostia',  lat: 41.73,         lng: 12.29,         unlocked: false, num: 12 }
    ];

    // Apply any unlock states fetched from config.json before the globe initialised
    if (window._chapterUnlockStates) {
      chapters.forEach(function(c) {
        if (window._chapterUnlockStates[c.num] !== undefined) {
          c.unlocked = window._chapterUnlockStates[c.num];
        }
      });
    }

    // ── Popup ────────────────────────────────────────────────────────────────
    var popup = document.createElement('div');
    popup.id = 'globe-popup';
    popup.style.cssText = [
      'position:fixed',
      'display:none',
      'z-index:20',
      'pointer-events:none',
      'text-align:center',
      'padding:1rem 1.4rem',
      'background:linear-gradient(135deg,rgba(10,37,64,0.96) 0%,rgba(30,95,140,0.96) 100%)',
      'border:2px solid #f4a836',
      'border-radius:10px',
      'color:#e8d4b8',
      'min-width:200px',
      'box-shadow:0 0 24px rgba(0,212,255,0.25)',
      'transform:translate(-50%,-110%)'
    ].join(';');
    document.body.appendChild(popup);

    function showPopup(chapter, x, y) {
      var statusColor = chapter.unlocked ? '#4ec4c4' : '#999';
      var statusBg    = chapter.unlocked ? 'rgba(78,196,196,0.2)' : 'rgba(100,100,100,0.2)';
      var statusBdr   = chapter.unlocked ? '#4ec4c4' : '#666';
      var statusText  = chapter.unlocked ? '✓ UNLOCKED' : 'LOCKED';
      popup.innerHTML =
        '<strong style="color:#f4a836;font-size:0.8rem;letter-spacing:2px;display:block;margin-bottom:0.4rem;">CHAPTER ' + String(chapter.num).padStart(2,'0') + '</strong>' +
        '<span style="font-size:1.1rem;font-weight:bold;display:block;margin-bottom:0.6rem;">' + chapter.name + '</span>' +
        '<span style="font-size:0.75rem;color:' + statusColor + ';font-weight:700;letter-spacing:1px;padding:0.3rem 0.7rem;border-radius:10px;background:' + statusBg + ';border:1px solid ' + statusBdr + ';display:inline-block;">' + statusText + '</span>';
      popup.style.left  = x + 'px';
      popup.style.top   = y + 'px';
      popup.style.display = 'block';
    }

    function hidePopup() { popup.style.display = 'none'; }

    // Hide popup on scroll
    window.addEventListener('scroll', hidePopup, { passive: true });

    // Hide popup AND resume rotation when clicking anywhere outside the globe
    document.addEventListener('click', function(e) {
      if (!e.target.closest('#map')) {
        hidePopup();
        controls.autoRotate = true;
      }
    });

    // ── Globe ────────────────────────────────────────────────────────────────
    var globe = window._globe = Globe()
      // Dark dramatic night texture — deep ocean navy look
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-night.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#00aaff')
      .atmosphereAltitude(0.22)
      // Chapter markers
      .pointsData(chapters)
      .pointLat('lat')
      .pointLng('lng')
      .pointColor(function(d) { return d.unlocked ? '#f4a836' : '#00d4ff'; })
      .pointRadius(function(d) { return d.unlocked ? 0.7 : 0.45; })
      .pointAltitude(0.02)
      .pointResolution(16)
      // Pulsing rings on locked chapters
      .ringsData(chapters.filter(function(c) { return !c.unlocked; }))
      .ringLat('lat')
      .ringLng('lng')
      .ringColor(function() {
        return function(t) { return 'rgba(74,222,128,' + Math.max(0, 0.85 - t * 0.85) + ')'; };
      })
      .ringMaxRadius(4)
      .ringPropagationSpeed(1.5)
      .ringRepeatPeriod(2000)
      // Arcs — empty until a dot is clicked
      .arcsData([])
      .arcStartLat('startLat')
      .arcStartLng('startLng')
      .arcEndLat('endLat')
      .arcEndLng('endLng')
      .arcColor(function() { return ['rgba(74,222,128,0.95)', 'rgba(74,222,128,0.0)']; })
      .arcStroke(0.7)
      .arcDashLength(0.5)
      .arcDashGap(0.3)
      .arcDashAnimateTime(800)
      (mapEl);

    globe.pointOfView({ lat: 20, lng: 10, altitude: 2.0 });

    // Slow auto-rotate, stops on first interaction
    var controls = globe.controls();
    controls.autoRotate      = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom      = false;
    controls.rotateSpeed     = 0.6;

    // Stop rotation while user interacts with the globe
    mapEl.addEventListener('pointerdown', function() {
      controls.autoRotate = false;
    });

    // ── Click → arcs + popup ─────────────────────────────────────────────────
    var arcTimer = null;
    globe.onPointClick(function(point, event) {
      if (arcTimer) clearTimeout(arcTimer);

      var idx = chapters.findIndex(function(c) { return c.num === point.num; });
      var arcs = [];
      if (idx > 0)
        arcs.push({ startLat: point.lat, startLng: point.lng,
                    endLat: chapters[idx - 1].lat, endLng: chapters[idx - 1].lng });
      if (idx < chapters.length - 1)
        arcs.push({ startLat: point.lat, startLng: point.lng,
                    endLat: chapters[idx + 1].lat, endLng: chapters[idx + 1].lng });

      globe.arcsData(arcs);
      arcTimer = setTimeout(function() { globe.arcsData([]); }, 1200);

      showPopup(point, event.clientX, event.clientY);
    });

    // ── Resize ───────────────────────────────────────────────────────────────
    window.addEventListener('resize', function() {
      globe.width(mapEl.offsetWidth).height(mapEl.offsetHeight);
    });
  }

  // Navigation scroll effect
  function initNavigation() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    window.addEventListener('scroll', function() {
      const currentScroll = window.pageYOffset;

      if (currentScroll > 100) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    });
  }

  // Smooth scrolling
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.CGC_lenis) return; // Lenis handles anchor scrolling
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // Modal functions
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    if (window.CGC_lenis) window.CGC_lenis.stop();
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
    if (window.CGC_lenis) window.CGC_lenis.start();
  }

  function closeAllModals() {
    document.querySelectorAll('.modal, .info-modal').forEach(function(modal) {
      modal.classList.remove('active');
    });
    document.body.style.overflow = 'auto';
    if (window.CGC_lenis) window.CGC_lenis.start();
  }

  // Wallet connection with security
  function connectWallet(walletType) {
    // Validate wallet type
    const validWallets = ['metamask', 'walletconnect', 'coinbase'];
    if (!validWallets.includes(walletType)) {
      originalError('Invalid wallet type');
      return;
    }

    // Check HTTPS
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      alert('For security, wallet connections require HTTPS');
      return;
    }

    if (typeof window.ethereum !== 'undefined') {
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then(function(accounts) {
          if (!accounts || accounts.length === 0) {
            throw new Error('No accounts found');
          }
          
          const account = accounts[0];
          
          // Validate Ethereum address format
          if (!/^0x[a-fA-F0-9]{40}$/.test(account)) {
            throw new Error('Invalid account format');
          }
          
          const walletBtn = document.querySelector('.wallet-connect-btn .nav-text');
          if (walletBtn) {
            walletBtn.textContent = account.substring(0, 6) + '...' + account.substring(account.length - 4);
          }
          
          closeAllModals();
          originalLog('Wallet connected:', account);
        })
        .catch(function(error) {
          originalError('Connection error:', error);
          alert('Failed to connect wallet. Please try again.');
        });
    } else {
      alert('Please install ' + (walletType === 'metamask' ? 'MetaMask' : 'a Web3 wallet'));
    }
  }

  // ── MAP BOOT SEQUENCE ─────────────────────────────────────────────────────
  function runMapBootSequence() {
    var overlay  = document.getElementById('mapBootOverlay');
    var bootText = document.getElementById('mapBootText');
    var scanLine = document.getElementById('mapScanLine');
    var hudCorners = document.querySelector('.map-hud-corners');
    if (!overlay || !bootText || !scanLine) return;

    var lines = [
      'NAUTILUS LEDGER v1.0',
      'INITIALIZING OCEAN GRID...',
      'SYNCING CHAPTER NODES...',
      'TRACKING HASHWIND COORDINATES...',
      'SYSTEM ONLINE'
    ];

    var lineIndex = 0;
    var charIndex = 0;
    var currentLine = '';

    function typeLine() {
      if (lineIndex >= lines.length) {
        // All lines typed — trigger scan line + HUD
        setTimeout(function() {
          scanLine.classList.add('scanning');
          if (hudCorners) hudCorners.classList.add('hud-visible');
        }, 150);
        // Dissolve overlay
        setTimeout(function() {
          overlay.classList.add('boot-done');
          // Reveal hero content after overlay finishes fading (1s transition)
          setTimeout(function() {
            var heroContent = document.querySelector('.hero-content');
            if (heroContent) heroContent.classList.add('hero-revealed');
            var heroStats = document.querySelector('.hero-stats');
            if (heroStats) heroStats.classList.add('stats-revealed');
          }, 1050);
        }, 1000);
        return;
      }

      var target = lines[lineIndex];
      if (charIndex < target.length) {
        currentLine += target[charIndex];
        bootText.textContent = currentLine;
        charIndex++;
        setTimeout(typeLine, 14);
      } else {
        // Line done — pause then start new line
        currentLine += '\n';
        bootText.textContent = currentLine;
        lineIndex++;
        charIndex = 0;
        setTimeout(typeLine, lineIndex === lines.length - 1 ? 250 : 80);
      }
    }

    // Start quickly — map tiles are already loading in the background
    setTimeout(typeLine, 200);
  }

  // Render Impact section based on IMPACT_DATA config
  // ── Ocean Dive Transition ──────────────────────────────────────────────────
  function initDiveSection() {
    var section = document.getElementById('dive-section');
    var canvas  = document.getElementById('dive-canvas');
    if (!section || !canvas || typeof THREE === 'undefined') return;

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { section.classList.add('dive-fallback'); return; }

    var isMobile = window.innerWidth < 768;
    var W = window.innerWidth;
    var H = window.innerHeight;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isMobile, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.5));
    renderer.setClearColor(0x020810, 1);

    var scene  = new THREE.Scene();
    scene.fog  = new THREE.FogExp2(0x020810, 0.018);

    var fov  = isMobile ? 78 : 60;
    var camZ0 = isMobile ? 13 : 12;
    var camera = new THREE.PerspectiveCamera(fov, W / H, 0.1, 300);
    camera.position.set(0, 1.5, camZ0);
    camera.lookAt(0, 0, 0);

    // Lighting
    scene.add(new THREE.AmbientLight(0x0a1828, 3.0));
    var sunLight = new THREE.DirectionalLight(0x2244aa, 0.8);
    sunLight.position.set(0, 20, -10);
    scene.add(sunLight);
    var aquaLight = new THREE.PointLight(0x00c8ff, 1.5, 40);
    aquaLight.position.set(-3, -2, 5);
    scene.add(aquaLight);
    var deepLight = new THREE.PointLight(0x004488, 0.0, 60);
    deepLight.position.set(0, -10, 0);
    scene.add(deepLight);

    var wRes = isMobile ? 36 : 72;

    function makeWave(colTop, colBot, opacity, posY, posZ, phase) {
      var g = new THREE.PlaneGeometry(140, 80, wRes, wRes);
      var cnt = g.attributes.position.count;
      var cols = new Float32Array(cnt * 3);
      var c1 = new THREE.Color(colTop);
      var c2 = new THREE.Color(colBot);
      for (var i = 0; i < cnt; i++) {
        var t = (g.attributes.position.getY(i) + 40) / 80;
        var c = c2.clone().lerp(c1, t);
        cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      var mat = new THREE.MeshPhongMaterial({
        vertexColors: true,
        transparent: true,
        opacity: opacity,
        shininess: 55,
        specular: new THREE.Color(0x003355),
        side: THREE.DoubleSide
      });
      var mesh = new THREE.Mesh(g, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, posY, posZ);
      scene.add(mesh);
      return { pos: g.attributes.position, colorAttr: g.attributes.color, mat: mat, baseOpacity: opacity, phase: phase, c1: c1, c2: c2 };
    }

    var waves = isMobile ? [
      makeWave(0x1a4a8a, 0x0a2244, 0.90,  0.0,   0,  0.0),
      makeWave(0x0d3060, 0x061830, 0.75, -2.0, -14,  1.8),
      makeWave(0x040e28, 0x020810, 0.50, -4.5, -28,  3.6),
    ] : [
      makeWave(0x1a4a8a, 0x0a2244, 0.90,  0.0,   0,  0.0),
      makeWave(0x0d3060, 0x061830, 0.75, -1.8, -12,  1.8),
      makeWave(0x071e40, 0x030e20, 0.60, -3.5, -22,  3.2),
      makeWave(0x040e28, 0x020810, 0.45, -5.0, -32,  4.8),
    ];

    // God rays — fewer on mobile
    var godRays = [];
    var rayDefs = isMobile
      ? [[1.5,8,-10,0.06,12],[-2,8,-14,-0.08,10]]
      : [[2.5,8,-10,0.08,12],[-2,8,-14,-0.09,10],[0.5,8,-8,0.04,14],[-3.5,8,-12,-0.06,11],[4,8,-16,0.10,13]];
    rayDefs.forEach(function(p, i) {
      var geo = new THREE.CylinderGeometry(0.08, 2.5, p[4], 4);
      var mat = new THREE.MeshBasicMaterial({ color: 0x0066aa, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p[0], p[1] - p[4] / 2, p[2]);
      mesh.rotation.z = p[3];
      scene.add(mesh);
      godRays.push({ mesh: mesh, mat: mat, phase: i * 1.2, targetOpacity: 0 });
    });

    // 3D coin
    var coinGroup = new THREE.Group();
    var coinMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.12, 48),
      new THREE.MeshPhongMaterial({ color: 0xc89020, shininess: 120, specular: new THREE.Color(0xffdd44), emissive: new THREE.Color(0x1a0800) })
    );
    coinMesh.rotation.x = Math.PI / 2;
    coinGroup.add(coinMesh);
    var ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.04, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xf4a836, transparent: true, opacity: 0.6 })
    );
    ringMesh.rotation.x = Math.PI / 2;
    coinGroup.add(ringMesh);
    coinGroup.position.set(0, -6, -4);
    coinGroup.visible = false;
    scene.add(coinGroup);

    // Ambient ocean sound — desktop only (mobile autoplay restrictions + battery)
    var sound = isMobile ? null : (function() {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        var ctx = new AC();
        var sr = ctx.sampleRate;
        var buf = ctx.createBuffer(1, sr * 4, sr);
        var d = buf.getChannelData(0);
        for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        var src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.7;
        var gain = ctx.createGain(); gain.gain.value = 0;
        src.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
        return { ctx: ctx, gain: gain, started: false,
          start: function() { if (this.started) return; this.started = true; ctx.resume(); src.start(); },
          vol: function(v) { gain.gain.linearRampToValueAtTime(v * 0.14, ctx.currentTime + 0.8); }
        };
      } catch(e) { return null; }
    })();

    // Wave height — identical formula to loading screen
    function waveH(lx, ly, t, phase) {
      return Math.sin(lx*0.15 - t*1.3 + phase)*1.10 + Math.sin(ly*0.20 + t*1.0 + phase*0.6)*0.85 + Math.sin(lx*0.38 + ly*0.12 - t*1.85)*0.45 + Math.sin(lx*0.08 - ly*0.32 + t*0.70)*0.30 + Math.sin(lx*0.60 + ly*0.42 + t*2.40)*0.14;
    }

    var clock = new THREE.Clock();
    var running = false, rafId;
    var camTgtY = 1.5, camTgtZ = camZ0;
    var fogTgt = 0.018;
    var clearCur = new THREE.Color(0x020810);
    var clearTgt = new THREE.Color(0x020810);
    var diveProgress = 0;

    // Depth palette keyframes — slightly pulled back on mobile so wide waves still frame the view
    var keyframes = isMobile ? [
      { bg: 0x020810, fog: 0.020, camY: 1.5,  camZ: 13.0 },
      { bg: 0x010610, fog: 0.030, camY: -0.5, camZ: 10.0 },
      { bg: 0x010408, fog: 0.045, camY: -2.5, camZ: 8.0  },
      { bg: 0x000306, fog: 0.070, camY: -5.0, camZ: 6.0  },
    ] : [
      { bg: 0x020810, fog: 0.018, camY: 1.5,  camZ: 12.0 },
      { bg: 0x010610, fog: 0.026, camY: -0.5, camZ: 9.0  },
      { bg: 0x010408, fog: 0.040, camY: -2.5, camZ: 7.0  },
      { bg: 0x000306, fog: 0.065, camY: -5.2, camZ: 4.8  },
    ];

    function applyDepth(p) {
      var kLen = keyframes.length - 1;
      var idx  = p * kLen;
      var lo   = keyframes[Math.floor(idx)];
      var hi   = keyframes[Math.min(kLen, Math.ceil(idx))];
      var t    = idx - Math.floor(idx);
      clearTgt.setHex(lo.bg).lerp(new THREE.Color(hi.bg), t);
      fogTgt  = lo.fog  + (hi.fog  - lo.fog)  * t;
      camTgtY = lo.camY + (hi.camY - lo.camY) * t;
      camTgtZ = lo.camZ + (hi.camZ - lo.camZ) * t;
    }

    function onDiveScroll() {
      var top = section.getBoundingClientRect().top;
      var h   = section.offsetHeight - H;
      diveProgress = Math.max(0, Math.min(1, -top / h));
      applyDepth(diveProgress);

      waves.forEach(function(w) {
        w.mat.opacity = Math.min(0.98, w.baseOpacity + diveProgress * 0.25);
      });

      // God rays from 50% depth
      var rp = diveProgress > 0.5 ? Math.min(1, (diveProgress - 0.5) / 0.35) : 0;
      godRays.forEach(function(r) { r.targetOpacity = r === godRays[0] ? 0.07 * rp : 0.05 * rp; });
      deepLight.intensity = rp * 1.4;

      // Coin 25–82%
      coinGroup.visible = diveProgress > 0.25 && diveProgress < 0.82;

      // Sound
      if (sound) {
        if (diveProgress > 0.05) { sound.start(); sound.vol(diveProgress); }
        else sound.vol(0);
      }
    }

    function animLoop() {
      if (!running) return;
      rafId = requestAnimationFrame(animLoop);
      var t = clock.getElapsedTime();

      waves.forEach(function(w, wi) {
        for (var vi = 0; vi < w.pos.count; vi++) {
          var lx = w.pos.getX(vi), ly = w.pos.getY(vi);
          var h = waveH(lx, ly, t, w.phase);
          w.pos.setZ(vi, h);
          if (wi === 0) {
            var peak = Math.max(0, h / 2.2);
            var col = w.c2.clone().lerp(w.c1, (ly + 40) / 80).lerp(new THREE.Color(0x4488cc), peak * 0.28);
            w.colorAttr.setXYZ(vi, col.r, col.g, col.b);
          }
        }
        w.pos.needsUpdate = true;
        if (wi === 0) w.colorAttr.needsUpdate = true;
      });

      camera.position.y += (camTgtY - camera.position.y) * 0.045;
      camera.position.z += (camTgtZ - camera.position.z) * 0.045;
      camera.lookAt(0, camera.position.y - 0.8, 0);
      scene.fog.density += (fogTgt - scene.fog.density) * 0.04;
      clearCur.lerp(clearTgt, 0.04);
      renderer.setClearColor(clearCur, 1);
      aquaLight.intensity = 1.5 + Math.sin(t * 1.4) * 0.4;

      godRays.forEach(function(r) {
        r.mat.opacity += (r.targetOpacity - r.mat.opacity) * 0.06;
        r.mesh.rotation.y = Math.sin(t * 0.28 + r.phase) * 0.09;
      });

      if (coinGroup.visible) {
        coinGroup.rotation.y = t * 0.35;
        coinGroup.position.y = -6 + Math.sin(t * 0.5) * 0.4 + diveProgress * 4;
      }

      renderer.render(scene, camera);
    }

    window.addEventListener('scroll', onDiveScroll, { passive: true });

    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e) {
        running = e.isIntersecting;
        if (running) { clock.start(); animLoop(); }
        else cancelAnimationFrame(rafId);
      });
    }, { threshold: 0 });
    io.observe(section);

    window.addEventListener('resize', function() {
      W = window.innerWidth; H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });
  }

  function initChapterCards() {
    var cards = document.querySelectorAll('.chapter-card');
    cards.forEach(function(card) {
      var spotlight = document.createElement('div');
      spotlight.className = 'chapter-card-spotlight';
      card.appendChild(spotlight);

      card.addEventListener('mousemove', function(e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width - 0.5;
        var y = (e.clientY - rect.top)  / rect.height - 0.5;
        card.style.transform = 'perspective(900px) rotateY(' + (x * 8) + 'deg) rotateX(' + (-y * 6) + 'deg) translateY(-10px) scale3d(1.02,1.02,1.02)';
        card.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((e.clientY - rect.top)  / rect.height * 100).toFixed(1) + '%');
      });

      card.addEventListener('mouseleave', function() {
        card.style.transform = '';
        card.style.removeProperty('--mx');
        card.style.removeProperty('--my');
      });
    });
  }

  function initPartnerCards() {
    var cards = document.querySelectorAll('.partner-card:not(.partner-pending)');
    cards.forEach(function(card) {
      card.addEventListener('mousemove', function(e) {
        var rect = card.getBoundingClientRect();
        var x = (e.clientX - rect.left) / rect.width  - 0.5;
        var y = (e.clientY - rect.top)  / rect.height - 0.5;
        card.style.transform = 'perspective(800px) rotateY(' + (x * 14) + 'deg) rotateX(' + (-y * 10) + 'deg) scale3d(1.03,1.03,1.03)';
      });
      card.addEventListener('mouseleave', function() {
        card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
      });
    });
  }

  function renderImpact() {
    const prelaunch = document.getElementById('impactPrelaunch');
    const live = document.getElementById('impactLive');
    if (!prelaunch || !live) return;

    if (IMPACT_DATA.launched) {
      prelaunch.style.display = 'none';
      live.style.display = 'block';

      // Populate live stats
      var fields = {
        'impactChapters': IMPACT_DATA.chaptersUnlocked,
        'impactLbs': IMPACT_DATA.lbsRemoved.toLocaleString(),
        'impactMiles': IMPACT_DATA.milesCleaned.toLocaleString(),
        'impactDonations': IMPACT_DATA.donationsVerified,
        'impactUSD': '$' + IMPACT_DATA.donationUSD.toLocaleString()
      };
      Object.keys(fields).forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.textContent = fields[id];
      });

      // Populate milestones
      var list = document.getElementById('milestoneList');
      if (list && IMPACT_DATA.milestones.length > 0) {
        list.textContent = '';
        IMPACT_DATA.milestones.forEach(function(m) {
          var item = document.createElement('div');
          item.className = 'milestone-item';

          var dateSpan = document.createElement('span');
          dateSpan.className = 'milestone-date';
          dateSpan.textContent = m.date;

          var info = document.createElement('div');
          info.className = 'milestone-info';

          var title = document.createElement('strong');
          title.textContent = m.title;

          var loc = document.createElement('span');
          loc.textContent = m.location;

          var impact = document.createElement('em');
          impact.textContent = m.impact;

          info.appendChild(title);
          info.appendChild(loc);
          info.appendChild(impact);
          item.appendChild(dateSpan);
          item.appendChild(info);
          list.appendChild(item);
        });
      }
    } else {
      prelaunch.style.display = 'block';
      live.style.display = 'none';
    }
  }

  // ─── CHAPTER BACKGROUND PATHS ────────────────────────────────────────────
  // ─── CHAPTER CARD LINKS ──────────────────────────────────────────────────
  function updateChapterSonar() {
    // Remove any previous sonar state
    document.querySelectorAll('.chapter-sonar-ring').forEach(function(el) { el.remove(); });
    document.querySelectorAll('.chapter-card').forEach(function(card) {
      card.classList.remove('chapter-unlocked', 'chapter-sonar-active');
    });

    // Collect unlocked cards and their chapter numbers
    var unlocked = [];
    document.querySelectorAll('.chapter-card').forEach(function(card) {
      var badge  = card.querySelector('.status-badge');
      var numEl  = card.querySelector('.chapter-number');
      if (!badge || !numEl || !badge.classList.contains('unlocked')) return;
      var num = parseInt(numEl.textContent.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num)) unlocked.push({ card: card, num: num });
    });

    if (!unlocked.length) return;

    // All unlocked → orange accent
    unlocked.forEach(function(item) {
      item.card.classList.add('chapter-unlocked');
    });

    // Highest-numbered unlocked → sonar ring
    unlocked.sort(function(a, b) { return b.num - a.num; });
    var latest = unlocked[0].card;
    latest.classList.add('chapter-sonar-active');

    var ring = document.createElement('div');
    ring.className = 'chapter-sonar-ring';
    latest.appendChild(ring);
  }

  function initChapterLinks() {
    document.querySelectorAll('.chapter-card[data-chapter]').forEach(function(card) {
      card.addEventListener('click', function(e) {
        var badge = card.querySelector('.status-badge');
        if (!badge || badge.classList.contains('locked')) return;
        var ch = card.getAttribute('data-chapter');
        window.location.href = 'chapter.html?ch=' + ch;
      });
    });
  }

  function injectChapterPaths() {
    var NS = 'http://www.w3.org/2000/svg';
    var W = 696, H = 316, CX = 348, CY = 158;

    // One unique flow angle per card — spread across all 360° so each tile looks distinct
    var flowAngles = [0, 135, 270, 45, 180, 315, 90, 225, 60, 150, 300, 30];

    document.querySelectorAll('.chapter-card').forEach(function(card, cardIndex) {
      var existing = card.querySelector('.chapter-paths-svg');
      if (existing) existing.remove();

      var badge = card.querySelector('.status-badge');

      // Seeded LCG — deterministic variety per card
      var seed = cardIndex * 1664525 + 1013904223;
      function rng() {
        seed = ((seed * 1664525) + 1013904223) >>> 0;
        return seed / 0xffffffff;
      }
      function rand(min, max) { return min + rng() * (max - min); }

      var svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('fill', 'none');
      svg.setAttribute('aria-hidden', 'true');
      svg.classList.add('chapter-paths-svg');

      // Rotate the whole path bundle so each card flows in a different direction
      var angle = flowAngles[cardIndex % flowAngles.length];
      var g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', 'rotate(' + angle + ' ' + CX + ' ' + CY + ')');
      svg.appendChild(g);

      // Paths always flow left→right inside the group; rotation handles direction.
      // They start far outside the left edge and end far past the right edge so
      // after any rotation the paths always sweep fully across the card.
      var pathCount = Math.round(rand(16, 24));

      for (var i = 0; i < pathCount; i++) {
        // Space paths evenly across the card height with a little jitter
        var yBase = (H / (pathCount + 1)) * (i + 1);
        var yOff  = rand(-18, 18);

        var x0  = -W * 0.6;
        var y0  = yBase + yOff + rand(-25, 25);
        var cx1 = W * rand(0.1, 0.35);
        var cy1 = yBase + rand(-70, 70);
        var cx2 = W * rand(0.65, 0.9);
        var cy2 = yBase + rand(-70, 70);
        var x3  = W * 1.6;
        var y3  = yBase + yOff + rand(-25, 25);

        var d = 'M'  + x0.toFixed(1)  + ' ' + y0.toFixed(1) +
                ' C' + cx1.toFixed(1) + ' ' + cy1.toFixed(1) +
                ' '  + cx2.toFixed(1) + ' ' + cy2.toFixed(1) +
                ' '  + x3.toFixed(1)  + ' ' + y3.toFixed(1);

        var path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', '#00d4ff');
        path.setAttribute('stroke-width', (0.5 + rand(0, 0.8)).toFixed(2));
        g.appendChild(path);
      }

      // Insert before measuring so getTotalLength() works
      card.insertBefore(svg, card.firstChild);

      // Per-path Web Animation — uses actual path length for correct dasharray
      g.querySelectorAll('path').forEach(function(path) {
        var len = path.getTotalLength();
        path.setAttribute('stroke-dasharray', len);
        path.setAttribute('stroke-dashoffset', len);

        var dur   = rand(10000, 26000);
        var delay = -rand(0, dur);   // start mid-cycle so it's never blank on first hover
        var fwd   = rng() > 0.5;    // half flow left, half flow right within the bundle

        path.animate(
          [
            { strokeDashoffset: fwd ?  len : -len, opacity: 0.15 },
            { strokeDashoffset: len * 0.2,          opacity: 0.9 },
            { strokeDashoffset: fwd ? -len :  len, opacity: 0.15 }
          ],
          {
            duration:   dur,
            delay:      delay,
            iterations: Infinity,
            easing:     'linear',
            fill:       'both'
          }
        );
      });
    });
  }

  // ─── APPLY CONFIG ────────────────────────────────────────────────────────
  function applyConfig(cfg) {
    if (!cfg) return;

    // Maintenance redirect
    if (cfg.maintenance) {
      window.location.replace('maintenance.html');
      return;
    }

    // Stats
    if (cfg.stats) {
      var statEls = {
        'CHAPTERS':     cfg.stats.chapters,
        'LBS REMOVED':  cfg.stats.lbs,
        'MILES CLEANED': cfg.stats.miles
      };
      document.querySelectorAll('.stat-value').forEach(function(el) {
        var label = el.nextElementSibling && el.nextElementSibling.textContent.trim();
        if (label && statEls[label] !== undefined) {
          el.textContent = statEls[label];
        }
      });
    }

    // Chapter unlock badges + globe sync
    if (cfg.chapters) {
      // Store states globally so the globe can read them when it initialises
      window._chapterUnlockStates = {};
      cfg.chapters.forEach(function(ch) {
        window._chapterUnlockStates[parseInt(ch.num, 10)] = !!ch.unlocked;
      });

      cfg.chapters.forEach(function(ch) {
        // Update DOM chapter cards
        var cards = document.querySelectorAll('.chapter-card');
        cards.forEach(function(card) {
          var numEl = card.querySelector('.chapter-number');
          if (numEl && numEl.textContent.trim() === 'CH. ' + ch.num) {
            var badge = card.querySelector('.status-badge');
            if (badge) {
              badge.textContent = ch.unlocked ? 'UNLOCKED' : 'LOCKED';
              badge.className   = 'status-badge ' + (ch.unlocked ? 'unlocked' : 'locked');
            }
          }
        });

        // If globe already initialised, update it live
        if (window._globeChapters) {
          var gc = window._globeChapters.find(function(c) { return c.num === parseInt(ch.num, 10); });
          if (gc) gc.unlocked = !!ch.unlocked;
        }
      });

      // Refresh globe if already running
      if (window._globe && window._globeChapters) {
        window._globe
          .pointsData(window._globeChapters)
          .ringsData(window._globeChapters.filter(function(c) { return !c.unlocked; }));
      }

      // Re-inject background paths now that badges are updated
      injectChapterPaths();
      initChapterLinks();
      updateChapterSonar();
    }

    // Social links
    if (cfg.social) {
      var map = {
        'twitter':  cfg.social.twitter,
        'discord':  cfg.social.discord,
        'telegram': cfg.social.telegram
      };
      document.querySelectorAll('a[data-social]').forEach(function(a) {
        var key = a.getAttribute('data-social');
        if (map[key]) a.href = map[key];
      });
    }

    // Presale tracker
    applyPresaleTracker(cfg.presale);

    // Visit beacon
    if (cfg.beaconUrl) initBeacon(cfg.beaconUrl);
  }

  function initBeacon(beaconUrl) {
    var _startTs = Date.now();
    var _uid = localStorage.getItem('cgc_vis_uid') || (function() {
      var id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('cgc_vis_uid', id);
      return id;
    })();
    function sendBeacon(dur) {
      var payload = JSON.stringify({
        ts:  _startTs,
        dur: dur,
        uid: _uid,
        ref: document.referrer || '',
        dev: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
      });
      if (dur > 0 && navigator.sendBeacon) {
        navigator.sendBeacon(beaconUrl, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(beaconUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function() {});
      }
    }
    sendBeacon(0);
    window.addEventListener('pagehide', function() { sendBeacon(Date.now() - _startTs); });
  }

  var PRESALE_ROUNDS = [
    { round: 1,  price: 20000, target: 250000 },
    { round: 2,  price: 18000, target: 300000 },
    { round: 3,  price: 16000, target: 400000 },
    { round: 4,  price: 14000, target: 500000 },
    { round: 5,  price: 12000, target: 750000 },
    { round: 6,  price: 10000, target: 1000000 },
    { round: 7,  price: 8000,  target: 1500000 },
    { round: 8,  price: 6000,  target: 2000000 },
    { round: 9,  price: 4000,  target: 2500000 },
    { round: 10, price: 2000,  target: 3000000 }
  ];

  function applyPresaleTracker(presale) {
    var tracker   = document.getElementById('presaleTracker');
    var countdown = document.getElementById('presaleCountdown');
    if (!tracker) return;

    if (!presale || !presale.active) {
      tracker.style.display   = 'none';
      if (countdown) countdown.style.display = '';
      return;
    }

    // Hide countdown, show tracker
    if (countdown) countdown.style.display = 'none';
    tracker.style.display = 'block';

    var roundNum  = Math.max(1, Math.min(10, parseInt(presale.currentRound, 10) || 1));
    var roundData = PRESALE_ROUNDS[roundNum - 1];
    var raised    = parseFloat(presale.roundRaised) || 0;
    var target    = roundData.target;
    var pct       = target > 0 ? Math.min(100, (raised / target) * 100) : 0;
    var remaining = Math.max(0, (target - raised)) * roundData.price;

    function fmtUSDC(n) {
      if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
      if (n >= 1000)    return '$' + Math.round(n/1000) + 'K';
      return '$' + n.toLocaleString();
    }
    function fmtTokens(n) {
      if (n >= 1e9) return (n/1e9).toFixed(1) + 'B';
      if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
      return n.toLocaleString();
    }

    document.getElementById('trackerRoundBadge').textContent = 'ROUND ' + roundNum + ' OF 10';
    document.getElementById('trackerPrice').textContent      = roundData.price.toLocaleString();
    document.getElementById('trackerFill').style.width       = pct.toFixed(1) + '%';
    document.getElementById('trackerRaised').textContent     = fmtUSDC(raised) + ' raised';
    document.getElementById('trackerPct').textContent        = pct.toFixed(1) + '%';
    document.getElementById('trackerTarget').textContent     = 'of ' + fmtUSDC(target);
    document.getElementById('trackerRemaining').textContent  = fmtTokens(remaining) + ' $GUIDO remaining this round';

    // Tokenomics modal live block
    var modalLive = document.getElementById('modal-presale-live');
    if (modalLive) {
      modalLive.style.display = 'block';
      document.getElementById('modal-round-badge').textContent    = 'ROUND ' + roundNum + ' OF 10';
      document.getElementById('modal-presale-price').textContent  = roundData.price.toLocaleString();
      document.getElementById('modal-presale-raised').textContent = fmtUSDC(raised);
      document.getElementById('modal-presale-remaining').textContent = fmtTokens(remaining);
      document.getElementById('modal-presale-bar').style.width    = pct.toFixed(1) + '%';
    }

    // Highlight active round in the grid
    document.querySelectorAll('.round-item').forEach(function(el, i) {
      el.classList.toggle('round-item--active', i === roundNum - 1);
    });
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    originalLog('Captain Guido initialized');

    // Load config.json and apply
    fetch('config.json?v=' + Date.now())
      .then(function(r) { return r.json(); })
      .then(applyConfig)
      .catch(function() {});

    document.body.classList.add('entry-active');
    threeScene = createCosmicBackground();
    // If Three.js didn't load, reveal the HTML logo fallback
    if (!threeScene) {
      var htmlLogo = document.querySelector('.loader-logo-wrap');
      if (htmlLogo) htmlLogo.style.visibility = 'visible';
    }
    createOceanParticles();
    renderImpact();
    initDiveSection();
    initChapterCards();
    initPartnerCards();
    initializeMap();
    initNavigation();
    injectChapterPaths();
    initChapterLinks();
    updateChapterSonar();

    // Boot sequence fires the first time the map scrolls into view
    var mapSection = document.getElementById('hero-map');
    if (mapSection && window.IntersectionObserver) {
      var bootRan = false;
      var bootObserver = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting && !bootRan) {
            bootRan = true;
            bootObserver.disconnect();
            runMapBootSequence();
          }
        });
      }, { threshold: 0.15 });
      bootObserver.observe(mapSection);
    }
    initSmoothScroll();
    
    // Shuffle title then kick off auto-loader
    var shuffleTitle = document.getElementById('shuffleTitle');
    if (shuffleTitle) {
      shuffleText(shuffleTitle);
    }
    setTimeout(runLoader, 600);
    
    // Tokenomics modal
    const openTokenomicsBtn = document.getElementById('openTokenomics');
    if (openTokenomicsBtn) {
      openTokenomicsBtn.addEventListener('click', function() {
        openModal('tokenomics-modal');
      });
    }

    const footerTokenomics = document.getElementById('footerTokenomics');
    if (footerTokenomics) {
      footerTokenomics.addEventListener('click', function(e) {
        e.preventDefault();
        openModal('tokenomics-modal');
      });
    }
    
    // Whitepaper modal
    const openWhitepaperBtn = document.getElementById('openWhitepaper');
    if (openWhitepaperBtn) {
      openWhitepaperBtn.addEventListener('click', function() {
        openModal('whitepaper-modal');
      });
    }

    const footerWhitepaper = document.getElementById('footerWhitepaper');
    if (footerWhitepaper) {
      footerWhitepaper.addEventListener('click', function(e) {
        e.preventDefault();
        openModal('whitepaper-modal');
      });
    }
    
    // Wallet modal
    const walletConnectBtn = document.getElementById('walletConnectBtn');
    if (walletConnectBtn) {
      walletConnectBtn.addEventListener('click', function() {
        openModal('wallet-modal');
      });
    }
    
    // Close buttons
    document.querySelectorAll('.modal-close').forEach(function(btn) {
      btn.addEventListener('click', closeAllModals);
    });
    
    // Modal overlays
    document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
      overlay.addEventListener('click', closeAllModals);
    });
    
    // Wallet options
    document.querySelectorAll('.wallet-option').forEach(function(option) {
      option.addEventListener('click', function() {
        const walletType = this.getAttribute('data-wallet');
        if (walletType) {
          connectWallet(walletType);
        }
      });
    });

    // ESC key closes modals
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeAllModals();
      }
    });

    // Map stays permanently visible — no wash-away animation.

    // ── PRESALE COUNTDOWN ─────────────────────────────────────────────────
    // Target: July 1 2026 00:00:00 UTC
    var presaleTarget = new Date('2026-07-01T00:00:00Z').getTime();

    function updateCountdown() {
      var now  = Date.now();
      var diff = presaleTarget - now;

      if (diff <= 0) {
        // Presale is live — swap timer for launch message
        var cd = document.getElementById('presaleCountdown');
        if (cd) {
          cd.textContent = '';
          var liveMsg = document.createElement('p');
          liveMsg.className = 'countdown-label countdown-label--live';
          liveMsg.textContent = '🚀 PRESALE IS LIVE';
          cd.appendChild(liveMsg);
        }
        return;
      }

      var days  = Math.floor(diff / (1000 * 60 * 60 * 24));
      var hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      var mins  = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      var secs  = Math.floor((diff % (1000 * 60)) / 1000);

      var dEl = document.getElementById('cdDays');
      var hEl = document.getElementById('cdHours');
      var mEl = document.getElementById('cdMins');
      var sEl = document.getElementById('cdSecs');

      if (dEl) dEl.textContent = String(days).padStart(3, '0');
      if (hEl) hEl.textContent = String(hours).padStart(2, '0');
      if (mEl) mEl.textContent = String(mins).padStart(2, '0');
      if (sEl) sEl.textContent = String(secs).padStart(2, '0');
    }

    updateCountdown();
    setInterval(updateCountdown, 1000);
  });

  // ─── SCROLL REVEAL ────────────────────────────────────────────────────────
  function initScrollReveal() {
    if (!window.IntersectionObserver) return;

    // Generic reveal elements
    var revealEls = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-stagger');
    var revealObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach(function(el) { revealObserver.observe(el); });

    // Section-level in-view class (for section-lines, etc.)
    var sections = document.querySelectorAll('.content-section');
    var sectionObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          sectionObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    sections.forEach(function(s) { sectionObserver.observe(s); });

    // Tokenomics dist bars — animate when modal opens
    document.addEventListener('click', function(e) {
      if (e.target.closest('#openTokenomics') || e.target.closest('#footerTokenomics')) {
        setTimeout(function() {
          document.querySelectorAll('.dist-bar').forEach(function(bar) {
            bar.classList.add('visible');
          });
        }, 300);
      }
    });

    // Milestone items stagger
    var milestoneObserver = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var items = entry.target.querySelectorAll('.milestone-item');
          items.forEach(function(item, i) {
            setTimeout(function() { item.classList.add('visible'); }, i * 120);
          });
          milestoneObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    var milestoneList = document.querySelector('.milestone-list');
    if (milestoneList) milestoneObserver.observe(milestoneList);

    // Section headers
    document.querySelectorAll('.section-header').forEach(function(el) {
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });
      obs.observe(el);
    });
  }

  // ─── BIOLUMINESCENT PARTICLES ─────────────────────────────────────────────
  function createOceanParticles() {
    var container = document.getElementById('oceanParticles');
    if (!container) return;

    var colors = [
      'rgba(0, 212, 255, VAL)',
      'rgba(0, 255, 224, VAL)',
      'rgba(78, 196, 196, VAL)',
      'rgba(0, 180, 255, VAL)'
    ];

    for (var i = 0; i < 60; i++) {
      var particle = document.createElement('div');
      var size = Math.random() * 5 + 2;
      var colorTemplate = colors[Math.floor(Math.random() * colors.length)];
      var opacity = (Math.random() * 0.5 + 0.3).toFixed(2);
      var color = colorTemplate.replace('VAL', opacity);
      var driftX = (Math.random() * 60 - 30).toFixed(0) + 'px';
      var dur = (Math.random() * 10 + 6).toFixed(1) + 's';
      var delay = (Math.random() * 8).toFixed(1) + 's';

      particle.className = 'biolum-particle';
      particle.style.cssText = [
        'width:' + size + 'px',
        'height:' + size + 'px',
        'background:' + color,
        'color:' + color,
        'left:' + (Math.random() * 100).toFixed(1) + '%',
        'top:' + (Math.random() * 100).toFixed(1) + '%',
        '--drift-x:' + driftX,
        '--dur:' + dur,
        '--delay:' + delay
      ].join(';');

      container.appendChild(particle);
    }
  }

  // ─── ANIMATED COUNTER ─────────────────────────────────────────────────────
  function animateCounter(el, target, duration) {
    var start = 0;
    var startTime = null;
    var isFloat = String(target).includes('.');
    var decimals = isFloat ? String(target).split('.')[1].length : 0;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = start + (target - start) * eased;

      el.textContent = isFloat ? current.toFixed(decimals) : Math.floor(current).toLocaleString();

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = isFloat ? target.toFixed(decimals) : target.toLocaleString();
      }
    }
    requestAnimationFrame(step);
  }

  function initCounterAnimations() {
    var targets = document.querySelectorAll('.target-value, .stat-value, .live-stat-value');
    if (!window.IntersectionObserver) return;

    targets.forEach(function(el) {
      var raw = el.textContent.replace(/[^0-9.]/g, '');
      var num = parseFloat(raw);
      if (!raw || isNaN(num)) return;

      var observed = false;
      var obs = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting && !observed) {
            observed = true;
            el.classList.add('counting');
            animateCounter(el, num, 1600);
            obs.unobserve(el);
          }
        });
      }, { threshold: 0.5 });

      obs.observe(el);
    });
  }

  // ─── PATCH: wrap existing updateCountdown to add flip ─────────────────────
  // Store originals so the patch applies after DOMContentLoaded
  var _patchCountdownFlip = function() {
    var dEl = document.getElementById('cdDays');
    var hEl = document.getElementById('cdHours');
    var mEl = document.getElementById('cdMins');
    var sEl = document.getElementById('cdSecs');
    if (!dEl) return;

    // Only animate seconds — the rest update too infrequently to need it
    if (!sEl) return;
    var mo = new MutationObserver(function() {
      sEl.classList.remove('flip');
      void sEl.offsetWidth;
      sEl.classList.add('flip');
    });
    mo.observe(sEl, { childList: true, characterData: true, subtree: true });
  };

  // Initialize everything
  document.addEventListener('DOMContentLoaded', function() {
    initScrollReveal();
    initCounterAnimations();
    _patchCountdownFlip();
  });

})();
