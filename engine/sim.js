// Simulation module: deterministic game state, economy, towers, creeps and combat.
// Deterministic fixed-timestep simulation. No DOM/Canvas/random access here —
// the renderer only reads state, commands come in through public methods.
// This separation is the foundation for future multiplayer and headless tests.
class Simulation {
  constructor(configs) {
    this.cfg = configs.game;
    this.map = configs.map;
    this.towersCfg = configs.towers;
    this.creepsCfg = configs.creeps;
    this.waves = configs.waves;
    this.difficulty = configs.difficulty || { hpMul: 1 };
    this.path = buildPath(configs.map);
    this.dt = 1 / this.cfg.tickRate;

    // 0.11.0: endless mode (procedural waves past the scripted list) and
    // challenge modifiers (data flags, no engine forks). Both optional.
    this.endless = !!configs.endless;
    this.modifiers = configs.modifiers || {};
    this._goldMul = this.modifiers.goldMul != null ? this.modifiers.goldMul : 1;
    this._speedMul = this.modifiers.creepSpeedMul != null ? this.modifiers.creepSpeedMul : 1;

    this.state = {
      tick: 0,
      time: 0,
      gold: Math.round((this.difficulty.startGold != null ? this.difficulty.startGold : this.cfg.startGold) * this._goldMul),
      lives: this.difficulty.startLives != null ? this.difficulty.startLives : this.cfg.startLives,
      phase: 'build',              // 'build' | 'wave' | 'victory' | 'defeat'
      waveIndex: 0,                // during 'build': next wave; during 'wave': current wave
      waveTimer: this.cfg.firstWaveDelay,
      creeps: [],
      towers: [],
      projectiles: [],
      spawns: [],                  // pending spawns: { at, group, flags }
      nextId: 1,
      events: [],                  // transient events emitted during the last step
      // run statistics (persisted in saves, shown on the results screen)
      totalKills: 0,
      totalLeaks: 0,
      goldEarned: 0,
      goldSpent: 0,
    };
  }

  isOver() {
    return this.state.phase === 'victory' || this.state.phase === 'defeat';
  }

  // Save/load support: state is plain data, so a deep copy is a valid snapshot.
  exportState() {
    return JSON.parse(JSON.stringify(Object.assign({}, this.state, { events: [] })));
  }

  importState(snapshot) {
    this.state = JSON.parse(JSON.stringify(snapshot));
    this.state.events = [];
  }

  // ---------------------------------------------------------------- commands

  canPlace(col, row) {
    if (col < 0 || row < 0 || col >= this.map.cols || row >= this.map.rows) {
      return { ok: false, error: 'bounds' };
    }
    if (this.path.isRoadCell(col, row)) return { ok: false, error: 'road' };
    if (this.state.towers.some(t => t.col === col && t.row === row)) {
      return { ok: false, error: 'occupied' };
    }
    return { ok: true };
  }

  towerAt(col, row) {
    return this.state.towers.find(t => t.col === col && t.row === row) || null;
  }

  getTower(id) {
    return this.state.towers.find(t => t.id === id) || null;
  }

  towersOfType(typeId) {
    return this.state.towers.filter(t => t.typeId === typeId);
  }

  build(typeId, col, row) {
    const s = this.state;
    if (this.isOver()) return { ok: false, error: 'over' };
    const def = this.towersCfg[typeId];
    if (!def) return { ok: false, error: 'unknown' };
    if (this.modifiers.oneTowerPerType && this.towersOfType(typeId).length >= 1) {
      return { ok: false, error: 'onePerType' };
    }
    const place = this.canPlace(col, row);
    if (!place.ok) return place;
    const cost = def.levels[0].cost;
    if (s.gold < cost) return { ok: false, error: 'gold' };
    s.gold -= cost;
    s.goldSpent += cost;
    const cs = this.map.cellSize;
    s.towers.push({
      id: s.nextId++,
      typeId,
      level: 0,
      col,
      row,
      x: col * cs + cs / 2,
      y: row * cs + cs / 2,
      cooldownLeft: 0,
      invested: cost,
      kills: 0,
    });
    return { ok: true };
  }

