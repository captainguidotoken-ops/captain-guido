/**
 * Captain Guido Coin — Awwwards-grade animation layer
 * Totem-crypto floating depth + Acunmedya cursor/text-reveal style
 */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── 1. MAGNETIC BUTTONS ───────────────────────────────────────────────────
  function initMagnetic() {
    if (prefersReducedMotion || 'ontouchstart' in window) return;

    document.querySelectorAll('[data-magnetic], .btn-primary, .btn-secondary, .enter-btn, .wallet-connect-btn').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var rect = el.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top  + rect.height / 2;
        var dx = (e.clientX - cx) * 0.25;
        var dy = (e.clientY - cy) * 0.25;
        el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      });

      el.addEventListener('mouseleave', function () {
        el.style.transform = '';
      });
    });
  }

  // ─── 3. TEXT REVEAL (WORD-BY-WORD) ────────────────────────────────────────
  function splitWords(el) {
    var text = el.textContent.trim();
    el.textContent = '';
    el.setAttribute('aria-label', text);
    text.split(' ').forEach(function (word, i) {
      var wrapper = document.createElement('span');
      wrapper.className = 'word-outer';
      wrapper.setAttribute('aria-hidden', 'true');

      var inner = document.createElement('span');
      inner.className = 'word-inner';
      inner.textContent = word + '\u00A0';
      inner.style.transitionDelay = (i * 0.07) + 's';

      wrapper.appendChild(inner);
      el.appendChild(wrapper);
    });
  }

  function initTextReveal() {
    document.querySelectorAll('[data-text-reveal]').forEach(function (el) {
      splitWords(el);

      if (!window.IntersectionObserver) { el.classList.add('revealed'); return; }

      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.25 });

      obs.observe(el);
    });
  }

  // ─── 4. MOUSE PARALLAX (DEPTH LAYERS) ─────────────────────────────────────
  function initParallax() {
    if (prefersReducedMotion) return;

    var layers = document.querySelectorAll('[data-parallax]');
    if (!layers.length) return;

    var cx = window.innerWidth / 2;
    var cy = window.innerHeight / 2;

    document.addEventListener('mousemove', function (e) {
      var dx = (e.clientX - cx) / cx;
      var dy = (e.clientY - cy) / cy;

      layers.forEach(function (el) {
        var depth = parseFloat(el.getAttribute('data-parallax') || '1');
        var tx = dx * depth * 18;
        var ty = dy * depth * 14;
        el.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
      });
    });
  }

  // ─── 5. FLOATING COINS ────────────────────────────────────────────────────
  function initFloatingCoins() {
    if (prefersReducedMotion) return;

    var container = document.getElementById('floatingCoins');
    if (!container) return;

    var coins = [
      { size: 64, x: 12,  y: 22,  dur: 7,  delay: 0,    rotate: 20,  depth: 0.6 },
      { size: 42, x: 82,  y: 15,  dur: 9,  delay: 1.5,  rotate: -15, depth: 1.2 },
      { size: 28, x: 70,  y: 68,  dur: 11, delay: 0.8,  rotate: 35,  depth: 1.8 },
      { size: 52, x: 5,   y: 72,  dur: 8,  delay: 2,    rotate: -25, depth: 0.9 },
      { size: 36, x: 90,  y: 50,  dur: 13, delay: 3,    rotate: 45,  depth: 1.5 },
      { size: 20, x: 50,  y: 88,  dur: 10, delay: 0.3,  rotate: -10, depth: 2.0 },
    ];

    coins.forEach(function (c) {
      var el = document.createElement('div');
      el.className = 'floating-coin';
      el.setAttribute('data-parallax', c.depth);
      el.style.cssText = [
        'width:' + c.size + 'px',
        'height:' + c.size + 'px',
        'left:' + c.x + '%',
        'top:' + c.y + '%',
        'animation-duration:' + c.dur + 's',
        'animation-delay:' + c.delay + 's',
        '--coin-rotate:' + c.rotate + 'deg',
        '--coin-size:' + c.size + 'px',
      ].join(';');
      container.appendChild(el);
    });

    // Re-query for parallax after creating coins
    initParallax();
  }

  // ─── 6. MARQUEE BAND ──────────────────────────────────────────────────────
  function initMarquee() {
    document.querySelectorAll('.marquee-track:not([data-duped])').forEach(function (track) {
      track.innerHTML += track.innerHTML;
      track.setAttribute('data-duped', '1');
    });
  }

  // ─── 7. CLIP-PATH SECTION WIPE ────────────────────────────────────────────
  function initClipReveal() {
    if (prefersReducedMotion) return;
    if (!window.IntersectionObserver) return;

    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('clip-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('[data-clip-reveal]').forEach(function (el) {
      obs.observe(el);
    });
  }

  // ─── 8. SMOOTH MOMENTUM SCROLL ────────────────────────────────────────────
  function initSmoothScroll() {
    if (prefersReducedMotion || 'ontouchstart' in window) return;

    var current = 0;
    var target  = 0;
    var ease    = 0.085;
    var rafId   = null;
    var body    = document.body;
    var html    = document.documentElement;

    function getMaxScroll() {
      return Math.max(
        body.scrollHeight, body.offsetHeight,
        html.clientHeight, html.scrollHeight, html.offsetHeight
      ) - window.innerHeight;
    }

    var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    if (isFirefox) return; // Firefox has native smooth scroll

    window.addEventListener('wheel', function (e) {
      e.preventDefault();
      var delta = e.deltaMode === 1 ? e.deltaY * 16
                : e.deltaMode === 2 ? e.deltaY * window.innerHeight
                : e.deltaY;
      target += delta * 0.9;
      target  = Math.max(0, Math.min(target, getMaxScroll()));
      if (!rafId) tick();
    }, { passive: false });

    function tick() {
      current += (target - current) * ease;

      if (Math.abs(target - current) < 0.5) {
        current = target;
        window.scrollTo(0, current);
        rafId = null;
        return;
      }

      window.scrollTo(0, current);
      rafId = requestAnimationFrame(tick);
    }
  }

  // ─── 10. NUMBER TICKER (enhanced) ─────────────────────────────────────────
  function initTickers() {
    if (!window.IntersectionObserver) return;

    document.querySelectorAll('[data-ticker]').forEach(function (el) {
      var target = parseFloat(el.getAttribute('data-ticker'));
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var decimals = (String(target).split('.')[1] || '').length;
      var ran = false;

      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !ran) {
            ran = true;
            var start = performance.now();
            var dur   = 1800;

            function frame(now) {
              var p = Math.min((now - start) / dur, 1);
              var ease = 1 - Math.pow(1 - p, 3);
              var val = (target * ease);
              el.textContent = prefix + (decimals ? val.toFixed(decimals) : Math.floor(val).toLocaleString()) + suffix;
              if (p < 1) requestAnimationFrame(frame);
              else el.classList.add('ticker-done');
            }

            requestAnimationFrame(frame);
            obs.unobserve(el);
          }
        });
      }, { threshold: 0.6 });

      obs.observe(el);
    });
  }

  // ─── 11. SCROLL PROGRESS BAR ──────────────────────────────────────────────
  function initScrollProgress() {
    var bar = document.getElementById('scroll-progress');
    if (!bar) return;

    var ticking = false;
    function update() {
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ) - window.innerHeight;
      bar.style.width = (docHeight > 0 ? (scrollTop / docHeight * 100) : 0) + '%';
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // initCursor() — removed per user request
    initMagnetic();
    initTextReveal();
    initFloatingCoins();
    initMarquee();
    initClipReveal();
    initSmoothScroll();
    initScrollProgress();
    initTickers();
  });

})();
