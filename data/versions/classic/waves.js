// Classic waves: 36 waves in three acts. Bosses (boss:true) at 24 & 36;
// hero mini-boss waves (hero:true) at 12 & 33.
// Special flags: immuneToSlow, regen (hp/sec), hero (mini-boss), extra (bonus
// wave: escapes cost no lives, kills pay double), boss.
globalThis.ClassicVersion = globalThis.ClassicVersion || {};
ClassicVersion.waves = [
  // ---- Акт I (1–12)
  { name: 'Разведчики', bonus: 12, groups: [{ creep: 'walker', count: 10, interval: 1.0, hp: 40, bounty: 2 }] },
  { name: 'Налётчики', bonus: 14, groups: [{ creep: 'walker', count: 12, interval: 0.9, hp: 58, bounty: 2 }] },
  { name: 'Песчаные бегуны', bonus: 16, groups: [{ creep: 'sprinter', count: 12, interval: 0.8, hp: 48, bounty: 2 }] },
  { name: 'Громилы', bonus: 18, groups: [{ creep: 'bulwark', count: 8, interval: 1.3, hp: 170, bounty: 4, armor: 3 }] },
  { name: 'Пыльный рой', bonus: 20, groups: [{ creep: 'wasp', count: 12, interval: 0.9, hp: 75, bounty: 3 }] },
  { name: 'Длинный марш', bonus: 22, groups: [{ creep: 'walker', count: 15, interval: 0.75, hp: 135, bounty: 3 }] },
  { name: 'Золотая лихорадка', bonus: 24, extra: true, groups: [{ creep: 'scarab', count: 16, interval: 0.72, hp: 96, bounty: 3 }] },
  { name: 'Жрецы дюн', bonus: 26, regen: 6, groups: [{ creep: 'shaman', count: 10, interval: 1.0, hp: 180, bounty: 4, armor: 2 }] },
  { name: 'Небесный дозор', bonus: 28, groups: [{ creep: 'wasp', count: 14, interval: 0.8, hp: 160, bounty: 4 }] },
  { name: 'Неудержимые', bonus: 32, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 10, interval: 1.2, hp: 400, bounty: 5, armor: 6 }] },
  { name: 'Быстрые крылья', bonus: 35, groups: [{ creep: 'wyvern', count: 12, interval: 0.82, hp: 190, bounty: 5 }] },
  { name: 'ВОЖДИ ДЮН', bonus: 45, hero: true, groups: [{ creep: 'bulwark', count: 2, interval: 6.0, hp: 950, bounty: 40, armor: 8 }] },
  // ---- Акт II (13–24)
  { name: 'Смешанный караван', bonus: 36, groups: [
    { creep: 'walker', count: 8, interval: 0.8, hp: 220, bounty: 4 },
    { creep: 'sprinter', count: 8, interval: 0.65, hp: 150, bounty: 4 }
  ] },
  { name: 'Щитоносцы', bonus: 32, groups: [{ creep: 'bulwark', count: 12, interval: 1.1, hp: 520, bounty: 4, armor: 7 }] },
  { name: 'Осиный шторм', bonus: 34, groups: [{ creep: 'wasp', count: 18, interval: 0.7, hp: 230, bounty: 4 }] },
  { name: 'Блестящие панцири', bonus: 42, extra: true, groups: [{ creep: 'scarab', count: 20, interval: 0.64, hp: 180, bounty: 4 }] },
  { name: 'Шаманы жара', bonus: 38, regen: 10, groups: [{ creep: 'shaman', count: 14, interval: 0.9, hp: 340, bounty: 5, armor: 4 }] },
  { name: 'Стена пыли', bonus: 40, groups: [{ creep: 'walker', count: 24, interval: 0.52, hp: 240, bounty: 3 }] },
  { name: 'Воздушная охота', bonus: 42, groups: [{ creep: 'wyvern', count: 16, interval: 0.76, hp: 290, bounty: 5 }] },
  { name: 'Големы-стражи', bonus: 44, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 14, interval: 1.0, hp: 760, bounty: 6, armor: 9 }] },
  { name: 'Двойной удар', bonus: 54, groups: [
    { creep: 'scarab', count: 14, interval: 0.55, hp: 260, bounty: 4 },
    { creep: 'wasp', count: 14, interval: 0.55, hp: 250, bounty: 4 }
  ] },
  { name: 'Песчаная ярость', bonus: 50, groups: [{ creep: 'sprinter', count: 22, interval: 0.48, hp: 320, bounty: 4 }] },
  { name: 'Колонна шаманов', bonus: 54, regen: 14, groups: [{ creep: 'shaman', count: 16, interval: 0.78, hp: 460, bounty: 6, armor: 5 }] },
  { name: 'ДРЕВЕНЬ ПЕСКОВ', bonus: 80, boss: true, groups: [{ creep: 'treant', count: 1, interval: 1.0, hp: 4200, bounty: 100, armor: 10 }] },
  // ---- Акт III (25–36)
  { name: 'Бесконечная колонна', bonus: 50, groups: [{ creep: 'walker', count: 26, interval: 0.5, hp: 430, bounty: 4 }] },
  { name: 'Крылья бури', bonus: 54, groups: [{ creep: 'wyvern', count: 18, interval: 0.68, hp: 390, bounty: 5 }] },
  { name: 'Сокровищница', bonus: 58, extra: true, groups: [{ creep: 'scarab', count: 24, interval: 0.55, hp: 350, bounty: 3 }] },
  { name: 'Непробиваемые', bonus: 62, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 16, interval: 1.0, hp: 980, bounty: 6, armor: 10 }] },
  { name: 'Старшие жрецы', bonus: 66, regen: 18, groups: [{ creep: 'shaman', count: 18, interval: 0.8, hp: 620, bounty: 6, armor: 6 }] },
  { name: 'Буря и песок', bonus: 70, groups: [
    { creep: 'sprinter', count: 14, interval: 0.55, hp: 460, bounty: 5 },
    { creep: 'wyvern', count: 12, interval: 0.7, hp: 430, bounty: 5 }
  ] },
  { name: 'Великий марш', bonus: 74, groups: [{ creep: 'walker', count: 30, interval: 0.45, hp: 540, bounty: 4 }] },
  { name: 'Рой прародителя', bonus: 78, groups: [{ creep: 'wasp', count: 22, interval: 0.6, hp: 540, bounty: 5 }] },
  { name: 'ИЗБРАННЫЕ ПЕСКОВ', bonus: 82, hero: true, regen: 20, groups: [{ creep: 'shaman', count: 2, interval: 6.0, hp: 2800, bounty: 40, armor: 10 }] },
  { name: 'Последний заслон', bonus: 86, immuneToSlow: true, groups: [{ creep: 'bulwark', count: 18, interval: 0.95, hp: 1280, bounty: 6, armor: 11 }] },
  { name: 'Вестники конца', bonus: 90, groups: [{ creep: 'wyvern', count: 20, interval: 0.62, hp: 640, bounty: 6 }] },
  { name: 'ПРАРОДИТЕЛЬ ДЮН', bonus: 120, boss: true, groups: [{ creep: 'ancient', count: 1, interval: 1.0, hp: 9000, bounty: 150, armor: 12 }] },
];
