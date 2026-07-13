// Path module: converts map waypoints into a continuous route and road cells.
// Path helper: builds an immutable route object from MapConfig.
// Pure logic — no DOM/Canvas. Used by the simulation and (read-only) by the renderer.
function buildPath(map) {
  const cs = map.cellSize;
  const points = map.waypoints.map(wp => ({
    x: wp.col * cs + cs / 2,
    y: wp.row * cs + cs / 2,
  }));

  const segments = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, len, start: total });
    total += len;
  }

  // Grid cells covered by the road (blocked for building).
  const cells = new Set();
  for (const s of segments) {
    const steps = Math.max(1, Math.ceil(s.len / (cs / 2)));
    for (let i = 0; i <= steps; i++) {
      const x = s.a.x + (s.b.x - s.a.x) * (i / steps);
      const y = s.a.y + (s.b.y - s.a.y) * (i / steps);
      const col = Math.floor(x / cs);
      const row = Math.floor(y / cs);
      if (col >= 0 && col < map.cols && row >= 0 && row < map.rows) {
        cells.add(col + ',' + row);
      }
    }
  }

  function posAt(dist) {
    if (dist <= 0) return { x: points[0].x, y: points[0].y };
    for (const s of segments) {
      if (dist <= s.start + s.len) {
        const t = (dist - s.start) / s.len;
        return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
      }
    }
    const last = points[points.length - 1];
    return { x: last.x, y: last.y };
  }

  return {
    points,
    segments,
    totalLength: total,
    cells,
    posAt,
    isRoadCell: (col, row) => cells.has(col + ',' + row),
  };
}
