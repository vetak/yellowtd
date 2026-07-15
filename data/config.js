// Global game rules. Everything tunable lives in data/ — the engine hardcodes nothing.
const GAME_VERSION = '1.5.0';

const GameConfig = {
  tickRate: 20,           // fixed simulation steps per second (deterministic)
  startGold: 60,
  startLives: 30,
  sellRatio: 0.7,         // fraction of invested gold returned when selling
  firstWaveDelay: 30,     // seconds before wave 1 auto-starts
  betweenWavesDelay: 15,  // seconds between waves (can be skipped with Send Wave)
  autoStartWaves: true,   // false = waves start only via Send Wave (user setting)
  speeds: [1, 2, 3],      // available game speed multipliers
  // 1.1.0 "Темп волн": send the next wave early, on top of the current one,
  // for a decaying gold bonus. Capped at maxConcurrentWaves in flight.
  maxConcurrentWaves: 2,     // current wave + at most one early-sent wave
  earlyWaveMinDelay: 10,     // seconds into the current wave before early-send unlocks
  earlyWaveBonusMax: 0.10,   // +10% of the sent wave's bonus if sent the instant it unlocks
  earlyWaveBonusWindow: 20,  // seconds over which that bonus decays from max to 0
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
  nightmare: {
    name: 'Кошмар', startLives: 15, startGold: 45, hpMul: 1.5,
    desc: 'Только для победивших на Тяжёлой: мало жизней, самые крепкие враги',
    unlockedBy: 'hard', // requires a prior victory on this difficulty (or higher)
  },
};

// Order used to compare difficulty "tiers" for unlock checks (easy < normal < ...).
const DifficultyOrder = ['easy', 'normal', 'hard', 'nightmare'];

// User settings (persisted in browser storage). These are the defaults.
const DefaultSettings = {
  defaultSpeed: 1,        // game speed at the start of a session: 1 | 2 | 3
  autoStartWaves: true,   // countdown between waves; off = manual Send Wave only
  floatingText: true,     // +gold / -lives popups on the battlefield
  rangeOnHover: true,     // show tower range circle on hover (not only selection)
  soundOn: true,          // WebAudio sound effects on/off
  soundVolume: 0.6,       // master sound volume 0..1
  musicOn: false,         // procedural ambient music on/off
  musicVolume: 0.4,       // music volume 0..1
};
