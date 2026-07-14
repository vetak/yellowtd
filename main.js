// Main bootstrap: wires configs, simulation, renderer, UI and game loop together.
// Bootstrap: app state machine (menu <-> playing), settings, saves, game loop.
// The simulation advances in fixed ticks; rendering happens every animation frame.
// 0.8.0: the player picks a map version (VersionsConfig) — a full alternative
// set of map/towers/creeps/waves. Saves are stored per version.
(function () {
  const settings = Storage.loadSettings(DefaultSettings);

  const canvas = document.getElementById('game-canvas');

  let versionId = VersionOrder[0];
  let idlePath = null;

  const renderer = new Renderer(canvas, {
    map: VersionsConfig[versionId].map,
    towers: VersionsConfig[versionId].towers,
    creeps: VersionsConfig[versionId].creeps,
  });
  renderer.showFloatingText = settings.floatingText;
  const audio = new SoundEngine(settings);
  const loop = { paused: false, speed: settings.defaultSpeed };

  let sim = null;
  let difficultyId = 'normal';
  let lastRunNewRecord = false; // did the most recent run land at #1 on its leaderboard?
  let appState = 'menu';
  let menuMode = 'main';
  // 0.11.0: endless mode and challenge modifiers, chosen on the difficulty screen.
  let endlessMode = false;
  let activeModifiers = {};

  // Endless runs get their own leaderboard bucket (wave count is unbounded,
  // not comparable to a capped campaign run); challenge modifiers don't split
  // the board further — a challenge run still competes in its difficulty.
  function recordKey() {
    return difficultyId + (endlessMode ? '-endless' : '');
  }

  // Resize the canvas and swap renderer/UI configs to the given map version.
  function applyVersion(verId) {
    versionId = verId in VersionsConfig ? verId : VersionOrder[0];
    const v = VersionsConfig[versionId];
    canvas.width = v.map.cols * v.map.cellSize;
    canvas.height = v.map.rows * v.map.cellSize;
    idlePath = buildPath(v.map);
    renderer.setVersion(v);
    ui.setVersion(v);
  }

  function makeGameConfig() {
    return Object.assign({}, GameConfig, { autoStartWaves: settings.autoStartWaves });
  }

  function createSim(diffId, verId) {
    const v = VersionsConfig[verId];
    return new Simulation({
      game: makeGameConfig(),
      map: v.map,
      towers: v.towers,
      creeps: v.creeps,
      waves: v.waves,
      difficulty: DifficultyConfig[diffId],
      endless: endlessMode,
      modifiers: activeModifiers,
    });
  }

  function saveNow() {
    if (!sim || sim.isOver()) return;
    Storage.saveGame(versionId, {
      version: GAME_VERSION,
      versionId,
      difficulty: difficultyId,
      endless: endlessMode,
      modifiers: activeModifiers,
      savedAt: Date.now(),
      state: sim.exportState(),
    });
  }

  // Saves are only compatible within the exact same game version:
  // waves/map/tower formats may change between versions.
  function isSaveUsable(save) {
    return !!(save && save.state && save.version === GAME_VERSION &&
      save.versionId in VersionsConfig);
  }

  function latestSave() {
    const save = Storage.latestSave(VersionOrder);
    return isSaveUsable(save) ? save : null;
  }

  function hasSave() {
    return !!latestSave();
  }

  // Continue button caption: which version/difficulty is saved.
  function continueInfo() {
    const save = latestSave();
    if (!save) return null;
    return {
      versionName: VersionsConfig[save.versionId].name,
      difficultyName: (DifficultyConfig[save.difficulty] || DifficultyConfig.normal).name +
        (save.endless ? ' · Эндлесс' : ''),
    };
  }

  // Gated difficulties (e.g. "Кошмар") require a prior victory on their
  // `unlockedBy` difficulty, tracked across all versions in Storage.
  function isDifficultyUnlocked(diffId) {
    const def = DifficultyConfig[diffId];
    if (!def || !def.unlockedBy) return true;
    return Storage.hasWon(def.unlockedBy);
  }

  function updateFooter() {
    const el = document.getElementById('footer-line');
    const ver = ' · ' + VersionsConfig[versionId].name;
    const diff = sim ? ' · ' + DifficultyConfig[difficultyId].name : '';
    const mode = sim && endlessMode ? ' · Эндлесс' : '';
    el.textContent = 'YellowTD v' + GAME_VERSION + ver + diff + mode;
  }

  // First-run tutorial hint: a small dismissible card over the battlefield,
  // shown once ever (any version/difficulty), never again after dismissed.
  const tutorialEl = document.getElementById('tutorial-hint');
  function maybeShowTutorial() {
    if (Storage.hasSeenTutorial() || !tutorialEl) return;
    tutorialEl.classList.remove('hidden');
  }
  const tutorialDismissBtn = document.getElementById('tutorial-dismiss');
  if (tutorialDismissBtn) {
    tutorialDismissBtn.addEventListener('click', () => {
      Storage.markTutorialSeen();
      if (tutorialEl) tutorialEl.classList.add('hidden');
    });
  }

  function enterGame() {
    renderer.reset();
    ui.reset();
    lastRunNewRecord = false;
    loop.paused = false;
    loop.speed = settings.defaultSpeed;
    appState = 'playing';
    menuMode = 'pause';
    menu.close();
    updateFooter();
    maybeShowTutorial();
  }

  function startNewGame(diffId, verId, modeOptions) {
    difficultyId = diffId in DifficultyConfig && isDifficultyUnlocked(diffId) ? diffId : 'normal';
    applyVersion(verId !== undefined ? verId : versionId);
    endlessMode = !!(modeOptions && modeOptions.endless);
    activeModifiers = (modeOptions && modeOptions.modifiers) || {};
    sim = createSim(difficultyId, versionId);
    enterGame();
    saveNow();
  }

  function continueGame() {
    const save = latestSave();
    if (!save) return;
    endlessMode = !!save.endless;
    activeModifiers = save.modifiers || {};
    difficultyId = save.difficulty in DifficultyConfig ? save.difficulty : 'normal';
    applyVersion(save.versionId);
    sim = createSim(difficultyId, versionId);
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
    // Preserve the current run's mode (endless/challenges) across a restart.
    startNewGame(difficultyId, versionId, { endless: endlessMode, modifiers: activeModifiers });
  }

  function applySettings() {
    Storage.saveSettings(settings);
    renderer.showFloatingText = settings.floatingText;
    loop.speed = settings.defaultSpeed;
    audio.setEnabled(settings.soundOn !== false);
    audio.setVolume(settings.soundVolume != null ? settings.soundVolume : 0.6);
    audio.setMusicEnabled(settings.musicOn === true);
    audio.setMusicVolume(settings.musicVolume != null ? settings.musicVolume : 0.4);
    if (sim) sim.cfg.autoStartWaves = settings.autoStartWaves;
  }

  // ---- 0.7.0: platform-aware exit and save export/import ----

  function exitGame() {
    Platform.exitApp().then(closed => {
      if (!closed) menu.show('exit'); // browser can't close the tab itself
    });
  }

  async function exportSave() {
    const save = latestSave();
    if (!save) {
      menu.notify('Нет сохранения для экспорта.');
      return;
    }
    const ok = await Platform.exportText(
      'yellowtd-save-v' + save.version + '-' + save.versionId + '.json',
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
    if (!save || !isSaveUsable(save)) {
      menu.notify('Файл не подходит: нужен сейв версии ' + GAME_VERSION + '.');
      return;
    }
    Storage.saveGame(save.versionId, save);
    menu.refresh();
    menu.notify('Сейв импортирован — нажмите «Продолжить».');
  }

  const ui = new UI({
    canvas,
    renderer,
    loop,
    towers: VersionsConfig[versionId].towers,
    creeps: VersionsConfig[versionId].creeps,
    waves: VersionsConfig[versionId].waves,
    settings,
    getSim: () => sim,
    restart: restartGame,
    onOpenMenu: openPauseMenu,
    onMainMenu: openMainMenu,
    isActive: () => appState === 'playing' && !!sim,
    isNewRecord: () => lastRunNewRecord,
  });

  const menu = new Menu({
    difficulties: DifficultyConfig,
    versions: VersionsConfig,
    versionOrder: VersionOrder,
    settings,
    version: GAME_VERSION,
    exitHint: Platform.isTauri()
      ? 'Не удалось закрыть окно автоматически. Закройте его крестиком в заголовке.'
      : 'Браузер не даёт закрыть вкладку автоматически. Её можно закрыть вручную.',
    hasSave,
    continueInfo,
    isDifficultyUnlocked,
    getRecords: (verId, diffId) => Storage.getRecords(verId, diffId),
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

  // Subtle click sound for menu navigation, delegated from the menu root so
  // every button (present and future) gets it without wiring each one.
  const menuRoot = document.getElementById('menu');
  if (menuRoot && menuRoot.addEventListener) {
    menuRoot.addEventListener('click', (e) => {
      if (e && e.target && e.target.tagName === 'BUTTON') audio.click();
    });
  }

  applyVersion(versionId);

  window.YTD = {
    get sim() { return sim; },
    get versionId() { return versionId; },
    ui, renderer, audio, loop, menu, settings, Storage,
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
    // AudioContext may only start after a user gesture (autoplay policy).
    const unlockAudio = () => audio.unlock();
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
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
        audio.ingestEvents(sim.state.events);
        for (const ev of sim.state.events) {
          if (ev.type === 'waveStart' || ev.type === 'waveEnd') saveNow();
          else if (ev.type === 'victory' || ev.type === 'defeat') {
            Storage.clearGame(versionId);
            if (ev.type === 'victory') Storage.recordVictory(difficultyId);
            const entry = {
              wave: sim.state.waveIndex, // waves fully completed — matches "Волн пройдено" on the results screen
              lives: sim.state.lives,
              gold: sim.state.gold,
              ticks: sim.state.tick,
              won: ev.type === 'victory',
              at: Date.now(),
            };
            const ranked = Storage.addRecord(versionId, recordKey(), entry);
            lastRunNewRecord = ranked[0] === entry; // reference check: did it land on top?
          }
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
