import test from 'node:test';
import assert from 'node:assert/strict';
import { gridGeometry } from '../js/foly/layout.js';

for (const [width, height] of [[320, 568], [390, 844], [430, 932], [568, 320], [667, 375], [844, 390], [932, 430], [1280, 844], [1892, 844]]) {
  test(`grid fits complete squares at ${width} × ${height}`, () => {
    const geometry = gridGeometry(width, height);
    const { cols, cell, gap, gapY } = geometry;
    assert.ok(Number.isInteger(cols) && cols > 0);
    assert.ok(cell > 0 && gapY >= 0);
    assert.ok(geometry.height >= cell);
    assert.ok(2 * geometry.headerHeight + 2 * geometry.inset + geometry.height <= height + .001);
    assert.ok(Math.abs(2 * geometry.inset + cols * cell + (cols - 1) * gap - width) < .001);
  });
}

test('rotation recalculates the grid without retaining portrait dimensions', () => {
  const portrait = gridGeometry(390, 844);
  const landscape = gridGeometry(844, 390);
  assert.ok(landscape.cols > portrait.cols);
  assert.equal(landscape.inset, landscape.cell);
  assert.deepEqual(gridGeometry(390, 844), portrait);
});

for (const [width, height] of [[358, 754], [320, 568], [390, 844], [430, 932], [568, 320], [667, 375], [800, 390], [844, 390], [932, 430], [1024, 600]]) {
  test(`landscape retains desktop proportions at ${width} × ${height}`, () => {
    const geometry = gridGeometry(width, height);
    const portrait = width <= 680 && height > width;
    assert.equal(geometry.mobile, portrait);
    assert.equal(geometry.inset, geometry.headerHeight);
    assert.equal(geometry.headerHeight, geometry.cell);
    assert.ok(Math.abs(geometry.height + 4 * geometry.headerHeight - height) < .001);
    assert.ok(geometry.cell <= height / 5);
  });
}

test('invalid viewport dimensions are rejected', () => {
  for (const [width, height] of [[0, 844], [390, -1], [NaN, 844], [390, Infinity]]) {
    assert.throws(() => gridGeometry(width, height), RangeError);
  }
});

test('short landscape screens show two full separated rows, never a clipped extra row', () => {
  for (const [width, height] of [[758, 355], [568, 320], [800, 390], [844, 390], [932, 430]]) {
    const { cell, gapY, height: fieldHeight } = gridGeometry(width, height);
    const pitch = cell + gapY;
    const rows = Math.round((fieldHeight + gapY) / pitch);
    assert.ok(rows >= 2, `${width} × ${height}: two full rows`);
    assert.ok(gapY > 0);
    assert.ok(Math.abs(rows * cell + (rows - 1) * gapY - fieldHeight) < .001);
    assert.ok(rows * pitch >= fieldHeight);
  }
});