import * as T from 'three';
import {random, group, mesh, sphere, cylinder, torus, pipe, glow, batch} from './craft.js';

export function sky(scene) {
  const uniforms = {time: {value: 0}, daylight: {value: 0}, aspect: {value: 1}};
  const background = mesh(scene, new T.PlaneGeometry(2, 2), new T.ShaderMaterial({
    uniforms, depthTest: false, depthWrite: false, toneMapped: false,
    vertexShader: /* glsl */`
      varying vec2 uvScreen;
      void main(){ uvScreen=uv; gl_Position=vec4(position.xy,0.99999,1.0); }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 uvScreen;
      uniform float time, daylight, aspect;
      float hash(vec2 v){return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){
        vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
      }
      float fbm(vec2 p){
        float sum=0., amp=.52;
        mat2 twist=mat2(.84,.54,-.54,.84);
        for(int i=0;i<5;i++){sum+=amp*noise(p);p=twist*p*2.04+vec2(14.,5.);amp*=.51;}
        return sum;
      }
      float cloud(vec2 p,float h,float drift){
        vec2 q=vec2(p.x*3.4+drift,(p.y-h)*8.5);
        float waves=fbm(q+vec2(4.,.2));
        float folds=fbm(q*1.75+vec2(waves*1.15,-waves*.89));
        return smoothstep(.23,.60,waves*.50+folds*.55-abs(p.y-h)*1.35);
      }
      void main(){
        vec2 uv=uvScreen;
        vec2 p=vec2(uv.x*min(aspect,2.35),uv.y);
        float warmth=exp(-5.8*length(vec2((uv.x-.68)*aspect*.59,uv.y-.56)));
        vec3 ink=mix(vec3(.055,.062,.126),vec3(.164,.139,.239),uv.y*.20+warmth*.7);
        ink+=warmth*vec3(.075,.035,.048);
        vec3 day=mix(vec3(.44,.39,.52),vec3(.25,.34,.55),uv.y)+warmth*vec3(.25,.15,.09);
        vec3 c=mix(ink,day,daylight);
        float drift=time*.025;
        float back=cloud(p+vec2(0.,.076*sin(p.x*2.7)),.39,drift*.22);
        float fold=cloud(p+vec2(.40,.056*sin(p.x*3.6)),.21,drift*.36+.77);
        float near=cloud(p+vec2(-.82,.056*sin(p.x*2.8)),.055,-drift*.62+2.4);
        float right=.34+.66*smoothstep(.16,.68,uv.x);
        vec3 cloudLight=mix(vec3(.39,.32,.48),vec3(.83,.67,.72),daylight);
        vec3 cloudShadow=mix(vec3(.19,.17,.31),vec3(.57,.49,.62),daylight);
        c=mix(c,mix(cloudShadow,cloudLight,back),back*right*.68);
        c=mix(c,mix(cloudShadow,cloudLight,fold),fold*right*.80);
        c=mix(c,mix(cloudShadow,cloudLight,near),near*(.48+.52*right)*.80);
        vec2 cell=p*230.;
        vec2 starID=floor(cell);
        float id=hash(starID+3.71);
        vec2 spot=vec2(hash(starID+2.3),hash(starID+5.9))*.66+.17;
        float d=length(fract(cell)-spot);
        float stars=step(.986,id)*(1.-smoothstep(.035,.235,d))*(.68+.32*sin(id*107.+time*.8));
        c+=vec3(.83,.84,1.)*stars*(.49-daylight*.40)*(1.-max(back,fold)*.75);
        c*=1.-.32*pow(length((uv-.5)*vec2(1.25,1.02)),1.5);
        c+=(hash(gl_FragCoord.xy)-.5)*.016;
        gl_FragColor=vec4(c,1.);
      }
    `,
  }));
  background.frustumCulled = false;
  background.renderOrder = -100;
  return uniforms;
}

