// Storage module: save/load helpers and persistent user settings.
// Persistence for saves and settings. Uses localStorage when available,
// falls back to in-memory storage (private mode, headless tests).
// Kept out of engine/ — the simulation itself knows nothing about storage.
// Saves are stored per map version: one slot per versionId.
const Storage = (() => {
  const SAVE_PREFIX = 'yellowtd.save.';
  const SETTINGS_KEY = 'yellowtd.settings';

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
    latestSave(versionIds) {
      let best = null;
      for (const id of versionIds) {
        const save = readJson(SAVE_PREFIX + id);
        if (save && save.state && (!best || (save.savedAt || 0) > (best.savedAt || 0))) {
          best = save;
        }
      }
      return best;
    },
    saveSettings(settings) { return writeJson(SETTINGS_KEY, settings); },
    loadSettings(defaults) {
      return Object.assign({}, defaults, readJson(SETTINGS_KEY) || {});
    },
  };
})();