  upgrade(towerId) {
    const s = this.state;
    if (this.isOver()) return { ok: false, error: 'over' };
    const t = this.getTower(towerId);
    if (!t) return { ok: false, error: 'unknown' };
    const def = this.towersCfg[t.typeId];
    if (t.level >= def.levels.length - 1) return { ok: false, error: 'maxlevel' };
    const cost = def.levels[t.level + 1].cost;
    if (s.gold < cost) return { ok: false, error: 'gold' };
    s.gold -= cost;
    s.goldSpent += cost;
    t.level++;
    t.invested += cost;
    return { ok: true };
  }

  // Upgrade every tower of the type by one level while gold lasts,
  // cheapest upgrades first (deterministic tie-break by tower id).
  upgradeAllOfType(typeId) {
    const s = this.state;
    if (this.isOver()) return { ok: false, error: 'over' };
    const def = this.towersCfg[typeId];
    if (!def) return { ok: false, error: 'unknown' };
    const maxLevel = def.levels.length - 1;
    let upgraded = 0;
    let spent = 0;
    for (;;) {
      const cands = s.towers.filter(t => t.typeId === typeId && t.level < maxLevel);
      if (cands.length === 0) break;
      cands.sort((a, b) =>
        (def.levels[a.level + 1].cost - def.levels[b.level + 1].cost) || (a.id - b.id));
      const t = cands[0];
      const cost = def.levels[t.level + 1].cost;
      if (s.gold < cost) break;
      s.gold -= cost;
      s.goldSpent += cost;
      t.level++;
      t.invested += cost;
      upgraded++;
      spent += cost;
    }
    if (upgraded === 0) {
      const anyLeft = s.towers.some(t => t.typeId === typeId && t.level < maxLevel);
      return { ok: false, error: anyLeft ? 'gold' : 'maxlevel' };
    }
    return { ok: true, upgraded, spent };
  }

  // What upgradeAllOfType() would do right now, without doing it: how many
  // towers are still below max level and what taking them all to max costs.
  // Read-only and deterministic — safe for the UI to poll every frame.
  upgradeAllInfo(typeId) {
    const def = this.towersCfg[typeId];
    if (!def) return { towers: 0, cost: 0 };
    const maxLevel = def.levels.length - 1;
    let towers = 0;
    let cost = 0;
    for (const t of this.state.towers) {
      if (t.typeId !== typeId || t.level >= maxLevel) continue;
      towers++;
      for (let lv = t.level + 1; lv <= maxLevel; lv++) cost += def.levels[lv].cost;
    }
    return { towers, cost };
  }

  sell(towerId) {
    const s = this.state;
    if (this.isOver()) return { ok: false, error: 'over' };
    if (this.modifiers.noSell) return { ok: false, error: 'noSell' };
    const idx = s.towers.findIndex(t => t.id === towerId);
    if (idx < 0) return { ok: false, error: 'unknown' };
    const refund = Math.floor(s.towers[idx].invested * this.cfg.sellRatio);
    s.gold += refund;
    s.towers.splice(idx, 1);
    return { ok: true, refund };
  }

  // Sell every tower of the type at once.
  sellAllOfType(typeId) {
    const s = this.state;
    if (this.isOver()) return { ok: false, error: 'over' };
    if (this.modifiers.noSell) return { ok: false, error: 'noSell' };
    const list = s.towers.filter(t => t.typeId === typeId);
    if (list.length === 0) return { ok: false, error: 'unknown' };
    let refund = 0;
    for (const t of list) refund += Math.floor(t.invested * this.cfg.sellRatio);
    s.towers = s.towers.filter(t => t.typeId !== typeId);
    s.gold += refund;
    return { ok: true, sold: list.length, refund };
  }

  sellRefund(towerId) {
    const t = this.getTower(towerId);
    return t ? Math.floor(t.invested * this.cfg.sellRatio) : 0;
  }

  sellAllRefund(typeId) {
    let refund = 0;
    for (const t of this.towersOfType(typeId)) {
      refund += Math.floor(t.invested * this.cfg.sellRatio);
    }
    return refund;
  }

  // Wave descriptor at a given index: scripted waves come from data/, past
  // the end of that list an endless run generates one procedurally.
  _waveAt(index) {
    if (index < this.waves.length) return this.waves[index];
    return this.endless ? this._genEndlessWave(index) : null;
  }

