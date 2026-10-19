/* Geospatial background for the portfolio: drawn on one canvas behind the page, very light.
   Styles: "contours" (topographic lines), "network" (places + connections), "grid" (graticule + pins + routes).
   Usage: <canvas id="geo-bg" data-style="contours"></canvas> + this script. Redraws on resize and theme change. */
(function () {
  const cv = document.getElementById("geo-bg");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  let W = 0, H = 0, DPR = 1;

  // fixed random generator, so the pattern is the same on every visit
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

  function colors() {
    const cs = getComputedStyle(document.documentElement);
    return { ink: cs.getPropertyValue("--ink").trim() || "#141414",
             accent: cs.getPropertyValue("--accent").trim() || "#D35400" };
  }
  function alpha(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------- 1. contour lines (marching squares on a smooth field) ---------- */
  function contours(c) {
    const r = rng(7), waves = [];
    for (let i = 0; i < 6; i++) waves.push([r() * 0.006 + 0.002, r() * 0.006 + 0.002, r() * 6.28, r() * 6.28, r() * 0.6 + 0.4]);
    const f = (x, y) => waves.reduce((s, [a, b, p, q, w]) => s + w * Math.sin(x * a + p) * Math.cos(y * b + q), 0);
    const step = 14, cols = Math.ceil(W / step) + 1, rows = Math.ceil(H / step) + 1;
    const v = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) v[j * cols + i] = f(i * step, j * step);
    const levels = []; for (let l = -2.4; l <= 2.4; l += 0.3) levels.push(l);
    levels.forEach((lv, k) => {
      ctx.strokeStyle = alpha(c.ink, k % 4 === 0 ? 0.13 : 0.07);   // every 4th line a little darker, like index contours
      ctx.lineWidth = k % 4 === 0 ? 1.2 : 0.8;
      ctx.beginPath();
      for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
        const a = v[j * cols + i], b = v[j * cols + i + 1], d = v[(j + 1) * cols + i], e = v[(j + 1) * cols + i + 1];
        const x = i * step, y = j * step, pts = [];
        const t = (p, q) => (lv - p) / (q - p);
        if ((a < lv) !== (b < lv)) pts.push([x + t(a, b) * step, y]);
        if ((b < lv) !== (e < lv)) pts.push([x + step, y + t(b, e) * step]);
        if ((d < lv) !== (e < lv)) pts.push([x + t(d, e) * step, y + step]);
        if ((a < lv) !== (d < lv)) pts.push([x, y + t(a, d) * step]);
        for (let p = 0; p + 1 < pts.length; p += 2) { ctx.moveTo(...pts[p]); ctx.lineTo(...pts[p + 1]); }
      }
      ctx.stroke();
    });
    pins(c, rng(3), 5);
  }

  /* ---------- 2. network: places linked to their nearest neighbours ---------- */
  function network(c) {
    const r = rng(11), n = Math.round((W * H) / 26000), P = [];
    for (let i = 0; i < n; i++) P.push([r() * W, r() * H, r() < 0.12]);
    ctx.lineWidth = 0.8;
    P.forEach((p, i) => {
      P.map((q, j) => [Math.hypot(p[0] - q[0], p[1] - q[1]), j]).sort((a, b) => a[0] - b[0]).slice(1, 3)
        .forEach(([d, j]) => {
          if (j < i || d > 260) return;
          ctx.strokeStyle = alpha(c.ink, 0.09);
          ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(P[j][0], P[j][1]); ctx.stroke();
        });
    });
    P.forEach(([x, y, hub]) => {
      ctx.fillStyle = hub ? alpha(c.accent, 0.35) : alpha(c.ink, 0.16);
      ctx.beginPath(); ctx.arc(x, y, hub ? 3.5 : 2, 0, 6.29); ctx.fill();
      if (hub) { ctx.strokeStyle = alpha(c.accent, 0.18); ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.29); ctx.stroke(); }
    });
  }

  /* ---------- 3. graticule + pins + dashed routes ---------- */
  function grid(c) {
    const gap = 120;
    ctx.strokeStyle = alpha(c.ink, 0.07); ctx.lineWidth = 1;
    ctx.fillStyle = alpha(c.ink, 0.18); ctx.font = "10px Inter, sans-serif";
    for (let x = gap / 2, k = 0; x < W; x += gap, k++) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillText(`${(35 + k * 0.25).toFixed(2)}°E`, x + 4, 84);
    }
    for (let y = gap / 2, k = 0; y < H; y += gap, k++) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      ctx.fillText(`${(34.5 - k * 0.25).toFixed(2)}°N`, 6, y - 4);
    }
    const r = rng(5), stops = [];
    for (let i = 0; i < 7; i++) stops.push([r() * W, r() * H]);
    ctx.setLineDash([5, 6]); ctx.strokeStyle = alpha(c.accent, 0.25); ctx.lineWidth = 1.2;
    ctx.beginPath(); stops.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.setLineDash([]);
    pins(c, rng(5), 7);
  }

  function pins(c, r, n) {                     // small map pins
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H;
      ctx.fillStyle = alpha(c.accent, 0.3);
      ctx.beginPath(); ctx.arc(x, y - 9, 6, Math.PI, 0); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = alpha("#FFFFFF", 0.5);
      ctx.beginPath(); ctx.arc(x, y - 9, 2.2, 0, 6.29); ctx.fill();
    }
  }

  function draw() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR; cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    const s = cv.dataset.style, c = colors();
    if (s === "contours") contours(c); else if (s === "network") network(c); else if (s === "grid") grid(c);
  }
  window.geoBg = { draw, set(style) { cv.dataset.style = style; draw(); } };
  let t; window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(draw, 150); });
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  draw();
})();
