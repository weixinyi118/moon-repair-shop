import * as T from 'three';
import {random, paint, group, mesh, sphere, pipe, gear, torus, glow, batch} from './craft.js';

const outer = 2.68;
const inner = 2.51;
const offset = 1.22;
const joinX = (outer ** 2 - inner ** 2 + offset ** 2) / (2 * offset);
const joinY = Math.sqrt(outer ** 2 - joinX ** 2);
const outerAngle = Math.atan2(joinY, joinX);
const innerAngle = Math.atan2(joinY, joinX - offset);
const tau = Math.PI * 2;

function band(t, v, z = 0) {
  const a = T.MathUtils.lerp(outerAngle, tau - outerAngle, t);
  const b = T.MathUtils.lerp(innerAngle, tau - innerAngle, t);
  return new T.Vector3(T.MathUtils.lerp(outer * Math.cos(a), offset + inner * Math.cos(b), v),
    T.MathUtils.lerp(outer * Math.sin(a), inner * Math.sin(b), v), z);
}

function cross(t, phi, fracture = 0) {
  const v = (1 - Math.cos(phi)) / 2;
  const irregularity = fracture * (.008 * Math.sin(phi * 4 + .5) + .006 * Math.cos(phi * 7));
  const depth = .48 * Math.sin(phi) * Math.pow(Math.sin(Math.PI * t), .72);
  return band(t + irregularity, v, depth);
}

