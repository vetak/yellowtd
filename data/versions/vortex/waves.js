// Vortex waves: 26 waves in three acts, a TRIPLE-boss campaign (bosses at
// 9 / 18 / 26) — the hardest map, unlocked last. The spiral's dense rings let
// well-placed towers hit enemies on several coils, so the waves hit hard.
// Flags: immuneToSlow, regen (hp/sec), hero (mini-boss), extra (bonus), boss.
globalThis.VortexVersion = globalThis.VortexVersion || {};
VortexVersion.waves = [
  // ---- Акт I (1–9): к Хранителю врат
  { name: 'Первое кольцо', bonus: 12, groups: [{ creep: 'walker', count: 10, interval: 1.0, hp: 48, bounty: 2 }] },
  { name: 'Спуск в воронку', bonus: 14, groups: [{ creep: 'walker', count: 12, interval: 0.9, hp: 68, bounty: 2 }] },
  { name: 'Вихревые бегуны', bonus: 16, groups: [{ creep: 'sprinter', count: 12, interval: 0.8, hp: 56, bounty: 2 }] },
  { name: 'Каменный вал', bonus: 18, groups: [{ creep: 'bulwark', count: 8, interval: 1.3, hp: 190, bounty: 4, armor: 3 }] },
  { name: 'Смерч ос', bonus: 20, groups: [{ creep: 'wasp', count: 12, interval: 0.9, hp: 88, bounty: 3 }] },
  { name: 'Долгий виток', bonus: 22, groups: [{ creep: 'walker', count: 16, interval: 0.72, hp: 152, bounty: 3 }] },
  { name: 'Золотой скарабей', bonus: 24, extra: true, groups: [{ creep: 'scarab', count: 16, interval: 0.7, hp: 120, bounty: 3 }] },
  { name: 'Жрецы воронки', bonus: 26, regen: 8, groups: [{ creep: 'shaman', count: 10, interval: 1.0, hp: 215, bounty: 4, armor: 3 }] },
  { name: 'ХРАНИТЕЛЬ ВРАТ', bonus: 85, boss: true, groups: [{ creep: 'warden', count: 1, interval: 1.0, hp: 2200, bounty: 100, armor: 8 }] },
  // ---- Акт II (10–18): к Левиафану
  { name: 'Смешанный поток', bonus: 38, groups: [
    { creep: 'walker', count: 9, interval: 0.8, hp: 300, bounty: 4 },
    { creep: 'sprinter', count: 9, interval: 0.6, hp: 205, bounty: 4 }
  ] },
  { name: 'Стена стражей', bonus: 40, groups: [{ creep: 'bulwark', count: 12, interval: 1.1, hp: 640, bounty: 5, armor: 8 }] },
  { name: 'Буревестники', bonus: 42, groups: [{ creep: 'wasp', count: 18, interval: 0.68, hp: 290, bounty: 4 }] },
  { name: 'Несокрушимые', bonus: 44, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 11, interval: 1.15, hp: 500, bounty: 5, armor: 7 }] },
  { name: 'Панцирный блеск', bonus: 46, extra: true, groups: [{ creep: 'scarab', count: 22, interval: 0.6, hp: 230, bounty: 4 }] },
  { name: 'Грозовая стая', bonus: 48, groups: [{ creep: 'wyvern', count: 14, interval: 0.76, hp: 250, bounty: 5 }] },
  { name: 'Старейшины бури', bonus: 50, regen: 12, groups: [{ creep: 'shaman', count: 14, interval: 0.88, hp: 430, bounty: 5, armor: 5 }] },
  { name: 'ПРОКЛЯТЫЕ ЖРЕЦЫ', bonus: 64, hero: true, regen: 18, groups: [{ creep: 'shaman', count: 2, interval: 6.0, hp: 2800, bounty: 44, armor: 10 }] },
  { name: 'ЛЕВИАФАН ПЕСКОВ', bonus: 120, boss: true, groups: [{ creep: 'leviathan', count: 1, interval: 1.0, hp: 6600, bounty: 140, armor: 11 }] },
  // ---- Акт III (19–26): к Аватару бури
  { name: 'Лавина воронки', bonus: 54, groups: [{ creep: 'walker', count: 28, interval: 0.5, hp: 340, bounty: 3 }] },
  { name: 'Крылатый шторм', bonus: 56, groups: [{ creep: 'wyvern', count: 18, interval: 0.72, hp: 370, bounty: 5 }] },
  { name: 'Гранит и сталь', bonus: 60, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 15, interval: 1.0, hp: 940, bounty: 6, armor: 10 }] },
  { name: 'Вихрь клинков', bonus: 64, groups: [
    { creep: 'sprinter', count: 16, interval: 0.5, hp: 420, bounty: 4 },
    { creep: 'wyvern', count: 12, interval: 0.7, hp: 400, bounty: 5 }
  ] },
  { name: 'Двойная буря', bonus: 68, groups: [
    { creep: 'scarab', count: 16, interval: 0.52, hp: 350, bounty: 4 },
    { creep: 'wasp', count: 16, interval: 0.52, hp: 320, bounty: 4 }
  ] },
  { name: 'Несгибаемый строй', bonus: 74, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 17, interval: 0.95, hp: 1120, bounty: 6, armor: 11 }] },
  { name: 'Небесный конец', bonus: 78, groups: [{ creep: 'wyvern', count: 22, interval: 0.6, hp: 500, bounty: 6 }] },
  { name: 'АВАТАР БУРИ', bonus: 160, boss: true, groups: [{ creep: 'avatar', count: 1, interval: 1.0, hp: 8600, bounty: 180, armor: 13 }] },
];
