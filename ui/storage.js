// Storage module: save/load helpers and persistent user settings.
// Persistence for saves and settings. Uses localStorage when available,
// falls back to in-memory storage (private mode, headless tests).
// Kept out of engine/ — the simulation itself knows nothing about storage.
// Saves are stored per map version: one slot per versionId.
const Storage = (() => {
  const SAVE_PREFIX = 'yellowtd.save.';
  const SETTINGS_KEY = 'yellowtd.settings';
  const PROGRESS_KEY = 'yellowtd.progress';
  const RECORDS_PREFIX = 'yellowtd.records.';
  const MAX_RECORDS = 5;
  const TUTORIAL_KEY = 'yellowtd.tutorialSeen';

  let backend;
  try {
    if (typeof localStorage === 'undefined') throw new Error('no localStorage');
    const probe = '__yellowtd_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    backend = localStorage;
  } catch (e) {
    const mem = {};
    backend = {
      getItem: k => (k in mem ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: k => { delete mem[k]; },
    };
  }

  function readJson(key) {
    try {
      const raw = backend.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeJson(key, obj) {
    try {
      backend.setItem(key, JSON.stringify(obj));
      return true;
    } catch (e) {
      return false;
    }
  }

  return {
    saveGame(versionId, payload) { return writeJson(SAVE_PREFIX + versionId, payload); },
    loadGame(versionId) { return readJson(SAVE_PREFIX + versionId); },
    clearGame(versionId) { try { backend.removeItem(SAVE_PREFIX + versionId); } catch (e) {} },
    // Most recent save across the given version ids (for the Continue button).
    // Ties (same millisecond — possible when scripting rapid saves, e.g. in
    // tests) favor the later id in versionIds, so "most recent" is deterministic.
    latestSave(versionIds) {
      let best = null;
      for (const id of versionIds) {
        const save = readJson(SAVE_PREFIX + id);
        if (save && save.state && (!best || (save.savedAt || 0) >= (best.savedAt || 0))) {
          best = save;
        }
      }
      return best;
    },
    saveSettings(settings) { return writeJson(SETTINGS_KEY, settings); },
    loadSettings(defaults) {
      return Object.assign({}, defaults, readJson(SETTINGS_KEY) || {});
    },

    // ---- Progress: which difficulties have ever been won (any version).
    // Used to gate unlockable difficulties like "Кошмар" (unlockedBy: <id>).
    recordVictory(difficultyId) {
      const progress = readJson(PROGRESS_KEY) || { won: {} };
      progress.won[difficultyId] = true;
      writeJson(PROGRESS_KEY, progress);
    },
    hasWon(difficultyId) {
      const progress = readJson(PROGRESS_KEY);
      return !!(progress && progress.won && progress.won[difficultyId]);
    },

    // ---- Progress: which map versions have ever been beaten (any difficulty).
    // Used to gate the map-progression chain (versions with unlockedBy: <id>).
    recordMapVictory(versionId) {
      const progress = readJson(PROGRESS_KEY) || { won: {} };
      progress.wonMaps = progress.wonMaps || {};
      progress.wonMaps[versionId] = true;
      writeJson(PROGRESS_KEY, progress);
    },
    hasWonMap(versionId) {
      const progress = readJson(PROGRESS_KEY);
      return !!(progress && progress.wonMaps && progress.wonMaps[versionId]);
    },

    // ---- Leaderboard: best runs per version x difficulty, newest ties lose.
    // Sorted by wave reached (desc), then lives left (desc), then gold (desc).
    addRecord(versionId, difficultyId, entry) {
      const key = RECORDS_PREFIX + versionId + '.' + difficultyId;
      const list = readJson(key) || [];
      list.push(entry);
      list.sort((a, b) => (b.wave - a.wave) || (b.lives - a.lives) || (b.gold - a.gold));
      writeJson(key, list.slice(0, MAX_RECORDS));
      return list.length > MAX_RECORDS ? list.slice(0, MAX_RECORDS) : list;
    },
    getRecords(versionId, difficultyId) {
      return readJson(RECORDS_PREFIX + versionId + '.' + difficultyId) || [];
    },

    // ---- First-run tutorial hint: shown once, dismissed forever after.
    hasSeenTutorial() { return readJson(TUTORIAL_KEY) === true; },
    markTutorialSeen() { writeJson(TUTORIAL_KEY, true); },
  };
})();
