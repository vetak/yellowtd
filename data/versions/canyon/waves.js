// Canyon waves: 24 waves in two acts (bosses at 12/24).
// Special flags work the same as in Classic: immuneToSlow, regen (hp/sec),
// hero (mini-boss), extra (bonus wave), boss.
globalThis.CanyonVersion = globalThis.CanyonVersion || {};
CanyonVersion.waves = [
  // ---- Акт I (1–12)
  { name: 'Лазутчики', bonus: 12, groups: [{ creep: 'walker', count: 10, interval: 1.0, hp: 38, bounty: 2 }] },
  { name: 'Сборщики меди', bonus: 14, groups: [{ creep: 'walker', count: 12, interval: 0.9, hp: 54, bounty: 2 }] },
  { name: 'Бегуны ущелья', bonus: 16, groups: [{ creep: 'sprinter', count: 12, interval: 0.8, hp: 43, bounty: 2 }] },
  { name: 'Каменные лбы', bonus: 18, groups: [{ creep: 'bulwark', count: 8, interval: 1.3, hp: 140, bounty: 4, armor: 2 }] },
  { name: 'Осиное гнездо', bonus: 20, groups: [{ creep: 'wasp', count: 12, interval: 0.9, hp: 70, bounty: 3 }] },
  { name: 'Караван по дну', bonus: 22, groups: [{ creep: 'walker', count: 15, interval: 0.75, hp: 118, bounty: 3 }] },
  { name: 'Медная жила', bonus: 24, extra: true, groups: [{ creep: 'scarab', count: 16, interval: 0.72, hp: 100, bounty: 3 }] },
  { name: 'Заклинатели эха', bonus: 26, regen: 6, groups: [{ creep: 'shaman', count: 10, interval: 1.0, hp: 190, bounty: 4, armor: 2 }] },
  { name: 'Верхний ярус', bonus: 28, groups: [{ creep: 'wasp', count: 14, interval: 0.8, hp: 165, bounty: 4 }] },
  { name: 'Несокрушимые', bonus: 32, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 10, interval: 1.2, hp: 410, bounty: 5, armor: 6 }] },
  { name: 'Сквозной ветер', bonus: 35, groups: [{ creep: 'wyvern', count: 12, interval: 0.82, hp: 195, bounty: 5 }] },
  { name: 'РАЗОРИТЕЛЬ КАНЬОНА', bonus: 70, boss: true, groups: [{ creep: 'ravager', count: 1, interval: 1.0, hp: 2200, bounty: 90, armor: 7 }] },
  // ---- Акт II (13–24)
  { name: 'Смешанный отряд', bonus: 38, groups: [
    { creep: 'walker', count: 8, interval: 0.8, hp: 260, bounty: 4 },
    { creep: 'sprinter', count: 8, interval: 0.65, hp: 180, bounty: 4 }
  ] },
  { name: 'Каменная стена', bonus: 40, groups: [{ creep: 'bulwark', count: 12, interval: 1.1, hp: 560, bounty: 5, armor: 7 }] },
  { name: 'Рой из расщелин', bonus: 42, groups: [{ creep: 'wasp', count: 18, interval: 0.7, hp: 250, bounty: 4 }] },
  { name: 'Золото ущелья', bonus: 46, extra: true, groups: [{ creep: 'scarab', count: 20, interval: 0.64, hp: 200, bounty: 4 }] },
  { name: 'Старейшины эха', bonus: 48, regen: 10, groups: [{ creep: 'shaman', count: 14, interval: 0.9, hp: 370, bounty: 5, armor: 4 }] },
  { name: 'Лавина тел', bonus: 50, groups: [{ creep: 'walker', count: 26, interval: 0.52, hp: 260, bounty: 3 }] },
  { name: 'Крылья над бездной', bonus: 52, groups: [{ creep: 'wyvern', count: 16, interval: 0.76, hp: 310, bounty: 5 }] },
  { name: 'Гранитный строй', bonus: 56, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 14, interval: 1.0, hp: 800, bounty: 6, armor: 9 }] },
  { name: 'ИЗБРАННЫЕ ЭХА', bonus: 60, hero: true, regen: 16, groups: [{ creep: 'shaman', count: 2, interval: 6.0, hp: 2200, bounty: 40, armor: 9 }] },
  { name: 'Ущельная ярость', bonus: 58, groups: [{ creep: 'sprinter', count: 22, interval: 0.48, hp: 340, bounty: 4 }] },
  { name: 'Двойная волна', bonus: 62, groups: [
    { creep: 'scarab', count: 14, interval: 0.55, hp: 300, bounty: 4 },
    { creep: 'wasp', count: 14, interval: 0.55, hp: 280, bounty: 4 }
  ] },
  { name: 'КОЛОСС УЩЕЛЬЯ', bonus: 110, boss: true, groups: [{ creep: 'colossus', count: 1, interval: 1.0, hp: 5800, bounty: 140, armor: 11 }] },
];
