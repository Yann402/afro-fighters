import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER, CHARACTERS } from '../../src/sim/characters.js';
import { Match } from '../../src/sim/match.js';
import { METER_MAX, GUARD_MAX } from '../../src/sim/constants.js';
import { input, noInput, monkey } from '../helpers/sim.mjs';

function duel(a, b, dist, opts) {
  const m = new Match(a, b, opts);
  while (m.phase !== 'fight') m.step([noInput(), noInput()]);
  m.drainEvents();
  m.fighters[0].x = -dist / 2; m.fighters[1].x = dist / 2;
  return m;
}
const contact = (a, b) => CHARACTERS[a].pushWidth + CHARACTERS[b].pushWidth + 0.02;
function play(m, frames, p1, p2 = () => noInput()) {
  const evs = [];
  for (let i = 0; i < frames; i++) { m.step([p1(i, m), p2(i, m)]); evs.push(...m.drainEvents()); }
  return evs;
}

for (const a of ROSTER) {
  test(`${a} : le coup moyen touche, et léger → moyen s'enchaîne en combo`, () => {
    const m = duel(a, 'themba', contact(a, 'themba'));
    const evs = play(m, 70, (i, mm) => {
      const f = mm.fighters[0];
      if (i === 0) return input([], ['light']);
      if (f.moveConnected && f.move && f.move.id === 'light') return input([], ['medium']);
      return noInput();
    });
    const hits = evs.filter((e) => e.type === 'hit');
    assert.ok(hits.some((h) => h.moveId === 'medium'), 'le coup moyen ne touche pas');
    assert.ok(hits.some((h) => h.combo >= 2), "l'enchaînement n'est pas compté comme un combo");
  });

  test(`${a} : ruée avant et esquive arrière se déplacent dans le bon sens`, () => {
    const m = duel(a, 'modou', 4);
    const x0 = m.fighters[0].x;
    play(m, 30, (i) => (i === 0 ? input([], ['dash']) : noInput()));
    assert.ok(m.fighters[0].x > x0 + 0.6, `ruée : ${x0} -> ${m.fighters[0].x}`);
    const x1 = m.fighters[0].x;
    play(m, 30, (i) => (i === 0 ? input(['left'], ['dash']) : noInput()));
    assert.ok(m.fighters[0].x < x1 - 0.5, `esquive : ${x1} -> ${m.fighters[0].x}`);
    assert.equal(m.fighters[0].state, 'idle');
  });

  test(`${a} : l'esquive arrière évite un coup léger porté au contact`, () => {
    for (const b of ROSTER) {
      const m = duel(b, a, contact(a, b));
      const startup = CHARACTERS[b].moves.light.startup;
      // l'esquive part 3 frames avant l'impact : le coup tombe pendant l'invulnérabilité
      const evs = play(m, 40, (i) => (i === 0 ? input([], ['light']) : noInput()), (i) => (i === startup - 4 ? input(['right'], ['dash']) : noInput()));
      assert.ok(!evs.some((e) => e.type === 'hit'), `${b} touche ${a} malgré l'esquive`);
    }
  });

  test(`${a} : garde levée juste avant l'impact = contre, l'attaquant est déséquilibré`, () => {
    for (const b of ROSTER) {
      const m = duel(b, a, contact(a, b));
      const startup = CHARACTERS[b].moves.light.startup;
      const evs = play(m, 20, (i) => (i === 0 ? input([], ['light']) : noInput()), (i) => (i >= startup - 4 ? input(['guard']) : noInput()));
      assert.ok(evs.some((e) => e.type === 'parry'), `pas de contre de ${a} sur ${b}`);
      assert.equal(m.fighters[0].state, 'parried');
      assert.equal(m.fighters[1].hp, CHARACTERS[a].hp, 'un contre ne doit coûter aucun point de vie');
      // le défenseur peut punir : son coup léger touche l'attaquant déséquilibré
      const ev2 = play(m, 25, () => noInput(), (i) => (i === 0 ? input([], ['light']) : noInput()));
      assert.ok(ev2.some((e) => e.type === 'hit' && e.by === 1), 'la punition après contre ne touche pas');
    }
  });

  test(`${a} : marteler la garde ne donne pas de contres en série`, () => {
    const m = duel('themba', a, contact(a, 'themba'));
    let parries = 0;
    const evs = play(m, 400, (i) => (i % 22 === 0 ? input([], ['light']) : noInput()), (i) => (i % 4 < 2 ? input(['guard']) : noInput()));
    parries = evs.filter((e) => e.type === 'parry').length;
    const attempts = evs.filter((e) => e.type === 'whoosh' && e.f === 0).length;
    assert.ok(parries <= attempts * 0.5, `${parries} contres pour ${attempts} coups`);
  });

  test(`${a} : trop de coups bloqués brisent la garde, puis elle se régénère`, () => {
    const m = duel('lekishon', a, 1.5, { training: true });
    for (let i = 0; i < 12; i++) m.step([noInput(), input(['guard'])]);
    const evs = play(m, 900, (i, mm) => (mm.fighters[0].free && mm.fighters[1].state !== 'dizzy' ? input([], ['heavy']) : noInput()), (i, mm) => (mm.fighters[1].state === 'dizzy' ? noInput() : input(['guard'])));
    assert.ok(evs.some((e) => e.type === 'guardBreak'), 'la garde ne se brise jamais');
    const b = m.fighters[1];
    play(m, 400, () => noInput());
    assert.equal(b.guardHp, GUARD_MAX);
    assert.ok(['idle', 'walk'].includes(b.state));
  });
}

