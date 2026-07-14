// Headless smoke test for the simulation. Run with: node test/smoke.js
// Works because engine/ and data/ never touch the DOM.
// 0.8.0: parametrized by map version — both Classic and Canyon run the full
// cycle (victory on Normal/Hard with their own build plans, defeat, mechanics).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = [
  'data/config.js',
  'data/versions/classic/map.js', 'data/versions/classic/creeps.js',
  'data/versions/classic/towers.js', 'data/versions/classic/waves.js',
  'data/versions/canyon/map.js', 'data/versions/canyon/creeps.js',
  'data/versions/canyon/towers.js', 'data/versions/canyon/waves.js',
  'data/versions.js',
  'engine/path.js', 'engine/sim.js',
];
const source = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n')
  + '\nglobalThis.__engine = { Simulation, GameConfig, DifficultyConfig,'
  + ' VersionsConfig, VersionOrder, GAME_VERSION };';

const ctx = vm.createContext({});
vm.runInContext(source, ctx);
const E = ctx.__engine;

function newSim(diffId, versionId) {
  const v = E.VersionsConfig[versionId || 'classic'];
  return new E.Simulation({
    game: E.GameConfig, map: v.map, towers: v.towers,
    creeps: v.creeps, waves: v.waves,
    difficulty: E.DifficultyConfig[diffId || 'normal'],
  });
}

function run(plan, opts) {
  opts = opts || {};
  let sim = newSim(opts.difficulty, opts.version);
  const pending = plan.map(a => Object.assign({}, a, { done: false }));
  const stats = {
    slowSeen: false, poisonSeen: false, multishotVolley: false,
    splashMultiHit: false, aaHitAir: false, aaHitGround: false,
    chainEvents: 0, stormChainMultiHit: false,
    leaks: 0, kills: 0, buildRejected: [],
  };
  let restored = false;
  const maxTicks = E.GameConfig.tickRate * 60 * 90;

  while (!sim.isOver() && sim.state.tick < maxTicks) {
    if (sim.state.phase === 'build') {
      if (opts.saveRestoreAtWave !== undefined && !restored &&
          sim.state.waveIndex >= opts.saveRestoreAtWave) {
        const snapshot = sim.exportState();
        sim = newSim(opts.difficulty, opts.version);
        sim.importState(snapshot);
        restored = true;
      }
      let acted = true;
      while (acted) {
        acted = false;
        for (const a of pending) {
          if (a.done || a.wave > sim.state.waveIndex) continue;
          let r = { ok: false };
          if (a.action === 'build') {
            r = sim.build(a.tower, a.col, a.row);
            if (!r.ok && r.error !== 'gold' && !a.reported) {
              a.reported = true;
              stats.buildRejected.push(`${a.tower}@${a.col},${a.row}:${r.error}`);
            }
          } else if (a.action === 'upgrade') {
            const t = sim.towerAt(a.col, a.row);
            if (t) r = sim.upgrade(t.id);
          }
          if (r.ok) { a.done = true; acted = true; }
        }
      }
      sim.startWave();
    }
    sim.step();

    for (const ev of sim.state.events) {
      if (ev.type === 'kill') stats.kills++;
      if (ev.type === 'leak') stats.leaks++;
      if (ev.type === 'chainHit') stats.chainEvents++;
      if (ev.type === 'hit' && ev.source === 'antiair') {
        if (ev.creepType === 'air') stats.aaHitAir = true;
        else stats.aaHitGround = true;
      }
    }
    for (const src of ['cannon', 'storm']) {
      const hits = sim.state.events.filter(e => e.type === 'hit' && e.source === src);
      const byProj = {};
      for (const h of hits) byProj[h.projectileId] = (byProj[h.projectileId] || 0) + 1;
      if (Object.values(byProj).some(n => n >= 2)) {
        if (src === 'cannon') stats.splashMultiHit = true;
        else stats.stormChainMultiHit = true;
      }
    }
    if (!stats.slowSeen && sim.state.creeps.some(c => c.slowFactor < 1 && c.slowUntil > sim.state.time)) {
      stats.slowSeen = true;
    }
    if (!stats.poisonSeen && sim.state.creeps.some(c => (c.poisonUntil || 0) > sim.state.time)) {
      stats.poisonSeen = true;
    }
    if (!stats.multishotVolley) {
      const ms = sim.state.projectiles.filter(p => p.typeId === 'multishot');
      const byTower = {};
      for (const p of ms) {
        byTower[p.towerId] = byTower[p.towerId] || new Set();
        byTower[p.towerId].add(p.targetId);
      }
      if (Object.values(byTower).some(set => set.size >= 2)) stats.multishotVolley = true;
    }
  }
  return {
    sim, stats, result: sim.state.phase, lives: sim.state.lives,
    wave: sim.state.waveIndex, gold: sim.state.gold, ticks: sim.state.tick,
  };
}

