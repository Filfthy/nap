// it-retreat.js - the painted tables: a public-domain painting behind the cards, darkened a little, with something
// moving over it, quietly:
//   RETREAT  - Adolph Northen, Napoleon's Retreat from Moscow (1851): snow falling at three depths, drifting on the
//              wind, and now and then a gust (img/retreat-bg.webp, from art/northen-retreat-from-moscow.webp)
//   WATERLOO - Félix Philippoteaux, The Battle of Waterloo: the British squares receiving the charge of the French
//              cuirassiers (1874): gunsmoke drifting across the field, and now and then a musket flash and a fresh
//              puff along the British line (img/waterloo-bg.webp, from art/philippoteaux-waterloo-cuirassiers.jpg)
//   EMPIRE   - a mahogany table top with a marquetry medallion of Napoleon in a laurel wreath (the user's picture,
//              reworked: the medallion made small and set in the middle, plain wood carried round it): a slow candle
//              sheen drifting across the polish (img/empire-bg.webp, from art/napoleon-marquetry-original.webp)
// Each is drawn on its own canvas behind the table; it only runs while its table is chosen, rests while the tab is
// hidden, and nothing moves for anyone who has asked for reduced motion.

function PaintedTable({ id, src, focus = [0.5, 0.5], darken = 0.32, tint = "10,12,18", base = "#1c1e22", effect, medal = null, stretch = false }) {
  return {
    canvas: null, ctx: null, img: null, bg: null, parts: [], active: false, raf: 0, last: 0, W: 0, H: 0, dpr: 1, t: 0,
    wind: 0, gust: 0, nextGust: 8, nextShot: 3,
    still: !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches),

    setActive(on) {
      this.active = on;
      if (on && !this.canvas) {
        this.canvas = document.createElement("canvas");
        this.canvas.id = id + "-bg"; this.canvas.className = "painted-bg";
        this.canvas.setAttribute("aria-hidden", "true");
        document.body.insertBefore(this.canvas, document.body.firstChild);
        this.ctx = this.canvas.getContext("2d");
        window.addEventListener("resize", () => { if (this.active) this.build(); });
        document.addEventListener("visibilitychange", () => { if (this.active && !document.hidden) this.loop(); });
      }
      if (!this.canvas) return;
      this.canvas.style.display = on ? "block" : "none";
      if (on) { this.build(); this.loop(); } else cancelAnimationFrame(this.raf);
    },


    build() {
      const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      this.W = W; this.H = H; this.dpr = dpr;
      this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
      if (!this.img) {
        this.img = new Image();
        this.img.onload = () => { if (this.active) this.build(); };
        this.img.src = src;
        if (medal) { this.medal = new Image(); this.medal.onload = () => { if (this.active) this.build(); }; this.medal.src = medal.src; }
      }
      // the painting, to cover the screen (kept centred on its focus), darkened, with a vignette
      const out = document.createElement("canvas");
      out.width = this.canvas.width; out.height = this.canvas.height;
      const c = out.getContext("2d");
      c.scale(dpr, dpr);
      c.fillStyle = base; c.fillRect(0, 0, W, H);
      const im = this.img;
      this.fit = null;
      if (im.complete && im.naturalWidth) {
        // (stretch: the whole picture fills the window exactly - a table top with its border all round)
        const k = Math.max(W / im.naturalWidth, H / im.naturalHeight), iw = stretch ? W : im.naturalWidth * k, ih = stretch ? H : im.naturalHeight * k;
        const ox = Math.min(0, Math.max(W - iw, W / 2 - focus[0] * iw)), oy = Math.min(0, Math.max(H - ih, H / 2 - focus[1] * ih));
        c.drawImage(im, ox, oy, iw, ih);
        this.fit = { ox, oy, iw, ih };
      }
      const F = this.finish ? EmpireFinish.values() : null;
      if (F) EmpireFinish.under(c, W, H, F);
      if (medal && this.medal && this.medal.complete && this.medal.naturalWidth) {
        const ref = Math.min(H, W * 9 / 16), m = medal.size * ref;
        if (F && F.age > 0) c.filter = `sepia(${0.45 * F.age}) brightness(${1 - 0.22 * F.age}) saturate(${1 + 0.15 * F.age})`;
        c.drawImage(this.medal, W / 2 - m / 2, medal.cy * H - m / 2, m, m);
        c.filter = "none";
      }
      if (F) EmpireFinish.over(c, W, H, F);
      c.fillStyle = `rgba(${tint},${darken})`; c.fillRect(0, 0, W, H);
      const vg = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.62)");
      c.fillStyle = vg; c.fillRect(0, 0, W, H);
      this.bg = out;
      this.parts = effect.init(this);
      this.draw();
    },
    // a point given as a fraction of the painting, on screen
    at(fx, fy) { const f = this.fit || { ox: 0, oy: 0, iw: this.W, ih: this.H }; return [f.ox + fx * f.iw, f.oy + fy * f.ih]; },

    loop() {
      cancelAnimationFrame(this.raf);
      this.last = performance.now();
      const step = now => {
        if (!this.active || document.hidden) return;
        const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
        if (!this.still) { this.t += dt; effect.update(this, dt); }
        this.draw();
        if (!this.still) this.raf = requestAnimationFrame(step);
      };
      this.raf = requestAnimationFrame(step);
    },
    draw() {
      const c = this.ctx, dpr = this.dpr;
      if (!this.bg) return;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(this.bg, 0, 0);
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      effect.draw(this, c);
    }
  };
}

