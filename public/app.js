const defaultDsl = `+2+4/+0+6/+1+3 | A small dark wood side table with curved legs and a couple drawers
+1+5/+7+6/+0+01 | A framed mirror
+7+6/+0+15/+0+05 | A metal door`;

const viewer = document.getElementById('viewer');
const dslInput = document.getElementById('dslInput');
const renderBtn = document.getElementById('renderBtn');
const status = document.getElementById('status');
const camera = document.getElementById('cameraX');
const cameraLabel = document.getElementById('cameraLabel');
const drawerToggle = document.getElementById('drawerToggle');
const drawer = document.getElementById('drawer');

let debounceTimer;
let lastAbort;

dslInput.value = defaultDsl;

function parseEntriesFromText() {
  return dslInput.value.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [spec, ...descParts] = line.split('|');
    return [spec.trim(), descParts.join('|').trim() || 'Unnamed object'];
  });
}

async function renderScene() {
  if (lastAbort) lastAbort.abort();
  lastAbort = new AbortController();

  const entries = parseEntriesFromText();
  const payload = { entries, cameraX: Number(camera.value) };
  cameraLabel.textContent = Number(camera.value).toFixed(1);

  try {
    status.textContent = 'Rendering...';
    const response = await fetch('/api/scene/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: lastAbort.signal
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'render failed');
    viewer.src = data.image.url;
    status.textContent = `${data.visible.length} visible object(s)\n${data.rejected.length} rejected due to collision\n\nPrompt:\n${data.prompt}`;
  } catch (err) {
    if (err.name === 'AbortError') return;
    status.textContent = `Error: ${err.message}`;
  }
}

camera.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderScene, 350);
});

renderBtn.addEventListener('click', renderScene);
drawerToggle.addEventListener('click', () => drawer.classList.toggle('open'));

let panStartX = null;
document.addEventListener('pointerdown', (e) => { panStartX = e.clientX; });
document.addEventListener('pointerup', () => { panStartX = null; });
document.addEventListener('pointermove', (e) => {
  if (panStartX === null) return;
  const delta = (panStartX - e.clientX) * 0.02;
  const next = Math.max(Number(camera.min), Math.min(Number(camera.max), Number(camera.value) + delta));
  camera.value = String(next);
  panStartX = e.clientX;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(renderScene, 350);
});

renderScene();
