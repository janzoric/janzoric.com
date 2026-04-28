/* ============================================================
   JAN. — interactions
   - REC timer
   - topbar color flip over dark section
   - custom cursor
   - magnet-repel char break-apart on cursor approach
   - scroll = destruction text effect
   - random shuffle of segments
   ============================================================ */

(() => {

  /* ============================================================
     REC TIMER
     ============================================================ */
  const timer = document.getElementById('timer');
  if (timer) {
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const total = Math.floor(elapsed / 10);
      const hh = String(Math.floor(total / 360000) % 100).padStart(2, '0');
      const mm = String(Math.floor(total / 6000) % 60).padStart(2, '0');
      const ss = String(Math.floor(total / 100) % 60).padStart(2, '0');
      const cs = String(total % 100).padStart(2, '0');
      timer.textContent = `${hh}:${mm}:${ss}:${cs}`;
      requestAnimationFrame(tick);
    };
    tick();
  }

  /* ============================================================
     TOPBAR COLOR FLIP
     ============================================================ */
  const topbar = document.getElementById('topbar');
  const darkSection = document.getElementById('dark');
  if (topbar && darkSection) {
    const onScroll = () => {
      const rect = darkSection.getBoundingClientRect();
      if (rect.top <= 60 && rect.bottom > 60) {
        topbar.classList.add('on-dark');
      } else {
        topbar.classList.remove('on-dark');
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ============================================================
     CHARACTER SPLITTING UTILITIES
     - splitChars wraps each visible char in a span
     - It walks text nodes only, leaves <br>, <span>.dot etc. intact
     ============================================================ */

  function splitChars(root, charClass = 'mchar', opts = {}) {
    const wrapWords = opts.wrapWords === true;
    const wordClass = opts.wordClass || 'word-wrap';

    // collect all text nodes (skip nodes already inside split spans)
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) {
      // skip if the parent is already a char span
      if (n.parentElement && n.parentElement.classList.contains(charClass)) continue;
      // skip if the node is inside an element that should be left whole
      if (n.parentElement && n.parentElement.dataset && n.parentElement.dataset.nosplit) continue;
      nodes.push(n);
    }
    nodes.forEach(textNode => {
      const text = textNode.nodeValue;
      if (!text) return;
      const frag = document.createDocumentFragment();

      if (wrapWords) {
        // Tokenize into runs of non-whitespace (words) and whitespace.
        // Each word becomes a `.<wordClass>` span (display:inline-block;
        // white-space:nowrap) so the browser cannot break a line in the
        // middle of a word — fixes "a nymore" wrapping.
        const tokens = text.match(/\S+|\s+/g) || [];
        tokens.forEach(token => {
          if (/^\s+$/.test(token)) {
            for (let i = 0; i < token.length; i++) {
              const span = document.createElement('span');
              span.className = charClass + ' space';
              span.textContent = token[i];
              frag.appendChild(span);
            }
          } else {
            const wordSpan = document.createElement('span');
            wordSpan.className = wordClass;
            for (let i = 0; i < token.length; i++) {
              const span = document.createElement('span');
              span.className = charClass;
              span.textContent = token[i];
              wordSpan.appendChild(span);
            }
            frag.appendChild(wordSpan);
          }
        });
      } else {
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          const span = document.createElement('span');
          span.className = charClass + (ch === ' ' ? ' space' : '');
          span.textContent = ch;
          frag.appendChild(span);
        }
      }
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  /* ============================================================
     MAGNET-REPEL  (text breaks apart on cursor approach)
     ============================================================ */
  const magnetEls = document.querySelectorAll('[data-magnet="chars"]');
  const magnetChars = [];

  magnetEls.forEach(el => {
    splitChars(el, 'mchar', { wrapWords: true, wordClass: 'mword' });
    el.querySelectorAll('.mchar').forEach(ch => {
      // give each char a slight individual "preference" so movement is varied
      ch._magnetSeed = {
        rx: (Math.random() * 2 - 1),
        ry: (Math.random() * 2 - 1),
        rr: (Math.random() * 2 - 1)
      };
      magnetChars.push(ch);
    });
  });

  // throttled mousemove + RAF update
  let mouseX = -9999, mouseY = -9999;
  let needsMagnetUpdate = false;
  let magnetCharRects = []; // cached bounding rects
  const RADIUS = 110;        // proximity radius
  const STRENGTH = 38;       // max push distance

  function cacheMagnetRects() {
    magnetCharRects = magnetChars.map(ch => {
      const r = ch.getBoundingClientRect();
      return { el: ch, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
  }

  function updateMagnet() {
    if (!magnetChars.length) return;
    for (let i = 0; i < magnetCharRects.length; i++) {
      const item = magnetCharRects[i];
      const dx = item.cx - mouseX;
      const dy = item.cy - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < RADIUS && dist > 0.0001) {
        // Falloff: closer = stronger
        const f = (1 - dist / RADIUS);
        // direction: away from cursor
        const ux = dx / dist;
        const uy = dy / dist;
        const seed = item.el._magnetSeed;
        const tx = ux * f * STRENGTH + seed.rx * f * 8;
        const ty = uy * f * STRENGTH + seed.ry * f * 8;
        const rot = seed.rr * f * 28;
        item.el.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
      } else {
        item.el.style.transform = '';
      }
    }
    needsMagnetUpdate = false;
  }

  // recache on resize/scroll (positions of chars change as page scrolls)
  let cacheScheduled = false;
  function scheduleCache() {
    if (cacheScheduled) return;
    cacheScheduled = true;
    requestAnimationFrame(() => {
      cacheMagnetRects();
      cacheScheduled = false;
    });
  }
  window.addEventListener('resize', scheduleCache);
  window.addEventListener('scroll', scheduleCache, { passive: true });
  // also recache when fonts load (sizes shift)
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      cacheMagnetRects();
    });
  }
  // initial cache after a tick
  setTimeout(cacheMagnetRects, 200);

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!needsMagnetUpdate) {
      needsMagnetUpdate = true;
      requestAnimationFrame(updateMagnet);
    }
  }, { passive: true });

  /* ============================================================
     SCROLL = DESTRUCTION
     - text wraps in per-char spans
     - on scroll, char positions/rotations/opacity progress 0->1
     ============================================================ */
  const destructEl = document.getElementById('destruction-text');
  let destructChars = [];
  if (destructEl) {
    splitChars(destructEl, 'dchar', { wrapWords: true, wordClass: 'dword' });
    destructChars = Array.from(destructEl.querySelectorAll('.dchar'));
    // give each a random destruction seed
    destructChars.forEach(ch => {
      ch._dseed = {
        x: (Math.random() * 2 - 1),
        y: (Math.random() * 2 - 1),
        r: (Math.random() * 2 - 1),
        // delay per char so destruction happens in waves
        delay: Math.random() * 0.4
      };
    });
  }

  function updateDestruction() {
    if (!destructEl || !destructChars.length) return;
    const rect = destructEl.getBoundingClientRect();
    const vh = window.innerHeight;
    const h = rect.height;

    // progress: 0 when text just enters viewport bottom,
    //           1 when text has fully exited viewport top
    let progress = 1 - (rect.top + h) / (vh + h);
    progress = Math.max(0, Math.min(1, progress));

    // delay actual destruction so first part is clean readable
    // map progress 0.3..0.95 -> 0..1
    let d = 0;
    if (progress > 0.3) {
      d = Math.min(1, (progress - 0.3) / 0.65);
    }

    for (let i = 0; i < destructChars.length; i++) {
      const ch = destructChars[i];
      const s = ch._dseed;
      // each char has an individual delay before destructing
      const localD = Math.max(0, d - s.delay);
      const tx = s.x * localD * 60;
      const ty = s.y * localD * 70;
      const r = s.r * localD * 65;
      const op = 1 - localD * 0.55;

      // RGB-split text-shadow that grows with destruction
      const shadowOffset = localD * 6;
      const shadow = localD > 0.05
        ? `${shadowOffset}px 0 rgba(240,78,30,${0.6 * localD}), -${shadowOffset}px 0 rgba(30,60,255,${0.6 * localD})`
        : 'none';

      ch.style.transform = `translate(${tx}px, ${ty}px) rotate(${r}deg)`;
      ch.style.opacity = op;
      ch.style.textShadow = shadow;
    }
  }
  window.addEventListener('scroll', updateDestruction, { passive: true });
  // initial run
  updateDestruction();

  /* ============================================================
     RANDOM SHUFFLE  (segments rearrange every few seconds)
     - works on any container with data-shuffle="true"
     - shuffles its direct .seg children via flex `order`
     ============================================================ */
  function shuffleSegments(container) {
    const segs = Array.from(container.querySelectorAll(':scope > .seg'));
    if (segs.length < 2) return;
    // generate a permutation
    const indices = segs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    segs.forEach((seg, i) => {
      seg.style.order = indices[i];
    });
  }

  document.querySelectorAll('[data-shuffle="true"]').forEach(container => {
    // ensure container is a flex container (it already should be via CSS,
    // but force it just in case)
    const computed = getComputedStyle(container);
    if (computed.display !== 'flex' && computed.display !== 'inline-flex') {
      container.style.display = 'inline-flex';
      container.style.flexWrap = 'wrap';
    }
    // initial randomization
    shuffleSegments(container);
    // re-shuffle on interval (slightly different timing per container so
    // they don't all flip at once)
    const period = 4500 + Math.floor(Math.random() * 2500);
    setInterval(() => shuffleSegments(container), period);
  });

  /* ============================================================
     INFO CARD — click +INFO to expand with extra bio
     ============================================================ */
  const infoCard   = document.getElementById('info-card');
  const infoToggle = document.getElementById('info-toggle');
  if (infoCard && infoToggle) {
    infoToggle.setAttribute('aria-expanded', 'false');
    const label = infoToggle.querySelector('.info-toggle-label');
    const ext   = infoCard.querySelector('.info-extended');
    infoToggle.addEventListener('click', () => {
      const isOpen = infoCard.classList.toggle('open');
      infoToggle.setAttribute('aria-expanded', String(isOpen));
      if (ext) ext.setAttribute('aria-hidden', String(!isOpen));
      if (label) label.textContent = isOpen ? '— CLOSE' : '+ INFO';
    });
  }

  /* ============================================================
     CUSTOM CURSOR
     ============================================================ */
  const dot  = document.querySelector('.cursor');
  const ring = document.querySelector('.cursor-ring');

  if (dot && ring && window.matchMedia('(hover: hover)').matches) {
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx, ry = my;
    let dx = mx, dy = my;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
    }, { passive: true });

    const tick = () => {
      dx += (mx - dx) * 0.6;
      dy += (my - dy) * 0.6;
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      dot.style.transform  = `translate(${dx}px, ${dy}px) translate(-50%, -50%)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
      requestAnimationFrame(tick);
    };
    tick();

    const hot = 'a, button, .ph, .dph';
    document.querySelectorAll(hot).forEach(el => {
      el.addEventListener('mouseenter', () => ring.classList.add('hot'));
      el.addEventListener('mouseleave', () => ring.classList.remove('hot'));
    });

    document.addEventListener('mouseleave', () => {
      dot.style.opacity = ring.style.opacity = '0';
    });
    document.addEventListener('mouseenter', () => {
      dot.style.opacity = ring.style.opacity = '';
    });
  }

})();
