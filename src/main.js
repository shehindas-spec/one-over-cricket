import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import './multiplayer.js';

const container = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const cameraLabel = document.querySelector('#cameraLabel');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x91a99a);
scene.fog = new THREE.Fog(0x91a99a, 85, 190);

const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 350);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 9;
controls.maxDistance = 85;
controls.maxPolarAngle = Math.PI * 0.48;
controls.target.set(0, 1, 0);

scene.add(new THREE.HemisphereLight(0xe7f3ff, 0x36502d, 2.1));
const sun = new THREE.DirectionalLight(0xfff0d4, 3.0);
sun.position.set(-35, 55, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -65; sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65; sun.shadow.camera.bottom = -65;
scene.add(sun);

const mat = (color, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness });
const grassMat = mat(0x397744);
const darkGrassMat = mat(0x286238);
const pitchMat = mat(0xb69b70);
const lineMat = mat(0xf4f0dc);
const woodMat = mat(0xe4d2a8);
const playerMat = mat(0x263caa);
const trouserMat = mat(0x17232a);
const skinMat = mat(0xb77b55);
const helmetMat = mat(0x1b2632, 0.45);

function box(parent, name, size, position, material, cast = true, receive = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, name, radiusTop, radiusBottom, height, position, material, segments = 12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// Large circular outfield and alternating mown rings.
const field = new THREE.Mesh(new THREE.CircleGeometry(76, 96), grassMat);
field.rotation.x = -Math.PI / 2;
field.position.y = -0.12;
field.receiveShadow = true;
scene.add(field);

for (let i = 0; i < 7; i++) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(17 + i * 7.5, 24.5 + i * 7.5, 96),
    i % 2 === 0 ? darkGrassMat : grassMat
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.105 + i * 0.001;
  scene.add(ring);
}

// Boundary rope.
const boundary = new THREE.Mesh(
  new THREE.TorusGeometry(65, 0.22, 8, 160),
  mat(0xf1eee0, 0.5)
);
boundary.rotation.x = Math.PI / 2;
boundary.position.y = 0.12;
scene.add(boundary);

// Pitch, worn central strip and creases.
box(scene, 'cricket pitch', [8.5, 0.12, 25], [0, 0.0, 0], pitchMat, false);
box(scene, 'pitch centre strip', [1.1, 0.025, 25], [0, 0.075, 0], mat(0xc4aa7e), false);
for (const z of [-9.5, 9.5]) {
  box(scene, 'crease line', [8.3, 0.035, 0.16], [0, 0.095, z], lineMat, false);
  for (const x of [-3.3, 3.3]) {
    box(scene, 'return crease', [0.13, 0.035, 2.1], [x, 0.095, z + (z < 0 ? 1 : -1)], lineMat, false);
  }
}

// Wickets at both ends.
function makeWicket(z) {
  const group = new THREE.Group();
  for (const x of [-0.42, 0, 0.42]) {
    cylinder(group, 'stump', 0.075, 0.075, 1.65, [x, 0.91, 0], woodMat, 10);
  }
  for (const x of [-0.21, 0.21]) {
    box(group, 'bail', [0.32, 0.08, 0.12], [x, 1.77, 0], woodMat);
  }
  group.position.z = z;
  scene.add(group);
  return group;
}
const batterWicket = makeWicket(-10.1);
makeWicket(10.1);

// Simple stylised player models (placeholders for animated models in Stage 5).
function makePlayer(label, position, facing, isBatter = false) {
  const g = new THREE.Group();
  g.name = label;
  const torso = cylinder(g, 'shirt', 0.43, 0.5, 1.15, [0, 1.55, 0], playerMat, 16);
  torso.rotation.z = -0.04;
  cylinder(g, 'neck', 0.14, 0.14, 0.22, [0, 2.22, 0], skinMat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 12), skinMat);
  head.position.set(0, 2.52, 0); head.castShadow = true; g.add(head);
  let batPivot = null;
  if (isBatter) {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), helmetMat);
    helmet.position.set(0, 2.62, 0); g.add(helmet);
    // Bat pivot at the hands: raised backlift, downswing and follow-through.
    batPivot = new THREE.Group();
    batPivot.name = 'batter bat pivot';
    batPivot.position.set(0.48, 1.65, 0.12);
    g.add(batPivot);
    const bat = box(batPivot, 'cricket bat', [0.22, 1.35, 0.12], [0.0, -0.64, 0], woodMat);
    bat.rotation.z = -0.12;
    cylinder(batPivot, 'bat grip', 0.075, 0.075, 0.28, [0, -0.08, 0], mat(0x242424));
    // Two simple arms meet the handle; their swing is stylised with the bat.
    const frontArm = cylinder(g, 'batter front arm', 0.13, 0.16, 0.88, [0.32, 1.62, 0.04], playerMat, 10);
    frontArm.rotation.z = -0.35;
    const rearArm = cylinder(g, 'batter rear arm', 0.13, 0.16, 0.82, [0.58, 1.58, -0.04], playerMat, 10);
    rearArm.rotation.z = 0.18;
  }
  for (const side of [-1, 1]) {
    cylinder(g, 'leg', 0.16, 0.19, 1.05, [side * 0.22, 0.53, 0], trouserMat, 10);
    box(g, 'shoe', [0.3, 0.16, 0.48], [side * 0.22, 0.08, 0.12], mat(0x171b1c));
    if (!isBatter) {
      cylinder(g, 'arm', 0.13, 0.16, 0.85, [side * 0.52, 1.58, 0], playerMat, 10).rotation.z = side * -0.22;
    }
  }
  g.userData.batPivot = batPivot;
  g.userData.baseRotation = g.rotation.clone();
  g.position.set(...position);
  g.rotation.y = facing;
  scene.add(g);
  return g;
}
const batter = makePlayer('batter', [0, 0, -7.8], 0, true);

