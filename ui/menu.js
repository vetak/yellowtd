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
      difficulty: document.getElementById('screen-difficulty'),
      settings: document.getElementById('screen-settings'),
      exit: document.getElementById('screen-exit'),
    };

    this.mode = 'main';
    this.prevScreen = 'main';
    this.currentScreen = 'main';

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

    this.btnBackDiff = document.getElementById('back-from-difficulty');
    this.btnBackSettings = document.getElementById('back-from-settings');
    this.btnBackExit = document.getElementById('back-from-exit');

    this.selSpeed = document.getElementById('set-speed');
    this.chkAuto = document.getElementById('set-autostart');
    this.chkFloating = document.getElementById('set-floating');
    this.chkRange = document.getElementById('set-range');

    this.diffButtons = document.getElementById('diff-buttons');
    this.buildDifficultyButtons();
    this.bind();
    this.syncSettings();
    this.refresh();
    this.show('main');
  }

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
        this.opts.onNewGame(id);
      });
      this.diffButtons.appendChild(btn);
    });
  };

  Menu.prototype.bind = function () {
    this.btnNew.addEventListener('click', () => this.show('difficulty'));
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

    this.btnBackDiff.addEventListener('click', () => this.show(this.mode === 'pause' ? 'pause' : 'main'));
    this.btnBackSettings.addEventListener('click', () => this.show(this.prevScreen || (this.mode === 'pause' ? 'pause' : 'main')));
    this.btnBackExit.addEventListener('click', () => this.show('main'));

    const onSettingInput = () => {
      this.opts.settings.defaultSpeed = Math.max(1, Math.min(3, Number(this.selSpeed.value) || 1));
      this.opts.settings.autoStartWaves = !!this.chkAuto.checked;
      this.opts.settings.floatingText = !!this.chkFloating.checked;
      this.opts.settings.rangeOnHover = !!this.chkRange.checked;
      this.opts.onSettingsChange();
    };

    this.selSpeed.addEventListener('change', onSettingInput);
    this.chkAuto.addEventListener('change', onSettingInput);
    this.chkFloating.addEventListener('change', onSettingInput);
    this.chkRange.addEventListener('change', onSettingInput);
  };

  Menu.prototype.syncSettings = function () {
    this.selSpeed.value = String(this.opts.settings.defaultSpeed || 1);
    this.chkAuto.checked = !!this.opts.settings.autoStartWaves;
    this.chkFloating.checked = !!this.opts.settings.floatingText;
    this.chkRange.checked = !!this.opts.settings.rangeOnHover;
  };

  Menu.prototype.refresh = function () {
    const canContinue = !!this.opts.hasSave();
    this.btnContinue.disabled = !canContinue;
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
