// Interactive panels for the project cards: [data-play="sr" | "ts" | "tiles"].
// Each draws on its own <canvas>, runs two cycles when it comes into view, then rests;
// the pointer (or a touch) drives it again. Under reduced motion every panel shows its finished picture.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = (el, name, fb) => (getComputedStyle(el).getPropertyValue(name).trim() || fb);

  // --- a fetal-ultrasound-like picture, drawn once per size: a fan of speckle with a bright skull ring
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  function ultrasound(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'), r = rng(42);
    x.fillStyle = '#05070a'; x.fillRect(0, 0, w, h);
    const cx = w / 2, top = -h * 0.08, R = h * 1.05, a0 = Math.PI / 2 - 0.62, a1 = Math.PI / 2 + 0.62;
    x.save(); x.beginPath(); x.moveTo(cx, top); x.arc(cx, top, R, a0, a1); x.closePath(); x.clip();
    const g = x.createRadialGradient(cx, top, 0, cx, top, R);
    g.addColorStop(0, '#1a1d22'); g.addColorStop(0.7, '#2a2e35'); g.addColorStop(1, '#101215');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const img = x.getImageData(0, 0, w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 70 * (r() < 0.12 ? 2.2 : 1); d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    x.putImageData(img, 0, 0);
    // the head: a bright ring with a softer inside and a midline
    const hx = cx, hy = h * 0.56, rx = Math.min(w, h) * 0.30, ry = Math.min(w, h) * 0.24;
    x.fillStyle = 'rgba(70,76,86,.22)'; x.beginPath(); x.ellipse(hx, hy, rx, ry, -0.25, 0, Math.PI * 2); x.fill();
    for (let k = 0; k < 3; k++) {
      x.strokeStyle = `rgba(${225 - k * 30},${228 - k * 30},${235 - k * 30},${0.9 - k * 0.25})`;
      x.lineWidth = Math.max(2, rx * 0.07) - k; x.beginPath(); x.ellipse(hx, hy, rx + k * 2, ry + k * 2, -0.25, 0, Math.PI * 2); x.stroke();
    }
    x.strokeStyle = 'rgba(190,196,205,.55)'; x.lineWidth = 1.5; x.beginPath();
    x.moveTo(hx - rx * 0.75 * Math.cos(-0.25), hy - rx * 0.75 * Math.sin(-0.25)); x.lineTo(hx + rx * 0.75 * Math.cos(-0.25), hy + rx * 0.75 * Math.sin(-0.25)); x.stroke();
    for (let k = 0; k < 140; k++) { const t = r() * Math.PI * 2, q = 0.3 + r() * 0.6; x.fillStyle = `rgba(200,205,215,${0.08 + r() * 0.2})`; x.fillRect(hx + Math.cos(t) * rx * q, hy + Math.sin(t) * ry * q, 1 + r() * 2, 1 + r() * 2); }
    x.restore();
    return c;
  }
  function blurred(src) {
    const w = src.width, h = src.height, s = document.createElement('canvas');
    s.width = Math.max(8, Math.round(w / 6)); s.height = Math.max(8, Math.round(h / 6));
    const sx = s.getContext('2d'); sx.imageSmoothingEnabled = true; sx.drawImage(src, 0, 0, s.width, s.height);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    x.imageSmoothingEnabled = true; x.filter = 'blur(2px)'; x.drawImage(s, 0, 0, w, h); return c;
  }
  function roundRect(x, X, Y, W, H, R) { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); }

  function mount(panel) {
    const kind = panel.dataset.play, cv = document.createElement('canvas');
    cv.setAttribute('aria-hidden', 'true'); cv.className = 'play__canvas'; panel.prepend(cv);
    const x = cv.getContext('2d');
    const card = panel.closest('.card') || panel;
    let W = 0, H = 0, dpr = 1, pics = null, t0 = performance.now(), running = false, cycles = 0, ptr = null, raf = 0;
    const accent = css(document.documentElement, '--p-accent', '#39e991');

    function size() {
      const r = panel.getBoundingClientRect(); dpr = Math.min(devicePixelRatio || 1, 2);
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      x.setTransform(dpr, 0, 0, dpr, 0, 0); pics = null; draw(now());
    }
    const box = () => { const p = W < 400 ? 16 : 24; return { X: p, Y: p, W: W - 2 * p, H: H - 2 * p }; };
    function images(b) {
      if (!pics || pics.w !== Math.round(b.W) || pics.h !== Math.round(b.H)) {
        const sharp = ultrasound(Math.round(b.W * dpr), Math.round(b.H * dpr));
        pics = { w: Math.round(b.W), h: Math.round(b.H), sharp, soft: blurred(sharp) };
      }
      return pics;
    }
    const CYCLE = { sr: 5200, ts: 7000, tiles: 6400 }[kind];
    const now = () => performance.now();

    // ---- Real-SR: blurred picture, sharp inside a lens that follows the pointer
    function drawSR(t) {
      const b = box(), p = images(b); x.clearRect(0, 0, W, H);
      x.save(); roundRect(x, b.X, b.Y, b.W, b.H, 12); x.clip();
      x.drawImage(p.soft, b.X, b.Y, b.W, b.H);
      let lx, ly;
      if (ptr) { lx = ptr.x; ly = ptr.y; } else {
        const k = (t % CYCLE) / CYCLE * Math.PI * 2;
        lx = b.X + b.W * (0.5 + 0.32 * Math.sin(k)); ly = b.Y + b.H * (0.56 + 0.22 * Math.sin(k * 2));
      }
      const R = Math.min(b.W, b.H) * 0.34;
      x.save(); x.beginPath(); x.arc(lx, ly, R, 0, Math.PI * 2); x.clip(); x.drawImage(p.sharp, b.X, b.Y, b.W, b.H); x.restore();
      x.strokeStyle = accent; x.lineWidth = 2; x.beginPath(); x.arc(lx, ly, R, 0, Math.PI * 2); x.stroke();
      x.restore();
    }

    // ---- TSDecoder: trend + seasonality + sub-seasonality + noise make the series; the forecast follows the pointer
    const N = 160, split = 112, noise = (() => { const r = rng(7); return Array.from({ length: N }, () => (r() - 0.5) * 2); })();
    const comp = [
      { name: 'Trend', f: (i) => i / N * 1.6 },
      { name: 'Seasonality', f: (i) => Math.sin(i / N * Math.PI * 8) * 0.55 },
      { name: 'Sub-seasonality', f: (i) => Math.sin(i / N * Math.PI * 32) * 0.18 },
      { name: 'Noise', f: (i) => noise[i] * 0.12 },
    ];
    const sum = (i) => comp.reduce((a, c) => a + c.f(i), 0);
    const fc = (i) => comp[0].f(i) + comp[1].f(i) + comp[2].f(i);
    function drawTS(t) {
      const b = box(), ink = '#25303a', muted = '#4d5a68'; x.clearRect(0, 0, W, H);
      x.save(); roundRect(x, b.X, b.Y, b.W, b.H, 12); x.fillStyle = 'rgba(255,255,255,.82)'; x.fill(); x.restore();
      const pad = 16, X0 = b.X + pad, X1 = b.X + b.W - pad, Y0 = b.Y + pad;
      const rowsH = b.H * 0.42, rowH = rowsH / 4, mainY0 = Y0 + rowsH + 10, mainY1 = b.Y + b.H - pad;
      const ph = ptr ? 1 : (t % CYCLE) / CYCLE;
      const grow = Math.min(1, ph / 0.3), merge = Math.max(0, Math.min(1, (ph - 0.3) / 0.15));
      let fEnd;
      if (ptr) fEnd = Math.max(0, Math.min(1, (ptr.x - X0) / (X1 - X0) * N / (N - split) - split / (N - split)));
      else fEnd = Math.max(0, Math.min(1, (ph - 0.5) / 0.4));
      const xs = (i) => X0 + (X1 - X0) * i / (N - 1);
      x.font = '500 11px ' + css(document.documentElement, '--font-mono', 'monospace'); x.textBaseline = 'top';
      comp.forEach((c, k) => {
        const yc = Y0 + rowH * k + rowH / 2, amp = rowH * 0.38;
        const vals = Array.from({ length: N }, (_, i) => c.f(i)), lo = Math.min(...vals), hi = Math.max(...vals), mid = (lo + hi) / 2, sp = (hi - lo) || 1;
        const side = W >= 420, LX = side ? X0 + 116 : X0, lxs = (i) => LX + (X1 - LX) * i / (N - 1);
        x.fillStyle = muted; x.textBaseline = side ? 'middle' : 'top'; x.fillText(c.name, X0, side ? yc : Y0 + rowH * k); x.textBaseline = 'top';
        x.strokeStyle = `rgba(37,48,58,${0.85 - merge * 0.5})`; x.lineWidth = 1.2; x.beginPath();
        const last = Math.round((N - 1) * grow), a2 = side ? amp * 2.2 : amp * 1.6, yo = side ? 0 : 5;
        for (let i = 0; i <= last; i++) { const y = yc + yo - (vals[i] - mid) / sp * a2; i ? x.lineTo(lxs(i), y) : x.moveTo(lxs(i), y); }
        x.stroke();
      });
      if (merge > 0) {
        const all = Array.from({ length: N }, (_, i) => sum(i)), lo = Math.min(...all) - 0.2, hi = Math.max(...all) + 0.2;
        const ys = (v) => mainY1 - (v - lo) / (hi - lo) * (mainY1 - mainY0);
        x.globalAlpha = merge; x.strokeStyle = ink; x.lineWidth = 1.8; x.beginPath();
        for (let i = 0; i < split; i++) { i ? x.lineTo(xs(i), ys(all[i])) : x.moveTo(xs(i), ys(all[i])); } x.stroke();
        x.strokeStyle = 'rgba(37,48,58,.25)'; x.setLineDash([3, 4]); x.beginPath(); x.moveTo(xs(split - 1), mainY0); x.lineTo(xs(split - 1), mainY1); x.stroke(); x.setLineDash([]);
        const end = split - 1 + Math.round((N - split) * fEnd);
        if (end > split - 1) {
          x.fillStyle = 'rgba(14,159,110,.16)'; x.beginPath();
          for (let i = split - 1; i <= end; i++) { const s = 0.08 + (i - split) / N * 0.9; const y = ys(fc(i) + s); i === split - 1 ? x.moveTo(xs(i), y) : x.lineTo(xs(i), y); }
          for (let i = end; i >= split - 1; i--) { const s = 0.08 + (i - split) / N * 0.9; x.lineTo(xs(i), ys(fc(i) - s)); }
          x.closePath(); x.fill();
          x.strokeStyle = '#0e9f6e'; x.lineWidth = 2; x.beginPath();
          for (let i = split - 1; i <= end; i++) { i === split - 1 ? x.moveTo(xs(i), ys(all[i])) : x.lineTo(xs(i), ys(fc(i))); } x.stroke();
          x.fillStyle = '#0e9f6e'; x.beginPath(); x.arc(xs(end), ys(fc(end)), 3.5, 0, Math.PI * 2); x.fill();
        }
        x.fillStyle = muted; x.fillText('Series', X0, mainY0); x.textAlign = 'right'; x.fillText('Forecast', X1, mainY0); x.textAlign = 'left';
        x.globalAlpha = 1;
      }
    }

    // ---- ImageCrop: split into n x n tiles, each goes through SR, then the picture is put back together
    function drawTiles(t) {
      const b = box(), p = images(b); x.clearRect(0, 0, W, H);
      const n = ptr ? 2 + Math.min(2, Math.floor((ptr.x - b.X) / b.W * 3)) : 2 + (Math.floor(t / CYCLE) % 3);
      const ph = ptr ? Math.min(1, ((t - (ptr.t || t)) % CYCLE) / CYCLE) : (t % CYCLE) / CYCLE;
      const open = ph < 0.15 ? 0 : ph < 0.25 ? (ph - 0.15) / 0.1 : ph < 0.75 ? 1 : ph < 0.85 ? 1 - (ph - 0.75) / 0.1 : 0;
      const scan = Math.max(0, Math.min(1, (ph - 0.25) / 0.45)) * n * n;
      const gap = 10 * open, tw = (b.W - gap * (n - 1)) / n, th = (b.H - gap * (n - 1)) / n;
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const k = r * n + c, sx = p.sharp.width / n * c, sy = p.sharp.height / n * r, sw = p.sharp.width / n, sh = p.sharp.height / n;
        const dx = b.X + c * (tw + gap), dy = b.Y + r * (th + gap), done = scan > k + 1 || ph > 0.7, live = !done && scan > k;
        x.save(); roundRect(x, dx, dy, tw, th, open > 0 ? 8 : 0); x.clip();
        x.drawImage(done ? p.sharp : p.soft, sx, sy, sw, sh, dx, dy, tw, th);
        if (live) { const f = scan - k; x.save(); x.beginPath(); x.rect(dx, dy, tw, th * f); x.clip(); x.drawImage(p.sharp, sx, sy, sw, sh, dx, dy, tw, th); x.restore(); x.fillStyle = accent; x.fillRect(dx, dy + th * f - 1, tw, 2); }
        x.restore();
        if (open > 0.05) { x.strokeStyle = live ? accent : `rgba(255,255,255,${0.5 * open})`; x.lineWidth = live ? 2 : 1; roundRect(x, dx + 0.5, dy + 0.5, tw - 1, th - 1, 8); x.stroke(); }
      }
      if (open === 0) { x.save(); roundRect(x, b.X, b.Y, b.W, b.H, 12); x.strokeStyle = 'rgba(255,255,255,.18)'; x.stroke(); x.restore(); }
      x.font = '500 12px ' + css(document.documentElement, '--font-mono', 'monospace'); x.fillStyle = 'rgba(255,255,255,.85)'; x.textBaseline = 'top';
      x.fillText(`${n} × ${n}`, b.X + 12, b.Y + 10);
    }

    const draw = { sr: drawSR, ts: drawTS, tiles: drawTiles }[kind];
    function frame() {
      const t = now() - t0;
      draw(t);
      if (!ptr && t > CYCLE * 2) { running = false; return; }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (reduced) return; if (!running) { running = true; t0 = now(); raf = requestAnimationFrame(frame); } }
    function rest() { // the finished picture
      if (kind === 'ts') draw(CYCLE * 0.95); else if (kind === 'tiles') draw(CYCLE * 0.95); else draw(CYCLE * 0.25);
    }

    new ResizeObserver(() => { size(); if (!running) rest(); }).observe(panel);
    if (reduced) { size(); rest(); return; }
    new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) start(); else { cancelAnimationFrame(raf); running = false; } }), { threshold: 0.35 }).observe(panel);
    const move = (e) => { const r = panel.getBoundingClientRect(); const was = ptr; ptr = { x: e.clientX - r.left, y: e.clientY - r.top, t: was ? was.t : now() - t0 }; if (!running) { running = true; raf = requestAnimationFrame(frame); } };
    card.addEventListener('pointermove', move);
    card.addEventListener('pointerdown', move);
    card.addEventListener('pointerleave', () => { ptr = null; t0 = now(); });
  }

  const go = () => document.querySelectorAll('[data-play]:not([data-play="fed"])').forEach(mount);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', go, { once: true }) : go();
})();
