// Vortex creeps: the shared archetypes plus THREE bosses for the spiral's
// triple-boss campaign (warden, leviathan, avatar) — the toughest in the game.
globalThis.VortexVersion = globalThis.VortexVersion || {};
VortexVersion.creeps = {
  walker: { name: 'Пилигрим воронки', type: 'ground', speed: 60, radius: 9, livesCost: 1, color: '#d8b75b' },
  sprinter: { name: 'Вихревой бегун', type: 'ground', speed: 110, radius: 7, livesCost: 1, color: '#f0e18e' },
  bulwark: { name: 'Каменный страж', type: 'ground', speed: 42, radius: 12, livesCost: 1, color: '#a37b28' },
  wasp: { name: 'Смерч-оса', type: 'air', speed: 80, radius: 8, livesCost: 1, color: '#ffde89' },
  shaman: { name: 'Жрец воронки', type: 'ground', speed: 54, radius: 10, livesCost: 1, color: '#cf9b44' },
  scarab: { name: 'Бурый скарабей', type: 'ground', speed: 86, radius: 8, livesCost: 1, color: '#e4c04b' },
  wyvern: { name: 'Грозовой змей', type: 'air', speed: 92, radius: 10, livesCost: 2, color: '#f4d37a' },
  warden: { name: 'Хранитель врат', type: 'ground', speed: 36, radius: 15, livesCost: 10, color: '#7a5a12', boss: true, slowCap: 0.78 },
  leviathan: { name: 'Левиафан песков', type: 'ground', speed: 32, radius: 17, livesCost: 15, color: '#6a4d09', boss: true, slowCap: 0.8 },
  avatar: { name: 'Аватар бури', type: 'ground', speed: 28, radius: 20, livesCost: 20, color: '#544006', boss: true, slowCap: 0.84 },
};
