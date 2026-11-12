import * as T from 'three';

export function random(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function paint(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

const block = new T.BoxGeometry();
const ball = new T.SphereGeometry(1, 20, 12);
const rod = new T.CylinderGeometry(1, 1, 1, 16);
const rings = new Map();

export function group(parent, x = 0, y = 0, z = 0) {
  const object = new T.Group();
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

export function mesh(parent, geometry, material, x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

export function box(parent, material, x, y, z, width, height, depth) {
  const object = mesh(parent, block, material, x, y, z);
  object.scale.set(width, height, depth);
  return object;
}

export function sphere(parent, material, x, y, z, rx, ry = rx, rz = rx) {
  const object = mesh(parent, ball, material, x, y, z);
  object.scale.set(rx, ry, rz);
  return object;
}

export function cylinder(parent, material, x, y, z, radius, height) {
  const object = mesh(parent, rod, material, x, y, z);
  object.scale.set(radius, height, radius);
  return object;
}

export function torus(parent, material, x, y, z, radius, tube) {
  const key = radius + '/' + tube;
  if (!rings.has(key)) rings.set(key, new T.TorusGeometry(radius, tube, 8, 64));
  return mesh(parent, rings.get(key), material, x, y, z);
}

export function pipe(parent, material, points, radius = .025, segments = 36) {
  const path = new T.CatmullRomCurve3(points.map(point => new T.Vector3(...point)));
  return mesh(parent, new T.TubeGeometry(path, segments, radius, 7, false), material);
}

export function batch(group) {
  // Leave animated pieces outside this group. Repeated static geometry becomes one draw call per material.
  const buckets = new Map();
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  group.traverse(object => {
    if (!object.isMesh || object.material.transparent || object.material.transmission > 0) return;
    const key = object.geometry.uuid + ':' + object.material.uuid;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(object);
  });
  for (const objects of buckets.values()) {
    if (objects.length < 3) continue;
    const first = objects[0];
    const instances = new T.InstancedMesh(first.geometry, first.material, objects.length);
    objects.forEach((object, index) => {
      instances.setMatrixAt(index, new T.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      object.removeFromParent();
    });
    group.add(instances);
  }
}

export function gear(parent, materials, radius, teeth, x = 0, y = 0, z = 0) {
  const object = group(parent, x, y, z);
  const shape = new T.Shape();
  const hole = new T.Path();
  const inner = radius * .8;
  for (let i = 0; i < teeth * 4; i++) {
    const a = i / (teeth * 4) * Math.PI * 2;
    const r = i % 4 === 1 || i % 4 === 2 ? radius : radius * .9;
    if (i === 0) shape.moveTo(r * Math.cos(a), r * Math.sin(a));
    else shape.lineTo(r * Math.cos(a), r * Math.sin(a));
  }
  shape.closePath();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  mesh(object, new T.ExtrudeGeometry(shape, {depth: radius * .13, bevelEnabled: true, bevelSize: .009, bevelThickness: .009, bevelSegments: 1, curveSegments: 32}), materials.brass);
  torus(object, materials.paleGold, 0, 0, radius * .15, inner, radius * .028);
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * .4;
    const spoke = box(object, materials.bronze, Math.cos(a) * radius * .44, Math.sin(a) * radius * .44, 0, radius * .79, radius * .105, radius * .10);
    spoke.rotation.z = a;
  }
  sphere(object, materials.paleGold, 0, 0, radius * .09, radius * .22, radius * .22, radius * .14);
  return object;
}

export function materials() {
  const standard = (color, roughness = .67, metalness = 0, extra = {}) => new T.MeshStandardMaterial({color, roughness, metalness, ...extra});
  const brass = (color, metalness = .8, roughness = .32) => standard(color, roughness, metalness);
  const grain = paint(128, (ctx, size) => {
    const rng = random(5);
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const grey = 180 + rng() * 75;
      img.data.set([grey, grey, grey, 255], i);
    }
    ctx.putImageData(img, 0, 0);
  });
  grain.colorSpace = T.NoColorSpace;
  grain.wrapS = grain.wrapT = T.RepeatWrapping;
  return {
    cream: standard(0xe7cdb3, .82, 0, {bumpMap: grain, bumpScale: .045}),
    ivory: standard(0xffe2b9, .59),
    stone: standard(0x9d8179, .93, 0, {bumpMap: grain, bumpScale: .06}),
    pavers: [standard(0xa08b86), standard(0x9a8a90), standard(0xb29c8f), standard(0x786f7e)],
    soil: standard(0x535163, 1),
    dark: standard(0x292533, .71),
    wood: standard(0x613a30, .72),
    planks: [standard(0x48333b), standard(0x603d3b), standard(0x6c4940)],
    teal: standard(0x263f4f, .56, .2),
    slate: [0x2b414f,0x334957,0x3c5161,0x354653,0x435768].map(color => standard(color, .63, .25, {bumpMap: grain, bumpScale: .023})),
    brass: brass(0xc79a58),
    paleGold: brass(0xffd891, .66, .28),
    bronze: brass(0x9a613c, .68, .48),
    jade: brass(0x527171, .48, .42),
    blackened: brass(0x4d4150, .55, .58),
    lamp: standard(0xffbe75, .31, 0, {emissive: 0xff9c36, emissiveIntensity: 2.0}),
    ember: standard(0xa84c22, .51, .2, {emissive: 0xf8791d, emissiveIntensity: .44}),
    star: standard(0xffd29a, .26, .29, {emissive: 0xffa84c, emissiveIntensity: 1.65}),
    glass: new T.MeshPhysicalMaterial({color: 0xc3e7ff, transparent: true, opacity: .23, roughness: .18, metalness: .13, clearcoat: 1, side: T.FrontSide, depthWrite: false}),
    pane: new T.MeshPhysicalMaterial({color: 0xffdfab, transparent: true, opacity: .12, roughness: .22, metalness: .1, side: T.DoubleSide, depthWrite: false}),
  };
}

export function glowTexture() {
  return paint(128, (ctx, size) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, '#fff'); g.addColorStop(.09, '#fff9'); g.addColorStop(.28, '#fff3');
    g.addColorStop(.6, '#fff1'); g.addColorStop(1, '#fff0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  });
}

export function glow(parent, texture, color, opacity, size, x, y, z) {
  const object = new T.Sprite(new T.SpriteMaterial({map: texture, color, opacity, transparent: true, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false}));
  object.position.set(x, y, z);
  object.scale.setScalar(size);
  parent.add(object);
  return object;
}

export function environment(renderer) {
  const room = new T.Scene();
  room.background = new T.Color(0x484254);
  const panel = new T.PlaneGeometry(1, 1);
  const lamps = [
    [0xffe3bb, 4.5, [-3, 5, 4], [6, 4, 1]],
    [0xb2c2ff, 3.5, [4, 3, -4], [4, 6, 1]],
    [0xfcb866, 3, [2, 1, 5], [1, 3, 1]],
  ];
  for (const [color, brightness, pos, scale] of lamps) {
    const material = new T.MeshBasicMaterial({color: new T.Color(color).multiplyScalar(brightness), side: T.DoubleSide, toneMapped: false});
    const light = mesh(room, panel, material, ...pos);
    light.scale.set(...scale);
    light.lookAt(0, 0, 0);
  }
  const generator = new T.PMREMGenerator(renderer);
  const env = generator.fromScene(room, .04, .1, 50);
  generator.dispose();
  panel.dispose();
  room.traverse(object => object.material?.dispose());
  return env.texture;
}
