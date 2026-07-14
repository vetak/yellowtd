// Renderer module: draws battlefield state, towers, creeps and visual indicators.
// Pure 2D canvas renderer. Reads simulation state, never mutates it.
// Owns purely visual effects (rings, floating texts) fed by sim events.
const AIR_LIFT = 10; // air creeps are drawn slightly above their logical position
const MAX_EFFECTS = 260; // ceiling on live visual effects (see _spawnParticles)

class Renderer {
  constructor(canvas, configs) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = configs.map;
    this.towersCfg = configs.towers;
    this.creepsCfg = configs.creeps;
    this.effects = [];
    this.showFloatingText = true; // user setting, applied by main.js
    this._board = null;     // offscreen canvas with the static battlefield
    this._boardKey = null;  // map object the cached board was built for
  }

  reset() {
    this.effects = [];
  }

  // Swap in another map version's configs (canvas is resized by main.js).
  setVersion(version) {
    this.map = version.map;
    this.towersCfg = version.towers;
    this.creepsCfg = version.creeps;
    this.effects = [];
    this._board = null; // different map => rebuild the cached board
  }

  // Deterministic PRNG for terrain decoration. The board is a cache that can
  // be rebuilt at any time (version switch, menu <-> game), so its texture
  // must come out identical every time — Math.random would make the sand
  // visibly "reshuffle" on every rebuild.
  _rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Scatters short-lived particles from a point. Purely decorative, so
  // Math.random is fine here — the renderer never feeds back into the sim.
  // Hard-capped: a dense wave at 3x speed emits dozens of hits per tick, and
  // unbounded sparks would bury the frame for no readability gain.
  _spawnParticles(x, y, count, colour, speed, ttl) {
    if (this.effects.length > MAX_EFFECTS) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.effects.push({
        kind: 'spark',
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.25, // slight upward bias
        size: 1 + Math.random() * 1.6,
        colour,
        age: 0,
        ttl: ttl * (0.6 + Math.random() * 0.4),
      });
    }
  }

  ingestEvents(events) {
    for (const ev of events) {
      if (ev.type === 'kill') {
        if (this.showFloatingText) {
          this.effects.push({ kind: 'text', text: '+' + ev.bounty, x: ev.x, y: ev.y - 12, color: '#ffd76a', age: 0, ttl: 0.9, vy: -28 });
        }
        this._spawnParticles(ev.x, ev.y, 9, '#ffd76a', 70, 0.5);
      } else if (ev.type === 'hit') {
        // one small spark per hit keeps heavy waves readable without confetti
        this._spawnParticles(ev.x, ev.y, 2, '#ffe9a3', 45, 0.25);
      } else if (ev.type === 'leak') {
        if (this.showFloatingText) {
          this.effects.push({ kind: 'text', text: '-' + ev.livesCost, x: ev.x - 14, y: ev.y - 10, color: '#ff6b6b', age: 0, ttl: 1.0, vy: -20 });
        }
        this.effects.push({ kind: 'flash', age: 0, ttl: 0.3 });
      } else if (ev.type === 'explosion') {
        this.effects.push({ kind: 'ring', x: ev.x, y: ev.y, radius: ev.radius, age: 0, ttl: 0.35 });
        this._spawnParticles(ev.x, ev.y, 12, '#e2703a', 110, 0.45);
      } else if (ev.type === 'chainHit') {
        this.effects.push({ kind: 'bolt', x1: ev.fromX, y1: ev.fromY, x2: ev.toX, y2: ev.toY, age: 0, ttl: 0.18 });
      } else if (ev.type === 'waveEnd') {
        const label = ev.early ? 'Досрочный бонус +' : 'Бонус за волну +';
        this.effects.push({ kind: 'text', text: label + ev.bonus, x: this.canvas.width / 2, y: 40, color: '#e6c832', age: 0, ttl: 1.6, vy: -12, big: true });
      }
    }
  }

  // Hit-testing that accounts for how things are drawn (air lift).
  pickAt(mx, my, sim) {
    const s = sim.state;
    for (let i = s.creeps.length - 1; i >= 0; i--) {
      const c = s.creeps[i];
      const dy = c.type === 'air' ? c.y - AIR_LIFT : c.y;
      if (Math.hypot(mx - c.x, my - dy) <= c.radius + 5) return { creep: c };
    }
    const cs = this.map.cellSize;
    const col = Math.floor(mx / cs);
    const row = Math.floor(my / cs);
    const tower = sim.towerAt(col, row);
    if (tower) return { tower };
    return null;
  }

  // Menu backdrop: just the empty battlefield.
  drawIdle(path, dtReal) {
    this._drawBoard(path);
    this._drawEffects(dtReal || 0);
  }

  draw(sim, view, dtReal) {
    const ctx = this.ctx;
    const s = sim.state;
    const cs = this.map.cellSize;

    this._drawBoard(sim.path);

    // placement ghost
    if (view.placingType && view.cell) {
      const def = this.towersCfg[view.placingType];
      const { col, row } = view.cell;
      const ok = sim.canPlace(col, row).ok && s.gold >= def.levels[0].cost;
      const cx = col * cs + cs / 2;
      const cy = row * cs + cs / 2;
      ctx.fillStyle = ok ? 'rgba(230,200,50,0.22)' : 'rgba(220,60,60,0.26)';
      ctx.fillRect(col * cs, row * cs, cs, cs);
      this._rangeCircle(cx, cy, def.levels[0].range, ok);
    }

    // range circle for selected / hovered tower
    for (const id of [view.selectedTowerId, view.hoverTowerId]) {
      if (!id) continue;
      const t = sim.getTower(id);
      if (!t) continue;
      const lvl = this.towersCfg[t.typeId].levels[t.level];
      this._rangeCircle(t.x, t.y, lvl.range, true);
    }

    for (const t of s.towers) this._drawTower(t, t.id === view.selectedTowerId || t.id === view.hoverTowerId);
    for (const c of s.creeps) if (c.type === 'ground') this._drawCreep(c, s);
    for (const c of s.creeps) if (c.type === 'air') this._drawCreep(c, s);
    for (const p of s.projectiles) {
      const def = this.towersCfg[p.typeId];
      const r = p.splash > 0 ? 5 : 3;
      // glow first, then a bright core: reads as a hot round rather than a dot
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.6);
      g.addColorStop(0, def.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,250,230,0.75)';
      ctx.beginPath();
      ctx.arc(p.x - r * 0.25, p.y - r * 0.25, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    this._drawEffects(dtReal);
  }

  // Static desert board (sand, grid, road, markers). Nothing here changes
  // between frames, so it's rendered once into an offscreen canvas and then
  // blitted — that's what buys the detail below at no per-frame cost.
  _drawBoard(path) {
    if (!this._board || this._boardKey !== this.map) {
      this._board = this._buildBoard(path);
      this._boardKey = this.map;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this._board, 0, 0);
  }

  _buildBoard(path) {
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d');
    if (!ctx || !ctx.createLinearGradient) return cv; // headless stub: nothing to draw
    const cs = this.map.cellSize;
    const rand = this._rng(this.map.cols * 7919 + this.map.rows * 104729 + this.map.waypoints.length);

    this._paintSand(ctx, W, H, rand);
    this._paintGrid(ctx, W, H, cs);
    this._paintRoad(ctx, path, cs, rand);
    this._paintMarkers(ctx, path, W);
    this._paintVignette(ctx, W, H);
    return cv;
  }

  // Layered sand: base gradient, soft dunes, wind ripples, scattered grains.
  _paintSand(ctx, W, H, rand) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#3b2a15');
    bg.addColorStop(0.55, '#2a1d0f');
    bg.addColorStop(1, '#180f07');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < 26; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const r = 70 + rand() * 150;
      const lit = rand() > 0.45;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, lit ? 'rgba(216,177,74,0.08)' : 'rgba(0,0,0,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // wind ripples: long, very faint arcs suggesting a swept dune surface
    ctx.lineWidth = 1;
    for (let i = 0; i < 40; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const len = 40 + rand() * 90;
      const lift = 6 + rand() * 10;
      ctx.strokeStyle = `rgba(255,228,160,${0.02 + rand() * 0.03})`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y - lift, x + len, y);
      ctx.stroke();
    }

    for (let i = 0; i < 1100; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const a = 0.03 + rand() * 0.06;
      ctx.fillStyle = rand() > 0.4 ? `rgba(255,232,170,${a})` : `rgba(0,0,0,${a * 1.5})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  _paintGrid(ctx, W, H, cs) {
    ctx.strokeStyle = 'rgba(255,236,190,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < this.map.cols; c++) { ctx.moveTo(c * cs + 0.5, 0); ctx.lineTo(c * cs + 0.5, H); }
    for (let r = 1; r < this.map.rows; r++) { ctx.moveTo(0, r * cs + 0.5); ctx.lineTo(W, r * cs + 0.5); }
    ctx.stroke();
  }

  // Road: buildable-blocked cells stay the source of truth for the footprint,
  // then a stroked polyline gives it a packed, travelled look on top.
  _paintRoad(ctx, path, cs, rand) {
    for (const key of path.cells) {
      const [c, r] = key.split(',').map(Number);
      ctx.fillStyle = '#7d5c30';
      ctx.fillRect(c * cs, r * cs, cs, cs);
    }

    const pts = path.points;
    const stroke = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';   // soft shoulder shadow
    ctx.lineWidth = cs * 0.92;
    stroke();
    ctx.strokeStyle = '#9c7540';            // packed road body
    ctx.lineWidth = cs * 0.78;
    stroke();
    ctx.strokeStyle = 'rgba(226,193,110,0.30)'; // sun-bleached centre
    ctx.lineWidth = cs * 0.34;
    stroke();

    // pebbles along the verge, biased to the road cells
    for (const key of path.cells) {
      if (rand() > 0.5) continue;
      const [c, r] = key.split(',').map(Number);
      const x = c * cs + rand() * cs;
      const y = r * cs + rand() * cs;
      ctx.fillStyle = `rgba(0,0,0,${0.10 + rand() * 0.14})`;
      ctx.beginPath();
      ctx.arc(x, y, 0.8 + rand() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Entry gate (where creeps come from) and the exit the player defends.
  _paintMarkers(ctx, path, W) {
    const pts = path.points;
    const entry = path.posAt(0.0001);
    const eg = ctx.createRadialGradient(6, entry.y, 0, 6, entry.y, 34);
    eg.addColorStop(0, 'rgba(230,200,50,0.35)');
    eg.addColorStop(1, 'rgba(230,200,50,0)');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(6, entry.y, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e6c832';
    ctx.beginPath();
    ctx.moveTo(4, entry.y - 12); ctx.lineTo(22, entry.y); ctx.lineTo(4, entry.y + 12);
    ctx.closePath();
    ctx.fill();

    const exit = pts[pts.length - 1];
    const exitX = Math.min(exit.x, W - 8);
    const xg = ctx.createRadialGradient(exitX, exit.y, 0, exitX, exit.y, 40);
    xg.addColorStop(0, 'rgba(192,57,43,0.35)');
    xg.addColorStop(1, 'rgba(192,57,43,0)');
    ctx.fillStyle = xg;
    ctx.beginPath();
    ctx.arc(exitX, exit.y, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(exitX - 6, exit.y - 16, 8, 32);
    ctx.fillStyle = 'rgba(255,180,160,0.5)';
    ctx.fillRect(exitX - 6, exit.y - 16, 8, 4);
  }

  _paintVignette(ctx, W, H) {
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  _rangeCircle(x, y, range, ok) {
    const ctx = this.ctx;
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.07)' : 'rgba(220,60,60,0.08)';
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.3)' : 'rgba(220,60,60,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Shifts a #rrggbb colour toward white (amount > 0) or black (amount < 0).
  // Used for shading, so creeps/towers get lit and shadowed sides from the
  // single flat colour their config declares.
  _lighten(hex, amount) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    const mix = (ch) => {
      const v = amount >= 0 ? ch + (255 - ch) * amount : ch * (1 + amount);
      return Math.max(0, Math.min(255, Math.round(v)));
    };
    return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
  }

  // Rounded-rect path helper (roundRect() isn't available everywhere).
  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Tower: dropped shadow, lit stone plinth, tinted rim, glyph, level pips.
  // The plinth is shaded top-lit so towers read as objects standing on the
  // sand rather than flat squares painted onto it.
  _drawTower(t, highlighted) {
    const ctx = this.ctx;
    const def = this.towersCfg[t.typeId];
    const cs = this.map.cellSize;
    const x = t.x;
    const y = t.y;
    const half = cs / 2 - 5;
    const size = half * 2;

    ctx.save();

    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(x + 1.5, y + half - 1, half * 0.95, half * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // plinth body, lit from above
    const body = ctx.createLinearGradient(x, y - half, x, y + half);
    body.addColorStop(0, '#4a3722');
    body.addColorStop(0.5, '#2f2114');
    body.addColorStop(1, '#1d140b');
    ctx.fillStyle = body;
    this._roundRect(ctx, x - half, y - half, size, size, 5);
    ctx.fill();

    // tinted rim: the tower's identity colour, brighter when selected/hovered
    ctx.strokeStyle = highlighted ? '#ffffff' : def.color;
    ctx.lineWidth = highlighted ? 2.4 : 1.6;
    ctx.globalAlpha = highlighted ? 1 : 0.85;
    this._roundRect(ctx, x - half + 0.5, y - half + 0.5, size - 1, size - 1, 5);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // top bevel highlight
    ctx.strokeStyle = 'rgba(255,235,180,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - half + 4, y - half + 2.5);
    ctx.lineTo(x + half - 4, y - half + 2.5);
    ctx.stroke();

    // faint colour glow so each tower type is readable at a glance
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 8;
    this._drawGlyph(ctx, def, x, y);
    ctx.restore();
    this._drawGlyph(ctx, def, x, y);

    // level pips: filled for reached levels, hollow for the rest
    const maxLevel = def.levels.length;
    const pipY = y + half - 3.5;
    const pipX0 = x - ((maxLevel - 1) * 5) / 2;
    for (let i = 0; i < maxLevel; i++) {
      const reached = i <= (t.level || 0);
      ctx.beginPath();
      ctx.arc(pipX0 + i * 5, pipY, 1.7, 0, Math.PI * 2);
      if (reached) {
        ctx.fillStyle = '#f7e3a2';
        ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(247,227,162,0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Tower glyph, shared by the battlefield and the UI portrait.
  _drawGlyph(ctx, def, x, y) {
    ctx.strokeStyle = def.color;
    ctx.fillStyle = def.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (def.shape === 'arrow') {
      ctx.moveTo(x - 6, y + 5); ctx.lineTo(x, y - 7); ctx.lineTo(x + 6, y + 5);
      ctx.stroke();
    } else if (def.shape === 'circle') {
      ctx.arc(x, y - 1, 7, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.shape === 'snow') {
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI / 3) * i;
        ctx.moveTo(x - Math.cos(a) * 8, y - 1 - Math.sin(a) * 8);
        ctx.lineTo(x + Math.cos(a) * 8, y - 1 + Math.sin(a) * 8);
      }
      ctx.stroke();
    } else if (def.shape === 'triangle') {
      ctx.moveTo(x, y - 8); ctx.lineTo(x + 7, y + 5); ctx.lineTo(x - 7, y + 5);
      ctx.closePath();
      ctx.fill();
    } else if (def.shape === 'poison') {
      ctx.arc(x, y - 1, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 5, y - 8, 2.5, 0, Math.PI * 2);
      ctx.arc(x - 6, y - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (def.shape === 'multi') {
      for (const off of [-6, 0, 6]) {
        ctx.moveTo(x + off - 3, y + 4); ctx.lineTo(x + off, y - 5); ctx.lineTo(x + off + 3, y + 4);
      }
      ctx.stroke();
    } else if (def.shape === 'storm') { // lightning bolt zigzag
      ctx.moveTo(x + 4, y - 9); ctx.lineTo(x - 3, y - 1); ctx.lineTo(x + 2, y - 1);
      ctx.lineTo(x - 4, y + 8);
      ctx.stroke();
    } else { // 'cross' and fallback
      ctx.arc(x, y - 1, 6, 0, Math.PI * 2);
      ctx.moveTo(x - 9, y - 1); ctx.lineTo(x + 9, y - 1);
      ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 8);
      ctx.stroke();
    }
  }

  // 48x48 icon for the selected-tower portrait (UI panel).
  drawTowerIcon(canvasEl, typeId) {
    const def = this.towersCfg[typeId];
    if (!def || !canvasEl || !canvasEl.getContext) return;
    const ctx = canvasEl.getContext('2d');
    const w = canvasEl.width;
    const h = canvasEl.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#2a1d12';
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.fillRect(2, 2, w - 4, h - 4);
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(1.6, 1.6);
    this._drawGlyph(ctx, def, 0, 1);
    ctx.restore();
  }

  _drawCreep(c, s) {
    const ctx = this.ctx;
    const base = this.creepsCfg[c.defId];
    const isAir = c.type === 'air';
    const y = isAir ? c.y - AIR_LIFT : c.y;
    const slowed = c.slowFactor < 1 && c.slowUntil > s.time;
    const poisoned = (c.poisonUntil || 0) > s.time;

    // Everything casts a shadow on the sand: air units a soft far one (they
    // fly), ground units a tight contact shadow at their feet.
    if (isAir) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 6, c.radius * 0.9, c.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.beginPath();
      ctx.ellipse(c.x + 1, y + c.radius * 0.72, c.radius * 0.85, c.radius * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // body: radial shading from a top-left light gives the silhouette volume
    const shade = ctx.createRadialGradient(
      c.x - c.radius * 0.35, y - c.radius * 0.4, c.radius * 0.15,
      c.x, y, c.radius * 1.05);
    shade.addColorStop(0, this._lighten(base.color, 0.4));
    shade.addColorStop(0.55, base.color);
    shade.addColorStop(1, this._lighten(base.color, -0.4));
    ctx.fillStyle = shade;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (isAir) {
      ctx.moveTo(c.x, y - c.radius); ctx.lineTo(c.x + c.radius, y);
      ctx.lineTo(c.x, y + c.radius); ctx.lineTo(c.x - c.radius, y);
      ctx.closePath();
    } else {
      ctx.arc(c.x, y, c.radius, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();

    // specular glint
    ctx.fillStyle = 'rgba(255,245,215,0.28)';
    ctx.beginPath();
    ctx.ellipse(c.x - c.radius * 0.32, y - c.radius * 0.42, c.radius * 0.28, c.radius * 0.18,
      -Math.PI / 5, 0, Math.PI * 2);
    ctx.fill();

    // hp bar
    const hpW = Math.max(24, c.radius * 2.6);
    const hpX = c.x - hpW / 2;
    const hpY = y - c.radius - 11;
    ctx.fillStyle = 'rgba(20,10,6,0.75)';
    ctx.fillRect(hpX, hpY, hpW, 4);
    ctx.fillStyle = c.boss ? '#ffcf66' : '#85d36b';
    ctx.fillRect(hpX, hpY, hpW * Math.max(0, Math.min(1, c.hp / c.maxHp)), 4);
    ctx.strokeStyle = 'rgba(255,230,170,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hpX, hpY, hpW, 4);

    // status rings
    if (c.boss) {
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, y, c.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (slowed) {
      ctx.strokeStyle = 'rgba(110,198,230,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, y, c.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (poisoned) {
      ctx.strokeStyle = 'rgba(125,162,65,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, y, c.radius + (slowed ? 5 : 2), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawEffects(dtReal) {
    const ctx = this.ctx;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.age += dtReal;
      if (e.age >= e.ttl) {
        this.effects.splice(i, 1);
        continue;
      }
      const k = e.age / e.ttl;
      if (e.kind === 'spark') {
        // ballistic sparks: drift outward, fall, fade
        e.x += e.vx * dtReal;
        e.y += e.vy * dtReal;
        e.vy += 150 * dtReal; // gravity
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = e.colour;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * (1 - k * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (e.kind === 'bolt') {
        // chain lightning arc: two-segment zigzag with a perpendicular kink
        const mx = (e.x1 + e.x2) / 2;
        const my = (e.y1 + e.y2) / 2;
        const dx = e.x2 - e.x1;
        const dy = e.y2 - e.y1;
        const len = Math.hypot(dx, dy) || 1;
        const off = 6 * (1 - k);
        const kx = mx - (dy / len) * off;
        const ky = my + (dx / len) * off;
        ctx.strokeStyle = `rgba(143,208,255,${1 - k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x1, e.y1);
        ctx.lineTo(kx, ky);
        ctx.lineTo(e.x2, e.y2);
        ctx.stroke();
      } else if (e.kind === 'ring') {
        ctx.strokeStyle = `rgba(226,112,58,${1 - k})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 8 + (e.radius - 8) * k, 0, Math.PI * 2);
        ctx.stroke();
      } else if (e.kind === 'text') {
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = e.color;
        ctx.font = e.big ? '700 18px "Segoe UI", system-ui, sans-serif' : '700 12px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(e.text, e.x, e.y + e.vy * e.age);
        ctx.restore();
      } else if (e.kind === 'flash') {
        ctx.save();
        ctx.fillStyle = `rgba(220,50,50,${0.18 * (1 - k)})`;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
      }
    }
  }
}