// Articulated bowler placeholder: hips/body, shoulders and limb pivots are
// animated through run-up, gather, delivery stride and follow-through.
function makeAnimatedBowler() {
  const root = new THREE.Group();
  root.name = 'animated bowler';
  const body = cylinder(root, 'bowler shirt', 0.43, 0.5, 1.15, [0, 1.55, 0], mat(0x243eaa), 16);
  cylinder(root, 'bowler neck', 0.14, 0.14, 0.2, [0, 2.22, 0], skinMat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), skinMat);
  head.position.set(0, 2.48, 0); root.add(head);
  const limbMat = mat(0x243eaa);
  const legMat = mat(0x18252b);
  const armL = new THREE.Group(); armL.position.set(-0.48, 2.0, 0); root.add(armL);
  cylinder(armL, 'bowling arm upper', 0.13, 0.16, 0.62, [0, -0.31, 0], limbMat, 10);
  cylinder(armL, 'bowling forearm', 0.11, 0.13, 0.55, [0, -0.88, 0], skinMat, 10);
  const armR = new THREE.Group(); armR.position.set(0.48, 2.0, 0); root.add(armR);
  cylinder(armR, 'non bowling arm', 0.13, 0.16, 0.95, [0, -0.48, 0], limbMat, 10);
  const legL = new THREE.Group(); legL.position.set(-0.22, 1.0, 0); root.add(legL);
  cylinder(legL, 'bowler leg left', 0.16, 0.19, 0.95, [0, -0.48, 0], legMat, 10);
  box(legL, 'bowler shoe left', [0.3, 0.15, 0.45], [0, -0.98, -0.1], mat(0x171b1c));
  const legR = new THREE.Group(); legR.position.set(0.22, 1.0, 0); root.add(legR);
  cylinder(legR, 'bowler leg right', 0.16, 0.19, 0.95, [0, -0.48, 0], legMat, 10);
  box(legR, 'bowler shoe right', [0.3, 0.15, 0.45], [0, -0.98, -0.1], mat(0x171b1c));
  root.userData = { armL, armR, legL, legR, body, head };
  root.position.set(0, 0, 25);
  scene.add(root);
  return root;
}
const bowler = makeAnimatedBowler();

// Ball at the bowler's hand for this environment preview.
const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), mat(0x9f2028, 0.45));
ball.position.set(0.55, 1.9, 7.1);
ball.castShadow = true;
scene.add(ball);

// A subtle shadow helps the moving ball read against the pitch.
const ballShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.28, 20),
  new THREE.MeshBasicMaterial({ color: 0x111b13, transparent: true, opacity: 0.32 })
);
ballShadow.rotation.x = -Math.PI / 2;
ballShadow.position.y = 0.105;
scene.add(ballShadow);


// Stage 6.6 procedural sound engine. Browser audio is unlocked on first touch/key.
let audioContext = null;
let soundEnabled = true;
let crowdGain = null;
let crowdSource = null;
let crowdLfo = null;
function initGameAudio() {
  if (audioContext || !soundEnabled) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioContext = new Ctx();
  if (audioContext.state === 'suspended') audioContext.resume();
  // Continuous layered crowd-like ambience with slow swells.
  const length = audioContext.sampleRate * 4;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const samples = buffer.getChannelData(0);
  let smooth = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    smooth = smooth * 0.94 + white * 0.06;
    samples[i] = smooth * 2.8 + white * 0.10;
  }
  crowdSource = audioContext.createBufferSource();
  crowdSource.buffer = buffer;
  crowdSource.loop = true;
  const filter = audioContext.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 620;
  filter.Q.value = 0.65;
  crowdGain = audioContext.createGain();
  crowdGain.gain.value = 0.075;
  crowdLfo = audioContext.createOscillator();
  crowdLfo.type = 'sine';
  crowdLfo.frequency.value = 0.11;
  const lfoGain = audioContext.createGain();
  lfoGain.gain.value = 0.018;
  crowdLfo.connect(lfoGain).connect(crowdGain.gain);
  crowdSource.connect(filter).connect(crowdGain).connect(audioContext.destination);
  crowdSource.start();
  crowdLfo.start();
}
function soundTone(freq, duration, type = 'sine', volume = 0.1, endFreq = 0) {
  if (!soundEnabled) return;
  initGameAudio(); if (!audioContext) return;
  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator(), gain = audioContext.createGain();
  osc.type = type; osc.frequency.setValueAtTime(freq, now);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), now + duration);
  gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain).connect(audioContext.destination); osc.start(now); osc.stop(now + duration);
}
function soundNoise(duration = 0.1, volume = 0.12, frequency = 1500) {
  if (!soundEnabled) return;
  initGameAudio(); if (!audioContext) return;
  const now = audioContext.currentTime, length = Math.floor(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate), samples = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain();
  src.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.connect(filter).connect(gain).connect(audioContext.destination); src.start(now);
}
function playBatContact(power = 1) {
  soundNoise(0.085, 0.22 * power, 2050);
  soundTone(155, 0.15, 'triangle', 0.17 * power, 55);
  soundTone(650, 0.05, 'square', 0.045 * power, 300);
}
function playPitchBounce() { soundTone(185, 0.08, 'triangle', 0.11, 75); soundNoise(0.04, 0.05, 700); }
function playWicketImpact() { soundTone(110, 0.22, 'sawtooth', 0.15, 38); soundNoise(0.11, 0.10, 850); }
function playCrowdReaction(power = 1) {
  soundNoise(0.85, 0.10 * power, 520);
  soundNoise(0.42, 0.055 * power, 1250);
  soundTone(360, 0.42, 'sine', 0.045 * power, 610);
  soundTone(520, 0.30, 'triangle', 0.025 * power, 740);
}
function playStadiumClap() {
  for (let i = 0; i < 7; i++) {
    const delay = i * 75;
    window.setTimeout(() => soundNoise(0.035, 0.045, 1900 + (i % 3) * 250), delay);
  }
}
window.addEventListener('pointerdown', (event) => {
  // The sound control handles its own first-click audio unlock.
  if (event.target && event.target.closest && event.target.closest('#soundToggleBtn')) return;
  initGameAudio();
}, { once: true });
window.addEventListener('keydown', initGameAudio, { once: true });
const soundToggle = document.querySelector('#soundToggleBtn');
if (soundToggle) soundToggle.addEventListener('click', () => {
  if (!audioContext) {
    soundEnabled = true;
    initGameAudio();
  } else {
    soundEnabled = !soundEnabled;
    if (soundEnabled && audioContext.state === 'suspended') audioContext.resume();
    if (crowdGain && audioContext) crowdGain.gain.setTargetAtTime(soundEnabled ? 0.075 : 0, audioContext.currentTime, 0.08);
  }
  soundToggle.textContent = soundEnabled ? 'Sound: On' : 'Sound: Off';
  soundToggle.setAttribute('aria-pressed', String(soundEnabled));
});

