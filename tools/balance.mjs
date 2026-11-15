// Rapport d'équilibrage : matchs IA contre IA, côtés alternés, graines fixes (reproductible).
// Usage : node tools/balance.mjs [matchs par confrontation et par côté, défaut 60] [--json]
import { ROSTER, CHARACTERS } from '../src/sim/characters.js';
import { AIController } from '../src/sim/ai.js';
import { playMatch } from '../tests/helpers/sim.mjs';

const N = parseInt(process.argv[2], 10) || 60;
const asJson = process.argv.includes('--json');
const ai = (d, seed) => { const c = new AIController(d, seed); return (s, o, m) => c.think(s, o, m); };

export function analyse(diffA, diffB = diffA, n = N) {
  const wins = {}, games = {}, matchup = {};
  const spec = {}, combo = {}, air = {};
  for (const id of ROSTER) {
    wins[id] = 0; games[id] = 0;
    spec[id] = { uses: 0, hit: 0, blocked: 0, whiff: 0, dmg: 0, punished: 0 };
    combo[id] = { max: 0, maxPct: 0 };
    air[id] = { jumps: 0, jumpHits: 0, antiAirHits: 0, oppJumps: 0 };
  }
  let frames = 0, total = 0, timeouts = 0;
  for (const a of ROSTER) for (const b of ROSTER) {
    if (a === b) continue;
    const key = `${a}>${b}`; matchup[key] = { w: 0, n: 0 };
    for (let i = 0; i < n; i++) {
      const ids = [a, b];
      const cur = [null, null];          // spécial en cours par combattant
      const seq = [0, 0];                // dégâts du combo en cours subi par chaque combattant
      const onEvent = (e, m) => {
        if (e.type === 'special') { spec[ids[e.f]].uses++; cur[e.f] = { dmg: 0, blocked: false, end: -1 }; }
        if (e.type === 'jump') { air[ids[e.f]].jumps++; air[ids[1 - e.f]].oppJumps++; }
        if (e.type === 'roundEnd' && e.reason === 'time') timeouts++;
        if (e.type === 'hit' || e.type === 'slam') {
          const by = e.by, d = e.f;
          if (cur[by] && cur[by].end < 0) cur[by].dmg += e.dmg;
          if (cur[d] && cur[d].end >= 0 && m.frame - cur[d].end < 45 && cur[d].dmg === 0) { spec[ids[d]].punished++; cur[d] = null; }
          seq[d] = e.type === 'hit' && e.combo > 1 ? seq[d] + e.dmg : e.dmg;
          const c = combo[ids[by]];
          if (seq[d] > c.max) { c.max = seq[d]; c.maxPct = Math.round(seq[d] / CHARACTERS[ids[d]].hp * 100); }
          if (e.type === 'hit') {
            if (e.air && !e.attAir) air[ids[by]].antiAirHits++;
            if (e.attAir && e.moveId === 'air') air[ids[by]].jumpHits++;
          }
        }
        if (e.type === 'block' || e.type === 'armor') { const by = 1 - e.f; if (cur[by] && cur[by].end < 0) cur[by].blocked = true; }
      };
      const onFrame = (m) => {
        m.fighters.forEach((f, k) => {
          const c = cur[k];
          if (!c || c.end >= 0) return;
          const active = (f.state === 'attack' && f.move && f.move.special) || (f.state === 'throwing' && f.throwData && f.throwData.move.special);
          if (active) return;
          c.end = m.frame;
          const s = spec[ids[k]];
          s.dmg += c.dmg;
          if (c.dmg > 0) { s.hit++; cur[k] = null; } else if (c.blocked) s.blocked++; else s.whiff++;
        });
        for (let k = 0; k < 2; k++) if (cur[k] && cur[k].end >= 0 && m.frame - cur[k].end > 45) cur[k] = null;
      };
      const r = playMatch(a, b, ai(diffA, 1000 + i * 7919 + total), ai(diffB, 5000 + i * 104729 + total), { check: false, onEvent, onFrame });
      total++; frames += r.frames;
      games[a]++; games[b]++; matchup[key].n++;
      if (r.winner === 0) { wins[a]++; matchup[key].w++; } else if (r.winner === 1) wins[b]++;
    }
  }
  return { wins, games, matchup, spec, combo, air, avgSec: frames / total / 60, timeouts, total };
}

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = {};
  for (const d of ['facile', 'normal', 'difficile']) {
    const r = analyse(d);
    out[d] = r;
    if (asJson) continue;
    console.log(`\n══ IA ${d} contre IA ${d} — ${r.total} matchs, durée moyenne ${r.avgSec.toFixed(0)} s, manches au chrono : ${r.timeouts}`);
    console.log('Taux de victoire global :', ROSTER.map((id) => `${id} ${pct(r.wins[id], r.games[id])}%`).join(' · '));
    // confrontations : cumule les deux côtés
    for (let i = 0; i < ROSTER.length; i++) for (let j = i + 1; j < ROSTER.length; j++) {
      const a = ROSTER[i], b = ROSTER[j];
      const ab = r.matchup[`${a}>${b}`], ba = r.matchup[`${b}>${a}`];
      const wa = ab.w + (ba.n - ba.w), n = ab.n + ba.n;
      console.log(`  ${a} contre ${b} : ${pct(wa, n)}% – ${100 - pct(wa, n)}%   (avantage côté gauche J1 : ${pct(ab.w + ba.w, n)}%)`);
    }
    console.log('Pouvoirs spéciaux :');
    for (const id of ROSTER) {
      const s = r.spec[id];
      console.log(`  ${id.padEnd(9)} utilisés ${String(s.uses).padStart(4)} · touche ${pct(s.hit, s.uses)}% · bloqué ${pct(s.blocked, s.uses)}% · dans le vide ${pct(s.whiff, s.uses)}% · puni ensuite ${pct(s.punished, s.uses)}% · dégâts moyens/usage ${(s.dmg / Math.max(1, s.uses)).toFixed(0)}`);
    }
    console.log('Combo maximal observé :', ROSTER.map((id) => `${id} ${r.combo[id].max} (${r.combo[id].maxPct}% des PV)`).join(' · '));
    console.log('Jeu aérien :', ROSTER.map((id) => `${id} sauts ${r.air[id].jumps}, attaques sautées réussies ${pct(r.air[id].jumpHits, r.air[id].jumps)}%, anti-aériens réussis ${pct(r.air[id].antiAirHits, r.air[id].oppJumps)}%`).join(' · '));
  }
  if (asJson) console.log(JSON.stringify(out));
}
