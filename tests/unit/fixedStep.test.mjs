import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FixedStep } from '../../src/core/fixedStep.js';
import { rng } from '../helpers/sim.mjs';

const DT = 1 / 60;

test('aucun pas perdu à cadence normale, même irrégulière (30 à 240 images/s)', () => {
  const r = rng(7);
  const loop = new FixedStep(DT, 5);
  let steps = 0, time = 0;
  for (let i = 0; i < 20000; i++) {
    const frame = 1 / (30 + r() * 210);
    time += frame;
    steps += loop.advance(frame, () => {});
    assert.ok(loop.alpha >= 0 && loop.alpha <= 1);
  }
  assert.equal(loop.dropped, 0);
  assert.ok(Math.abs(steps - time / DT) <= 1, `${steps} pas pour ${(time / DT).toFixed(1)} attendus`);
});

test('plafond atteint sans retard réel : la fraction de pas est conservée (régression de l’ancienne boucle)', () => {
  const loop = new FixedStep(DT, 5);
  loop.advance(0.5 * DT, () => {});
  for (let i = 0; i < 100; i++) {
    assert.equal(loop.advance(5 * DT, () => {}), 5);
    // l'ancienne version remettait l'accumulateur à zéro ici : interpolation saccadée et temps perdu
    assert.ok(Math.abs(loop.alpha - 0.5) < 1e-6, `alpha = ${loop.alpha}`);
  }
  assert.equal(loop.dropped, 0);
});

test('surcharge : jamais plus de maxSteps par image, pas de spirale, excès comptabilisé', () => {
  const loop = new FixedStep(DT, 5);
  let max = 0;
  for (let i = 0; i < 200; i++) {
    const n = loop.advance(0.25, () => {});      // 4 images/s
    max = Math.max(max, n);
    assert.ok(loop.acc < DT + 1e-9, 'accumulateur non borné');
  }
  assert.equal(max, 5);
  assert.ok(Math.abs(loop.dropped - 200 * (0.25 - 5 * DT)) < 0.05);
  assert.equal(loop.overloads, 200);
});

test('retour d’un onglet en arrière-plan : une longue pause ne provoque pas de rafale', () => {
  const loop = new FixedStep(DT, 5);
  assert.equal(loop.advance(30, () => {}), 5);
  assert.equal(loop.advance(DT, () => {}), 1);
});

test('durées nulles, négatives ou invalides ignorées', () => {
  const loop = new FixedStep(DT, 5);
  for (const v of [0, -1, NaN]) assert.equal(loop.advance(v, () => {}), 0);
  assert.equal(loop.acc, 0);
});