let failures = 0;
function check(label, cond, extra) {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`[${mark}] ${label}${extra ? ' — ' + extra : ''}`);
}

// ======================================================= version registry

check('registry: classic and canyon registered',
  E.VersionOrder.length === 2 && !!E.VersionsConfig.classic && !!E.VersionsConfig.canyon);
check('registry: canyon has storm, no sniper/multishot',
  'storm' in E.VersionsConfig.canyon.towers &&
  !('sniper' in E.VersionsConfig.canyon.towers) &&
  !('multishot' in E.VersionsConfig.canyon.towers));
check('registry: canyon map differs (20x20, 14 turns)',
  E.VersionsConfig.canyon.map.cols === 20 && E.VersionsConfig.canyon.map.rows === 20 &&
  E.VersionsConfig.canyon.map.waypoints.length >= 14);
check('registry: canyon has 24 waves, classic 36',
  E.VersionsConfig.canyon.waves.length === 24 && E.VersionsConfig.classic.waves.length === 36);

// ============================================================== CLASSIC

// Map 24x18, road rows 2/5/8/11/14. Build rows 3-4/6-7/9-10/12-13, cols 9-14.
const planGood = [
  { wave: 0,  action: 'build',   tower: 'arrow',     col: 10, row: 3 },
  { wave: 0,  action: 'build',   tower: 'arrow',     col: 13, row: 3 },
  { wave: 1,  action: 'build',   tower: 'frost',     col: 11, row: 4 },
  { wave: 2,  action: 'upgrade', col: 10, row: 3 },
  { wave: 3,  action: 'build',   tower: 'cannon',    col: 11, row: 6 },
  { wave: 4,  action: 'build',   tower: 'antiair',   col: 12, row: 4 },
  { wave: 4,  action: 'upgrade', col: 13, row: 3 },
  { wave: 5,  action: 'build',   tower: 'multishot', col: 9,  row: 6 },
  { wave: 6,  action: 'upgrade', col: 11, row: 6 },
  { wave: 7,  action: 'build',   tower: 'poison',    col: 10, row: 7 },
  { wave: 8,  action: 'upgrade', col: 12, row: 4 },
  { wave: 9,  action: 'build',   tower: 'sniper',    col: 11, row: 9 },
  { wave: 10, action: 'build',   tower: 'antiair',   col: 13, row: 9 },
  { wave: 10, action: 'upgrade', col: 12, row: 4 },
  { wave: 11, action: 'upgrade', col: 9,  row: 6 },
  { wave: 12, action: 'upgrade', col: 11, row: 4 },
  { wave: 12, action: 'upgrade', col: 10, row: 3 },
  { wave: 13, action: 'upgrade', col: 13, row: 9 },
  { wave: 14, action: 'upgrade', col: 10, row: 7 },
  { wave: 15, action: 'upgrade', col: 11, row: 9 },
  { wave: 16, action: 'build',   tower: 'cannon',    col: 12, row: 12 },
  { wave: 16, action: 'upgrade', col: 12, row: 12 },
  { wave: 17, action: 'upgrade', col: 13, row: 9 },
  { wave: 18, action: 'upgrade', col: 11, row: 6 },
  { wave: 19, action: 'build',   tower: 'frost',     col: 12, row: 10 },
  { wave: 19, action: 'upgrade', col: 12, row: 10 },
  { wave: 20, action: 'upgrade', col: 9,  row: 6 },
  { wave: 21, action: 'upgrade', col: 10, row: 7 },
  { wave: 22, action: 'build',   tower: 'arrow',     col: 14, row: 12 },
  { wave: 22, action: 'upgrade', col: 14, row: 12 },
  { wave: 22, action: 'upgrade', col: 13, row: 3 },
  { wave: 23, action: 'upgrade', col: 11, row: 4 },
  { wave: 23, action: 'upgrade', col: 12, row: 12 },
  // ---- Акт III
  { wave: 24, action: 'build',   tower: 'sniper',    col: 13, row: 7 },
  { wave: 24, action: 'upgrade', col: 13, row: 7 },
  { wave: 25, action: 'build',   tower: 'poison',    col: 12, row: 7 },
  { wave: 25, action: 'upgrade', col: 12, row: 7 },
  { wave: 26, action: 'upgrade', col: 12, row: 10 },
  { wave: 26, action: 'upgrade', col: 12, row: 7 },
  { wave: 27, action: 'build',   tower: 'multishot', col: 10, row: 9 },
  { wave: 27, action: 'upgrade', col: 10, row: 9 },
  { wave: 28, action: 'build',   tower: 'antiair',   col: 14, row: 9 },
  { wave: 28, action: 'upgrade', col: 14, row: 9 },
  { wave: 29, action: 'upgrade', col: 14, row: 9 },
  { wave: 29, action: 'upgrade', col: 10, row: 9 },
  { wave: 30, action: 'build',   tower: 'arrow',     col: 15, row: 12 },
  { wave: 30, action: 'upgrade', col: 15, row: 12 },
  { wave: 31, action: 'build',   tower: 'cannon',    col: 13, row: 12 },
  { wave: 31, action: 'upgrade', col: 13, row: 12 },
  { wave: 32, action: 'upgrade', col: 13, row: 12 },
  { wave: 32, action: 'upgrade', col: 15, row: 12 },
  { wave: 33, action: 'build',   tower: 'sniper',    col: 12, row: 6 },
  { wave: 33, action: 'upgrade', col: 12, row: 6 },
  { wave: 34, action: 'build',   tower: 'poison',    col: 9,  row: 9 },
  { wave: 34, action: 'upgrade', col: 9,  row: 9 },
  { wave: 35, action: 'upgrade', col: 9,  row: 9 },
  // Лейт-докупка: игрок продолжает тратить золото
  { wave: 24, action: 'build',   tower: 'sniper',    col: 15, row: 6 },
  { wave: 25, action: 'upgrade', col: 15, row: 6 },
  { wave: 25, action: 'build',   tower: 'cannon',    col: 16, row: 6 },
  { wave: 26, action: 'upgrade', col: 16, row: 6 },
  { wave: 27, action: 'upgrade', col: 16, row: 6 },
  { wave: 26, action: 'build',   tower: 'sniper',    col: 15, row: 7 },
  { wave: 27, action: 'upgrade', col: 15, row: 7 },
  { wave: 27, action: 'build',   tower: 'poison',    col: 6,  row: 9 },
  { wave: 28, action: 'upgrade', col: 6,  row: 9 },
  { wave: 29, action: 'upgrade', col: 6,  row: 9 },
  { wave: 28, action: 'build',   tower: 'cannon',    col: 7,  row: 9 },
  { wave: 29, action: 'upgrade', col: 7,  row: 9 },
  { wave: 30, action: 'upgrade', col: 7,  row: 9 },
  { wave: 29, action: 'build',   tower: 'sniper',    col: 15, row: 9 },
  { wave: 30, action: 'upgrade', col: 15, row: 9 },
  { wave: 30, action: 'build',   tower: 'arrow',     col: 16, row: 9 },
  { wave: 31, action: 'upgrade', col: 16, row: 9 },
  { wave: 31, action: 'upgrade', col: 16, row: 9 },
  { wave: 31, action: 'build',   tower: 'multishot', col: 6,  row: 10 },
  { wave: 32, action: 'upgrade', col: 6,  row: 10 },
  { wave: 33, action: 'upgrade', col: 6,  row: 10 },
  { wave: 32, action: 'build',   tower: 'sniper',    col: 15, row: 10 },
  { wave: 33, action: 'upgrade', col: 15, row: 10 },
  { wave: 33, action: 'build',   tower: 'cannon',    col: 8,  row: 12 },
  { wave: 34, action: 'upgrade', col: 8,  row: 12 },
  { wave: 35, action: 'upgrade', col: 8,  row: 12 },
  { wave: 34, action: 'build',   tower: 'arrow',     col: 9,  row: 12 },
  { wave: 34, action: 'upgrade', col: 9,  row: 12 },
  { wave: 35, action: 'upgrade', col: 9,  row: 12 },
  { wave: 35, action: 'build',   tower: 'sniper',    col: 16, row: 12 },
  { wave: 35, action: 'upgrade', col: 16, row: 12 },
  { wave: 30, action: 'build',   tower: 'cannon',    col: 17, row: 12 },
  { wave: 31, action: 'upgrade', col: 17, row: 12 },
  { wave: 32, action: 'upgrade', col: 17, row: 12 },
  { wave: 31, action: 'build',   tower: 'sniper',    col: 14, row: 13 },
  { wave: 32, action: 'upgrade', col: 14, row: 13 },
  { wave: 32, action: 'build',   tower: 'poison',    col: 10, row: 12 },
  { wave: 33, action: 'upgrade', col: 10, row: 12 },
  { wave: 34, action: 'upgrade', col: 10, row: 12 },
  { wave: 33, action: 'build',   tower: 'cannon',    col: 15, row: 13 },
  { wave: 34, action: 'upgrade', col: 15, row: 13 },
  { wave: 35, action: 'upgrade', col: 15, row: 13 },
  { wave: 34, action: 'build',   tower: 'sniper',    col: 5,  row: 6 },
  { wave: 35, action: 'upgrade', col: 5,  row: 6 },
  { wave: 35, action: 'build',   tower: 'arrow',     col: 16, row: 10 },
  { wave: 35, action: 'upgrade', col: 16, row: 10 },
  { wave: 35, action: 'upgrade', col: 16, row: 10 },
  { wave: 35, action: 'build',   tower: 'arrow',     col: 17, row: 9 },
  { wave: 35, action: 'upgrade', col: 17, row: 9 },
  { wave: 35, action: 'upgrade', col: 17, row: 9 },
];