  // Deterministic procedural wave for endless mode: pure function of the
  // wave index and the version's own data (no Math.random, no engine fork).
  // Seeds difficulty from the last scripted "regular" wave so it continues
  // the curve instead of resetting to wave-1 strength.
  _genEndlessWave(index) {
    if (!this._endlessSeed) {
      const seedWave = this.waves[this.waves.length - 2] || this.waves[this.waves.length - 1];
      this._endlessSeed = {
        hp: Math.max(...seedWave.groups.map(g => g.hp)),
        bounty: Math.max(...seedWave.groups.map(g => g.bounty)),
      };
    }
    const extra = index - this.waves.length; // 0, 1, 2, ... waves past the script
    const growth = Math.pow(1.07, extra + 1);
    const bossIds = Object.keys(this.creepsCfg).filter(id => this.creepsCfg[id].boss).sort();
    if (bossIds.length > 0 && extra % 6 === 5) {
      const bossId = bossIds[Math.floor(extra / 6) % bossIds.length];
      return {
        name: `Эндлесс: волна ${index + 1}`, boss: true,
        bonus: Math.round(this._endlessSeed.bounty * growth * 6),
        groups: [{
          creep: bossId, count: 1, interval: 1.0,
          hp: Math.round(this._endlessSeed.hp * growth * 3),
          bounty: Math.round(this._endlessSeed.bounty * growth * 8),
          armor: Math.min(24, 8 + Math.floor(extra / 6)),
        }],
      };
    }
    const ids = Object.keys(this.creepsCfg).filter(id => !this.creepsCfg[id].boss).sort();
    const creepId = ids[extra % ids.length];
    return {
      name: `Эндлесс: волна ${index + 1}`,
      bonus: Math.round(this._endlessSeed.bounty * growth * 1.5),
      immuneToSlow: extra % 4 === 3,
      regen: extra % 7 === 6 ? Math.round(6 * growth) : 0,
      groups: [{
        creep: creepId, count: 10 + Math.floor(extra / 2),
        interval: Math.max(0.35, 0.8 - extra * 0.005),
        hp: Math.round(this._endlessSeed.hp * growth * (0.5 + 0.1 * (extra % ids.length))),
        bounty: Math.max(2, Math.round(this._endlessSeed.bounty * growth * 0.3)),
        armor: creepId === 'bulwark' ? Math.min(20, 2 + Math.floor(extra / 3)) : 0,
      }],
    };
  }

  startWave() {
    const s = this.state;
    if (s.phase !== 'build') return { ok: false, error: 'phase' };
    const wave = this._waveAt(s.waveIndex);
    if (!wave) return { ok: false, error: 'nowave' };
    s.phase = 'wave';
    // Special-wave flags travel with each pending spawn (data-driven).
    const flags = {
      immuneToSlow: !!wave.immuneToSlow,
      regen: wave.regen || 0,
      extra: !!wave.extra,
    };
    for (const group of wave.groups) {
      for (let i = 0; i < group.count; i++) {
        s.spawns.push({ at: s.time + i * group.interval, group, flags });
      }
    }
    s.spawns.sort((a, b) => a.at - b.at);
    s.events.push({ type: 'waveStart', wave: s.waveIndex });
    return { ok: true };
  }

  // -------------------------------------------------------------------- step

  step() {
    const s = this.state;
    if (this.isOver()) return;
    s.events = [];
    s.tick++;
    s.time += this.dt;

    if (s.phase === 'build' && this.cfg.autoStartWaves !== false) {
      s.waveTimer -= this.dt;
      if (s.waveTimer <= 0) this.startWave();
    }
    if (s.phase === 'wave') this._processSpawns();

    this._updateCreeps();
    if (this.isOver()) return;
    this._updateTowers();
    this._updateProjectiles();
    this._checkWaveEnd();
  }

  _processSpawns() {
    const s = this.state;
    while (s.spawns.length > 0 && s.spawns[0].at <= s.time) {
      const { group, flags } = s.spawns.shift();
      const base = this.creepsCfg[group.creep];
      const start = this.path.posAt(0);
      const hp = Math.round(group.hp * (this.difficulty.hpMul || 1));
      const extra = flags && flags.extra;
      s.creeps.push({
        id: s.nextId++,
        defId: group.creep,
        name: base.name,
        type: base.type,
        boss: !!base.boss,
        x: start.x,
        y: start.y,
        progress: 0,
        hp,
        maxHp: hp,
        baseSpeed: base.speed * (group.speedMul || 1),
        bounty: Math.round((extra ? group.bounty * 2 : group.bounty) * this._goldMul), // bonus wave pays double
        armor: group.armor || 0,
        livesCost: base.livesCost,
        radius: base.radius,
        slowCap: base.slowCap || 0,
        slowFactor: 1,
        slowUntil: 0,
        poisonDps: 0,
        poisonUntil: 0,
        poisonTowerId: 0,
        immuneToSlow: !!(flags && flags.immuneToSlow),
        regen: (flags && flags.regen) || 0,
        noLivesLoss: !!extra,
      });
    }
  }

