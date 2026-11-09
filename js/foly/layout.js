// Keep at least one complete row between the header/footer and the grid margins.
export function gridGeometry(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Invalid viewport size');
  }
  const gapRatio = 10 / 62;
  const preferred = (width < 680 ? 46 : 62) * 1.4;
  const mobile = width <= 680 || (height <= 480 && width > height);
  if (mobile) {
    const cols = Math.max(1, Math.round((width / preferred + gapRatio) / (1 + gapRatio)));
    const cell = width / (cols + (cols - 1) * gapRatio);
    const headerHeight = Math.max(64, cell);
    const fieldHeight = Math.max(cell, height - 2 * headerHeight);
    const visibleRows = Math.max(1, Math.floor((fieldHeight + cell * gapRatio) / (cell * (1 + gapRatio))));
    const gapY = visibleRows > 1 ? (fieldHeight - visibleRows * cell) / (visibleRows - 1) : 0;
    return { cols, cell, gap: cell * gapRatio, height: fieldHeight, gapY, inset: 0, headerHeight, mobile };
  }
  const target = Math.min(preferred, height / 5);
  const estimate = (width / target - 2 + gapRatio) / (1 + gapRatio);
  const cols = Math.max(1, target < preferred ? Math.ceil(estimate) : Math.round(estimate));
  const cell = width / (2 + cols + (cols - 1) * gapRatio);
  const gap = cell * gapRatio;
  const fieldHeight = Math.max(cell, height - 4 * cell);
  const visibleRows = Math.max(1, Math.floor((fieldHeight + gap) / (cell + gap)));
  const gapY = visibleRows > 1 ? (fieldHeight - visibleRows * cell) / (visibleRows - 1) : 0;
  return { cols, cell, gap, height: fieldHeight, gapY, inset: cell, headerHeight: cell, mobile };
}