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
        setTimeout(function() {
          document.body.classList.remove('entry-active');
          entryScreen.style.display = 'none';
          threeScene.stop();
        }, 350);
      });
    } else {
      entryScreen.classList.add('zoom-exit');
      document.body.style.overflow = 'auto';
      setTimeout(function() {
        document.body.classList.remove('entry-active');
        entryScreen.style.display = 'none';
      }, 700);
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
          threeScene.startLanding(function() { playTextExit(enterSite); });
        } else {
          playTextExit(enterSite);
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

    // Stars — sparse, quiet
    var starPos = new Float32Array(700 * 3);
    for (var si = 0; si < starPos.length; si++) starPos[si] = (Math.random() - 0.5) * 400;
    var starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo,
      new THREE.PointsMaterial({ color: 0x88bbdd, size: 0.18, transparent: true, opacity: 0.4 })
    ));

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
    var wave1 = makeWavePlane(0x00d4ff, 0.28, -2.5, -10,  0);
    var wave2 = makeWavePlane(0x00ffe0, 0.15, -4.5, -20, 1.8);

    // Resize
    window.addEventListener('resize', function() {
      W = window.innerWidth; H = window.innerHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });

    // Animation state
    var clock   = new THREE.Clock();
    var running = true;
    var rafId;
    var camTgtZ = 18;
    var camTgtY = 3;

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

      // Light pulse
      aquaLight.intensity = 2.8 + Math.sin(t * 1.8) * 0.7;

      // Smooth camera ease toward target
      camera.position.z += (camTgtZ - camera.position.z) * 0.05;
      camera.position.y += (camTgtY - camera.position.y) * 0.05;
      camera.lookAt(0, 0.5, 0);

      renderer.render(scene, camera);
    }

    animLoop();

    return {
      setProgress: function(pct) {
        camTgtZ = 18 - (pct / 100) * 13.5;
        camTgtY = 3  - (pct / 100) * 2.5;
      },
      startLanding: function(cb) {
        if (cb) cb();
      },
      burst: function(onComplete) {
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
    createOceanParticles();
    renderImpact();
    initializeMap();
    initNavigation();
    injectChapterPaths();
    initChapterLinks();

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

  // ─── COUNTDOWN FLIP ANIMATION ─────────────────────────────────────────────
  var prevCountdownVals = {};

  function triggerFlip(elId, newVal) {
    var el = document.getElementById(elId);
    if (!el) return;
    if (prevCountdownVals[elId] !== newVal) {
      prevCountdownVals[elId] = newVal;
      el.classList.remove('flip');
      // Force reflow so the animation restarts
      void el.offsetWidth;
      el.classList.add('flip');
    }
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

console.log('Captain Guido Coin - Website Loaded');
