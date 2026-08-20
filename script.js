(function () {
  var stage = document.getElementById('stage');
  var canvas = document.getElementById('scrubCanvas');
  var ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  var flood = document.getElementById('flood');
  var reveal = document.getElementById('reveal');
  var introOverlay = document.getElementById('introOverlay');
  var cap1 = document.getElementById('cap1');
  var cap2 = document.getElementById('cap2');
  var railFill = document.getElementById('railFill');
  var topNav = document.getElementById('topNav');

  var FRAME_COUNT = 150;
  var FRAME_PATH = function (i) {
    var n = String(i).padStart(4, '0');
    return 'assets/frames/frame-' + n + '.webp';
  };

  var frames = new Array(FRAME_COUNT);
  var currentDrawnIndex = -1;

  // Smooth lerp physics state for 60-120 FPS video scrubbing
  var targetProgress = 0;
  var currentProgress = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function remap(v, a, b) { return clamp((v - a) / (b - a), 0, 1); }
  function easeInQuad(t) { return t * t; }

  // Canvas sizing (crisp & ultra-fast)
  function sizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    var rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    drawFrame(currentDrawnIndex >= 0 ? currentDrawnIndex : 0, true);
  }

  // Draw frame with pre-decoded GPU bitmap
  function drawFrame(index, force) {
    if (index < 0) return;
    var targetIdx = clamp(index, 0, FRAME_COUNT - 1);

    var img = frames[targetIdx];
    if (!img) {
      for (var offset = 1; offset < FRAME_COUNT; offset++) {
        if (targetIdx - offset >= 0 && frames[targetIdx - offset]) {
          img = frames[targetIdx - offset];
          break;
        }
        if (targetIdx + offset < FRAME_COUNT && frames[targetIdx + offset]) {
          img = frames[targetIdx + offset];
          break;
        }
      }
    }

    if (!img || (!force && targetIdx === currentDrawnIndex)) return;
    currentDrawnIndex = targetIdx;

    var cw = canvas.width, ch = canvas.height;
    if (cw === 0 || ch === 0) return;

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

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
  }

  // Pre-decode WebP images off the main thread using decode() / createImageBitmap
  function loadSingleFrame(idx, callback) {
    var img = new Image();
    img.src = FRAME_PATH(idx);
    if ('decode' in img) {
      img.decode().then(function () {
        frames[idx - 1] = img;
        if (callback) callback(img);
      }).catch(function () {
        frames[idx - 1] = img;
        if (callback) callback(img);
      });
    } else {
      img.onload = function () {
        frames[idx - 1] = img;
        if (callback) callback(img);
      };
    }
  }

  function loadFramesProgressively() {
    // 1st Frame loaded instantly
    loadSingleFrame(1, function () {
      sizeCanvas();
      drawFrame(0, true);
    });

    // Load keyframes first (every 3rd frame for rapid coverage)
    var queue = [];
    for (var k = 2; k <= FRAME_COUNT; k += 3) queue.push(k);
    for (var j = 2; j <= FRAME_COUNT; j++) {
      if (j % 3 !== 0) queue.push(j);
    }

    var qIdx = 0;
    function processQueue() {
      if (qIdx >= queue.length) return;
      var batch = 4;
      for (var b = 0; b < batch && qIdx < queue.length; b++, qIdx++) {
        loadSingleFrame(queue[qIdx]);
      }
      setTimeout(processQueue, 20);
    }

    setTimeout(processQueue, 40);
  }

  function fadeStyle(el, t0, t1, p, dir) {
    if (!el) return;
    var lp = remap(p, t0, t1);
    el.style.opacity = dir === 'out' ? (1 - lp) : lp;
  }

  function capStyle(el, t0, t1, p) {
    if (!el) return;
    var lp = remap(p, t0, t1);
    var fadeIn = remap(lp, 0, 0.2);
    var fadeOut = remap(lp, 0.75, 1);
    var op = Math.min(fadeIn, 1 - fadeOut);
    el.style.opacity = op;
    el.style.transform = 'translateY(' + (18 * (1 - fadeIn)) + 'px)';
  }

  function computeProgress() {
    if (!stage) return 0;
    var rect = stage.getBoundingClientRect();
    var total = rect.height - window.innerHeight;
    return total > 0 ? clamp(-rect.top / total, 0, 1) : 0;
  }

  function updateScrollState() {
    targetProgress = computeProgress();

    if (topNav) {
      if (window.scrollY > 60) {
        topNav.classList.add('scrolled');
      } else {
        topNav.classList.remove('scrolled');
      }
    }
  }

  // 60-120 FPS Smooth Motion Render Loop
  function loop() {
    // Smooth lerp interpolation physics (gives liquid smooth video feel)
    var diff = targetProgress - currentProgress;
    if (Math.abs(diff) > 0.0001) {
      currentProgress += diff * 0.16; // Lerp factor for ultra-smooth fluid response
    } else {
      currentProgress = targetProgress;
    }

    var p = currentProgress;

    if (railFill) railFill.style.height = (p * 100) + '%';

    fadeStyle(introOverlay, 0, 0.08, p, 'out');
    if (introOverlay) introOverlay.style.pointerEvents = p > 0.05 ? 'none' : 'auto';

    var seqP = remap(p, 0.06, 0.92);
    var idx = Math.round(seqP * (FRAME_COUNT - 1));
    drawFrame(idx);

    var floodT = remap(p, 0.80, 0.97);
    if (flood) flood.style.opacity = easeInQuad(floodT);

    var revealT = remap(p, 0.90, 1);
    if (reveal) {
      reveal.style.opacity = revealT;
      reveal.style.pointerEvents = revealT > 0.6 ? 'auto' : 'none';
    }

    capStyle(cap1, 0.10, 0.44, p);
    capStyle(cap2, 0.46, 0.78, p);

    requestAnimationFrame(loop);
  }

  window.addEventListener('scroll', updateScrollState, { passive: true });
  window.addEventListener('resize', function () { sizeCanvas(); updateScrollState(); });
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { sizeCanvas(); updateScrollState(); }, 100);
  });

  var bookingDateInput = document.getElementById('bookingDate');
  if (bookingDateInput) {
    var today = new Date().toISOString().split('T')[0];
    bookingDateInput.setAttribute('min', today);
  }

  updateScrollState();
  loadFramesProgressively();
  requestAnimationFrame(loop);
})();

