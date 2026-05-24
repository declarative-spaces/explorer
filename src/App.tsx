import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const BASE_VIEW_WIDTH = 9;
const VIEW_HEIGHT = 16;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const WORLD_WIDTH = 400;

const initialDSL = `"+2+4/+0+6/+1+3" : "color: red;"
"+1+5/+7+6/+0+01" : "color: blue;"
"+7+6/+0+15/+0+05" : "color: yellow;"`;

type SpatialObject = {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  styleText: string;
};

type ThreeCtx = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  controls: OrbitControls;
  objects: THREE.Group;
  frameId: number;
};

function parseCompactNumber(token: string): number {
  if (!/^\d+$/.test(token)) throw new Error(`Invalid number token: ${token}`);
  if (token === '0') return 0;
  if (token.startsWith('0')) return Number(`0.${token.slice(1)}`);
  return Number(token);
}

function parseDslLine(line: string, index: number): SpatialObject {
  const m = line.match(/^\s*"\+([0-9]+)\+([0-9]+)\/\+([0-9]+)\+([0-9]+)\/\+([0-9]+)\+([0-9]+)"\s*:\s*"([^"]*)"\s*;?\s*$/);
  if (!m) throw new Error(`Line ${index + 1}: invalid DSL format.`);
  const [, x, w, y, h, z, d, styleText] = m;
  return {
    id: `obj-${index}`,
    x: parseCompactNumber(x),
    width: parseCompactNumber(w),
    y: parseCompactNumber(y),
    height: parseCompactNumber(h),
    z: parseCompactNumber(z),
    depth: parseCompactNumber(d),
    styleText,
  };
}

function parseStyle(styleText: string): Record<string, string> {
  const out: Record<string, string> = {};
  styleText.split(';').map((x) => x.trim()).filter(Boolean).forEach((part) => {
    const [k, v] = part.split(':').map((s) => s?.trim());
    if (k && v) out[k] = v;
  });
  return out;
}

function overlaps(a: SpatialObject, b: SpatialObject): boolean {
  const ox = a.x < b.x + b.width && a.x + a.width > b.x;
  const oy = a.y < b.y + b.height && a.y + a.height > b.y;
  const oz = a.z < b.z + b.depth && a.z + a.depth > b.z;
  return ox && oy && oz;
}

function compose(lines: string[]): { parsed: SpatialObject[]; omittedCount: number } {
  const parsed: SpatialObject[] = [];
  let omittedCount = 0;
  lines.forEach((line, i) => {
    const obj = parseDslLine(line, i);
    if (parsed.some((existing) => overlaps(obj, existing))) {
      omittedCount += 1;
      return;
    }
    parsed.push(obj);
  });
  return { parsed, omittedCount };
}

