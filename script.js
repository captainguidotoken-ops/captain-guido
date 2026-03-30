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
  
  // Entry Screen
  function enterSite() {
    const entryScreen = document.getElementById('entry-screen');
    if (!entryScreen) return;
    
    document.body.classList.remove('entry-active');
    entryScreen.classList.add('hidden');
    document.body.style.overflow = 'auto';
    
    setTimeout(function() {
      entryScreen.style.display = 'none';
    }, 350);
  }

  // Create ocean particles
  function createOceanParticles() {
    const container = document.getElementById('oceanParticles');
    if (!container) return;

    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.width = Math.random() * 4 + 2 + 'px';
      particle.style.height = particle.style.width;
      particle.style.background = 'rgba(78, 196, 196, ' + (Math.random() * 0.5 + 0.2) + ')';
      particle.style.borderRadius = '50%';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.animation = 'float ' + (Math.random() * 10 + 5) + 's ease-in-out infinite';
      container.appendChild(particle);
    }
  }

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

    var chapters = [
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
      var statusText  = chapter.unlocked ? '✓ UNLOCKED' : '🔒 LOCKED';
      popup.innerHTML =
        '<strong style="color:#f4a836;font-size:0.8rem;letter-spacing:2px;display:block;margin-bottom:0.4rem;">CHAPTER ' + String(chapter.num).padStart(2,'0') + '</strong>' +
        '<span style="font-size:1.1rem;font-weight:bold;display:block;margin-bottom:0.6rem;">' + chapter.name + '</span>' +
        '<span style="font-size:0.75rem;color:' + statusColor + ';font-weight:700;letter-spacing:1px;padding:0.3rem 0.7rem;border-radius:10px;background:' + statusBg + ';border:1px solid ' + statusBdr + ';display:inline-block;">' + statusText + '</span>';
      popup.style.left  = x + 'px';
      popup.style.top   = y + 'px';
      popup.style.display = 'block';
    }

    function hidePopup() { popup.style.display = 'none'; }

    document.addEventListener('click', function(e) {
      if (!e.target.closest('#map')) hidePopup();
    });

    // ── Globe ────────────────────────────────────────────────────────────────
    var globe = Globe()
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

    mapEl.addEventListener('pointerdown', function() {
      controls.autoRotate = false;
    }, { once: true });

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
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
  }

  function closeAllModals() {
    document.querySelectorAll('.modal, .info-modal').forEach(function(modal) {
      modal.classList.remove('active');
    });
    document.body.style.overflow = 'auto';
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

  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    originalLog('Captain Guido initialized');

    document.body.classList.add('entry-active');
    createOceanParticles();
    renderImpact();
    initializeMap();
    initNavigation();

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
    
    // Shuffle animation
    const shuffleTitle = document.getElementById('shuffleTitle');
    if (shuffleTitle) {
      setTimeout(function() {
        shuffleText(shuffleTitle);
      }, 500);
    }
    
    // Entry button
    const enterButton = document.getElementById('enterButton');
    if (enterButton) {
      enterButton.addEventListener('click', enterSite);
    }
    
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

})();

console.log('Captain Guido Coin - Website Loaded');