// Brief contact flash makes the bat/ball meeting readable without a blocking UI.
const contactFlash = new THREE.Mesh(
  new THREE.SphereGeometry(0.22, 12, 10),
  new THREE.MeshBasicMaterial({ color: 0xffef9a, transparent: true, opacity: 0 })
);
contactFlash.visible = false;
scene.add(contactFlash);
let contactFlashTime = 0;


// Boundary boards around the ground.
for (let i = 0; i < 48; i++) {
  const a = (i / 48) * Math.PI * 2;
  const x = Math.cos(a) * 67;
  const z = Math.sin(a) * 67;
  const board = box(scene, 'boundary advertising board', [8.7, 1.0, 0.25], [x, 0.55, z], i % 2 ? mat(0x173f34) : mat(0x1d503d), false);
  board.rotation.y = -a;
}

// Stadium seating: tiered curved bands with tiny seat blocks.
for (let tier = 0; tier < 4; tier++) {
  const seatRing = new THREE.Mesh(
    new THREE.RingGeometry(70 + tier * 3.4, 73.2 + tier * 3.4, 128),
    mat(tier % 2 ? 0x334c55 : 0x263c46)
  );
  seatRing.rotation.x = -Math.PI / 2;
  seatRing.position.y = 1.2 + tier * 1.05;
  scene.add(seatRing);
}
const crowdMats = [0xd4a34e, 0x9e4b48, 0x4b79a4, 0xd6d6c7, 0x547c57].map(c => mat(c));
for (let i = 0; i < 520; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 72 + Math.random() * 11;
  const h = 1.4 + Math.random() * 3.2;
  const dot = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.35), crowdMats[i % crowdMats.length]);
  dot.position.set(Math.cos(a) * r, h / 2 + 1.2, Math.sin(a) * r);
  dot.rotation.y = Math.random() * Math.PI;
  scene.add(dot);
}

// Floodlight towers.
for (const x of [-1, 1]) for (const z of [-1, 1]) {
  const tower = new THREE.Group();
  cylinder(tower, 'floodlight tower', 0.2, 0.36, 28, [0, 14, 0], mat(0x68736e));
  box(tower, 'light bank', [3.8, 1.5, 0.65], [0, 28.5, 0], mat(0xe7eadb));
  tower.position.set(x * 79, 0, z * 79);
  scene.add(tower);
  const lamp = new THREE.PointLight(0xfff0d5, 120, 95, 2);
  lamp.position.set(x * 79, 27, z * 79);
  scene.add(lamp);
}

// Distant sky backdrop horizon.
const sky = new THREE.Mesh(
  new THREE.CylinderGeometry(155, 155, 70, 64, 1, true),
  new THREE.MeshBasicMaterial({ color: 0x829b8e, side: THREE.BackSide })
);
sky.position.y = 18;
scene.add(sky);

const views = {
  batting: {
    position: new THREE.Vector3(0, 3.4, -17.8),
    target: new THREE.Vector3(0, 1.5, 4.5),
    label: 'BATTER’S END'
  },
  bowling: {
    position: new THREE.Vector3(0, 4.1, 18.2),
    target: new THREE.Vector3(0, 1.4, -4.5),
    label: 'BOWLER’S END'
  },
  side: {
    position: new THREE.Vector3(15.5, 3.8, 1.5),
    target: new THREE.Vector3(0, 1.25, 0),
    label: 'SIDE VIEW'
  },
  back: {
    position: new THREE.Vector3(0, 7.2, 27),
    target: new THREE.Vector3(0, 1.1, 0),
    label: 'BACK VIEW'
  }
};

let activeView = 'batting';
function setView(which) {
  const view = views[which] || views.batting;
  activeView = which;
  camera.position.copy(view.position);
  controls.target.copy(view.target);
  controls.update();
  cameraLabel.textContent = view.label;
  for (const [id, key] of [['battingBtn','batting'],['bowlingBtn','bowling'],['sideViewBtn','side'],['backViewBtn','back']]) {
    document.querySelector(`#${id}`).classList.toggle('active', which === key);
  }
}
document.querySelector('#battingBtn').addEventListener('click', () => setView('batting'));
document.querySelector('#bowlingBtn').addEventListener('click', () => setView('bowling'));
document.querySelector('#sideViewBtn').addEventListener('click', () => setView('side'));
document.querySelector('#backViewBtn').addEventListener('click', () => setView('back'));
document.querySelector('#detailsToggleBtn').addEventListener('click', () => {
  const shell = document.querySelector('#liveMatchShell');
  const hidden = shell.classList.toggle('details-hidden');
  const button = document.querySelector('#detailsToggleBtn');
  button.setAttribute('aria-expanded', String(!hidden));
  button.classList.toggle('active', !hidden);
});
document.querySelector('#fullscreenBtn').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    showMessage('Full-screen mode is not available in this browser');
  }
});
document.querySelector('#resetView').addEventListener('click', () => {
  setView(activeView);
});
setView('batting');

