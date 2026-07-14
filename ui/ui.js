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
};

const TARGET_LABEL = { ground: 'земля', air: 'воздух' };

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
      'wave-timer', 'send-wave-btn', 'build-buttons', 'info-panel', 'controls',
      'pause-btn', 'menu-btn', 'message', 'overlay', 'overlay-title',
      'overlay-text', 'overlay-stats', 'restart-btn', 'overlay-menu-btn', 'tooltip',
    ]) {
      this.el[id] = document.getElementById(id);
    }

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
    canvas.addEventListener('click', e => {
      if (!this.isActive()) return;
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

    // live-refresh creep tooltip hp
    if (this.hoverCreepId) {
      const c = s.creeps.find(cr => cr.id === this.hoverCreepId);
      if (c) this.el['tooltip'].innerHTML = this._creepTooltip(c);
      else { this.hoverCreepId = null; this._hideTooltip(); }
    }
  }

  // Wave summary that honours every spawn group (mixed waves included).
  // Past the scripted list, an endless run's waves are generated on the fly.
  _waveBrief(idx) {
    const sim = this.getSim();
    const wave = this.wavesCfg[idx] || (sim && sim.endless ? sim._waveAt(idx) : null);
    if (!wave) return '';
    const hpMul = sim && sim.difficulty ? (sim.difficulty.hpMul || 1) : 1;
    const badges = [];
    if (wave.groups.some(g => (this.creepsCfg[g.creep] || {}).type === 'air')) {
      badges.push('<span class="badge air">ВОЗДУХ</span>');
    }
    if (wave.boss) badges.push('<span class="badge boss">БОСС</span>');
    if (wave.hero) badges.push('<span class="badge hero">ГЕРОЙ</span>');
    if (wave.immuneToSlow) badges.push('<span class="badge immune">ИММУН</span>');
    if (wave.regen) badges.push('<span class="badge regen">РЕГЕН</span>');
    if (wave.extra) badges.push('<span class="badge extra">БОНУС</span>');
    const lines = wave.groups.map(g => {
      const base = this.creepsCfg[g.creep];
      const hp = Math.round(g.hp * hpMul);
      const armor = g.armor ? ` · броня ${g.armor}` : '';
      return `<div class="muted">${g.count} × ${base.name} · HP ${hp}${armor} · ${g.bounty} з.</div>`;
    }).join('');
    return `<div class="wname">${idx + 1}. ${wave.name} ${badges.join(' ')}</div>` +
      lines +
      `<div class="muted">Бонус за волну: ${wave.bonus} з.</div>`;
  }

  _updateWavePanel(sim) {
    const s = sim.state;
    let html = '';
    let timer = '';
    if (s.phase === 'build') {
      html = `<div class="phase-label">Следующая волна:</div>` + this._waveBrief(s.waveIndex);
      timer = sim.cfg.autoStartWaves !== false
        ? `Автостарт через ${Math.ceil(s.waveTimer)} с`
        : 'Нажмите «Отправить волну»';
    } else if (s.phase === 'wave') {
      html = `<div class="phase-label">Идёт волна:</div>` + this._waveBrief(s.waveIndex);
      if (s.waveIndex + 1 < this.wavesCfg.length) {
        html += `<div class="next-brief"><span class="muted">Далее: ${this.wavesCfg[s.waveIndex + 1].name}</span></div>`;
      }
    }
    this._set('wave-name', html);
    this._set('wave-timer', timer);
    this.el['send-wave-btn'].disabled = s.phase !== 'build';
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
        `<div class="muted">Выберите башню (кнопки или клавиши 1–${keyCount}) и кликните по свободной клетке.` +
        ` Shift/Ctrl+клик — строить несколько подряд. Клик по построенной башне — улучшение и продажа.` +
        ` ПКМ — отмена. Пробел — пауза. Esc — меню.</div>`);
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
    const count = sim.towersOfType(t.typeId).length;
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
      `<button id="upgrade-all-btn">Улучшить все (${count})</button>` +
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
}
