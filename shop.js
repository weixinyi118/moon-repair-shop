import * as T from 'three';
import {random, paint, group, mesh, box, sphere, cylinder, torus, pipe, gear, glow, batch} from './craft.js';

function arch(path, x, bottom, width, top) {
  const r = width / 2;
  path.moveTo(x - r, bottom);
  path.lineTo(x + r, bottom);
  path.lineTo(x + r, top - r);
  path.absarc(x, top - r, r, 0, Math.PI, false);
  path.lineTo(x - r, bottom);
  return path;
}

function archBorder(parent, m, x, bottom, width, top, z, gauge) {
  const r = width / 2;
  const points = [[x-r,bottom,z],[x-r,top-r,z]];
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI * (1 - i / 24);
    points.push([x + r * Math.cos(a), top - r + r * Math.sin(a), z]);
  }
  points.push([x+r,bottom,z]);
  pipe(parent, m, points, gauge, 46);
}

function archPane(parent, m, x, bottom, width, top, z) {
  return mesh(parent, new T.ShapeGeometry(arch(new T.Shape(), x, bottom, width, top), 26), m, 0, 0, z);
}

function insignia(label, sub) {
  return new T.MeshStandardMaterial({color: 0xffecd1, roughness: .83, emissive: 0xe5a454, emissiveIntensity: .035,
    map: paint(512, (ctx, size) => {
      ctx.scale(1,size/61);
      ctx.fillStyle = '#292934'; ctx.fillRect(0,0,size,61);
      ctx.strokeStyle = '#d6a665'; ctx.lineWidth = 1.1; ctx.strokeRect(5,4,502,53);
      ctx.textAlign = 'center'; ctx.fillStyle = '#f6d9a8';
      ctx.font = '26px Georgia'; ctx.fillText(label,256,31,460);
      if (sub) {
        ctx.font = '10px Georgia';
        ctx.fillText(sub,256,47,455);
      }
    })});
}

export function armillary(parent, m, x, y, z, r, halo, horizontal = true) {
  const object = group(parent, x, y, z);
  const pedestal = group(object);
  cylinder(pedestal, m.bronze, 0, -r*.89, 0, r * .46, r*.12);
  cylinder(pedestal, m.brass, 0, -r*.66, 0, r * .18, r*.46);
  const frame = torus(object, m.paleGold, 0, 0, 0, r, r*.044);
  frame.rotation.y = -.29;
  const rings = group(object);
  torus(rings, m.bronze, 0, 0, 0, r*.81, r*.041).rotation.x = 1.09;
  const circle = torus(rings, m.brass, 0, 0, 0, r*.64, r*.037);
  circle.rotation.set(.51, 1.02, 0);
  torus(rings, m.paleGold, 0, 0, 0, r*.43, r*.025).rotation.y = .9;
  const bead = sphere(rings, m.star, 0, 0, 0, r*.18);
  const pointer = group(rings);
  sphere(pointer, m.ember, r*.72, 0, 0, r*.093);
  sphere(pointer, m.cream, -r*.60, 0, 0, r*.068);
  glow(object, halo, 0xffa352, .56, r*2.75, 0, 0, 0);
  const ticks = group(object);
  for (let i=0;i<36;i++) {
    const a = i*Math.PI/18;
    const tick = box(ticks, m.paleGold, Math.cos(a)*r*.95, Math.sin(a)*r*.95, .01, r*.063, r*.012, r*.025);
    tick.rotation.z = a;
  }
  batch(ticks);
  return time => {
    rings.rotation.y = time * (horizontal ? .26 : .37);
    rings.rotation.z = Math.sin(time * .31) * .48;
    pointer.rotation.z = time * .47;
    bead.scale.setScalar(r*.18 * (1 + .06*Math.sin(time*1.4)));
  };
}