function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(container);
resize();

loading.classList.add('hidden');
setTimeout(() => loading.remove(), 400);


// ---------------------------------------------------------------------------
// STAGE 2: timing-based batting prototype (single-player batting practice).
// Online multiplayer and the opponent's bowling controls are Stage 4.
// ---------------------------------------------------------------------------
const scoreValue = document.querySelector('#scoreValue');
const oversValue = document.querySelector('#oversValue');
const lastBallValue = document.querySelector('#lastBallValue');
const gameMessage = document.querySelector('#gameMessage');
const startOverBtn = document.querySelector('#startOverBtn');
const hitBtn = document.querySelector('#hitBtn');

const game = {
  runs: 0,
  wickets: 0,
  legalBalls: 0,
  totalBalls: 0,
  active: false,
  delivery: null,
  resultLock: false,
  finished: false
};

const RUNUP_START_Z = 25;
const RELEASE_Z = 10.25;
const PITCH_Z = -4.15;
const BATTER_Z = -7.15;
const RUNUP_SECONDS = 1.45;
const HIT_WINDOW_SECONDS = 0.22;
const DELIVERY_SPEED = 17.2;

const paceProfiles = {
  fast:   { label: 'FAST', speed: 22.5, runup: 1.25, bounce: 5.0, line: 0.40 },
  medium: { label: 'MEDIUM', speed: 17.2, runup: 1.45, bounce: 4.0, line: 0.42 },
  slow:   { label: 'SLOW', speed: 13.2, runup: 1.65, bounce: 3.1, line: 0.48 }
};
let selectedPace = 'medium';
document.querySelector('#paceSelect').addEventListener('change', e => {
  selectedPace = e.target.value;
  showMessage(`${paceProfiles[selectedPace].label} BOWLER SELECTED`);
});
let batterAction = null;

function resetBatterPose() {
  batterAction = null;
  if (batter.userData.batPivot) {
    batter.userData.batPivot.rotation.set(0, 0, -0.18);
  }
  batter.rotation.set(0, 0, 0);
  batter.position.y = 0;
}

function animateBatterShot(kind) {
  const pivot = batter.userData.batPivot;
  if (!pivot) return;
  batterAction = { elapsed: 0, duration: kind === 'miss' ? 0.46 : 0.62, kind };
}

function updateBatterShot(delta) {
  if (!batterAction || !batter.userData.batPivot) return;
  const a = batterAction;
  a.elapsed += delta;
  const t = Math.min(a.elapsed / a.duration, 1);
  const pivot = batter.userData.batPivot;
  // A small trigger movement, powerful downswing through impact, then a
  // balanced high follow-through. Misses finish with the bat past the line.
  const lift = -0.18 - 0.65 * Math.sin(Math.min(t / 0.42, 1) * Math.PI / 2);
  const swing = t < 0.34 ? lift : THREE.MathUtils.lerp(-0.83, 1.05, (t - 0.34) / 0.66);
  pivot.rotation.z = swing;
  batter.rotation.y = t < 0.55 ? -0.10 * Math.sin(t / 0.55 * Math.PI) : 0.10;
  batter.position.y = 0.035 * Math.sin(t * Math.PI);
  if (t >= 1) resetBatterPose();
}

let lastFrameTime = performance.now();

function updateScore() {
  scoreValue.textContent = `${game.runs}/${game.wickets}`;
  oversValue.innerHTML = `${Math.floor(game.legalBalls / 6)}.${game.legalBalls % 6} <small>/ 1.0</small>`;
}

function showMessage(message, tone = '') {
  gameMessage.textContent = message;
  gameMessage.className = `game-message ${tone}`.trim();
}

function resetBallPosition() {
  ball.material.emissiveIntensity = 0;
  ball.position.set(0.42, 2.55, RELEASE_Z);
  ballShadow.position.set(0.42, 0.105, RELEASE_Z);
  ball.visible = true;
  ballShadow.visible = true;
}


function resetBatterWicket() {
  batterWicket.children.forEach(child => {
    if (child.name === 'stump') {
      child.rotation.set(0, 0, 0);
      child.position.y = 0.91;
    } else if (child.name === 'bail') {
      child.rotation.set(0, 0, 0);
      child.position.y = 1.77;
    }
  });
}

function animateBatterWicket() {
  const stumps = batterWicket.children.filter(c => c.name === 'stump');
  const bails = batterWicket.children.filter(c => c.name === 'bail');
  stumps.forEach((stump, i) => {
    stump.rotation.z = (i - 1) * 0.58;
    stump.position.y = 0.58;
  });
  bails.forEach((bail, i) => {
    bail.position.y = 2.25 + i * 0.12;
    bail.rotation.z = i === 0 ? -1.25 : 1.25;
  });
}

function finishMatch() {
  game.active = false;
  game.finished = true;
  game.delivery = null;
  hitBtn.disabled = true;
  startOverBtn.textContent = 'PLAY AGAIN';
  const summary = game.runs > 0 ? `INNINGS COMPLETE — ${game.runs}/${game.wickets}` : `INNINGS COMPLETE — ${game.runs}/${game.wickets}`;
  showMessage(`${summary} · ${game.runs >= 20 ? 'BIG SCORE!' : 'WELL PLAYED!'}`, 'result-good');
}

