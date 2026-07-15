// Wastes map: a long six-lane serpentine (20x20) — the endgame sprawl.
// Longer than Classic/Canyon: enemies weave through six horizontal lanes, and
// the central columns (cols ~8-11) are crossed by every lane, so a stacked
// tower column there covers the whole board.
globalThis.WastesVersion = globalThis.WastesVersion || {};
WastesVersion.map = {
  cols: 20,
  rows: 20,
  cellSize: 36,
  waypoints: [
    { col: -1, row: 2 },
    { col: 17, row: 2 },
    { col: 17, row: 5 },
    { col: 2,  row: 5 },
    { col: 2,  row: 8 },
    { col: 17, row: 8 },
    { col: 17, row: 11 },
    { col: 2,  row: 11 },
    { col: 2,  row: 14 },
    { col: 17, row: 14 },
    { col: 17, row: 17 },
    { col: 2,  row: 17 },
    { col: 2,  row: 20 },
  ],
};