const planWeak = [
  { wave: 0, action: 'build', tower: 'arrow', col: 10, row: 3 },
  { wave: 0, action: 'build', tower: 'arrow', col: 13, row: 3 },
];

const none = run([]);
check('classic: no towers → defeat early', none.result === 'defeat' && none.wave <= 3,
  `reached wave ${none.wave + 1}, lives ${none.lives}`);

const weak = run(planWeak);
check('classic: 2 arrows only → defeat before hero wave', weak.result === 'defeat' && weak.wave < 11,
  `reached wave ${weak.wave + 1}`);

const good = run(planGood);
check('classic: all plan placements are legal', good.stats.buildRejected.length === 0,
  good.stats.buildRejected.join('; ') || 'ok');
check('classic: good build → victory (normal, 36 waves)', good.result === 'victory',
  `phase ${good.result}, wave ${good.wave}, lives ${good.lives}, gold ${good.gold}`);
check('classic: victory with healthy lives margin', good.result === 'victory' && good.lives >= 8,
  `lives ${good.lives}`);
check('classic: economy: no huge gold surplus at victory', good.gold < 800,
  `gold ${good.gold}`);

check('classic: frost slow applied', good.stats.slowSeen);
check('classic: poison DoT applied', good.stats.poisonSeen);
check('classic: multishot fires volleys at 2+ targets', good.stats.multishotVolley);
check('classic: cannon splash hit 2+ creeps at once', good.stats.splashMultiHit);
check('classic: anti-air hit air creeps', good.stats.aaHitAir);
check('classic: anti-air never hit ground', !good.stats.aaHitGround);

