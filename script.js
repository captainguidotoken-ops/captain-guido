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

  // ─── MASTER rAF COORDINATOR ──────────────────────────────────────────────
  // One requestAnimationFrame loop drives every Three.js scene on the page.
  // Each scene registers a tick function and an `active` flag. The coordinator
  // walks the registry every frame and invokes only the active ticks.
  // Scenes call `setActive(false)` from an IntersectionObserver when they're
  // off-screen, so we never burn CPU on hidden canvases.
  // Why this matters: previously every scene called requestAnimationFrame
  // independently, scheduling 3+ separate frames per browser tick. Browsers
  // *do* coalesce them, but each callback does its own scroll math + GPU
  // command flush. Consolidating gives the GPU a single command list and
  // shares one frame budget.
  var _cgRAF = (function() {
    var ticks    = [];
    var running  = false;
    function loop(t) {
      if (!running) return;
      requestAnimationFrame(loop);
      // Index-based iteration so register/unregister mid-frame doesn't break.
      for (var i = 0; i < ticks.length; i++) {
        var entry = ticks[i];
        if (entry && entry.active && entry.fn) {
          try { entry.fn(t); } catch (e) { /* never let one scene kill the loop */ }
        }
      }
    }
    return {
      register: function(fn, opts) {
        var entry = { fn: fn, active: !!(opts && opts.startActive) };
        ticks.push(entry);
        if (!running) { running = true; requestAnimationFrame(loop); }
        return {
          setActive: function(v) { entry.active = !!v; },
          isActive:  function()  { return entry.active; },
          unregister: function() {
            var idx = ticks.indexOf(entry);
            if (idx >= 0) ticks.splice(idx, 1);
          },
        };
      },
      // Public for diagnostics
      _ticks: function() { return ticks.length; },
    };
  })();
  window._cgRAF = _cgRAF; // expose for ad-hoc debug from devtools

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

    // Renderer
    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x01060d, 1);
    var canvas = renderer.domElement;
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;';
    var entryEl = document.getElementById('entry-screen');
    if (!entryEl) { renderer.dispose(); return null; }
    entryEl.insertBefore(canvas, entryEl.firstChild);

    // Scene & Camera
    var scene  = new THREE.Scene();
    scene.fog  = new THREE.FogExp2(0x01060d, 0.025);
    var camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500);
    camera.position.set(0, 3, 18);
    camera.lookAt(0, 0.5, 0);

    // Lights
    scene.add(new THREE.AmbientLight(0x1a2a3a, 2.2));
    // Soft neutral fill — no warm spotlight flash
    var keyLight = new THREE.DirectionalLight(0xddeeff, 1.2);
    keyLight.position.set(2, 5, 14);
    scene.add(keyLight);
    var aquaLight = new THREE.PointLight(0x00c8ff, 1.4, 45);
    aquaLight.position.set(-5, 6, 6);
    scene.add(aquaLight);
    var rimLight = new THREE.PointLight(0x00ffe0, 1.0, 35);
    rimLight.position.set(7, 1, -6);
    scene.add(rimLight);

    // Stars — full-height 2D canvas overlay with gradient fade at bottom
    // so stars dissolve seamlessly into the wave horizon, no hard line.
    var starCanvas = document.createElement('canvas');
    starCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none;';
    entryEl.insertBefore(starCanvas, entryEl.firstChild);

    function drawStars() {
      starCanvas.width  = window.innerWidth;
      starCanvas.height = window.innerHeight;
      var sc = starCanvas.getContext('2d');
      sc.clearRect(0, 0, starCanvas.width, starCanvas.height);

      var sw = starCanvas.width;
      var sh = starCanvas.height;

      // Tier 1 — many tiny background stars, cool blue-white, very dim
      for (var i = 0; i < 900; i++) {
        var x = Math.random() * sw;
        var y = Math.random() * sh;
        var r = Math.random() * 0.5 + 0.15;
        var a = Math.random() * 0.35 + 0.15;
        sc.beginPath();
        sc.arc(x, y, r, 0, Math.PI * 2);
        sc.fillStyle = 'rgba(180,210,255,' + a + ')';
        sc.fill();
      }

      // Tier 2 — medium stars, slightly brighter
      for (var j = 0; j < 200; j++) {
        var x2 = Math.random() * sw;
        var y2 = Math.random() * sh;
        var r2 = Math.random() * 0.7 + 0.4;
        var a2 = Math.random() * 0.3 + 0.45;
        sc.beginPath();
        sc.arc(x2, y2, r2, 0, Math.PI * 2);
        sc.fillStyle = 'rgba(210,230,255,' + a2 + ')';
        sc.fill();
      }

      // Tier 3 — a handful of bright stars with a tight pinpoint glow
      for (var k = 0; k < 35; k++) {
        var x3 = Math.random() * sw;
        var y3 = Math.random() * sh;
        var r3 = Math.random() * 1.0 + 0.8;
        var glow = sc.createRadialGradient(x3, y3, 0, x3, y3, r3 * 2.2);
        glow.addColorStop(0,   'rgba(220,240,255,0.6)');
        glow.addColorStop(0.5, 'rgba(180,215,255,0.12)');
        glow.addColorStop(1,   'rgba(180,215,255,0)');
        sc.beginPath();
        sc.arc(x3, y3, r3 * 2.2, 0, Math.PI * 2);
        sc.fillStyle = glow;
        sc.fill();
        // Bright core
        sc.beginPath();
        sc.arc(x3, y3, r3, 0, Math.PI * 2);
        sc.fillStyle = 'rgba(240,248,255,0.98)';
        sc.fill();
      }

      // Gradient mask — dissolve stars into wave horizon, no hard line
      var mask = sc.createLinearGradient(0, 0, 0, sh);
      mask.addColorStop(0,    'rgba(0,0,0,0)');
      mask.addColorStop(0.52, 'rgba(0,0,0,0)');
      mask.addColorStop(0.75, 'rgba(0,0,0,1)');
      mask.addColorStop(1,    'rgba(0,0,0,1)');
      sc.globalCompositeOperation = 'destination-out';
      sc.fillStyle = mask;
      sc.fillRect(0, 0, sw, sh);
      sc.globalCompositeOperation = 'source-over';
    }
    drawStars();

    window.addEventListener('resize', drawStars);

    // Ocean waves — horizontal planes (rotation.x=-PI/2), animate local Z for real height variation
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
    var wave1 = makeWavePlane(0x0b2d6e, 0.55, -2.5, -10,  0);
    var wave2 = makeWavePlane(0x061840, 0.38, -4.5, -20, 1.8);

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
    var camTgtZ    = 18;
    var camTgtY    = 3;
    var burstMult  = 1;   // multiplied onto aqua light during burst flash

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

      // Light pulse — burstMult spikes to 5× during the burst flash
      aquaLight.intensity = (2.8 + Math.sin(t * 1.8) * 0.7) * burstMult;

      // Smooth camera ease toward target
      camera.position.z += (camTgtZ - camera.position.z) * 0.05;
      camera.position.y += (camTgtY - camera.position.y) * 0.05;
      camera.lookAt(0, 0.5, 0);

      renderer.render(scene, camera);
    }

    animLoop();

    return {
      setProgress: function(pct) {
        // Camera descends throughout loading so it's already in motion at 100%
        camTgtZ = 18 - (pct / 100) * 14.5;
        camTgtY = 3  - (pct / 100) * 3.5;
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
        // Gentle forward push on the Three.js camera during the canvas fade
        camTgtZ = 1;
        camTgtY = -1.5;
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

    // Passive listener so it never blocks the scroll thread
    window.addEventListener('scroll', function() {
      if (window.pageYOffset > 100) nav.classList.add('scrolled');
      else                          nav.classList.remove('scrolled');
    }, { passive: true });
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

  // ── Ocean zone — one continuous underwater scene spanning site-links,
  // the empty hero stage, and the impact body. Canvas is sticky inside
  // .ocean-stage; scroll progress is measured against .ocean-zone bounds.
  function initImpactHero() {
    var zone   = document.querySelector('.ocean-zone');
    var canvas = document.getElementById('impact-hero-canvas');
    if (!zone || !canvas || typeof THREE === 'undefined') return;

    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { zone.classList.add('no-motion'); return; }

    var isMobile = window.innerWidth < 768;
    var W = window.innerWidth;
    var H = window.innerHeight;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: !isMobile, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.5));
    renderer.setClearColor(0x000306, 1);

    var scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000306, 0.045);

    // Camera starts already submerged at eye-level with the logo, looking
    // straight at it — the user wanted the coin underwater from frame 1.
    var fov = isMobile ? 78 : 58;
    var camera = new THREE.PerspectiveCamera(fov, W / H, 0.1, 200);
    camera.position.set(0, 0, isMobile ? 7 : 6);
    camera.lookAt(0, 0, 0);

    // Underwater lighting — soft cool ambient, surface key from above (light
    // filtering through water), deep fill from below (silt-darkness).
    scene.add(new THREE.AmbientLight(0x0a2238, 2.4));
    var moon = new THREE.DirectionalLight(0x60a8d4, 0.8);
    moon.position.set(0, 14, 6);
    scene.add(moon);
    var aqua = new THREE.PointLight(0x00c8ff, 1.4, 30);
    aqua.position.set(-3, 1, 5);
    scene.add(aqua);
    var deep = new THREE.PointLight(0x0a3a5a, 0.7, 30);
    deep.position.set(0, -8, 0);
    scene.add(deep);

    // Logo texture — new round captain-character asset
    var loader = new THREE.TextureLoader();
    var logoTex = loader.load('captain-character.png');
    logoTex.minFilter = THREE.LinearFilter;
    logoTex.magFilter = THREE.LinearFilter;

    var logoSize = isMobile ? 1.9 : 2.6;

    // Submerged logo — single plane with circular alpha clip + subtle uniform
    // underwater shimmer (sin-noise UV displacement, blue tint). Right-side up
    // because we're below the surface looking AT the coin, not at a reflection.
    var logoMat = new THREE.ShaderMaterial({
      uniforms: {
        uTex:     { value: logoTex },
        uTime:    { value: 0 },
        uOpacity: { value: 1.0 },          // driven by scroll-fade in the tick
      },
      vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '  vUv = uv;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        'uniform sampler2D uTex;',
        'uniform float uTime;',
        'uniform float uOpacity;',
        'varying vec2 vUv;',
        'void main() {',
        // Circular clip + smoothstep edge feather
        '  float d = distance(vUv, vec2(0.5));',
        '  if (d > 0.5) discard;',
        '  float edge = smoothstep(0.5, 0.485, d);',
        // Subtle underwater UV shimmer — uniform, no depth dependence
        '  vec2 uv = vUv;',
        '  uv.x += sin(uv.y * 22.0 - uTime * 1.4) * 0.008;',
        '  uv.x += sin(uv.y * 10.0 + uTime * 0.7) * 0.005;',
        '  uv.y += sin(uv.x * 18.0 + uTime * 1.1) * 0.005;',
        '  vec4 col = texture2D(uTex, uv);',
        '  col.a *= edge * uOpacity;',
        // Cool blue/green underwater tint at constant strength
        '  col.rgb = mix(col.rgb, vec3(0.18, 0.55, 0.78), 0.22);',
        '  gl_FragColor = col;',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    var logo = new THREE.Mesh(new THREE.PlaneGeometry(logoSize, logoSize, 1, 1), logoMat);
    logo.position.set(0, 0, 0);
    scene.add(logo);

    // Dense bioluminescent bubble cloud — green/orange majority with white,
    // blue and pink sparkles for variety, sized variably so the eye reads
    // depth (small far ones, occasional big near ones).
    var bubbleCount = isMobile ? 130 : 320;
    var bubblePos   = new Float32Array(bubbleCount * 3);
    var bubbleCol   = new Float32Array(bubbleCount * 3);
    var bubbleSize  = new Float32Array(bubbleCount);
    var bubbleData  = [];
    var palette = [
      new THREE.Color(0x44ff8c),  // green
      new THREE.Color(0x44ff8c),  // (weight)
      new THREE.Color(0xff8a2c),  // orange
      new THREE.Color(0xff8a2c),  // (weight)
      new THREE.Color(0xffffff),  // white sparkle
      new THREE.Color(0x80d4ff),  // light blue
      new THREE.Color(0xff8ad0),  // pink
      new THREE.Color(0xfff0a0),  // warm yellow
    ];

    for (var bi = 0; bi < bubbleCount; bi++) {
      var baseX = (Math.random() - 0.5) * 16;
      var baseZ = -1 - Math.random() * 11;
      bubbleData.push({
        baseX: baseX,
        baseZ: baseZ,
        phase: Math.random() * Math.PI * 2,
        speed: 0.012 + Math.random() * 0.030,
        sway:  Math.random() * Math.PI * 2,
      });
      bubblePos[bi * 3]     = baseX;
      bubblePos[bi * 3 + 1] = -7 + Math.random() * 14;
      bubblePos[bi * 3 + 2] = baseZ;

      var c = palette[Math.floor(Math.random() * palette.length)];
      var shade = 0.6 + Math.random() * 0.4;
      bubbleCol[bi * 3]     = c.r * shade;
      bubbleCol[bi * 3 + 1] = c.g * shade;
      bubbleCol[bi * 3 + 2] = c.b * shade;

      // 80% small dust motes, 20% bigger bubbles — gives the depth feel of
      // the reference image where most particles are pinprick-small but a
      // handful pop forward.
      bubbleSize[bi] = Math.random() < 0.2
        ? 1.4 + Math.random() * 1.0     // bigger pop bubbles
        : 0.30 + Math.random() * 0.50;  // small motes
    }

    var bubbleGeo = new THREE.BufferGeometry();
    bubbleGeo.setAttribute('position', new THREE.BufferAttribute(bubblePos, 3));
    bubbleGeo.setAttribute('color',    new THREE.BufferAttribute(bubbleCol, 3));
    bubbleGeo.setAttribute('aSize',    new THREE.BufferAttribute(bubbleSize, 1));

    var bubbleMat = new THREE.ShaderMaterial({
      uniforms: {
        uPxRatio: { value: renderer.getPixelRatio() },
        uTime:    { value: 0 },
      },
      vertexShader: [
        'attribute vec3 color;',
        'attribute float aSize;',
        'varying vec3 vColor;',
        'varying float vSize;',
        'uniform float uPxRatio;',
        'uniform float uTime;',
        'void main() {',
        '  vColor = color;',
        '  vSize  = aSize;',
        '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
        '  gl_Position = projectionMatrix * mvPosition;',
        // size attribute scales the base point size; gentle pulse via time
        '  float pulse = 0.85 + 0.15 * sin(uTime * 2.0 + position.y * 0.3);',
        '  gl_PointSize = aSize * pulse * (32.0 / -mvPosition.z) * uPxRatio * 6.0;',
        '}'
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vColor;',
        'varying float vSize;',
        'void main() {',
        '  vec2 c = gl_PointCoord - vec2(0.5);',
        '  float d = length(c);',
        '  if (d > 0.5) discard;',
        // Bright tight core + soft halo — reads as a glowing orb in water
        '  float core = pow(1.0 - d * 2.0, 1.6);',
        '  float halo = pow(1.0 - d * 2.0, 0.6) * 0.35;',
        '  vec3 col = vColor + halo * 0.4;',
        '  gl_FragColor = vec4(col, core);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    var bubbles = new THREE.Points(bubbleGeo, bubbleMat);
    scene.add(bubbles);

    // ── Jellyfish — translucent dome with 8 swaying tentacles ──────────────
    // Bell is the upper hemisphere of a sphere with a soft phong material;
    // tentacles are individual THREE.Line objects whose vertices we re-write
    // each frame for a sin-wave wobble. Whole jelly drifts vertically a bit
    // and pulses (bell scale.y) like real ones do.
    var jellyGroup = new THREE.Group();
    jellyGroup.position.set(isMobile ? -3.5 : -5.5, -1.0, -2.5);
    scene.add(jellyGroup);

    var bellGeo = new THREE.SphereGeometry(1.1, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.6);
    var bellMat = new THREE.MeshPhongMaterial({
      color:        0x6a8fb5,
      transparent:  true,
      opacity:      0.42,
      side:         THREE.DoubleSide,
      shininess:    100,
      specular:     new THREE.Color(0x80c4ff),
      emissive:     new THREE.Color(0x182a40),
      depthWrite:   false,
    });
    var jellyBell = new THREE.Mesh(bellGeo, bellMat);
    jellyGroup.add(jellyBell);

    // Inner glow disc inside the bell — gives it that lit-up look
    var innerGlowGeo = new THREE.CircleGeometry(0.85, 24);
    var innerGlowMat = new THREE.MeshBasicMaterial({
      color: 0x8ab8e0,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    var innerGlow = new THREE.Mesh(innerGlowGeo, innerGlowMat);
    innerGlow.rotation.x = Math.PI / 2;
    innerGlow.position.y = 0.05;
    jellyGroup.add(innerGlow);

    var jellyTentacles = [];
    var TENTACLE_COUNT  = 8;
    var TENTACLE_SEGS   = 24;
    var TENTACLE_LEN    = 3.4;
    for (var ti = 0; ti < TENTACLE_COUNT; ti++) {
      var ang = (ti / TENTACLE_COUNT) * Math.PI * 2;
      var pts = [];
      for (var pi = 0; pi <= TENTACLE_SEGS; pi++) {
        var tt = pi / TENTACLE_SEGS;
        pts.push(new THREE.Vector3(Math.cos(ang) * 0.95, -tt * TENTACLE_LEN, Math.sin(ang) * 0.95));
      }
      var tGeo = new THREE.BufferGeometry().setFromPoints(pts);
      var tMat = new THREE.LineBasicMaterial({
        color: 0x80b8e0,
        transparent: true,
        opacity: 0.32,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      var line = new THREE.Line(tGeo, tMat);
      jellyGroup.add(line);
      jellyTentacles.push({
        pos:    tGeo.attributes.position,
        ang:    ang,
        phase:  ti * 0.7,
        baseX:  Math.cos(ang) * 0.95,
        baseZ:  Math.sin(ang) * 0.95,
      });
    }

    // Scroll progress is now measured against the WHOLE ocean-zone (site-links
    // + hero stage + impact body). The coin gets centre-stage during the first
    // ~55% of the scroll and then sinks + fades so the impact body content
    // (ON-CHAIN DATA, partners, milestones) reads cleanly without the disc
    // competing for attention.
    var clock    = new THREE.Clock();
    var camTgtY  = 0;
    var lookTgtY = 0;
    var coinFade = 1.0;            // smoothed alpha multiplier driven by scroll

    function onHeroScroll() {
      var rect = zone.getBoundingClientRect();
      var h    = zone.offsetHeight - H;
      var p    = h > 0 ? Math.max(0, Math.min(1, -rect.top / h)) : 0;

      camTgtY  = -p * 2.5;
      lookTgtY = -p * 0.5;
      scene.fog.density = 0.05 + p * 0.025;

      // Coin fade — full opacity until p=0.55, gone by p=0.78
      var target = 1.0 - Math.max(0, Math.min(1, (p - 0.55) / 0.23));
      coinFade += (target - coinFade) * 0.1;
    }

    function tick() {
      var t = clock.getElapsedTime();
      onHeroScroll();

      // Bubbles: rise straight up at per-particle speed, sway sinusoidally on
      // X/Z so they don't track in straight lines, wrap from top back to bottom.
      var bp = bubbleGeo.attributes.position.array;
      for (var bi = 0; bi < bubbleData.length; bi++) {
        var b = bubbleData[bi];
        bp[bi * 3 + 1] += b.speed;
        if (bp[bi * 3 + 1] > 7) bp[bi * 3 + 1] = -7;
        bp[bi * 3]     = b.baseX + Math.sin(t * 1.1 + b.sway + bp[bi * 3 + 1] * 0.35) * 0.35;
        bp[bi * 3 + 2] = b.baseZ + Math.sin(t * 0.7 + b.phase) * 0.20;
      }
      bubbleGeo.attributes.position.needsUpdate = true;
      bubbleMat.uniforms.uTime.value = t;

      // Jellyfish — bell pulses on Y scale, whole group drifts, tentacles wave
      var pulse = 0.94 + Math.sin(t * 1.6) * 0.07;
      jellyBell.scale.set(pulse, pulse * 0.85, pulse);
      innerGlow.material.opacity = 0.16 + Math.abs(Math.sin(t * 1.6)) * 0.12;
      jellyGroup.position.y = -1.0 + Math.sin(t * 0.45) * 0.35;
      jellyGroup.position.x = (isMobile ? -3.5 : -5.5) + Math.sin(t * 0.3) * 0.4;
      // Tentacle sway: each segment displaces more the further down it is so
      // the tentacle bends gracefully like it's catching a slow current
      for (var jt = 0; jt < jellyTentacles.length; jt++) {
        var tent = jellyTentacles[jt];
        var tpa  = tent.pos.array;
        for (var pi = 0; pi <= TENTACLE_SEGS; pi++) {
          var ii = pi * 3;
          var tt = pi / TENTACLE_SEGS;
          var sway = Math.sin(tt * 4.5 + t * 1.4 + tent.phase) * (tt * 0.55);
          tpa[ii]     = tent.baseX + sway * 0.7;
          tpa[ii + 1] = -tt * TENTACLE_LEN + Math.sin(t * 1.6 + tent.phase) * 0.04;
          tpa[ii + 2] = tent.baseZ + sway * 0.5;
        }
        tent.pos.needsUpdate = true;
      }

      logoMat.uniforms.uTime.value    = t;
      logoMat.uniforms.uOpacity.value = coinFade;

      // Coin-floating-underwater feel + scroll-driven sink. The coin spins
      // lazily, tilts, bobs, and its world-Y descends as coinFade approaches 0
      // so it disappears into the depth as the user reaches the impact body.
      logo.rotation.y = Math.sin(t * 0.35) * 0.45;
      logo.rotation.x = Math.sin(t * 0.5)  * 0.06;
      logo.position.y = Math.sin(t * 0.6)  * 0.08 - (1.0 - coinFade) * 4.0;
      logo.visible    = coinFade > 0.01;

      camera.position.y += (camTgtY - camera.position.y) * 0.05;
      camera.lookAt(0, lookTgtY, 0);
      aqua.intensity = 1.4 + Math.sin(t * 1.4) * 0.4;

      renderer.render(scene, camera);
    }

    var handle = _cgRAF.register(tick);
    var io = new IntersectionObserver(function(entries) {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (e.isIntersecting && !handle.isActive()) clock.start();
        handle.setActive(e.isIntersecting);
      }
    }, { threshold: 0 });
    io.observe(zone);

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
    initImpactHero();
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
