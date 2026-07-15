// Vortex map: an inward rectangular spiral (20x20). Unlike the serpentines,
// the road coils clockwise from the outer edge to a sink at the very centre —
// enemies "reach the heart" instead of exiting a side. Build cells sit on the
// rings between the coils; the tight centre is a natural dense kill-zone.
globalThis.VortexVersion = globalThis.VortexVersion || {};
VortexVersion.map = {
  cols: 20,
  rows: 20,
  cellSize: 36,
  waypoints: [
    { col: -1, row: 2 },
    { col: 17, row: 2 },
    { col: 17, row: 17 },
    { col: 2,  row: 17 },
    { col: 2,  row: 5 },
    { col: 14, row: 5 },
    { col: 14, row: 14 },
    { col: 5,  row: 14 },
    { col: 5,  row: 8 },
    { col: 11, row: 8 },
    { col: 11, row: 11 },
    { col: 8,  row: 11 },
    { col: 8,  row: 9 },
  ],
};
