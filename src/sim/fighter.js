import {
  GRAVITY, FRICTION, METER_MAX, INPUT_BUFFER, LAND_FRAMES, DOWN_FRAMES, GETUP_FRAMES, JUMPSQUAT,
  GUARD_MAX, GUARD_REGEN_DELAY, GUARD_REGEN, PARRY_WINDOW, PARRY_LOCKOUT, DIZZY_FRAMES,
} from './constants.js';

const FREE_STATES = new Set(['idle', 'walk', 'guard']);

export class Fighter {
  constructor(char, index) {
    this.char = char;
    this.index = index;
    this.meter = 0;
    this.roundsWon = 0;
    this.moveSerial = 0;
    this.resetRound(index === 0 ? -2.2 : 2.2);
  }

  resetRound(x) {
    this.x = x; this.y = 0; this.vx = 0; this.vy = 0;
    this.facing = x < 0 ? 1 : -1;
    this.hp = this.char.hp;
    this.state = 'intro'; this.t = 0;
    this.move = null; this.mf = 0;
    this.moveHits = new Set();
    this.moveConnected = false;
    this.stun = 0;
    this.airAttackUsed = false;
    this.combo = 0;
    this.walkDir = 0;
    this.buffer = { light: -99, medium: -99, heavy: -99, special: -99, up: -99, dash: -99 };
    this.guardHp = GUARD_MAX; this.guardIdle = 0;
    this.parryUntil = -99; this.lastGuardPress = -99;
    this.dashDir = 0; this.lastHitFrame = -999;
    this.fwdHeld = false; this.backHeld = false; this.guardHeld = false;
    this.throwData = null;
    this.lastCue = null;
    this.guardFrames = 0;
    this.juggleLocked = false;
  }

  get grounded() { return this.y <= 0.0001; }
  get free() { return FREE_STATES.has(this.state) || (this.state === 'land' && this.t >= LAND_FRAMES); }
  get maxHp() { return this.char.hp; }

  get phase() {
    if (!this.move || (this.state !== 'attack' && this.state !== 'airattack')) return null;
    if (this.mf < this.move.startup) return 'startup';
    if (this.mf <= this.move.activeEnd) return 'active';
    return 'recovery';
  }

  get invulnerable() {
    if (['down', 'getup', 'thrown', 'throwing', 'ko', 'intro', 'win'].includes(this.state)) return true;
    if (this.state === 'launched' && this.juggleLocked) return true;
    // esquive arrière : invulnérable pendant le cœur du mouvement
    if (this.state === 'dash' && this.dashDir < 0 && this.t >= 2 && this.t <= this.char.dash.backInvuln) return true;
    const m = this.move;
    if (this.state === 'attack' && m && m.invuln && this.mf >= m.invuln[0] && this.mf <= m.invuln[1]) return true;
    return false;
  }

  get armored() {
    const m = this.move;
    return this.state === 'attack' && m && m.armor && this.mf >= m.armor[0] && this.mf <= m.armor[1];
  }

  get blocking() {
    if (!this.grounded) return false;
    if (this.state === 'guard' || this.state === 'blockstun') return true;
    // garder en reculant (style arcade)
    if (this.state === 'walk' && this.walkDir < 0) return true;
    if (this.state === 'idle' && this.backHeld) return true;
    return false;
  }

  setState(s) { this.state = s; this.t = 0; }

  readInput(inp, frame) {
    for (const k of ['light', 'medium', 'heavy', 'special', 'up', 'dash']) if (inp.pressed[k]) this.buffer[k] = frame;
    this.fwdHeld = this.facing > 0 ? !!inp.held.right : !!inp.held.left;
    this.backHeld = this.facing > 0 ? !!inp.held.left : !!inp.held.right;
    this.guardHeld = !!inp.held.guard;
    this.noParry = !!inp.held.noParry;   // l'IA lève parfois la garde sans tenter de contre
    this.upHeld = !!inp.held.up;
  }

  buffered(k, frame) { return frame - this.buffer[k] <= INPUT_BUFFER; }
  consume(k) { this.buffer[k] = -99; }

