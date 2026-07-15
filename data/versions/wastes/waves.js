// Wastes waves: 24 waves in two acts (bosses at 12/24), ~10-15% tougher than
// Canyon — the endgame map, unlocked last. Player has the full 8-tower arsenal
// to compensate. Flags: immuneToSlow, regen (hp/sec), hero (mini-boss),
// extra (bonus wave: escapes cost no lives, kills pay double), boss.
globalThis.WastesVersion = globalThis.WastesVersion || {};
WastesVersion.waves = [
  // ---- Акт I (1–12)
  { name: 'Первая вылазка', bonus: 12, groups: [{ creep: 'walker', count: 10, interval: 1.0, hp: 44, bounty: 2 }] },
  { name: 'Мародёры', bonus: 14, groups: [{ creep: 'walker', count: 12, interval: 0.9, hp: 62, bounty: 2 }] },
  { name: 'Пепельные бегуны', bonus: 16, groups: [{ creep: 'sprinter', count: 12, interval: 0.8, hp: 50, bounty: 2 }] },
  { name: 'Ржавый вал', bonus: 18, groups: [{ creep: 'bulwark', count: 8, interval: 1.3, hp: 175, bounty: 4, armor: 3 }] },
  { name: 'Стеклянный рой', bonus: 20, groups: [{ creep: 'wasp', count: 12, interval: 0.9, hp: 80, bounty: 3 }] },
  { name: 'Долгий переход', bonus: 22, groups: [{ creep: 'walker', count: 16, interval: 0.72, hp: 140, bounty: 3 }] },
  { name: 'Стальная лихорадка', bonus: 24, extra: true, groups: [{ creep: 'scarab', count: 16, interval: 0.7, hp: 112, bounty: 3 }] },
  { name: 'Шаманы пепла', bonus: 26, regen: 7, groups: [{ creep: 'shaman', count: 10, interval: 1.0, hp: 205, bounty: 4, armor: 3 }] },
  { name: 'Небесная стая', bonus: 28, groups: [{ creep: 'wasp', count: 14, interval: 0.8, hp: 185, bounty: 4 }] },
  { name: 'Неудержимая стена', bonus: 32, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 10, interval: 1.2, hp: 440, bounty: 5, armor: 7 }] },
  { name: 'Змеиный ветер', bonus: 35, groups: [{ creep: 'wyvern', count: 12, interval: 0.8, hp: 215, bounty: 5 }] },
  { name: 'ДЖАГГЕРНАУТ', bonus: 80, boss: true, groups: [{ creep: 'juggernaut', count: 1, interval: 1.0, hp: 4600, bounty: 100, armor: 10 }] },
  // ---- Акт II (13–24)
  { name: 'Смешанный вал', bonus: 38, groups: [
    { creep: 'walker', count: 9, interval: 0.8, hp: 285, bounty: 4 },
    { creep: 'sprinter', count: 9, interval: 0.62, hp: 195, bounty: 4 }
  ] },
  { name: 'Гранитный строй', bonus: 40, groups: [{ creep: 'bulwark', count: 12, interval: 1.1, hp: 600, bounty: 5, armor: 8 }] },
  { name: 'Буря ос', bonus: 42, groups: [{ creep: 'wasp', count: 18, interval: 0.68, hp: 270, bounty: 4 }] },
  { name: 'Золотой панцирь', bonus: 46, extra: true, groups: [{ creep: 'scarab', count: 22, interval: 0.6, hp: 215, bounty: 4 }] },
  { name: 'Старейшины пепла', bonus: 48, regen: 12, groups: [{ creep: 'shaman', count: 14, interval: 0.88, hp: 400, bounty: 5, armor: 5 }] },
  { name: 'ПРОКЛЯТЫЕ ВОЖДИ', bonus: 62, hero: true, regen: 18, groups: [{ creep: 'shaman', count: 2, interval: 6.0, hp: 2600, bounty: 42, armor: 10 }] },
  { name: 'Лавина', bonus: 52, groups: [{ creep: 'walker', count: 28, interval: 0.5, hp: 300, bounty: 3 }] },
  { name: 'Крылья пустоши', bonus: 54, groups: [{ creep: 'wyvern', count: 17, interval: 0.72, hp: 340, bounty: 5 }] },
  { name: 'Несгибаемые', bonus: 58, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 15, interval: 1.0, hp: 880, bounty: 6, armor: 10 }] },
  { name: 'Пепел и сталь', bonus: 64, groups: [
    { creep: 'sprinter', count: 16, interval: 0.5, hp: 400, bounty: 4 },
    { creep: 'wyvern', count: 12, interval: 0.7, hp: 380, bounty: 5 }
  ] },
  { name: 'Двойной шторм', bonus: 66, groups: [
    { creep: 'scarab', count: 16, interval: 0.52, hp: 330, bounty: 4 },
    { creep: 'wasp', count: 16, interval: 0.52, hp: 300, bounty: 4 }
  ] },
  { name: 'БЕГЕМОТ ПУСТОШЕЙ', bonus: 130, boss: true, groups: [{ creep: 'behemoth', count: 1, interval: 1.0, hp: 6600, bounty: 150, armor: 12 }] },
];