function island(parent, m) {
  const rng = random(46);
  const rock = group(parent, 0, -1.44, 0);
  const count = 37;
  const rings = [[0,1,0,0],[-.31,1.005,.04,0],[-.70,.83,-.09,-.02],[-1.36,.58,.15,.12],[-1.94,.27,.42,-.09],[-2.3,.04,.31,.02]];
  const edge = Array.from({length: count}, (_, i) => .96 + .11 * Math.sin(i * 1.92) + rng()*.15);
  const contours = rings.map(([y,r,dx,dz], j) => edge.map((factor,i) => {
    const a = i * Math.PI*2 / count + .09 * Math.sin(i*4+j*2);
    return [dx + Math.cos(a)*r*3.35*factor, y + (j ? (rng()-.5)*.38 : (rng()-.5)*.075),
      dz + Math.sin(a)*r*2.27*factor];
  }));
  const points = [], colors = [];
  const palettes = [0x545264,0x6a606b,0x3f4257,0x383747,0x282a40,0x514551].map(color => new T.Color(color));
  function triangle(a,b,c,shade) {
    const color = palettes[shade].clone().multiplyScalar(.66 + rng()*.59);
    for (const p of [a,b,c]) {
      points.push(...p);
      colors.push(color.r,color.g,color.b);
    }
  }
  for (let i=0;i<count;i++) {
    const k=(i+1)%count;
    triangle([0,.06,0],contours[0][k],contours[0][i],rng() < .85 ? 0 : 1);
    for (let j=0;j<contours.length-1;j++) {
      triangle(contours[j][i],contours[j][k],contours[j+1][i],j === 1 && i%3 ? 5 : j+1);
      triangle(contours[j][k],contours[j+1][k],contours[j+1][i],j+1);
    }
    triangle(contours[5][i], contours[5][k], [.32,-2.42,0], 4);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(points,3));
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  mesh(rock, geo, new T.MeshStandardMaterial({vertexColors:true, roughness:1, side:T.DoubleSide}));
  const outcrops = new T.IcosahedronGeometry(1, 0);
  const grit = group(rock);
  for (let i=0;i<125;i++) {
    const a = rng()*Math.PI*2, r=.73+rng()*.25, s=.035+rng()**2*.17;
    const pebble=mesh(grit,outcrops,i%3?m.soil:m.stone,Math.cos(a)*3.26*r,-.10-rng()*.27,Math.sin(a)*2.24*r);
    pebble.scale.set(s*1.45,s*(.65+rng()),s);
    pebble.rotation.set(rng()*3,rng()*3,rng()*3);
  }
  for (let i=0;i<11;i++) {
    const a = 1.15+i*.074;
    const vein = pipe(grit,m.bronze,[[Math.cos(a)*3.30,-.39,Math.sin(a)*2.25],[Math.cos(a)*3.14,-.59,Math.sin(a)*2.14],[Math.cos(a+.05)*2.73,-.79,Math.sin(a+.05)*1.87]],.009,12);
    vein.rotation.y = .005*i;
  }
  batch(grit);
}

function wall(parent,m) {
  const front = new T.Shape();
  front.moveTo(-1.67,0); front.lineTo(1.67,0); front.lineTo(1.67,2.16); front.lineTo(-1.67,2.16); front.closePath();
  front.holes.push(arch(new T.Path(),-.80,.61,1.00,1.86), arch(new T.Path(),.63,.10,.82,1.78));
  const frontWall = mesh(parent,new T.ExtrudeGeometry(front,{depth:.15,bevelEnabled:true,bevelSize:.023,bevelThickness:.018,bevelSegments:2,curveSegments:28}),m.cream,0,0,1.02);
  frontWall.material.side = T.DoubleSide;
  box(parent,m.cream,0,1.10,-1.06,3.34,2.2,.17);
  box(parent,m.cream,-1.58,1.10,0,.18,2.2,2.15);
  box(parent,m.cream,1.58,1.10,0,.18,2.2,2.15);
  box(parent,m.planks[1],0,.08,0,3.26,.13,2.12);
  for (const x of [-1.56,1.56]) {
    for (const z of [-1.04,1.11]) {
      box(parent,m.ivory,x,1.11,z,.15,2.18,.16);
      for (let i=0;i<8;i++) box(parent,m.stone,x, .25 + i*.23, z+.055,.18+(i%2)*.065,.055,.09);
    }
  }
  for (const y of [.12,.25,2.08,2.18]) {
    box(parent,y>.4?m.ivory:m.stone,0,y,-1.10,3.44,.073,.16);
    box(parent,y>.4?m.ivory:m.stone,0,y,1.17,3.44,.073,.15);
    for(const x of [-1.66,1.66]) box(parent,y>.4?m.ivory:m.stone,x,y,0,.125,.073,2.25);
  }
}

