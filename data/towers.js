// Towers config: base tower roster, level progression and combat roles.
// splash: area damage radius. slowFactor/slowDuration: frost debuff.
// poisonDps/poisonDuration: damage over time, ignores armor. shots: targets per volley.
const TowersConfig = {
  arrow: {
    name: 'Песчаная башня', role: 'Быстрый урон по одной цели', targets: ['ground', 'air'],
    color: '#d8b14a', shape: 'arrow', projectileSpeed: 340, hotkey: '1',
    levels: [
      { cost: 12, damage: 9,  range: 110, cooldown: 0.7 },
      { cost: 18, damage: 20, range: 122, cooldown: 0.64 },
      { cost: 30, damage: 42, range: 132, cooldown: 0.58 },
    ],
  },
  cannon: {
    name: 'Осадная башня', role: 'Сплэш-урон, только по земле', targets: ['ground'],
    color: '#c46d35', shape: 'circle', projectileSpeed: 220, hotkey: '2',
    levels: [
      { cost: 28, damage: 22, range: 100, cooldown: 1.6, splash: 60 },
      { cost: 38, damage: 48, range: 108, cooldown: 1.46, splash: 72 },
      { cost: 62, damage: 96, range: 116, cooldown: 1.32, splash: 84 },
    ],
  },
  frost: {
    name: 'Ледяная башня', role: 'Замедляет врагов', targets: ['ground', 'air'],
    color: '#7fcfe8', shape: 'snow', projectileSpeed: 300, hotkey: '3',
    levels: [
      { cost: 22, damage: 5,  range: 108, cooldown: 0.9, slowFactor: 0.55, slowDuration: 2.0 },
      { cost: 32, damage: 12, range: 118, cooldown: 0.8, slowFactor: 0.42, slowDuration: 2.5 },
      { cost: 50, damage: 22, range: 126, cooldown: 0.72, slowFactor: 0.35, slowDuration: 2.8 },
    ],
  },
  antiair: {
    name: 'Зенитная башня', role: 'Только воздух, высокий урон', targets: ['air'],
    color: '#a87ce8', shape: 'triangle', projectileSpeed: 380, hotkey: '4',
    levels: [
      { cost: 20, damage: 30,  range: 135, cooldown: 0.9 },
      { cost: 28, damage: 62,  range: 145, cooldown: 0.84 },
      { cost: 46, damage: 126, range: 158, cooldown: 0.78 },
    ],
  },
  sniper: {
    name: 'Башня охотника', role: 'Очень большая дальность', targets: ['ground', 'air'],
    color: '#c84f62', shape: 'cross', projectileSpeed: 520, hotkey: '5',
    levels: [
      { cost: 45, damage: 60,  range: 220, cooldown: 2.2 },
      { cost: 68, damage: 142, range: 250, cooldown: 1.95 },
    ],
  },
  poison: {
    name: 'Ядовитая башня', role: 'Яд: урон со временем, игнорирует броню', targets: ['ground', 'air'],
    color: '#7da241', shape: 'poison', projectileSpeed: 260, hotkey: '6',
    levels: [
      { cost: 26, damage: 6,  range: 112, cooldown: 1.0,  poisonDps: 8,  poisonDuration: 3.0 },
      { cost: 36, damage: 10, range: 120, cooldown: 0.95, poisonDps: 16, poisonDuration: 3.2 },
      { cost: 58, damage: 18, range: 128, cooldown: 0.9,  poisonDps: 30, poisonDuration: 3.5 },
    ],
  },
  multishot: {
    name: 'Многострел', role: 'Залп по нескольким целям', targets: ['ground', 'air'],
    color: '#f0d26d', shape: 'multi', projectileSpeed: 320, hotkey: '7',
    levels: [
      { cost: 24, damage: 8,  range: 108, cooldown: 0.55, shots: 2 },
      { cost: 34, damage: 14, range: 116, cooldown: 0.5,  shots: 3 },
      { cost: 54, damage: 24, range: 124, cooldown: 0.46, shots: 4 },
    ],
  },
};
