// Headless integration smoke: loads ALL scripts (data + engine + render + ui + main)
// with stubbed DOM/Canvas and simulates user interaction: menu flow, difficulty
// selection, building, pause menu, save/continue and settings.
// Run: node test/dom-smoke.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ------------------------------------------------------------------- stubs

function makeCtx() {
  const store = {};
  // Callable, chainable absorber: any method returns it, any property is it.
  const blackhole = new Proxy(function () {}, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : blackhole),
    set: () => true,
    apply: () => blackhole,
  });
  return new Proxy({}, {
    get: (t, p) => (p in store ? store[p] : blackhole),
    set: (t, p, v) => { store[p] = v; return true; },
  });
}

class FakeElement {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attrs = {};
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.textContent = '';
    this._html = '';
    this._handlers = {};
    const set = new Set();
    this.classList = {
      add: (...c) => c.forEach(x => set.add(x)),
      remove: (...c) => c.forEach(x => set.delete(x)),
      contains: c => set.has(c),
      toggle: (c, force) => {
        const want = force !== undefined ? force : !set.has(c);
        if (want) set.add(c); else set.delete(c);
      },
    };
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); }
  appendChild(el) { this.children.push(el); return el; }
  querySelectorAll() { return []; }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.width || 100, height: this.height || 100 };
  }
  getContext() { return makeCtx(); }
  fire(type, ev = {}) {
    for (const fn of this._handlers[type] || []) fn(Object.assign({ preventDefault() {} }, ev));
  }
}

const elements = {};
const documentStub = new FakeElement('document');
documentStub.getElementById = id => (elements[id] = elements[id] || new FakeElement('div'));
documentStub.createElement = tag => new FakeElement(tag);

let rafCb = null;
let nowMs = 0;
const windowStub = {
  innerWidth: 1400,
  innerHeight: 900,
  addEventListener: () => {},
  close: () => {},
};

const ctx = vm.createContext({
  document: documentStub,
  window: windowStub,
  performance: { now: () => nowMs },
  requestAnimationFrame: cb => { rafCb = cb; },
  setTimeout: fn => { fn(); return 0; },
  clearTimeout: () => {},
  console,
});

// ------------------------------------------------------------------- load

const root = path.join(__dirname, '..');
const files = [
  'data/config.js',
  'data/versions/classic/map.js', 'data/versions/classic/creeps.js',
  'data/versions/classic/towers.js', 'data/versions/classic/waves.js',
  'data/versions/canyon/map.js', 'data/versions/canyon/creeps.js',
  'data/versions/canyon/towers.js', 'data/versions/canyon/waves.js',
  'data/versions.js',
  'engine/path.js', 'engine/sim.js', 'render/renderer.js', 'audio/audio.js',
  'ui/storage.js', 'ui/platform.js', 'ui/menu.js', 'ui/ui.js', 'main.js',
];

