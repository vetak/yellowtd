// Renderer module: draws battlefield state, towers, creeps and visual indicators.
// Pure 2D canvas renderer. Reads simulation state, never mutates it.
// Owns purely visual effects (rings, floating texts) fed by sim events.
const AIR_LIFT = 10; // air creeps are drawn slightly above their logical position

class Renderer {
  constructor(canvas, configs) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = configs.map;
    this.towersCfg = configs.towers;
    this.creepsCfg = configs.creeps;
    this.effects = [];
    this.showFloatingText = true; // user setting, applied by main.js
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
  }

  ingestEvents(events) {
    for (const ev of events) {
      if (ev.type === 'kill') {
        if (this.showFloatingText) {
          this.effects.push({ kind: 'text', text: '+' + ev.bounty, x: ev.x, y: ev.y - 12, color: '#ffd76a', age: 0, ttl: 0.9, vy: -28 });
        }
      } else if (ev.type === 'leak') {
        if (this.showFloatingText) {
          this.effects.push({ kind: 'text', text: '-' + ev.livesCost, x: ev.x - 14, y: ev.y - 10, color: '#ff6b6b', age: 0, ttl: 1.0, vy: -20 });
        }
        this.effects.push({ kind: 'flash', age: 0, ttl: 0.3 });
      } else if (ev.type === 'explosion') {
        this.effects.push({ kind: 'ring', x: ev.x, y: ev.y, radius: ev.radius, age: 0, ttl: 0.35 });
      } else if (ev.type === 'chainHit') {
        this.effects.push({ kind: 'bolt', x1: ev.fromX, y1: ev.fromY, x2: ev.toX, y2: ev.toY, age: 0, ttl: 0.18 });
      } else if (ev.type === 'waveEnd') {
        this.effects.push({ kind: 'text', text: 'Бонус за волну +' + ev.bonus, x: this.canvas.width / 2, y: 40, color: '#e6c832', age: 0, ttl: 1.6, vy: -12, big: true });
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
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.splash > 0 ? 5 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    this._drawEffects(dtReal);
  }

  // Static desert board: background, grid, road.
  _drawBoard(path) {
    const ctx = this.ctx;
    const cs = this.map.cellSize;
    const W = this.canvas.width;
    const H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#24190d');
    bg.addColorStop(1, '#120c06');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,236,190,0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < this.map.cols; c++) { ctx.moveTo(c * cs + 0.5, 0); ctx.lineTo(c * cs + 0.5, H); }
    for (let r = 1; r < this.map.rows; r++) { ctx.moveTo(0, r * cs + 0.5); ctx.lineTo(W, r * cs + 0.5); }
    ctx.stroke();
    for (const key of path.cells) {
      const [c, r] = key.split(',').map(Number);
      ctx.fillStyle = '#9c7540';
      ctx.fillRect(c * cs, r * cs, cs, cs);
      ctx.strokeStyle = 'rgba(255,220,132,0.16)';
      ctx.strokeRect(c * cs + 1, r * cs + 1, cs - 2, cs - 2);
    }
    ctx.strokeStyle = '#d8b14a';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    const pts = path.points;
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();

    // entry / exit markers
    const entry = path.posAt(0.0001);
    ctx.fillStyle = '#e6c832';
    ctx.beginPath();
    ctx.moveTo(4, entry.y - 12); ctx.lineTo(22, entry.y); ctx.lineTo(4, entry.y + 12);
    ctx.closePath();
    ctx.fill();
    const exit = pts[pts.length - 1];
    const exitX = Math.min(exit.x, W - 8);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(exitX - 6, exit.y - 16, 8, 32);
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

  _drawTower(t, highlighted) {
    const ctx = this.ctx;
    const def = this.towersCfg[t.typeId];
    const cs = this.map.cellSize;
    const x = t.x;
    const y = t.y;
    const half = cs / 2 - 5;

    // base
    ctx.fillStyle = '#2a1d12';
    ctx.strokeStyle = highlighted ? '#ffffff' : def.color;
    ctx.lineWidth = 2;
    ctx.fillRect(x - half, y - half, half * 2, half * 2);
    ctx.strokeRect(x - half, y - half, half * 2, half * 2);

    // glyph
    this._drawGlyph(ctx, def, x, y);

    // level pips
    ctx.fillStyle = '#f7e3a2';
    for (let i = 0; i <= (t.level || 0); i++) {
      ctx.beginPath();
      ctx.arc(x - 10 + i * 6, y + half - 4, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
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

    if (isAir) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 6, c.radius * 0.9, c.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = base.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
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
      if (e.kind === 'bolt') {
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
