// ============================================================
// 第一人称控制器：WASD + 鼠标视角 + 碰撞
// ============================================================
import * as THREE from 'three';

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.keys = new Set();
    this.locked = false;
    this.enabled = true;
    this.colliders = [];
    this.bounds = null;
    this.radius = 0.42;
    this.eye = 1.68;
    this.bobT = 0;
    this.bobAmt = 0;
    this.walkSpeed = 5.0;
    this.runSpeed = 8.2;
    this.onLockChange = null;
    this._bind();
  }

  _bind() {
    document.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' ', 'e', 'f'].includes(k)) {
        if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
      }
      this.keys.add(k);
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.yaw -= e.movementX * 0.0021;
      this.pitch -= e.movementY * 0.0021;
      this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch));
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (this.onLockChange) this.onLockChange(this.locked);
    });

    this.dom.addEventListener('click', () => {
      if (this.enabled && !this.locked) this.lock();
    });
  }

  lock() {
    if (!this.enabled) return;
    const p = this.dom.requestPointerLock?.();
    if (p && p.catch) p.catch(() => {});
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  setWorld(spawn, bounds, colliders) {
    this.pos.set(spawn.x, 0, spawn.z);
    this.vel.set(0, 0, 0);
    this.bounds = bounds;
    this.colliders = colliders || [];
    this.pitch = 0;
    this.yaw = Math.atan2(spawn.x, spawn.z);
    this.syncCamera();
  }

  lookAt(x, z) {
    this.yaw = Math.atan2(this.pos.x - x, this.pos.z - z);
  }

  intersects(x, z, c) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    return dx * dx + dz * dz < this.radius * this.radius;
  }

  clampBounds(x, z) {
    if (!this.bounds) return { x, z };
    const b = this.bounds;
    const r = this.radius + 0.05;
    if (b.type === 'circle') {
      const dx = x - b.cx;
      const dz = z - b.cz;
      const d = Math.hypot(dx, dz);
      const max = b.r - r;
      if (d > max) {
        const k = max / (d || 1);
        return { x: b.cx + dx * k, z: b.cz + dz * k };
      }
      return { x, z };
    }
    return {
      x: Math.max(b.minX + r, Math.min(b.maxX - r, x)),
      z: Math.max(b.minZ + r, Math.min(b.maxZ - r, z)),
    };
  }

  update(dt, time) {
    const active = this.locked && this.enabled;
    let fwd = 0;
    let str = 0;
    if (active) {
      if (this.keys.has('w') || this.keys.has('arrowup')) fwd += 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) fwd -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) str += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) str -= 1;
    }

    const len = Math.hypot(fwd, str) || 1;
    fwd /= len;
    str /= len;
    const running = active && (this.keys.has('shift'));
    const speed = running ? this.runSpeed : this.walkSpeed;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const targetX = (-sin * fwd + cos * str) * speed;
    const targetZ = (-cos * fwd - sin * str) * speed;

    const accel = 1 - Math.exp(-dt * (active ? 12 : 16));
    this.vel.x += (targetX - this.vel.x) * accel;
    this.vel.z += (targetZ - this.vel.z) * accel;

    if (Math.abs(this.vel.x) < 0.001) this.vel.x = 0;
    if (Math.abs(this.vel.z) < 0.001) this.vel.z = 0;

    // X 轴碰撞
    let nx = this.pos.x + this.vel.x * dt;
    let nz = this.pos.z;
    for (const c of this.colliders) {
      if (this.intersects(nx, nz, c)) { nx = this.pos.x; this.vel.x = 0; break; }
    }
    // Z 轴碰撞
    nz = this.pos.z + this.vel.z * dt;
    for (const c of this.colliders) {
      if (this.intersects(nx, nz, c)) { nz = this.pos.z; this.vel.z = 0; break; }
    }

    const clamped = this.clampBounds(nx, nz);
    this.pos.x = clamped.x;
    this.pos.z = clamped.z;

    const speedNow = Math.hypot(this.vel.x, this.vel.z);
    this.bobT += dt * (6 + speedNow * 1.5);
    this.bobAmt += ((speedNow > 0.4 ? 1 : 0) - this.bobAmt) * (1 - Math.exp(-dt * 8));

    const bob = Math.sin(this.bobT) * 0.028 * this.bobAmt;
    const sway = Math.cos(this.bobT * 0.5) * 0.012 * this.bobAmt;

    this.camera.position.set(this.pos.x, this.eye + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, sway * 0.4, 'YXZ');

    const targetFov = running && speedNow > 4 ? 76 : 70;
    if (Math.abs(this.camera.fov - targetFov) > 0.2) {
      this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-dt * 6));
      this.camera.updateProjectionMatrix();
    }
  }

  syncCamera() {
    this.camera.position.set(this.pos.x, this.eye, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  // 方向：0=前, 1=后, 2=左, 3=右 —— 用于 UI 提示
  facingDot(target) {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    return (dx / d) * fx + (dz / d) * fz;
  }
}
