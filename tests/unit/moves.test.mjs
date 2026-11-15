import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER, CHARACTERS } from '../../src/sim/characters.js';
import { Match } from '../../src/sim/match.js';
import { METER_MAX, HURT_HALF_WIDTH } from '../../src/sim/constants.js';
import { input, noInput } from '../helpers/sim.mjs';

// Place deux combattants face à face, en phase de combat, à la distance voulue.
function duel(a, b, dist) {
  const m = new Match(a, b);
  while (m.phase !== 'fight') m.step([noInput(), noInput()]);
  m.drainEvents();
  m.fighters[0].x = -dist / 2; m.fighters[1].x = dist / 2;
  return m;
}
function run(m, frames, first = noInput(), p2 = () => noInput()) {
  const evs = [];
  for (let i = 0; i < frames; i++) { m.step([i === 0 ? first : noInput(), p2(i)]); evs.push(...m.drainEvents()); }
  return evs;
}
const contact = (a, b) => CHARACTERS[a].pushWidth + CHARACTERS[b].pushWidth + 0.02;

for (const a of ROSTER) for (const b of ROSTER) {
  const A = CHARACTERS[a];

  test(`${a} → ${b} : le coup léger touche au contact et inflige ses dégâts`, () => {
    const m = duel(a, b, contact(a, b));
    const evs = run(m, 30, input([], ['light']));
    const hit = evs.find((e) => e.type === 'hit');
    assert.ok(hit, 'aucun impact');
    assert.equal(m.fighters[1].hp, CHARACTERS[b].hp - hit.dmg);
  });

  test(`${a} → ${b} : le coup lourd atteint sa portée maximale annoncée, pas au-delà`, () => {
    const mv = A.moves.heavy;
    const reach = mv.maxReach + mv.advance + HURT_HALF_WIDTH;
    const near = duel(a, b, reach - 0.12);
    const e1 = run(near, mv.total + 60, input([], ['heavy']));
    assert.ok(e1.some((e) => e.type === 'hit' || e.type === 'grab'), `ne touche pas à ${(reach - 0.12).toFixed(2)} m`);
    const far = duel(a, b, reach + 0.15);
    const e2 = run(far, mv.total + 5, input([], ['heavy']));
    assert.ok(!e2.some((e) => e.type === 'hit' || e.type === 'grab'), 'touche au-delà de sa portée');
  });

  test(`${a} → ${b} : la garde bloque les coups, pas les projections`, () => {
    const hold = () => input(['guard']);
    const m1 = duel(a, b, contact(a, b));
    const e1 = run(m1, 30, input([], ['light']), hold);
    assert.ok(e1.some((e) => e.type === 'block'), 'le coup léger devrait être bloqué');
    assert.ok(!e1.some((e) => e.type === 'hit'));
    const m2 = duel(a, b, contact(a, b));
    for (let i = 0; i < 3; i++) m2.step([noInput(), hold()]);
    const e2 = run(m2, 90, input(['right'], ['heavy']), hold);
    assert.ok(e2.some((e) => e.type === 'grab'), 'la projection devrait passer la garde');
    assert.ok(e2.some((e) => e.type === 'slam'), 'la projection devrait aller à son terme');
    assert.notEqual(m2.fighters[1].state, 'thrown');
  });

  test(`${a} → ${b} : une projection ne saisit pas un adversaire en l'air`, () => {
    const m = duel(a, b, contact(a, b));
    m.fighters[1].y = 1.2; m.fighters[1].vy = 0.12; m.fighters[1].setState('air');
    const evs = run(m, 12, input(['right'], ['heavy']));
    assert.ok(!evs.some((e) => e.type === 'grab'));
  });

  test(`${a} → ${b} : léger puis lourd s'enchaîne (annulation sur impact)`, () => {
    const m = duel(a, b, contact(a, b));
    const evs = [];
    for (let i = 0; i < 80; i++) {
      const f = m.fighters[0];
      const inp = i === 0 ? input([], ['light']) : (f.moveConnected && f.move && f.move.id === 'light' ? input([], ['heavy']) : noInput());
      m.step([inp, noInput()]); evs.push(...m.drainEvents());
    }
    const second = evs.filter((e) => e.type === 'hit' || e.type === 'grab');
    assert.ok(second.length >= 2 || evs.some((e) => e.type === 'whoosh' && e.heavy), "le coup lourd n'est pas sorti après le léger");
  });

  test(`${a} → ${b} : l'attaque sautée touche un adversaire au sol`, () => {
    const m = duel(a, b, 1.6);
    const evs = [];
    let pressed = false;
    for (let i = 0; i < 80; i++) {
      const f = m.fighters[0];
      let inp = noInput();
      if (i === 0) inp = input(['right'], ['up']);
      else if (f.state === 'jumpsquat') inp = input(['right']);
      else if (f.state === 'air') { inp = input(['right']); if (!pressed && f.vy < 0.02) { inp = input(['right'], ['light']); pressed = true; } }
      m.step([inp, noInput()]); evs.push(...m.drainEvents());
    }
    assert.ok(evs.some((e) => e.type === 'hit' && e.moveId === 'air'), "l'attaque sautée ne touche pas");
  });

  test(`${a} → ${b} : le pouvoir spécial exige une jauge pleine, la vide et inflige des dégâts`, () => {
    const dist = a === 'lekishon' ? 3 : 1.6;
    const m0 = duel(a, b, dist);
    run(m0, 5, input([], ['special']));
    assert.notEqual(m0.fighters[0].state, 'attack', 'spécial déclenché sans jauge');
    const m = duel(a, b, dist);
    m.fighters[0].meter = METER_MAX;
    const evs = run(m, 200, input([], ['special']));
    assert.ok(evs.some((e) => e.type === 'special'));
    assert.equal(evs.filter((e) => e.type === 'special').length, 1);
    assert.ok(m.fighters[1].hp < CHARACTERS[b].hp, "le spécial n'a infligé aucun dégât à un adversaire immobile");
    assert.ok(m.fighters[0].meter < METER_MAX);
    assert.ok(['idle', 'walk'].includes(m.fighters[0].state), `le lanceur finit en « ${m.fighters[0].state} »`);
  });
}