test('garde brisée : le combattant étourdi peut être frappé', () => {
  const m = duel('themba', 'lekishon', 1.2);
  m.fighters[1].guardHp = 1;
  for (let i = 0; i < 12; i++) m.step([noInput(), input(['guard'])]);
  const e1 = play(m, 40, (i) => (i === 0 ? input([], ['heavy']) : noInput()), () => input(['guard']));
  assert.ok(e1.some((e) => e.type === 'guardBreak'));
  assert.equal(m.fighters[1].state, 'dizzy');
  const e2 = play(m, 70, (i, mm) => (mm.fighters[0].free ? input([], ['medium']) : noInput()));
  assert.ok(e2.some((e) => e.type === 'hit'));
});

test('finition : un K.O. porté par un pouvoir spécial est signalé', () => {
  const m = duel('themba', 'modou', 1.4);
  m.fighters[0].meter = METER_MAX; m.fighters[1].hp = 30;
  const evs = play(m, 120, (i) => (i === 0 ? input([], ['special']) : noInput()));
  assert.ok(evs.some((e) => e.type === 'finisher' && e.by === 0));
  assert.ok(evs.some((e) => e.type === 'roundEnd' && e.winner === 0));
});

test('mode entraînement : pas de K.O., pas de chrono, la vie remonte, jauge infinie en option', () => {
  const m = duel('themba', 'lekishon', 1.2, { training: true, infiniteMeter: true });
  m.fighters[1].hp = 20;
  const evs = play(m, 60 * 70, (i, mm) => (i < 600 && mm.fighters[0].free ? input([], [i % 3 ? 'heavy' : 'special']) : noInput()));
  assert.ok(!evs.some((e) => e.type === 'roundEnd'), 'la manche ne doit pas se terminer');
  assert.equal(m.timer, 60);
  assert.equal(m.fighters[1].hp, CHARACTERS.lekishon.hp);
  assert.equal(m.fighters[0].meter, METER_MAX);
  assert.ok(evs.filter((e) => e.type === 'special').length >= 2);
});

test("jongle limitée : pas plus de 4 coups sur un adversaire maintenu en l'air", () => {
  const m = duel('themba', 'modou', 1.0);
  const b = m.fighters[1];
  b.setState('launched'); b.y = 1.0; b.vy = 0.1; b.combo = 1;
  let maxCombo = 0;
  for (let i = 0; i < 300; i++) {
    if (b.state === 'launched') { b.vy = Math.max(b.vy, 0.02); b.y = Math.max(b.y, 0.9); b.x = m.fighters[0].x + 0.9; }
    m.step([m.fighters[0].free ? input([], ['light']) : noInput(), noInput()]);
    for (const e of m.drainEvents()) if (e.type === 'hit') maxCombo = Math.max(maxCombo, e.combo);
  }
  assert.ok(maxCombo <= 4, `combo de ${maxCombo} coups en l'air`);
});

test('état du match : sauvegarde puis restauration donnent exactement la même suite (base du rollback)', () => {
  for (const [a, b] of [['modou', 'themba'], ['lekishon', 'modou'], ['themba', 'lekishon']]) {
    const m = new Match(a, b);
    const A = monkey(11, 'masher'), B = monkey(29, 'mixed');
    const inputs = [];
    const next = () => { const i = [A(), B()]; inputs.push(i); return i; };
    for (let i = 0; i < 700; i++) m.step(next());
    m.drainEvents();
    const saved = JSON.parse(JSON.stringify(m.saveState()));   // l'état doit survivre à un passage par JSON (réseau)
    const sig = (mm) => mm.fighters.map((f) => [f.x.toFixed(6), f.y.toFixed(6), f.hp, f.state, f.mf, f.meter.toFixed(4), f.guardHp.toFixed(3)].join('|')).join(' / ') + ` ${mm.phase} ${mm.timer} ${mm.round}`;
    const trace1 = [];
    const start = inputs.length;
    for (let i = 0; i < 900; i++) { m.step(next()); m.drainEvents(); trace1.push(sig(m)); }
    const m2 = new Match(a, b);
    m2.loadState(saved);
    for (let i = 0; i < 900; i++) { m2.step(inputs[start + i]); m2.drainEvents(); assert.equal(sig(m2), trace1[i], `${a} vs ${b} : divergence à la frame ${i}`); }
  }
});