  _updateCreeps() {
    const s = this.state;
    for (let i = s.creeps.length - 1; i >= 0; i--) {
      const c = s.creeps[i];

      // poison damage over time (ignores armor)
      if ((c.poisonUntil || 0) > s.time && (c.poisonDps || 0) > 0) {
        c.hp -= c.poisonDps * this.dt;
        if (c.hp <= 0) {
          this._killCreep(c, c.poisonTowerId);
          continue;
        }
      }
      // regeneration (special waves)
      if ((c.regen || 0) > 0 && c.hp < c.maxHp) {
        c.hp = Math.min(c.maxHp, c.hp + c.regen * this.dt);
      }

      const slowed = s.time < c.slowUntil;
      const speed = c.baseSpeed * (slowed ? c.slowFactor : 1) * this._speedMul;
      c.progress += speed * this.dt;
      if (c.progress >= this.path.totalLength) {
        s.creeps.splice(i, 1);
        if (c.noLivesLoss) {
          // bonus wave: escaping creeps cost nothing
          s.events.push({ type: 'escape', x: c.x, y: c.y });
        } else {
          s.lives -= c.livesCost;
          s.totalLeaks++;
          s.events.push({ type: 'leak', livesCost: c.livesCost, x: c.x, y: c.y });
          if (s.lives <= 0) {
            s.lives = 0;
            s.phase = 'defeat';
            s.events.push({ type: 'defeat' });
            return;
          }
        }
      } else {
        const p = this.path.posAt(c.progress);
        c.x = p.x;
        c.y = p.y;
      }
    }
  }

  _updateTowers() {
    const s = this.state;
    for (const t of s.towers) {
      t.cooldownLeft = Math.max(0, t.cooldownLeft - this.dt);
      if (t.cooldownLeft > 0) continue;
      const def = this.towersCfg[t.typeId];
      const lvl = def.levels[t.level];
      const r2 = lvl.range * lvl.range;

      // collect valid targets in range, ordered by path progress (front first)
      const targets = [];
      for (const c of s.creeps) {
        if (!def.targets.includes(c.type)) continue;
        const dx = c.x - t.x;
        const dy = c.y - t.y;
        if (dx * dx + dy * dy > r2) continue;
        targets.push(c);
      }
      if (targets.length === 0) continue;
      targets.sort((a, b) => b.progress - a.progress);

      const shots = Math.min(lvl.shots || 1, targets.length); // multishot volley
      t.cooldownLeft = lvl.cooldown;
      for (let i = 0; i < shots; i++) {
        const best = targets[i];
        s.projectiles.push({
          id: s.nextId++,
          x: t.x,
          y: t.y,
          targetId: best.id,
          lastX: best.x,
          lastY: best.y,
          speed: def.projectileSpeed,
          damage: lvl.damage,
          splash: lvl.splash || 0,
          slowFactor: lvl.slowFactor || 0,
          slowDuration: lvl.slowDuration || 0,
          poisonDps: lvl.poisonDps || 0,
          poisonDuration: lvl.poisonDuration || 0,
          chain: lvl.chain || 0,
          chainRange: lvl.chainRange || 0,
          targets: def.targets,
          typeId: t.typeId,
          towerId: t.id,
        });
      }
      s.events.push({ type: 'shot', towerId: t.id, x: t.x, y: t.y, shots });
    }
  }

  _updateProjectiles() {
    const s = this.state;
    for (let i = s.projectiles.length - 1; i >= 0; i--) {
      const p = s.projectiles[i];
      const target = s.creeps.find(c => c.id === p.targetId) || null;
      if (target) {
        p.lastX = target.x;
        p.lastY = target.y;
      }
      const dx = p.lastX - p.x;
      const dy = p.lastY - p.y;
      const dist = Math.hypot(dx, dy);
      const stepLen = p.speed * this.dt;
      if (dist <= stepLen) {
        s.projectiles.splice(i, 1);
        this._impact(p, target);
      } else {
        p.x += (dx / dist) * stepLen;
        p.y += (dy / dist) * stepLen;
      }
    }
  }

