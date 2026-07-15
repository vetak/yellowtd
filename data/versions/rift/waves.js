// Rift waves: 25 waves in two acts (bosses at 12/25, hero at 19). Sits between
// Wastes and Vortex in difficulty. Enemies weave the six vertical lanes.
// Flags: immuneToSlow, regen (hp/sec), hero (mini-boss), extra (bonus), boss.
globalThis.RiftVersion = globalThis.RiftVersion || {};
RiftVersion.waves = [
  // ---- Акт I (1–12): к Колоссу разлома
  { name: 'Пробуждение', bonus: 12, groups: [{ creep: 'walker', count: 10, interval: 1.0, hp: 46, bounty: 2 }] },
  { name: 'Трещина ширится', bonus: 14, groups: [{ creep: 'walker', count: 12, interval: 0.9, hp: 66, bounty: 2 }] },
  { name: 'Трещинные бегуны', bonus: 16, groups: [{ creep: 'sprinter', count: 12, interval: 0.8, hp: 54, bounty: 2 }] },
  { name: 'Базальтовый вал', bonus: 18, groups: [{ creep: 'bulwark', count: 8, interval: 1.3, hp: 185, bounty: 4, armor: 3 }] },
  { name: 'Искровой рой', bonus: 20, groups: [{ creep: 'wasp', count: 12, interval: 0.9, hp: 86, bounty: 3 }] },
  { name: 'Спуск в бездну', bonus: 22, groups: [{ creep: 'walker', count: 16, interval: 0.72, hp: 148, bounty: 3 }] },
  { name: 'Обсидиановый блеск', bonus: 24, extra: true, groups: [{ creep: 'scarab', count: 16, interval: 0.7, hp: 116, bounty: 3 }] },
  { name: 'Жрецы разлома', bonus: 26, regen: 7, groups: [{ creep: 'shaman', count: 10, interval: 1.0, hp: 210, bounty: 4, armor: 3 }] },
  { name: 'Верхние ветра', bonus: 28, groups: [{ creep: 'wasp', count: 14, interval: 0.8, hp: 190, bounty: 4 }] },
  { name: 'Гранитный поток', bonus: 32, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 10, interval: 1.2, hp: 450, bounty: 5, armor: 7 }] },
  { name: 'Змеи расщелин', bonus: 35, groups: [{ creep: 'wyvern', count: 12, interval: 0.8, hp: 220, bounty: 5 }] },
  { name: 'КОЛОСС РАЗЛОМА', bonus: 90, boss: true, groups: [{ creep: 'colossus', count: 1, interval: 1.0, hp: 5000, bounty: 105, armor: 10 }] },
  // ---- Акт II (13–25): к Дредноуту бездны
  { name: 'Смешанный обвал', bonus: 38, groups: [
    { creep: 'walker', count: 9, interval: 0.8, hp: 290, bounty: 4 },
    { creep: 'sprinter', count: 9, interval: 0.6, hp: 200, bounty: 4 }
  ] },
  { name: 'Стена базальта', bonus: 40, groups: [{ creep: 'bulwark', count: 12, interval: 1.1, hp: 620, bounty: 5, armor: 8 }] },
  { name: 'Буря искр', bonus: 42, groups: [{ creep: 'wasp', count: 18, interval: 0.68, hp: 280, bounty: 4 }] },
  { name: 'Золотая жила', bonus: 46, extra: true, groups: [{ creep: 'scarab', count: 22, interval: 0.6, hp: 222, bounty: 4 }] },
  { name: 'Старейшины бездны', bonus: 48, regen: 12, groups: [{ creep: 'shaman', count: 14, interval: 0.88, hp: 410, bounty: 5, armor: 5 }] },
  { name: 'Крылья расщелин', bonus: 52, groups: [{ creep: 'wyvern', count: 16, interval: 0.74, hp: 330, bounty: 5 }] },
  { name: 'ПРОКЛЯТЫЕ ЖРЕЦЫ', bonus: 62, hero: true, regen: 18, groups: [{ creep: 'shaman', count: 2, interval: 6.0, hp: 2700, bounty: 44, armor: 10 }] },
  { name: 'Лавина камня', bonus: 54, groups: [{ creep: 'walker', count: 28, interval: 0.5, hp: 320, bounty: 3 }] },
  { name: 'Несокрушимый строй', bonus: 58, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 15, interval: 1.0, hp: 900, bounty: 6, armor: 10 }] },
  { name: 'Камень и крылья', bonus: 64, groups: [
    { creep: 'sprinter', count: 16, interval: 0.5, hp: 410, bounty: 4 },
    { creep: 'wyvern', count: 12, interval: 0.7, hp: 390, bounty: 5 }
  ] },
  { name: 'Двойной обвал', bonus: 66, groups: [
    { creep: 'scarab', count: 16, interval: 0.52, hp: 340, bounty: 4 },
    { creep: 'wasp', count: 16, interval: 0.52, hp: 310, bounty: 4 }
  ] },
  { name: 'Небесный разлом', bonus: 74, groups: [{ creep: 'wyvern', count: 20, interval: 0.62, hp: 470, bounty: 6 }] },
  { name: 'ДРЕДНОУТ БЕЗДНЫ', bonus: 150, boss: true, groups: [{ creep: 'dreadnought', count: 1, interval: 1.0, hp: 7400, bounty: 165, armor: 12 }] },
];
