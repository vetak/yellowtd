// Main bootstrap: wires configs, simulation, renderer, UI and game loop together.
// Bootstrap: app state machine (menu <-> playing), settings, saves, game loop.
// The simulation advances in fixed ticks; rendering happens every animation frame.
(function () {
  const settings = Storage.loadSettings(DefaultSettings);

  const canvas = document.getElementById('game-canvas');
  canvas.width = MapConfig.cols * MapConfig.cellSize;
  canvas.height = MapConfig.rows * MapConfig.cellSize;

  const idlePath = buildPath(MapConfig);
  const renderer = new Renderer(canvas, {
    map: MapConfig,
    towers: TowersConfig,
    creeps: CreepsConfig,
  });
  renderer.showFloatingText = settings.floatingText;
  const loop = { paused: false, speed: settings.defaultSpeed };

  let sim = null;
  let difficultyId = 'normal';
  let appState = 'menu';
  let menuMode = 'main';

  function makeGameConfig() {
    return Object.assign({}, GameConfig, { autoStartWaves: settings.autoStartWaves });
  }

  function createSim(diffId) {
    return new Simulation({
      game: makeGameConfig(),
      map: MapConfig,
      towers: TowersConfig,
      creeps: CreepsConfig,
      waves: WavesConfig,
      difficulty: DifficultyConfig[diffId],
    });
  }

  function saveNow() {
    if (!sim || sim.isOver()) return;
    Storage.saveGame({
      version: GAME_VERSION,
      difficulty: difficultyId,
      savedAt: Date.now(),
      state: sim.exportState(),
    });
  }

  function hasSave() {
    const save = Storage.loadGame();
    // Saves are only compatible within the exact same game version:
    // waves/map/tower formats may change between versions.
    return !!(save && save.state && save.version === GAME_VERSION);
  }

  function updateFooter() {
    const el = document.getElementById('footer-line');
    const diff = sim ? ' · ' + DifficultyConfig[difficultyId].name : '';
    el.textContent = 'YellowTD v' + GAME_VERSION + diff;
  }

  function enterGame() {
    renderer.reset();
    ui.reset();
    loop.paused = false;
    loop.speed = settings.defaultSpeed;
    appState = 'playing';
    menuMode = 'pause';
    menu.close();
    updateFooter();
  }

  function startNewGame(diffId) {
    difficultyId = diffId in DifficultyConfig ? diffId : 'normal';
    sim = createSim(difficultyId);
    enterGame();
    saveNow();
  }

  function continueGame() {
    const save = Storage.loadGame();
    if (!save || !save.state) return;
    difficultyId = save.difficulty in DifficultyConfig ? save.difficulty : 'normal';
    sim = createSim(difficultyId);
    sim.importState(save.state);
    sim.cfg.autoStartWaves = settings.autoStartWaves;
    enterGame();
  }

  function openMainMenu() {
    if (appState === 'playing') saveNow();
    appState = 'menu';
    menuMode = 'main';
    loop.paused = true;
    menu.open('main');
    updateFooter();
  }

  function openPauseMenu() {
    if (appState !== 'playing' || !sim) return;
    saveNow();
    loop.paused = true;
    appState = 'menu';
    menuMode = 'pause';
    menu.open('pause');
  }

  function resumeGame() {
    if (!sim) return;
    appState = 'playing';
    loop.paused = false;
    menu.close();
  }

  function restartGame() {
    startNewGame(difficultyId);
  }

  function applySettings() {
    Storage.saveSettings(settings);
    renderer.showFloatingText = settings.floatingText;
    loop.speed = settings.defaultSpeed;
    if (sim) sim.cfg.autoStartWaves = settings.autoStartWaves;
  }

  // ---- 0.7.0: platform-aware exit and save export/import ----

  function exitGame() {
    Platform.exitApp().then(closed => {
      if (!closed) menu.show('exit'); // browser can't close the tab itself
    });
  }

  async function exportSave() {
    const save = Storage.loadGame();
    if (!save) {
      menu.notify('Нет сохранения для экспорта.');
      return;
    }
    const ok = await Platform.exportText(
      'yellowtd-save-v' + save.version + '.json',
      JSON.stringify(save, null, 2));
    menu.notify(ok ? 'Сейв экспортирован в файл.' : 'Экспорт отменён.');
  }

  async function importSave() {
    const text = await Platform.importText();
    if (!text) {
      menu.notify('Импорт отменён.');
      return;
    }
    let save = null;
    try { save = JSON.parse(text); } catch (e) { /* not JSON */ }
    if (!save || !save.state || save.version !== GAME_VERSION) {
      menu.notify('Файл не подходит: нужен сейв версии ' + GAME_VERSION + '.');
      return;
    }
    Storage.saveGame(save);
    menu.refresh();
    menu.notify('Сейв импортирован — нажмите «Продолжить».');
  }

  const ui = new UI({
    canvas,
    renderer,
    loop,
    towers: TowersConfig,
    creeps: CreepsConfig,
    waves: WavesConfig,
    settings,
    getSim: () => sim,
    restart: restartGame,
    onOpenMenu: openPauseMenu,
    onMainMenu: openMainMenu,
    isActive: () => appState === 'playing' && !!sim,
  });

  const menu = new Menu({
    difficulties: DifficultyConfig,
    settings,
    version: GAME_VERSION,
    hasSave,
    onNewGame: startNewGame,
    onContinue: continueGame,
    onResume: resumeGame,
    onRestart: restartGame,
    onMainMenu: openMainMenu,
    onSettingsChange: applySettings,
    onExit: exitGame,
    onExportSave: exportSave,
    onImportSave: importSave,
  });

  window.YTD = {
    get sim() { return sim; },
    ui, renderer, loop, menu, settings, Storage,
    app: {
      startNewGame,
      continueGame,
      openMainMenu,
      openPauseMenu,
      resumeGame,
      get state() { return appState; },
      get menuMode() { return menuMode; },
    },
  };

  if (window.addEventListener) {
    window.addEventListener('beforeunload', () => {
      if (appState === 'playing') saveNow();
    });
  }

  let last = performance.now();
  let acc = 0;
  const MAX_STEPS_PER_FRAME = 30;

  function frame(now) {
    const dtReal = Math.min((now - last) / 1000, 0.25);
    last = now;

    if (appState === 'playing' && sim) {
      if (!loop.paused && !sim.isOver()) acc += dtReal * loop.speed;
      else acc = 0;

      let steps = 0;
      while (acc >= sim.dt && steps < MAX_STEPS_PER_FRAME) {
        sim.step();
        renderer.ingestEvents(sim.state.events);
        for (const ev of sim.state.events) {
          if (ev.type === 'waveStart' || ev.type === 'waveEnd') saveNow();
          else if (ev.type === 'victory' || ev.type === 'defeat') Storage.clearGame();
        }
        acc -= sim.dt;
        steps++;
      }
      if (acc > sim.dt * 5) acc = sim.dt * 5;

      renderer.draw(sim, ui.viewState(), dtReal);
      ui.update(sim);
    } else if (sim && menuMode === 'pause') {
      acc = 0;
      renderer.draw(sim, ui.viewState(), 0);
      ui.update(sim);
    } else {
      acc = 0;
      renderer.drawIdle(idlePath, dtReal);
    }
    requestAnimationFrame(frame);
  }

  updateFooter();
  menu.open('main');
  requestAnimationFrame(frame);
})();
