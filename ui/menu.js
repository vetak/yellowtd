// Menu module: main menu, pause menu, difficulty and settings screens.
// Контроллер меню: главное меню, пауза, сложность, настройки.
(function () {
  function Menu(opts) {
    this.opts = opts;
    this.root = document.getElementById('menu');
    this.versionEl = document.getElementById('menu-version');
    this.versionEl.textContent = 'Версия ' + (opts.version || 'dev');

    this.screens = {
      main: document.getElementById('screen-main'),
      pause: document.getElementById('screen-pause'),
      version: document.getElementById('screen-version'),
      difficulty: document.getElementById('screen-difficulty'),
      settings: document.getElementById('screen-settings'),
      exit: document.getElementById('screen-exit'),
    };

    this.mode = 'main';
    this.prevScreen = 'main';
    this.currentScreen = 'main';
    this.pendingVersionId = null; // set on the version screen, used by difficulty

    // Platform-aware farewell text (browser tab vs desktop window).
    const exitHint = document.getElementById('exit-hint');
    if (exitHint && opts.exitHint) exitHint.textContent = opts.exitHint;

    this.btnNew = document.getElementById('menu-new');
    this.btnContinue = document.getElementById('menu-continue');
    this.btnSettings = document.getElementById('menu-settings-btn');
    this.btnExport = document.getElementById('menu-export');
    this.btnImport = document.getElementById('menu-import');
    this.msgEl = document.getElementById('menu-message');
    this.btnExit = document.getElementById('menu-exit');
    this.btnResume = document.getElementById('menu-resume');
    this.btnRestart = document.getElementById('menu-restart');
    this.btnPauseSettings = document.getElementById('menu-pause-settings');
    this.btnToMain = document.getElementById('menu-to-main');

    this.btnBackVersion = document.getElementById('back-from-version');
    this.btnBackDiff = document.getElementById('back-from-difficulty');
    this.btnBackSettings = document.getElementById('back-from-settings');
    this.btnBackExit = document.getElementById('back-from-exit');

    this.selSpeed = document.getElementById('set-speed');
    this.chkAuto = document.getElementById('set-autostart');
    this.chkFloating = document.getElementById('set-floating');
    this.chkRange = document.getElementById('set-range');
    this.chkSound = document.getElementById('set-sound');
    this.rngVolume = document.getElementById('set-volume');
    this.chkMusic = document.getElementById('set-music');
    this.rngMusic = document.getElementById('set-music-volume');

    this.diffButtons = document.getElementById('diff-buttons');
    this.versionCards = document.getElementById('version-cards');
    this.buildVersionCards();
    this.buildDifficultyButtons();
    this.bind();
    this.syncSettings();
    this.refresh();
    this.show('main');
  }

  // Version cards: name, description, waves count, tower roster, route preview.
  Menu.prototype.buildVersionCards = function () {
    const ids = this.opts.versionOrder || Object.keys(this.opts.versions || {});
    this.versionCards.innerHTML = '';
    ids.forEach((id) => {
      const v = this.opts.versions[id];
      const card = document.createElement('button');
      card.className = 'version-card';
      card.setAttribute('data-version', id);
      const preview = document.createElement('canvas');
      preview.className = 'version-preview';
      preview.width = 168;
      preview.height = 140;
      const towerNames = Object.values(v.towers).map(t => t.name).join(', ');
      const info = document.createElement('span');
      info.className = 'version-info';
      info.innerHTML = '<strong>' + v.name + '</strong>' +
        '<span class="vdesc">' + v.desc + '</span>' +
        '<span class="vmeta">Волн: ' + v.waves.length +
        ' · Башен: ' + Object.keys(v.towers).length + '</span>' +
        '<span class="vtowers">' + towerNames + '</span>';
      card.appendChild(preview);
      card.appendChild(info);
      card.addEventListener('click', () => {
        this.pendingVersionId = id;
        this.show('difficulty');
      });
      this.versionCards.appendChild(card);
      this._drawRoutePreview(preview, v.map);
    });
  };

  // Mini route preview: scaled-down board with the creep path polyline.
  Menu.prototype._drawRoutePreview = function (canvasEl, map) {
    if (!canvasEl.getContext) return;
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    const w = canvasEl.width;
    const h = canvasEl.height;
    const s = Math.min(w / map.cols, h / map.rows);
    const ox = (w - map.cols * s) / 2;
    const oy = (h - map.rows * s) / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1c1309';
    ctx.fillRect(ox, oy, map.cols * s, map.rows * s);
    ctx.strokeStyle = 'rgba(255,220,132,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(ox + 0.5, oy + 0.5, map.cols * s - 1, map.rows * s - 1);
    const px = wp => ox + (wp.col + 0.5) * s;
    const py = wp => oy + (wp.row + 0.5) * s;
    ctx.strokeStyle = '#d8b14a';
    ctx.lineWidth = Math.max(2, s * 0.6);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    const wps = map.waypoints;
    ctx.moveTo(px(wps[0]), py(wps[0]));
    for (let i = 1; i < wps.length; i++) ctx.lineTo(px(wps[i]), py(wps[i]));
    ctx.stroke();
    // entry / exit markers
    ctx.fillStyle = '#e6c832';
    ctx.beginPath();
    ctx.arc(Math.max(ox + 2, px(wps[0])), py(wps[0]), 3, 0, Math.PI * 2);
    ctx.fill();
    const last = wps[wps.length - 1];
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(Math.min(ox + map.cols * s - 2, px(last)), py(last), 3, 0, Math.PI * 2);
    ctx.fill();
  };

  Menu.prototype.buildDifficultyButtons = function () {
    const ids = Object.keys(this.opts.difficulties || {});
    this.diffButtons.innerHTML = '';
    ids.forEach((id) => {
      const diff = this.opts.difficulties[id];
      const btn = document.createElement('button');
      btn.className = 'diff-btn';
      btn.setAttribute('data-diff', id);
      btn.innerHTML = '<strong>' + diff.name + '</strong><span>' + diff.desc + '</span>';
      btn.addEventListener('click', () => {
        this.close();
        this.opts.onNewGame(id, this.pendingVersionId);
      });
      this.diffButtons.appendChild(btn);
    });
  };

  Menu.prototype.bind = function () {
    this.btnNew.addEventListener('click', () => this.show('version'));
    this.btnContinue.addEventListener('click', () => {
      if (!this.opts.hasSave()) return;
      this.close();
      this.opts.onContinue();
    });
    this.btnSettings.addEventListener('click', () => this.show('settings'));
    this.btnExport.addEventListener('click', () => {
      if (this.opts.onExportSave) this.opts.onExportSave();
    });
    this.btnImport.addEventListener('click', () => {
      if (this.opts.onImportSave) this.opts.onImportSave();
    });
    this.btnExit.addEventListener('click', () => {
      if (this.opts.onExit) this.opts.onExit();
      else this.show('exit');
    });

    this.btnResume.addEventListener('click', () => {
      this.close();
      this.opts.onResume();
    });
    this.btnRestart.addEventListener('click', () => {
      this.close();
      this.opts.onRestart();
    });
    this.btnPauseSettings.addEventListener('click', () => this.show('settings'));
    this.btnToMain.addEventListener('click', () => {
      this.close();
      this.opts.onMainMenu();
    });

    this.btnBackVersion.addEventListener('click', () => this.show(this.mode === 'pause' ? 'pause' : 'main'));
    this.btnBackDiff.addEventListener('click', () => this.show('version'));
    this.btnBackSettings.addEventListener('click', () => this.show(this.prevScreen || (this.mode === 'pause' ? 'pause' : 'main')));
    this.btnBackExit.addEventListener('click', () => this.show('main'));

    const onSettingInput = () => {
      this.opts.settings.defaultSpeed = Math.max(1, Math.min(3, Number(this.selSpeed.value) || 1));
      this.opts.settings.autoStartWaves = !!this.chkAuto.checked;
      this.opts.settings.floatingText = !!this.chkFloating.checked;
      this.opts.settings.rangeOnHover = !!this.chkRange.checked;
      this.opts.settings.soundOn = !!this.chkSound.checked;
      this.opts.settings.soundVolume = Math.max(0, Math.min(1, (Number(this.rngVolume.value) || 0) / 100));
      this.opts.settings.musicOn = !!this.chkMusic.checked;
      this.opts.settings.musicVolume = Math.max(0, Math.min(1, (Number(this.rngMusic.value) || 0) / 100));
      this.opts.onSettingsChange();
    };

    this.selSpeed.addEventListener('change', onSettingInput);
    this.chkAuto.addEventListener('change', onSettingInput);
    this.chkFloating.addEventListener('change', onSettingInput);
    this.chkRange.addEventListener('change', onSettingInput);
    this.chkSound.addEventListener('change', onSettingInput);
    this.rngVolume.addEventListener('input', onSettingInput);
    this.rngVolume.addEventListener('change', onSettingInput);
    this.chkMusic.addEventListener('change', onSettingInput);
    this.rngMusic.addEventListener('input', onSettingInput);
    this.rngMusic.addEventListener('change', onSettingInput);
  };

  Menu.prototype.syncSettings = function () {
    this.selSpeed.value = String(this.opts.settings.defaultSpeed || 1);
    this.chkAuto.checked = !!this.opts.settings.autoStartWaves;
    this.chkFloating.checked = !!this.opts.settings.floatingText;
    this.chkRange.checked = !!this.opts.settings.rangeOnHover;
    this.chkSound.checked = this.opts.settings.soundOn !== false;
    this.rngVolume.value = String(Math.round(
      (this.opts.settings.soundVolume != null ? this.opts.settings.soundVolume : 0.6) * 100));
    this.chkMusic.checked = this.opts.settings.musicOn === true;
    this.rngMusic.value = String(Math.round(
      (this.opts.settings.musicVolume != null ? this.opts.settings.musicVolume : 0.4) * 100));
  };

  Menu.prototype.refresh = function () {
    const canContinue = !!this.opts.hasSave();
    this.btnContinue.disabled = !canContinue;
    // Show which map version (and difficulty) the save belongs to.
    const info = canContinue && this.opts.continueInfo ? this.opts.continueInfo() : null;
    this.btnContinue.textContent = info
      ? 'Продолжить — ' + info.versionName + ' · ' + info.difficultyName
      : 'Продолжить';
    if (this.btnExport) this.btnExport.disabled = !canContinue;
    if (this.btnResume) this.btnResume.disabled = this.mode !== 'pause';
  };

  // Small status line inside the menu card (import/export feedback).
  Menu.prototype.notify = function (text) {
    if (this.msgEl) this.msgEl.textContent = text || '';
  };

  Menu.prototype.show = function (name) {
    if (name === 'settings') this.prevScreen = this.currentScreen || (this.mode === 'pause' ? 'pause' : 'main');
    Object.keys(this.screens).forEach((key) => {
      this.screens[key].classList.toggle('hidden', key !== name);
    });
    this.currentScreen = name;
    this.syncSettings();
    this.refresh();
  };

  Menu.prototype.open = function (mode) {
    this.mode = mode === 'pause' ? 'pause' : 'main';
    this.notify('');
    this.root.classList.remove('hidden');
    this.show(this.mode === 'pause' ? 'pause' : 'main');
  };

  Menu.prototype.close = function () {
    this.root.classList.add('hidden');
  };

  globalThis.Menu = Menu;
})();
