// Version registry: every playable "map version" = a full alternative config
// set (map, towers, creeps, waves). Version files are loaded via <script>
// before this one (file:// must keep working), so the objects already exist.
const VersionsConfig = {
  classic: {
    id: 'classic',
    name: 'Классика',
    desc: 'Оригинальная пустыня: длинный серпантин, 7 башен, 36 волн и три босса.',
    map: ClassicVersion.map,
    towers: ClassicVersion.towers,
    creeps: ClassicVersion.creeps,
    waves: ClassicVersion.waves,
  },
  canyon: {
    id: 'canyon',
    name: 'Каньон',
    desc: 'Узкое ущелье с 14 поворотами: 6 башен, цепная «Башня бури», 24 волны и два босса.',
    map: CanyonVersion.map,
    towers: CanyonVersion.towers,
    creeps: CanyonVersion.creeps,
    waves: CanyonVersion.waves,
  },
};

// Display order of the version cards in the menu.
const VersionOrder = ['classic', 'canyon'];
