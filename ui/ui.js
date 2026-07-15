// UI module: HUD, build panel, tower actions, tooltips and player input.
// DOM-based in-game UI: panels, build buttons, tooltips, input handling.
// Reads sim state each frame; sends commands (build/upgrade/sell/startWave) to the sim.
const ERROR_TEXT = {
  gold: 'Не хватает золота',
  occupied: 'Клетка занята',
  road: 'Нельзя строить на дороге',
  bounds: 'Вне карты',
  maxlevel: 'Уже максимальный уровень',
  phase: 'Волна уже идёт',
  over: 'Игра окончена',
  noSell: 'Испытание «Без продажи»: продажа отключена',
  onePerType: 'Испытание «Одна башня на тип»: этот тип уже построен',
  notyet: 'Ещё рано отправлять следующую волну',
  toomanywaves: 'В поле уже две волны — дождитесь, пока одна закончится',
};

const TARGET_LABEL = { ground: 'земля', air: 'воздух' };

// Upcoming-waves timeline: how many waves ahead to show, and the marker each
// special wave kind gets on its chip.
const TIMELINE_LENGTH = 8;
const TIMELINE_ICON = {
  air: '✈', boss: '☠', hero: '★', immune: '◆', regen: '✚', extra: '$',
};
// Human-readable status names, spelled out in the timeline chip's hover title
// so the tiny icons are self-explanatory (e.g. "5. Пыльный рой (воздух)").
const TIMELINE_KIND_LABEL = {
  air: 'воздух', boss: 'босс', hero: 'герой', immune: 'иммун', regen: 'реген', extra: 'бонус',
};

class UI {
  constructor(opts) {
    this.canvas = opts.canvas;
    this.renderer = opts.renderer;
    this.loop = opts.loop;              // { paused, speed }
    this.getSim = opts.getSim;
    this.restartGame = opts.restart;
    this.onOpenMenu = opts.onOpenMenu;          // pause menu
    this.onMainMenu = opts.onMainMenu || opts.onOpenMenu; // main menu (game over)
    this.isActive = opts.isActive;      // () => game is running (not in menu)
    this.isNewRecord = opts.isNewRecord || (() => false); // () => this run topped its leaderboard
    this.settings = opts.settings;      // live-updated user settings object
    this.towersCfg = opts.towers;
    this.creepsCfg = opts.creeps;
    this.wavesCfg = opts.waves;

    this.placingType = null;
    this.selectedTowerId = null;
    this.hoverTowerId = null;
    this.hoverCreepId = null;
    this.mouse = { x: 0, y: 0, over: false };
    this.message = { text: '', until: 0 };
    this._cache = {};

    this.el = {};
    for (const id of [
      'gold-value', 'lives-value', 'wave-value', 'wave-name', 'wave-desc',
      'wave-timeline', 'wave-timer', 'send-wave-btn', 'build-buttons', 'info-panel', 'controls',
      'pause-btn', 'menu-btn', 'message', 'overlay', 'overlay-title',
      'overlay-text', 'overlay-stats', 'restart-btn', 'overlay-menu-btn', 'tooltip',
      'board-scroll', 'zoom-in', 'zoom-out', 'zoom-fit',
    ]) {
      this.el[id] = document.getElementById(id);
    }

    // Mobile board zoom (1 = whole field fits width; up to 3 = zoom in for
    // finger-precise building, pan by scrolling the board container).
    this.zoom = 1;

    this._buildButtons();
    this._bindEvents();
  }

  // Swap in another map version's configs and rebuild the build panel.
  setVersion(version) {
    this.towersCfg = version.towers;
    this.creepsCfg = version.creeps;
    this.wavesCfg = version.waves;
    this.el['build-buttons'].innerHTML = '';
    this._buildButtons();
  }

  reset() {
    this.placingType = null;
    this.selectedTowerId = null;
    this.hoverTowerId = null;
    this.hoverCreepId = null;
    this._cache = {};
    this._wavePanelSig = null;   // invalidate the memoised wave panel / timeline
    this._timelineFrom = null;
    this._timelineWaves = null;
    this._setZoom(1); // new game starts showing the whole field
    this.el['overlay'].classList.add('hidden');
  }