  startMove(move, match) {
    this.move = move;
    this.mf = 0;
    this.moveHits = new Set();
    this.moveConnected = false;
    this.moveSerial++;
    this.lastCue = null;
    if (move.special) {
      this.meter = 0;
      match.emit({ type: 'special', f: this.index, name: move.name, char: this.char.id });
    }
    match.emit({ type: 'whoosh', f: this.index, heavy: move.id === 'heavy' || move.special, moveId: move.id });
    this.setState(move.id === 'air' ? 'airattack' : 'attack');
  }

  tryGroundAction(opp, match, attacksOnly = false) {
    const fr = match.frame;
    const c = this.char;
    const dist = Math.abs(opp.x - this.x);
    if (this.buffered('special', fr) && this.meter >= METER_MAX) {
      this.consume('special'); this.startMove(c.moves.special, match); return true;
    }
    if (this.buffered('heavy', fr)) {
      this.consume('heavy');
      const useThrow = this.fwdHeld && dist < c.throwRange + 0.15;
      this.startMove(useThrow ? c.moves.throw : c.moves.heavy, match); return true;
    }
    if (this.buffered('medium', fr)) { this.consume('medium'); this.startMove(c.moves.medium, match); return true; }
    if (this.buffered('light', fr)) { this.consume('light'); this.startMove(c.moves.light, match); return true; }
    if (attacksOnly) return false;
    if (this.buffered('dash', fr)) {
      this.consume('dash');
      this.dashDir = this.backHeld ? -1 : 1;
      this.setState('dash');
      match.emit({ type: 'dash', f: this.index, dir: this.dashDir, x: this.x });
      return true;
    }
    if (this.buffered('up', fr) || this.upHeld) { this.consume('up'); this.setState('jumpsquat'); return true; }
    return false;
  }

