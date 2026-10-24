// ============================================================
// NPC 面试官实体
// ============================================================
import { makeCharacter } from './engine.js';

export class NPC {
  constructor(data, spot, index) {
    this.data = data;
    this.index = index;
    this.interviewed = false;
    this.obj = makeCharacter({
      style: data.style,
      accent: data.accent,
      name: data.full,
      role: data.role,
    });
    this.obj.position.set(spot.x, spot.y, spot.z);
    this.baseY = spot.y;
    this.phase = index * 1.9;
    this.obj.userData.label = this.obj.children.find((c) => c.isSprite);
  }

  update(t, playerPos) {
    const o = this.obj;
    o.position.y = this.baseY + Math.sin(t * 1.05 + this.phase) * 0.035;

    const dx = playerPos.x - o.position.x;
    const dz = playerPos.z - o.position.z;
    const dist = Math.hypot(dx, dz);
    const target = dist < 10 ? Math.atan2(dx, dz) : 0;
    let d = target - o.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    o.rotation.y += d * 0.045;

    if (o.userData.ring) o.userData.ring.rotation.z = t * 0.35;
    if (o.userData.holoRing) o.userData.holoRing.rotation.z = -t * 0.6;
    if (!this.interviewed && o.userData.head) {
      o.userData.head.position.y = (o.userData.head.userData.baseY || o.userData.head.position.y);
    }
  }

  markDone() {
    this.interviewed = true;
    const o = this.obj;
    if (o.userData.ring) {
      o.userData.ring.material.opacity = 0.12;
    }
    if (o.userData.label) {
      o.userData.label.material.color.set('#6d8490');
      o.userData.label.material.opacity = 0.55;
    }
  }

  distanceTo(p) {
    return Math.hypot(p.x - this.obj.position.x, p.z - this.obj.position.z);
  }
}