  viewState() {
    return {
      placingType: this.placingType,
      cell: this.mouse.over ? this._cellAt(this.mouse.x, this.mouse.y) : null,
      selectedTowerId: this.selectedTowerId,
      hoverTowerId: this.settings.rangeOnHover ? this.hoverTowerId : null,
    };
  }

  // ------------------------------------------------------------- DOM setup

  _buildButtons() {
    const wrap = this.el['build-buttons'];
    this.buildBtns = {};
    for (const [typeId, def] of Object.entries(this.towersCfg)) {
      const btn = document.createElement('button');
      btn.className = 'build-btn';
      btn.dataset.type = typeId;
      btn.innerHTML =
        `<span class="swatch" style="background:${def.color}"></span>` +
        `<span class="bname">${def.name}</span>` +
        `<span class="bcost">${def.levels[0].cost} з.</span>` +
        `<span class="bkey">[${def.hotkey}]</span>`;
      btn.addEventListener('click', () => {
        if (this.isActive()) this._togglePlacing(typeId);
      });
      btn.addEventListener('mouseenter', e => this._showTooltip(this._towerTooltip(typeId), e.clientX, e.clientY));
      btn.addEventListener('mousemove', e => this._moveTooltip(e.clientX, e.clientY));
      btn.addEventListener('mouseleave', () => this._hideTooltip());
      wrap.appendChild(btn);
      this.buildBtns[typeId] = btn;
    }
  }

  _bindEvents() {
    const canvas = this.canvas;
    canvas.addEventListener('mousemove', e => {
      if (!this.isActive()) return;
      const p = this._canvasPos(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.over = true;
      this._updateHover(e.clientX, e.clientY);
    });
    canvas.addEventListener('mouseleave', () => {
      this.mouse.over = false;
      this.hoverTowerId = null;
      this.hoverCreepId = null;
      this._hideTooltip();
    });
    // Press-and-hold to inspect. Touch has no hover, so holding still on the
    // battlefield pops the info tooltip for the creep/tower under the point
    // (HP, armor, level…). Works with the mouse too. A fired hold suppresses the
    // click that follows so it doesn't also build/select. Panning (a moved
    // finger) cancels the hold, so it never fights with scroll-to-pan.
    let holdTimer = null, holdFired = false, holdStart = null;
    const clearHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
    canvas.addEventListener('pointerdown', e => {
      if (!this.isActive()) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this._hideTooltip();
      this.hoverCreepId = null;
      holdFired = false;
      holdStart = { x: e.clientX, y: e.clientY };
      const p = this._canvasPos(e);
      // Capture what's under the point NOW: a creep can walk out from under the
      // finger during the hold delay, so remember it by id and follow it when
      // the hold fires (towers are static, so id works for them too).
      const sim = this.getSim();
      const hit = sim ? this.renderer.pickAt(p.x, p.y, sim) : null;
      const creepId = hit && hit.creep ? hit.creep.id : null;
      const towerId = hit && hit.tower ? hit.tower.id : null;
      const cx = e.clientX, cy = e.clientY;
      clearHold();
      holdTimer = setTimeout(() => {
        holdTimer = null;
        holdFired = true;
        this._inspectHold(creepId, towerId, cx, cy);
      }, 450);
    });
    canvas.addEventListener('pointermove', e => {
      if (holdStart && Math.hypot(e.clientX - holdStart.x, e.clientY - holdStart.y) > 12) {
        clearHold(); // finger moved: it's a pan/drag, not a long-press
        holdStart = null;
      }
    });
    canvas.addEventListener('pointerup', () => { clearHold(); holdStart = null; });
    canvas.addEventListener('pointercancel', () => { clearHold(); holdStart = null; });

    canvas.addEventListener('click', e => {
      if (!this.isActive()) return;
      if (holdFired) { holdFired = false; return; } // long-press: don't build/select
      const p = this._canvasPos(e);
      this._onCanvasClick(p.x, p.y, e.shiftKey || e.ctrlKey);
    });
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.placingType = null;
      this.selectedTowerId = null;
    });

