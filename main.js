import * as T from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {environment, materials, glowTexture, group} from './craft.js';
import {buildMoon} from './moon.js';
import {buildShop} from './shop.js';
import {buildStars, sky} from './sky.js';
import {createSound} from './sound.js';

const get = selector => document.querySelector(selector);
const stage = get('#stage');
const status = get('#status');

try {
  start();
} catch (error) {
  status.textContent = 'The workshop needs a browser with WebGL 2 enabled.';
  console.error(error);
}

function start() {
  const quiet = matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new T.WebGLRenderer({antialias:true, powerPreference:'high-performance'});
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.11;
  renderer.setClearColor(0x101324);
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  stage.append(renderer.domElement);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(39, 1, .12, 105);
  const world = group(scene);
  const atmosphere = sky(scene);
  scene.environment = environment(renderer);
  scene.environmentIntensity = .81;

  const ambient = new T.HemisphereLight(0xb4c6ff,0x685066,1.23);
  scene.add(ambient);
  const key = new T.DirectionalLight(0xffd5a9,2.43);
  key.position.set(-5,8,7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-5,right:5,bottom:-5,top:6,near:.5,far:25});
  key.shadow.normalBias = .022;
  key.shadow.bias = -.0004;
  scene.add(key);
  const rim = new T.DirectionalLight(0x95acff,2.16);
  rim.position.set(2,5,-8);
  scene.add(rim);
  const fill = new T.DirectionalLight(0xdcc4e6,.55);
  fill.position.set(7,-1,3);
  scene.add(fill);

  const m = materials();
  const halo = glowTexture();
  const shop = buildShop(world,m,halo);
  const lunar = buildMoon(world,m,halo);
  const collection = buildStars(world,m,halo);
  const sound = createSound();

  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = .085;
  orbit.rotateSpeed = .58;
  orbit.zoomSpeed = .72;
  orbit.panSpeed = .63;
  orbit.minDistance = 3.1;
  orbit.maxDistance = 41;
  orbit.minPolarAngle = .14;
  orbit.maxPolarAngle = Math.PI - .16;
  orbit.mouseButtons = {LEFT:T.MOUSE.ROTATE, MIDDLE:T.MOUSE.DOLLY, RIGHT:T.MOUSE.PAN};
  orbit.touches = {ONE:T.TOUCH.ROTATE, TWO:T.TOUCH.DOLLY_PAN};

  const exhibit = get('.exhibit');
  const light = get('#light');
  const audio = get('#audio');
  const repair = get('#repair');
  const visit = get('#visit');
  const collect = get('#collect');
  const count = get('#count');
  const initialTarget = new T.Vector3(0,1.57,0);
  const initialDirection = new T.Vector3(.30,.17,1).normalize();
  const projected = new T.Vector3();
  const pointer = new T.Vector2();
  const ray = new T.Raycaster();
  const labels = new Map(lunar.faces.map(face => [face, 'moon']));
  labels.set(shop.hitbox,'door');
  for (const star of collection.stars) labels.set(star.target,star);

  let w = 1, h = 1, mobile = false, cameraMotion, inspected = false;
  let day = 0, dayTarget = 0, mendTime = null, mended = false, inventory = 0;
  let elapsed = 0, wheelDistance;
  let previous = performance.now();
  const warmNight = new T.Color(0xffd5a9), warmDay = new T.Color(0xffe4c9);
  let statusTimer;

  function announce(message, duration = 4200) {
    clearTimeout(statusTimer);
    status.textContent = message;
    if (duration) statusTimer = setTimeout(() => {status.textContent = '';},duration);
  }

  function offsetX() {
    return w * (mobile ? (inspected ? 0 : .027) : inspected ? -.12 : -.164);
  }

  function offsetY() {
    return h * (mobile ? (inspected ? -.028 : -.116) : .004);
  }

  function homePosition() {
    const dist = mobile ? Math.max(24, 12.55 / (w/h)) : w/h < 1.25 ? 23 : 18.45;
    return initialDirection.clone().multiplyScalar(dist).add(initialTarget);
  }

  function resize(initial = false) {
    const wasMobile = mobile;
    w = stage.clientWidth;
    h = stage.clientHeight;
    mobile = w <= 700 && h > w;
    renderer.setPixelRatio(Math.min(devicePixelRatio,mobile ? 1.35 : 1.55,Math.sqrt(1950000/(w*h))));
    renderer.setSize(w,h,false);
    atmosphere.aspect.value = w / h;
    if (initial || mobile !== wasMobile) {
      cameraMotion = undefined;
      wheelDistance = undefined;
      inspected = false;
      exhibit.classList.remove('inspecting');
      visit.querySelector('span').textContent = 'Look inside';
      camera.position.copy(homePosition());
      orbit.target.copy(initialTarget);
      orbit.update();
    }
    camera.setViewOffset(w,h,offsetX(),offsetY(),w,h);
  }

  function toCamera(pos,target) {
    wheelDistance = undefined;
    cameraMotion = {
      start: performance.now(), pos, target,
      fromPos: camera.position.clone(), fromTarget: orbit.target.clone(),
      fromX: camera.view.offsetX, fromY: camera.view.offsetY,
    };
  }

  function resetView() {
    inspected = false;
    exhibit.classList.remove('inspecting');
    toCamera(homePosition(),initialTarget);
    visit.querySelector('span').textContent = 'Look inside';
  }

  function inspect() {
    if (inspected) {
      resetView();
      return;
    }
    inspected = true;
    exhibit.classList.add('inspecting');
    const target = shop.lookAt.clone().add(world.position);
    const from = mobile ? new T.Vector3(1.0,.82,5.15) : new T.Vector3(1.27,.70,4.07);
    toCamera(target.clone().add(from),target);
    visit.querySelector('span').textContent = 'Back to orbit';
    announce('The miniature orrery is still turning.');
  }

  function mend() {
    if (mendTime !== null) return;
    mendTime = performance.now();
    repair.disabled = true;
    repair.querySelector('span').textContent = 'Mending the moon…';
    announce('Starlight is finding the cracks.',5100);
  }

  function catchStar(star) {
    if (!collection.catchStar(star,performance.now()/1000)) return;
    inventory++;
    count.value = inventory + ' / ' + collection.stars.length;
    collect.disabled = inventory === collection.stars.length;
    sound.chime('star');
    announce(collect.disabled ? 'Every fallen star has found a home.' : 'A fallen star, safely bottled.');
  }

  function pick(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,1-(event.clientY-bounds.top)/bounds.height*2);
    ray.setFromCamera(pointer,camera);
    const candidates = [...labels].filter(([,target]) => target === 'door' || target === 'moon' || target.started === null);
    const found = ray.intersectObjects(candidates.map(([mesh])=>mesh),false)[0];
    return found ? labels.get(found.object) : undefined;
  }

  const activePointers = new Set();
  let press;
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown',event => {
    activePointers.add(event.pointerId);
    if(activePointers.size === 1 && event.button === 0) press = {x:event.clientX,y:event.clientY,id:event.pointerId,dragged:false};
    else press = undefined;
  });
  canvas.addEventListener('pointermove',event => {
    if(press && Math.hypot(event.clientX-press.x,event.clientY-press.y)>7) press.dragged = true;
    if(event.pointerType === 'mouse' && activePointers.size === 0) canvas.classList.toggle('is-target',Boolean(pick(event)));
  });
  function release(event) {
    activePointers.delete(event.pointerId);
    if (event.type === 'pointerup' && press?.id === event.pointerId && !press.dragged) {
      const action = pick(event);
      if (action === 'moon') mend();
      else if (action === 'door') inspect();
      else if (action) catchStar(action);
    }
    press = undefined;
  }
  canvas.addEventListener('pointerup',release);
  canvas.addEventListener('pointercancel',release);
  canvas.addEventListener('wheel',event => {
    if (!event.deltaY) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cameraMotion = undefined;
    const step = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? h : 1);
    const distance = wheelDistance ?? camera.position.distanceTo(orbit.target);
    wheelDistance = T.MathUtils.clamp(distance*Math.exp(step*.0017),orbit.minDistance,orbit.maxDistance);
  },{capture:true,passive:false});
  orbit.addEventListener('start',() => {
    wheelDistance = undefined;
    if (cameraMotion) {
      cameraMotion = undefined;
      camera.setViewOffset(w,h,offsetX(),offsetY(),w,h);
    }
  });

  repair.addEventListener('click',mend);
  visit.addEventListener('click',inspect);
  collect.addEventListener('click',()=>catchStar(collection.stars.find(star=>star.started===null)));
  get('#reset').addEventListener('click',resetView);
  window.addEventListener('keydown',event => {
    if(event.key === 'Escape') resetView();
  });
  light.addEventListener('click',()=>{
    dayTarget = 1-dayTarget;
    exhibit.classList.toggle('daylight',Boolean(dayTarget));
    light.setAttribute('aria-pressed',String(Boolean(dayTarget)));
    light.querySelector('use').setAttribute('href',dayTarget ? '#sun' : '#crescent');
    light.querySelector('span').textContent = dayTarget ? 'Daylight' : 'Night';
    light.title = dayTarget ? 'Switch to night' : 'Switch to daylight';
    light.setAttribute('aria-label',light.title);
  });
  audio.addEventListener('click',async()=>{
    audio.disabled = true;
    const on = await sound.toggle();
    audio.disabled = false;
    audio.setAttribute('aria-pressed',String(on));
    audio.querySelector('use').setAttribute('href',on ? '#sound' : '#mute');
    audio.title = on ? 'Mute ambient sound' : 'Enable ambient sound';
    audio.setAttribute('aria-label',audio.title);
  });

  function positionLabel() {
    if (inspected) {
      visit.hidden=false;
      visit.style.left = Math.max(22,w-154)+'px';
      visit.style.top = (mobile?h*.71:h*.77)+'px';
      return;
    }
    projected.copy(shop.anchor).applyMatrix4(world.matrixWorld).project(camera);
    const x = (projected.x*.5+.5)*w + (mobile ? 51 : 139);
    const y = (.5-projected.y*.5)*h + (mobile ? 25 : 11);
    const forward = camera.position.z > world.position.z+1.8;
    visit.hidden = !forward || x< (mobile ? 22 : w*.38) || x>w-100 || y<h*.32 || y>h-95;
    if (!visit.hidden) {
      visit.style.left = x+'px';
      visit.style.top = y+'px';
    }
  }

  resize(true);
  new ResizeObserver(()=>resize()).observe(stage);
  repair.disabled = false;
  collect.disabled = false;
  announce('');

  renderer.setAnimationLoop(now=>{
    const dt = Math.min(.048,(now-previous)/1000);
    previous = now;
    if (!quiet.matches) elapsed += Math.max(0,dt);
    day = quiet.matches ? dayTarget : T.MathUtils.damp(day,dayTarget,1.85,dt);
    atmosphere.daylight.value = day;
    atmosphere.time.value = elapsed;
    key.color.copy(warmNight).lerp(warmDay,day);
    key.intensity = 2.43 + day*.95;
    rim.intensity = 2.16 - day*.75;
    ambient.intensity = 1.23+day*.68;
    m.lamp.emissiveIntensity = 2-day*1.30;
    m.ember.emissiveIntensity = .55-day*.37;
    world.position.y = .079*Math.sin(elapsed*.55);
    world.rotation.y = .013*Math.sin(elapsed*.39);

    const phase = mendTime === null ? 0 : T.MathUtils.clamp((now-mendTime)/(quiet.matches ? 220 : 4750),0,1);
    if (phase >= 1 && !mended) {
      mended = true;
      repair.querySelector('span').textContent = 'The moon is mended';
      sound.chime('repair');
      announce('The moon is whole again.');
    }
    lunar.update(elapsed,phase*phase*(3-2*phase),day);
    shop.update(elapsed);
    collection.update(elapsed,now/1000,quiet.matches);

    if (cameraMotion) {
      const p = T.MathUtils.clamp((now-cameraMotion.start)/(quiet.matches?100:1270),0,1);
      const eased = p*p*(3-2*p);
      camera.position.lerpVectors(cameraMotion.fromPos,cameraMotion.pos,eased);
      orbit.target.lerpVectors(cameraMotion.fromTarget,cameraMotion.target,eased);
      camera.setViewOffset(w,h,T.MathUtils.lerp(cameraMotion.fromX,offsetX(),eased),T.MathUtils.lerp(cameraMotion.fromY,offsetY(),eased),w,h);
      if(p>=1) cameraMotion = undefined;
    }
    if (wheelDistance !== undefined) {
      const current = camera.position.distanceTo(orbit.target);
      const distance = quiet.matches ? wheelDistance : T.MathUtils.damp(current,wheelDistance,12,dt);
      camera.position.sub(orbit.target).setLength(distance).add(orbit.target);
      if (Math.abs(distance-wheelDistance)<.001) wheelDistance = undefined;
    }
    orbit.update();
    renderer.render(scene,camera);
    positionLabel();
  });
}

