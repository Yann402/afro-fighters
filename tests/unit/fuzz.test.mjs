import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER } from '../../src/sim/characters.js';
import { AIController } from '../../src/sim/ai.js';
import { monkey, playMatch } from '../helpers/sim.mjs';

const ai = (d, seed) => { const c = new AIController(d, seed); return (s, o, m) => c.think(s, o, m); };
const pairs = ROSTER.flatMap((a) => ROSTER.map((b) => [a, b]));

test('fuzz : entrées aléatoires contre entrées aléatoires, aucun invariant violé', () => {
  let n = 0;
  for (const [a, b] of pairs) for (const style of ['mixed', 'masher', 'turtle']) for (let s = 0; s < 12; s++) {
    const r = playMatch(a, b, monkey(100 + s * 7 + n, style), monkey(900 + s * 13 + n, 'masher'));
    n++;
    assert.deepEqual(r.errors, [], `${a} vs ${b} (${style}, graine ${s})`);
    assert.ok(r.finished, `${a} vs ${b} : le match ne se termine pas`);
  }
});

test('fuzz : entrées aléatoires contre les trois IA', () => {
  let n = 0;
  for (const [a, b] of pairs) for (const d of ['facile', 'normal', 'difficile']) for (let s = 0; s < 8; s++) {
    const r = playMatch(a, b, monkey(31 + n * 3, 'masher'), ai(d, 77 + n));
    n++;
    assert.deepEqual(r.errors, [], `${a} vs IA ${d} ${b} (graine ${s})`);
    assert.ok(r.finished);
  }
});

test('IA contre IA : tous les matchs se terminent sans violation', () => {
  let n = 0;
  for (const [a, b] of pairs) for (const d1 of ['facile', 'normal', 'difficile']) for (const d2 of ['facile', 'difficile']) for (let s = 0; s < 4; s++) {
    const r = playMatch(a, b, ai(d1, 5 + n), ai(d2, 500 + n));
    n++;
    assert.deepEqual(r.errors, [], `${a}(${d1}) vs ${b}(${d2})`);
    assert.ok(r.finished);
  }
});

test('déterminisme : mêmes graines, même déroulement (prérequis du rollback netcode)', () => {
  for (const [a, b] of pairs) {
    const run = () => playMatch(a, b, ai('difficile', 42), ai('normal', 4242), { check: false });
    const x = run(), y = run();
    assert.equal(x.hash, y.hash, `${a} vs ${b}`);
    assert.equal(x.frames, y.frames);
  }
});