  _impact(p, target) {
    const s = this.state;
    if (p.splash > 0) {
      s.events.push({ type: 'explosion', x: p.lastX, y: p.lastY, radius: p.splash });
      const r2 = p.splash * p.splash;
      for (let j = s.creeps.length - 1; j >= 0; j--) {
        const c = s.creeps[j];
        if (!p.targets.includes(c.type)) continue;
        const dx = c.x - p.lastX;
        const dy = c.y - p.lastY;
        if (dx * dx + dy * dy <= r2) this._damage(c, p);
      }
    } else if (target) {
      this._damage(target, p);
      if (p.chain > 0) this._chainJumps(p, target);
    }
  }

  // Chain lightning: after the first hit the bolt jumps to the nearest
  // not-yet-hit valid creep within chainRange, losing 30% damage per jump.
  // Nearest-target choice is deterministic (strict < keeps array order on ties).
  _chainJumps(p, firstTarget) {
    const s = this.state;
    const hitIds = new Set([firstTarget.id]);
    let from = { id: firstTarget.id, x: firstTarget.x, y: firstTarget.y };
    let damage = p.damage;
    const r2 = p.chainRange * p.chainRange;
    for (let jump = 0; jump < p.chain; jump++) {
      damage = Math.max(1, Math.round(damage * 0.7));
      let best = null;
      let bestD2 = Infinity;
      for (const c of s.creeps) {
        if (hitIds.has(c.id)) continue;
        if (!p.targets.includes(c.type)) continue;
        const dx = c.x - from.x;
        const dy = c.y - from.y;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2 && d2 < bestD2) {
          bestD2 = d2;
          best = c;
        }
      }
      if (!best) break;
      s.events.push({ type: 'chainHit', fromX: from.x, fromY: from.y, toX: best.x, toY: best.y });
      hitIds.add(best.id);
      from = { id: best.id, x: best.x, y: best.y };
      this._damage(best, Object.assign({}, p, { damage }));
    }
  }

  _damage(c, p) {
    const s = this.state;
    const dmg = Math.max(1, p.damage - c.armor);
    c.hp -= dmg;
    s.events.push({
      type: 'hit', creepId: c.id, creepType: c.type, damage: dmg,
      source: p.typeId, projectileId: p.id, x: c.x, y: c.y,
    });
    if (p.slowFactor > 0 && !c.immuneToSlow) {
      const factor = Math.max(p.slowFactor, c.slowCap); // bosses resist slow
      if (s.time >= c.slowUntil) {
        c.slowFactor = factor;
      } else {
        c.slowFactor = Math.min(c.slowFactor, factor);
      }
      c.slowUntil = Math.max(c.slowUntil, s.time + p.slowDuration);
    }
    if (p.poisonDps > 0) {
      // strongest poison wins, duration refreshes
      const active = (c.poisonUntil || 0) > s.time;
      if (!active || p.poisonDps >= (c.poisonDps || 0)) {
        c.poisonDps = p.poisonDps;
        c.poisonTowerId = p.towerId;
      }
      c.poisonUntil = Math.max(c.poisonUntil || 0, s.time + p.poisonDuration);
    }
    if (c.hp <= 0) this._killCreep(c, p.towerId);
  }

  _killCreep(c, towerId) {
    const s = this.state;
    const idx = s.creeps.indexOf(c);
    if (idx < 0) return; // already removed
    s.creeps.splice(idx, 1);
    s.gold += c.bounty;
    s.goldEarned += c.bounty;
    s.totalKills++;
    const tower = this.getTower(towerId);
    if (tower) tower.kills++;
    s.events.push({ type: 'kill', x: c.x, y: c.y, bounty: c.bounty });
  }

  _checkWaveEnd() {
    const s = this.state;
    if (s.phase !== 'wave') return;
    if (s.spawns.length > 0 || s.creeps.length > 0) return;
    const wave = this._waveAt(s.waveIndex);
    const bonus = Math.round(wave.bonus * this._goldMul);
    s.gold += bonus;
    s.goldEarned += bonus;
    s.events.push({ type: 'waveEnd', wave: s.waveIndex, bonus });
    s.waveIndex++;
    if (!this.endless && s.waveIndex >= this.waves.length) {
      s.phase = 'victory';
      s.events.push({ type: 'victory' });
    } else {
      s.phase = 'build';
      s.waveTimer = this.cfg.betweenWavesDelay;
    }
  }
}