function completeDelivery(outcome) {
  if (!game.delivery || game.resultLock) return;
  game.resultLock = true;
  game.active = false;
  hitBtn.disabled = true;
  game.delivery = null;

  if (outcome.type === 'wicket') {
    game.wickets += 1;
    animateBatterWicket();
    showMessage('BOWLED! THE BALL HITS THE STUMPS — OUT!', 'result-bad');
  } else {
    game.runs += outcome.runs;
    const label = outcome.runs === 0 ? 'DOT BALL' : `${outcome.runs} RUN${outcome.runs === 1 ? '' : 'S'}`;
    showMessage(`${outcome.grade} — ${label}`, outcome.runs >= 4 ? 'result-good' : '');
  }

  game.totalBalls += 1;
  game.legalBalls += 1;
  lastBallValue.textContent = outcome.type === 'wicket' ? 'W' : String(outcome.runs);
  updateScore();

  window.setTimeout(() => {
    game.resultLock = false;
    if (game.legalBalls >= 6) {
      finishMatch();
    } else {
      resetBatterWicket();
      resetBatterPose();
      showMessage(`BALL ${game.legalBalls + 1} OF 6 — GET READY`);
      window.setTimeout(() => {
        if (!game.finished && game.legalBalls < 6) bowlNextBall();
      }, 850);
    }
  }, 1300);
}

function registerHit() {
  if (!game.active || !game.delivery || game.delivery.phase !== 'flight' || game.delivery.hitAttempted || game.resultLock) return;
  const d = game.delivery;
  const pitchTime = (RELEASE_Z - PITCH_Z) / d.profile.speed;
  const expectedImpact = pitchTime + 0.19;
  const difference = Math.abs(d.flightElapsed - expectedImpact);
  d.hitAttempted = true;
  hitBtn.disabled = true;
  animateBatterShot('shot');
  playBatContact(1.0);

  // Fair but challenging timing windows. The ball is still allowed to pass
  // the contact point briefly before the miss is adjudicated.
  if (difference <= 0.10) {
    const roll = Math.random();
    const runs = roll < 0.10 ? 1 : roll < 0.35 ? 2 : roll < 0.82 ? 4 : 6;
    d.pendingOutcome = { type: 'runs', runs, grade: 'PERFECT CONTACT' };
  } else if (difference <= 0.21) {
    const roll = Math.random();
    const runs = roll < 0.35 ? 1 : roll < 0.82 ? 2 : 4;
    d.pendingOutcome = { type: 'runs', runs, grade: 'GOOD CONTACT' };
  } else if (difference <= 0.31) {
    d.pendingOutcome = { type: 'runs', runs: 1, grade: 'EDGE / LATE CONTACT' };
  } else {
    d.pendingOutcome = { type: 'wicket', runs: 0, grade: 'MISTIMED' };
    showMessage('MISTIMED! THE BALL IS BEATING THE BAT');
  }
}

function bowlNextBall() {
  if (game.finished || game.legalBalls >= 6) return;
  game.active = true;
  const profile = paceProfiles[selectedPace];
  game.delivery = {
    phase: 'runup',
    elapsed: 0,
    flightElapsed: 0,
    hitAttempted: false,
    pendingOutcome: null,
    profile,
    impactTime: profile.runup + 0.28 + (PITCH_Z - BATTER_Z) / profile.speed + 0.19
  };
  bowler.position.set(0, 0, RUNUP_START_Z);
  bowler.rotation.set(0, Math.PI, 0);
  const parts = bowler.userData;
  parts.armL.rotation.set(0, 0, 0);
  parts.armR.rotation.set(0, 0, 0);
  parts.legL.rotation.set(0, 0, 0);
  parts.legR.rotation.set(0, 0, 0);
  resetBallPosition();
  ball.visible = false;
  ballShadow.visible = false;
  hitBtn.disabled = true;
  showMessage(`BALL ${game.legalBalls + 1} OF 6 — BOWLER RUNNING IN`);
}

function startOver() {
  game.runs = 0;
  game.wickets = 0;
  game.legalBalls = 0;
  game.totalBalls = 0;
  game.active = false;
  game.delivery = null;
  game.resultLock = false;
  game.finished = false;
  lastBallValue.textContent = '—';
  startOverBtn.textContent = 'RESTART OVER';
  updateScore();
  resetBallPosition();
  resetBatterPose();
  resetBatterWicket();
  showMessage('GET READY — FIRST BALL');
  hitBtn.disabled = true;
  window.setTimeout(() => {
    if (!game.finished && game.legalBalls === 0) bowlNextBall();
  }, 900);
}

startOverBtn.disabled = true;
hitBtn.disabled = true;
window.addEventListener('keydown', event => {
  if (event.code === 'Space') {
    event.preventDefault();
    registerHit();
  }
});