function starGeometry() {
  const shape = new T.Shape();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI/4 * i;
    const r = i%2 ? .24 : i%4 ? 1 : .72;
    if (i === 0) shape.moveTo(r,0);
    else shape.lineTo(r*Math.cos(a),r*Math.sin(a));
  }
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:true,bevelSegments:1,bevelSize:.12,bevelThickness:.13});
  geo.translate(0,0,-.06);
  return geo;
}

function vial(parent,m,halo,x,y,z,size) {
  const bottle = group(parent,x,y,z);
  bottle.scale.setScalar(size);
  const outline = [[0,-.42],[.20,-.42],[.29,-.38],[.315,-.29],[.315,.18],[.291,.24],[.24,.30],[.127,.35],[.12,.53],[.144,.54],[.15,.58],[.111,.58]];
  const lathe = new T.LatheGeometry(outline.map(([r,h])=>new T.Vector2(r,h)),36);
  mesh(bottle,lathe,m.glass);
  cylinder(bottle,m.bronze,0,.59,0,.135,.109);
  cylinder(bottle,m.brass,0,.53,0,.159,.050);
  torus(bottle,m.paleGold,0,-.37,0,.284,.017).rotation.x=Math.PI/2;
  torus(bottle,m.paleGold,0,.49,0,.128,.012).rotation.x=Math.PI/2;
  torus(bottle,m.bronze,0,.666,0,.063,.018);
  const streak = new T.MeshBasicMaterial({color:0xd7dbf7,transparent:true,opacity:.35,depthWrite:false});
  pipe(bottle,streak,[[-.20,-.29,.202],[-.22,-.14,.22],[-.22,.1,.22],[-.19,.20,.209],[-.12,.26,.171]],.012,20);
  const shine = glow(bottle,halo,0xffaa50,.45,1.55,0,-.08,.01);
  return {bottle, shine};
}

