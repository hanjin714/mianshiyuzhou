// ============================================================
// SECTOR 03 — 智能住宅 / NEST-9 SHOWROOM
// ============================================================
import * as THREE from 'three';
import { seeded, holoPanel, labelSprite, rectBounds, makeCanvas } from '../engine.js';

function windowTexture() {
  const c = makeCanvas(256, 512);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#05080c';
  ctx.fillRect(0, 0, 256, 512);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 12; x++) {
      if (Math.random() > 0.42) {
        const warm = Math.random() > 0.55;
        ctx.fillStyle = warm ? `rgba(255,181,69,${0.25 + Math.random() * 0.6})` : `rgba(92,242,255,${0.2 + Math.random() * 0.55})`;
        ctx.fillRect(x * 21 + 4, y * 16 + 4, 13, 8);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createSmarthome() {
  const group = new THREE.Group();
  const rnd = seeded(0x5e9);
  const animated = [];
  const colliders = [];

  // ---------- 城市背景 ----------
  const city = new THREE.Group();
  const winTex = windowTexture();
  for (let i = 0; i < 34; i++) {
    const w = 2.4 + rnd() * 3.6;
    const h = 8 + rnd() * 30;
    const d = 2.4 + rnd() * 3;
    const x = -46 + rnd() * 92;
    const z = -16 - rnd() * 46;
    const t = winTex.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(w / 3)), Math.max(2, Math.round(h / 6)));
    const mat = new THREE.MeshStandardMaterial({
      color: '#070c12',
      roughness: 0.7,
      emissive: new THREE.Color('#0b2a38'),
      emissiveIntensity: 0.45,
      emissiveMap: t,
      emissiveIntensity: 0.9,
    });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, h / 2 - 6, z);
    city.add(b);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.02, 0.12, d * 1.02),
      new THREE.MeshBasicMaterial({ color: rnd() > 0.5 ? '#5cf2ff' : '#ff4d9d', transparent: true, opacity: 0.55 })
    );
    cap.position.set(x, h - 6, z);
    city.add(cap);
  }
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(5, 20, 16),
    new THREE.MeshBasicMaterial({ color: '#dfe9f2', transparent: true, opacity: 0.75 })
  );
  moon.position.set(-26, 26, -58);
  group.add(moon);
  const moonGlow = new THREE.Mesh(
    new THREE.SphereGeometry(7.5, 20, 16),
    new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.08 })
  );
  moonGlow.position.copy(moon.position);
  group.add(moonGlow);
  group.add(city);
  animated.push((t) => {
    city.position.y = Math.sin(t * 0.15) * 0.2;
    moonGlow.scale.setScalar(1 + Math.sin(t * 0.5) * 0.03);
  });

  // ---------- 地面 ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 16),
    new THREE.MeshStandardMaterial({ color: '#2a1c15', roughness: 0.55, metalness: 0.15 })
  );
  floor.rotation.x = -Math.PI / 2;
  group.add(floor);

  for (let i = 0; i < 14; i++) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.012, 16),
      new THREE.MeshBasicMaterial({ color: '#5c3f2c', transparent: true, opacity: 0.5 })
    );
    line.position.set(-11 + i * 1.6, 0.008, 0);
    group.add(line);
  }

  // 地毯
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(7.6, 5.2),
    new THREE.MeshStandardMaterial({ color: '#191214', roughness: 1 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-4.6, 0.015, 0.8);
  group.add(rug);
  const rugEdge = new THREE.Mesh(
    new THREE.RingGeometry(3.6, 3.66, 4),
    new THREE.MeshBasicMaterial({ color: '#ff4d9d', transparent: true, opacity: 0.22, side: THREE.DoubleSide })
  );
  rugEdge.rotation.x = -Math.PI / 2;
  rugEdge.rotation.z = Math.PI / 4;
  rugEdge.position.set(-4.6, 0.02, 0.8);
  group.add(rugEdge);

  // ---------- 墙体 / 天花 ----------
  const wallMat = new THREE.MeshStandardMaterial({ color: '#0b1116', roughness: 0.8, metalness: 0.2 });
  const glassMat = new THREE.MeshBasicMaterial({ color: '#7fe6ff', transparent: true, opacity: 0.055, side: THREE.DoubleSide, depthWrite: false });
  const frameMat = new THREE.MeshBasicMaterial({ color: '#ff4d9d', transparent: true, opacity: 0.55 });

  // 后墙玻璃
  const back = new THREE.Mesh(new THREE.PlaneGeometry(22, 4.8), glassMat);
  back.position.set(0, 2.4, -7.6);
  group.add(back);
  for (let i = 0; i <= 6; i++) {
    const mull = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.8, 0.08), new THREE.MeshStandardMaterial({ color: '#202a30', metalness: 0.8, roughness: 0.3 }));
    mull.position.set(-11 + i * 3.66, 2.4, -7.55);
    group.add(mull);
  }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(22, 0.12, 0.2), frameMat);
  sill.position.set(0, 0.06, -7.55);
  group.add(sill);
  const head = new THREE.Mesh(new THREE.BoxGeometry(22, 0.1, 0.2), frameMat);
  head.position.set(0, 4.76, -7.55);
  group.add(head);

  // 侧墙
  const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.8, 16), wallMat);
  wallL.position.set(-11.1, 2.4, 0);
  group.add(wallL);
  const wallR = wallL.clone(); wallR.position.x = 11.1; group.add(wallR);

  // 天花
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(22, 16), new THREE.MeshStandardMaterial({ color: '#0a0f13', roughness: 0.9 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 4.8;
  group.add(ceiling);

  // 线性灯
  for (let i = 0; i < 5; i++) {
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.04, 0.07),
      new THREE.MeshBasicMaterial({ color: i % 2 ? '#ffb545' : '#dff6ff', transparent: true, opacity: 0.9 })
    );
    strip.position.set(-8 + i * 4, 4.72, -2.4);
    group.add(strip);
    const strip2 = strip.clone(); strip2.position.z = 3.2; group.add(strip2);
  }
  // 侧墙灯带
  const stripL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.6, 0.05), new THREE.MeshBasicMaterial({ color: '#ff4d9d', transparent: true, opacity: 0.75 }));
  stripL.position.set(-10.9, 2.6, -7.4);
  group.add(stripL);

  // ---------- 家具 ----------
  const wood = new THREE.MeshStandardMaterial({ color: '#3a2a22', roughness: 0.6, metalness: 0.1 });
  const fabric = new THREE.MeshStandardMaterial({ color: '#242024', roughness: 0.95 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: '#141a1e', roughness: 0.3, metalness: 0.85 });
  const glow = (color, opacity = 0.8) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity });

  // 沙发
  const sofa = new THREE.Group();
  const sofaBase = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 1.9), fabric);
  sofaBase.position.y = 0.38; sofa.add(sofaBase);
  const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.95, 0.35), fabric);
  sofaBack.position.set(0, 0.9, -0.78); sofa.add(sofaBack);
  for (let i = -1; i <= 1; i++) {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.22, 1.5), fabric);
    cushion.position.set(i * 1.45, 0.68, 0.08);
    sofa.add(cushion);
    const pip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.12), glow(i === 0 ? '#ff4d9d' : '#ffb545', 0.5));
    pip.position.set(i * 1.45 + 0.4, 0.95, -0.5);
    pip.rotation.z = 0.3;
    sofa.add(pip);
  }
  sofa.position.set(-4.6, 0, -1.4);
  group.add(sofa);
  colliders.push({ minX: -7.0, maxX: -2.2, minZ: -2.6, maxZ: -0.3 });

  // 茶几
  const tableTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.06, 1.4),
    new THREE.MeshStandardMaterial({ color: '#7fd8e8', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28 })
  );
  tableTop.position.set(-4.6, 0.46, 1.2);
  group.add(tableTop);
  const tableEdge = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.02, 1.44), glow('#5cf2ff', 0.65));
  tableEdge.position.set(-4.6, 0.42, 1.2);
  group.add(tableEdge);
  const legT = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.42, 0.05), darkMetal);
  legT.position.set(-4.6, 0.21, 1.2); group.add(legT);
  colliders.push({ minX: -5.9, maxX: -3.3, minZ: 0.4, maxZ: 2.0 });

  // 厨房岛台
  const island = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.0, 2.0), new THREE.MeshStandardMaterial({ color: '#1b2228', roughness: 0.35, metalness: 0.55 }));
  island.position.set(4.6, 0.5, -4.2);
  group.add(island);
  const islandTop = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.07, 2.2), new THREE.MeshStandardMaterial({ color: '#e6eef0', roughness: 0.25, metalness: 0.3 }));
  islandTop.position.set(4.6, 1.03, -4.2);
  group.add(islandTop);
  const islandGlow = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.025, 0.03), glow('#ffb545', 0.8));
  islandGlow.position.set(4.6, 0.52, -3.19);
  group.add(islandGlow);
  colliders.push({ minX: 2.3, maxX: 6.9, minZ: -5.3, maxZ: -3.1 });

  // 吧椅
  for (let i = 0; i < 2; i++) {
    const stool = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 12), fabric);
    seat.position.y = 0.72; stool.add(seat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), darkMetal);
    stem.position.y = 0.36; stool.add(stem);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.015, 6, 20), glow('#5cf2ff', 0.5));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.25; stool.add(ring);
    stool.position.set(3.4 + i * 1.8, 0, -2.5);
    group.add(stool);
  }

  // 书架
  const shelf = new THREE.Group();
  const shelfBack = new THREE.Mesh(new THREE.BoxGeometry(3.0, 3.2, 0.4), wood);
  shelfBack.position.set(0, 1.6, 0);
  shelf.add(shelfBack);
  for (let l = 0; l < 4; l++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.06, 0.5), darkMetal);
    board.position.set(0, 0.4 + l * 0.85, 0);
    shelf.add(board);
    for (let b = 0; b < 5; b++) {
      if (rnd() > 0.7) continue;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(0.14 + rnd() * 0.1, 0.5 + rnd() * 0.2, 0.32),
        new THREE.MeshStandardMaterial({ color: ['#ff4d9d', '#5cf2ff', '#ffb545', '#c8ff4d'][Math.floor(rnd() * 4)], roughness: 0.8 })
      );
      book.position.set(-1.25 + b * 0.52, 0.66 + l * 0.85, 0.03);
      shelf.add(book);
    }
  }
  shelf.position.set(9.2, 0, -6.4);
  group.add(shelf);
  colliders.push({ minX: 7.6, maxX: 10.8, minZ: -7.2, maxZ: -5.8 });

  // 落地灯
  const lampGroup = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 8), darkMetal);
  pole.position.y = 1.2; lampGroup.add(pole);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.5, 0.42, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#ffd9a8', emissive: '#ffb545', emissiveIntensity: 1.4, side: THREE.DoubleSide }));
  shade.position.y = 2.5; lampGroup.add(shade);
  const lampLight = new THREE.PointLight('#ffb545', 3.2, 9, 2);
  lampLight.position.y = 2.4; lampGroup.add(lampLight);
  const lampRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.015, 6, 32), glow('#ffb545', 0.4));
  lampRing.rotation.x = Math.PI / 2; lampRing.position.y = 0.02; lampGroup.add(lampRing);
  lampGroup.position.set(8.3, 0, 4.4);
  group.add(lampGroup);
  colliders.push({ minX: 7.8, maxX: 8.8, minZ: 3.9, maxZ: 4.9 });

  // 电视 / 中央墙面
  const tv = new THREE.Mesh(
    new THREE.PlaneGeometry(4.6, 2.3),
    new THREE.MeshBasicMaterial({ color: '#0a1a22' })
  );
  tv.position.set(0, 2.5, -7.48);
  group.add(tv);
  const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.5, 0.06), new THREE.MeshBasicMaterial({ color: '#ff4d9d', transparent: true, opacity: 0.5 }));
  tvFrame.position.set(0, 2.5, -7.52);
  group.add(tvFrame);
  const tvPanel = holoPanel('NEST-9', 'SMART LIVING / 89㎡', '#ff4d9d', 4.3, 2.1);
  tvPanel.position.set(0, 2.5, -7.45);
  group.add(tvPanel);
  animated.push((t) => {
    tvPanel.material.opacity = 0.85 + Math.sin(t * 2.2) * 0.12;
  });

  // 全息户型图
  const plan = new THREE.Group();
  const planBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 0.06, 40),
    new THREE.MeshStandardMaterial({ color: '#0d1a20', roughness: 0.2, metalness: 0.7 })
  );
  planBase.position.y = 0.75; plan.add(planBase);
  const planRing = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.82, 40), glow('#5cf2ff', 0.6));
  planRing.rotation.x = -Math.PI / 2; planRing.position.y = 0.79; plan.add(planRing);
  for (let i = 0; i < 5; i++) {
    const room = new THREE.Mesh(
      new THREE.BoxGeometry(0.9 + rnd() * 0.9, 0.12, 0.7 + rnd() * 0.8),
      new THREE.MeshBasicMaterial({ color: i % 2 ? '#5cf2ff' : '#ff4d9d', transparent: true, opacity: 0.35 })
    );
    room.position.set((rnd() - 0.5) * 2.2, 0.86 + rnd() * 0.1, (rnd() - 0.5) * 2.2);
    plan.add(room);
  }
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.06), glow('#5cf2ff', 0.5));
  scan.rotation.x = -Math.PI / 2;
  scan.position.y = 0.95;
  plan.add(scan);
  plan.position.set(0, 0, 2.2);
  group.add(plan);
  animated.push((t) => {
    plan.rotation.y = t * 0.16;
    scan.position.z = Math.sin(t * 1.4) * 1.5;
    scan.position.x = Math.cos(t * 1.4) * 1.5;
    planBase.position.y = 0.75 + Math.sin(t * 1.1) * 0.03;
  });
  colliders.push({ minX: -1.5, maxX: 1.5, minZ: 0.7, maxZ: 3.7 });

  // 智能面板
  [[-10.85, 2.0, 1.5, '#c8ff4d'], [-10.85, 2.0, 4.5, '#ffb545']].forEach(([x, y, z, c]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.9, 0.55), new THREE.MeshStandardMaterial({ color: '#0c1114', roughness: 0.2, metalness: 0.8 }));
    p.position.set(x, y, z); group.add(p);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.7), glow(c, 0.55));
    scr.rotation.y = Math.PI / 2;
    scr.position.set(x + 0.04, y, z); group.add(scr);
  });

  // 浮尘
  const dustGeo = new THREE.BufferGeometry();
  const dcount = 260;
  const dpos = new Float32Array(dcount * 3);
  for (let i = 0; i < dcount; i++) {
    dpos[i * 3] = (rnd() - 0.5) * 21;
    dpos[i * 3 + 1] = rnd() * 4.6;
    dpos[i * 3 + 2] = (rnd() - 0.5) * 15;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#ffd9b0', size: 0.035, transparent: true, opacity: 0.45, depthWrite: false }));
  group.add(dust);
  animated.push((t) => { dust.rotation.y = t * 0.02; });

  // 室内氛围光
  const warm = new THREE.PointLight('#ffb545', 2.2, 16, 2);
  warm.position.set(-4, 3.4, 1);
  group.add(warm);
  const cool = new THREE.PointLight('#5cf2ff', 1.8, 16, 2);
  cool.position.set(5, 3.6, -2);
  group.add(cool);

  return {
    id: 'smarthome',
    group,
    bounds: rectBounds(-10.4, 10.4, -7.0, 6.8),
    colliders,
    spawn: { x: 0, z: 6 },
    npcSpots: [
      new THREE.Vector3(-7.2, 0, 4.6),
      new THREE.Vector3(6.4, 0, 5.0),
      new THREE.Vector3(0, 0, -5.6),
    ],
    portalPos: new THREE.Vector3(0, 0, 7.6),
    environment: {
      bg: '#04030a',
      fog: { color: '#06040c', near: 18, far: 85 },
      ambient: { color: '#8fa3c4', intensity: 0.95 },
      hemi: { sky: '#3a4a6e', ground: '#141018', intensity: 0.85 },
      dir: { color: '#ffb545', intensity: 0.45, pos: [-6, 16, 8] },
    },
    update(t) {
      animated.forEach((fn) => fn(t));
    },
  };
}
