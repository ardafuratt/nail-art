(function () {
  var stage = document.getElementById('stage');
  var canvas = document.getElementById('scrubCanvas');
  var ctx = canvas.getContext('2d');
  var loader = document.getElementById('loader');
  var loaderFill = document.getElementById('loaderFill');
  var flood = document.getElementById('flood');
  var reveal = document.getElementById('reveal');
  var introOverlay = document.getElementById('introOverlay');
  var cap1 = document.getElementById('cap1');
  var cap2 = document.getElementById('cap2');
  var railFill = document.getElementById('railFill');

  // ---- frame sequence config ----
  var FRAME_COUNT = 150;                       // matches assets/frames/frame-0001..0150.webp
  var FRAME_PATH = function (i) {
    var n = String(i).padStart(4, '0');
    return 'assets/frames/frame-' + n + '.webp';
  };

  var frames = new Array(FRAME_COUNT);
  var loadedCount = 0;
  var framesReady = false;
  var currentDrawnIndex = -1;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function remap(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function easeInQuad(t) { return t * t; }

  // ---- canvas sizing (retina-sharp, matches container box) ----
  function sizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    drawFrame(currentDrawnIndex >= 0 ? currentDrawnIndex : 0, true);
  }

  // ---- draws a frame with manual "object-fit: cover" math ----
  function drawFrame(index, force) {
    if (index < 0) return;
    var img = frames[index];
    if (!img) return;
    if (index === currentDrawnIndex && !force) return;
    currentDrawnIndex = index;

    var cw = canvas.width, ch = canvas.height;
    var iw = img.width, ih = img.height;
    var canvasRatio = cw / ch;
    var imgRatio = iw / ih;
    var sx, sy, sw, sh;
    if (imgRatio > canvasRatio) {
      sh = ih;
      sw = ih * canvasRatio;
      sx = (iw - sw) / 2;
      sy = 0;
    } else {
      sw = iw;
      sh = iw / canvasRatio;
      sx = 0;
      sy = (ih - sh) / 2;
    }
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  }

  // ---- preload all frames, first frame drawn as soon as it's available ----
  function preloadFrames() {
    for (var i = 1; i <= FRAME_COUNT; i++) {
      (function (idx) {
        var img = new Image();
        img.onload = function () {
          frames[idx - 1] = img;
          loadedCount++;
          loaderFill.style.width = Math.round((loadedCount / FRAME_COUNT) * 100) + '%';
          if (idx === 1) { sizeCanvas(); drawFrame(0, true); }
          if (loadedCount === FRAME_COUNT) {
            framesReady = true;
            loader.style.opacity = '0';
            setTimeout(function () { loader.style.display = 'none'; }, 550);
            frame();
          }
        };
        img.onerror = function () {
          loadedCount++; // don't block the whole sequence on one bad frame
        };
        img.src = FRAME_PATH(idx);
      })(i);
    }
  }

  function fadeStyle(el, t0, t1, p, dir) {
    var lp = remap(p, t0, t1);
    el.style.opacity = dir === 'out' ? (1 - lp) : lp;
  }

  function capStyle(el, t0, t1, p) {
    var lp = remap(p, t0, t1);
    var fadeIn = remap(lp, 0, 0.2);
    var fadeOut = remap(lp, 0.75, 1);
    var op = Math.min(fadeIn, 1 - fadeOut);
    el.style.opacity = op;
    el.style.transform = 'translateY(' + (18 * (1 - fadeIn)) + 'px)';
  }

  function computeProgress() {
    var rect = stage.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    return total > 0 ? clamp(-rect.top / total, 0, 1) : 0;
  }

  function frame() {
    var p = computeProgress();
    railFill.style.height = (p * 100) + '%';

    fadeStyle(introOverlay, 0, 0.08, p, 'out');
    introOverlay.style.pointerEvents = p > 0.05 ? 'none' : 'auto';

    // Map scroll progress directly to a frame index — no seeking, no keyframe
    // snapping, just drawing the exact frame for the exact scroll position.
    var seqP = remap(p, 0.06, 0.92);
    var idx = Math.round(seqP * (FRAME_COUNT - 1));
    drawFrame(idx);

    var floodT = remap(p, 0.80, 0.97);
    flood.style.opacity = easeInQuad(floodT);

    var revealT = remap(p, 0.90, 1);
    reveal.style.opacity = revealT;
    reveal.style.pointerEvents = revealT > 0.6 ? 'auto' : 'none';

    capStyle(cap1, 0.10, 0.44, p);
    capStyle(cap2, 0.46, 0.78, p);
  }

  var ticking = false;
  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(function () { frame(); ticking = false; });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { sizeCanvas(); onScroll(); });
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { sizeCanvas(); onScroll(); }, 120);
  });

  preloadFrames();
})();