export function buildStars(world,m,halo) {
  const rng = random(252);
  const geometry = starGeometry();
  const coords = [[-.14,6.68,-.9],[2.87,5.88,-1.04],[4.05,3.44,-1.20],[-3.45,3.48,-.36],
    [-3.33,1.12,1.29],[3.68,-.42,1.0],[1.85,4.47,.10]];
  const stars = coords.map(([x,y,z],i) => {
    const object = group(world,x,y,z);
    const radius = [.15,.18,.14,.19,.12,.14,.105][i];
    const shape = mesh(object,geometry,m.star);
    shape.scale.setScalar(radius);
    const gleam = glow(object,halo,0xffc77c,.9,radius*10,0,0,0);
    const target = sphere(object,new T.MeshBasicMaterial({visible:false}),0,0,0,.27);
    return {object, shape, gleam, target, origin:object.position.clone(), started:null, from:new T.Vector3()};
  });

  const vessel = vial(world,m,halo,2.96,.58,1.16,.77);
  const smallA = vial(world,m,halo,-3.04,.44,-.44,.43);
  const smallB = vial(world,m,halo,3.28,1.55,-1.86,.37);
  const specks = new T.InstancedMesh(new T.IcosahedronGeometry(1,0),m.star,63);
  specks.count=0;
  specks.frustumCulled=false;
  vessel.bottle.add(specks);
  const dummy = new T.Object3D();
  const destination = new T.Vector3();
  const inverse = new T.Matrix4();
  let collected = 0;

  const motes = new T.InstancedMesh(new T.IcosahedronGeometry(1,0),m.star,82);
  motes.frustumCulled = false;
  world.add(motes);
  const motesData = Array.from({length:motes.count},()=>[
    (rng()-.5)*11,(rng()-.39)*9,(rng()-.5)*6,.007+rng()**4*.024,rng()*Math.PI*2,
  ]);
  const gravel=group(world);
  const gravelGeo=new T.IcosahedronGeometry(1,0);
  const debris=[
    [-3.58,-1.77,.49,.21],[-3.02,-2.18,1.40,.13],[3.59,-1.34,.12,.17],[3.41,-2.05,.91,.28],
    [-2.70,-2.96,-.7,.11],[1.93,-3.03,1.54,.17],[3.24,-1.91,-1.42,.115],
  ];
  for(const [x,y,z,s] of debris) {
    const object = mesh(gravel,gravelGeo,m.soil,x,y,z);
    object.scale.set(s,s*1.3,s*.9);
    object.rotation.set(rng()*3,rng()*3,rng()*3);
  }
  batch(gravel);

  const comet = group(world);
  for(let i=0;i<14;i++) {
    const mote = sphere(comet,m.star,-i*.060, i*.032,-i*.020,.037*(1-i/15));
    mote.material=m.star;
  }
  batch(comet);
  glow(comet,halo,0xffc98d,.75,.63,0,0,0);

  function catchStar(star,time) {
    if (!star || star.started !== null) return false;
    star.started = time;
    star.from.copy(star.object.position);
    return true;
  }

  function update(time,interactionTime,quiet) {
    vessel.bottle.position.y=.58+Math.sin(time*.61)*.105;
    vessel.bottle.rotation.set(.12,.18+time*.16,-.20 + Math.sin(time*.75)*.12);
    smallA.bottle.rotation.set(.11,time*.23,.24+Math.cos(time*.43)*.19);
    smallA.bottle.position.y=.44+Math.sin(time*.70+2)*.19;
    smallB.bottle.rotation.set(.25,time*.18,-.45+Math.sin(time*.39)*.11);
    smallB.bottle.position.y=1.55+Math.cos(time*.62)*.13;
    world.updateWorldMatrix(true,false);
    inverse.copy(world.matrixWorld).invert();
    vessel.bottle.getWorldPosition(destination).applyMatrix4(inverse);
    collected=0;
    for (const [i,star] of stars.entries()) {
      star.shape.rotation.set(.12 + Math.sin(time*.54+i)*.23, .37 + Math.sin(time*.51+i)*.47, time*.17+i);
      if(star.started === null) {
        star.object.position.copy(star.origin);
        star.object.position.y+=Math.sin(time*.63+i*1.6)*.16;
        star.object.position.x+=Math.sin(time*.41+i)*.07;
        star.gleam.material.opacity=.72+Math.sin(time*.88+i)*.17;
        continue;
      }
      const p = T.MathUtils.clamp((interactionTime-star.started)/(quiet ? .16 : 1.55),0,1);
      const smooth = p*p*(3-2*p);
      star.object.position.lerpVectors(star.from,destination,smooth);
      star.object.position.y += Math.sin(p*Math.PI)*.71;
      star.object.position.z += Math.sin(p*Math.PI)*.55;
      star.object.scale.setScalar(1-.79*smooth);
      star.object.visible=p<1;
      if(p>=1) collected++;
    }
    specks.count=collected*9;
    for(let i=0;i<specks.count;i++) {
      const a=i*2.39996+time*(.5+(i%7)*.18), r=.05+(i%8)*.023;
      dummy.position.set(Math.cos(a)*r, -.24+(i%9)*.048+Math.sin(time*.8+i)*.048, Math.sin(a)*r);
      dummy.scale.setScalar(.012+(i%3)*.004);
      dummy.updateMatrix(); specks.setMatrixAt(i,dummy.matrix);
    }
    if(specks.count) specks.instanceMatrix.needsUpdate=true;
    vessel.shine.material.opacity=.2+collected*.105;
    for(const [i,[x,y,z,s,a]] of motesData.entries()) {
      dummy.position.set(x+Math.sin(time*.19+a)*.19,y+Math.cos(time*.27+a)*.17,z);
      dummy.scale.setScalar(s*(.62+.38*Math.sin(a+time*.62)));
      dummy.updateMatrix(); motes.setMatrixAt(i,dummy.matrix);
    }
    motes.instanceMatrix.needsUpdate=true;
    const progress=(time%31)/3.3;
    comet.visible=!quiet && progress<1 && time>5;
    if(comet.visible) {
      comet.position.set(-5.2+progress*9,6.85-progress*4.4,-4.4);
      comet.scale.setScalar(Math.sin(progress*Math.PI)*1.04);
    }
  }
  return {stars, update, catchStar};
}
