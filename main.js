import * as THREE from 'https://unpkg.com/three@0.166.1/build/three.module.js';

const VIEW_WIDTH = 9;
const VIEW_HEIGHT = 16;

const initialDSL = `"+2+4/+0+6/+1+3" : "color: red;"
"+1+5/+7+6/+0+01" : "color: blue;"
"+7+6/+0+15/+0+05" : "color: yellow;"`;

const state = {
  viewportX: 0,
  objects: [],
  omitted: [],
};

const canvas = document.getElementById('scene');
const drawer = document.getElementById('drawer');
const dslInput = document.getElementById('dslInput');
const errorsEl = document.getElementById('errors');
const sliceInfo = document.getElementById('sliceInfo');

dslInput.value = initialDSL;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.OrthographicCamera(0, VIEW_WIDTH, VIEW_HEIGHT, 0, -100, 100);
camera.position.set(0, 0, 30);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dir = new THREE.DirectionalLight(0xffffff, 0.5);
dir.position.set(5, 10, 20);
scene.add(dir);

const wallMat = new THREE.MeshStandardMaterial({ color: 0xf6f6f6, roughness: 0.9 });
const wall = new THREE.Mesh(new THREE.PlaneGeometry(300, 40), wallMat);
wall.position.set(150, 8, -0.02);
scene.add(wall);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 80),
  new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.set(150, 0, 15);
scene.add(floor);

const objectGroup = new THREE.Group();
scene.add(objectGroup);

function parseCompactNumber(token) {
  if (!/^\d+$/.test(token)) throw new Error(`Invalid number token: ${token}`);
  if (token === '0') return 0;
  if (token.startsWith('0')) return Number(`0.${token.slice(1)}`);
  return Number(token);
}

function parseDslLine(line, index) {
  const m = line.match(/^\s*"\+([0-9]+)\+([0-9]+)\/\+([0-9]+)\+([0-9]+)\/\+([0-9]+)\+([0-9]+)"\s*:\s*"([^"]*)"\s*;?\s*$/);
  if (!m) throw new Error(`Line ${index + 1}: invalid DSL format.`);
  const [_, x, w, y, h, z, d, styleText] = m;
  return {
    id: `obj-${index}`,
    x: parseCompactNumber(x),
    width: parseCompactNumber(w),
    y: parseCompactNumber(y),
    height: parseCompactNumber(h),
    z: parseCompactNumber(z),
    depth: parseCompactNumber(d),
    styleText,
    createdAt: index,
  };
}

function parseStyle(styleText) {
  const out = {};
  styleText.split(';').map(x => x.trim()).filter(Boolean).forEach((part) => {
    const [k, v] = part.split(':').map(s => s?.trim());
    if (!k || !v) return;
    out[k] = v;
  });
  return out;
}

function overlaps(a, b) {
  const ox = a.x < b.x + b.width && a.x + a.width > b.x;
  const oy = a.y < b.y + b.height && a.y + a.height > b.y;
  const oz = a.z < b.z + b.depth && a.z + a.depth > b.z;
  return ox && oy && oz;
}

function validateAndCompose(lines) {
  const parsed = [];
  const omitted = [];
  lines.forEach((line, i) => {
    const obj = parseDslLine(line, i);
    const collides = parsed.some((existing) => overlaps(obj, existing));
    if (collides) omitted.push({ obj, reason: 'collision' });
    else parsed.push(obj);
  });
  return { parsed, omitted };
}

function buildObjectMesh(obj) {
  const style = parseStyle(obj.styleText);
  const color = style.color || '#cccccc';
  const depth = obj.depth === 0 ? 0.03 : obj.depth;

  const geom = new THREE.BoxGeometry(obj.width, obj.height, depth);
  const mat = new THREE.MeshStandardMaterial({ color, wireframe: true });
  const mesh = new THREE.Mesh(geom, mat);

  mesh.position.set(
    obj.x + obj.width / 2,
    obj.y + obj.height / 2,
    obj.z + depth / 2
  );
  return mesh;
}

function renderObjects() {
  while (objectGroup.children.length) objectGroup.remove(objectGroup.children[0]);
  state.objects.forEach((o) => objectGroup.add(buildObjectMesh(o)));
}

function updateCamera() {
  camera.left = state.viewportX;
  camera.right = state.viewportX + VIEW_WIDTH;
  camera.bottom = 0;
  camera.top = VIEW_HEIGHT;
  camera.updateProjectionMatrix();
  sliceInfo.textContent = `Slice x: ${state.viewportX.toFixed(2)} → ${(state.viewportX + VIEW_WIDTH).toFixed(2)}`;
}

function applyFromInput() {
  const lines = dslInput.value.split('\n').map((x) => x.trim()).filter(Boolean);
  try {
    const { parsed, omitted } = validateAndCompose(lines);
    state.objects = parsed;
    state.omitted = omitted;
    renderObjects();
    errorsEl.textContent = omitted.length ? `${omitted.length} object(s) omitted due to collision.` : '';
  } catch (err) {
    errorsEl.textContent = err.message;
  }
}

function animate() {
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let panning = false;
let lastX = 0;
canvas.addEventListener('pointerdown', (e) => {
  panning = true;
  lastX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!panning) return;
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  const unitsPerPixel = VIEW_WIDTH / window.innerWidth;
  state.viewportX = Math.max(0, state.viewportX - dx * unitsPerPixel);
  updateCamera();
});
canvas.addEventListener('pointerup', () => (panning = false));
canvas.addEventListener('pointercancel', () => (panning = false));

document.getElementById('openDrawerBtn').addEventListener('click', () => drawer.classList.remove('closed'));
document.getElementById('closeDrawerBtn').addEventListener('click', () => drawer.classList.add('closed'));
document.getElementById('applyBtn').addEventListener('click', applyFromInput);
document.getElementById('resetBtn').addEventListener('click', () => {
  state.viewportX = 0;
  updateCamera();
});

updateCamera();
applyFromInput();