function roof(parent,m,rng) {
  for (const side of [-1,1]) {
    for (let j=0;j<9;j++) {
      const z=side*(.10+j*.144);
      const y=3.08-.25*Math.abs(z)-.37*Math.abs(z)**1.75;
      const slope=side*(.25+.65*Math.abs(z)**.75);
      for(let i=0;i<16;i++) {
        const x=-1.83 + (i+.48+(j%2)*.30)*.23;
        const tile = box(parent,m.slate[Math.floor(rng()*m.slate.length)],x,y + rng()*.018,z,.232,.056,.188);
        tile.rotation.x=slope;
      }
    }
    const edge = Array.from({length:9},(_,j) => {
      const z=.02 + j*.162;
      return [1.81,3.10-.25*z-.37*z**1.75,side*z];
    });
    for(const x of [-1.85,1.85]) pipe(parent,m.bronze,edge.map(([,y,z])=>[x,y,z]),.039,28);
    box(parent,m.wood,0,2.23,side*1.29,3.78,.12,.13);
    pipe(parent,m.brass,[[-1.89,2.24,side*1.34],[0,2.21,side*1.34],[1.88,2.23,side*1.34]],.028,24);
  }
  for (const x of [-1.67,1.67]) {
    const gable = new T.Shape();
    gable.moveTo(-1.21,2.16);
    for(let i=0;i<=22;i++) {
      const z=i/11*1.21-1.21;
      gable.lineTo(z,3.05-.25*Math.abs(z)-.37*Math.abs(z)**1.75);
    }
    gable.lineTo(1.21,2.16);
    gable.closePath();
    mesh(parent,new T.ShapeGeometry(gable),m.cream,x,0,0).rotation.y=Math.PI/2;
  }
  pipe(parent,m.paleGold,[[-1.88,3.11,0],[0,3.13,0],[1.89,3.11,0]],.037,25);
  for(const x of [-1.88,1.89]) {
    sphere(parent,m.paleGold,x,3.16,0,.074,.098,.074);
    cylinder(parent,m.bronze,x,3.29,0,.019,.19);
  }
  box(parent,m.stone,-1.17,3.16,-.56,.42,.84,.39);
  for(let i=0;i<4;i++) box(parent,m.cream,-1.17,2.86+i*.15,-.37,.43,.025,.022);
  box(parent,m.wood,-1.17,3.53,-.56,.52,.12,.50);
  cylinder(parent,m.bronze,-1.17,3.62,-.56,.13,.11);
  pipe(parent,m.bronze,[[1.82,2.24,1.31],[1.91,2.05,1.20],[1.77,1.92,1.06],[1.77,.38,1.06],[1.98,.23,1.06]],.054,40);
  for(const y of [.49,.91,1.35,1.77]) cylinder(parent,m.paleGold,1.77,y,1.06,.071,.041);
}

function lantern(parent,m,halo,x,y,z) {
  const lamp = group(parent,x,y,z);
  const size = .11;
  cylinder(lamp,m.bronze,0,.135,0,.127,.045);
  cylinder(lamp,m.bronze,0,-.138,0,.10,.04);
  cylinder(lamp,m.lamp,0,0,0,.073,.23);
  cylinder(lamp,m.paleGold,0,.18,0,.064,.042);
  for(let i=0;i<4;i++) box(lamp,m.brass,(i<2?-1:1)*size*.65,0,(i%2?-1:1)*size*.65,.018,.26,.018);
  glow(lamp,halo,0xffa249,.86,1.53,0,0,.015);
  pipe(lamp,m.bronze,[[0,.15,0],[0,.29,0],[0,.31,-.20],[0,.20,-.27]],.023,14);
}

