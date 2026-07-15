// Rift map: a VERTICAL serpentine (20x20). Enemies pour down and up through six
// vertical lanes, weaving top-to-bottom — a fresh axis after the horizontal
// serpentines and the spiral. A horizontal row of towers across the middle
// (row ~9) covers every lane at once.
globalThis.RiftVersion = globalThis.RiftVersion || {};
RiftVersion.map = {
  cols: 20,
  rows: 20,
  cellSize: 36,
  waypoints: [
    { col: 2,  row: -1 },
    { col: 2,  row: 17 },
    { col: 5,  row: 17 },
    { col: 5,  row: 2 },
    { col: 8,  row: 2 },
    { col: 8,  row: 17 },
    { col: 11, row: 17 },
    { col: 11, row: 2 },
    { col: 14, row: 2 },
    { col: 14, row: 17 },
    { col: 17, row: 17 },
    { col: 17, row: 2 },
    { col: 20, row: 2 },
  ],
};