// Animate the ball along the pitch. The user hits during the highlighted
// timing window around the impact moment.
function updateGameplay(delta) {
  if (!game.active || !game.delivery) return;
  const d = game.delivery;
  d.elapsed += delta;
  const parts = bowler.userData;

  if (d.phase === 'runup') {
    const t = Math.min(d.elapsed / d.profile.runup, 1);
    bowler.position.z = THREE.MathUtils.lerp(RUNUP_START_Z, 11.15, t);
    // Alternating running stride and arm pump.
    const stride = Math.sin(t * Math.PI * 8);
    parts.legL.rotation.x = stride * 0.62;
    parts.legR.rotation.x = -stride * 0.62;
    parts.armL.rotation.x = -stride * 0.48;
    parts.armR.rotation.x = stride * 0.48;
    bowler.position.y = Math.abs(Math.sin(t * Math.PI * 8)) * 0.07;
    if (t >= 1) {
      d.phase = 'gather';
      d.phaseElapsed = 0;
      showMessage('GATHER — DELIVERY STRIDE');
    }
    return;
  }

  if (d.phase === 'gather') {
    d.phaseElapsed += delta;
    const t = Math.min(d.phaseElapsed / 0.28, 1);
    // Bound, back-foot plant, front-foot plant and high arm preparation.
    bowler.position.z = 11.15 - 0.35 * t;
    bowler.position.y = Math.sin(t * Math.PI) * 0.42;
    parts.legL.rotation.x = -0.7 + t * 1.0;
    parts.legR.rotation.x = 0.8 - t * 0.65;
    parts.armL.rotation.z = -Math.PI * 0.82 * t;
    parts.armR.rotation.x = -1.1 * t;
    if (t >= 1) {
      d.phase = 'flight';
      d.flightElapsed = 0;
      d.releaseX = 0.42;
      d.releaseY = 2.65;
      ball.position.set(d.releaseX, d.releaseY, RELEASE_Z);
      ball.visible = true;
      ballShadow.visible = true;
      hitBtn.disabled = false;
      showMessage('BALL RELEASED — TIME YOUR SHOT');
      // Follow-through starts as the ball leaves the hand.
      parts.armL.rotation.z = -Math.PI * 1.35;
      parts.armR.rotation.x = 0.5;
      parts.legL.rotation.x = 0.5;
      parts.legR.rotation.x = -0.9;
    }
    return;
  }

  if (d.phase === 'flight') {
    d.flightElapsed += delta;
    const t = d.flightElapsed;
    const pitchTime = (RELEASE_Z - PITCH_Z) / d.profile.speed;
    const z = RELEASE_Z - d.profile.speed * t;
    let y;
    if (t <= pitchTime) {
      // Gravity curves the ball down to its first pitch.
      y = d.releaseY - 0.45 * t - 0.5 * d.profile.bounce * t * t;
    } else {
      // A visible bounce: impact compresses the vertical velocity and sends
      // the ball back upward while it continues towards the batter.
      const afterBounce = t - pitchTime;
      const pitchY = d.releaseY - 0.45 * pitchTime - 0.5 * 4.4 * pitchTime * pitchTime;
      y = Math.max(0.18, pitchY) + d.profile.bounce * 0.92 * afterBounce - 0.5 * d.profile.bounce * 1.8 * afterBounce * afterBounce;
    }
    const sideMovement = d.profile.line + Math.sin(t * 3.8) * 0.10;
    ball.position.set(sideMovement, Math.max(0.16, y), Math.max(BATTER_Z, z));
    ballShadow.position.set(sideMovement, 0.105, Math.max(BATTER_Z, z));
    const timeToImpact = Math.abs(t - d.impactTime + RUNUP_SECONDS + 0.28);
    // Impact time is measured from delivery start; convert to flight clock.
    const flightImpact = (RELEASE_Z - PITCH_Z) / d.profile.speed + 0.19;
    const remaining = Math.abs(t - flightImpact);
    if (remaining <= HIT_WINDOW_SECONDS && !d.hitAttempted) {
      ball.material.emissive = new THREE.Color(0x7b1717);
      ball.material.emissiveIntensity = 0.42;
      showMessage('NOW! PRESS SPACE / TAP HIT');
    } else {
      ball.material.emissiveIntensity = 0;
    }

    if (d.pendingOutcome && t >= flightImpact + 0.16) {
      const result = d.pendingOutcome;
      if (result.type === 'wicket') {
        d.phase = 'missed';
        d.missElapsed = 0;
        showMessage('BEATEN! BALL CRASHES INTO THE WICKET');
      } else {
        // The struck ball leaves the pitch on a rising arc.
        d.phase = 'hit';
        d.hitElapsed = 0;
        d.hitRuns = result;
        d.shotStart = ball.position.clone();
        d.shotSide = (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.75);
        d.shotDistance = result.runs === 1 ? 9 : result.runs === 2 ? 20 : result.runs === 4 ? 43 : 50;
        d.shotHeight = result.runs === 6 ? 8.5 : result.runs === 4 ? 0.38 : 0.18;
        showMessage(result.runs === 6 ? 'LOFTED SHOT! HIGH INTO THE AIR' : result.runs === 4 ? 'GROUND DRIVE! RACING TO THE BOUNDARY' : 'GROUND SHOT! RUNNING BETWEEN THE WICKETS');
      }
      return;
    }

    if (!d.hitAttempted && t >= flightImpact + 0.38) {
      d.phase = 'missed';
      d.missElapsed = 0;
      showMessage('MISSED! BALL IS HEADING FOR THE STUMPS');
      return;
    }
    return;
  }

  if (d.phase === 'missed') {
    d.missElapsed += delta;
    const t = Math.min(d.missElapsed / 0.32, 1);
    const z = THREE.MathUtils.lerp(BATTER_Z, -10.0, t);
    ball.position.set(0.42, 0.2 + 0.10 * Math.sin(t * Math.PI), z);
    ballShadow.position.set(0.42, 0.105, z);
    if (t >= 1) {
      ball.visible = false;
      completeDelivery({ type: 'wicket', runs: 0, grade: 'BOWLED' });
    }
    return;
  }

  if (d.phase === 'hit') {
    d.hitElapsed += delta;
    const result = d.hitRuns;
    const t = Math.min(d.hitElapsed / (result.runs === 6 ? 1.25 : 1.05), 1);
    const start = d.shotStart;
    const x = start.x + d.shotSide * t * (result.runs >= 4 ? 5.2 : 2.0);
    const z = start.z + d.shotDistance * t;
    const y = result.runs === 6
      ? d.shotHeight * 4 * t * (1 - t) + 0.35
      : result.runs === 4
        ? d.shotHeight * Math.sin(Math.PI * t) + 0.16
        : 0.16 + 0.10 * Math.abs(Math.sin(t * 13));
    ball.position.set(x, y, z);
    ballShadow.position.set(x, 0.105, z);
    if (t >= 1) {
      ball.visible = false;
      completeDelivery(result);
    }
    return;
  }
}


// STAGE 5: synchronized multiplayer 3D gameplay. The server decides the
// delivery result; both clients animate the same delivery and outcome.
let networkDelivery = null;
let networkResult = null;
let networkRole = 'spectator';
let wicketAnimation = 0;

function networkResetPose() {
  resetBatterWicket();
  resetBatterPose();
  ball.visible = false;
  ballShadow.visible = false;
  contactFlash.visible = false;
  contactFlashTime = 0;
  bowler.position.set(0, 0, 25);
}