test('coup contre projection à la même frame : le coup gagne, personne ne reste bloqué', () => {
  for (const a of ROSTER) for (const b of ROSTER) {
    const tm = CHARACTERS[a].moves.throw, lm = CHARACTERS[b].moves.light;
    const m = duel(a, b, contact(a, b));
    // synchronise les premières frames actives des deux coups
    const dA = Math.max(0, lm.startup - tm.startup), dB = Math.max(0, tm.startup - lm.startup);
    for (let i = 0; i < 140; i++) {
      m.step([i === dA ? input(['right'], ['heavy']) : noInput(), i === dB ? input([], ['light']) : noInput()]);
      m.drainEvents();
      assert.ok(!(m.fighters[1].state === 'thrown' && m.fighters[0].state !== 'throwing'), `${a} vs ${b} : projeté orphelin`);
    }
    assert.ok(['idle', 'walk', 'guard'].includes(m.fighters[0].state) && ['idle', 'walk', 'guard'].includes(m.fighters[1].state), `${a} vs ${b} : ${m.fighters[0].state}/${m.fighters[1].state}`);
  }
});

test('Adumu : invulnérable pendant les deux premiers bonds, interruptible pendant le troisième', () => {
  const sp = CHARACTERS.lekishon.moves.special;
  assert.deepEqual(sp.invuln, [1, 40]);
  for (const [pressAt, expectHit] of [[5, false], [44, true]]) {
    const m = duel('lekishon', 'themba', 1.2);
    m.fighters[0].meter = METER_MAX;
    const evs = [];
    for (let i = 0; i < 70; i++) {
      m.step([i === 0 ? input([], ['special']) : noInput(), i === pressAt ? input([], ['heavy']) : noInput()]);
      evs.push(...m.drainEvents());
    }
    const hit = evs.some((e) => e.type === 'hit' && e.by === 1);
    assert.equal(hit, expectHit, `coup lancé à la frame ${pressAt}`);
  }
});

test('la garde ne peut pas mettre K.O. (dégâts d’usure plafonnés à 1 PV)', () => {
  const m = duel('lekishon', 'modou', 1.2);
  m.fighters[1].hp = 3;
  run(m, 40, input([], ['heavy']), () => input(['guard']));
  assert.equal(m.fighters[1].hp, 1);
});

test('manche au chrono : le plus de PV restants (en proportion) gagne', () => {
  const m = duel('modou', 'lekishon', 5);
  m.fighters[1].hp -= 100;
  m.timer = 1;
  const evs = run(m, 70);
  const end = evs.find((e) => e.type === 'roundEnd');
  assert.equal(end.reason, 'time'); assert.equal(end.winner, 0);
});