export function buildShop(world,m,halo) {
  island(world,m);
  const rng=random(387);
  const fixed=group(world);
  const house=group(fixed,-.56,-1.36,.38);
  const front=1.196;
  wall(house,m);
  roof(house,m,rng);
  box(house,m.stone,0,.045,0,3.52,.12,2.36);
  const sign=mesh(house,new T.PlaneGeometry(2.38,.245),insignia('MOON REPAIR SHOP','FINE CELESTIAL MECHANISMS'),-.12,2.047,front+.095);
  box(house,m.wood,sign.position.x,sign.position.y,front+.058,2.44,.268,.064);
  for(const x of [-1.30,1.06]) sphere(house,m.paleGold,x,2.047,front+.107,.027);
  archBorder(house,m.bronze,-.80,.60,1.10,1.92,front,.057);
  archBorder(house,m.paleGold,-.80,.64,.99,1.855,front+.035,.028);
  archBorder(house,m.bronze,.63,.13,.91,1.83,front,.052);
  archBorder(house,m.paleGold,.63,.13,.82,1.78,front+.037,.029);
  box(house,m.ivory,-.80,.59,front+.09,1.17,.078,.25);
  archPane(house,m.pane,-.80,.63,1.0,1.86,front+.013);
  archPane(house,m.ember,-.80,.62,1.04,1.86,.24);
  box(house,m.wood,-.8,.68,.64,.99,.085,.76);
  box(house,m.brass,-.80,1.005,front+.045,1.00,.035,.037);
  box(house,m.brass,-.80,1.68,front+.043,.79,.023,.034);
  for(const x of [-1.23,-.38]) box(house,m.paleGold,x,1.15,front+.044,.024,1.03,.037);
  const door = archPane(house,m.teal,.63,.136,.78,1.745,front-.062);
  archPane(house,m.ember,.63,1.014,.57,1.638,front-.037);
  archPane(house,m.pane,.63,1.016,.57,1.638,front-.009);
  for(const x of [.42,.63,.84]) {
    box(house,m.brass,x,1.27,front+.017,.019,x===.63?.69:.57,.033);
    box(house,m.bronze,x,.52,front-.03,.105,.49,.027);
  }
  box(house,m.paleGold,.63,1.27,front+.022,.56,.022,.026);
  sphere(house,m.paleGold,.87,.82,front+.04,.054,.054,.031);
  for(let i=0;i<3;i++) box(house,m.stone,.63,.035-i*.044,front+.14+i*.12,1.01+i*.08,.091,.30);
  const sideWindow=group(house,1.69,0,-.34);
  sideWindow.rotation.y=Math.PI/2;
  archPane(sideWindow,m.ember,0,.77,.67,1.79,.013);
  archPane(sideWindow,m.pane,0,.77,.67,1.79,.038);
  archBorder(sideWindow,m.paleGold,0,.76,.70,1.82,.039,.038);
  box(sideWindow,m.brass,0,1.19,.052,.67,.026,.039);
  box(sideWindow,m.brass,0,1.23,.058,.03,.93,.042);
  box(sideWindow,m.ivory,0,.74,.075,.79,.063,.19);
  const dormer=group(house,-.50,2.23,.77);
  box(dormer,m.cream,0,.27,0,.69,.61,.55);
  archPane(dormer,m.ember,0,.12,.43,.65,.29);
  archBorder(dormer,m.brass,0,.10,.49,.69,.31,.036);
  box(dormer,m.brass,0,.31,.32,.44,.026,.04);
  box(dormer,m.brass,0,.35,.32,.023,.47,.042);
  for (const side of [-1,1]) {
    const cap=box(dormer,m.teal,side*.20,.64,.065,.48,.105,.71);
    cap.rotation.z=-side*.62;
  }
  sphere(dormer,m.paleGold,0,.87,.32,.042);
  lantern(house,m,halo,.0,1.34,1.47);
  lantern(house,m,halo,1.36,1.43,1.45);
  const warm=new T.PointLight(0xff9950,5.8,4.2,2);
  warm.position.set(.11,1.40,1.65);
  house.add(warm);

  const floor=group(fixed,0,-1.39,0);
  for(let row=0;row<4;row++) for(let i=0;i<13;i++) {
    const x=-2.58+i*.36+(row%2)*.13, z=1.35+row*.247;
    if((x/3.10)**2+(z/2.36)**2 > 1.06) continue;
    const paver=box(floor,m.pavers[(i+row*3)%4],x,-.015+rng()*.043,z,.331,.062,.226);
    paver.rotation.y=(rng()-.5)*.13;
  }
  const paving=group(floor,1.86,0,.31);
  cylinder(paving,m.stone,0,.03,0,.83,.13);
  cylinder(paving,m.teal,0,.10,0,.71,.09);
  const dial=torus(paving,m.brass,0,.15,0,.62,.021);
  dial.rotation.x=Math.PI/2;
  for(let i=0;i<16;i++) {
    const a=i*Math.PI/8;
    const post=box(paving,m.brass,Math.cos(a)*.56,.15,Math.sin(a)*.56,.076,.02,.021);
    post.rotation.y=-a;
  }
  const railing=[[-2.86,1.0],[-2.65,1.33],[-2.43,1.59],[-2.13,1.79],[-1.78,1.98],[-1.40,2.07],[-1.01,2.13]];
  for (const [x,z] of railing) {
    cylinder(floor,m.bronze,x,.25,z,.021,.51);
    sphere(floor,m.paleGold,x,.51,z,.045);
  }
  for (const y of [.32,.47]) pipe(floor,m.bronze,railing.map(([x,z])=>[x,y,z]),.018,25);

  const cabinet=group(fixed,-2.52,-1.25,-.06);
  cabinet.rotation.y=.21;
  box(cabinet,m.wood,0,.52,0,.62,1.02,.52);
  box(cabinet,m.brass,0,1.05,0,.69,.05,.58);
  for(let i=0;i<4;i++) {
    const y=.18+i*.23;
    box(cabinet,m.teal,0,y,.27,.52,.17,.065);
    box(cabinet,m.glass,0,y,.32,.43,.12,.045);
    for(let j=0;j<4;j++) sphere(cabinet,m.star,-.16+j*.103,y + (rng()-.5)*.061,.34,.018+rng()*.012);
    box(cabinet,m.paleGold,0,y-.058,.362,.14,.019,.043);
  }
  const turret=group(fixed,.98,.53,-.70);
  cylinder(turret,m.cream,0,.31,0,.53,1.36);
  cylinder(turret,m.stone,0,-.27,0,.575,.09);
  for(let i=0;i<6;i++) {
    const a=i*Math.PI/3;
    const pane=group(turret,Math.sin(a)*.515,0,Math.cos(a)*.515);
    pane.rotation.y=a;
    archPane(pane,m.ember,0,.09,.26,.68,.008);
    archBorder(pane,m.brass,0,.09,.28,.69,.035,.025);
  }
  cylinder(turret,m.bronze,0,.98,0,.62,.13);
  const dome = mesh(turret,new T.SphereGeometry(.59,32,16,0,Math.PI*2,0,Math.PI/2),m.jade,0,1.02,0);
  dome.scale.y=1.24;
  for(let i=0;i<10;i++) {
    const a=i*Math.PI/5;
    const ribs=Array.from({length:15},(_,j) => {
      const k=j/14*Math.PI/2;
      return [Math.cos(a)*.596*Math.cos(k),1.02+.738*Math.sin(k),Math.sin(a)*.596*Math.cos(k)];
    });
    pipe(turret,m.bronze,ribs,.014,20);
  }
  sphere(turret,m.paleGold,0,1.81,0,.10,.115,.10);
  cylinder(turret,m.paleGold,0,1.96,0,.022,.24);

  // Keep these two instruments out of the static instance batches.
  const outside=armillary(world,m,1.86,-.52,.31,.69,halo);
  const inside=armillary(world,m,-1.36,-.095,1.45,.325,halo,false);
  const benchGear=gear(world,m,.143,12,-1.67,-.35,1.43);
  const secondGear=gear(world,m,.115,10,-1.05,-.46,1.40);
  glow(world,halo,0xffa05a,.56,1.32,-1.36,-.04,1.60);
  batch(fixed);
  fixed.traverse(object => {
    if (object.isMesh && !object.material.transparent) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  const hitbox=box(world,new T.MeshBasicMaterial({visible:false}),.07,-.39,1.62,.91,1.68,.20);
  const anchor=new T.Vector3(.54,-.31,1.77);
  return {
    hitbox, anchor, lookAt:new T.Vector3(-1.18,-.095,1.54),
    update(time) {
      outside(time);
      inside(time);
      benchGear.rotation.z=time*.57;
      secondGear.rotation.z=-time*.74;
      warm.intensity=5.8 + .32*Math.sin(time*1.23)+.14*Math.sin(time*3.1);
    },
  };
}