// ---------------------------------------------------------------- snow
const SNOW = {
  init(T) {
    const n = Math.round(Math.min(420, Math.max(120, T.W * T.H / 5200)));
    return [...Array(n)].map(() => SNOW.flake(T, true));
  },
  flake(T, anywhere) {
    const d = Math.random() < 0.55 ? 0 : Math.random() < 0.7 ? 1 : 2;          // far, middle, near
    const S = Math.min(T.W, T.H) / 900;
    return { x: Math.random() * (T.W + 200) - 100, y: anywhere ? Math.random() * T.H : -10 - Math.random() * 40, d,
      r: [0.9, 1.6, 2.8][d] * S * (0.7 + Math.random() * 0.6), v: [22, 38, 62][d] * S * (0.8 + Math.random() * 0.4),
      sway: Math.random() * 6.3, swaySpeed: 0.6 + Math.random() * 0.9, a: [0.45, 0.6, 0.75][d] * (0.7 + Math.random() * 0.3) };
  },
  update(T, dt) {
    // the wind: a light drift from the left, and now and then a gust
    T.nextGust -= dt;
    if (T.nextGust <= 0 && T.gust <= 0) { T.gust = 3 + Math.random() * 3; T.gustPeak = 0.8 + Math.random() * 1.2; T.nextGust = 14 + Math.random() * 18; }
    let target = 0.25;
    if (T.gust > 0) { T.gust -= dt; target += T.gustPeak * Math.sin(Math.PI * Math.max(0, T.gust) / 4); }
    T.wind += (target - T.wind) * Math.min(1, dt * 0.8);
    const S = Math.min(T.W, T.H) / 900;
    for (const f of T.parts) {
      f.sway += f.swaySpeed * dt;
      f.y += f.v * dt;
      f.x += (Math.sin(f.sway) * 10 * S + T.wind * f.v * 1.4) * dt;
      if (f.y > T.H + 10 || f.x > T.W + 120 || f.x < -120) Object.assign(f, SNOW.flake(T, false), f.x > T.W + 120 ? { x: -60 - Math.random() * 60, y: Math.random() * T.H } : {});
    }
  },
  draw(T, c) {
    for (const f of T.parts) {
      if (f.d === 2) {                      // the near ones: soft
        const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 1.6);
        g.addColorStop(0, `rgba(240,244,250,${f.a})`); g.addColorStop(1, "rgba(240,244,250,0)");
        c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, f.r * 1.6, 0, Math.PI * 2); c.fill();
      } else {
        c.fillStyle = `rgba(232,238,246,${f.a})`;
        c.beginPath(); c.arc(f.x, f.y, f.r, 0, Math.PI * 2); c.fill();
      }
    }
  }
};

