(() => {
  const USER = 'Domics10';
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- tema chiaro/scuro ----
  if (!root.dataset.theme) {
    root.dataset.theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // ---- nav con bordo allo scroll ----
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 10);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  document.getElementById('year').textContent = new Date().getFullYear();

  // ---- animazione comparsa ----
  const revealEls = document.querySelectorAll('.section-head, .filters, .card, .more, .pub, .skill-card, .contact > *');
  revealEls.forEach((el, k) => { el.classList.add('reveal'); el.style.transitionDelay = (k % 3) * 70 + 'ms'; });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  revealEls.forEach((el) => io.observe(el));

  // ---- spotlight che segue il mouse sulle card ----
  document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', e.clientX - r.left + 'px');
      card.style.setProperty('--my', e.clientY - r.top + 'px');
    });
  });

  // ---- slider LR/SR sulla card Real-SR ----
  const sr = document.querySelector('.vis-sr');
  if (sr) {
    const card = sr.closest('.card');
    let hovering = false, t = 0;
    card.addEventListener('pointermove', (e) => {
      const r = sr.getBoundingClientRect();
      hovering = true;
      const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
      sr.style.setProperty('--split', x + '%');
    });
    card.addEventListener('pointerleave', () => { hovering = false; });
    if (!reduced) {
      const loop = () => {
        if (!hovering) { t += 0.012; sr.style.setProperty('--split', 50 + Math.sin(t) * 28 + '%'); }
        requestAnimationFrame(loop);
      };
      loop();
    }
  }

  // ---- filtri progetti ----
  const chips = document.querySelectorAll('.chip');
  chips.forEach((chip) => chip.addEventListener('click', () => {
    chips.forEach((c) => c.classList.toggle('active', c === chip));
    const f = chip.dataset.filter;
    document.querySelectorAll('#projects .card').forEach((card) => {
      card.classList.toggle('hidden', f !== 'all' && !card.dataset.tags.split(' ').includes(f));
    });
  }));

  // ---- altri repository, caricati live da GitHub ----
  const featured = new Set(['real-sr', 'tsdecoder', 'data-analysis-project', 'sentimental-analysis', 'imagecrop', `${USER}.github.io`.toLowerCase()]);
  const list = document.getElementById('more-repos');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let loaded = false;
  document.querySelector('.more').addEventListener('toggle', async (e) => {
    if (!e.target.open || loaded) return;
    loaded = true;
    try {
      const res = await fetch(`https://api.github.com/users/${USER}/repos?per_page=100&sort=updated`);
      if (!res.ok) throw new Error(res.status);
      const repos = (await res.json()).filter((r) => !featured.has(r.name.toLowerCase()));
      list.innerHTML = repos.length ? repos.map((r) => `
        <div class="repo-row">
          <a class="name" href="${esc(r.html_url)}" target="_blank" rel="noopener">${esc(r.name)}${r.fork ? ' <span class="meta">· fork</span>' : ''}</a>
          <span class="meta">${esc(r.language || '')}${r.stargazers_count ? ' · ★ ' + r.stargazers_count : ''}</span>
          ${r.description ? `<span class="desc">${esc(r.description)}</span>` : ''}
        </div>`).join('') : '<p class="muted">No other repositories.</p>';
    } catch (err) {
      list.innerHTML = `<p class="muted">Couldn't load the list. <a href="https://github.com/${USER}?tab=repositories" target="_blank" rel="noopener"><u>See all on GitHub</u></a>.</p>`;
    }
  });

  // ---- sfondo: rete di nodi (stile neural network) ----
  const canvas = document.getElementById('bg');
  const ctx = canvas.getContext('2d');
  let W, H, nodes = [], dpr = Math.min(window.devicePixelRatio || 1, 2);
  const resize = () => {
    W = canvas.width = innerWidth * dpr; H = canvas.height = innerHeight * dpr;
    const count = Math.round(Math.min(70, (innerWidth * innerHeight) / 22000));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25 * dpr, vy: (Math.random() - 0.5) * 0.25 * dpr,
    }));
  };
  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    const color = getComputedStyle(root).getPropertyValue('--accent').trim() || '#7cf2c4';
    const maxD = 140 * dpr;
    ctx.fillStyle = color; ctx.strokeStyle = color;
    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
    for (let a = 0; a < nodes.length; a++) {
      for (let b = a + 1; b < nodes.length; b++) {
        const dx = nodes[a].x - nodes[b].x, dy = nodes[a].y - nodes[b].y;
        const d = Math.hypot(dx, dy);
        if (d < maxD) {
          ctx.globalAlpha = (1 - d / maxD) * 0.18;
          ctx.lineWidth = dpr;
          ctx.beginPath(); ctx.moveTo(nodes[a].x, nodes[a].y); ctx.lineTo(nodes[b].x, nodes[b].y); ctx.stroke();
        }
      }
    }
    ctx.globalAlpha = 0.45;
    for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, 1.6 * dpr, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (!reduced) requestAnimationFrame(draw);
  };
  resize(); draw();
  window.addEventListener('resize', resize);
})();