  update(opp, match) {
    this.t++;
    const c = this.char;
    const fr = match.frame;
    // la jauge de garde remonte quand on ne bloque plus
    if (this.state === 'guard' || this.state === 'blockstun') this.guardIdle = 0;
    else if (++this.guardIdle > GUARD_REGEN_DELAY && this.guardHp < GUARD_MAX) this.guardHp = Math.min(GUARD_MAX, this.guardHp + GUARD_REGEN);

    switch (this.state) {
      case 'intro': case 'win': case 'ko': case 'lose':
        this.vx *= FRICTION;
        break;

      case 'idle': case 'walk': case 'guard': case 'land': {
        if (this.state === 'land' && this.t < LAND_FRAMES) { this.vx *= FRICTION; break; }
        if (!match.fighting) { this.setStateIf('idle'); this.vx *= FRICTION; break; }
        if (this.tryGroundAction(opp, match)) break;
        if (this.guardHeld) {
          if (this.state !== 'guard') {
            // lever la garde ouvre une courte fenêtre de contre (pas en martelant la touche)
            if (fr - this.lastGuardPress > PARRY_LOCKOUT && !this.noParry) this.parryUntil = fr + PARRY_WINDOW;
            this.lastGuardPress = fr;
          }
          this.setStateIf('guard'); this.guardFrames++;
          this.walkDir = 0; this.vx *= FRICTION; break;
        }
        this.guardFrames = 0;
        if (this.fwdHeld || this.backHeld) {
          this.walkDir = this.fwdHeld ? 1 : -1;
          this.setStateIf('walk');
          const sp = this.walkDir > 0 ? c.walk : c.backWalk;
          this.x += this.facing * this.walkDir * sp;
        } else {
          this.walkDir = 0;
          this.setStateIf('idle');
        }
        this.vx *= FRICTION;
        break;
      }

      case 'jumpsquat':
        if (this.t >= JUMPSQUAT) {
          const dir = this.fwdHeld ? 1 : this.backHeld ? -1 : 0;
          this.vy = c.jumpV;
          this.vx = this.facing * dir * c.jumpVX;
          this.y = 0.001;
          this.airAttackUsed = false;
          this.setState('air');
          match.emit({ type: 'jump', f: this.index });
        }
        break;

      case 'air':
        if (!this.airAttackUsed && (this.buffered('light', fr) || this.buffered('heavy', fr))) {
          this.consume('light'); this.consume('heavy');
          this.airAttackUsed = true;
          this.startMove(c.moves.air, match);
        }
        break;

      case 'attack': {
        this.mf++;
        const m = this.move;
        if (m.motion) m.motion(this, this.mf, opp);
        else this.vx *= FRICTION;
        if (m.cues && m.cues[this.mf]) match.emit({ type: 'cue', cue: m.cues[this.mf], f: this.index, char: c.id });
        // annulations (cancel) si le coup a touché
        if (this.moveConnected && this.mf >= m.startup) {
          for (const k of m.cancels) {
            if (!this.buffered(k, fr)) continue;
            if (k === 'special' && this.meter < METER_MAX) continue;
            this.consume(k);
            this.startMove(c.moves[k], match);
            return this.physics(match);
          }
        }
        if (this.mf >= m.total) { this.move = null; this.y = 0; this.setState('idle'); }
        break;
      }

      case 'airattack':
        this.mf++;
        break;

      case 'dash': {
        const d = c.dash;
        const fwd = this.dashDir > 0;
        const len = fwd ? d.frames : d.backFrames;
        const move = this.t <= len - 4;
        if (move) this.x += this.facing * this.dashDir * (fwd ? d.speed : d.backSpeed);
        // la ruée avant peut être enchaînée sur une attaque
        if (fwd && this.t >= 6 && match.fighting && this.tryGroundAction(opp, match, true)) break;
        if (this.t >= len) this.setState('idle');
        break;
      }

      case 'parried':
        this.stun--; this.vx *= 0.88;
        if (this.stun <= 0) { this.combo = 0; this.setState('idle'); }
        break;

      case 'dizzy':
        this.vx *= 0.85;
        if (this.t >= DIZZY_FRAMES) { this.combo = 0; this.guardHp = GUARD_MAX; this.setState('idle'); }
        break;

      case 'hitstun':
        this.stun--; this.vx *= 0.9;
        if (this.stun <= 0) { this.combo = 0; this.setState('idle'); }
        break;

      case 'blockstun':
        this.stun--; this.vx *= 0.9;
        if (this.stun <= 0) this.setState(this.guardHeld ? 'guard' : 'idle');
        break;

      case 'launched':
        break;

      case 'down':
        this.vx *= 0.85;
        if (this.t >= DOWN_FRAMES) this.setState('getup');
        break;

      case 'getup':
        if (this.t >= GETUP_FRAMES) { this.combo = 0; this.setState('idle'); }
        break;

      case 'throwing': {
        const td = this.throwData;
        if (this.t === td.anim.slamAt) match.resolveThrowSlam(this, opp);
        if (this.t >= td.anim.length) { this.throwData = null; this.move = null; this.setState('idle'); }
        break;
      }

      case 'thrown':
        break;
    }
    this.physics(match);
  }

  setStateIf(s) { if (this.state !== s) this.setState(s); }

  physics(match) {
    const scripted = this.state === 'attack' && this.move && this.move.airborneMove;
    if (scripted) { this.x += this.vx; return; }
    if (this.state === 'thrown' || this.state === 'throwing') return;

    const airborne = this.y > 0 || this.vy > 0;
    if (airborne && (this.state === 'air' || this.state === 'airattack' || this.state === 'launched' || this.state === 'hitstun' || this.state === 'ko')) {
      this.x += this.vx;
      this.y += this.vy;
      this.vy -= GRAVITY;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0;
        this.onLand(match);
      }
    } else {
      this.y = 0;
      this.x += this.vx;
      if (this.state !== 'attack') this.vx *= FRICTION;
    }
  }

  onLand(match) {
    match.emit({ type: 'land', f: this.index, x: this.x, hard: this.state === 'launched' || this.state === 'ko' });
    if (this.state === 'launched') { this.vx *= 0.4; this.juggleLocked = false; this.setState('down'); return; }
    if (this.state === 'ko') { this.vx *= 0.3; return; }
    if (this.state === 'hitstun') { return; }
    this.move = null;
    this.setState('land');
    this.t = this.state === 'land' ? 0 : this.t;
  }
}
