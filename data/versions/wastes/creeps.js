// Wastes creeps: the shared desert archetypes plus two heavier bosses
// (juggernaut, behemoth) fitting the harder endgame map.
globalThis.WastesVersion = globalThis.WastesVersion || {};
WastesVersion.creeps = {
  walker: { name: 'Изгой пустошей', type: 'ground', speed: 60, radius: 9, livesCost: 1, color: '#d8b75b' },
  sprinter: { name: 'Пепельный бегун', type: 'ground', speed: 108, radius: 7, livesCost: 1, color: '#f0e18e' },
  bulwark: { name: 'Ржавый голем', type: 'ground', speed: 42, radius: 12, livesCost: 1, color: '#a37b28' },
  wasp: { name: 'Стеклянная оса', type: 'air', speed: 78, radius: 8, livesCost: 1, color: '#ffde89' },
  shaman: { name: 'Шаман пепла', type: 'ground', speed: 54, radius: 10, livesCost: 1, color: '#cf9b44' },
  scarab: { name: 'Стальной скарабей', type: 'ground', speed: 84, radius: 8, livesCost: 1, color: '#e4c04b' },
  wyvern: { name: 'Пустошный змей', type: 'air', speed: 90, radius: 10, livesCost: 2, color: '#f4d37a' },
  juggernaut: { name: 'Джаггернаут', type: 'ground', speed: 34, radius: 16, livesCost: 12, color: '#7a5a12', boss: true, slowCap: 0.78 },
  behemoth: { name: 'Бегемот пустошей', type: 'ground', speed: 28, radius: 19, livesCost: 18, color: '#5f4607', boss: true, slowCap: 0.82 },
};