// stats counters
{
  const st = good.sim.state;
  check('classic: stats counters tracked', st.totalKills > 300 && st.goldSpent > 500 && st.goldEarned > st.goldSpent,
    `kills ${st.totalKills}, earned ${st.goldEarned}, spent ${st.goldSpent}, leaks ${st.totalLeaks}`);
}

// mass actions
{
  const sim = newSim();
  sim.state.gold = 1000;
  sim.build('arrow', 10, 3); sim.build('arrow', 13, 3); sim.build('arrow', 15, 3);
  const r = sim.upgradeAllOfType('arrow');
  check('upgradeAllOfType maxes all towers', r.ok && r.upgraded === 6 &&
    sim.towersOfType('arrow').every(t => t.level === 2), JSON.stringify(r));
  const r2 = sim.upgradeAllOfType('arrow');
  check('upgradeAllOfType reports maxlevel', !r2.ok && r2.error === 'maxlevel');
  const rs = sim.sellAllOfType('arrow');
  check('sellAllOfType sells everything', rs.ok && rs.sold === 3 &&
    sim.state.towers.length === 0 && rs.refund === 3 * Math.floor(60 * 0.7), JSON.stringify(rs));
  const sim2 = newSim();
  sim2.build('arrow', 10, 3); sim2.build('arrow', 13, 3);
  sim2.state.gold = 20;
  const r3 = sim2.upgradeAllOfType('arrow');
  check('upgradeAllOfType stops at gold limit', r3.ok && r3.upgraded === 1 && sim2.state.gold === 2,
    JSON.stringify(r3));
}

