import { METER_MAX, HURT_HALF_WIDTH } from './constants.js';

// Portée réelle d'un coup : la portée du coup plus la demi-largeur de la cible, avec une petite marge.
const eff = (m) => m.maxReach + (m.advance || 0) + HURT_HALF_WIDTH - 0.08;

// Trois profils réellement distincts :
//  - facile    : perception lente, déplacements erratiques, attaque souvent hors de portée, garde rarement, aucun combo.
//  - normal    : gère la distance, garde une attaque sur deux, punit parfois, enchaîne de temps en temps.
//  - difficile : réagit vite, punit les coups ratés, contre les sauts, projette ceux qui gardent trop,
//                confirme ses combos jusqu'au pouvoir spécial, joue le « footsie » (entre/sort de portée).
export const DIFFICULTIES = {
  facile: {
    label: 'Facile', reaction: 26, think: [26, 52], guard: 0.12, punish: 0.08, antiAir: 0.04,
    throwGuard: 0.04, aggression: 0.32, special: 0.15, combo: 0.06, spacing: 0.25, jumpIn: 0.14,
    whiff: 0.4, footsies: false, smartSpecial: false, parry: 0, dash: 0.05,
  },
  normal: {
    label: 'Normal', reaction: 15, think: [14, 30], guard: 0.5, punish: 0.45, antiAir: 0.35,
    throwGuard: 0.35, aggression: 0.48, special: 0.55, combo: 0.5, spacing: 0.75, jumpIn: 0.08,
    whiff: 0.12, footsies: false, smartSpecial: false, parry: 0.08, dash: 0.25,
  },
  difficile: {
    label: 'Difficile', reaction: 8, think: [6, 14], guard: 0.82, punish: 0.9, antiAir: 0.75,
    throwGuard: 0.8, aggression: 0.55, special: 0.9, combo: 0.95, spacing: 1.0, jumpIn: 0.04,
    whiff: 0.02, footsies: true, smartSpecial: true, parry: 0.25, dash: 0.5,
  },
};

const emptyInput = () => ({
  held: { left: false, right: false, up: false, down: false, guard: false, light: false, heavy: false, special: false },
  pressed: { light: false, medium: false, heavy: false, special: false, up: false, dash: false },
});

export class AIController {
  constructor(difficulty = 'normal', seed = Date.now()) {
    this.p = DIFFICULTIES[difficulty];
    this.seed = seed >>> 0 || 1;
    this.intent = { type: 'hold', frames: 0 };
    this.thinkIn = 0;
    this.guardUntil = 0;
    this.decidedSerial = -1;
    this.comboSerial = -1;
    this.reflexSerial = -1;
    this.aaDecided = false;
    this.aaArmed = false;
    this.evade = null;
    this.interrupt = null;
  }

  rand() {
    // xorshift déterministe (reproductible pour les tests)
    let x = this.seed;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.seed = x >>> 0;
    return this.seed / 4294967296;
  }
  chance(p) { return this.rand() < p; }

