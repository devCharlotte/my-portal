import * as THREE from "three";

const ROAD_W = 20;
const HALF = ROAD_W / 2;
const LANE = ROAD_W / 3;
const ROWS = 180;
const VIEW = 680;
const NEAR = 56;
const ROW_LEN = VIEW / ROWS;
const MAXS = 36;            // world units/sec, kmh ~= speed * 3
const BASE_LIMIT = 50;
const SIGNAL_CYCLE = 14;    // green 7s, yellow 2s, red 5s

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function makeTextTexture(text, opts = {}) {
  const cv = document.createElement("canvas");
  cv.width = opts.w || 256;
  cv.height = opts.h || 128;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = opts.bg || "rgba(255,255,255,0)";
  if (opts.bg) ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = opts.font || "900 72px Segoe UI, system-ui, sans-serif";
  ctx.fillStyle = opts.color || "#ffffff";
  ctx.fillText(text, cv.width / 2, cv.height / 2 + (opts.dy || 0));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeCar(bodyColor, lightColor = 0xffffff) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 0.62, 4.15),
    new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.58, roughness: 0.28 })
  );
  body.position.y = 0.62; body.castShadow = true; g.add(body);

  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(1.85, 0.18, 1.25),
    new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.4, roughness: 0.18, transparent: true, opacity: 0.08 })
  );
  hood.position.set(0, 0.98, 1.15); g.add(hood);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.62, 1.65),
    new THREE.MeshStandardMaterial({ color: 0x07101e, metalness: 0.35, roughness: 0.18 })
  );
  cabin.position.set(0, 1.08, -0.28); cabin.castShadow = true; g.add(cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.43, 0.43, 0.38, 18);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.68 });
  const wheels = [];
  for (const [x, z] of [[-1.06, 1.35], [1.06, 1.35], [-1.06, -1.35], [1.06, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.43, z);
    w.castShadow = true;
    g.add(w); wheels.push(w);
  }

  for (const x of [-0.68, 0.68]) {
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.12, 0.12),
      new THREE.MeshBasicMaterial({ color: lightColor })
    );
    head.position.set(x, 0.68, 2.15); g.add(head);
  }
  const glow = new THREE.PointLight(lightColor, 1.2, 9);
  glow.position.set(0, 0.7, 2.35); g.add(glow);
  g.userData.wheels = wheels;
  return g;
}

function makeHazard(type) {
  const g = new THREE.Group();
  if (type === "barrier") {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 0.86, 0.45),
      new THREE.MeshStandardMaterial({ color: 0xffb000, metalness: 0.25, roughness: 0.48 })
    );
    bar.position.y = 0.82; bar.castShadow = true; g.add(bar);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(3.54, 0.24, 0.47),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    band.position.y = 0.82; g.add(band);
    for (const x of [-1.5, 1.5]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.82, 0.18), new THREE.MeshStandardMaterial({ color: 0x88909a }));
      leg.position.set(x, 0.41, 0); g.add(leg);
    }
    g.userData.half = 1.8;
  } else {
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.35, 18),
      new THREE.MeshStandardMaterial({ color: 0xff6a00, emissive: 0xff3a00, emissiveIntensity: 0.18, roughness: 0.52 })
    );
    cone.position.y = 0.72; cone.castShadow = true; g.add(cone);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.46, 0.06, 18), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    stripe.position.y = 0.7; g.add(stripe);
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.12, 1.05), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    base.position.y = 0.06; g.add(base);
    g.userData.half = 0.85;
  }
  return g;
}

function makeSpeedLimitSign(limit) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 12), new THREE.MeshStandardMaterial({ color: 0xb7c0d4, metalness: 0.6, roughness: 0.35 }));
  pole.position.y = 1.55; g.add(pole);

  const cv = document.createElement("canvas");
  cv.width = 256; cv.height = 256;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0)"; ctx.fillRect(0, 0, 256, 256);
  ctx.beginPath(); ctx.arc(128, 128, 96, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.lineWidth = 18; ctx.strokeStyle = "#ff314f"; ctx.stroke();
  ctx.fillStyle = "#0b1020"; ctx.font = "900 82px Segoe UI, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(String(limit), 128, 134);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  sign.position.y = 3.25; g.add(sign);
  g.userData.limit = limit;
  return g;
}

