// Canyon creeps: same archetype ids as Classic (ground/air/boss roles),
// but their own config objects — canyon flavour, independent tuning.
globalThis.CanyonVersion = globalThis.CanyonVersion || {};
CanyonVersion.creeps = {
  walker: { name: 'Каньонный бродяга', type: 'ground', speed: 56, radius: 9, livesCost: 1, color: '#c9a24f' },
  sprinter: { name: 'Ущельный бегун', type: 'ground', speed: 100, radius: 7, livesCost: 1, color: '#e8d688' },
  bulwark: { name: 'Скальный голем', type: 'ground', speed: 38, radius: 12, livesCost: 1, color: '#96702a' },
  wasp: { name: 'Гнездовая оса', type: 'air', speed: 78, radius: 8, livesCost: 1, color: '#f5cf72' },
  shaman: { name: 'Шаман ущелья', type: 'ground', speed: 55, radius: 10, livesCost: 1, color: '#c08e3e' },
  scarab: { name: 'Медный скарабей', type: 'ground', speed: 84, radius: 8, livesCost: 1, color: '#d9b043' },
  wyvern: { name: 'Гривастая виверна', type: 'air', speed: 90, radius: 10, livesCost: 2, color: '#e9c66d' },
  ravager: { name: 'Разоритель каньона', type: 'ground', speed: 36, radius: 16, livesCost: 10, color: '#7d5f0e', boss: true, slowCap: 0.75 },
  colossus: { name: 'Колосс ущелья', type: 'ground', speed: 30, radius: 18, livesCost: 15, color: '#5f4a06', boss: true, slowCap: 0.8 },
};
