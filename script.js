(function() {
  'use strict';

  // Security: Prevent console manipulation
  const originalLog = console.log;
  const originalError = console.error;
  
  // Entry Screen
  function enterSite() {
    const entryScreen = document.getElementById('entry-screen');
    if (!entryScreen) return;
    
    document.body.classList.remove('entry-active');
    entryScreen.classList.add('hidden');
    document.body.style.overflow = 'auto';
    
    setTimeout(function() {
      entryScreen.style.display = 'none';
    }, 1000);
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

  // NEW: Animate map tiles with randomized flip effect
  function animateMapTiles() {
    // Wait for map tiles to load
    setTimeout(function() {
      const tiles = document.querySelectorAll('.leaflet-tile');
      
      if (tiles.length === 0) {
        // If tiles haven't loaded yet, try again
        animateMapTiles();
        return;
      }

      // Create array of tiles and shuffle it for random order
      const tilesArray = Array.from(tiles);
      
      // Fisher-Yates shuffle for true randomization
      for (let i = tilesArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tilesArray[i], tilesArray[j]] = [tilesArray[j], tilesArray[i]];
      }

      // Animate each tile with a slight delay
      tilesArray.forEach(function(tile, index) {
        const delay = index * 15; // 15ms between each tile
        
        tile.style.opacity = '0';
        tile.style.transform = 'rotateY(90deg) scale(0.8)';
        tile.style.transformOrigin = 'center';
        tile.style.transition = 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
        
        setTimeout(function() {
          tile.style.opacity = '1';
          tile.style.transform = 'rotateY(0deg) scale(1)';
        }, delay);
      });
    }, 100);
  }

  // Map Setup
  function initializeMap() {
    if (typeof L === 'undefined') {
      originalError('Leaflet not loaded');
      return;
    }

    const map = L.map("map", {
      worldCopyJump: false,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
      tap: false,
      zoomSnap: 0,
      zoomDelta: 0,
      trackResize: true
    }).setView([20, 0], 2.5);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
      { attribution: "", maxZoom: 10 }
    ).addTo(map);

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "", maxZoom: 10, opacity: 0.6 }
    ).addTo(map);

    // NEW: Trigger tile animation when tiles finish loading
    map.on('load', function() {
      animateMapTiles();
    });

    // Also trigger after a short delay in case 'load' event already fired
    setTimeout(function() {
      animateMapTiles();
    }, 500);

    const shipIcon = L.divIcon({
      className: "ship",
      html: "🚢",
      iconSize: [32, 32]
    });

    const chapters = [
      { name: "Port of Ostia", coords: [41.73, 12.29], unlocked: true },
      { name: "Signals in Cairo", coords: [30.0444, 31.2357], unlocked: true },
      { name: "Arabian Tides", coords: [20, 60], unlocked: false },
      { name: "Indian Abyss", coords: [-10, 80], unlocked: false },
      { name: "Philippine Sea", coords: [15, 130], unlocked: false },
      { name: "South Pacific", coords: [-21.694129, -147.915508], unlocked: false },
      { name: "North Pacific", coords: [40, -150], unlocked: false },
      { name: "Bering Sea", coords: [58, -175], unlocked: false },
      { name: "North Atlantic", coords: [45, -30], unlocked: false },
      { name: "Gulf of America", coords: [25, -90], unlocked: false },
      { name: "South Atlantic", coords: [-20, -30], unlocked: false },
      { name: "Return to Ostia", coords: [41.73, 12.29], unlocked: false }
    ];

    const oceanRoutes = [
      [[41.73, 12.29], [40.5, 14], [37, 18], [35, 23], [33, 28], [30.0444, 31.2357]],
      [[30.0444, 31.2357], [29, 33], [25, 36], [20, 40], [18, 50], [20, 60]],
      [[20, 60], [15, 65], [10, 70], [0, 75], [-10, 80]],
      [[-10, 80], [-8, 90], [-5, 100], [0, 110], [5, 120], [10, 125], [15, 130]],
      [[15, 130], [10, 140], [5, 150], [0, 160], [-5, 165], [-10, 170], [-15, 175], [-18, -175], [-21.694129, -147.915508]],
      [[-21.694129, -147.915508], [-15, -155], [-10, -160], [0, -165], [10, -165], [20, -162], [30, -158], [40, -150]],
      [[40, -150], [45, -155], [50, -165], [55, -172], [58, -175]],
      [[58, -175], [62, -170], [65, -160], [68, -145], [70, -120], [68, -95], [65, -75], [60, -60], [55, -50], [50, -40], [45, -30]],
      [[45, -30], [40, -35], [35, -45], [30, -60], [27, -75], [25, -82], [25, -90]],
      [[25, -90], [22, -85], [18, -75], [12, -65], [5, -50], [0, -45], [-10, -38], [-20, -30]],
      [[-20, -30], [-15, -20], [-10, -10], [0, 0], [10, 5], [20, 8], [30, 10], [36, 10], [39, 11], [41.73, 12.29]]
    ];

    const route = oceanRoutes.flat();

    // Add chapter markers
    chapters.forEach(function(chapter, index) {
      const marker = L.circleMarker(chapter.coords, {
        radius: chapter.unlocked ? 12 : 8,
        fillColor: chapter.unlocked ? "#f4a836" : "#666",
        color: chapter.unlocked ? "#fff" : "#444",
        weight: 2,
        opacity: 1,
        fillOpacity: chapter.unlocked ? 0.9 : 0.5
      }).addTo(map);

      const tempDiv = document.createElement('div');
      tempDiv.textContent = chapter.name;
      const safeName = tempDiv.innerHTML;

      marker.bindPopup(
        '<div style="text-align:center;padding:1rem;background:linear-gradient(135deg,#0a2540 0%,#1e5f8c 100%);border:2px solid #f4a836;color:#e8d4b8;min-width:220px;border-radius:8px;">' +
        '<strong style="color:#f4a836;font-size:0.85rem;letter-spacing:2px;display:block;margin-bottom:0.5rem;">CHAPTER ' + String(index + 1).padStart(2, '0') + '</strong>' +
        '<span style="color:#e8d4b8;font-size:1.2rem;font-weight:bold;display:block;margin-bottom:0.8rem;">' + safeName + '</span>' +
        '<span style="font-size:0.8rem;color:' + (chapter.unlocked ? '#4ec4c4' : '#999') + ';font-weight:700;letter-spacing:1px;padding:0.4rem 0.8rem;border-radius:12px;background:' + (chapter.unlocked ? 'rgba(78,196,196,0.2)' : 'rgba(100,100,100,0.2)') + ';border:1px solid ' + (chapter.unlocked ? '#4ec4c4' : '#666') + ';display:inline-block;">' +
        (chapter.unlocked ? '✓ UNLOCKED' : '🔒 LOCKED') +
        '</span></div>',
        { closeButton: false, className: 'custom-popup' }
      );
    });

    // Animate ship
    const ship = L.marker(route[0], { icon: shipIcon }).addTo(map);

    let currentSegment = 0;
    let progress = 0;
    const speed = 0.0003;

    function animateShip() {
      const start = route[currentSegment];
      const end = route[currentSegment + 1];

      if (!end) {
        currentSegment = 0;
        progress = 0;
        requestAnimationFrame(animateShip);
        return;
      }

      const lat = start[0] + (end[0] - start[0]) * progress;
      const lng = start[1] + (end[1] - start[1]) * progress;

      ship.setLatLng([lat, lng]);

      progress += speed;

      if (progress >= 1) {
        progress = 0;
        currentSegment++;
      }

      requestAnimationFrame(animateShip);
    }

    animateShip();
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

  // Initialize
  document.addEventListener('DOMContentLoaded', function() {
    originalLog('Captain Guido initialized');
    
    document.body.classList.add('entry-active');
    createOceanParticles();
    initializeMap();
    initNavigation();
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
  });

})();

console.log('Captain Guido Coin - Website Loaded');