function makeCurveSign(dir) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 12), new THREE.MeshStandardMaterial({ color: 0xb7c0d4 }));
  pole.position.y = 1.35; g.add(pole);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.45, 0.12), new THREE.MeshStandardMaterial({ color: 0xffcf3a, roughness: 0.38 }));
  sign.position.y = 2.85; sign.castShadow = true; g.add(sign);
  const arrowTex = makeTextTexture(dir < 0 ? "↶" : "↷", { w: 256, h: 180, color: "#141414", font: "900 118px Segoe UI Symbol, Segoe UI, sans-serif", dy: -3 });
  const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.18), new THREE.MeshBasicMaterial({ map: arrowTex, transparent: true }));
  arrow.position.set(0, 2.86, 0.07); g.add(arrow);
  return g;
}

function makeSignalEvent() {
  const g = new THREE.Group();
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1b2b3f, metalness: 0.45, roughness: 0.3 });
  const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7.0, 14), poleMat);
  const poleR = poleL.clone();
  poleL.position.set(-HALF - 1.2, 3.5, 0); poleR.position.set(HALF + 1.2, 3.5, 0);
  g.add(poleL, poleR);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W + 4.0, 0.22, 0.22), poleMat);
  beam.position.set(0, 6.65, 0); g.add(beam);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.3, 0.35), new THREE.MeshStandardMaterial({ color: 0x070a10, roughness: 0.38 }));
  housing.position.set(0, 5.8, 0.12); g.add(housing);

  const mats = {
    red: new THREE.MeshBasicMaterial({ color: 0x3a0005 }),
    yellow: new THREE.MeshBasicMaterial({ color: 0x332300 }),
    green: new THREE.MeshBasicMaterial({ color: 0x003a19 }),
  };
  const lamps = {};
  for (const [name, x, color] of [["red", -1.25, 0xff0028], ["yellow", 0, 0xffc400], ["green", 1.25, 0x00ff74]]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.33, 24, 14), mats[name]);
    lamp.position.set(x, 5.8, 0.33); g.add(lamp);
    const light = new THREE.PointLight(color, 0, 8);
    light.position.set(x, 5.8, 0.7); g.add(light);
    lamps[name] = { mesh: lamp, mat: mats[name], light, color };
  }

  const stopLine = new THREE.Mesh(new THREE.BoxGeometry(ROAD_W - 1.2, 0.045, 0.42), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  stopLine.position.set(0, 0.035, 7.8); g.add(stopLine);
  const crosswalk = [];
  for (let i = 0; i < 8; i++) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.04, 5.2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 }));
    stripe.position.set(-HALF + 2.3 + i * 2.25, 0.04, 13.8);
    g.add(stripe); crosswalk.push(stripe);
  }

  g.userData.lamps = lamps;
  return g;
}

function makeGuideBoard(text) {
  const g = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({ color: 0x7e8da5, metalness: 0.5, roughness: 0.35 });
  for (const x of [-1.8, 1.8]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 12), postMat);
    p.position.set(x, 1.6, 0); g.add(p);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.35, 0.16), new THREE.MeshStandardMaterial({ color: 0x12345a, roughness: 0.42 }));
  board.position.y = 3.25; board.castShadow = true; g.add(board);
  const tex = makeTextTexture(text, { w: 512, h: 160, color: "#dff9ff", font: "900 42px Segoe UI, system-ui, sans-serif" });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(4.25, 1.05), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  front.position.set(0, 3.26, 0.09); g.add(front);
  return g;
}

