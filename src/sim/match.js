import { Fighter } from './fighter.js';
import { CHARACTERS } from './characters.js';
import {
  STAGE_HALF, MAX_SEPARATION, METER_MAX, ROUND_TIME, ROUNDS_TO_WIN, HURT_HALF_WIDTH, FPS,
} from './constants.js';

const HURT_HEIGHT = 1.75;
const HISTORY = 40;

// Une partie complète : manches, chrono, résolution des coups, événements pour le rendu/audio/UI.
export class Match {
  constructor(p1Id, p2Id) {
    this.fighters = [new Fighter(CHARACTERS[p1Id], 0), new Fighter(CHARACTERS[p2Id], 1)];
    this.events = [];
    this.frame = 0;
    this.round = 0;
    this.history = [[], []];
    this.result = null;   // { winner: 0|1|-1 }
    this.startRound();
  }

  emit(e) { this.events.push(e); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  get fighting() { return this.phase === 'fight'; }

  startRound() {
    this.round++;
    const [a, b] = this.fighters;
    a.resetRound(-2.2); b.resetRound(2.2);
    this.timer = ROUND_TIME;
    this.timerFrames = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.hitstop = 0;
    this.roundWinner = null;
    this.emit({ type: 'roundIntro', round: this.round });
  }

  snapshot(i, delay) {
    const h = this.history[i];
    if (!h.length) return this.snap(this.fighters[i]);
    return h[Math.max(0, h.length - 1 - delay)];
  }

  snap(f) {
    return {
      x: f.x, y: f.y, state: f.state, phase: f.phase, move: f.move, serial: f.moveSerial,
      airborne: f.y > 0.02, blocking: f.blocking, guardFrames: f.guardFrames, mf: f.mf,
      facing: f.facing, vx: f.vx,
    };
  }

  // inputs : [inputP1, inputP2] au format { held:{}, pressed:{} }
  step(inputs) {
    this.frame++;
    this.phaseT++;
    const [a, b] = this.fighters;

    if (this.phase === 'intro') {
      if (this.phaseT === 70) this.emit({ type: 'fightStart' });
      if (this.phaseT >= 70) { this.phase = 'fight'; a.setState('idle'); b.setState('idle'); }
    }

    if (this.hitstop > 0) {
      this.hitstop--;
      // les entrées restent mémorisées pendant le gel d'impact
      a.readInput(inputs[0], this.frame); b.readInput(inputs[1], this.frame);
      this.recordHistory();
      return;
    }

    a.readInput(inputs[0], this.frame);
    b.readInput(inputs[1], this.frame);
    a.update(b, this);
    b.update(a, this);

    this.updateFacing(a, b); this.updateFacing(b, a);
    this.separate(a, b);
    this.bounds(a, b);

    if (this.phase === 'fight') {
      const ha = this.checkHits(a, b);
      const hb = this.checkHits(b, a);
      // les deux touchent : échange (trade)
      if (ha) this.applyHit(a, b, ha.hit, ha.move);
      if (hb) this.applyHit(b, a, hb.hit, hb.move);
    }

    if (this.phase === 'fight') {
      this.timerFrames++;
      if (this.timerFrames >= FPS) { this.timerFrames = 0; this.timer--; }
      const koA = a.hp <= 0, koB = b.hp <= 0;
      if (koA || koB) this.endRound(koA && koB ? -1 : koA ? 1 : 0, 'ko');
      else if (this.timer <= 0) {
        const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
        this.endRound(Math.abs(ra - rb) < 0.001 ? -1 : ra > rb ? 0 : 1, 'time');
      }
    } else if (this.phase === 'ko') {
      if (this.phaseT === 75 && this.roundWinner >= 0) {
        const w = this.fighters[this.roundWinner];
        if (w.state !== 'ko') { w.move = null; w.setState('win'); }
        this.emit({ type: 'roundWinner', winner: this.roundWinner });
      }
      if (this.phaseT >= 190) this.afterRound();
    }
    this.recordHistory();
  }

  recordHistory() {
    for (let i = 0; i < 2; i++) {
      const h = this.history[i];
      h.push(this.snap(this.fighters[i]));
      if (h.length > HISTORY) h.shift();
    }
  }

  endRound(winner, reason) {
    this.phase = 'ko';
    this.phaseT = 0;
    this.roundWinner = winner;
    if (winner === -1) { this.fighters[0].roundsWon++; this.fighters[1].roundsWon++; }
    else this.fighters[winner].roundsWon++;
    for (const f of this.fighters) if (f.hp <= 0 && f.state !== 'ko') this.koFighter(f);
    this.emit({ type: 'roundEnd', winner, reason });
  }

  koFighter(f, dir = -f.facing) {
    f.move = null;
    f.throwData = null;
    f.setState('ko');
    f.vy = 0.16;
    f.y = Math.max(f.y, 0.001);
    f.vx = dir * 0.06;
  }

  afterRound() {
    const [a, b] = this.fighters;
    const aw = a.roundsWon >= ROUNDS_TO_WIN, bw = b.roundsWon >= ROUNDS_TO_WIN;
    if (aw || bw) {
      this.phase = 'over';
      this.result = { winner: aw && bw ? -1 : aw ? 0 : 1 };
      this.emit({ type: 'matchEnd', winner: this.result.winner });
      return;
    }
    this.startRound();
  }

  updateFacing(f, o) {
    const canTurn = ['idle', 'walk', 'guard', 'land', 'jumpsquat', 'getup', 'blockstun', 'hitstun', 'intro', 'down'].includes(f.state) && f.grounded;
    if (!canTurn) return;
    const d = o.x - f.x;
    if (Math.abs(d) > 0.05) f.facing = Math.sign(d);
  }

  separate(a, b) {
    if (a.state === 'thrown' || b.state === 'thrown') return;
    // pas de collision si l'un passe nettement au-dessus de l'autre
    if (Math.abs(a.y - b.y) > 1.45) return;
    const min = a.char.pushWidth + b.char.pushWidth;
    const d = b.x - a.x;
    const ad = Math.abs(d);
    if (ad >= min) return;
    const overlap = (min - ad) / 2;
    const s = ad < 0.001 ? (a.facing > 0 ? 1 : -1) : Math.sign(d);
    a.x -= s * overlap; b.x += s * overlap;
  }

  bounds(a, b) {
    for (const f of [a, b]) f.x = Math.max(-STAGE_HALF, Math.min(STAGE_HALF, f.x));
    // distance max (les deux restent cadrés)
    const d = b.x - a.x;
    if (Math.abs(d) > MAX_SEPARATION) {
      const excess = (Math.abs(d) - MAX_SEPARATION) / 2 * Math.sign(d);
      a.x += excess; b.x -= excess;
    }
    // si coincé contre un mur après séparation, repousser l'autre
    const min = a.char.pushWidth + b.char.pushWidth;
    for (const [f, o] of [[a, b], [b, a]]) {
      if (Math.abs(f.x) >= STAGE_HALF && Math.abs(o.y - f.y) < 1.45) {
        const inward = -Math.sign(f.x);
        if (Math.sign(o.x - f.x) === inward && Math.abs(o.x - f.x) < min) o.x = f.x + inward * min;
      }
    }
  }

  // Cherche un coup actif de `att` qui touche `def`
  checkHits(att, def) {
    if (!(att.state === 'attack' || att.state === 'airattack') || !att.move) return null;
    if (def.invulnerable) return null;
    const m = att.move;
    for (let i = 0; i < m.hits.length; i++) {
      const h = m.hits[i];
      if (att.mf < h.start || att.mf > h.end || att.moveHits.has(i)) continue;
      const r0 = att.x + att.facing * h.reach[0];
      const r1 = att.x + att.facing * h.reach[1];
      const lo = Math.min(r0, r1), hi = Math.max(r0, r1);
      if (hi < def.x - HURT_HALF_WIDTH || lo > def.x + HURT_HALF_WIDTH) continue;
      const y0 = att.y + h.height[0], y1 = att.y + h.height[1];
      if (y1 < def.y || y0 > def.y + HURT_HEIGHT) continue;
      if (h.kind === 'throw') {
        if (!def.grounded || ['hitstun', 'blockstun', 'jumpsquat'].includes(def.state)) continue;
        if (def.state === 'attack' && def.move && def.move.isThrow && def.mf <= def.move.activeEnd) continue; // throws simultanés
      }
      att.moveHits.add(i);
      return { hit: h, move: m, index: i };
    }
    return null;
  }

  applyHit(att, def, h, move) {
    att.moveConnected = true;
    if (h.kind === 'throw') return this.startThrow(att, def, move);

    const facesAtt = Math.abs(att.x - def.x) < 0.12 || Math.sign(att.x - def.x) === def.facing;
    const blocked = def.blocking && facesAtt;
    const midY = Math.min(def.y + 1.3, att.y + (h.height[0] + h.height[1]) / 2);
    const hx = def.x - att.facing * 0.25;

    if (blocked) {
      const chip = def.char.shieldGuard ? 0 : Math.round(h.damage * h.chip);
      def.hp = Math.max(1, def.hp - chip); // le blocage ne peut pas achever
      def.stun = Math.max(4, h.blockstun - (def.char.shieldGuard ? 3 : 0));
      def.move = null;
      def.setState('blockstun');
      def.vx = att.facing * (h.push * 0.9);
      att.meter = Math.min(METER_MAX, att.meter + h.damage * 0.05);
      def.meter = Math.min(METER_MAX, def.meter + h.damage * 0.06);
      this.hitstop = 5;
      this.emit({ type: 'block', x: hx, y: midY, f: def.index, shield: !!def.char.shieldGuard, heavy: h.damage > 80 });
      this.wallPush(att, def, h.push * 0.9);
      return;
    }

    // Super-armure : dégâts encaissés, pas d'interruption
    if (def.armored) {
      const dmg = Math.round(h.damage * 0.5 * (def.char.defense || 1));
      def.hp = Math.max(0, def.hp - dmg);
      this.hitstop = 7;
      this.emit({ type: 'armor', x: hx, y: midY, f: def.index, dmg });
      if (def.hp <= 0) this.koFighter(def, att.facing);
      return;
    }

    def.combo = def.state === 'hitstun' || def.state === 'launched' ? def.combo + 1 : 1;
    const scale = Math.max(0.45, 1 - 0.12 * (def.combo - 1));
    const dmg = Math.max(1, Math.round(h.damage * scale * (def.char.defense || 1)));
    def.hp = Math.max(0, def.hp - dmg);
    att.meter = Math.min(METER_MAX, att.meter + (move.special ? 0 : dmg * 0.11));
    def.meter = Math.min(METER_MAX, def.meter + dmg * 0.08);
    def.move = null;
    def.throwData = null;

    this.hitstop = h.hitstop ?? Math.round(5 + dmg / 18);
    const heavy = dmg >= 80 || h.knockdown;
    this.emit({ type: 'hit', x: hx, y: midY, f: def.index, by: att.index, dmg, heavy, combo: def.combo, special: !!move.special, char: att.char.id });

    if (def.hp <= 0) { this.koFighter(def, att.facing); return; }

    if (h.knockdown || def.y > 0.05) {
      def.setState('launched');
      def.vy = h.launch;
      def.y = Math.max(def.y, 0.01);
      def.vx = att.facing * Math.max(0.05, h.push);
    } else {
      def.setState('hitstun');
      def.stun = h.hitstun;
      def.vx = att.facing * h.push;
      this.wallPush(att, def, h.push);
    }
  }

  // Défenseur coincé au mur : c'est l'attaquant qui recule
  wallPush(att, def, push) {
    if (Math.abs(def.x) > STAGE_HALF - 0.25 && Math.sign(def.x) === att.facing) {
      att.vx = -att.facing * push * 0.8;
    }
  }

  startThrow(att, def, move) {
    att.throwData = { anim: move.throwAnim, move };
    att.setState('throwing');
    att.vx = 0;
    def.move = null;
    def.setState('thrown');
    def.vx = 0; def.vy = 0;
    def.thrownBy = att.index;
    def.x = att.x + att.facing * 0.7;
    def.y = 0;
    this.hitstop = 4;
    this.emit({ type: 'grab', f: def.index, by: att.index, special: !!move.special, char: att.char.id, moveId: move.id });
  }

  resolveThrowSlam(att, def) {
    const anim = att.throwData.anim;
    def.combo = 1;
    const dmg = Math.round(anim.damage * (def.char.defense || 1));
    def.hp = Math.max(0, def.hp - dmg);
    att.meter = Math.min(METER_MAX, att.meter + (att.throwData.move.special ? 0 : dmg * 0.1));
    def.meter = Math.min(METER_MAX, def.meter + dmg * 0.08);
    def.x = att.x + att.facing * 1.0;
    def.y = 0;
    this.hitstop = anim.fx === 'bigSlam' ? 16 : 9;
    this.emit({ type: 'slam', x: def.x, y: 0.2, f: def.index, by: att.index, dmg, big: anim.fx === 'bigSlam', char: att.char.id });
    if (def.hp <= 0) { this.koFighter(def, att.facing); def.vy = 0.08; return; }
    def.setState('down');
    def.vx = att.facing * 0.04;
  }
}
