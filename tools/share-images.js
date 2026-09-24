// Regenerates the link-preview card (og.jpg) and the app icons from the game's own art.
//
// Link unfurlers (iMessage, WhatsApp, Slack, …) never run the game's JavaScript, so the
// preview has to be a committed image. To rebuild it:
//   1. Serve the repo (python -m http.server 8123) and open http://localhost:8123/#debug
//      in a browser window whose viewport is exactly 1200×630.
//   2. Paste this file into the dev-tools console. The five images download.
//   3. Move them into the repo root, replacing the old ones.
// Unfurlers cache an image by its address, so if you change og.jpg, give it a new name
// and update the og:image and twitter:image tags in index.html.
(async () => {
  const wj = window.whaleJail;
  if (!wj) throw new Error('Open the game with #debug in the URL first.');
  await Promise.all(['800 104px Cinzel', '800 40px Nunito', '600 29px Nunito'].map((f) => document.fonts.load(f)));

  const s = wj.state;
  const game = document.getElementById('game');
  const gx = game.getContext('2d');
  document.getElementById('title').hidden = true;
  wj.setMaxWidth(5000);

  const download = (canvas, name, type = 'image/png', quality) => new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(resolve, 300);
    }, type, quality);
  });

  // The game's whale, drawn large and centered on (cx, cy).
  function bigWhale(g, cx, cy, k, rot = -0.12) {
    gx.setTransform(1, 0, 0, 1, 0, 0);
    gx.clearRect(0, 0, game.width, game.height);
    gx.setTransform(k, 0, 0, k, game.width / 2, game.height / 2);
    gx.rotate(rot); gx.translate(12, 1.5); gx.rotate(-rot);
    wj.drawWhale({ x: 0, y: 0, rot, tail: 1.2 });
    gx.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(game, cx - game.width / 2, cy - game.height / 2);
  }

  function bubbles(g, list) {
    for (const [x, y, r] of list) {
      g.lineWidth = Math.max(1.5, r * 0.18);
      g.strokeStyle = 'rgba(220, 245, 255, 0.75)';
      g.fillStyle = 'rgba(200, 240, 255, 0.14)';
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = 'rgba(255, 255, 255, 0.8)';
      g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2); g.fill();
    }
  }

  function icon(size, k) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, size);
    bg.addColorStop(0, '#2a93c9'); bg.addColorStop(0.6, '#0f5387'); bg.addColorStop(1, '#073059');
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    g.fillStyle = 'rgba(160, 220, 255, 0.10)';
    g.beginPath();
    g.moveTo(size * 0.55, 0); g.lineTo(size * 0.72, 0); g.lineTo(size * 0.95, size); g.lineTo(size * 0.62, size);
    g.closePath(); g.fill();
    const u = size / 512;
    bubbles(g, [[size * 0.64, size * 0.2, 15 * u], [size * 0.72, size * 0.11, 10 * u], [size * 0.6, size * 0.08, 6 * u]]);
    bigWhale(g, size / 2, size * 0.56, k * u);
    return c;
  }

  function card() {
    // One pillar from each zone, placed so the text sits over dimmed pillars and the coral's gap.
    const toWorld = (cardY) => cardY / (630 / 640);
    const layout = [[0, 10, 300], [3, 240, 380], [4, 470, 260], [1, 700, 420], [2, 1060, 250]];
    s.pillars = layout.map(([zone, x, cy], i) => ({
      id: i, zone, x, gapTop: toWorld(cy) - 92, gapBot: toWorld(cy) + 92,
      seed: 2000 + i * 7919, cache: {}, passed: true,
    }));
    s.bubbles = [];
    s.whale.x = -500;
    s.time = 3.3;
    s.scroll = 820;
    wj.step(0);

    const c = document.createElement('canvas');
    c.width = 1200; c.height = 630;
    const g = c.getContext('2d');
    g.drawImage(game, 0, 0, 1200, 630);
    const fade = g.createLinearGradient(0, 0, 840, 0);
    fade.addColorStop(0, 'rgba(2, 16, 32, 0.92)');
    fade.addColorStop(0.55, 'rgba(2, 16, 32, 0.78)');
    fade.addColorStop(1, 'rgba(2, 16, 32, 0)');
    g.fillStyle = fade; g.fillRect(0, 0, 1200, 630);

    bubbles(g, [[800, 330, 7], [770, 352, 5], [748, 318, 4], [820, 360, 3.5], [790, 300, 3]]);
    bigWhale(g, 915, 285, 2.8, -0.2);

    const rr = (x, y, w, h, r) => {
      g.beginPath(); g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    };
    g.save(); rr(88, 88, 128, 128, 30); g.clip(); g.drawImage(icon(256, 4.9), 88, 88, 128, 128); g.restore();
    rr(88, 88, 128, 128, 30); g.strokeStyle = 'rgba(150, 215, 255, 0.4)'; g.lineWidth = 2; g.stroke();

    g.fillStyle = '#ffffff'; g.font = '800 104px Cinzel';
    g.shadowColor = 'rgba(0, 10, 25, 0.6)'; g.shadowOffsetY = 4;
    g.fillText('Whale Jail', 84, 340);
    g.shadowColor = 'transparent'; g.shadowOffsetY = 0;
    g.fillStyle = '#ffd166'; g.font = '800 40px Nunito';
    g.fillText('Swim the great fish through the deep', 88, 418);
    g.fillStyle = '#b9d4e6'; g.font = '600 29px Nunito';
    g.fillText('A Flappy Bird–style game from the story of Jonah', 88, 468);
    return c;
  }

  await download(icon(512, 4.9), 'icon-512.png');
  await download(icon(192, 4.9), 'icon-192.png');
  await download(icon(180, 4.9), 'apple-touch-icon.png');
  await download(icon(512, 3.9), 'icon-maskable-512.png');
  await download(card(), 'og.jpg', 'image/jpeg', 0.88);
})();
