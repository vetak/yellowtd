// Platform module: the ONLY place that knows whether we run in a browser
// or inside the Tauri desktop shell. Everything else calls these helpers.
// In the browser every feature degrades gracefully (download/upload, close tab).
const Platform = (() => {
  const tauri = typeof window !== 'undefined' && !!window.__TAURI__;

  function isTauri() {
    return tauri;
  }

  // Close the app. Returns true if the window is actually closing.
  async function exitApp() {
    if (tauri) {
      const win = window.__TAURI__.window.getCurrentWindow();
      try {
        await win.close(); // graceful: fires close event
        return true;
      } catch (e) { /* fall through to destroy */ }
      try {
        await win.destroy(); // hard close if close() is not permitted
        return true;
      } catch (e) {
        return false;
      }
    }
    try {
      if (typeof window !== 'undefined' && window.close) window.close();
    } catch (e) { /* browsers usually block this */ }
    return false; // let the caller show the farewell screen
  }

  // Save text to a file: Tauri — native save dialog; browser — download.
  async function exportText(filename, text) {
    if (tauri) {
      try {
        const path = await window.__TAURI__.dialog.save({
          defaultPath: filename,
          filters: [{ name: 'YellowTD save', extensions: ['json'] }],
        });
        if (!path) return false;
        await window.__TAURI__.fs.writeTextFile(path, text);
        return true;
      } catch (e) {
        return false;
      }
    }
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      return false; // headless tests
    }
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    return true;
  }

  // Read text from a user-picked file: Tauri — open dialog; browser — file input.
  async function importText() {
    if (tauri) {
      try {
        const path = await window.__TAURI__.dialog.open({
          multiple: false,
          filters: [{ name: 'YellowTD save', extensions: ['json'] }],
        });
        if (!path) return null;
        return await window.__TAURI__.fs.readTextFile(path);
      } catch (e) {
        return null;
      }
    }
    if (typeof FileReader === 'undefined') return null; // headless tests
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return resolve(null);
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => resolve(null);
        reader.readAsText(file);
      });
      input.click();
    });
  }

  const api = { isTauri, exitApp, exportText, importText };
  if (typeof window !== 'undefined') window.Platform = api; // for tests/debug
  return api;
})();
