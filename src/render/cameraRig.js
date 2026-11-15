import * as THREE from 'three';

// Caméra de jeu de combat : suit le point médian, zoome selon l'écart, tremble aux impacts,
// plans rapprochés pendant les pouvoirs spéciaux et le K.O.
export class CameraRig {
  constructor(camera) {
    this.cam = camera;
    this.pos = new THREE.Vector3(0, 1.7, 7);
    this.look = new THREE.Vector3(0, 1.1, 0);
    this.shakeAmt = 0;
    this.focus = null;     // { x, y, until, zoom }
    this.mode = 'fight';
    this.orbitT = 0;
  }

  shake(a) { this.shakeAmt = Math.min(0.35, this.shakeAmt + a); }

  focusOn(x, y, duration, zoom = 0.55) { this.focus = { x, y, t: duration, zoom }; }

  update(dt, a, b) {
    let tx, ty, tz, lx, ly;
    if (this.mode === 'select') {
      this.orbitT += dt * 0.25;
      tx = Math.sin(this.orbitT) * 0.6; ty = 1.5; tz = 4.3;
      lx = 0; ly = 1.05;
    } else {
      const mid = (a.x + b.x) / 2;
      const sep = Math.abs(a.x - b.x);
      const hy = (f) => (f.state === 'thrown' ? 1.0 : f.y || 0);
      const highest = Math.max(hy(a), hy(b));
      tz = Math.min(10, Math.max(5.2, 3.6 + sep * 0.75 + highest * 0.9));
      tx = mid; ty = 1.55 + highest * 0.35 + (tz - 5) * 0.12;
      lx = mid; ly = 1.05 + highest * 0.6;
      if (this.focus) {
        this.focus.t -= dt;
        const f = this.focus;
        const z = f.zoom;
        tx = tx + (f.x - tx) * z; lx = lx + (f.x - lx) * z;
        ty = ty + (f.y + 0.5 - ty) * z * 0.6; ly = ly + (f.y + 0.9 - ly) * z * 0.6;
        tz = tz + (3.4 - tz) * z;
        if (f.t <= 0) this.focus = null;
      }
    }
    const k = 1 - Math.exp(-(this.focus ? 7 : Math.max(a.y || 0, b.y || 0) > 0.6 ? 7 : 4.5) * dt);
    this.pos.x += (tx - this.pos.x) * k;
    this.pos.y += (ty - this.pos.y) * k;
    this.pos.z += (tz - this.pos.z) * k;
    this.look.x += (lx - this.look.x) * k;
    this.look.y += (ly - this.look.y) * k;

    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.2);
    const s = this.shakeAmt * this.shakeAmt * 2;
    this.cam.position.set(
      this.pos.x + (Math.random() - 0.5) * s,
      this.pos.y + (Math.random() - 0.5) * s,
      this.pos.z,
    );
    this.cam.lookAt(this.look.x + (Math.random() - 0.5) * s * 0.3, this.look.y, 0);
  }

  snap() {
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
  }
}
