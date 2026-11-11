// Keep at least one complete row between the header/footer and the grid margins.
export function gridGeometry(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new RangeError('Invalid viewport size');
  }
  const gapRatio = 10 / 62;
  const preferred = (width < 680 ? 46 : 62) * 1.4;
  const mobile = width <= 680 && height > width;
  const cornerRatio = 1;
  const landscapePhone = width > height && height <= 480;
  const target = Math.min(preferred, height / (landscapePhone ? 6 + gapRatio : 5));
  const estimate = (width / target - 2 * cornerRatio + gapRatio) / (1 + gapRatio);
  const cols = Math.max(1, target < preferred ? Math.ceil(estimate) : Math.round(estimate));
  const cell = width / (2 * cornerRatio + cols + (cols - 1) * gapRatio);
  const headerHeight = cell * cornerRatio;
  const gap = cell * gapRatio;
  const fieldHeight = Math.max(cell, height - 4 * headerHeight);
  const visibleRows = Math.max(1, Math.floor((fieldHeight + gap) / (cell + gap)));
  const gapY = visibleRows > 1 ? (fieldHeight - visibleRows * cell) / (visibleRows - 1) : fieldHeight - cell;
  return { cols, cell, gap, height: fieldHeight, gapY, inset: headerHeight, headerHeight, mobile };
}