function networkStartDelivery({ duration, pace }) {
  const speeds = { slow: 16.0, medium: 24.0, fast: 34.0 };
  networkResetPose();
  const speed = speeds[pace] || speeds.medium;
  networkDelivery = {
    elapsed: 0, duration: duration / 1000, runup: 0.28, gather: 0.10,
    speed, pace, phase: 'runup', result: null, queuedResult: null,
    resultElapsed: 0, contactDone: false
  };
  const parts = bowler.userData;
  parts.armL.rotation.set(0, 0, 0); parts.armR.rotation.set(0, 0, 0);
  parts.legL.rotation.set(0, 0, 0); parts.legR.rotation.set(0, 0, 0);
  ball.position.set(0.42, 2.55, RELEASE_Z);
  ball.visible = false; ballShadow.visible = false;
}

function networkSwing() {
  animateBatterShot('shot');
}

function networkResultReceived(outcome) {
  if (!networkDelivery) return;
  // Server is authoritative; hold the result until the rendered ball reaches
  // the batter so both clients see the same delivery-to-contact sequence.
  networkDelivery.queuedResult = outcome;
  if (networkDelivery.phase === 'await-result') {
    beginNetworkContact(networkDelivery, outcome);
  }
}

function beginNetworkContact(d, outcome) {
  if (!d || d.contactDone || d.phase === 'result') return;
  d.contactDone = true;
  d.result = outcome;
  d.resultStart = ball.position.clone();
  d.resultElapsed = 0;
  d.phase = 'result';
  contactFlash.position.copy(ball.position);
  contactFlash.visible = true;
  contactFlash.material.opacity = 0.95;
  contactFlash.scale.setScalar(0.65);
  contactFlashTime = 0.16;
  if (outcome.wicket) {
    playWicketImpact();
    d.resultType = 'wicket';
    animateBatterShot('miss');
  } else {
    const runs = outcome.runs || 0;
    playBatContact(runs >= 4 ? 1.2 : 0.9);
    if (runs >= 4) { playCrowdReaction(runs === 6 ? 1.8 : 1.2); playStadiumClap(); }
    d.resultType = runs >= 4 ? 'boundary' : 'ground';
    d.shotSide = outcome.direction || 1;
    d.shotDistance = runs === 6 ? 48 : runs === 4 ? 42 : runs === 2 ? 18 : 9;
  }
}