// ---------------------------------------------------------------- gunsmoke
// banks of smoke drifting slowly to the right across the field (low in the picture), each a soft blob that swells
// and thins as it goes; and now and then a musket flash somewhere along the British square (the left of the
// picture), and a fresh puff where it fired
const SMOKE = {
  // where the muskets are, in the painting (fractions): the squares on the left, firing to the right
  LINE: [[0.06, 0.52], [0.12, 0.56], [0.2, 0.6], [0.27, 0.62], [0.33, 0.6], [0.38, 0.55], [0.1, 0.72], [0.18, 0.76]],
  init(T) {
    const n = Math.round(Math.min(26, Math.max(12, T.W / 70)));
    return [...Array(n)].map(() => SMOKE.bank(T, true));
  },
  bank(T, anywhere) {
    const S = Math.min(T.W, T.H) / 900;
    const [, y] = T.at(0, 0.38 + Math.random() * 0.42);
    return { x: anywhere ? Math.random() * T.W : -200 * S, y, r: (90 + Math.random() * 140) * S, v: (6 + Math.random() * 9) * S,
      a: 0.06 + Math.random() * 0.08, life: 0, grow: 4 + Math.random() * 6, puff: false };
  },
  update(T, dt) {
    const S = Math.min(T.W, T.H) / 900;
    for (const b of T.parts) {
      b.life += dt; b.x += b.v * dt; b.y -= b.v * 0.12 * dt; b.r += b.grow * S * dt;
      if (b.puff) b.a *= Math.pow(0.86, dt);                       // a fresh puff thins away
      if (b.x - b.r > T.W || (b.puff && b.a < 0.012)) Object.assign(b, SMOKE.bank(T, false));
    }
    // a volley: a flash, and a puff of smoke where it fired
    T.nextShot -= dt;
    if (T.nextShot <= 0) {
      const [fx, fy] = SMOKE.LINE[Math.floor(Math.random() * SMOKE.LINE.length)];
      const [x, y] = T.at(fx + (Math.random() - 0.5) * 0.03, fy + (Math.random() - 0.5) * 0.02);
      T.flash = { x, y, t: 0 };
      const old = T.parts.find(b => !b.puff && b.x > T.W * 0.6) || T.parts[Math.floor(Math.random() * T.parts.length)];
      Object.assign(old, { x: x + 20 * S, y, r: 30 * S, v: 14 * S, a: 0.32, life: 0, grow: 38, puff: true });
      T.nextShot = 4 + Math.random() * 9;
    }
    if (T.flash) { T.flash.t += dt; if (T.flash.t > 0.35) T.flash = null; }
  },
  draw(T, c) {
    for (const b of T.parts) {
      const g = c.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(226,222,212,${b.a})`); g.addColorStop(0.55, `rgba(214,210,200,${b.a * 0.55})`); g.addColorStop(1, "rgba(200,196,188,0)");
      c.fillStyle = g; c.beginPath(); c.ellipse(b.x, b.y, b.r * 1.5, b.r, 0, 0, Math.PI * 2); c.fill();
    }
    if (T.flash) {
      const f = T.flash, k = 1 - f.t / 0.35, S = Math.min(T.W, T.H) / 900, r = 34 * S;
      c.save(); c.globalCompositeOperation = "lighter";
      const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
      g.addColorStop(0, `rgba(255,236,180,${0.75 * k})`); g.addColorStop(0.3, `rgba(255,170,70,${0.4 * k})`); g.addColorStop(1, "rgba(255,120,30,0)");
      c.fillStyle = g; c.beginPath(); c.arc(f.x, f.y, r, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }
};

const RETREAT = PaintedTable({ id: "retreat", src: "img/retreat-bg.webp?v=1", focus: [0.52, 0.5], effect: SNOW });
const WATERLOO = PaintedTable({ id: "waterloo", src: "img/waterloo-bg.webp?v=1", focus: [0.45, 0.62], darken: 0.36, tint: "14,10,6", base: "#1e1912", effect: SMOKE });

// ---------------------------------------------------------------- candlelight on polished wood
// a broad soft sheen that wanders slowly across the table, and a gentle flicker in its strength
const GLINT = {
  init() { return []; },
  update() {},
  draw(T, c) {
    const t = T.t, W = T.W, H = T.H;
    c.save(); c.globalCompositeOperation = "lighter";
    // the polish: a broad soft glow where the candle is, wandering slowly across the table, gently flickering
    const x = W * (0.5 + 0.3 * Math.sin(t * 0.045) + 0.08 * Math.sin(t * 0.13)), y = H * (0.4 + 0.16 * Math.sin(t * 0.06 + 1.3));
    const k = (0.085 + 0.02 * Math.sin(t * 2.3) * Math.sin(t * 0.7) + 0.011 * Math.sin(t * 5.1)) * (T.finish ? EmpireFinish.values().sheen : 1);   // (all the sheen: over the wood and the inlay alike)
    const g = c.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.4);
    g.addColorStop(0, `rgba(255,222,170,${k})`); g.addColorStop(0.45, `rgba(255,196,130,${k * 0.4})`); g.addColorStop(1, "rgba(255,170,90,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.restore();
  }
};
// (the medallion: the user's inlay on transparent, art/napoleon-inlay.webp; sized as set in the game, with his face
// just above the middle of the table)
const EMPIRE_FINISH = true;   // (the finish below)
const EMPIRE = PaintedTable({ id: "empire", src: "img/empire-wood.webp?v=8", medal: { src: "img/empire-medallion.webp?v=7", size: 0.656, cy: 0.505 }, focus: [0.5, 0.52], darken: 0, tint: "20,8,2", base: "#2a160c", effect: GLINT });


EMPIRE.finish = EMPIRE_FINISH;
// Hearts' table: the same mahogany, finish and candle sheen, with the user's marquetry heart in its ring
const HEARTWOOD = PaintedTable({ id: "heart", src: "img/empire-wood.webp?v=8", medal: { src: "img/heart-medallion.webp?v=1", size: 0.656, cy: 0.505 }, focus: [0.5, 0.52], darken: 0, tint: "20,8,2", base: "#2a160c", effect: GLINT });
HEARTWOOD.finish = EMPIRE_FINISH;

// ---------------------------------------------------------------- the Empire table's finish: one varnish over the
// wood and the inlay, its light, polish and wear. Values 0-1 (sheen 0-2), as the user set them
const EmpireFinish = {
  DEFAULTS: { varnish: 0.72, age: 0.55, light: 0.67, haze: 0.36, weather: 0.37, sheen: 0.5 },   // (as set by the user)
  values() {
    return this.DEFAULTS;
  },
  // (a seeded random, so the scratches and swirls stay put)
  rnd(seed) { let h = seed >>> 0; return () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296); },
  // on the wood, before the inlay goes in: the dark that gathers at the edges and corners
  under(c, W, H, F) {
    if (F.weather <= 0) return;
    const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    g.addColorStop(0, "rgba(20,8,2,0)"); g.addColorStop(1, `rgba(20,8,2,${0.45 * F.weather})`);
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  },
  // over everything: varnish, light, haze, wear
  over(c, W, H, F) {
    // the varnish: amber, multiplied over wood and inlay alike
    if (F.varnish > 0) {
      c.save(); c.globalCompositeOperation = "multiply";
      c.fillStyle = `rgba(255,${Math.round(214 - 30 * F.varnish)},${Math.round(150 - 70 * F.varnish)},${0.55 * F.varnish})`; c.fillRect(0, 0, W, H);
      c.restore();
    }
    // the light: from the upper left, falling off across the top
    if (F.light > 0) {
      c.save(); c.globalCompositeOperation = "soft-light";
      const g = c.createLinearGradient(W * 0.15, 0, W * 0.85, H);
      g.addColorStop(0, `rgba(255,236,200,${0.55 * F.light})`); g.addColorStop(0.55, "rgba(128,128,128,0)"); g.addColorStop(1, `rgba(0,0,0,${0.6 * F.light})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.restore();
    }
    // the polish: faint swirls from the cloth, and a fine haze
    if (F.haze > 0) {
      const r = this.rnd(7), S = Math.min(W, H) / 900;
      c.save(); c.globalCompositeOperation = "screen"; c.lineCap = "round";
      for (let i = 0; i < 260; i++) {
        const x = r() * W, y = r() * H, rad = (20 + r() * 90) * S, a0 = r() * 6.3;
        c.strokeStyle = `rgba(255,236,210,${(0.02 + 0.03 * r()) * F.haze})`; c.lineWidth = (0.6 + r() * 1.2) * S;
        c.beginPath(); c.arc(x, y, rad, a0, a0 + 0.6 + r() * 1.8); c.stroke();
      }
      c.fillStyle = `rgba(255,240,220,${0.035 * F.haze})`; c.fillRect(0, 0, W, H);
      c.restore();
    }
    // the wear: fine scratches, and the finish rubbed paler where hands and cards rest (at each player's edge)
    if (F.weather > 0) {
      const r = this.rnd(23), S = Math.min(W, H) / 900;
      c.save(); c.globalCompositeOperation = "screen"; c.lineCap = "round";
      for (let i = 0; i < Math.round(170 * F.weather); i++) {
        const x = r() * W, y = r() * H, len = (12 + r() * 70) * S, an = (r() - 0.5) * 0.9 + (r() < 0.5 ? 0 : Math.PI / 2) * 0.3;
        c.strokeStyle = `rgba(255,226,196,${(0.05 + 0.08 * r()) * F.weather})`; c.lineWidth = (0.4 + r() * 0.6) * S;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(an) * len, y + Math.sin(an) * len); c.stroke();
      }
      for (const [fx, fy, rw, rh] of [[0.5, 0.97, 0.3, 0.12], [0.5, 0.05, 0.25, 0.09], [0.04, 0.55, 0.08, 0.22], [0.96, 0.55, 0.08, 0.22]]) {
        const g = c.createRadialGradient(fx * W, fy * H, 0, fx * W, fy * H, rw * W);
        g.addColorStop(0, `rgba(255,214,170,${0.09 * F.weather})`); g.addColorStop(1, "rgba(255,214,170,0)");
        c.save(); c.translate(fx * W, fy * H); c.scale(1, rh * H / (rw * W)); c.translate(-fx * W, -fy * H);
        c.fillStyle = g; c.beginPath(); c.arc(fx * W, fy * H, rw * W, 0, Math.PI * 2); c.fill(); c.restore();
      }
      c.restore();
    }
  }
};