// special waves: immune to slow (wave 10, idx 9)
{
  const sim = newSim();
  sim.state.lives = 999;
  sim.state.waveIndex = 9;
  sim.build('frost', 10, 3);
  sim.startWave();
  let slowedSeen = false;
  let frostHit = false;
  for (let i = 0; i < 20 * 120 && sim.state.phase === 'wave'; i++) {
    sim.step();
    if (sim.state.creeps.some(c => c.slowFactor < 1 && c.slowUntil > sim.state.time)) slowedSeen = true;
    if (sim.state.events.some(e => e.type === 'hit' && e.source === 'frost')) frostHit = true;
  }
  check('immuneToSlow wave never gets slowed (frost still damages)', !slowedSeen && frostHit);
}

// special waves: regen (wave 8, idx 7)
{
  const sim = newSim();
  sim.state.lives = 999;
  sim.state.waveIndex = 7;
  sim.build('arrow', 10, 3);
  sim.startWave();
  const prevHp = new Map();
  let regenSeen = false;
  for (let i = 0; i < 20 * 120 && sim.state.phase === 'wave' && !regenSeen; i++) {
    sim.step();
    for (const c of sim.state.creeps) {
      const prev = prevHp.get(c.id);
      if (prev !== undefined && c.hp > prev + 1e-9 && c.hp < c.maxHp) regenSeen = true;
      prevHp.set(c.id, c.hp);
    }
  }
  check('regen wave heals between hits', regenSeen);
}

// special waves: extra (wave 7, idx 6) — no lives lost, double bounty
{
  const sim = newSim();
  sim.state.waveIndex = 6;
  const livesBefore = sim.state.lives;
  sim.startWave();
  let escapes = 0;
  let sampled = null;
  for (let i = 0; i < 20 * 200 && sim.state.phase === 'wave'; i++) {
    sim.step();
    if (!sampled && sim.state.creeps.length > 0) sampled = sim.state.creeps[0];
    escapes += sim.state.events.filter(e => e.type === 'escape').length;
  }
  check('extra wave: escapes cost no lives, bounty doubled',
    sim.state.lives === livesBefore && sim.state.totalLeaks === 0 &&
    escapes === 16 && sampled && sampled.bounty === 6 && sampled.noLivesLoss === true,
    `lives ${sim.state.lives}/${livesBefore}, escapes ${escapes}, bounty ${sampled && sampled.bounty}`);
}