  think(self, opp, match) {
    const out = emptyInput();
    if (!match.fighting) return out;
    const P = this.p;
    const fr = match.frame;
    const o = match.snapshot(opp.index, P.reaction); // perception retardée
    const dist = Math.abs(o.x - self.x);
    const toward = Math.sign(o.x - self.x) || self.facing;
    const c = self.char;
    const press = (k) => { out.pressed[k] = true; out.held[k] = true; };
    const walk = (dir) => { // dir : +1 vers l'adversaire, -1 en s'éloignant
      const world = dir * toward;
      if (world > 0) out.held.right = true; else out.held.left = true;
    };

    // 1) Combos : confirmer un coup qui a touché
    if (self.state === 'attack' && self.moveConnected && self.move && this.comboSerial !== self.moveSerial) {
      this.comboSerial = self.moveSerial;
      const m = self.move;
      if (m.cancels.length && this.chance(P.combo)) {
        // enchaînement : léger -> moyen -> lourd, conclu par le pouvoir spécial si la jauge est pleine
        const next = m.cancels.find((k) => k !== 'special' && !(k === 'heavy' && c.moves.heavy.isThrow));
        if (m.cancels.includes('special') && self.meter >= METER_MAX && (!next || P.smartSpecial) && (P.smartSpecial || this.chance(0.5))) press('special');
        else if (next) press(next);
      }
      return out;
    }

    if (!self.free) {
      if (self.state === 'blockstun') { out.held.guard = true; out.held.noParry = true; }
      if (self.state === 'air' && !self.airAttackUsed && dist < 1.5 && self.vy < 0.04 && this.chance(0.15 + P.combo * 0.3)) press('light');
      return out;
    }

    const oAttacking = (o.state === 'attack' || o.state === 'airattack') && o.move;
    const oThreat = oAttacking && o.phase !== 'recovery';
    const oReach = oAttacking ? o.move.maxReach + 0.45 : 0;

    // 2) Défense réflexe (une décision par attaque adverse perçue)
    if (oThreat && (dist < oReach || o.move.special)) {
      if (this.decidedSerial !== o.serial) {
        this.decidedSerial = o.serial;
        if (o.move.isThrow && o.move.special) {
          // projection spéciale (Bàkk) : imblocable. Reculer pendant la danse, puis sauter au moment de la charge.
          if (this.chance(P.guard)) this.evade = { serial: o.serial, jumped: false };
        } else if (o.move.isThrow) {
          // contre une projection : sauter ou frapper (garder ne sert à rien)
          // Une saisie normale sort trop vite pour être contrée par réflexe : l'IA experte recule
          // d'un pas pour la faire échouer puis la punir ; les autres tentent un saut ou un coup.
          if (P.footsies) { if (this.chance(P.guard)) this.intent = { type: 'backdash', frames: 2 }; }
          else if (this.chance(P.guard * 0.7)) this.intent = { type: this.chance(0.5) ? 'jumpAway' : 'jab', frames: 4 };
        } else if (o.move.airborneMove && dist < 1.9 && this.chance(P.punish)) {
          // spécial aérien lent (Adumu) : il est vulnérable après son premier bond, on l'interrompt
          this.interrupt = { serial: o.serial };
        } else if (this.chance(P.guard)) {
          this.guardUntil = fr + 22 + (o.move.special ? 70 : 0);
          // tentative de contre : lever la garde au dernier moment plutôt que tout de suite
          this.parryTry = !o.move.special && this.chance(P.parry);
          this.guardFrom = this.parryTry ? fr + Math.max(0, o.move.startup - o.mf - P.reaction - 4) : 0;
        }
      }
    }
    if (this.evade) {
      if (!oAttacking || o.serial !== this.evade.serial || o.phase === 'recovery') this.evade = null;
      else if (o.mf < 30) { walk(-1); return out; }
      else if (!this.evade.jumped) { this.evade.jumped = true; walk(-1); press('up'); return out; }
      else { walk(-1); return out; }
    }
    if (this.interrupt) {
      const inv = oAttacking && o.move.invuln ? o.move.invuln[1] : 0;
      if (!oAttacking || o.serial !== this.interrupt.serial || o.mf > 60) { this.interrupt = null; this.guardUntil = fr + 40; }
      else if (o.mf > inv - P.reaction && dist < c.moves.light.maxReach + 0.1) { press('light'); return out; }
      else if (dist > c.moves.light.maxReach - 0.1) { walk(1); return out; }
      else return out;
    }
    if (fr < this.guardUntil) { if (fr >= (this.guardFrom || 0)) { out.held.guard = true; out.held.noParry = !this.parryTry; } return out; }

    // 3 bis) Adversaire étourdi (garde brisée) ou déséquilibré (contré) : punition maximale
    if ((o.state === 'dizzy' || o.state === 'parried') && this.chance(P.punish)) {
      const eL = eff(c.moves.light);
      if (dist < eL) { press('light'); return out; }
      walk(1); if (dist > eL + 0.8) press('dash');
      return out;
    }

    // 3) Punition des coups ratés / récupération adverse
    if (oAttacking && o.phase === 'recovery' && this.reflexSerial !== o.serial) {
      this.reflexSerial = o.serial;
      if (this.chance(P.punish)) {
        const mv = this.bestMoveFor(self, dist);
        if (mv) {
          if (mv === 'special') press('special');
          else press(mv);
          return out;
        }
      }
    }

    // 4) Anti-aérien : une seule décision par saut adverse, puis frappe au bon moment
    //    (quand l'adversaire redescend à portée), au lieu de frapper dès le décollage.
    const oJumping = o.state === 'air' || o.state === 'airattack';
    if (!oJumping) { this.aaDecided = false; this.aaArmed = false; }
    else {
      if (!this.aaDecided && dist < 2.6) {
        this.aaDecided = true;
        this.aaArmed = this.chance(P.antiAir);
      }
      if (this.aaArmed) {
        const useHeavy = !c.moves.heavy.isThrow && dist < c.moves.heavy.maxReach;
        const mv = useHeavy ? c.moves.heavy : c.moves.light;
        const top = mv.hits[0].height[1];
        if (dist < mv.maxReach + 0.15 && o.y < top + 0.35) {
          this.aaArmed = false;
          press(useHeavy ? 'heavy' : 'light');
          return out;
        }
      }
    }

    // 5) Projeter un adversaire qui garde trop longtemps
    if (o.blocking && o.guardFrames > 12 && dist < c.throwRange + 0.9 && this.intent.type !== 'throwRun') {
      if (this.chance(P.throwGuard / 8)) this.intent = { type: 'throwRun', frames: 40 };
    }

    // 6) Intention neutre (réévaluée à intervalle selon la difficulté)
    this.thinkIn--;
    if (this.thinkIn <= 0 || this.intent.frames <= 0) {
      this.thinkIn = P.think[0] + Math.floor(this.rand() * (P.think[1] - P.think[0]));
      this.chooseIntent(self, o, dist);
    }
    this.intent.frames--;

    switch (this.intent.type) {
      case 'approach': walk(1); break;
      case 'retreat': walk(-1); break;
      case 'random': walk(this.intent.dir); break;
      case 'guard': out.held.guard = true; out.held.noParry = true; break;
      case 'jumpIn': walk(1); press('up'); this.intent = { type: 'airAttack', frames: 40 }; break;
      case 'jumpAway': walk(-1); press('up'); this.intent.frames = 0; break;
      case 'jab': press('light'); this.intent.frames = 0; break;
      case 'backdash': walk(-1); press('dash'); this.intent.frames = 0; break;
      case 'dashIn': walk(1); press('dash'); this.intent = { type: 'approach', frames: 6 }; break;
      case 'airAttack': break;
      case 'footsie': walk(Math.sin(fr / 9) > 0 ? 1 : -1); break;
      case 'throwRun':
        if (dist > c.throwRange - 0.15) walk(1);
        else { walk(1); press('heavy'); this.intent.frames = 0; }
        break;
      case 'attack': {
        const mv = this.intent.move;
        if (mv === 'throw') { walk(1); press('heavy'); }
        else press(mv);
        this.intent.frames = 0;
        break;
      }
      case 'special': press('special'); this.intent.frames = 0; break;
      default: break;
    }
    return out;
  }

