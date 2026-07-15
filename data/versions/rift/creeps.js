// Rift creeps: the shared archetypes plus two bosses (colossus, dreadnought)
// sitting between Wastes and Vortex in toughness.
globalThis.RiftVersion = globalThis.RiftVersion || {};
RiftVersion.creeps = {
  walker: { name: 'Странник разлома', type: 'ground', speed: 60, radius: 9, livesCost: 1, color: '#d8b75b' },
  sprinter: { name: 'Трещинный бегун', type: 'ground', speed: 108, radius: 7, livesCost: 1, color: '#f0e18e' },
  bulwark: { name: 'Базальтовый страж', type: 'ground', speed: 42, radius: 12, livesCost: 1, color: '#a37b28' },
  wasp: { name: 'Искровая оса', type: 'air', speed: 80, radius: 8, livesCost: 1, color: '#ffde89' },
  shaman: { name: 'Жрец разлома', type: 'ground', speed: 54, radius: 10, livesCost: 1, color: '#cf9b44' },
  scarab: { name: 'Обсидиановый скарабей', type: 'ground', speed: 85, radius: 8, livesCost: 1, color: '#e4c04b' },
  wyvern: { name: 'Змей расщелин', type: 'air', speed: 91, radius: 10, livesCost: 2, color: '#f4d37a' },
  colossus: { name: 'Колосс разлома', type: 'ground', speed: 34, radius: 16, livesCost: 12, color: '#7a5a12', boss: true, slowCap: 0.78 },
  dreadnought: { name: 'Дредноут бездны', type: 'ground', speed: 29, radius: 19, livesCost: 16, color: '#5f4607', boss: true, slowCap: 0.82 },
};
