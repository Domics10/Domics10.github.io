// The paper's panel [data-play="fed"]: five sensors forecast their own series and send them to a
// central model (federated averaging + mixture of experts) that forecasts the spring's level.
// Hover a sensor: its expert gets more weight. Click or tap a sensor: it drops out of the federation.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = (n, fb) => (getComputedStyle(document.documentElement).getPropertyValue(n).trim() || fb);
  const COLORS = ['#0e9f6e', '#0f9fb5', '#5f9e1f', '#c4901a', '#d0603a'];
  const N = 60, SPLIT = 44;
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const sensors = [0, 1, 2, 3, 4].map((k) => {
    const r = rng(11 + k * 7), ph = r() * 6, per = 10 + r() * 10, tr = (r() - 0.4) * 0.8, amp = 0.35 + r() * 0.35;
    const base = (i) => 0.5 + tr * i / N + Math.sin(i / per * Math.PI * 2 + ph) * amp * 0.5;
    const obs = Array.from({ length: N }, (_, i) => base(i) + (r() - 0.5) * 0.12);
    return { k, name: 'S' + (k + 1), obs, fc: (i) => base(i), on: true, w: 0.2, wT: 0.2, hover: false };
  });
  function roundRect(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }

  function mount(panel) {
    const cv = document.createElement('canvas'); cv.className = 'play__canvas'; cv.setAttribute('aria-hidden', 'true'); panel.prepend(cv);
    const x = cv.getContext('2d'), card = panel.closest('.card') || panel;
    let W = 0, H = 0, dpr = 1, L = null, ptr = null, t0 = performance.now(), running = false, raf = 0, lastT = 0;
    const mono = css('--font-mono', 'monospace'), ink = '#1d2a24', muted = '#4f5f57';

    function layout() {
      const p = W < 420 ? 12 : 20, B = { X: p, Y: p, W: W - 2 * p, H: H - 2 * p };
      const wide = B.W >= 480;
      let field, core, vw, vh;
      if (wide) {
        field = { X: B.X + 12, Y: B.Y + 12, W: B.W * 0.56 - 24, H: B.H - 24 };
        core = { X: B.X + B.W * 0.6, Y: B.Y + 16, W: B.W * 0.4 - 16, H: B.H - 32 };
        vw = Math.min(112, field.W * 0.36); vh = 46;
        const spots = [[0, 0.02], [1, 0.22], [0.14, 0.45], [0.92, 0.66], [0.02, 0.9]];
        sensors.forEach((s, i) => { const [fx, fy] = spots[i]; s.x = field.X + fx * (field.W - vw); s.y = field.Y + fy * (field.H - vh - 14) + 6; });
      } else {
        vw = (B.W - 20 - 4 * 6) / 5; vh = 34;
        field = { X: B.X + 10, Y: B.Y + 10, W: B.W - 20, H: vh + 22 };
        core = { X: B.X + 10, Y: field.Y + field.H + 44, W: B.W - 20, H: B.Y + B.H - (field.Y + field.H + 44) - 22 };
        sensors.forEach((s, i) => { s.x = field.X + i * (vw + 6); s.y = field.Y; });
      }
      sensors.forEach((s) => { s.box = { X: s.x, Y: s.y, W: vw, H: vh }; s.dot = { x: s.x + (wide ? 8 : vw / 2), y: s.y + vh + 9 }; });
      L = { B, field, core, wide, vw, vh };
    }
    function size() {
      const r = panel.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      x.setTransform(dpr, 0, 0, dpr, 0, 0); layout(); draw(performance.now() - t0);
    }
    function weights() {
      const on = sensors.filter((s) => s.on); const hov = sensors.find((s) => s.hover && s.on);
      sensors.forEach((s) => { s.wT = !s.on ? 0 : hov ? (s === hov ? 0.6 : 0.4 / Math.max(1, on.length - 1)) : 1 / Math.max(1, on.length); });
    }
    function spark(s, b, t, color) {
      const xs = (i) => b.X + 6 + (b.W - 12) * i / (N - 1), lo = -0.2, hi = 1.2, ys = (v) => b.Y + b.H - 5 - (v - lo) / (hi - lo) * (b.H - 16);
      x.lineWidth = 1.2; x.strokeStyle = s.on ? '#2b3a33' : '#a9b3ad'; x.beginPath();
      for (let i = 0; i < SPLIT; i++) { i ? x.lineTo(xs(i), ys(s.obs[i])) : x.moveTo(xs(i), ys(s.obs[i])); } x.stroke();
      const grow = Math.min(1, (t % 4000) / 1600), end = SPLIT - 1 + Math.round((N - SPLIT) * grow);
      x.strokeStyle = s.on ? color : '#c2cac5'; x.lineWidth = 1.6; x.beginPath();
      for (let i = SPLIT - 1; i <= end; i++) { i === SPLIT - 1 ? x.moveTo(xs(i), ys(s.obs[i])) : x.lineTo(xs(i), ys(s.fc(i))); } x.stroke();
    }
    function draw(t) {
      if (!L) return;
      const { B, core, wide } = L; x.clearRect(0, 0, W, H);
      roundRect(x, B.X, B.Y, B.W, B.H, 12); x.fillStyle = 'rgba(255,255,255,.86)'; x.fill();
      // ease the gate weights
      const dt = Math.min(64, t - lastT); lastT = t; sensors.forEach((s) => { s.w += (s.wT - s.w) * Math.min(1, dt / 180); });
      const hub = { x: core.X + 18, y: wide ? core.Y + core.H * 0.22 : core.Y + 22 };
      // links and pulses
      sensors.forEach((s, i) => {
        const c = COLORS[i]; x.strokeStyle = s.on ? (s.hover ? c : 'rgba(29,42,36,.22)') : 'rgba(29,42,36,.08)'; x.lineWidth = s.hover ? 2 : 1;
        x.setLineDash(s.on ? [] : [3, 4]); x.beginPath(); x.moveTo(s.dot.x, s.dot.y);
        const mx = (s.dot.x + hub.x) / 2; x.bezierCurveTo(mx, s.dot.y, mx, hub.y, hub.x, hub.y); x.stroke(); x.setLineDash([]);
        if (s.on && !reduced) {
          for (let j = 0; j < 2; j++) {
            const u = ((t / 2200 + i * 0.17 + j * 0.5) % 1), a = 1 - u;
            const px = a * a * a * s.dot.x + 3 * a * a * u * mx + 3 * a * u * u * mx + u * u * u * hub.x;
            const py = a * a * a * s.dot.y + 3 * a * a * u * s.dot.y + 3 * a * u * u * hub.y + u * u * u * hub.y;
            x.fillStyle = c; x.beginPath(); x.arc(px, py, 2.6, 0, Math.PI * 2); x.fill();
          }
        }
        // the sensor: a dot and its vignette
        x.fillStyle = s.on ? c : '#c2cac5'; x.beginPath(); x.arc(s.dot.x, s.dot.y, s.hover ? 6 : 4.5, 0, Math.PI * 2); x.fill();
        if (s.on) { x.strokeStyle = c; x.globalAlpha = 0.35; x.beginPath(); x.arc(s.dot.x, s.dot.y, 8 + 3 * Math.sin(t / 400 + i), 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1; }
        roundRect(x, s.box.X, s.box.Y, s.box.W, s.box.H, 6); x.fillStyle = '#ffffff'; x.fill();
        x.strokeStyle = s.hover ? c : 'rgba(29,42,36,.14)'; x.lineWidth = s.hover ? 1.5 : 1; x.stroke();
        x.font = '500 10px ' + mono; x.fillStyle = s.on ? muted : '#a9b3ad'; x.textBaseline = 'top'; x.fillText(s.on ? s.name : s.name + ' off', s.box.X + 6, s.box.Y + 4);
        spark(s, s.box, t + i * 300, c);
      });
      // the central model
      const cw = core.W, gx = core.X, gy = wide ? core.Y : core.Y;
      x.fillStyle = '#101814'; roundRect(x, hub.x - 14, hub.y - 14, 28, 28, 7); x.fill();
      x.strokeStyle = css('--p-accent', '#39e991'); x.lineWidth = 1.5; x.beginPath(); x.arc(hub.x, hub.y, 6, 0, Math.PI * 2); x.stroke();
      x.font = '500 12px ' + mono; x.fillStyle = ink; x.textBaseline = 'middle';
      x.fillText('Federated model', hub.x + 22, hub.y - 7); x.font = '400 11px ' + mono; x.fillStyle = muted; x.fillText('FedAvg + mixture of experts', hub.x + 22, hub.y + 8);
      // gate weights
      const barsY = hub.y + 30, bh = wide ? 10 : 7, gap = wide ? 6 : 4;
      sensors.forEach((s, i) => {
        const y = barsY + i * (bh + gap); x.font = '500 10px ' + mono; x.fillStyle = muted; x.textBaseline = 'middle'; x.fillText(s.name, gx, y + bh / 2);
        roundRect(x, gx + 26, y, cw - 70, bh, 3); x.fillStyle = 'rgba(29,42,36,.08)'; x.fill();
        if (s.w > 0.005) { roundRect(x, gx + 26, y, Math.max(4, (cw - 70) * s.w), bh, 3); x.fillStyle = COLORS[i]; x.fill(); }
        x.fillStyle = ink; x.textAlign = 'right'; x.fillText(Math.round(s.w * 100) + '%', gx + cw, y + bh / 2); x.textAlign = 'left';
      });
      // the total forecast
      const ch = { X: gx, Y: barsY + 5 * (bh + gap) + (wide ? 14 : 8), W: cw, H: 0 }; ch.H = core.Y + core.H - ch.Y;
      if (ch.H > 30) {
        x.font = '500 10px ' + mono; x.fillStyle = muted; x.textBaseline = 'top'; x.fillText('Spring level forecast', ch.X, ch.Y);
        const tot = (i) => { let a = 0, ws = 0; sensors.forEach((s) => { a += s.w * (i < SPLIT ? s.obs[i] : s.fc(i)); ws += s.w; }); return ws ? a / ws : 0.5; };
        const xs = (i) => ch.X + ch.W * i / (N - 1), lo = -0.1, hi = 1.1, ys = (v) => ch.Y + ch.H - 2 - (v - lo) / (hi - lo) * (ch.H - 18);
        x.strokeStyle = 'rgba(29,42,36,.22)'; x.setLineDash([2, 3]); x.beginPath(); x.moveTo(xs(SPLIT - 1), ch.Y + 14); x.lineTo(xs(SPLIT - 1), ch.Y + ch.H); x.stroke(); x.setLineDash([]);
        x.strokeStyle = ink; x.lineWidth = 1.6; x.beginPath(); for (let i = 0; i < SPLIT; i++) { i ? x.lineTo(xs(i), ys(tot(i))) : x.moveTo(xs(i), ys(tot(i))); } x.stroke();
        x.strokeStyle = '#0e9f6e'; x.lineWidth = 2.2; x.beginPath(); for (let i = SPLIT - 1; i < N; i++) { i === SPLIT - 1 ? x.moveTo(xs(i), ys(tot(i))) : x.lineTo(xs(i), ys(tot(i))); } x.stroke();
      }
      if (!ptr) { x.font = '400 10px ' + mono; x.fillStyle = muted; x.textBaseline = 'bottom'; x.fillText('Hover a sensor · click to drop it', L.field.X, B.Y + B.H - 6); }
    }
    function frame() { draw(performance.now() - t0); if (!ptr && performance.now() - t0 > 9000) { running = false; return; } raf = requestAnimationFrame(frame); }
    function start() { if (reduced || running) return; running = true; raf = requestAnimationFrame(frame); }
    const hit = (e) => { const r = panel.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top; return sensors.find((s) => (px >= s.box.X - 6 && px <= s.box.X + s.box.W + 6 && py >= s.box.Y - 6 && py <= s.dot.y + 10)); };
    card.addEventListener('pointermove', (e) => { ptr = e; const h = hit(e); sensors.forEach((s) => (s.hover = s === h)); weights(); if (!running) { running = true; t0 = performance.now() - lastT; raf = requestAnimationFrame(frame); } });
    card.addEventListener('pointerleave', () => { ptr = null; sensors.forEach((s) => (s.hover = false)); weights(); t0 = performance.now() - 2000; });
    card.addEventListener('click', (e) => { const h = hit(e); if (!h) return; e.preventDefault(); const on = sensors.filter((s) => s.on); if (h.on && on.length === 1) return; h.on = !h.on; weights(); if (!running) start(); });
    weights(); sensors.forEach((s) => (s.w = s.wT));
    new ResizeObserver(size).observe(panel);
    if (reduced) return;
    new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { t0 = performance.now(); start(); } else { cancelAnimationFrame(raf); running = false; } }), { threshold: 0.35 }).observe(panel);
  }
  const go = () => document.querySelectorAll('[data-play="fed"]').forEach(mount);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go, { once: true }) : go();
})();
