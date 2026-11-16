// Banc d'essai d'équilibrage : applique des variantes en mémoire et compare les taux de victoire.
import { ROSTER, CHARACTERS } from '../src/sim/characters.js';
import { analyse } from './balance.mjs';
const n = parseInt(process.argv[2], 10) || 30;
const pct = (a, b) => Math.round((a / b) * 100);
export function report(label) {
  const line = [label.padEnd(14)];
  for (const d of ['normal', 'difficile']) {
    const r = analyse(d, d, n);
    const mu = [];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const a = ROSTER[i], b = ROSTER[j];
      const ab = r.matchup[`${a}>${b}`], ba = r.matchup[`${b}>${a}`];
      mu.push(`${a[0]}/${b[0]} ${pct(ab.w + ba.n - ba.w, ab.n + ba.n)}`);
    }
    line.push(`${d}: ` + ROSTER.map((id) => `${id[0]} ${pct(r.wins[id], r.games[id])}%`).join(' ') + ` [${mu.join(', ')}]` + ` spéc ${ROSTER.map((id) => (r.spec[id].dmg / Math.max(1, r.spec[id].uses)).toFixed(0)).join('/')} combo ${ROSTER.map((id) => r.combo[id].maxPct).join('/')}%`);
  }
  console.log(line.join(' | '));
}
if (import.meta.url === `file://${process.argv[1]}`) report('actuel');