  // Meilleur coup pour punir à cette distance
  bestMoveFor(self, dist) {
    const c = self.char;
    if (self.meter >= METER_MAX && this.p.smartSpecial && this.specialInRange(self, dist)) return 'special';
    if (dist < eff(c.moves.light)) return 'light';                      // le léger ouvre l'enchaînement
    if (dist < eff(c.moves.medium)) return 'medium';
    if (!c.moves.heavy.isThrow && dist < eff(c.moves.heavy)) return 'heavy';
    return null;
  }

  specialInRange(self, dist) {
    switch (self.char.id) {
      case 'modou': return dist < 3.6;
      case 'themba': return dist < 4.6;
      default: return this.p.spacing >= 0.7 ? dist > 2.0 : true; // l'adumu suit l'adversaire, mais il est interruptible de près
    }
  }

  chooseIntent(self, o, dist) {
    const P = this.p;
    const c = self.char;
    // Les IA qui gèrent la distance se placent au bord de leur propre portée réelle,
    // et restent hors de portée de saisie d'un lutteur.
    let ideal = c.idealRange;
    if (P.footsies) {
      ideal = eff(c.moves.heavy) - 0.12;
      const oc = o.char;
      if (oc && oc.moves.heavy.isThrow && !c.moves.heavy.isThrow) ideal = Math.min(Math.max(ideal, eff(oc.moves.heavy) + 0.1), eff(c.moves.heavy) - 0.05);
    }

    // Facile : comportement erratique
    if (this.chance(1 - P.spacing)) {
      const r = this.rand();
      if (r < 0.35) this.intent = { type: 'random', dir: this.chance(0.6) ? 1 : -1, frames: 20 };
      else if (r < 0.55 && this.chance(P.whiff * 2)) this.intent = { type: 'attack', move: this.chance(0.5) ? 'light' : 'heavy', frames: 1 };
      else if (r < 0.65) this.intent = { type: 'jumpIn', frames: 1 };
      else this.intent = { type: 'hold', frames: 18 };
      return;
    }

    // Pouvoir spécial disponible
    if (self.meter >= METER_MAX && this.specialInRange(self, dist)) {
      const wantNow = P.smartSpecial ? (o.phase === 'recovery' || o.state === 'land' || o.state === 'jumpsquat' || this.chance(0.12)) : this.chance(P.special * 0.4);
      if (wantNow) { this.intent = { type: 'special', frames: 1 }; return; }
    }

    if (dist > ideal + 0.35) {
      if (this.chance(P.jumpIn) && dist < 3.2) this.intent = { type: 'jumpIn', frames: 1 };
      else if (dist > ideal + 1.3 && this.chance(P.dash * 0.5)) this.intent = { type: 'dashIn', frames: 2 };
      else this.intent = { type: 'approach', frames: Math.round(10 + this.rand() * 20) };
      return;
    }
    if (dist < ideal - 0.45 && !c.moves.heavy.isThrow) {
      if (this.chance(P.aggression * 0.6)) this.intent = { type: 'attack', move: 'light', frames: 1 };
      else this.intent = { type: 'retreat', frames: Math.round(8 + this.rand() * 14) };
      return;
    }
    // À bonne distance
    if (this.chance(P.aggression)) {
      let mv;
      if (c.moves.heavy.isThrow) mv = dist < eff(c.moves.heavy) - 0.1 && (dist > eff(c.moves.light) || this.chance(0.45)) ? (this.chance(0.3) ? 'medium' : 'throw') : (this.chance(0.6) ? 'light' : 'medium');
      else mv = dist > eff(c.moves.medium) ? 'heavy' : dist > eff(c.moves.light) ? (this.chance(0.7) ? 'medium' : 'heavy') : (this.chance(0.6) ? 'light' : 'medium');
      this.intent = { type: 'attack', move: mv, frames: 1 };
      return;
    }
    if (P.footsies && this.chance(0.6)) { this.intent = { type: 'footsie', frames: 24 }; return; }
    if (this.chance(0.3)) { this.intent = { type: 'guard', frames: 14 }; return; }
    this.intent = { type: 'hold', frames: 12 };
  }
}