let failures = 0;
function check(label, cond, extra) {
  console.log(`[${cond ? 'PASS' : 'FAIL'}] ${label}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
}

for (const f of files) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}

const YTD = windowStub.YTD;
check('bootstrap: YTD handle exists', !!YTD);
check('bootstrap: starts in main menu',
  YTD.app.state === 'menu' && !elements['menu'].classList.contains('hidden') &&
  !elements['screen-main'].classList.contains('hidden'));
check('bootstrap: canvas sized from MapConfig (24x18 @36)',
  elements['game-canvas'].width === 864 && elements['game-canvas'].height === 648,
  `${elements['game-canvas'].width}x${elements['game-canvas'].height}`);
check('bootstrap: 7 build buttons, 4 difficulty buttons (incl. locked Nightmare)',
  Object.keys(YTD.ui.buildBtns).length === 7 && elements['diff-buttons'].children.length === 4);
check('bootstrap: Nightmare starts locked',
  elements['diff-buttons'].children[3].disabled === true &&
  String(elements['diff-buttons'].children[3].className).includes('locked'));
check('bootstrap: continue disabled without a save', elements['menu-continue'].disabled === true);

function runFrames(n, stepMs = 50) {
  for (let i = 0; i < n; i++) {
    const cb = rafCb;
    rafCb = null;
    nowMs += stepMs;
    cb(nowMs);
    if (!rafCb) throw new Error('frame loop stopped rescheduling');
  }
}

// ------------------------------------------------------------ interaction

try {
  runFrames(10); // idle menu frames (drawIdle)

  // menu: New Game -> version screen -> Classic -> difficulty -> Normal (2nd button)
  elements['menu-new'].fire('click');
  check('New Game opens version screen',
    !elements['screen-version'].classList.contains('hidden') &&
    elements['screen-main'].classList.contains('hidden'));
  check('version screen shows both version cards',
    elements['version-cards'].children.length === 2 &&
    elements['version-cards'].children[0].getAttribute('data-version') === 'classic' &&
    elements['version-cards'].children[1].getAttribute('data-version') === 'canyon');
  elements['version-cards'].children[0].fire('click');
  check('version card click opens difficulty screen',
    !elements['screen-difficulty'].classList.contains('hidden') &&
    elements['screen-version'].classList.contains('hidden'));
  elements['diff-buttons'].children[1].fire('click');
  check('difficulty click starts the game',
    YTD.app.state === 'playing' && !!YTD.sim && elements['menu'].classList.contains('hidden'),
    `state=${YTD.app.state}`);
  check('normal difficulty resources', YTD.sim.state.gold === 60 && YTD.sim.state.lives === 30,
    `gold=${YTD.sim.state.gold}, lives=${YTD.sim.state.lives}`);

  // 1.0.0: first-run tutorial hint shows once, then never again.
  check('tutorial hint shows on the very first game start',
    !YTD.Storage.hasSeenTutorial() && !elements['tutorial-hint'].classList.contains('hidden'));
  elements['tutorial-dismiss'].fire('click');
  check('dismissing the tutorial hides it and marks it seen',
    elements['tutorial-hint'].classList.contains('hidden') && YTD.Storage.hasSeenTutorial());
  YTD.app.startNewGame('normal', 'classic');
  check('tutorial hint stays hidden on subsequent game starts',
    elements['tutorial-hint'].classList.contains('hidden'));

  runFrames(20);
  check('frame loop runs and HUD updates', elements['gold-value'].innerHTML === '60',
    `gold-value="${elements['gold-value'].innerHTML}"`);

  const canvas = elements['game-canvas'];
  // pick arrow tower via its button, place at cell (7,3) => px (270,126)
  YTD.ui.buildBtns.arrow.fire('click');
  check('build button click enters placing mode', YTD.ui.placingType === 'arrow');
  canvas.fire('mousemove', { clientX: 270, clientY: 126 });
  canvas.fire('click', { clientX: 270, clientY: 126, shiftKey: false });
  check('canvas click builds tower', YTD.sim.state.towers.length === 1 && YTD.sim.state.gold === 48,
    `towers=${YTD.sim.state.towers.length}, gold=${YTD.sim.state.gold}`);

  // 1.0.0: gold stat shakes when a build fails for lack of gold.
  YTD.ui.placingType = null;
  YTD.sim.state.gold = 0;
  YTD.ui.buildBtns.cannon.fire('click');
  canvas.fire('click', { clientX: 306, clientY: 126, shiftKey: false });
  check('insufficient-gold build shakes the gold stat',
    elements['gold-value'].classList.contains('shake'));
  YTD.sim.state.gold = 48; // restore for the rest of the flow below

  canvas.fire('click', { clientX: 270, clientY: 126, shiftKey: false });
  check('clicking tower selects it', YTD.ui.selectedTowerId === YTD.sim.state.towers[0].id);
  runFrames(5);
  check('info panel shows selected tower (RU)', elements['info-panel'].innerHTML.includes('Песчаная башня'));

  documentStub.fire('keydown', { code: 'Escape', key: 'Escape' });
  check('Escape clears selection', YTD.ui.selectedTowerId === null);

  // Escape again -> pause menu (autosaves)
  documentStub.fire('keydown', { code: 'Escape', key: 'Escape' });
  check('Escape opens pause menu', YTD.app.state === 'menu' && YTD.app.menuMode === 'pause' &&
    !elements['screen-pause'].classList.contains('hidden'));
  elements['menu-resume'].fire('click');
  check('Resume returns to the game', YTD.app.state === 'playing');

  // Main menu -> Continue restores the saved session
  YTD.app.openMainMenu();
  check('main menu shows with continue enabled',
    !elements['screen-main'].classList.contains('hidden') && elements['menu-continue'].disabled === false);
  elements['menu-continue'].fire('click');
  check('Continue resumes the session',
    YTD.app.state === 'playing' && YTD.sim.state.gold === 48 && YTD.sim.state.towers.length === 1,
    `gold=${YTD.sim.state.gold}, towers=${YTD.sim.state.towers.length}`);

  // mass actions via the selected-tower panel (0.6.0)
  YTD.ui.buildBtns.arrow.fire('click');
  canvas.fire('click', { clientX: 306, clientY: 126, shiftKey: false }); // build 2nd at (8,3)
  canvas.fire('click', { clientX: 270, clientY: 126, shiftKey: false }); // select (7,3)
  runFrames(3);
  check('panel offers mass actions', elements['info-panel'].innerHTML.includes('Улучшить все (2)'),
    'html len ' + elements['info-panel'].innerHTML.length);
  elements['sell-all-btn'].fire('click');
  runFrames(2);
  check('sell-all removes all towers of the type',
    YTD.sim.state.towers.length === 0 && YTD.sim.state.gold === 52,
    `towers=${YTD.sim.state.towers.length}, gold=${YTD.sim.state.gold}`);

  // run wave 1 at max speed
  YTD.loop.speed = 3;
  const goldBefore = YTD.sim.state.gold;
  YTD.sim.startWave();
  let frames = 0;
  while (YTD.sim.state.phase === 'wave' && frames < 8000) { runFrames(1); frames++; }
  check('wave 1 completes', YTD.sim.state.phase === 'build' && YTD.sim.state.waveIndex === 1,
    `phase=${YTD.sim.state.phase}, lives=${YTD.sim.state.lives}`);
  check('income received (kills + bonus)', YTD.sim.state.gold > goldBefore,
    `gold ${goldBefore} -> ${YTD.sim.state.gold}`);
  runFrames(10);

  // settings: turning floating text off reaches the renderer and persists
  elements['set-floating'].checked = false;
  elements['set-floating'].fire('change');
  check('settings change applies to renderer', YTD.renderer.showFloatingText === false);
  check('settings change persists in settings object', YTD.settings.floatingText === false);

  // --- 0.9.0: audio layer (degrades to a silent no-op without AudioContext) ---
  check('audio engine present', !!YTD.audio);
  check('audio ingest tolerates events without AudioContext', (() => {
    try {
      YTD.audio.ingestEvents([{ type: 'shot' }, { type: 'explosion' }, { type: 'chainHit' },
        { type: 'kill' }, { type: 'leak' }, { type: 'waveStart' }, { type: 'victory' }]);
      return true;
    } catch (e) { return false; }
  })());
  check('audio click() (menu navigation sound) tolerates missing AudioContext', (() => {
    try { YTD.audio.click(); return true; } catch (e) { return false; }
  })());
  elements['set-sound'].checked = false;
  elements['set-sound'].fire('change');
  check('sound toggle reaches audio engine and settings',
    YTD.audio.enabled === false && YTD.settings.soundOn === false);
  elements['set-volume'].value = '30';
  elements['set-volume'].fire('input');
  check('volume slider reaches audio engine',
    Math.abs(YTD.audio.volume - 0.3) < 1e-6 && Math.abs(YTD.settings.soundVolume - 0.3) < 1e-6);
  elements['set-music'].checked = true;
  elements['set-music'].fire('change');
  check('music toggle reaches audio engine and settings',
    YTD.audio.musicOn === true && YTD.settings.musicOn === true);
  elements['set-music-volume'].value = '25';
  elements['set-music-volume'].fire('input');
  check('music volume slider reaches audio engine',
    Math.abs(YTD.audio.musicVolume - 0.25) < 1e-6 && Math.abs(YTD.settings.musicVolume - 0.25) < 1e-6);

  // pause toggle
  elements['pause-btn'].fire('click');
  check('pause toggles', YTD.loop.paused === true);
  runFrames(5);
  elements['pause-btn'].fire('click');

  // --- 0.8.0: canyon version — separate map, towers and save slot ---
  YTD.app.openMainMenu();
  elements['menu-new'].fire('click');
  elements['version-cards'].children[1].fire('click'); // canyon
  elements['diff-buttons'].children[1].fire('click');  // normal
  check('canyon game starts', YTD.app.state === 'playing' && YTD.versionId === 'canyon',
    `state=${YTD.app.state}, version=${YTD.versionId}`);
  check('canvas resized for the canyon map (20x20 @36)',
    elements['game-canvas'].width === 720 && elements['game-canvas'].height === 720,
    `${elements['game-canvas'].width}x${elements['game-canvas'].height}`);
  check('canyon sim uses its own configs',
    YTD.sim.map.cols === 20 && YTD.sim.waves.length === 24);
  check('build panel swapped to canyon towers (6, storm, no sniper)',
    Object.keys(YTD.ui.buildBtns).length === 6 &&
    'storm' in YTD.ui.buildBtns && !('sniper' in YTD.ui.buildBtns));
  runFrames(10);
  const classicSave = YTD.Storage.loadGame('classic');
  const canyonSave = YTD.Storage.loadGame('canyon');
  check('saves live in separate per-version slots',
    !!(classicSave && classicSave.state) && !!(canyonSave && canyonSave.state) &&
    classicSave.versionId === 'classic' && canyonSave.versionId === 'canyon');

  // --- 0.10.0: Nightmare unlock + leaderboard ---
  check('Nightmare stays locked before any Hard win', !YTD.Storage.hasWon('hard'));
  YTD.Storage.recordVictory('hard');
  check('Nightmare unlocks after a recorded Hard win', YTD.Storage.hasWon('hard'));
  YTD.menu.show('difficulty');
  // FakeElement.innerHTML='' doesn't clear .children (test stub limitation),
  // so buttons from earlier rebuilds pile up — the latest batch is the tail.
  const lastDiffBtn = elements['diff-buttons'].children[elements['diff-buttons'].children.length - 1];
  check('Nightmare button unlocks live in the menu after victory',
    lastDiffBtn.disabled === false && !String(lastDiffBtn.className).includes('locked'));

  YTD.Storage.addRecord('canyon', 'normal', { wave: 24, lives: 30, gold: 700, ticks: 14000, won: true, at: Date.now() });
  YTD.Storage.addRecord('canyon', 'normal', { wave: 10, lives: 0, gold: 300, ticks: 5000, won: false, at: Date.now() });
  const records = YTD.Storage.getRecords('canyon', 'normal');
  check('records are sorted best-first and capped',
    records.length === 2 && records[0].wave === 24 && records[1].wave === 10);
  YTD.menu.show('records');
  check('records screen renders a leaderboard table',
    elements['records-body'].innerHTML.includes('Каньон') && elements['records-body'].innerHTML.includes('24'));
  YTD.menu.show('main');

  // --- 0.11.0: endless mode + challenge modifiers ---
  {
    YTD.app.openMainMenu();
    elements['menu-new'].fire('click');
    elements['version-cards'].children[0].fire('click'); // classic

    // 1.0.0: challenges live on their own sub-screen, reached from difficulty.
    check('challenges count badge starts empty', elements['challenges-count'].textContent === '');
    elements['open-challenges'].fire('click');
    check('opening challenges shows its screen and hides difficulty',
      !elements['screen-challenges'].classList.contains('hidden') &&
      elements['screen-difficulty'].classList.contains('hidden'));
    elements['mode-nosell'].checked = true;
    elements['mode-fastcreeps'].checked = true;
    elements['mode-nosell'].fire('change');
    elements['mode-fastcreeps'].fire('change');
    check('challenges count badge reflects 2 active challenges',
      elements['challenges-count'].textContent === '(2)');
    elements['back-from-challenges'].fire('click');
    check('back from challenges returns to the difficulty screen',
      !elements['screen-difficulty'].classList.contains('hidden') &&
      elements['screen-challenges'].classList.contains('hidden'));

    elements['mode-endless'].checked = true;
    const diffBtns = elements['diff-buttons'];
    diffBtns.children[diffBtns.children.length - 3].fire('click'); // normal (of the latest 4-button batch)
    check('endless run starts with the chosen modifiers',
      YTD.sim.endless === true && YTD.sim.modifiers.noSell === true &&
      YTD.sim.modifiers.creepSpeedMul === 1.5 && !YTD.sim.modifiers.oneTowerPerType,
      JSON.stringify({ endless: YTD.sim.endless, mods: YTD.sim.modifiers }));
    check('footer shows the Эндлесс badge',
      String(elements['footer-line'].textContent).includes('Эндлесс'));
    check('noSell modifier is enforced by the engine', (() => {
      YTD.sim.build('arrow', 10, 3);
      const t = YTD.sim.towerAt(10, 3);
      const r = YTD.sim.sell(t.id);
      return !r.ok && r.error === 'noSell';
    })());

    // Restarting must preserve the mode (regression guard for restartGame()).
    elements['mode-endless'].checked = false; // stale UI state must not leak back in
    elements['menu-btn'].fire('click');
    elements['menu-restart'].fire('click');
    check('restart preserves endless + modifiers', YTD.sim.endless === true && YTD.sim.modifiers.noSell === true);

    // Force a quick defeat through the real frame loop -> lands in the '-endless' bucket.
    YTD.sim.state.lives = 1;
    YTD.sim.state.waveIndex = YTD.sim.waves.length; // past the scripted list
    YTD.sim.state.phase = 'build';
    YTD.sim.startWave();
    // Drain lives directly: cheaper and just as valid as playing the defeat out.
    YTD.sim.state.lives = 0;
    YTD.sim.state.phase = 'defeat';
    YTD.sim.state.events = [{ type: 'defeat' }];
    YTD.renderer.ingestEvents(YTD.sim.state.events);
    YTD.audio.ingestEvents(YTD.sim.state.events);
    for (const ev of YTD.sim.state.events) {
      if (ev.type === 'defeat') YTD.Storage.addRecord(YTD.versionId, 'normal-endless',
        { wave: YTD.sim.state.waveIndex, lives: 0, gold: YTD.sim.state.gold, ticks: YTD.sim.state.tick, won: false, at: Date.now() });
    }
    const endlessRecords = YTD.Storage.getRecords('classic', 'normal-endless');
    check('endless defeat lands in its own leaderboard bucket',
      endlessRecords.length === 1 && endlessRecords[0].wave >= YTD.sim.waves.length,
      JSON.stringify(endlessRecords));
    YTD.menu.show('records');
    check('records screen labels the endless bucket separately',
      elements['records-body'].innerHTML.includes('Эндлесс'));
    YTD.menu.show('main');

    // Clean up: back to a normal (non-endless) canyon run — the rest of the
    // suite expects canyon/normal to be the most recently active session.
    YTD.app.startNewGame('normal', 'canyon');
  }

  // continue button reports which save is the most recent one
  YTD.app.openMainMenu();
  check('continue caption mentions the saved version',
    String(elements['menu-continue'].textContent).includes('Каньон'),
    elements['menu-continue'].textContent);
  elements['menu-continue'].fire('click');
  check('continue restores the canyon session',
    YTD.app.state === 'playing' && YTD.versionId === 'canyon' && YTD.sim.map.cols === 20);

  // --- 0.10.0: victory overlay shows "Новый рекорд!" when this run tops the board ---
  {
    const sim = YTD.sim;
    sim.state.waveIndex = sim.waves.length - 1; // last wave
    sim.state.phase = 'build';
    sim.state.lives = 30;
    sim.state.gold = 999999; // guarantee it wins the gold tie-break vs the earlier synthetic record
    sim.startWave();
    sim.state.creeps = [];
    sim.state.spawns = [];
    YTD.loop.paused = false;
    runFrames(3);
    check('forced run reached victory', sim.state.phase === 'victory', `phase=${sim.state.phase}`);
    check('victory overlay shows the new-record badge',
      elements['overlay-title'].innerHTML.includes('Новый рекорд'),
      elements['overlay-title'].innerHTML);
    const top = YTD.Storage.getRecords('canyon', 'normal')[0];
    check('the new record is actually on top of the canyon/normal leaderboard',
      top && top.wave === 24 && top.gold > 999999, JSON.stringify(top));
    // Victory clears the canyon autosave — start a fresh run so the save/export
    // checks further down still have a canyon save to work with.
    YTD.app.startNewGame('normal', 'canyon');
  }

  // menu button -> pause screen; exit lives on the main screen
  elements['menu-btn'].fire('click');
  check('Menu button opens pause menu', YTD.app.state === 'menu' && YTD.app.menuMode === 'pause');
  elements['menu-to-main'].fire('click');
  check('To main menu switches mode', YTD.app.menuMode === 'main');
  elements['menu-exit'].fire('click');

  // --- 0.7.0: platform layer, async exit, save export/import ---
  (async () => {
    try {
      await new Promise(r => setImmediate(r));
      check('Exit shows farewell screen (async fallback)',
        !elements['screen-exit'].classList.contains('hidden'));
      check('platform: browser mode in tests',
        windowStub.Platform && windowStub.Platform.isTauri() === false);
      const save = YTD.Storage.loadGame('canyon');
      check('autosave exists for export', !!(save && save.state && save.versionId === 'canyon'));
      check('export button enabled with save', elements['menu-export'].disabled === false);
      YTD.Storage.clearGame('classic');
      YTD.Storage.clearGame('canyon');
      YTD.menu.refresh();
      check('continue disabled after clearing saves', elements['menu-continue'].disabled === true);
      windowStub.Platform.importText = async () =>
        JSON.stringify(Object.assign({}, save, { version: '0.0.1' }));
      elements['menu-import'].fire('click');
      await new Promise(r => setImmediate(r));
      check('import rejects wrong version',
        !YTD.Storage.loadGame('canyon') && (elements['menu-message'].textContent || '').length > 0,
        elements['menu-message'].textContent);
      windowStub.Platform.importText = async () => JSON.stringify(save);
      elements['menu-import'].fire('click');
      await new Promise(r => setImmediate(r));
      const restored = YTD.Storage.loadGame('canyon');
      check('import restores save into its version slot and enables continue',
        !!restored && restored.version === save.version && restored.versionId === 'canyon' &&
        elements['menu-continue'].disabled === false);
    } catch (err2) {
      console.error('[FAIL] async platform tests:', err2);
      failures++;
    }
    console.log(failures === 0 ? '\nAll DOM smoke tests passed.' : `\n${failures} test(s) FAILED.`);
    process.exit(failures === 0 ? 0 : 1);
  })();
} catch (err) {
  console.error('[FAIL] uncaught error during interaction:', err);
  process.exit(1);
}
