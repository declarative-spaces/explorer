import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const VIEW_WIDTH = 9;
const VIEW_HEIGHT = 16;

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
    if (!k || !v) return;
    out[k] = v;
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

export function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const threeRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.OrthographicCamera; objects: THREE.Group } | null>(null);

  const [dslText, setDslText] = useState(initialDSL);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [viewportX, setViewportX] = useState(0);
  const [error, setError] = useState('');
  const [objects, setObjects] = useState<SpatialObject[]>([]);

  const sliceLabel = useMemo(() => `Slice x: ${viewportX.toFixed(2)} → ${(viewportX + VIEW_WIDTH).toFixed(2)}`, [viewportX]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
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

    const wall = new THREE.Mesh(new THREE.PlaneGeometry(300, 40), new THREE.MeshStandardMaterial({ color: 0xf6f6f6, roughness: 0.9 }));
    wall.position.set(150, 8, -0.02);
    scene.add(wall);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 80), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(150, 0, 15);
    scene.add(floor);

    const objectGroup = new THREE.Group();
    scene.add(objectGroup);

    threeRef.current = { renderer, scene, camera, objects: objectGroup };

    const tick = () => {
      renderer.render(scene, camera);
      requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => renderer.setSize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    ctx.camera.left = viewportX;
    ctx.camera.right = viewportX + VIEW_WIDTH;
    ctx.camera.bottom = 0;
    ctx.camera.top = VIEW_HEIGHT;
    ctx.camera.updateProjectionMatrix();
  }, [viewportX]);

  useEffect(() => {
    const ctx = threeRef.current;
    if (!ctx) return;
    while (ctx.objects.children.length) ctx.objects.remove(ctx.objects.children[0]);
    objects.forEach((obj) => {
      const style = parseStyle(obj.styleText);
      const depth = obj.depth === 0 ? 0.03 : obj.depth;
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(obj.width, obj.height, depth),
        new THREE.MeshStandardMaterial({ color: style.color ?? '#cccccc', wireframe: true })
      );
      mesh.position.set(obj.x + obj.width / 2, obj.y + obj.height / 2, obj.z + depth / 2);
      ctx.objects.add(mesh);
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
      const unitsPerPixel = VIEW_WIDTH / window.innerWidth;
      setViewportX((prev) => Math.max(0, prev - dx * unitsPerPixel));
    };
    const onUp = () => {
      panning = false;
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <main id="app">
      <canvas id="scene" ref={canvasRef} />
      <div id="hud">
        <div id="sliceInfo">{sliceLabel}</div>
        <button id="openDrawerBtn" aria-label="Open DSL drawer" onClick={() => setDrawerOpen(true)}>DSL</button>
      </div>
      <section id="drawer" className={drawerOpen ? '' : 'closed'} aria-label="DSL input drawer">
        <header>
          <h1>Spatial Object DSL</h1>
          <button id="closeDrawerBtn" onClick={() => setDrawerOpen(false)}>Close</button>
        </header>
        <p className="hint">Format: <code>"+x+w/+y+h/+z+d" : "color: red;"</code></p>
        <textarea id="dslInput" value={dslText} onChange={(e) => setDslText(e.target.value)} spellCheck={false} />
        <div id="errors" role="alert">{error}</div>
        <div className="actions">
          <button onClick={() => setViewportX(0)}>Reset View</button>
        </div>
      </section>
    </main>
  );
}