function updateNetworkGameplay(delta) {
  if (wicketAnimation > 0) {
    wicketAnimation = Math.max(0, wicketAnimation - delta);
  }
  if (contactFlashTime > 0) {
    contactFlashTime = Math.max(0, contactFlashTime - delta);
    contactFlash.material.opacity = contactFlashTime / 0.16;
    contactFlash.scale.multiplyScalar(1 + delta * 5.5);
    if (contactFlashTime <= 0) contactFlash.visible = false;
  }
  if (!networkDelivery) return;
  const d = networkDelivery;
  d.elapsed += delta;
  const parts = bowler.userData;
  if (d.phase === 'runup') {
    const t = Math.min(d.elapsed / d.runup, 1);
    bowler.position.z = THREE.MathUtils.lerp(25, 11.15, t);
    const stride = Math.sin(t * Math.PI * 7);
    parts.legL.rotation.x = stride * 0.72; parts.legR.rotation.x = -stride * 0.72;
    parts.armL.rotation.x = -stride * 0.68; parts.armR.rotation.x = stride * 0.68;
    parts.armL.rotation.z = -0.10 + Math.max(0, stride) * 0.12;
    parts.armR.rotation.z = 0.10 - Math.max(0, -stride) * 0.12;
    bowler.rotation.y = 0.04 * Math.sin(t * Math.PI * 2);
    bowler.position.y = Math.abs(stride) * 0.085;
    if (t >= 1) { d.phase = 'gather'; d.phaseElapsed = 0; }
    return;
  }
  if (d.phase === 'gather') {
    d.phaseElapsed += delta;
    const t = Math.min(d.phaseElapsed / d.gather, 1);
    bowler.position.z = 11.15 - t * 0.35;
    bowler.position.y = Math.sin(t * Math.PI) * 0.38;
    parts.legL.rotation.x = -0.7 + t; parts.legR.rotation.x = 0.8 - t * 0.6;
    parts.armL.rotation.z = -Math.PI * 0.82 * t;
    parts.armR.rotation.z = 0.12 + 0.28 * t;
    parts.armR.rotation.x = -1.05 * t;
    bowler.rotation.y = -0.12 * t;
    if (t >= 1) {
      d.phase = 'flight'; d.flightElapsed = 0;
      ball.position.set(0.42, 2.55, RELEASE_Z); ball.visible = true; ballShadow.visible = true;
      parts.armL.rotation.z = -Math.PI * 1.35;
    }
    return;
  }
  if (d.phase === 'flight') {
    d.flightElapsed += delta;
    // Flight reaches the batter at the same 78% timing point used by the
    // authoritative server. Gravity + one pitch bounce gives a readable arc.
    const flightDuration = Math.max(0.12, d.duration * 0.78 - d.runup - d.gather);
    const t = Math.min(d.flightElapsed / flightDuration, 1);
    const z = THREE.MathUtils.lerp(RELEASE_Z, -7.25, t);
    const bounceAt = 0.59;
    if (!d.bounceSoundPlayed && t >= bounceAt) { d.bounceSoundPlayed = true; playPitchBounce(); }
    let y;
    if (t < bounceAt) {
      const fallT = t / bounceAt;
      y = THREE.MathUtils.lerp(2.55, 0.17, fallT);
    } else {
      const reboundT = (t - bounceAt) / (1 - bounceAt);
      y = 0.17 + 0.92 * Math.sin(Math.PI * reboundT) * (1 - reboundT * 0.30);
    }
    const x = 0.42 + Math.sin(t * Math.PI * 2.2) * 0.10;
    ball.position.set(x, y, z);
    ball.rotation.x += delta * (d.pace === 'fast' ? 25 : d.pace === 'slow' ? 14 : 19);
    ball.rotation.z += delta * 12;
    ballShadow.position.set(x, 0.105, z);
    ballShadow.scale.setScalar(THREE.MathUtils.lerp(1.08, 0.62, t));
    // Delivery follow-through: bowling arm comes over the shoulder on release.
    const follow = THREE.MathUtils.clamp((t - 0.05) / 0.48, 0, 1);
    parts.armL.rotation.z = THREE.MathUtils.lerp(-Math.PI * 1.35, -0.25, follow);
    parts.armR.rotation.x = THREE.MathUtils.lerp(-1.05, 0.35, follow);
    bowler.rotation.y = THREE.MathUtils.lerp(-0.12, 0.08, follow);
    if (t >= 1) {
      ball.position.set(0.42, 0.30, -7.05);
      // Do not leave a missed ball frozen beside the bat. Carry it directly
      // through toward the stumps while the authoritative server result arrives.
      if (d.queuedResult) {
        beginNetworkContact(d, d.queuedResult);
      } else {
        d.phase = 'missed-flight';
        d.missedFlightElapsed = 0;
        d.missedFlightStart = ball.position.clone();
      }
    }
    return;
  }
  if (d.phase === 'missed-flight') {
    d.missedFlightElapsed += delta;
    const missT = Math.min(d.missedFlightElapsed / 0.24, 1);
    const eased = missT * missT * (3 - 2 * missT);
    const x = THREE.MathUtils.lerp(d.missedFlightStart.x, 0.42, eased);
    const y = THREE.MathUtils.lerp(d.missedFlightStart.y, 0.22, eased) + Math.sin(missT * Math.PI) * 0.08;
    const z = THREE.MathUtils.lerp(d.missedFlightStart.z, -10.1, eased);
    ball.position.set(x, y, z);
    ball.rotation.x += delta * 25;
    ball.rotation.z += delta * 15;
    ballShadow.position.set(x, 0.105, z);
    ballShadow.scale.setScalar(THREE.MathUtils.lerp(0.62, 0.48, eased));
    if (d.queuedResult) {
      beginNetworkContact(d, d.queuedResult);
    } else if (missT >= 1) {
      // Normally the server result has arrived by now; this is only a short
      // network-jitter fallback, never a wait beside the batter.
      d.phase = 'await-result';
    }
    return;
  }
  if (d.phase === 'await-result') {
    if (d.queuedResult) beginNetworkContact(d, d.queuedResult);
    return;
  }
  if (d.phase === 'result') {
    d.resultElapsed += delta;
    const t = Math.min(d.resultElapsed / (d.resultType === 'wicket' ? 0.32 : 1.05), 1);
    if (d.resultType === 'wicket') {
      ball.position.set(d.resultStart.x, THREE.MathUtils.lerp(d.resultStart.y, 0.22, t) + Math.sin(t * Math.PI) * 0.10, THREE.MathUtils.lerp(d.resultStart.z, -10.0, t));
      ball.rotation.x += delta * 22;
      if (t >= 1) {
        ball.visible = false;
        animateBatterWicket();
        networkDelivery = null;
      }
    } else {
      const runs = d.result.runs || 0;
      // Ballistic shot path: launch impulse, gravity, rolling/bounce for grounded hits.
      const elapsed = d.resultElapsed;
      const duration = runs === 6 ? 1.75 : runs === 4 ? 1.48 : runs === 2 ? 1.12 : 0.88;
      const vx = d.shotSide * (runs >= 4 ? 3.0 : 1.15);
      const vz = runs === 6 ? 24 : runs === 4 ? 22 : runs === 2 ? 15 : 9;
      const launchVy = runs === 6 ? 12.8 : runs === 4 ? 3.0 : runs === 2 ? 2.0 : 1.3;
      const x = d.resultStart.x + vx * elapsed;
      const z = d.resultStart.z + vz * elapsed;
      let y = d.resultStart.y + launchVy * elapsed - 0.5 * 9.81 * elapsed * elapsed;
      if (runs < 4 && y < 0.18) {
        y = 0.18 + Math.abs(Math.sin((elapsed - 0.30) * 15)) * 0.20 * Math.max(0, 1 - elapsed / duration);
        if (!d.resultBouncePlayed && elapsed > 0.30) { d.resultBouncePlayed = true; playPitchBounce(); }
      }
      ball.position.set(x, Math.max(0.16, y), z);
      ball.rotation.x += delta * (runs === 6 ? 30 : runs >= 4 ? 23 : 16);
      ball.rotation.z += delta * 15;
      ballShadow.position.set(x, 0.105, z);
      ballShadow.scale.setScalar(THREE.MathUtils.lerp(0.72, 0.20, Math.min(elapsed / duration, 1)));
      if (elapsed >= duration) { ball.visible = false; ballShadow.visible = false; networkDelivery = null; }
    }
  }
}

window.addEventListener('match:role', event => {
  // Preserve the player's manually selected camera when the role or delivery changes.
  networkRole = event.detail.role;
});
window.addEventListener('cricket:delivery-start', event => networkStartDelivery(event.detail));
window.addEventListener('cricket:batter-swing', networkSwing);
window.addEventListener('cricket:delivery-result', event => networkResultReceived(event.detail));

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
  lastFrameTime = now;
  if (networkDelivery) updateNetworkGameplay(delta);
  else updateGameplay(delta);
  updateBatterShot(delta);
  controls.update();
  renderer.render(scene, camera);
}
animate();
updateScore();
resetBallPosition();
showMessage('ONLINE 3D MATCH — WAITING FOR PLAYERS');

// Replace the earlier animation loop definition with the gameplay-aware one.
// (The initial loop is intentionally not started separately.)