export class RacingGame {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x071020);
    this.scene.fog = new THREE.Fog(0x071020, 95, VIEW * 0.88);
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 1200);

    this._buildLights();
    this._buildSky();
    this._buildRoad();
    this._buildCity();
    this._buildCars();
    this._buildPracticeObjects();

    this.reset();
    this.resize();
    addEventListener("resize", () => this.resize());
  }

  centerX(s) {
    return Math.sin(s * 0.0022) * 18 + Math.sin(s * 0.0054 + 1.2) * 8 + Math.sin(s * 0.0105 + 0.4) * 2.5;
  }

  roadYaw(s) {
    return Math.atan2(this.centerX(s + 8) - this.centerX(s - 8), 16);
  }

  curvature(s) {
    const a = this.centerX(s + 70) - this.centerX(s + 10);
    return clamp(a / 18, -1, 1);
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xb6c8ff, 0x172335, 0.92));
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.08);
    sun.position.set(-38, 78, 28); sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    const c = sun.shadow.camera;
    c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.far = 220;
    this.scene.add(sun); this.sun = sun;
  }

  _buildSky() {
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { top: { value: new THREE.Color(0x071020) }, bot: { value: new THREE.Color(0x233f78) } },
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 bot; void main(){ float h=normalize(vP).y*0.5+0.5; gl_FragColor=vec4(mix(bot,top,h),1.0); }`,
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(650, 36, 18), mat));

    const g = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 460; i++) {
      const t = (i * 12.9898) % (Math.PI * 2);
      const p = ((i * 7.233) % 1) * Math.PI * 0.48;
      const r = 600;
      pts.push(Math.cos(t) * r * Math.sin(p + 0.42), Math.abs(Math.cos(p)) * 330 + 55, Math.sin(t) * r * Math.sin(p + 0.42));
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    this.scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, opacity: 0.72, transparent: true })));
  }

  _roadTexture() {
    const cv = document.createElement("canvas");
    cv.width = 96; cv.height = 128;
    const x = cv.getContext("2d");
    x.fillStyle = "#2d3343"; x.fillRect(0, 0, 96, 128);
    x.fillStyle = "rgba(255,255,255,0.13)";
    for (let y = 0; y < 128; y += 16) x.fillRect(0, y, 96, 1);
    x.fillStyle = "#f1f5ff";
    x.fillRect(4, 0, 3, 128); x.fillRect(89, 0, 3, 128);
    x.fillStyle = "#ffe45a";
    for (const cx of [32, 64]) {
      for (let y = 4; y < 128; y += 42) x.fillRect(cx - 1.5, y, 3, 24);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, VIEW / 8);
    tex.anisotropy = 6;
    return tex;
  }

  _buildRoad() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(780, VIEW + 360),
      new THREE.MeshStandardMaterial({ color: 0x101826, roughness: 0.75 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.055, -VIEW / 2 + 20);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const verts = (ROWS + 1) * 2;
    this.roadPos = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const idx = [];
    for (let j = 0; j <= ROWS; j++) {
      const z = NEAR - j * ROW_LEN;
      this.roadPos[(2 * j) * 3 + 1] = 0; this.roadPos[(2 * j) * 3 + 2] = z;
      this.roadPos[(2 * j + 1) * 3 + 1] = 0; this.roadPos[(2 * j + 1) * 3 + 2] = z;
      uv[(2 * j) * 2] = 0; uv[(2 * j) * 2 + 1] = j / ROWS;
      uv[(2 * j + 1) * 2] = 1; uv[(2 * j + 1) * 2 + 1] = j / ROWS;
      if (j < ROWS) {
        const a = 2 * j, b = 2 * j + 1, c = 2 * j + 2, d = 2 * j + 3;
        idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.roadPos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    this.roadTex = this._roadTexture();
    this.road = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: this.roadTex, roughness: 0.66, metalness: 0.04, side: THREE.DoubleSide }));
    this.road.receiveShadow = true;
    this.scene.add(this.road);
  }

  _buildCity() {
    this.city = [];
    const colors = [0x172641, 0x1f2f50, 0x213554, 0x182236, 0x243a5e, 0x12243d];
    for (let i = 0; i < 38; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const h = 7 + ((i * 17) % 18);
      const w = 5 + ((i * 13) % 5);
      const d = 5 + ((i * 11) % 7);
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.58, metalness: 0.12 })
      );
      m.castShadow = true; m.receiveShadow = true;
      this.scene.add(m);
      this.city.push({ mesh: m, side, depth: 20 + (i / 2 | 0) * (VIEW / 20), offset: HALF + 18 + ((i * 9) % 14), h });
    }

    this.pillars = [];
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 5.2, 12);
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x5f6e82, metalness: 0.55, roughness: 0.28 });
    for (let i = 0; i < 26; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const g = new THREE.Group();
      const p = new THREE.Mesh(poleGeo, lampMat); p.position.y = 2.6; g.add(p);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.12), lampMat); arm.position.set(side * -0.9, 5.05, 0); g.add(arm);
      const lamp = new THREE.PointLight(0x76dfff, 0.55, 14); lamp.position.set(side * -1.9, 4.86, 0); g.add(lamp);
      this.scene.add(g);
      this.pillars.push({ mesh: g, side, depth: 12 + (i / 2 | 0) * (VIEW / 13) });
    }
  }

  _buildCars() {
    this.car = makeCar(0xff2d55, 0xffffff);
    this.car.scale.setScalar(1.35);
    this.scene.add(this.car);

    this.traffic = [];
    const colors = [0x3dff9e, 0xffd24a, 0x9b6cff, 0x00e5ff, 0xff8a3d, 0xf6f9ff];
    for (let i = 0; i < 8; i++) {
      const g = makeCar(colors[i % colors.length], 0xffffff);
      g.visible = false; this.scene.add(g);
      this.traffic.push({ mesh: g, active: false, trackS: 0, lane: 0, speed: 0 });
    }

    this.obstacles = [];
    for (let i = 0; i < 9; i++) {
      const type = i % 3 === 0 ? "barrier" : "cone";
      const g = makeHazard(type);
      g.visible = false; this.scene.add(g);
      this.obstacles.push({ mesh: g, active: false, trackS: 0, lane: 0, half: g.userData.half });
    }
  }

  _buildPracticeObjects() {
    this.signals = [];
    for (let i = 0; i < 4; i++) {
      const g = makeSignalEvent(); g.visible = false; this.scene.add(g);
      this.signals.push({ mesh: g, active: false, trackS: 0, offset: 0, stopOk: false, judgedPass: false, rewarded: false });
    }

    this.speedSigns = [];
    for (const limit of [30, 40, 50, 60]) {
      const g = makeSpeedLimitSign(limit); g.visible = false; this.scene.add(g);
      this.speedSigns.push({ mesh: g, active: false, trackS: 0, limit, judged: false });
    }

    this.curveSigns = [];
    for (const dir of [-1, 1, -1, 1]) {
      const g = makeCurveSign(dir); g.visible = false; this.scene.add(g);
      this.curveSigns.push({ mesh: g, active: false, trackS: 0, dir, judged: false });
    }

    this.boards = [];
    for (const text of ["정지선", "커브 감속", "차선 유지"]) {
      const g = makeGuideBoard(text); g.visible = false; this.scene.add(g);
      this.boards.push({ mesh: g, active: false, trackS: 0, side: 1 });
    }
  }

  reset() {
    this.dist = 0;
    this.speed = 0;
    this.carX = this.centerX(0);
    this.camX = this.carX;
    this.tilt = 0;
    this.offroad = false;
    this.failed = false;
    this.shake = 0;
    this.simTime = 0;
    this.spawnTimer = 1.7;
    this.nextSignalS = 135;
    this.nextSpeedSignS = 95;
    this.nextCurveSignS = 180;
    this.speedLimit = BASE_LIMIT;
    this.score = 100;
    this.violations = 0;
    this.lastPenaltyS = -999;
    this.speedPenaltyCooldown = 0;
    this.lanePenaltyCooldown = 0;
    this.curvePenaltyCooldown = 0;
    this.feedback = "출발 전 좌우를 확인하고 천천히 출발하세요.";
    this.feedbackTimer = 4;
    this.mission = "신호와 정지선을 확인하며 안전하게 주행하세요.";
    this.currentSignalState = "none";
    this.currentSignalDepth = Infinity;

    for (const t of this.traffic) { t.active = false; t.mesh.visible = false; }
    for (const o of this.obstacles) { o.active = false; o.mesh.visible = false; }
    for (const e of this.signals) { e.active = false; e.mesh.visible = false; }
    for (const s of this.speedSigns) { s.active = false; s.mesh.visible = false; }
    for (const c of this.curveSigns) { c.active = false; c.mesh.visible = false; }
    for (const b of this.boards) { b.active = false; b.mesh.visible = false; }
    this._updateRoad();
  }

  _signalState(ev) {
    const phase = (this.simTime + ev.offset) % SIGNAL_CYCLE;
    if (phase < 7) return "green";
    if (phase < 9) return "yellow";
    return "red";
  }

  _setSignalVisual(ev, state) {
    const lamps = ev.mesh.userData.lamps;
    for (const name of ["red", "yellow", "green"]) {
      const active = name === state;
      const l = lamps[name];
      const color = l.color;
      l.mat.color.setHex(active ? color : (name === "red" ? 0x3a0005 : name === "yellow" ? 0x332300 : 0x003a19));
      l.light.intensity = active ? 2.0 : 0;
    }
  }

  _placeOnRoad(obj, trackS, laneOffset = 0, y = 0, extraX = 0) {
    const depth = trackS - this.dist;
    const cx = this.centerX(trackS) + laneOffset + extraX;
    obj.position.set(cx, y, -depth);
    obj.rotation.y = -this.roadYaw(trackS);
    return depth;
  }

  _spawnSignal() {
    const ev = this.signals.find((e) => !e.active);
    if (!ev) return;
    ev.active = true;
    ev.mesh.visible = true;
    ev.trackS = this.nextSignalS;
    ev.offset = Math.random() * SIGNAL_CYCLE;
    ev.stopOk = false;
    ev.judgedPass = false;
    ev.rewarded = false;
    this.nextSignalS += 250 + Math.random() * 120;
    this._showBoard("정지선", ev.trackS - 48, 1);
  }

  _spawnSpeedSign() {
    const sign = this.speedSigns.find((s) => !s.active);
    if (!sign) return;
    const limits = [30, 40, 50, 60];
    let limit = limits[(Math.random() * limits.length) | 0];
    if (limit === this.speedLimit) limit = limits[(limits.indexOf(limit) + 1) % limits.length];
    sign.limit = limit;
    sign.mesh.userData.limit = limit;
    const face = sign.mesh.children.find((m) => m.material?.map);
    if (face) {
      const cv = document.createElement("canvas");
      cv.width = 256; cv.height = 256;
      const ctx = cv.getContext("2d");
      ctx.beginPath(); ctx.arc(128, 128, 96, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
      ctx.lineWidth = 18; ctx.strokeStyle = "#ff314f"; ctx.stroke();
      ctx.fillStyle = "#0b1020"; ctx.font = "900 82px Segoe UI, system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(limit), 128, 134);
      face.material.map?.dispose?.();
      face.material.map = new THREE.CanvasTexture(cv);
      face.material.map.colorSpace = THREE.SRGBColorSpace;
      face.material.needsUpdate = true;
    }
    sign.active = true;
    sign.mesh.visible = true;
    sign.trackS = this.nextSpeedSignS;
    sign.judged = false;
    this.nextSpeedSignS += 280 + Math.random() * 140;
  }

  _spawnCurveSign() {
    const curve = this.curveSigns.find((c) => !c.active);
    if (!curve) return;
    const dir = this.curvature(this.nextCurveSignS + 80) < 0 ? -1 : 1;
    curve.dir = dir;
    const face = curve.mesh.children.find((m) => m.material?.map);
    if (face) {
      face.material.map?.dispose?.();
      face.material.map = makeTextTexture(dir < 0 ? "↶" : "↷", { w: 256, h: 180, color: "#141414", font: "900 118px Segoe UI Symbol, Segoe UI, sans-serif", dy: -3 });
      face.material.needsUpdate = true;
    }
    curve.active = true;
    curve.mesh.visible = true;
    curve.trackS = this.nextCurveSignS;
    curve.judged = false;
    this.nextCurveSignS += 300 + Math.random() * 150;
    this._showBoard("커브 감속", curve.trackS - 35, dir > 0 ? -1 : 1);
  }

  _showBoard(text, trackS, side = 1) {
    const b = this.boards.find((x) => !x.active);
    if (!b) return;
    b.active = true; b.mesh.visible = true;
    b.trackS = trackS; b.side = side;
    const texMesh = b.mesh.children.find((m) => m.material?.map);
    if (texMesh) {
      texMesh.material.map?.dispose?.();
      texMesh.material.map = makeTextTexture(text, { w: 512, h: 160, color: "#dff9ff", font: "900 42px Segoe UI, system-ui, sans-serif" });
      texMesh.material.needsUpdate = true;
    }
  }

  _spawnTraffic() {
    const t = this.traffic.find((x) => !x.active);
    if (!t) return;
    t.lane = (((Math.random() * 3) | 0) - 1) * LANE;
    t.active = true; t.mesh.visible = true;
    t.speed = clamp(this.speed / 2 + 6 + Math.random() * 8, 9, 26);
    t.trackS = this.dist + VIEW * (0.78 + Math.random() * 0.14);
  }

  _spawnObstacle() {
    const o = this.obstacles.find((x) => !x.active);
    if (!o) return;
    o.lane = (((Math.random() * 3) | 0) - 1) * LANE;
    o.active = true; o.mesh.visible = true;
    o.trackS = this.dist + VIEW * (0.76 + Math.random() * 0.14);
  }

  _penalty(points, reason, critical = false) {
    if (this.dist - this.lastPenaltyS < 8 && !critical) return;
    this.lastPenaltyS = this.dist;
    this.score = Math.max(0, this.score - points);
    this.violations += 1;
    this.feedback = reason;
    this.feedbackTimer = 4.2;
    this.shake = Math.max(this.shake, critical ? 1.0 : 0.38);
    if (critical || this.violations >= 7 || this.score <= 0) this._finish();
  }

  _reward(points, msg) {
    this.score += points;
    this.feedback = msg;
    this.feedbackTimer = 2.7;
  }

  _finish() {
    this.failed = true;
    if (this.onCrash) this.onCrash({ score: Math.floor(this.score), dist: Math.floor(this.dist), violations: this.violations, reason: this.feedback });
  }

  _updateRoad() {
    const p = this.roadPos;
    for (let j = 0; j <= ROWS; j++) {
      const cx = this.centerX(this.dist + j * ROW_LEN - NEAR);
      p[(2 * j) * 3] = cx - HALF;
      p[(2 * j + 1) * 3] = cx + HALF;
    }
    this.road.geometry.attributes.position.needsUpdate = true;
  }

  update(dt, input) {
    if (this.failed) { this._render(dt); return; }
    dt = Math.min(dt, 0.05);
    this.simTime += dt;
    this.feedbackTimer = Math.max(0, this.feedbackTimer - dt);

    while (this.nextSignalS < this.dist + VIEW * 0.9) this._spawnSignal();
    while (this.nextSpeedSignS < this.dist + VIEW * 0.86) this._spawnSpeedSign();
    while (this.nextCurveSignS < this.dist + VIEW * 0.82) this._spawnCurveSign();

    const kmh = this.speed * 3;
    const maxByLimit = clamp((this.speedLimit + 22) / 3, 18, MAXS);
    const targetMax = Math.min(MAXS, maxByLimit + smoothstep(0, 900, this.dist) * 5);
    const offroadDrag = this.offroad ? 0.46 : 1;

    if (input.brake) this.speed += (0.8 - this.speed) * Math.min(1, dt * 4.8);
    else if (input.handsOn) {
      const target = (1.8 + input.throttle * targetMax) * offroadDrag;
      this.speed += (target - this.speed) * Math.min(1, dt * 0.9);
    } else {
      this.speed += (0.2 - this.speed) * Math.min(1, dt * 0.72);
    }
    if (this.offroad) this.speed = Math.min(this.speed, targetMax * 0.45);
    this.speed = Math.max(0, this.speed);

    const steerPow = 0.48 + (this.speed / MAXS) * 0.95;
    this.carX += input.steer * 18 * steerPow * dt;
    this.dist += this.speed * dt;
    this.score += this.speed * dt * 0.035;

    const roadCenter = this.centerX(this.dist);
    const offset = this.carX - roadCenter;
    this.offroad = Math.abs(offset) > HALF - 1.0;
    const limit = HALF + 3.6;
    if (offset > limit) this.carX = roadCenter + limit;
    if (offset < -limit) this.carX = roadCenter - limit;

    if (this.offroad) {
      this.lanePenaltyCooldown -= dt;
      if (this.lanePenaltyCooldown <= 0) {
        this._penalty(7, "차선/도로 가장자리를 벗어났어요. 핸들을 천천히 복원하세요.");
        this.lanePenaltyCooldown = 4.5;
      }
    } else this.lanePenaltyCooldown = Math.max(0, this.lanePenaltyCooldown - dt);

    if (this.speed * 3 > this.speedLimit + 10) {
      this.speedPenaltyCooldown -= dt;
      if (this.speedPenaltyCooldown <= 0) {
        this._penalty(8, `제한속도 ${this.speedLimit}km/h 구간입니다. 속도를 줄여주세요.`);
        this.speedPenaltyCooldown = 5.0;
      }
    } else this.speedPenaltyCooldown = Math.max(0, this.speedPenaltyCooldown - dt);

    const curve = Math.abs(this.curvature(this.dist + 45));
    if (curve > 0.48 && this.speed * 3 > 52) {
      this.curvePenaltyCooldown -= dt;
      if (this.curvePenaltyCooldown <= 0) {
        this._penalty(6, "커브 진입 속도가 높아요. 커브 전에는 미리 감속하세요.");
        this.curvePenaltyCooldown = 5.5;
      }
    } else this.curvePenaltyCooldown = Math.max(0, this.curvePenaltyCooldown - dt);

    this.car.position.set(this.carX, 0, 0);
    this.tilt += (-input.steer * 0.28 - this.tilt) * Math.min(1, dt * 8);
    this.car.rotation.z = this.tilt;
    this.car.rotation.y = -input.steer * 0.16;
    const spin = this.speed * dt * 1.5;
    for (const w of this.car.userData.wheels) w.rotation.x += spin;

    this._updateRoad();
    this._updateScenery(dt);
    this._updatePractice(dt);
    this._updateTrafficAndHazards(dt);
    this._updateMission();
    this._render(dt);
  }

  _updateScenery(dt) {
    for (const b of this.city) {
      b.depthCur = (b.depthCur ?? b.depth) - this.speed * dt;
      if (b.depthCur < -35) b.depthCur += VIEW + 60;
      const trackS = this.dist + b.depthCur;
      const z = -b.depthCur;
      const cx = this.centerX(trackS);
      b.mesh.position.set(cx + b.side * b.offset, b.h / 2 - 0.05, z);
      b.mesh.rotation.y = -this.roadYaw(trackS) * 0.4;
    }
    for (const p of this.pillars) {
      p.depthCur = (p.depthCur ?? p.depth) - this.speed * dt;
      if (p.depthCur < -18) p.depthCur += VIEW;
      const trackS = this.dist + p.depthCur;
      const z = -p.depthCur;
      const cx = this.centerX(trackS);
      p.mesh.position.set(cx + p.side * (HALF + 2.6), 0, z);
      p.mesh.rotation.y = -this.roadYaw(trackS);
    }
  }

  _updatePractice(dt) {
    this.currentSignalState = "none";
    this.currentSignalDepth = Infinity;

    for (const ev of this.signals) {
      if (!ev.active) continue;
      const depth = this._placeOnRoad(ev.mesh, ev.trackS, 0, 0);
      const state = this._signalState(ev);
      this._setSignalVisual(ev, state);
      if (depth > -30 && depth < this.currentSignalDepth) {
        this.currentSignalState = state;
        this.currentSignalDepth = depth;
      }
      if (depth > 0 && depth < 9 && state === "red" && this.speed < 1.2) {
        ev.stopOk = true;
        if (!ev.rewarded) { this._reward(9, "정지선 앞에서 잘 멈췄어요. 신호가 바뀌면 천천히 출발하세요."); ev.rewarded = true; }
      }
      if (!ev.judgedPass && depth < -2.0) {
        ev.judgedPass = true;
        if ((state === "red" || state === "yellow") && !ev.stopOk) {
          this._penalty(state === "red" ? 18 : 10, state === "red" ? "빨간불에 정지선을 통과했어요." : "황색 신호에서는 무리하게 진입하지 않는 연습이 필요해요.");
        } else if (state === "green" || ev.stopOk) {
          this._reward(5, "교차로 통과가 안정적이었어요.");
        }
      }
      if (depth < -60) { ev.active = false; ev.mesh.visible = false; }
    }

    for (const sign of this.speedSigns) {
      if (!sign.active) continue;
      const side = sign.limit <= 40 ? -1 : 1;
      const depth = this._placeOnRoad(sign.mesh, sign.trackS, 0, 0, side * (HALF + 1.7));
      if (!sign.judged && depth < 8) {
        sign.judged = true;
        this.speedLimit = sign.limit;
        this._reward(3, `제한속도 ${sign.limit}km/h 구간입니다. 속도계를 확인하세요.`);
      }
      if (depth < -55) { sign.active = false; sign.mesh.visible = false; }
    }

    for (const curve of this.curveSigns) {
      if (!curve.active) continue;
      const depth = this._placeOnRoad(curve.mesh, curve.trackS, 0, 0, curve.dir * (HALF + 1.8));
      if (!curve.judged && depth < 35) {
        curve.judged = true;
        this.feedback = curve.dir < 0 ? "왼쪽 커브입니다. 진입 전에 감속하고 차선을 유지하세요." : "오른쪽 커브입니다. 시선을 커브 끝으로 두고 천천히 조향하세요.";
        this.feedbackTimer = 3.0;
      }
      if (depth < -50) { curve.active = false; curve.mesh.visible = false; }
    }

    for (const b of this.boards) {
      if (!b.active) continue;
      const depth = this._placeOnRoad(b.mesh, b.trackS, 0, 0, b.side * (HALF + 3.5));
      if (depth < -45) { b.active = false; b.mesh.visible = false; }
    }
  }

  _updateTrafficAndHazards(dt) {
    this.spawnTimer -= dt;
    const interval = Math.max(1.0, 2.8 - this.speed / 22);
    if (this.spawnTimer <= 0 && this.speed > 4.5) {
      if (Math.random() < 0.38) this._spawnObstacle(); else this._spawnTraffic();
      this.spawnTimer = interval + Math.random() * 0.8;
    }

    for (const t of this.traffic) {
      if (!t.active) continue;
      t.trackS += t.speed * dt;
      const depth = t.trackS - this.dist;
      if (depth < -14) { t.active = false; t.mesh.visible = false; continue; }
      const cx = this.centerX(t.trackS) + t.lane;
      t.mesh.position.set(cx, 0, -depth);
      t.mesh.rotation.y = -this.roadYaw(t.trackS);
      for (const w of t.mesh.userData.wheels) w.rotation.x += t.speed * dt * 1.35;
      if (depth > -2.3 && depth < 2.6 && Math.abs(cx - this.carX) < 2.35) {
        this._penalty(40, "앞차와 충돌했어요. 안전거리와 차선 변경 타이밍을 다시 연습하세요.", true);
      }
    }

    for (const o of this.obstacles) {
      if (!o.active) continue;
      const depth = o.trackS - this.dist;
      if (depth < -14) { o.active = false; o.mesh.visible = false; continue; }
      const cx = this.centerX(o.trackS) + o.lane;
      o.mesh.position.set(cx, 0, -depth);
      o.mesh.rotation.y = -this.roadYaw(o.trackS) + Math.sin(this.simTime + o.trackS) * 0.04;
      if (depth > -2.0 && depth < 2.4 && Math.abs(cx - this.carX) < 1.35 + o.half) {
        this._penalty(35, "장애물을 피하지 못했어요. 속도를 낮추고 여유 있게 조향하세요.", true);
      }
    }
  }

  _updateMission() {
    if (this.currentSignalState !== "none" && this.currentSignalDepth < 120 && this.currentSignalDepth > -10) {
      const ko = this.currentSignalState === "green" ? "초록불" : this.currentSignalState === "yellow" ? "노란불" : "빨간불";
      this.mission = `${ko} · 정지선까지 ${Math.max(0, Math.floor(this.currentSignalDepth))}m`;
      return;
    }
    const curve = this.curvature(this.dist + 70);
    if (Math.abs(curve) > 0.42) {
      this.mission = curve < 0 ? "왼쪽 커브 진입 · 미리 감속" : "오른쪽 커브 진입 · 미리 감속";
      return;
    }
    if (this.speed * 3 > this.speedLimit + 5) {
      this.mission = `제한속도 ${this.speedLimit}km/h · 감속 필요`;
      return;
    }
    this.mission = "차선 중앙 유지 · 전방 신호 확인";
  }

  _render(dt) {
    this.camX += (this.carX - this.camX) * Math.min(1, dt * 5.4);
    let camX = this.camX;
    if (this.shake > 0) {
      camX += Math.sin(this.simTime * 55) * this.shake * 0.42;
      this.shake = Math.max(0, this.shake - dt * 1.6);
    }
    this.camera.position.set(camX, 7.6, 16.5);
    this.camera.lookAt(camX, 1.05, -34);
    this.sun.position.set(this.carX - 38, 78, 28);
    this.sun.target.position.set(this.carX, 0, -18);
    this.sun.target.updateMatrixWorld();
    this.roadTex.offset.y -= (this.speed * dt) / 8;
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  get distance() { return this.dist; }
  get kmh() { return Math.round(this.speed * 3); }
  get bestScoreCandidate() { return Math.floor(this.score); }
  getState() {
    return {
      kmh: this.kmh,
      dist: this.dist,
      score: Math.max(0, Math.floor(this.score)),
      violations: this.violations,
      speedLimit: this.speedLimit,
      signal: this.currentSignalState,
      mission: this.mission,
      feedback: this.feedbackTimer > 0 ? this.feedback : "좋아요. 시야를 넓게 두고 부드럽게 조향하세요.",
      offroad: this.offroad,
    };
  }
}
