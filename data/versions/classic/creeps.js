// Classic creeps: base enemy archetypes used by waves and simulation.
globalThis.ClassicVersion = globalThis.ClassicVersion || {};
ClassicVersion.creeps = {
  walker: { name: 'Пустынный бродяга', type: 'ground', speed: 60, radius: 9, livesCost: 1, color: '#d8b75b' },
  sprinter: { name: 'Песчаный бегун', type: 'ground', speed: 105, radius: 7, livesCost: 1, color: '#f0e18e' },
  bulwark: { name: 'Барханный громила', type: 'ground', speed: 42, radius: 12, livesCost: 1, color: '#a37b28' },
  wasp: { name: 'Пыльная оса', type: 'air', speed: 75, radius: 8, livesCost: 1, color: '#ffde89' },
  shaman: { name: 'Жёлтый шаман', type: 'ground', speed: 54, radius: 10, livesCost: 1, color: '#cf9b44' },
  scarab: { name: 'Скарабей', type: 'ground', speed: 82, radius: 8, livesCost: 1, color: '#e4c04b' },
  wyvern: { name: 'Песчаная виверна', type: 'air', speed: 88, radius: 10, livesCost: 2, color: '#f4d37a' },
  treant: { name: 'Древень песков', type: 'ground', speed: 34, radius: 16, livesCost: 10, color: '#8a6d0b', boss: true, slowCap: 0.75 },
  ancient: { name: 'Прародитель дюн', type: 'ground', speed: 30, radius: 18, livesCost: 15, color: '#6f5507', boss: true, slowCap: 0.8 },
};