// sell + poison bounty (regression)
{
  const sim = newSim();
  const g0 = sim.state.gold;
  sim.build('arrow', 10, 3);
  const t = sim.towerAt(10, 3);
  const r = sim.sell(t.id);
  const expected = g0 - 12 + Math.floor(12 * E.GameConfig.sellRatio);
  check('sell refunds 70% and removes tower', r.ok && sim.state.gold === expected && sim.state.towers.length === 0);
  const sim2 = newSim();
  sim2.build('poison', 10, 3);
  sim2.startWave();
  const gg = sim2.state.gold;
  let poisonKillGold = false;
  for (let i = 0; i < 20 * 120 && !sim2.isOver(); i++) {
    sim2.step();
    if (sim2.state.gold > gg) { poisonKillGold = true; break; }
  }
  check('poison tower earns kill bounty', poisonKillGold);
}

const a = run(planGood);
const b = run(planGood);
check('classic: deterministic replay',
  a.ticks === b.ticks && a.gold === b.gold && a.lives === b.lives && a.result === b.result,
  `ticks ${a.ticks}/${b.ticks}, gold ${a.gold}/${b.gold}`);

{
  const easy = newSim('easy');
  const hard = newSim('hard');
  check('difficulty affects start gold/lives',
    easy.state.gold === 80 && easy.state.lives === 40 &&
    hard.state.gold === 50 && hard.state.lives === 20);
  hard.startWave();
  for (let i = 0; i < 30 && hard.state.creeps.length === 0; i++) hard.step();
  const c = hard.state.creeps[0];
  check('hard multiplies creep HP', c && c.maxHp === Math.round(40 * 1.25));
}

const goodHard = run(planGood, { difficulty: 'hard' });
check('classic: good build → victory (hard)', goodHard.result === 'victory',
  `phase ${goodHard.result}, wave ${goodHard.wave}, lives ${goodHard.lives}`);
const goodEasy = run(planGood, { difficulty: 'easy' });
check('classic: good build → victory (easy)', goodEasy.result === 'victory', `lives ${goodEasy.lives}`);

const resumed = run(planGood, { saveRestoreAtWave: 8 });
check('classic: save/restore at wave 8 → identical outcome',
  resumed.result === good.result && resumed.lives === good.lives &&
  resumed.gold === good.gold && resumed.ticks === good.ticks,
  `lives ${resumed.lives}/${good.lives}, gold ${resumed.gold}/${good.gold}`);

// =============================================================== CANYON