// Global functions for booking & FAQ
function selectService(serviceName) {
  var srvSelect = document.getElementById('bookingService');
  if (srvSelect) {
    for (var i = 0; i < srvSelect.options.length; i++) {
      if (srvSelect.options[i].text.indexOf(serviceName) !== -1 || srvSelect.options[i].value === serviceName) {
        srvSelect.selectedIndex = i;
        break;
      }
    }
  }
  var bookingSec = document.getElementById('booking');
  if (bookingSec) {
    bookingSec.scrollIntoView({ behavior: 'smooth' });
  }
}

function submitBooking() {
  var service = document.getElementById('bookingService').value;
  var artist = document.getElementById('bookingArtist').value;
  var date = document.getElementById('bookingDate').value;
  var time = document.getElementById('bookingTime').value;
  var name = document.getElementById('clientName').value;
  var phone = document.getElementById('clientPhone').value;

  if (!service || !date || !time || !name || !phone) {
    alert('Lütfen zorunlu alanları doldurunuz.');
    return;
  }

  var code = 'AUR-' + Math.floor(1000 + Math.random() * 9000);
  document.getElementById('sumCode').textContent = code;
  document.getElementById('sumName').textContent = name;
  document.getElementById('sumService').textContent = service;
  document.getElementById('sumDateTime').textContent = date + ' @ ' + time;

  document.getElementById('bookingForm').style.display = 'none';
  document.getElementById('bookingSuccess').style.display = 'block';
}

function resetBookingForm() {
  document.getElementById('bookingForm').reset();
  document.getElementById('bookingForm').style.display = 'block';
  document.getElementById('bookingSuccess').style.display = 'none';
}

function toggleFaq(btn) {
  var item = btn.parentElement;
  var isActive = item.classList.contains('active');
  var allItems = document.querySelectorAll('.faq-item');
  allItems.forEach(function (el) { el.classList.remove('active'); });
  if (!isActive) item.classList.add('active');
}
