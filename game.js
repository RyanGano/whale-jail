(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const titleEl = $('title');
  const overEl = $('over');

  // ---- World constants (logical units; the world is always 640 tall) ----
  const H = 640;
  const MAX_W = 900;
  const SURFACE = 34;
  const FLOOR = H - 58;
  const PW = 78;            // pillar width
  const PAD = 10;           // room for decorative overhang around a pillar
  const GRAVITY = 1250;
  const FLAP_V = -390;
  const MAX_FALL = 560;
  const SPACING = 255;
  const PILLARS_PER_ZONE = 6;

  const ZONES = [
    { key: 'ship',  name: 'The Ship to Tarshish',        ref: '“He found a ship going to Tarshish” — Jonah 1:3' },
    { key: 'coral', name: 'The Coral Reef',              ref: '“In the midst of the seas” — Jonah 2:3' },
    { key: 'kelp',  name: 'The Weeds of the Deep',       ref: '“The weeds were wrapped about my head” — Jonah 2:5' },
    { key: 'rock',  name: 'The Roots of the Mountains',  ref: '“I went down to the bottoms of the mountains” — Jonah 2:6' },
    { key: 'ruins', name: 'The Great City of Nineveh',   ref: '“Nineveh was an exceeding great city” — Jonah 3:3' },
  ];

  const TIERS = [
    [0,  'Back to Joppa already?',      '“But Jonah rose up to flee… from the presence of the LORD.”', 'Jonah 1:3'],
    [1,  'Tossed by the tempest',       '“There was a mighty tempest in the sea.”', 'Jonah 1:4'],
    [5,  'Cast into the deep',          '“For thou hadst cast me into the deep, in the midst of the seas.”', 'Jonah 2:3'],
    [10, 'Wrapped in the weeds',        '“The waters compassed me about… the weeds were wrapped about my head.”', 'Jonah 2:5'],
    [20, 'Three days and three nights', '“Jonah was in the belly of the fish three days and three nights.”', 'Jonah 1:17'],
    [35, 'Salvation!',                  '“Salvation is of the LORD.”', 'Jonah 2:9'],
    [50, 'Onto dry land!',              '“And the LORD spake unto the fish, and it vomited out Jonah upon the dry land.”', 'Jonah 2:10'],
  ];

  let W = 400, scale = 1, dpr = 1;
  let bgGrad = null, floorGrad = null;

  // ---- Helpers ----
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hash = (i) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function loadBest() {
    try { return parseInt(localStorage.getItem('whale-jail-best'), 10) || 0; } catch { return 0; }
  }
  function saveBest(v) {
    try { localStorage.setItem('whale-jail-best', String(v)); } catch { /* storage unavailable */ }
  }

  // ---- State ----
  const state = {
    mode: 'title',          // title | ready | playing | dying | over
    time: 0,
    modeTime: 0,
    score: 0,
    best: loadBest(),
    whale: { x: 100, y: H * 0.45, vy: 0, rot: 0, tail: 0, boost: 0 },
    pillars: [],
    nextId: 0,
    spawnIn: 0,
    lastGapY: H / 2,
    runSeed: 1,
    scroll: 0,
    bubbles: [],
    fish: [],
    banner: null,
    shake: 0,
    flash: 0,
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth, vh = window.innerHeight;
    scale = vh / H;
    W = Math.min(vw / scale, MAX_W);
    canvas.style.width = `${W * scale}px`;
    canvas.style.height = `${vh}px`;
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    bgGrad = floorGrad = null;
    state.whale.x = Math.min(W * 0.28, 190);
  }

  // ---- Pillar painters. Local coords: x in [0, PW], cap at y = 0, base at y = len ----

  // Flat vector: the hull timbers of the ship to Tarshish.
  function paintShip(g, len, r) {
    const woods = ['#8a5a2e', '#94643a', '#7d5028', '#9c6b3f', '#86582f'];
    const n = 6, pw = PW / n;
    for (let i = 0; i < n; i++) {
      const x = i * pw;
      g.fillStyle = woods[Math.floor(r() * woods.length)];
      g.fillRect(x, 0, pw, len);
      g.fillStyle = 'rgba(70, 40, 15, 0.35)';
      for (let k = 0; k < 2; k++) {
        const gx = x + 3 + r() * (pw - 6);
        let gy = r() * 40;
        while (gy < len) { const l = 20 + r() * 50; g.fillRect(gx, gy, 1, l); gy += l + 10 + r() * 30; }
      }
      let y = 30 + r() * 90;
      while (y < len) {
        g.fillStyle = '#5a3a1c';
        g.fillRect(x, y, pw, 2);
        g.fillStyle = '#2e2014';
        g.fillRect(x + pw / 2 - 1, y - 6, 2, 2);
        g.fillRect(x + pw / 2 - 1, y + 5, 2, 2);
        y += 90 + r() * 70;
      }
      g.fillStyle = 'rgba(0, 0, 0, 0.28)';
      g.fillRect(x + pw - 1.5, 0, 1.5, len);
    }
    for (let y = 70 + r() * 40; y < len - 12; y += 150) {
      g.fillStyle = '#3f4a52'; g.fillRect(-2, y, PW + 4, 10);
      g.fillStyle = '#6c7a84'; g.fillRect(-2, y, PW + 4, 2);
      g.fillStyle = '#1f2830';
      for (let x = 6; x < PW; x += 14) { g.beginPath(); g.arc(x, y + 5.5, 1.7, 0, Math.PI * 2); g.fill(); }
    }
    // Barnacles
    g.fillStyle = '#ddd5c4';
    for (let i = 0; i < 5; i++) {
      const bx = r() * PW, by = 30 + r() * Math.min(len - 30, 220);
      g.beginPath(); g.arc(bx, by, 2 + r() * 2.5, 0, Math.PI * 2); g.fill();
    }
    // Gunwale cap
    g.fillStyle = '#5e3b1d'; roundRect(g, -7, 0, PW + 14, 18, 4); g.fill();
    g.fillStyle = '#7d5129'; g.fillRect(-5, 2, PW + 10, 5);
    g.fillStyle = '#3f2611'; g.fillRect(-7, 15, PW + 14, 3);
  }

  // Pixel art: a chunky coral reef.
  function paintCoral(g, len, r) {
    const P = 6;
    const cols = Math.round(PW / P);
    const rows = Math.ceil(len / P);
    const phase = r() * 10;
    const crown = Math.floor(r() * 3);
    for (let row = 0; row < rows; row++) {
      const y = row * P;
      const c0 = Math.sin(row * 0.55 + phase) > 0.4 ? -1 : 0;
      const c1 = cols - 1 + (Math.sin(row * 0.47 + phase * 1.7) > 0.4 ? 1 : 0);
      for (let c = c0; c <= c1; c++) {
        if (row === 0 && (c + crown) % 3 === 0) continue;
        let col;
        if (row === 0 || c === c0 || c === c1) col = '#8a2651';
        else if (row === 1 && (c + crown) % 3 === 0) col = '#8a2651';
        else if (row === 1) col = '#ffc2d1';
        else if (c === c0 + 1) col = '#ff8fa3';
        else if (c >= c1 - 2) col = '#bf3d6b';
        else col = '#e4577f';
        if (row > 1 && c > c0 && c < c1) {
          const n = r();
          if (n < 0.06) col = '#ffe066';
          else if (n < 0.12) col = '#ff9fb2';
          else if (n < 0.15) col = '#a32e5d';
        }
        g.fillStyle = col;
        g.fillRect(c * P, y, P, P);
      }
    }
    // A few pixel anemones clinging to the sides
    for (let i = 0; i < 3; i++) {
      const y = Math.floor((40 + r() * Math.min(len - 60, 240)) / P) * P;
      const left = r() < 0.5;
      const x = left ? -P : PW;
      g.fillStyle = '#ffe066'; g.fillRect(x, y, P, P);
      g.fillStyle = '#f4a100'; g.fillRect(x, y + P, P, P);
    }
  }

  // Low-poly: faceted stone of the mountain roots.
  function paintRock(g, len, r) {
    const step = 34;
    const L = [], M = [], R = [];
    for (let y = 0; y <= len + step; y += step) {
      L.push([-4 + r() * 8, y]);
      M.push([PW / 2 + (r() - 0.5) * 22, y + (y ? (r() - 0.5) * 14 : 0)]);
      R.push([PW + 4 - r() * 8, y]);
    }
    const tri = (a, b, c, light) => {
      const l = light + (r() - 0.5) * 8;
      g.fillStyle = g.strokeStyle = `hsl(${238 + r() * 14}, 16%, ${l}%)`;
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.closePath();
      g.fill(); g.lineWidth = 0.8; g.stroke();
    };
    for (let i = 0; i < L.length - 1; i++) {
      tri(L[i], M[i], L[i + 1], 44);
      tri(M[i], M[i + 1], L[i + 1], 37);
      tri(M[i], R[i], M[i + 1], 30);
      tri(R[i], R[i + 1], M[i + 1], 23);
    }
    const peak = [PW / 2 + (r() - 0.5) * 16, -6];
    tri(L[0], peak, M[0], 56);
    tri(peak, R[0], M[0], 40);
    // Glowing crystal facets
    for (let i = 0; i < 3; i++) {
      const cx = 10 + r() * (PW - 20), cy = 40 + r() * Math.min(len - 60, 260), s = 5 + r() * 5;
      g.fillStyle = 'rgba(110, 240, 230, 0.85)';
      g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.6, cy); g.lineTo(cx, cy + s * 0.5); g.lineTo(cx - s * 0.6, cy); g.closePath(); g.fill();
      g.fillStyle = 'rgba(220, 255, 250, 0.9)';
      g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.6, cy); g.lineTo(cx, cy); g.closePath(); g.fill();
    }
  }

  // Ink sketch: a carved column from the ruins of Nineveh.
  function sketchLine(g, x1, y1, x2, y2, r, j = 1.2) {
    const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 40));
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      g.moveTo(x1 + (r() - 0.5) * j, y1 + (r() - 0.5) * j);
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        g.lineTo(lerp(x1, x2, t) + (r() - 0.5) * j * 1.6, lerp(y1, y2, t) + (r() - 0.5) * j * 1.6);
      }
      g.stroke();
    }
  }
  function sketchRect(g, x, y, w, h, r) {
    sketchLine(g, x, y, x + w, y, r); sketchLine(g, x + w, y, x + w, y + h, r);
    sketchLine(g, x + w, y + h, x, y + h, r); sketchLine(g, x, y + h, x, y, r);
  }
  function sketchSpiral(g, cx, cy, rad, dir, r) {
    g.beginPath();
    for (let a = 0; a < Math.PI * 3.2; a += 0.3) {
      const rr = rad * (1 - a / (Math.PI * 3.6));
      const x = cx + Math.cos(a * dir) * rr + (r() - 0.5) * 0.6, y = cy + Math.sin(a * dir) * rr + (r() - 0.5) * 0.6;
      a === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.stroke();
  }
  function paintRuins(g, len, r) {
    const ink = '#2e2620';
    g.fillStyle = '#e8dbbb'; g.fillRect(6, 22, PW - 12, len);
    g.fillStyle = '#cdbb95'; g.fillRect(PW - 26, 22, 20, len);
    g.fillStyle = '#efe3c6'; g.fillRect(-6, 0, PW + 12, 12); g.fillRect(0, 12, PW, 10);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = ink; g.lineWidth = 1.4;
    sketchRect(g, -6, 0, PW + 12, 12, r);
    sketchRect(g, 0, 12, PW, 10, r);
    sketchSpiral(g, 5, 17, 7, 1, r);
    sketchSpiral(g, PW - 5, 17, 7, -1, r);
    sketchLine(g, 6, 22, 6, len, r);
    sketchLine(g, PW - 6, 22, PW - 6, len, r);
    // Fluting
    g.lineWidth = 0.8; g.globalAlpha = 0.6;
    for (let i = 1; i < 5; i++) { const x = 6 + (i * (PW - 12)) / 5; sketchLine(g, x, 28, x, len, r, 0.9); }
    g.globalAlpha = 1;
    // Drum joints and cracks
    g.lineWidth = 1.2;
    for (let y = 80 + r() * 30; y < len; y += 70 + r() * 35) {
      sketchLine(g, 6, y, PW - 6, y + (r() - 0.5) * 3, r);
      if (r() < 0.5) {
        g.beginPath();
        let cx = 10 + r() * (PW - 30), cy = y;
        g.moveTo(cx, cy);
        for (let k = 0; k < 4; k++) { cx += (r() - 0.3) * 10; cy += 6 + r() * 8; g.lineTo(cx, cy); }
        g.stroke();
      }
    }
    // Cross-hatched shadow
    g.save();
    g.beginPath(); g.rect(PW - 26, 22, 20, len); g.clip();
    g.lineWidth = 0.7; g.globalAlpha = 0.55;
    for (let y = 0; y < len + 30; y += 6) { g.beginPath(); g.moveTo(PW - 28, y + 22); g.lineTo(PW - 4, y); g.stroke(); }
    g.globalAlpha = 0.3;
    for (let y = 0; y < len + 30; y += 9) { g.beginPath(); g.moveTo(PW - 28, y); g.lineTo(PW - 4, y + 22); g.stroke(); }
    g.restore();
    // Cuneiform-ish wedge marks on a small tablet
    const ty = 40 + r() * 40;
    g.lineWidth = 1.1;
    for (let row = 0; row < 3; row++) {
      for (let k = 0; k < 4; k++) {
        const x = 14 + k * 8 + (r() - 0.5) * 2, y = ty + row * 9;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 4, y + 2); g.lineTo(x, y + 4); g.stroke();
      }
    }
  }

  const PAINTERS = { ship: paintShip, coral: paintCoral, rock: paintRock, ruins: paintRuins };

  // Watercolor-ish, animated every frame: swaying weeds of the deep.
  function paintKelp(g, len, seed, t) {
    const r = mulberry32(seed);
    const back = g.createLinearGradient(0, 0, PW, 0);
    back.addColorStop(0, 'rgba(28, 92, 52, 0.9)');
    back.addColorStop(1, 'rgba(12, 52, 32, 0.95)');
    g.fillStyle = back;
    roundRect(g, 2, 4, PW - 4, len, 24); g.fill();
    const hues = ['#2f8f4e', '#46a862', '#3a9a58', '#5cbf78', '#2a7d45'];
    const strands = 5;
    for (let i = 0; i < strands; i++) {
      const bx = 12 + (i * (PW - 24)) / (strands - 1);
      const ph = r() * Math.PI * 2;
      const pts = [];
      for (let y = len; y > -2; y -= 22) {
        const amp = 2 + 6 * (1 - Math.min(y, 240) / 240);
        pts.push([bx + Math.sin(t * 1.6 + y * 0.035 + ph) * amp, y]);
      }
      pts.push([bx + Math.sin(t * 1.6 + ph) * 8, -2]);
      const stroke = (w, style, dx) => {
        g.lineWidth = w; g.strokeStyle = style;
        g.beginPath(); g.moveTo(pts[0][0] + dx, pts[0][1]);
        for (let k = 1; k < pts.length; k++) {
          const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
          g.quadraticCurveTo(x0 + dx, y0, (x0 + x1) / 2 + dx, (y0 + y1) / 2);
        }
        g.stroke();
      };
      g.lineCap = 'round';
      stroke(20, 'rgba(10, 45, 25, 0.35)', 1.5);
      stroke(13, hues[i], 0);
      stroke(4, 'rgba(200, 255, 210, 0.3)', -3);
      // Leaves
      for (let k = 1; k < pts.length - 1; k += 2) {
        const [x, y] = pts[k];
        const side = k % 4 === 1 ? 1 : -1;
        g.fillStyle = 'rgba(96, 200, 120, 0.55)';
        g.beginPath();
        g.ellipse(x + side * 9, y - 4, 10, 4, side * (0.6 + Math.sin(t * 2 + k) * 0.15), 0, Math.PI * 2);
        g.fill();
      }
      const [tx, ty] = pts[pts.length - 2];
      g.fillStyle = '#a5e0a0';
      g.beginPath(); g.arc(tx, ty + 6, 4.5, 0, Math.PI * 2); g.fill();
    }
  }

  function renderPiece(style, len, seed) {
    const k = scale * dpr;
    const oc = document.createElement('canvas');
    oc.width = Math.ceil((PW + PAD * 2) * k);
    oc.height = Math.ceil(len * k);
    const g = oc.getContext('2d');
    g.scale(k, k);
    g.translate(PAD, 0);
    PAINTERS[style](g, len, mulberry32(seed));
    oc._k = k;
    return oc;
  }

  function drawPillar(p) {
    const style = ZONES[p.zone].key;
    const pieces = [
      ['top', p.gapTop, p.gapTop + 12, -1],
      ['bot', p.gapBot, H - p.gapBot + 12, 1],
    ];
    for (const [key, capY, len, dir] of pieces) {
      ctx.save();
      ctx.translate(Math.round(p.x), capY);
      if (dir < 0) ctx.scale(1, -1);
      if (style === 'kelp') {
        paintKelp(ctx, len, p.seed + dir, state.time);
      } else {
        let c = p.cache[key];
        if (!c || c._k !== scale * dpr) c = p.cache[key] = renderPiece(style, len, p.seed + dir);
        ctx.drawImage(c, -PAD, 0, PW + PAD * 2, len);
      }
      ctx.restore();
    }
  }

  // ---- Scenery ----
  function initFish() {
    const r = mulberry32(99);
    state.fish = Array.from({ length: 7 }, () => ({
      x: r() * MAX_W, y: 80 + r() * (FLOOR - 200), s: 6 + r() * 8, v: 12 + r() * 20, p: r() * 6,
    }));
  }

  function spawnBubble(x, y, big) {
    state.bubbles.push({
      x, y, r: big ? 2 + Math.random() * 4 : 1 + Math.random() * 2.2,
      vy: 30 + Math.random() * 40, p: Math.random() * 6, life: 0,
    });
  }

  function drawBackground() {
    if (!bgGrad) {
      bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#2389c0');
      bgGrad.addColorStop(0.3, '#10598f');
      bgGrad.addColorStop(0.7, '#08335e');
      bgGrad.addColorStop(1, '#041a33');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    const t = state.time;
    // Light shafts
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = ((i + 0.5) * W) / 5 + Math.sin(t * 0.25 + i * 1.7) * 40;
      const spread = 90 + Math.sin(t * 0.4 + i) * 30;
      ctx.fillStyle = `rgba(150, 215, 255, ${0.045 + 0.02 * Math.sin(t * 0.6 + i * 2)})`;
      ctx.beginPath();
      ctx.moveTo(x - 18, 0); ctx.lineTo(x + 26, 0);
      ctx.lineTo(x + 26 + spread, H * 0.85); ctx.lineTo(x - 18 + spread * 0.4, H * 0.85);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // Far and near hills (parallax)
    const hills = (speed, base, amp, color, f) => {
      const off = state.scroll * speed;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (let x = 0; x <= W + 16; x += 16) {
        const wx = x + off;
        ctx.lineTo(x, base - amp * (0.6 * Math.sin(wx * 0.006 * f) + 0.4 * Math.sin(wx * 0.017 * f + 1.3)));
      }
      ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
    };
    hills(0.12, FLOOR - 70, 50, '#0a3a66', 1);
    hills(0.3, FLOOR - 25, 35, '#082c50', 1.4);

    // Fish silhouettes
    ctx.fillStyle = 'rgba(3, 25, 50, 0.45)';
    for (const f of state.fish) {
      const y = f.y + Math.sin(t * 1.2 + f.p) * 6;
      ctx.beginPath();
      ctx.ellipse(f.x, y, f.s, f.s * 0.45, 0, 0, Math.PI * 2);
      ctx.moveTo(f.x + f.s * 0.8, y);
      ctx.lineTo(f.x + f.s * 1.6, y - f.s * 0.5);
      ctx.lineTo(f.x + f.s * 1.6, y + f.s * 0.5);
      ctx.fill();
    }

    // Surface shimmer
    ctx.fillStyle = 'rgba(200, 240, 255, 0.16)';
    ctx.beginPath(); ctx.moveTo(0, 0);
    for (let x = 0; x <= W + 12; x += 12) ctx.lineTo(x, SURFACE - 8 + Math.sin(x * 0.04 + t * 2) * 4 + Math.sin(x * 0.013 - t) * 3);
    ctx.lineTo(W, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(230, 250, 255, 0.35)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W + 12; x += 12) {
      const y = SURFACE - 8 + Math.sin(x * 0.04 + t * 2) * 4 + Math.sin(x * 0.013 - t) * 3;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawFloor() {
    if (!floorGrad) {
      floorGrad = ctx.createLinearGradient(0, FLOOR, 0, H);
      floorGrad.addColorStop(0, '#cfb483');
      floorGrad.addColorStop(1, '#7d6645');
    }
    const s = state.scroll, t = state.time;
    ctx.fillStyle = floorGrad;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, FLOOR + Math.sin((x + s) * 0.03) * 3);
    ctx.lineTo(W, H); ctx.closePath(); ctx.fill();

    // Pebbles and shells
    for (let i = Math.floor(s / 38) - 1; i <= Math.floor((s + W) / 38) + 1; i++) {
      const h = hash(i), x = i * 38 - s + h * 20, y = FLOOR + 14 + hash(i + 7) * 36;
      ctx.fillStyle = h < 0.33 ? '#a88d63' : h < 0.66 ? '#e2cda2' : '#8c7552';
      ctx.beginPath(); ctx.ellipse(x, y, 2 + h * 4, 1.5 + h * 2.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Seagrass tufts
    ctx.lineCap = 'round';
    for (let i = Math.floor(s / 70) - 1; i <= Math.floor((s + W) / 70) + 1; i++) {
      if (hash(i * 3.1) < 0.45) continue;
      const bx = i * 70 - s + hash(i) * 30;
      for (let b = 0; b < 4; b++) {
        const hgt = 14 + hash(i + b) * 22;
        const sway = Math.sin(t * 1.8 + i + b) * 5;
        ctx.strokeStyle = b % 2 ? '#3f9a5a' : '#2d7d48';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(bx + b * 4, FLOOR + 6);
        ctx.quadraticCurveTo(bx + b * 4 + sway * 0.3, FLOOR - hgt * 0.5, bx + b * 4 + sway, FLOOR - hgt);
        ctx.stroke();
      }
    }
  }

  function drawBubbles() {
    ctx.lineWidth = 1.2;
    for (const b of state.bubbles) {
      const a = Math.min(1, b.life * 3) * 0.7;
      ctx.strokeStyle = `rgba(220, 245, 255, ${a})`;
      ctx.fillStyle = `rgba(200, 240, 255, ${a * 0.18})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- The whale ----
  function whalePath() {
    ctx.beginPath();
    ctx.moveTo(31, 2);
    ctx.bezierCurveTo(31, -16, 12, -21, -4, -19);
    ctx.bezierCurveTo(-20, -17, -30, -8, -36, -2);
    ctx.lineTo(-36, 3);
    ctx.bezierCurveTo(-26, 11, -10, 18, 6, 17);
    ctx.bezierCurveTo(22, 16, 31, 10, 31, 2);
    ctx.closePath();
  }

  function drawWhale(w) {
    const dead = state.mode === 'dying' || state.mode === 'over';
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.rot);
    ctx.lineJoin = 'round';

    // Tail flukes
    ctx.save();
    ctx.translate(-34, 0);
    ctx.rotate(Math.sin(w.tail) * 0.35);
    ctx.fillStyle = '#2f5f8f'; ctx.strokeStyle = '#1d3f63'; ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(-9, s * 7, 11, 4.5, s * 0.75, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();

    // Body
    const grad = ctx.createLinearGradient(0, -20, 0, 18);
    grad.addColorStop(0, '#5a9bd3');
    grad.addColorStop(1, '#2f5f8f');
    whalePath();
    ctx.fillStyle = grad; ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#d6ecf7';
    ctx.beginPath(); ctx.ellipse(8, 17, 28, 9, -0.05, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(100, 150, 190, 0.55)'; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-8, 11 + i * 2.5); ctx.quadraticCurveTo(10, 13 + i * 2.5, 26, 7 + i * 2.5); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.beginPath(); ctx.ellipse(2, -13, 16, 3.5, -0.05, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    whalePath();
    ctx.strokeStyle = '#1d3f63'; ctx.lineWidth = 2; ctx.stroke();

    // Flipper
    ctx.save();
    ctx.translate(0, 9);
    ctx.rotate(0.6 + Math.sin(w.tail * 1.3) * 0.3);
    ctx.fillStyle = '#2f5f8f'; ctx.strokeStyle = '#1d3f63'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(-6, 0, 9, 3.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();

    // Face
    ctx.fillStyle = 'rgba(255, 140, 170, 0.5)';
    ctx.beginPath(); ctx.arc(19, 4, 3.2, 0, Math.PI * 2); ctx.fill();
    if (dead) {
      ctx.strokeStyle = '#10233a'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(15, -7); ctx.lineTo(20, -2); ctx.moveTo(20, -7); ctx.lineTo(15, -2); ctx.stroke();
    } else {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(17.5, -4.5, 3.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#10233a';
      ctx.beginPath(); ctx.arc(18.6, -4.3, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(19.3, -5.2, 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = '#1d3f63'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(30, 5); ctx.quadraticCurveTo(22, 9, 14, 7); ctx.stroke();

    ctx.restore();
  }

  // Two circles approximate the whale's body for collisions.
  function whaleCircles(w) {
    const c = Math.cos(w.rot), s = Math.sin(w.rot);
    return [[-12, 2, 13], [12, 0, 14]].map(([dx, dy, r]) => [w.x + dx * c - dy * s, w.y + dx * s + dy * c, r]);
  }
  function circleHitsRect(cx, cy, r, x, y, w, h) {
    const nx = clamp(cx, x, x + w), ny = clamp(cy, y, y + h);
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  // ---- Game flow ----
  function currentSpeed() {
    if (state.mode === 'playing') return 165 + Math.min(state.score, 40) * 1.8;
    if (state.mode === 'title' || state.mode === 'ready') return 60;
    return 0;
  }

  function spawnPillar() {
    const id = state.nextId++;
    const gap = Math.max(148, 182 - state.score * 1.2);
    const lo = SURFACE + gap / 2 + 30, hi = FLOOR - gap / 2 - 30;
    let cy = lerp(lo, hi, Math.random());
    cy = clamp(cy, state.lastGapY - 190, state.lastGapY + 190);
    state.lastGapY = cy;
    const zone = Math.floor(id / PILLARS_PER_ZONE) % ZONES.length;
    state.pillars.push({
      id, zone, x: W + 10, gapTop: cy - gap / 2, gapBot: cy + gap / 2,
      seed: (state.runSeed + id * 7919) | 0, cache: {}, passed: false,
    });
    if (id % PILLARS_PER_ZONE === 0) state.banner = { ...ZONES[zone], t: 0 };
  }

  function toReady() {
    state.mode = 'ready';
    state.modeTime = 0;
    state.score = 0;
    state.pillars = [];
    state.banner = null;
    Object.assign(state.whale, { y: H * 0.45, vy: 0, rot: 0, boost: 0 });
    titleEl.hidden = true;
    overEl.hidden = true;
  }

  function startPlaying() {
    state.mode = 'playing';
    state.modeTime = 0;
    state.nextId = 0;
    state.spawnIn = 0;
    state.lastGapY = H / 2;
    state.runSeed = (Math.random() * 1e9) | 0;
  }

  function flap() {
    const w = state.whale;
    w.vy = FLAP_V;
    w.boost = 1;
    for (let i = 0; i < 3; i++) spawnBubble(w.x + 2 + Math.random() * 6, w.y - 18, false);
  }

  function die() {
    if (state.god) return;
    state.mode = 'dying';
    state.modeTime = 0;
    state.shake = 12;
    state.flash = 0.6;
    state.whale.vy = Math.min(state.whale.vy, -160);
    for (let i = 0; i < 14; i++) spawnBubble(state.whale.x + (Math.random() - 0.5) * 40, state.whale.y + (Math.random() - 0.5) * 30, true);
    if (navigator.vibrate) navigator.vibrate(70);
  }

  function gameOver() {
    state.mode = 'over';
    state.modeTime = 0;
    const isBest = state.score > state.best;
    if (isBest) { state.best = state.score; saveBest(state.best); }
    let tier = TIERS[0];
    for (const t of TIERS) if (state.score >= t[0]) tier = t;
    $('over-title').textContent = tier[1];
    $('over-verse').textContent = tier[2];
    $('over-ref').textContent = tier[3];
    $('over-score').textContent = state.score;
    $('over-best').textContent = state.best;
    $('new-best').hidden = !isBest || state.score === 0;
    overEl.hidden = false;
    overEl.classList.add('locked');
    setTimeout(() => overEl.classList.remove('locked'), 600);
  }

  function update(dt) {
    state.time += dt;
    state.modeTime += dt;
    const w = state.whale;
    const speed = currentSpeed();
    state.scroll += speed * dt;

    if (state.mode === 'title' || state.mode === 'ready') {
      w.y = H * 0.45 + Math.sin(state.time * 2.2) * 10;
      w.rot = Math.sin(state.time * 2.2 + 1.2) * 0.08;
      w.tail += dt * 5;
    } else {
      w.vy = Math.min(w.vy + GRAVITY * dt, MAX_FALL);
      w.y += w.vy * dt;
      const target = state.mode === 'playing' ? clamp(w.vy / 700, -0.4, 0.65) : 1.25;
      w.rot = lerp(w.rot, target, 1 - Math.exp(-(state.mode === 'playing' ? 10 : 3) * dt));
      w.tail += dt * (state.mode === 'playing' ? 5 + w.boost * 18 : 1.5);
      w.boost = Math.max(0, w.boost - dt * 3);
      if (w.y < SURFACE + 8) { w.y = SURFACE + 8; if (w.vy < 0) w.vy = 0; }
      if (w.y > FLOOR - 16) {
        w.y = FLOOR - 16;
        w.vy = 0;
        if (state.mode === 'playing') die();
      }
    }

    if (state.mode === 'playing') {
      state.spawnIn -= speed * dt;
      if (state.spawnIn <= 0) { spawnPillar(); state.spawnIn += SPACING; }
      const circles = whaleCircles(w);
      for (const p of state.pillars) {
        p.x -= speed * dt;
        if (!p.passed && p.x + PW < w.x - 12) {
          p.passed = true;
          state.score++;
          for (let i = 0; i < 5; i++) spawnBubble(p.x + PW / 2 + (Math.random() - 0.5) * 30, (p.gapTop + p.gapBot) / 2 + (Math.random() - 0.5) * 40, false);
        }
        for (const [cx, cy, r] of circles) {
          if (circleHitsRect(cx, cy, r, p.x, -1000, PW, p.gapTop + 1000) ||
              circleHitsRect(cx, cy, r, p.x, p.gapBot, PW, 2000)) {
            die();
            break;
          }
        }
        if (state.mode !== 'playing') break;
      }
      state.pillars = state.pillars.filter((p) => p.x > -PW - PAD * 2);
    }

    if (state.mode === 'dying' && state.modeTime > 1.1) gameOver();

    // Ambient life
    if (Math.random() < dt * 3) spawnBubble(Math.random() * W, FLOOR - 4, Math.random() < 0.3);
    for (const b of state.bubbles) {
      b.life += dt;
      b.y -= b.vy * dt;
      b.x += Math.sin(state.time * 3 + b.p) * 12 * dt - speed * dt;
    }
    state.bubbles = state.bubbles.filter((b) => b.y > SURFACE - 6 && b.x > -10);
    for (const f of state.fish) {
      f.x -= (f.v + speed * 0.25) * dt;
      if (f.x < -40) { f.x = W + 40 + Math.random() * 200; f.y = 80 + Math.random() * (FLOOR - 200); }
    }
    if (state.banner) { state.banner.t += dt; if (state.banner.t > 3) state.banner = null; }
    state.shake = Math.max(0, state.shake - dt * 30);
    state.flash = Math.max(0, state.flash - dt * 2);
  }

  function fitText(text, maxW, size, weight, family) {
    let s = size;
    ctx.font = `${weight} ${s}px ${family}`;
    while (s > 10 && ctx.measureText(text).width > maxW) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
  }

  function render() {
    const k = scale * dpr;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (state.shake > 0) ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);

    drawBackground();
    for (const p of state.pillars) drawPillar(p);
    drawFloor();
    drawBubbles();
    drawWhale(state.whale);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (state.mode === 'ready') {
      const a = 0.65 + 0.35 * Math.sin(state.time * 4);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff';
      fitText('Tap, click or press Space to swim', W - 32, 20, 800, 'Nunito, system-ui, sans-serif');
      ctx.fillText('Tap, click or press Space to swim', W / 2, H * 0.66);
      ctx.beginPath();
      const ax = W / 2, ay = H * 0.72;
      ctx.moveTo(ax, ay - 10); ctx.lineTo(ax + 10, ay + 4); ctx.lineTo(ax - 10, ay + 4); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (state.mode === 'playing' || state.mode === 'dying') {
      ctx.font = '800 56px Nunito, system-ui, sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(3, 25, 50, 0.65)';
      ctx.strokeText(String(state.score), W / 2, 92);
      ctx.fillStyle = '#fff';
      ctx.fillText(String(state.score), W / 2, 92);
    }

    if (state.banner && state.mode === 'playing') {
      const t = state.banner.t;
      const a = Math.min(1, t * 3, (3 - t) * 2);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.shadowColor = 'rgba(2, 18, 36, 0.9)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffe7a3';
      fitText(state.banner.name, W - 32, 24, 800, 'Cinzel, Georgia, serif');
      ctx.fillText(state.banner.name, W / 2, 150);
      ctx.fillStyle = 'rgba(230, 245, 255, 0.9)';
      fitText(state.banner.ref, W - 32, 14, 'italic 600', 'Georgia, serif');
      ctx.fillText(state.banner.ref, W / 2, 176);
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = 1;
    }

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${state.flash})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  // ---- Input ----
  function press() {
    if (state.mode === 'ready') { startPlaying(); flap(); }
    else if (state.mode === 'playing') flap();
  }

  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });

  window.addEventListener('keydown', (e) => {
    const swimKey = e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW';
    if (!swimKey && e.code !== 'Enter') return;
    if (e.target instanceof HTMLButtonElement && e.code === 'Enter') return;
    e.preventDefault();
    if (e.repeat) return;
    if (state.mode === 'title') toReady();
    else if (state.mode === 'over') { if (!overEl.classList.contains('locked')) toReady(); }
    else if (swimKey) press();
  });

  $('start').addEventListener('click', (e) => { e.currentTarget.blur(); toReady(); });
  $('again').addEventListener('click', (e) => { e.currentTarget.blur(); toReady(); });
  $('share').addEventListener('click', share);

  let toastTimer = 0;
  function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  async function share() {
    const n = state.score;
    const url = location.origin + location.pathname;
    const text = `🐋 I swam past ${n} ${n === 1 ? 'pillar' : 'pillars'} in Whale Jail! Can you beat my score?`;
    if (navigator.share) {
      try { await navigator.share({ title: 'Whale Jail', text, url }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast('Score copied — paste it anywhere to share!');
    } catch {
      toast(`${text} ${url}`);
    }
  }

  document.addEventListener('visibilitychange', () => { last = performance.now(); });
  window.addEventListener('resize', resize);

  if (location.hash === '#debug') window.whaleJail = { state, step: (n) => { for (let i = 0; i < n; i++) update(1 / 60); render(); } };
  if (state.best > 0) $('title-best').textContent = `Your best: ${state.best}`;
  resize();
  initFish();
  requestAnimationFrame(frame);
})();