// Map 20x20. Road: rows 2 (cols<=5), 3 (8..12), 10 (2..8), 12 (5..12),
// 16 (5..14), 8 (14..17), 17 (17+); cols 5 (2..6, 12..16), 2 (6..10),
// 8 (3..10), 12 (3..12), 14 (8..16), 17 (8..17).
// Central corridor cols 9..11 rows 4..11 is flanked by two road columns;
// south corridor rows 13..15 sits between road rows 12 and 16.
const planGoodCanyon = [
  // Западный «замок»: клетки (3-4, 7-8) видят 4 прохода (col5, row6, col2, row10)
  { wave: 0,  action: 'build',   tower: 'arrow',   col: 3,  row: 7 },
  { wave: 0,  action: 'build',   tower: 'arrow',   col: 4,  row: 8 },
  { wave: 1,  action: 'build',   tower: 'arrow',   col: 5,  row: 7 },
  { wave: 2,  action: 'build',   tower: 'frost',   col: 3,  row: 8 },
  { wave: 3,  action: 'upgrade', col: 3,  row: 7 },
  { wave: 3,  action: 'upgrade', col: 4,  row: 8 },
  { wave: 4,  action: 'build',   tower: 'antiair', col: 4,  row: 7 },
  { wave: 5,  action: 'upgrade', col: 5,  row: 7 },
  { wave: 6,  action: 'build',   tower: 'cannon',  col: 6,  row: 11 },
  { wave: 7,  action: 'upgrade', col: 6,  row: 11 },
  { wave: 7,  action: 'build',   tower: 'storm',   col: 10, row: 5 },
  { wave: 8,  action: 'upgrade', col: 4,  row: 7 },
  { wave: 9,  action: 'upgrade', col: 10, row: 5 },
  { wave: 10, action: 'build',   tower: 'poison',  col: 9,  row: 6 },
  { wave: 10, action: 'upgrade', col: 3,  row: 7 },
  { wave: 11, action: 'build',   tower: 'antiair', col: 11, row: 4 },
  { wave: 11, action: 'upgrade', col: 11, row: 4 },
  { wave: 11, action: 'upgrade', col: 9,  row: 6 },
  { wave: 11, action: 'upgrade', col: 4,  row: 8 },
  // ---- Акт II: юг (двойной проход рядов 12/16) и правая стена (14/17)
  { wave: 12, action: 'build',   tower: 'storm',   col: 9,  row: 13 },
  { wave: 12, action: 'upgrade', col: 9,  row: 13 },
  { wave: 13, action: 'build',   tower: 'cannon',  col: 10, row: 13 },
  { wave: 13, action: 'upgrade', col: 10, row: 13 },
  { wave: 14, action: 'build',   tower: 'antiair', col: 11, row: 13 },
  { wave: 14, action: 'upgrade', col: 11, row: 13 },
  { wave: 14, action: 'upgrade', col: 9,  row: 6 },
  { wave: 15, action: 'build',   tower: 'poison',  col: 8,  row: 13 },
  { wave: 15, action: 'upgrade', col: 8,  row: 13 },
  { wave: 16, action: 'build',   tower: 'frost',   col: 9,  row: 14 },
  { wave: 16, action: 'upgrade', col: 9,  row: 14 },
  { wave: 17, action: 'upgrade', col: 9,  row: 13 },
  { wave: 17, action: 'upgrade', col: 10, row: 13 },
  { wave: 18, action: 'build',   tower: 'storm',   col: 15, row: 9 },
  { wave: 18, action: 'upgrade', col: 15, row: 9 },
  { wave: 19, action: 'build',   tower: 'antiair', col: 15, row: 10 },
  { wave: 19, action: 'upgrade', col: 15, row: 10 },
  { wave: 19, action: 'upgrade', col: 15, row: 10 },
  { wave: 20, action: 'build',   tower: 'cannon',  col: 15, row: 12 },
  { wave: 20, action: 'upgrade', col: 15, row: 12 },
  { wave: 20, action: 'build',   tower: 'storm',   col: 6,  row: 13 },
  { wave: 21, action: 'upgrade', col: 6,  row: 13 },
  { wave: 21, action: 'upgrade', col: 15, row: 9 },
  { wave: 21, action: 'build',   tower: 'poison',  col: 16, row: 12 },
  { wave: 21, action: 'upgrade', col: 16, row: 12 },
  { wave: 22, action: 'upgrade', col: 15, row: 12 },
  { wave: 22, action: 'build',   tower: 'storm',   col: 15, row: 14 },
  { wave: 22, action: 'upgrade', col: 15, row: 14 },
  { wave: 22, action: 'build',   tower: 'cannon',  col: 7,  row: 13 },
  { wave: 22, action: 'upgrade', col: 7,  row: 13 },
  { wave: 23, action: 'upgrade', col: 15, row: 14 },
  { wave: 23, action: 'upgrade', col: 16, row: 12 },
  { wave: 23, action: 'upgrade', col: 7,  row: 13 },
  { wave: 23, action: 'upgrade', col: 6,  row: 13 },
  { wave: 23, action: 'build',   tower: 'arrow',   col: 16, row: 14 },
  { wave: 23, action: 'upgrade', col: 16, row: 14 },
  { wave: 23, action: 'upgrade', col: 16, row: 14 },
  { wave: 23, action: 'build',   tower: 'cannon',  col: 16, row: 15 },
  { wave: 23, action: 'upgrade', col: 16, row: 15 },
  { wave: 23, action: 'upgrade', col: 16, row: 15 },
];

const planWeakCanyon = [
  { wave: 0, action: 'build', tower: 'arrow', col: 3, row: 7 },
  { wave: 0, action: 'build', tower: 'arrow', col: 4, row: 8 },
];

const cnone = run([], { version: 'canyon' });
check('canyon: no towers → defeat early', cnone.result === 'defeat' && cnone.wave <= 3,
  `reached wave ${cnone.wave + 1}, lives ${cnone.lives}`);

