// Global game rules. Everything tunable lives in data/ — the engine hardcodes nothing.
const GAME_VERSION = '0.7.0';

const GameConfig = {
  tickRate: 20,           // fixed simulation steps per second (deterministic)
  startGold: 60,
  startLives: 30,
  sellRatio: 0.7,         // fraction of invested gold returned when selling
  firstWaveDelay: 30,     // seconds before wave 1 auto-starts
  betweenWavesDelay: 15,  // seconds between waves (can be skipped with Send Wave)
  autoStartWaves: true,   // false = waves start only via Send Wave (user setting)
  speeds: [1, 2, 3],      // available game speed multipliers
};

// Difficulty presets, applied on top of GameConfig and wave data.
const DifficultyConfig = {
  easy: {
    name: 'Лёгкая', startLives: 40, startGold: 80, hpMul: 0.8,
    desc: 'Больше жизней и золота, враги слабее',
  },
  normal: {
    name: 'Обычная', startLives: 30, startGold: 60, hpMul: 1.0,
    desc: 'Задуманный баланс игры',
  },
  hard: {
    name: 'Тяжёлая', startLives: 20, startGold: 50, hpMul: 1.25,
    desc: 'Меньше жизней, враги крепче',
  },
};

// User settings (persisted in browser storage). These are the defaults.
const DefaultSettings = {
  defaultSpeed: 1,        // game speed at the start of a session: 1 | 2 | 3
  autoStartWaves: true,   // countdown between waves; off = manual Send Wave only
  floatingText: true,     // +gold / -lives popups on the battlefield
  rangeOnHover: true,     // show tower range circle on hover (not only selection)
};
