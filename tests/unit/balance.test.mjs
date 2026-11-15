import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER } from '../../src/sim/characters.js';
import { analyse } from '../../tools/balance.mjs';

// Garde-fous larges (les valeurs fines sont dans docs/EQUILIBRAGE.md) : ils détectent une régression
// grossière d'équilibrage, pas une variation de quelques points.
for (const d of ['normal', 'difficile']) {
  test(`équilibrage IA ${d} : aucun combattant hors de 35–65 %, aucune confrontation au-delà de 75–25`, () => {
    const r = analyse(d, d, 40);
    for (const id of ROSTER) {
      const p = r.wins[id] / r.games[id];
      assert.ok(p > 0.35 && p < 0.65, `${id} : ${(p * 100).toFixed(0)} %`);
    }
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const ab = r.matchup[`${ROSTER[i]}>${ROSTER[j]}`], ba = r.matchup[`${ROSTER[j]}>${ROSTER[i]}`];
      const p = (ab.w + ba.n - ba.w) / (ab.n + ba.n);
      assert.ok(p > 0.25 && p < 0.75, `${ROSTER[i]} contre ${ROSTER[j]} : ${(p * 100).toFixed(0)} %`);
    }
    for (const id of ROSTER) assert.ok(r.combo[id].maxPct <= 45, `combo de ${id} : ${r.combo[id].maxPct} % des PV`);
    assert.equal(r.timeouts, 0, 'des manches se terminent au chrono : IA trop passive');
  });
}

test('hiérarchie des niveaux : chaque IA bat nettement le niveau inférieur', () => {
  for (const [hi, lo] of [['normal', 'facile'], ['difficile', 'normal']]) {
    const r = analyse(hi, lo, 15);
    // analyse(hi, lo) : le premier nommé de chaque confrontation joue en « hi »
    let w = 0, n = 0;
    for (const k in r.matchup) { w += r.matchup[k].w; n += r.matchup[k].n; }
    assert.ok(w / n > 0.8, `${hi} contre ${lo} : ${(w / n * 100).toFixed(0)} % de victoires`);
  }
});