    this.el['send-wave-btn'].addEventListener('click', () => {
      if (!this.isActive()) return;
      const r = this.getSim().startWave();
      if (!r.ok) this._notify(r.error);
    });
    this.el['pause-btn'].addEventListener('click', () => {
      if (this.isActive()) this._togglePause();
    });
    this.el['menu-btn'].addEventListener('click', () => this.onOpenMenu());
    if (this.el['zoom-in']) this.el['zoom-in'].addEventListener('click', () => this._setZoom(this.zoom + 0.5));
    if (this.el['zoom-out']) this.el['zoom-out'].addEventListener('click', () => this._setZoom(this.zoom - 0.5));
    if (this.el['zoom-fit']) this.el['zoom-fit'].addEventListener('click', () => this._setZoom(1));
    this.el['restart-btn'].addEventListener('click', () => this.restartGame());
    this.el['overlay-menu-btn'].addEventListener('click', () => this.onMainMenu());
    for (const btn of this.el['controls'].querySelectorAll('.speed-btn')) {
      btn.addEventListener('click', () => {
        this.loop.speed = Number(btn.dataset.speed);
      });
    }

    document.addEventListener('keydown', e => {
      if (!this.isActive()) return;
      if (e.code === 'Escape') {
        if (this.placingType || this.selectedTowerId) {
          this.placingType = null;
          this.selectedTowerId = null;
        } else {
          this.onOpenMenu();
        }
      } else if (e.code === 'Space') {
        e.preventDefault();
        this._togglePause();
      } else {
        for (const [typeId, def] of Object.entries(this.towersCfg)) {
          if (e.key === def.hotkey) this._togglePlacing(typeId);
        }
      }
    });
  }

  // ---------------------------------------------------------------- input

  _canvasPos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (this.canvas.width / r.width),
      y: (e.clientY - r.top) * (this.canvas.height / r.height),
    };
  }

  _cellAt(x, y) {
    const cs = this.getSim().map.cellSize;
    return { col: Math.floor(x / cs), row: Math.floor(y / cs) };
  }

  _togglePlacing(typeId) {
    this.placingType = this.placingType === typeId ? null : typeId;
    this.selectedTowerId = null;
  }

  _togglePause() {
    this.loop.paused = !this.loop.paused;
  }

  // Is the compact mobile layout active? (matches the CSS breakpoint.) Guarded
  // so it stays a safe no-op under the headless test stub (no matchMedia).
  _isMobileLayout() {
    return !!(typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(max-width: 1024px)').matches);
  }

  // Board zoom for touch play. Only affects the mobile layout, where the CSS
  // reads --board-zoom to scale the canvas width; on desktop the variable is
  // simply unused, so this is a no-op there.
  _setZoom(z) {
    this.zoom = Math.max(1, Math.min(3, Math.round(z * 2) / 2));
    if (this.el['board-scroll']) {
      this.el['board-scroll'].style.setProperty('--board-zoom', String(this.zoom));
    }
  }

  // Show the info tooltip for the creep/tower captured at press time — used by
  // press-and-hold so touch players can read enemy/tower stats without hover.
  // A creep is preferred (it's what you aimed at) and followed by id even if it
  // has since moved; update() then live-refreshes its HP and clears on death.
  _inspectHold(creepId, towerId, cx, cy) {
    const sim = this.getSim();
    if (!sim) return;
    if (creepId != null) {
      const c = sim.state.creeps.find(cr => cr.id === creepId);
      if (c) { this.hoverCreepId = c.id; this._showTooltip(this._creepTooltip(c), cx, cy); return; }
    }
    if (towerId != null) {
      const t = sim.getTower(towerId);
      if (t) {
        const def = this.towersCfg[t.typeId];
        this._showTooltip(
          `<b>${def.name}</b> — ур. ${t.level + 1}/${def.levels.length} · тап — управление`, cx, cy);
      }
    }
  }

  _onCanvasClick(x, y, keepPlacing) {
    const sim = this.getSim();
    const { col, row } = this._cellAt(x, y);
    if (this.placingType) {
      const r = sim.build(this.placingType, col, row);
      if (r.ok) {
        if (!keepPlacing) this.placingType = null;
      } else if (r.error === 'occupied') {
        this.placingType = null;
        this.selectedTowerId = sim.towerAt(col, row).id;
      } else {
        this._notify(r.error);
      }
      return;
    }
    const t = sim.towerAt(col, row);
    this.selectedTowerId = t ? t.id : null;
  }

  _updateHover(clientX, clientY) {
    const sim = this.getSim();
    const hit = this.renderer.pickAt(this.mouse.x, this.mouse.y, sim);
    this.hoverTowerId = hit && hit.tower ? hit.tower.id : null;
    this.hoverCreepId = hit && hit.creep ? hit.creep.id : null;
    if (this.hoverCreepId) {
      this._showTooltip(this._creepTooltip(hit.creep), clientX, clientY);
    } else if (this.hoverTowerId && !this.placingType) {
      const t = hit.tower;
      const def = this.towersCfg[t.typeId];
      this._showTooltip(`<b>${def.name}</b> — ур. ${t.level + 1} · клик — управление`, clientX, clientY);
    } else {
      this._hideTooltip();
    }
  }

  // -------------------------------------------------------------- tooltips

  _showTooltip(html, cx, cy) {
    const tip = this.el['tooltip'];
    tip.innerHTML = html;
    tip.classList.remove('hidden');
    this._moveTooltip(cx, cy);
  }

  _moveTooltip(cx, cy) {
    const tip = this.el['tooltip'];
    if (tip.classList.contains('hidden')) return;
    const pad = 14;
    let x = cx + pad;
    let y = cy + pad;
    const rect = tip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - 8) x = cx - rect.width - pad;
    if (y + rect.height > window.innerHeight - 8) y = cy - rect.height - pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  _hideTooltip() {
    this.el['tooltip'].classList.add('hidden');
  }

  _levelExtras(lvl) {
    const extra = [];
    if (lvl.splash) extra.push(`сплэш ${lvl.splash}`);
    if (lvl.slowFactor) extra.push(`замедление до ${Math.round(lvl.slowFactor * 100)}% на ${lvl.slowDuration} с`);
    if (lvl.poisonDps) extra.push(`яд ${lvl.poisonDps}/с на ${lvl.poisonDuration} с, игнорирует броню`);
    if (lvl.shots > 1) extra.push(`залп по ${lvl.shots} целям`);
    if (lvl.chain) extra.push(`цепная молния: до ${lvl.chain + 1} целей, -30% урона за прыжок`);
    return extra;
  }

  _towerTooltip(typeId) {
    const def = this.towersCfg[typeId];
    let rows = '';
    def.levels.forEach((lvl, i) => {
      rows += `<tr><td>Ур. ${i + 1}</td><td>${lvl.cost} з.</td><td>${lvl.damage} урон</td>` +
        `<td>${lvl.range} дальн.</td><td>${lvl.cooldown} с</td>` +
        `<td>${this._levelExtras(lvl).join(', ')}</td></tr>`;
    });
    const targets = def.targets.map(t => TARGET_LABEL[t] || t).join(' + ');
    return `<b>${def.name}</b><div class="muted">${def.role} · цели: ${targets}</div>` +
      `<table>${rows}</table>`;
  }

  _creepTooltip(c) {
    const bits = [
      `HP ${Math.max(0, Math.ceil(c.hp))}/${c.maxHp}`,
      `скорость ${Math.round(c.baseSpeed)}`,
      `награда ${c.bounty} з.`,
    ];
    if (c.armor > 0) bits.push(`броня ${c.armor}`);
    if (c.type === 'air') bits.push('ВОЗДУХ');
    if (c.boss) bits.push(`БОСС · лик стоит ${c.livesCost} жизней`);
    return `<b>${c.name}</b><div class="muted">${bits.join(' · ')}</div>`;
  }

  _notify(codeOrText) {
    this.message.text = ERROR_TEXT[codeOrText] || codeOrText;
    this.message.until = performance.now() + 2200;
    if (codeOrText === 'gold') this._shake('gold-value');
  }

  // Brief shake on a stat to draw the eye to why an action was rejected
  // (e.g. not enough gold). Purely visual — retriggerable via reflow.
  _shake(id) {
    const el = this.el[id];
    if (!el || !el.classList) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  }

  _set(id, html) {
    if (this._cache[id] !== html) {
      this._cache[id] = html;
      this.el[id].innerHTML = html;
    }
  }

  // ------------------------------------------------------- per-frame update

  update(sim) {
    if (!sim) return;
    const s = sim.state;

    this._set('gold-value', String(s.gold));
    this._set('lives-value', String(s.lives));
    const total = this.wavesCfg.length;
    const current = s.phase === 'wave' ? s.waveIndex + 1 : s.waveIndex;
    this._set('wave-value', sim.endless ? String(current) : `${Math.min(current, total)}/${total}`);

    this._updateWavePanel(sim);
    this._updateBuildButtons(s);
    this._updateInfoPanel(sim);
    this._updateControls();
    this._updateMessage();
    this._updateOverlay(sim);
    this._updateCursor();
    this._revealSelectedTower();

    // live-refresh creep tooltip hp
    if (this.hoverCreepId) {
      const c = s.creeps.find(cr => cr.id === this.hoverCreepId);
      if (c) this.el['tooltip'].innerHTML = this._creepTooltip(c);
      else { this.hoverCreepId = null; this._hideTooltip(); }
    }
  }

  // Wave descriptor by index: scripted waves come from data, endless runs
  // generate them on the fly past the scripted list.
  _waveAt(idx) {
    const sim = this.getSim();
    return this.wavesCfg[idx] || (sim && sim.endless ? sim._waveAt(idx) : null);
  }

  // Status badges (air/boss/hero/immune/regen/extra) — shared by the current
  // wave, the "next up" line and the upcoming-waves timeline.
  _waveBadges(wave) {
    const badges = [];
    if (wave.groups.some(g => (this.creepsCfg[g.creep] || {}).type === 'air')) {
      badges.push('<span class="badge air">ВОЗДУХ</span>');
    }
    if (wave.boss) badges.push('<span class="badge boss">БОСС</span>');
    if (wave.hero) badges.push('<span class="badge hero">ГЕРОЙ</span>');
    if (wave.immuneToSlow) badges.push('<span class="badge immune">ИММУН</span>');
    if (wave.regen) badges.push('<span class="badge regen">РЕГЕН</span>');
    if (wave.extra) badges.push('<span class="badge extra">БОНУС</span>');
    return badges;
  }

  // Wave summary that honours every spawn group (mixed waves included).
  _waveBrief(idx) {
    const sim = this.getSim();
    const wave = this._waveAt(idx);
    if (!wave) return '';
    const hpMul = sim && sim.difficulty ? (sim.difficulty.hpMul || 1) : 1;
    const lines = wave.groups.map(g => {
      const base = this.creepsCfg[g.creep];
      const hp = Math.round(g.hp * hpMul);
      const armor = g.armor ? ` · броня ${g.armor}` : '';
      return `<div class="muted">${g.count} × ${base.name} · HP ${hp}${armor} · ${g.bounty} з.</div>`;
    }).join('');
    return `<div class="wname">${idx + 1}. ${wave.name} ${this._waveBadges(wave).join(' ')}</div>` +
      lines +
      `<div class="muted">Бонус за волну: ${wave.bonus} з.</div>`;
  }

  // Compact one-liner for the upcoming wave: name + status badges + roster.
  // Badges matter most here — knowing AIR/BOSS is coming drives what you build.
  _waveNextBrief(idx) {
    const sim = this.getSim();
    const wave = this._waveAt(idx);
    if (!wave) return '';
    const hpMul = sim && sim.difficulty ? (sim.difficulty.hpMul || 1) : 1;
    const roster = wave.groups.map(g => {
      const base = this.creepsCfg[g.creep];
      const hp = Math.round(g.hp * hpMul);
      const armor = g.armor ? `/бр.${g.armor}` : '';
      return `${g.count}×${base.name} (HP ${hp}${armor})`;
    }).join(', ');
    return `<div class="next-brief">` +
      `<div class="wname">Далее — ${idx + 1}. ${wave.name} ${this._waveBadges(wave).join(' ')}</div>` +
      `<div class="muted">${roster}</div>` +
      `</div>`;
  }

  // Both phases render the same structure (label + full brief + next brief)
  // so the panel keeps a stable height and the button below never jumps.
  // With "Темп волн" (1.1.0) up to two waves can be live at once — the panel
  // shows the oldest as "current", the second (if any) as a compact extra
  // line, and previews whichever wave would be sent if the button is pressed.
  _updateWavePanel(sim) {
    const s = sim.state;
    const live = s.liveWaves || [];
    const primaryIdx = live.length > 0 ? live[0].index : s.waveIndex;
    // In build phase "next" previews the wave after the one being configured;
    // once a wave is live it's the wave a button press would actually send.
    const nextIdx = live.length === 0 ? s.waveIndex + 1 : s.waveIndex + live.length;

    // The wave-name block depends only on the live/upcoming wave indices and the
    // phase (HP scaling is fixed for the run), not on the per-frame countdown.
    // Rebuild its HTML only when that signature changes — the countdown and the
    // send button below still refresh every frame.
    const sig = live.length + '|' + primaryIdx + '|' +
      (live.length > 1 ? live[1].index : '') + '|' + nextIdx;
    if (sig !== this._wavePanelSig) {
      this._wavePanelSig = sig;
      const label = live.length > 0 ? 'Идёт волна:' : 'Следующая волна:';
      let html = `<div class="phase-label">${label}</div>` + this._waveBrief(primaryIdx);
      if (live.length > 1) {
        const w2 = this._waveAt(live[1].index);
        if (w2) {
          html += `<div class="next-brief"><div class="wname">Также в поле — ${live[1].index + 1}. ` +
            `${w2.name} ${this._waveBadges(w2).join(' ')}</div></div>`;
        }
      }
      html += this._waveNextBrief(nextIdx);
      this._set('wave-name', html);
    }

    const timer = live.length === 0
      ? (sim.cfg.autoStartWaves !== false
        ? `Автостарт через ${Math.ceil(s.waveTimer)} с`
        : 'Нажмите «Отправить волну»')
      : '';
    this._set('wave-timer', timer);
    this._updateSendWaveButton(sim, live);
    this._updateWaveTimeline(nextIdx);
  }

  // "Отправить волну" reflects exactly what pressing it would do right now:
  // start the first wave, wait out the early-send cooldown, show the live
  // decaying bonus once it's available, or refuse when two are already live.
  _updateSendWaveButton(sim, live) {
    const btn = this.el['send-wave-btn'];
    if (live.length === 0) {
      btn.disabled = false;
      btn.textContent = 'Отправить волну';
      return;
    }
    const maxLive = sim.cfg.maxConcurrentWaves || 1;
    if (live.length >= maxLive) {
      btn.disabled = true;
      btn.textContent = 'Отправить волну';
      return;
    }
    const elapsed = sim.state.time - live[0].startedAt;
    const minDelay = sim.cfg.earlyWaveMinDelay || 0;
    if (elapsed < minDelay) {
      btn.disabled = true;
      btn.textContent = `Досрочно через ${Math.ceil(minDelay - elapsed)} с`;
      return;
    }
    const sinceUnlock = elapsed - minDelay;
    const window = sim.cfg.earlyWaveBonusWindow || 1;
    const maxBonus = sim.cfg.earlyWaveBonusMax || 0;
    const mul = Math.max(0, maxBonus * (1 - sinceUnlock / window));
    btn.disabled = false;
    btn.textContent = mul > 0.001
      ? `Отправить досрочно (+${Math.round(mul * 100)}%)`
      : 'Отправить досрочно';
  }

  // Upcoming-waves timeline: a compact strip of the next few waves so special
  // ones (air/boss/immune) are visible several waves ahead, not as a surprise.
  _updateWaveTimeline(from) {
    // The strip depends only on the start index and the wave set (kinds are
    // difficulty-independent). Skip rebuilding its 8 chips every frame when
    // neither changed. `_timelineWaves` also invalidates on a version swap.
    if (from === this._timelineFrom && this.wavesCfg === this._timelineWaves) return;
    this._timelineFrom = from;
    this._timelineWaves = this.wavesCfg;
    const chips = [];
    for (let i = from; i < from + TIMELINE_LENGTH; i++) {
      const wave = this._waveAt(i);
      if (!wave) break;
      const kinds = [];
      if (wave.groups.some(g => (this.creepsCfg[g.creep] || {}).type === 'air')) kinds.push('air');
      if (wave.boss) kinds.push('boss');
      if (wave.hero) kinds.push('hero');
      if (wave.immuneToSlow) kinds.push('immune');
      if (wave.regen) kinds.push('regen');
      if (wave.extra) kinds.push('extra');
      const cls = kinds.length ? ' tl-' + kinds[0] : '';
      // Spell out the wave's statuses in parentheses so the hover tooltip is
      // informative (the coloured chip + icons only hint at them visually).
      const labels = kinds.map(k => TIMELINE_KIND_LABEL[k]).filter(Boolean);
      const title = `${i + 1}. ${wave.name}` + (labels.length ? ` (${labels.join(', ')})` : '');
      chips.push(`<span class="tl-chip${cls}" title="${title}">${i + 1}` +
        (kinds.length ? `<span class="tl-dots">${kinds.map(k => TIMELINE_ICON[k] || '').join('')}</span>` : '') +
        `</span>`);
    }
    this._set('wave-timeline', chips.length
      ? `<div class="tl-label">Впереди:</div><div class="tl-strip">${chips.join('')}</div>`
      : '');
  }

  _updateBuildButtons(s) {
    for (const [typeId, btn] of Object.entries(this.buildBtns)) {
      const cost = this.towersCfg[typeId].levels[0].cost;
      btn.classList.toggle('unaffordable', s.gold < cost);
      btn.classList.toggle('active', this.placingType === typeId);
    }
  }

  _updateInfoPanel(sim) {
    const s = sim.state;
    const t = this.selectedTowerId ? sim.getTower(this.selectedTowerId) : null;
    if (!t) {
      if (this.selectedTowerId) this.selectedTowerId = null;
      const keyCount = Object.keys(this.towersCfg).length;
      this._set('info-panel',
        `<div class="muted">Выберите башню (кнопки или клавиши 1–${keyCount}) и тапните по свободной клетке.` +
        ` Тап по построенной башне — улучшение и продажа. Shift/Ctrl+клик — строить несколько подряд.` +
        ` Пауза и меню — кнопки внизу панели (пробел/Esc на ПК).</div>`);
      return;
    }
    const def = this.towersCfg[t.typeId];
    const lvl = def.levels[t.level];
    const next = def.levels[t.level + 1];
    const dps = (lvl.damage / lvl.cooldown).toFixed(1);
    const extras = this._levelExtras(lvl);
    const targets = def.targets.map(x => TARGET_LABEL[x] || x).join(' + ');
    const upLabel = next ? `Улучшить — ${next.cost} з.` : 'МАКС. УРОВЕНЬ';
    const upTitle = next ? `→ ${next.damage} урона, ${next.range} дальность, ${next.cooldown} с` : '';
    // "Улучшить все" reflects what's actually left to do: how many towers of
    // this type are still below max and what finishing them all costs — the
    // count shrinks as they max out, instead of always showing the total.
    const upAllInfo = sim.upgradeAllInfo(t.typeId);
    const upAllLabel = upAllInfo.towers > 0
      ? `Улучшить все (${upAllInfo.towers}) — ${upAllInfo.cost} з.`
      : 'Все на максимуме';
    const allRefund = sim.sellAllRefund(t.typeId);
    const html =
      `<div class="sel-title"><canvas id="tower-portrait" width="48" height="48"></canvas>` +
      `<b>${def.name}</b> · ур. ${t.level + 1}/${def.levels.length}</div>` +
      `<div class="stat-grid">` +
      `<span>Урон</span><span>${lvl.damage} (${dps} в сек.)</span>` +
      `<span>Дальность</span><span>${lvl.range}</span>` +
      `<span>Перезарядка</span><span>${lvl.cooldown} с</span>` +
      `<span>Цели</span><span>${targets}</span>` +
      (extras.length ? `<span>Особое</span><span>${extras.join('; ')}</span>` : '') +
      `<span>Убийств</span><span>${t.kills}</span>` +
      `</div>` +
      `<div class="cmd-grid">` +
      `<button id="upgrade-btn" title="${upTitle} (Ctrl — все)" ${!next || s.gold < next.cost ? 'disabled' : ''}>${upLabel}</button>` +
      `<button id="sell-btn">Продать +${sim.sellRefund(t.id)} з.</button>` +
      `<button id="upgrade-all-btn" title="Улучшает башни этого типа до максимума, пока хватает золота"` +
      `${upAllInfo.towers === 0 ? ' disabled' : ''}>${upAllLabel}</button>` +
      `<button id="sell-all-btn">Продать все +${allRefund} з.</button>` +
      `</div>`;
    if (this._cache['info-panel'] !== html) {
      this._cache['info-panel'] = html;
      this.el['info-panel'].innerHTML = html;
      const up = document.getElementById('upgrade-btn');
      const sell = document.getElementById('sell-btn');
      const upAll = document.getElementById('upgrade-all-btn');
      const sellAll = document.getElementById('sell-all-btn');
      const portrait = document.getElementById('tower-portrait');
      if (portrait && this.renderer.drawTowerIcon) this.renderer.drawTowerIcon(portrait, t.typeId);
      up.addEventListener('click', e => {
        const r = e.ctrlKey ? sim.upgradeAllOfType(t.typeId) : sim.upgrade(t.id);
        if (!r.ok) this._notify(r.error);
      });
      sell.addEventListener('click', () => {
        sim.sell(t.id);
        this.selectedTowerId = null;
      });
      upAll.addEventListener('click', () => {
        const r = sim.upgradeAllOfType(t.typeId);
        if (!r.ok) this._notify(r.error);
      });
      sellAll.addEventListener('click', () => {
        sim.sellAllOfType(t.typeId);
        this.selectedTowerId = null;
      });
    }
  }

  _updateControls() {
    this.el['pause-btn'].textContent = this.loop.paused ? 'Продолжить' : 'Пауза';
    this.el['pause-btn'].classList.toggle('active', this.loop.paused);
    for (const btn of this.el['controls'].querySelectorAll('.speed-btn')) {
      btn.classList.toggle('active', Number(btn.dataset.speed) === this.loop.speed);
    }
  }

  _updateMessage() {
    const show = performance.now() < this.message.until;
    this._set('message', show ? this.message.text : '');
  }

  _updateOverlay(sim) {
    const over = sim.isOver();
    this.el['overlay'].classList.toggle('hidden', !over);
    if (over) {
      const win = sim.state.phase === 'victory';
      const record = this.isNewRecord() ? ' 🏆 Новый рекорд!' : '';
      this._set('overlay-title', (win ? 'ПОБЕДА' : 'ПОРАЖЕНИЕ') + record);
      this._set('overlay-text', win
        ? `Золотые пески защищены. Осталось жизней: ${sim.state.lives}.`
        : `Оборона пала на волне ${sim.state.waveIndex + 1}.`);
      const st = sim.state;
      const top = st.towers.slice().sort((a, b) => b.kills - a.kills).slice(0, 3)
        .filter(t => t.kills > 0)
        .map(t => `${this.towersCfg[t.typeId].name} — ${t.kills}`)
        .join('<br>');
      this._set('overlay-stats',
        `Волн пройдено: ${st.waveIndex}${sim.endless ? '' : ' из ' + this.wavesCfg.length}<br>` +
        `Убито врагов: ${st.totalKills} · Пропущено: ${st.totalLeaks}<br>` +
        `Золото: заработано ${st.goldEarned}, потрачено ${st.goldSpent}` +
        (top ? `<br><br>Лучшие башни:<br>${top}` : ''));
    }
  }

  _updateCursor() {
    this.canvas.classList.toggle('placing', !!this.placingType);
  }

  // On mobile the tower info panel (with upgrade/sell) sits below the board, so
  // tapping a tower could leave its controls off-screen. When the selection
  // changes to a tower, scroll its panel into view. No-op on desktop / in tests.
  _revealSelectedTower() {
    if (this.selectedTowerId === this._lastRevealed) return;
    this._lastRevealed = this.selectedTowerId;
    const el = this.el['info-panel'];
    if (this.selectedTowerId && el && el.scrollIntoView && this._isMobileLayout()) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}