const cweak = run(planWeakCanyon, { version: 'canyon' });
check('canyon: 2 arrows only → defeat before boss', cweak.result === 'defeat' && cweak.wave < 11,
  `reached wave ${cweak.wave + 1}`);

const cgood = run(planGoodCanyon, { version: 'canyon' });
check('canyon: all plan placements are legal', cgood.stats.buildRejected.length === 0,
  cgood.stats.buildRejected.join('; ') || 'ok');
check('canyon: good build → victory (normal, 24 waves)', cgood.result === 'victory',
  `phase ${cgood.result}, wave ${cgood.wave}, lives ${cgood.lives}, gold ${cgood.gold}`);
check('canyon: victory with healthy lives margin', cgood.result === 'victory' && cgood.lives >= 8,
  `lives ${cgood.lives}`);
check('canyon: economy: no huge gold surplus at victory', cgood.gold < 800,
  `gold ${cgood.gold}`);

check('canyon: storm chain events fired', cgood.stats.chainEvents > 50,
  `chain hits ${cgood.stats.chainEvents}`);
check('canyon: one storm bolt hit 2+ creeps', cgood.stats.stormChainMultiHit);
check('canyon: anti-air hit air creeps', cgood.stats.aaHitAir);
check('canyon: anti-air never hit ground', !cgood.stats.aaHitGround);
check('canyon: frost slow applied', cgood.stats.slowSeen);
check('canyon: poison DoT applied', cgood.stats.poisonSeen);

// chain lightning unit-style check: 3 clustered creeps, one bolt
{
  const sim = newSim('normal', 'canyon');
  sim.state.gold = 1000;
  sim.build('storm', 10, 5);
  const t = sim.towerAt(10, 5);
  sim.upgrade(t.id); // level 2: chain 2 → up to 3 targets
  sim.state.waveIndex = 0;
  sim.startWave();
  let chainHits = 0;
  let tripleHit = false;
  for (let i = 0; i < 20 * 90 && sim.state.phase === 'wave'; i++) {
    sim.step();
    chainHits += sim.state.events.filter(e => e.type === 'chainHit').length;
    const hits = sim.state.events.filter(e => e.type === 'hit' && e.source === 'storm');
    const byProj = {};
    for (const h of hits) byProj[h.projectileId] = (byProj[h.projectileId] || 0) + 1;
    if (Object.values(byProj).some(n => n >= 3)) tripleHit = true;
  }
  check('chain lightning: jumps happen on a packed wave', chainHits > 0, `chainHits ${chainHits}`);
  check('chain lightning: lvl2 bolt reaches 3 targets', tripleHit);
}

const ca = run(planGoodCanyon, { version: 'canyon' });
check('canyon: deterministic replay',
  ca.ticks === cgood.ticks && ca.gold === cgood.gold && ca.lives === cgood.lives && ca.result === cgood.result,
  `ticks ${ca.ticks}/${cgood.ticks}, gold ${ca.gold}/${cgood.gold}`);

const cgoodHard = run(planGoodCanyon, { version: 'canyon', difficulty: 'hard' });
check('canyon: good build → victory (hard)', cgoodHard.result === 'victory',
  `phase ${cgoodHard.result}, wave ${cgoodHard.wave}, lives ${cgoodHard.lives}`);
const cgoodEasy = run(planGoodCanyon, { version: 'canyon', difficulty: 'easy' });
check('canyon: good build → victory (easy)', cgoodEasy.result === 'victory', `lives ${cgoodEasy.lives}`);

const cresumed = run(planGoodCanyon, { version: 'canyon', saveRestoreAtWave: 8 });
check('canyon: save/restore at wave 8 → identical outcome',
  cresumed.result === cgood.result && cresumed.lives === cgood.lives &&
  cresumed.gold === cgood.gold && cresumed.ticks === cgood.ticks,
  `lives ${cresumed.lives}/${cgood.lives}, gold ${cresumed.gold}/${cgood.gold}`);

console.log(failures === 0 ? '\nAll smoke tests passed.' : `\n${failures} test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
