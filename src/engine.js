// ============================================================
// 引擎工具：标签、角色、全息面板、传送门、星空
// ============================================================
import * as THREE from 'three';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// ---------- 标签 ----------
export function labelSprite(title, sub, accent = '#c8ff4d', width = 4.4) {
  const w = 640, h = 190;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(4,10,14,0.82)';
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 16, 4);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = accent;
  ctx.fillRect(26, 32, 4, h - 64);

  ctx.font = '600 54px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#e9f6f2';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, 52, 72);

  ctx.font = '400 24px "SF Mono", Menlo, monospace';
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.8;
  ctx.fillText(sub.toUpperCase(), 52, 126);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(width, width * (h / w), 1);
  return sp;
}

// ---------- 全息面板 ----------
export function holoPanel(title, sub, accent = '#5cf2ff', w = 5, h = 2.4) {
  const cw = 800, ch = Math.round(800 * h / w);
  const c = makeCanvas(cw, ch);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(5,14,20,0.72)';
  ctx.fillRect(0, 0, cw, ch);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, cw - 12, ch - 12);
  ctx.globalAlpha = 0.18;
  for (let y = 20; y < ch; y += 16) {
    ctx.fillStyle = accent;
    ctx.fillRect(12, y, cw - 24, 1);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = accent;
  ctx.fillRect(24, 24, 8, 40);
  ctx.font = '700 44px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#e9f6f2';
  ctx.fillText(title, 48, 62);
  ctx.font = '400 22px "SF Mono", Menlo, monospace';
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.75;
  ctx.fillText(sub, 48, 100);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.userData.isPanel = true;
  return mesh;
}

// ---------- 角色 ----------
export function makeCharacter({ style = 'voxel', accent = '#c8ff4d', name = 'NPC', role = 'INTERVIEWER' }) {
  const g = new THREE.Group();
  const acc = new THREE.Color(accent);
  const skin = new THREE.Color('#1a2a30');
  const dark = new THREE.Color('#0a1216');
  const accentMat = new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: 1.6, roughness: 0.4 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: style === 'holo' ? acc : skin, emissive: acc, emissiveIntensity: style === 'holo' ? 0.55 : 0.12, transparent: style === 'holo', opacity: style === 'holo' ? 0.72 : 1, roughness: 0.55, metalness: 0.25, flatShading: true });
  const darkMat = new THREE.MeshStandardMaterial({ color: dark, roughness: 0.7, metalness: 0.3, flatShading: true });

  let headY = 1.55;

  if (style === 'voxel') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.38), bodyMat);
    body.position.y = 0.95; g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.4), accentMat);
    stripe.position.y = 1.02; g.add(stripe);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.52, 0.52), bodyMat);
    head.position.y = 1.62; g.add(head);
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.02), accentMat);
    eyeL.position.set(-0.12, 1.66, 0.27); g.add(eyeL);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.12; g.add(eyeR);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.18), bodyMat);
    armL.position.set(-0.42, 0.98, 0); g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.68, 0.24), darkMat);
    legL.position.set(-0.16, 0.34, 0); g.add(legL);
    const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);
    g.userData.head = head;
    headY = 2.28;
  } else if (style === 'holo') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.52, 1.2, 6, 1, true), bodyMat);
    body.position.y = 0.9; g.add(body);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial({ color: acc, wireframe: true, transparent: true, opacity: 0.9 }));
    head.position.y = 1.68; g.add(head);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), accentMat);
    core.position.y = 1.68; g.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.018, 6, 40), accentMat);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.95; g.add(ring);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.06, 6), darkMat);
    base.position.y = 0.03; g.add(base);
    g.userData.head = head;
    g.userData.holoRing = ring;
    headY = 2.2;
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.42, 1.05, 8), bodyMat);
    body.position.y = 1.03; g.add(body);
    const coat = new THREE.Mesh(new THREE.BoxGeometry(0.76, 1.15, 0.3), darkMat);
    coat.position.set(0, 0.82, -0.12); g.add(coat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), bodyMat);
    head.position.y = 1.72; g.add(head);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.06), accentMat);
    visor.position.set(0, 1.73, 0.23); g.add(visor);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.66, 0.16), bodyMat);
    armL.position.set(-0.44, 1.1, 0); g.add(armL);
    const armR = armL.clone(); armR.position.x = 0.44; g.add(armR);
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.02), accentMat);
    tablet.position.set(0.45, 1.02, 0.25); tablet.rotation.x = -0.4; g.add(tablet);
    g.userData.head = head;
    headY = 2.18;
  }

  const ringGeo = new THREE.RingGeometry(0.55, 0.66, 40);
  const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; g.add(ring);
  g.userData.ring = ring;

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.9, 3.2, 16, 1, true),
    new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false })
  );
  beam.position.y = 1.6; g.add(beam);

  const label = labelSprite(name, role, accent, 3.9);
  label.position.y = headY; g.add(label);

  const light = new THREE.PointLight(acc, 1.4, 7, 2);
  light.position.y = 1.9; g.add(light);

  g.userData.baseY = 0;
  g.userData.phase = Math.random() * Math.PI * 2;
  g.userData.accent = accent;
  return g;
}

// ---------- 传送门 ----------
export function makePortal(accent = '#c8ff4d') {
  const g = new THREE.Group();
  const acc = new THREE.Color(accent);
  const ringMat = new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.9 });
  const dimMat = new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.16 });

  const r1 = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.05, 8, 64), ringMat);
  g.add(r1);
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.02, 8, 64), dimMat);
  g.add(r2);
  const inner = new THREE.Mesh(
    new THREE.CircleGeometry(1.28, 48),
    new THREE.MeshBasicMaterial({ color: acc, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false })
  );
  g.add(inner);

  const dots = new THREE.BufferGeometry();
  const arr = new Float32Array(180 * 3);
  for (let i = 0; i < 180; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 1.1 + Math.random() * 0.5;
    arr[i * 3] = Math.cos(a) * r;
    arr[i * 3 + 1] = Math.sin(a) * r;
    arr[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
  }
  dots.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const dust = new THREE.Points(dots, new THREE.PointsMaterial({ color: acc, size: 0.035, transparent: true, opacity: 0.8, depthWrite: false }));
  g.add(dust);

  const label = labelSprite('NEXT SECTOR', '进入下一世界 / PRESS F', accent, 4.0);
  label.position.y = 2.35; g.add(label);

  g.position.y = 1.85;
  g.userData.dust = dust;
  return g;
}

// ---------- 星空 / 粒子 ----------
export function starField(count, radius, color = '#8fd8ff', size = 0.45, opacity = 0.7) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = radius * (0.55 + Math.random() * 0.45);
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = Math.abs(r * Math.cos(ph)) * 0.8 + 2;
    pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, sizeAttenuation: true }));
}

// ---------- 网格地面 ----------
export function neonGrid(size, divisions, color = '#1d6b7a', opacity = 0.5) {
  const grid = new THREE.GridHelper(size, divisions, color, color);
  grid.material.transparent = true;
  grid.material.opacity = opacity;
  return grid;
}

// ---------- 清理 ----------
export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    }
  });
}

export function circleBounds(cx, cz, r) {
  return { type: 'circle', cx, cz, r };
}
export function rectBounds(minX, maxX, minZ, maxZ) {
  return { type: 'rect', minX, maxX, minZ, maxZ };
}
