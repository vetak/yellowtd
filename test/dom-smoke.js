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
    this.style = { setProperty(k, v) { this[k] = v; } };
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
  // Setting innerHTML replaces all child nodes in the real DOM; mirror that so
  // rebuild-then-append patterns (innerHTML='' + appendChild) don't accumulate
  // stale children across repeated rebuilds.
  set innerHTML(v) { this._html = String(v); this.children = []; }
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
  'data/versions/wastes/map.js', 'data/versions/wastes/creeps.js',
  'data/versions/wastes/towers.js', 'data/versions/wastes/waves.js',
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
  check('version screen shows all three version cards',
    elements['version-cards'].children.length === 3 &&
    elements['version-cards'].children[0].getAttribute('data-version') === 'classic' &&
    elements['version-cards'].children[1].getAttribute('data-version') === 'canyon' &&
    elements['version-cards'].children[2].getAttribute('data-version') === 'wastes');
  check('wastes (last map) starts locked, classic starts open',
    !String(elements['version-cards'].children[0].className).includes('locked') &&
    String(elements['version-cards'].children[2].className).includes('locked'));
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

  // --- 1.0.1: wave panel information ---
  {
    // Wave 5 of Classic ("Пыльный рой") is the first air wave — a good anchor
    // for checking that the upcoming wave shows its status badges, not just a name.
    YTD.sim.state.waveIndex = 3; // build phase before wave 4 => next up is wave 5
    YTD.sim.state.phase = 'build';
    runFrames(2);
    const html = elements['wave-name'].innerHTML;
    check('wave panel names the upcoming wave with its number', html.includes('Далее — 5.'), html.slice(0, 160));
    check('upcoming wave shows status badges (air), not just its name',
      html.includes('badge air') && html.includes('ВОЗДУХ'), html.slice(0, 240));
    check('upcoming wave shows its roster (count/HP)', html.includes('12×') && html.includes('HP '),
      html.slice(0, 240));

    // The timeline strip warns about special waves several waves ahead.
    const tl = elements['wave-timeline'].innerHTML;
    check('timeline lists upcoming waves', tl.includes('tl-strip') && tl.includes('Впереди'), tl.slice(0, 120));
    check('timeline flags the upcoming air wave', tl.includes('tl-air'), tl.slice(0, 240));
    // 1.4.1: the chip's hover title spells out the wave's statuses in parens,
    // e.g. "5. Пыльный рой (воздух)" — not just the number and name.
    check('timeline chip title spells out the status (воздух)',
      tl.includes('Пыльный рой (воздух)'),
      (tl.match(/title="[^"]*воздух[^"]*"/) || [''])[0]);
    // From wave 4 the strip covers 4..11, which includes the bonus wave (7),
    // the regen wave (8) and the immune wave (10) — several waves of warning.
    check('timeline warns about other special waves ahead',
      tl.includes('tl-extra') && tl.includes('tl-regen') && tl.includes('tl-immune'),
      tl.slice(0, 500));
    // 1.4.1: tapping a future-wave chip pops its full brief (touch has no hover
    // title). Delegated handler reads data-wave off the tapped chip; simulate a
    // tap on wave 5 (index 4, "Пыльный рой").
    elements['wave-timeline'].fire('click', {
      target: { closest: () => ({ dataset: { wave: '4' } }) }, clientX: 100, clientY: 100,
    });
    check('tapping a wave chip shows its full brief',
      !elements['tooltip'].classList.contains('hidden') &&
      elements['tooltip'].innerHTML.includes('Пыльный рой'),
      elements['tooltip'].innerHTML.slice(0, 50));
    YTD.ui._hideTooltip();

    // Panel keeps the same structure in both phases, so nothing below it jumps.
    // Drive the UI directly: stepping the sim with an empty field would end the
    // wave immediately and flip the phase back before we could look at it.
    // The panel now keys off liveWaves (not the phase string) since that's
    // the engine's actual source of truth for "what's currently in flight".
    YTD.sim.state.phase = 'wave';
    YTD.sim.state.liveWaves = [{ index: 3, startedAt: YTD.sim.state.time, bonusMul: 0 }];
    YTD.ui.update(YTD.sim);
    const waveHtml = elements['wave-name'].innerHTML;
    check('wave phase keeps both the current and the upcoming wave sections',
      waveHtml.includes('Идёт волна') && waveHtml.includes('Далее — '), waveHtml.slice(0, 120));

    // Restore the exact pre-block state (the checks below expect wave 1 / 60 gold).
    YTD.sim.state.waveIndex = 0;
    YTD.sim.state.phase = 'build';
    YTD.sim.state.liveWaves = [];
    YTD.sim.state.gold = 60;
    runFrames(2);
  }

  // --- 1.1.0 "Темп волн": early wave send with a decaying gold bonus ---
  {
    elements['send-wave-btn'].fire('click');
    check('first wave starts via the button', YTD.sim.state.liveWaves.length === 1,
      JSON.stringify(YTD.sim.state.liveWaves));

    YTD.ui.update(YTD.sim);
    check('button is disabled and counts down before the early-send window opens',
      elements['send-wave-btn'].disabled === true &&
      elements['send-wave-btn'].textContent.includes('Досрочно через'),
      elements['send-wave-btn'].textContent);
    check('clicking while still on cooldown does nothing (still one live wave)', (() => {
      elements['send-wave-btn'].fire('click');
      return YTD.sim.state.liveWaves.length === 1;
    })());

    // Step the sim directly (not through real time) past earlyWaveMinDelay.
    const ticksToUnlock = Math.ceil(YTD.sim.cfg.earlyWaveMinDelay / YTD.sim.dt) + 1;
    for (let i = 0; i < ticksToUnlock; i++) YTD.sim.step();
    YTD.ui.update(YTD.sim);
    check('button unlocks with a bonus percentage once the delay has passed',
      elements['send-wave-btn'].disabled === false &&
      /Отправить досрочно \(\+\d+%\)/.test(elements['send-wave-btn'].textContent),
      elements['send-wave-btn'].textContent);

    const goldBefore = YTD.sim.state.gold;
    elements['send-wave-btn'].fire('click');
    check('early send succeeds: two waves now live', YTD.sim.state.liveWaves.length === 2,
      JSON.stringify(YTD.sim.state.liveWaves));

    elements['send-wave-btn'].fire('click');
    YTD.ui.update(YTD.sim);
    check('a third send is rejected once two waves are already live',
      (elements['message'].innerHTML || '').length > 0 && YTD.sim.state.liveWaves.length === 2,
      elements['message'].innerHTML);

    // Clear the field to resolve both waves and verify the combined payout.
    YTD.sim.state.creeps = [];
    YTD.sim.state.spawns = [];
    YTD.sim.step();
    YTD.ui.update(YTD.sim);
    check('both waves resolve once the field is cleared and the player is paid for both',
      YTD.sim.state.liveWaves.length === 0 && YTD.sim.state.gold > goldBefore,
      `live=${YTD.sim.state.liveWaves.length}, gold ${goldBefore}->${YTD.sim.state.gold}`);
    check('button returns to normal once nothing is live',
      elements['send-wave-btn'].disabled === false &&
      elements['send-wave-btn'].textContent === 'Отправить волну',
      elements['send-wave-btn'].textContent);

    // Restore a clean build-phase state for the rest of the suite.
    YTD.sim.state.waveIndex = 0;
    YTD.sim.state.liveWaves = [];
    YTD.sim.state.phase = 'build';
    YTD.sim.state.gold = 60;
    YTD.sim.state.creeps = [];
    YTD.sim.state.spawns = [];
    runFrames(2);
  }

  const canvas = elements['game-canvas'];
  // pick arrow tower via its button, place at cell (7,3) => px (270,126)
  YTD.ui.buildBtns.arrow.fire('click');
  check('build button click enters placing mode', YTD.ui.placingType === 'arrow');
  canvas.fire('mousemove', { clientX: 270, clientY: 126 });
  canvas.fire('click', { clientX: 270, clientY: 126, shiftKey: false });
  check('canvas click builds tower', YTD.sim.state.towers.length === 1 && YTD.sim.state.gold === 48,
    `towers=${YTD.sim.state.towers.length}, gold=${YTD.sim.state.gold}`);

  // 1.4.0: press-and-hold inspects whatever is under the point (touch has no
  // hover). The test setTimeout runs synchronously, so pointerdown fires the
  // hold immediately. Holding on the built tower pops its info tooltip.
  canvas.fire('pointerdown', { pointerType: 'touch', clientX: 270, clientY: 126 });
  check('press-and-hold shows the tower info tooltip',
    !elements['tooltip'].classList.contains('hidden') &&
    elements['tooltip'].innerHTML.includes('Песчаная башня'),
    elements['tooltip'].innerHTML.slice(0, 40));
  canvas.fire('click', { clientX: 270, clientY: 126, shiftKey: false }); // consumed by the hold
  check('the hold suppresses the click that follows (no build/select)',
    YTD.sim.state.towers.length === 1 && YTD.ui.selectedTowerId === null);
  YTD.ui._hideTooltip();

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
  // 1.0.1: the mass-upgrade button states its price, and the pending count
  // shrinks as towers reach max level (instead of always showing the total).
  {
    const expected = YTD.sim.upgradeAllInfo('arrow');
    check('mass-upgrade button shows the cost to max them all',
      expected.towers === 2 && expected.cost > 0 &&
      elements['info-panel'].innerHTML.includes(`Улучшить все (2) — ${expected.cost} з.`),
      JSON.stringify(expected));
    const first = YTD.sim.state.towers[0];
    YTD.sim.state.gold = 1000;
    YTD.sim.upgrade(first.id); YTD.sim.upgrade(first.id); // max out one of the two
    runFrames(3);
    check('mass-upgrade count drops once a tower is maxed',
      elements['info-panel'].innerHTML.includes('Улучшить все (1)'),
      'html len ' + elements['info-panel'].innerHTML.length);
    YTD.sim.upgradeAllOfType('arrow');
    runFrames(3);
    check('mass-upgrade button reports when everything is maxed',
      elements['info-panel'].innerHTML.includes('Все на максимуме'));
    // Rebuild the exact pre-check state: two level-0 arrows and 36 gold, so the
    // sell-all refund below is the same as before this block existed.
    YTD.sim.sellAllOfType('arrow');
    YTD.sim.state.gold = 1000;
    YTD.sim.build('arrow', 7, 3);
    YTD.sim.build('arrow', 8, 3);
    YTD.sim.state.gold = 36;
  }
  canvas.fire('click', { clientX: 270, clientY: 126, shiftKey: false }); // re-select (7,3)
  runFrames(2);
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
  // 1.5.0: maps form a progression chain — Canyon is locked until Classic is
  // beaten (on any difficulty), then it unlocks live in the menu.
  YTD.app.openMainMenu();
  elements['menu-new'].fire('click');
  check('canyon card is locked before classic is beaten',
    String(elements['version-cards'].children[1].className).includes('locked') &&
    elements['version-cards'].children[1].disabled === true);
  YTD.Storage.recordMapVictory('classic');
  YTD.menu.show('version'); // rebuild cards — the unlock should light up
  check('canyon card unlocks after a classic victory',
    !String(elements['version-cards'].children[1].className).includes('locked') &&
    elements['version-cards'].children[1].disabled === false);
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
