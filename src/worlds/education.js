// ============================================================
// SECTOR 02 — 云端教室 / LUMEN AI CLASSROOM
// ============================================================
import * as THREE from 'three';
import { seeded, starField, holoPanel, labelSprite, circleBounds, makeCharacter } from '../engine.js';

export function createEducation() {
  const group = new THREE.Group();
  const rnd = seeded(0x1e0);
  const animated = [];

  group.add(starField(900, 100, '#9fe4ff', 0.4, 0.75));

  // 平台
  const platform = new THREE.Mesh(
    new THREE.CylinderGeometry(18.4, 17.4, 1.3, 64),
    new THREE.MeshStandardMaterial({ color: '#0b1a26', roughness: 0.34, metalness: 0.65, flatShading: false })
  );
  platform.position.y = -0.65;
  group.add(platform);

  const inlay = new THREE.Mesh(
    new THREE.CylinderGeometry(17.6, 17.6, 0.04, 64),
    new THREE.MeshStandardMaterial({ color: '#10222f', roughness: 0.2, metalness: 0.85 })
  );
  inlay.position.y = 0.01;
  group.add(inlay);

  // 同心霓虹环
  [5, 10, 15.5, 18.1].forEach((r, i) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r - 0.03, r + 0.03, 96),
      new THREE.MeshBasicMaterial({ color: i === 3 ? '#5cf2ff' : '#2c7f96', transparent: true, opacity: i === 3 ? 0.8 : 0.35, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.035;
    group.add(ring);
  });

  // 放射线
  const radial = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(a) * 4, 0, Math.sin(a) * 4),
      new THREE.Vector3(Math.cos(a) * 18, 0, Math.sin(a) * 18),
    ]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#1d6b7a', transparent: true, opacity: 0.2 }));
    line.position.y = 0.04;
    radial.add(line);
  }
  group.add(radial);

  // 云海
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#b9dff0', roughness: 1, transparent: true, opacity: 0.16, flatShading: true });
  const clouds = new THREE.Group();
  for (let i = 0; i < 46; i++) {
    const s = 4 + rnd() * 9;
    const puff = new THREE.Mesh(new THREE.SphereGeometry(s, 7, 5), cloudMat);
    const a = rnd() * Math.PI * 2;
    const r = 22 + rnd() * 26;
    puff.position.set(Math.cos(a) * r, -8 + rnd() * 12, Math.sin(a) * r);
    puff.scale.y = 0.45 + rnd() * 0.3;
    clouds.add(puff);
  }
  group.add(clouds);
  animated.push((t) => { clouds.rotation.y = t * 0.012; });

  // 中央知识树
  const tree = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.5, 1),
    new THREE.MeshBasicMaterial({ color: '#5cf2ff', wireframe: true, transparent: true, opacity: 0.85 })
  );
  tree.add(core);
  const coreSolid = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.75, 0),
    new THREE.MeshStandardMaterial({ color: '#5cf2ff', emissive: '#5cf2ff', emissiveIntensity: 2.2, roughness: 0.4 })
  );
  tree.add(coreSolid);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.4 + i * 0.8, 0.02, 6, 64),
      new THREE.MeshBasicMaterial({ color: i === 1 ? '#ffb545' : '#5cf2ff', transparent: true, opacity: 0.5 })
    );
    ring.rotation.x = Math.PI / 2 + i * 0.4;
    ring.rotation.z = i * 0.7;
    tree.add(ring);
  }
  tree.position.y = 4.4;
  group.add(tree);
  animated.push((t) => {
    core.rotation.y = t * 0.22;
    core.rotation.x = Math.sin(t * 0.2) * 0.3;
    coreSolid.rotation.y = -t * 0.4;
    tree.children.slice(2).forEach((r, i) => { r.rotation.z = t * (0.2 + i * 0.12) * (i % 2 ? -1 : 1); });
    tree.position.y = 4.4 + Math.sin(t * 0.8) * 0.18;
  });

  // 数据柱
  const pillar = (x, z, h, color) => {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, h, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 })
    );
    p.position.set(x, h / 2, z);
    group.add(p);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), new THREE.MeshBasicMaterial({ color }));
    dot.position.set(x, h, z);
    group.add(dot);
    return dot;
  };
  const dots = [];
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 4 + rnd() * 13;
    dots.push(pillar(Math.cos(a) * r, Math.sin(a) * r, 1.2 + rnd() * 3, rnd() > 0.55 ? '#5cf2ff' : '#ffb545'));
  }
  animated.push((t) => {
    dots.forEach((d, i) => { d.position.y = (1.2 + (i % 4)) + Math.sin(t * 1.1 + i) * 0.25; });
    radial.rotation.y = t * 0.05;
  });

  // 全息评审屏
  const panels = [
    { title: 'AI 课堂', sub: 'CLASSROOM / 40 MIN', color: '#5cf2ff', pos: [-11, 4.2, -6], ry: 0.9 },
    { title: '学情画像', sub: 'LEARNER MODEL', color: '#ffb545', pos: [11, 4.6, -5], ry: -0.9 },
    { title: '安全边界', sub: 'SAFETY GUARDRAIL', color: '#ff4d9d', pos: [-12, 4.0, 6], ry: 0.55 },
    { title: '教师工作台', sub: 'TEACHER COPILOT', color: '#c8ff4d', pos: [12, 4.1, 6], ry: -0.55 },
  ];
  panels.forEach((p, i) => {
    const mesh = holoPanel(p.title, p.sub, p.color, 4.6, 2.2);
    mesh.position.set(...p.pos);
    mesh.rotation.y = p.ry;
    group.add(mesh);
    animated.push((t) => {
      mesh.position.y = p.pos[1] + Math.sin(t * 0.9 + i) * 0.14;
    });
  });

  // 课桌
  const deskMat = new THREE.MeshStandardMaterial({ color: '#16303d', roughness: 0.45, metalness: 0.5 });
  const deskTopMat = new THREE.MeshStandardMaterial({ color: '#1f4757', roughness: 0.25, metalness: 0.7 });
  const colliders = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const r = 9.6;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(z) < 1 && x > 0) continue;
    const desk = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 1.0), deskTopMat);
    desk.position.set(x, 0.76, z);
    desk.rotation.y = -a + Math.PI / 2;
    group.add(desk);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.72, 0.72), deskMat);
    leg.position.set(x, 0.36, z);
    leg.rotation.y = -a + Math.PI / 2;
    group.add(leg);
    const holo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.8),
      new THREE.MeshBasicMaterial({ color: '#5cf2ff', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
    );
    holo.position.set(x, 1.02, z);
    holo.rotation.x = -Math.PI / 2 + 0.2;
    holo.rotation.z = -a;
    group.add(holo);
    colliders.push({ minX: x - 1.1, maxX: x + 1.1, minZ: z - 0.7, maxZ: z + 0.7 });
  }

  colliders.push({ minX: -2.1, maxX: 2.1, minZ: -2.1, maxZ: 2.1 });

  // 悬浮书
  const books = [];
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.72, 0.12),
      new THREE.MeshStandardMaterial({ color: i % 3 === 0 ? '#ffb545' : '#5cf2ff', emissive: i % 3 === 0 ? '#ffb545' : '#5cf2ff', emissiveIntensity: 0.5, roughness: 0.5 })
    );
    const a = rnd() * Math.PI * 2;
    const r = 6 + rnd() * 12;
    b.position.set(Math.cos(a) * r, 1.4 + rnd() * 3.4, Math.sin(a) * r);
    b.rotation.set(rnd() * 0.6, rnd() * Math.PI, rnd() * 0.4);
    group.add(b);
    books.push({ m: b, y: b.position.y, ph: rnd() * 6 });
  }
  animated.push((t) => {
    books.forEach((b) => {
      b.m.position.y = b.y + Math.sin(t * 0.8 + b.ph) * 0.2;
      b.m.rotation.y += 0.003;
    });
  });

  return {
    id: 'education',
    group,
    bounds: circleBounds(0, 0, 17.4),
    colliders,
    spawn: { x: 0, z: 12 },
    npcSpots: [
      new THREE.Vector3(-7.5, 0, 3.5),
      new THREE.Vector3(7.5, 0, 3.5),
      new THREE.Vector3(0, 0, -8),
    ],
    portalPos: new THREE.Vector3(0, 0, 13.6),
    environment: {
      bg: '#040915',
      fog: { color: '#08172a', near: 22, far: 92 },
      ambient: { color: '#5f87a8', intensity: 0.8 },
      hemi: { sky: '#16b6d8', ground: '#04080f', intensity: 0.9 },
      dir: { color: '#5cf2ff', intensity: 0.4, pos: [-10, 20, 6] },
    },
    update(t) {
      animated.forEach((fn) => fn(t));
    },
  };
}
