// Storage module: save/load helpers and persistent user settings.
// Persistence for saves and settings. Uses localStorage when available,
// falls back to in-memory storage (private mode, headless tests).
// Kept out of engine/ — the simulation itself knows nothing about storage.
const Storage = (() => {
  const SAVE_KEY = 'yellowtd.save';
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
    saveGame(payload) { return writeJson(SAVE_KEY, payload); },
    loadGame() { return readJson(SAVE_KEY); },
    clearGame() { try { backend.removeItem(SAVE_KEY); } catch (e) {} },
    saveSettings(settings) { return writeJson(SETTINGS_KEY, settings); },
    loadSettings(defaults) {
      return Object.assign({}, defaults, readJson(SETTINGS_KEY) || {});
    },
  };
})();