function clampViewportX(x: number, zoom: number): number {
  const sliceWidth = BASE_VIEW_WIDTH / zoom;
  const maxX = Math.max(0, WORLD_WIDTH - sliceWidth);
  return THREE.MathUtils.clamp(x, 0, maxX);
}

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const threeRef = useRef<ThreeCtx | null>(null);

  const [dslText, setDslText] = useState(initialDSL);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewportX, setViewportX] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const [objects, setObjects] = useState<SpatialObject[]>([]);

  const sliceWidth = BASE_VIEW_WIDTH / zoom;
  const maxViewportX = Math.max(0, WORLD_WIDTH - sliceWidth);
  const sliceLabel = useMemo(() => `Slice x: ${viewportX.toFixed(2)} → ${(viewportX + sliceWidth).toFixed(2)} | zoom ${zoom.toFixed(2)}x`, [viewportX, sliceWidth, zoom]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x141414);

    const camera = new THREE.OrthographicCamera(0, BASE_VIEW_WIDTH, VIEW_HEIGHT, 0, 0.1, 200);
    camera.position.set(4.5, 8, 22);
    camera.lookAt(4.5, 8, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const keyLight = new THREE.DirectionalLight(0xfff3dd, 1.1);
    keyLight.position.set(20, 25, 25);
    keyLight.castShadow = true;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x9ec8ff, 0.45);
    rimLight.position.set(-12, 10, 20);
    scene.add(rimLight);

    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_WIDTH, 80),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.03 })
    );
    wall.position.set(WORLD_WIDTH / 2, 20, 0);
    wall.receiveShadow = true;
    scene.add(wall);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_WIDTH, 120),
      new THREE.MeshStandardMaterial({ color: 0x2d2d2d, roughness: 0.95, metalness: 0.05 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(WORLD_WIDTH / 2, 0, 30);
    floor.receiveShadow = true;
    scene.add(floor);

    const objectGroup = new THREE.Group();
    scene.add(objectGroup);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableRotate = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.target.set(4.5, 8, 0);
    controls.update();

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      const frameId = requestAnimationFrame(animate);
      if (threeRef.current) threeRef.current.frameId = frameId;
    };

    threeRef.current = { renderer, scene, camera, controls, objects: objectGroup, frameId: 0 };
    animate();

    const onResize = () => renderer.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      const ctx = threeRef.current;
      if (ctx) {
        cancelAnimationFrame(ctx.frameId);
        ctx.controls.dispose();
        ctx.renderer.dispose();
      }
      threeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    ctx.camera.left = viewportX;
    ctx.camera.right = viewportX + sliceWidth;
    ctx.camera.bottom = 0;
    ctx.camera.top = VIEW_HEIGHT;
    ctx.camera.zoom = zoom;
    ctx.camera.updateProjectionMatrix();
  }, [viewportX, zoom, sliceWidth]);

  useEffect(() => {
    setViewportX((prev) => clampViewportX(prev, zoom));
  }, [zoom]);

  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    while (ctx.objects.children.length) {
      const child = ctx.objects.children[0] as THREE.Mesh;
      if (child.geometry) child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
      ctx.objects.remove(child);
    }

    objects.forEach((obj) => {
      const style = parseStyle(obj.styleText);
      const depth = obj.depth === 0 ? 0.03 : obj.depth;
      const color = style.color ?? '#b9b9b9';

      const solid = new THREE.Mesh(
        new THREE.BoxGeometry(obj.width, obj.height, depth),
        new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.12 })
      );
      solid.castShadow = true;
      solid.receiveShadow = true;
      solid.position.set(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.z + depth / 2);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(obj.width, obj.height, depth)),
        new THREE.LineBasicMaterial({ color: 0x151515 })
      );
      edges.position.copy(solid.position);

      ctx.objects.add(solid);
      ctx.objects.add(edges);
    });
  }, [objects]);

  useEffect(() => {
    try {
      const lines = dslText.split('\n').map((x) => x.trim()).filter(Boolean);
      const out = compose(lines);
      setObjects(out.parsed);
      setError(out.omittedCount > 0 ? `${out.omittedCount} object(s) omitted due to collision.` : '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown parse error');
    }
  }, [dslText]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let panning = false;
    let lastX = 0;

    const onDown = (e: PointerEvent) => {
      panning = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!panning) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const unitsPerPixel = (BASE_VIEW_WIDTH / zoom) / window.innerWidth;
      setViewportX((prev) => clampViewportX(prev - dx * unitsPerPixel, zoom));
    };
    const onUp = () => {
      panning = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((prev) => THREE.MathUtils.clamp(prev * (e.deltaY > 0 ? 0.92 : 1.08), MIN_ZOOM, MAX_ZOOM));
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [zoom]);

  return (
    <main id="app">
      <canvas id="scene" ref={canvasRef} />
      <div id="hud">
        <div id="sliceInfo">{sliceLabel}</div>
        <button id="openDrawerBtn" aria-label="Open DSL drawer" onClick={() => setDrawerOpen(true)}>DSL</button>
      </div>

      <section id="scrollOverlay" aria-label="Horizontal viewer scroll control">
        <label htmlFor="scrollSlider">Horizontal scroll</label>
        <input
          id="scrollSlider"
          type="range"
          min={0}
          max={Math.max(0, maxViewportX)}
          step={0.01}
          value={viewportX}
          onChange={(e) => setViewportX(clampViewportX(Number(e.target.value), zoom))}
        />
      </section>

      <section id="drawer" className={drawerOpen ? '' : 'closed'} aria-label="DSL input drawer">
        <header>
          <h1>Spatial Object DSL</h1>
          <button id="closeDrawerBtn" onClick={() => setDrawerOpen(false)}>Close</button>
        </header>
        <p className="hint">Pan: drag on canvas or use slider. Zoom: mouse wheel/trackpad. Rotate: right-click drag.</p>
        <p className="hint">Format: <code>"+x+w/+y+h/+z+d" : "color: red;"</code></p>
        <textarea id="dslInput" value={dslText} onChange={(e) => setDslText(e.target.value)} spellCheck={false} />
        <div id="errors" role="alert">{error}</div>
        <div className="actions">
          <button onClick={() => { setViewportX(0); setZoom(1); }}>Reset View</button>
        </div>
      </section>
    </main>
  );
}
