// Version registry: every playable "map version" = a full alternative config
// set (map, towers, creeps, waves). Version files are loaded via <script>
// before this one (file:// must keep working), so the objects already exist.
// Maps form a progression chain: `unlockedBy` names the version that must be
// beaten (on any difficulty) before this one opens. The first map has none.
const VersionsConfig = {
  classic: {
    id: 'classic',
    name: 'Классика',
    desc: 'Оригинальная пустыня: длинный серпантин, 7 башен, 36 волн, два босса и два героя.',
    map: ClassicVersion.map,
    towers: ClassicVersion.towers,
    creeps: ClassicVersion.creeps,
    waves: ClassicVersion.waves,
  },
  canyon: {
    id: 'canyon',
    name: 'Каньон',
    desc: 'Узкое ущелье с 14 поворотами: 6 башен, цепная «Башня бури», 24 волны и два босса.',
    unlockedBy: 'classic',
    map: CanyonVersion.map,
    towers: CanyonVersion.towers,
    creeps: CanyonVersion.creeps,
    waves: CanyonVersion.waves,
  },
  wastes: {
    id: 'wastes',
    name: 'Пустоши',
    desc: 'Длинный шестиполосный серпантин, полный арсенал из 8 башен (вкл. грозовую), 24 самых крепких волны и два босса.',
    unlockedBy: 'canyon',
    map: WastesVersion.map,
    towers: WastesVersion.towers,
    creeps: WastesVersion.creeps,
    waves: WastesVersion.waves,
  },
  vortex: {
    id: 'vortex',
    name: 'Воронка',
    desc: 'Финал: спираль, закрученная к центру. Полный арсенал из 8 башен, 26 волн и ТРИ босса подряд — Хранитель, Левиафан и Аватар бури.',
    unlockedBy: 'wastes',
    map: VortexVersion.map,
    towers: VortexVersion.towers,
    creeps: VortexVersion.creeps,
    waves: VortexVersion.waves,
  },
};

// Display order of the version cards in the menu (also the progression order).
const VersionOrder = ['classic', 'canyon', 'wastes', 'vortex'];
