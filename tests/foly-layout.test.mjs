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
  assert.equal(landscape.inset, 0);
  assert.deepEqual(gridGeometry(390, 844), portrait);
});

test('invalid viewport dimensions are rejected', () => {
  for (const [width, height] of [[0, 844], [390, -1], [NaN, 844], [390, Infinity]]) {
    assert.throws(() => gridGeometry(width, height), RangeError);
  }
});