function shell(a, b, cutA, cutB) {
  const steps = 52;
  const sides = 32;
  const points = [], uv = [], indices = [];
  function point(p) {
    points.push(p.x, p.y, p.z);
    uv.push((p.x + outer) / (2 * outer), (p.y + outer) / (2 * outer));
  }
  for (let i = 0; i <= steps; i++) {
    const t = T.MathUtils.lerp(a, b, i / steps);
    for (let j = 0; j <= sides; j++) {
      point(cross(t, j * tau / sides, i === 0 ? cutA : i === steps ? cutB : 0));
      if (i < steps && j < sides) {
        const k = i * (sides + 1) + j;
        indices.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2);
      }
    }
  }
  for (const [t, cut, start] of [[a, cutA, true], [b, cutB, false]]) {
    if (!cut) continue;
    const end = points.length / 3;
    point(band(t, .5));
    for (let j = 0; j <= sides; j++) point(cross(t, j * tau / sides, cut));
    for (let j = 0; j < sides; j++) indices.push(end, end + j + (start ? 2 : 1), end + j + (start ? 1 : 2));
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(points, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function porcelain() {
  const pigment = paint(1024, (ctx, size) => {
    const rng = random(632);
    const glaze = ctx.createLinearGradient(0, size, size, 0);
    glaze.addColorStop(0, '#a3a4bc');
    glaze.addColorStop(.38, '#e5d2b5');
    glaze.addColorStop(.66, '#f1dfc7');
    glaze.addColorStop(1, '#c3d5e0');
    ctx.fillStyle = glaze; ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 85000; i++) {
      const shade = rng() > .49 ? '255,252,237' : '64,55,66';
      ctx.fillStyle = 'rgba(' + shade + ',' + rng() * .18 + ')';
      ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 3, 1 + rng());
    }
    for (let i = 0; i < 85; i++) {
      const p = band(rng() * .97 + .015, .08 + rng() * .84);
      const x = (p.x + outer) / (2 * outer) * size;
      const y = (outer - p.y) / (2 * outer) * size;
      const r = (rng() ** 3 * 28 + 2) * (i < 6 ? 1.65 : 1);
      const crater = ctx.createRadialGradient(x - r * .15, y + r * .16, r * .07, x, y, r);
      crater.addColorStop(0, '#776b7c60');
      crater.addColorStop(.58, '#96829428');
      crater.addColorStop(.77, '#6c61755c');
      crater.addColorStop(.91, '#fff5d997');
      crater.addColorStop(1, '#fff2d000');
      ctx.fillStyle = crater;
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    ctx.lineWidth = 1;
    for (let j = 0; j < 8; j++) {
      ctx.beginPath();
      for (let i = 0; i <= 150; i++) {
        const p = band(i / 150, .13 + j * .1 + .016 * Math.sin(i * .13 + j));
        ctx.lineTo((p.x + outer) * size / (2 * outer), (outer - p.y) * size / (2 * outer));
      }
      ctx.strokeStyle = j % 3 ? '#fcf0d46b' : '#97775845';
      ctx.stroke();
    }
  });
  const relief = pigment.clone();
  relief.colorSpace = T.NoColorSpace;
  relief.needsUpdate = true;
  return new T.MeshPhysicalMaterial({
    color: 0xffe6bf, map: pigment, bumpMap: relief, bumpScale: .055,
    roughness: .47, metalness: .08, clearcoat: .53, clearcoatRoughness: .33,
    emissive: 0xffcb91, emissiveMap: pigment, emissiveIntensity: .32,
    side: T.DoubleSide,
  });
}

function seam(parent, t, material, radius) {
  const points = Array.from({length: 42}, (_, i) => cross(t, i / 41 * tau, 1).toArray());
  return pipe(parent, material, points, radius, 55);
}

function glassInlay(parent, a, b, material) {
  const points = [], indices = [];
  for (let i = 0; i <= 48; i++) {
    const t = T.MathUtils.lerp(a, b, i / 48);
    const width = .43 * Math.sin(Math.PI * i / 48) ** .58;
    for (const phi of [2.66 - width, 2.66 + width]) {
      const point = cross(t, phi);
      point.z += .026;
      points.push(...point.toArray());
    }
    if (i < 48) indices.push(i*2, i*2+2, i*2+1, i*2+1, i*2+2, i*2+3);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(points,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(parent, geometry, material);
}

export function buildMoon(world, m, haloTexture) {
  const moon = group(world, .67, 3.66, -1.36);
  moon.rotation.set(-.07, .28, -.24);
  const ceramic = porcelain();
  const enamel = ceramic.clone();
  enamel.color.setHex(0xd4d9ef);
  enamel.roughness = .27;
  enamel.clearcoat = .85;
  enamel.emissive.setHex(0xffd2a3);
  const glazedGlass = new T.MeshPhysicalMaterial({color:0xa5bbc9, transparent:true, opacity:.66, roughness:.16,
    metalness:.11, clearcoat:1, clearcoatRoughness:.1, side:T.DoubleSide, depthWrite:false});

  const guide = group(moon);
  const parts = [], faces = [], seams = [], gears = [], glints = [];
  const breaks = [0, .343, .681, 1];
  const initialOffsets = [[.05,.13,-.035,-.04],[-.07,0,.018,.016],[.12,-.12,.08,.07]];
  for (let i = 0; i < 3; i++) {
    const part = group(moon);
    const a = breaks[i], b = breaks[i + 1];
    faces.push(mesh(part, shell(a, b, i !== 0, i !== 2), i === 1 ? ceramic : enamel));
    if (i !== 1) glassInlay(part, a + .013, b - .013, glazedGlass);
    for (const phi of [.17, 2.9, 3.28, 6.11]) {
      const points = Array.from({length: 65}, (_, j) => cross(T.MathUtils.lerp(a, b, j / 64), phi).toArray());
      pipe(part, phi < 3 ? m.paleGold : m.bronze, points, .017, 65);
    }
    parts.push(part);
  }
  const goldLight = new T.MeshBasicMaterial({color: 0xffcc87, transparent: true, opacity: .9, blending: T.AdditiveBlending, depthWrite: false});
  for (const t of breaks.slice(1, -1)) {
    seams.push(seam(moon, t, goldLight, .018));
    const at = band(t, .49, .40);
    glow(moon, haloTexture, 0xffbc74, .36, 1.35, ...at.toArray());
    for (let i = 0; i < 5; i++) {
      const light = glow(moon, haloTexture, 0xffd195, 0, .32, 0, 0, 0);
      glints.push({light, t, delay:i*.057});
    }
    for (let j = 0; j < 4; j++) {
      const spot = band(t + (j - 1.4) * .025, .19 + j * .20, .48 - .055 * Math.abs(j - 1));
      const r = [.22, .29, .19, .117][j];
      const cog = gear(moon, m, r, 12 + j * 3, ...spot.toArray());
      cog.rotation.y = j * .15 - .26;
      gears.push({cog, spot, phase: j * 1.8 + t, direction: j % 2 ? -1 : 1});
    }
  }

  // Engraved orbit markings behind the shell, with a separate tilted instrument ring.
  guide.position.set(0, 0, -.26);
  const lineGold = new T.LineBasicMaterial({color: 0xb68c62, transparent: true, opacity: .43});
  for (const r of [2.98, 3.13, 3.37]) {
    const points = Array.from({length: 161}, (_, i) => new T.Vector3(r * Math.cos(i * tau / 160), r * Math.sin(i * tau / 160), 0));
    guide.add(new T.Line(new T.BufferGeometry().setFromPoints(points), lineGold));
  }
  const ticks = [];
  for (let i = 0; i < 108; i++) {
    const a = i * tau / 108, from = i % 9 === 0 ? 3.13 : 3.24;
    ticks.push(new T.Vector3(from * Math.cos(a), from * Math.sin(a), 0),
      new T.Vector3(3.32 * Math.cos(a), 3.32 * Math.sin(a), 0));
    if (i % 27 === 0) sphere(guide, m.paleGold, 3.37 * Math.cos(a), 3.37 * Math.sin(a), 0, .057);
  }
  guide.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(ticks), lineGold));
  batch(guide);
  const oblique = group(moon, .1, -.26, -.29);
  oblique.rotation.set(1.07, -.28, -.12);
  const orbit = torus(oblique, m.brass, 0, 0, 0, 3.17, .013);
  orbit.scale.x = 1.11;
  const satellite = sphere(oblique, m.star, 0, 3.17, 0, .074);
  glow(satellite, haloTexture, 0xffcd88, .65, 7, 0, 0, 0);
  const aura = glow(world, haloTexture, 0xffb569, .4, 11, -.28, 3.78, -2.03);

  function update(time, repair, daylight) {
    for (let i = 0; i < parts.length; i++) {
      const [x,y,z,rz] = initialOffsets[i];
      const looseness = 1 - repair;
      parts[i].position.set((x + .017 * Math.sin(time * .9 + i)) * looseness, (y + .012 * Math.sin(time * 1.2 + i)) * looseness, z * looseness);
      parts[i].rotation.z = rz * looseness;
    }
    const energy = Math.sin(repair * Math.PI);
    goldLight.opacity = .29 + .6 * repair + energy * .51;
    seams.forEach(object => {object.scale.z = 1 + energy * .12;});
    for (const {light,t,delay} of glints) {
      const along = T.MathUtils.clamp((repair-delay)/.77,0,1);
      light.visible = along>0 && along<1;
      if (light.visible) {
        light.position.copy(cross(t, .10+along*2.92,1));
        light.position.z += .049;
        light.material.opacity = .9*Math.sin(along*Math.PI);
      }
    }
    for (const {cog, spot, phase, direction} of gears) {
      const drift = 1 - repair;
      cog.position.set(spot.x - drift * .11 * Math.cos(phase), spot.y + drift * .08 * Math.sin(time + phase), spot.z + drift * .18);
      cog.rotation.z = phase + time * .13 * direction + repair * 2.1 * direction;
    }
    oblique.rotation.z = -.12 + Math.sin(time * .11) * .22;
    satellite.position.set(3.51 * Math.cos(time * .14 + 1.9), 3.17 * Math.sin(time * .14 + 1.9), 0);
    aura.material.opacity = (.44 + .20 * energy) * (1 - daylight * .77);
    ceramic.emissiveIntensity = enamel.emissiveIntensity = .38 + energy * .15 - daylight * .22;
  }
  return {moon, faces, update};
}
