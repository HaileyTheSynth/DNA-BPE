const MathCreature = require('../src/MathCreature').default;

test('generatePoints returns correct length', () => {
  const mc = new MathCreature({ id: 0 });
  const pts = mc.generatePoints(0, 1000);
  expect(pts.length).toBe(1000);
  expect(Number.isFinite(pts[0].x)).toBe(true);
});

test('crossover preserves genome length', () => {
  const a = new MathCreature({ id: 1 });
  const b = new MathCreature({ id: 2 });
  const child = MathCreature.crossover(a, b, 3, 1);
  expect(child.genome.length).toBe(16);
  expect(child.parentIds).toEqual([1,2]);
});