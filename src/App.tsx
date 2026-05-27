import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { Geometry, Base, Subtraction } from '@react-three/csg';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { create } from 'zustand';
import * as THREE from 'three';

type Axis = { offset: number; size: number };
type DslObject = {
  id: string;
  raw: string;
  styleRaw: string;
  x: Axis;
  y: Axis;
  z: Axis;
  color: string;
  border: boolean;
  radius: [number, number, number, number];
  status: 'accepted' | 'rejected';
  reason?: string;
};

type Aabb = { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };

const UNIT_SCALE = 0.33;
const ROOM_WIDTH = 24;
const ROOM_HEIGHT = 18;
const ROOM_DEPTH = 16;

const DEFAULT_INPUTS = [
  { dsl: '+2+4/+0+6/+1+3', style: 'color: red;' },
  { dsl: '+1+5/+7+6/+0+01', style: 'color: blue;' },
  { dsl: '+7+6/+0+15/+0+05', style: 'color: yellow;' },
];

const decodeDslNumber = (token: string): number => {
  if (/^0\d+$/.test(token)) return parseFloat(`0.${token.slice(1)}`);
  return parseInt(token, 10);
};

const parseDsl = (raw: string) => {
  const m = raw.trim().match(/^\+(\d+)\+(\d+)\/\+(\d+)\+(\d+)\/\+(\d+)\+(\d+)$/);
  if (!m) throw new Error('Invalid DSL format. Expected +a+b/+c+d/+e+f');
  return {
    x: { offset: decodeDslNumber(m[1]), size: decodeDslNumber(m[2]) },
    y: { offset: decodeDslNumber(m[3]), size: decodeDslNumber(m[4]) },
    z: { offset: decodeDslNumber(m[5]), size: decodeDslNumber(m[6]) },
  };
};

const parseRadius = (styleRaw: string): [number, number, number, number] => {
  const radiusRaw = styleRaw.match(/radius\s*:\s*([^;]+);?/i)?.[1];
  if (!radiusRaw) return [0, 0, 0, 0];

  const tokens = radiusRaw
    .trim()
    .split(/\s+/)
    .map((token) => Number.parseFloat(token))
    .filter((value) => Number.isFinite(value))
    .map((value) => Math.max(0, value));

  if (tokens.length === 0) return [0, 0, 0, 0];
  if (tokens.length === 1) return [tokens[0], tokens[0], tokens[0], tokens[0]];
  if (tokens.length === 2) return [tokens[0], tokens[1], tokens[0], tokens[1]];
  if (tokens.length === 3) return [tokens[0], tokens[1], tokens[2], tokens[1]];
  return [tokens[0], tokens[1], tokens[2], tokens[3]];
};

const parseStyle = (styleRaw: string) => {
  const color = styleRaw.match(/color\s*:\s*([^;]+);?/i)?.[1]?.trim() || '#bcbcbc';
  const border = /border\s*:/i.test(styleRaw);
  const radius = parseRadius(styleRaw);
  return { color, border, radius };
};


const buildRoundedRectShape = (width: number, height: number, radii: [number, number, number, number]) => {
  const halfW = width / 2;
  const halfH = height / 2;
  const shape = new THREE.Shape();

  const [topLeft, topRight, bottomRight, bottomLeft] = radii;

  shape.moveTo(-halfW + bottomLeft, -halfH);
  shape.lineTo(halfW - bottomRight, -halfH);
  shape.quadraticCurveTo(halfW, -halfH, halfW, -halfH + bottomRight);
  shape.lineTo(halfW, halfH - topRight);
  shape.quadraticCurveTo(halfW, halfH, halfW - topRight, halfH);
  shape.lineTo(-halfW + topLeft, halfH);
  shape.quadraticCurveTo(-halfW, halfH, -halfW, halfH - topLeft);
  shape.lineTo(-halfW, -halfH + bottomLeft);
  shape.quadraticCurveTo(-halfW, -halfH, -halfW + bottomLeft, -halfH);

  return shape;
};

const buildObjectGeometry = (size: readonly [number, number, number], radiusDsl: [number, number, number, number]) => {
  const [width, height, depth] = size;
  const maxRadius = Math.min(width, height) / 2;
  const radius = radiusDsl.map((value) => Math.min(value * UNIT_SCALE, maxRadius)) as [number, number, number, number];

  if (radius.every((value) => value <= 0)) {
    return new THREE.BoxGeometry(width, height, depth);
  }

  const shape = buildRoundedRectShape(width, height, radius);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 20,
  });

  geometry.translate(0, 0, -depth / 2);
  geometry.center();

  return geometry;
};

const toAabb = (obj: Pick<DslObject, 'x' | 'y' | 'z'>): Aabb => ({
  minX: obj.x.offset,
  maxX: obj.x.offset + obj.x.size,
  minY: obj.y.offset,
  maxY: obj.y.offset + obj.y.size,
  minZ: obj.z.offset,
  maxZ: obj.z.offset + obj.z.size,
});

const intersects = (a: Aabb, b: Aabb): boolean =>
  a.minX < b.maxX &&
  a.maxX > b.minX &&
  a.minY < b.maxY &&
  a.maxY > b.minY &&
  a.minZ < b.maxZ &&
  a.maxZ > b.minZ;

const isCutoutObject = (obj: Pick<DslObject, 'z'>): boolean => obj.z.offset === 0 && obj.z.size === 0;

type Store = {
  objects: DslObject[];
  addObject: (dsl: string, style: string) => void;
  removeObject: (id: string) => void;
};

const useSceneStore = create<Store>((set) => ({
  objects: [],
  addObject: (dsl, styleRaw) =>
    set((state) => {
      const id = crypto.randomUUID();
      try {
        const parsed = parseDsl(dsl);
        const style = parseStyle(styleRaw);
        const candidate: DslObject = {
          id,
          raw: dsl,
          styleRaw,
          ...parsed,
          ...style,
          status: 'accepted',
        };

        const candidateAabb = toAabb(candidate);
        const collision = state.objects.find((o) => o.status === 'accepted' && intersects(candidateAabb, toAabb(o)));

        if (collision) {
          return {
            objects: [
              ...state.objects,
              { ...candidate, status: 'rejected', reason: `Collides with ${collision.raw}` },
            ],
          };
        }

        return { objects: [...state.objects, candidate] };
      } catch (error) {
        return {
          objects: [
            ...state.objects,
            {
              id,
              raw: dsl,
              styleRaw,
              x: { offset: 0, size: 0 },
              y: { offset: 0, size: 0 },
              z: { offset: 0, size: 0 },
              color: '#bcbcbc',
              border: false,
              radius: [0, 0, 0, 0],
              status: 'rejected',
              reason: (error as Error).message,
            },
          ],
        };
      }
    }),
  removeObject: (id) => set((state) => ({ objects: state.objects.filter((o) => o.id !== id) })),
}));

function DefaultRoom() {
  const objects = useSceneStore((s) => s.objects);
  const wallCutouts = objects.filter((o) => o.status === 'accepted' && isCutoutObject(o));
  const wallThickness = 0.3;
  const wallCutDepth = wallThickness * 4;

  return (
    <>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[ROOM_WIDTH * UNIT_SCALE / 2, 0, ROOM_DEPTH * UNIT_SCALE / 2]}>
        <planeGeometry args={[ROOM_WIDTH * UNIT_SCALE, ROOM_DEPTH * UNIT_SCALE]} />
        <meshStandardMaterial color="#d7d2cb" roughness={0.85} />
      </mesh>

      <mesh receiveShadow position={[ROOM_WIDTH * UNIT_SCALE / 2, ROOM_HEIGHT * UNIT_SCALE / 2, -wallThickness / 2]}>
        <Geometry>
          <Base>
            <boxGeometry args={[ROOM_WIDTH * UNIT_SCALE, ROOM_HEIGHT * UNIT_SCALE, wallThickness]} />
          </Base>
          {wallCutouts.map((o) => {
            const cutoutSize = [o.x.size * UNIT_SCALE, o.y.size * UNIT_SCALE, wallCutDepth] as const;
            const cutoutCenter = [
              (o.x.offset + o.x.size / 2) * UNIT_SCALE - ROOM_WIDTH * UNIT_SCALE / 2,
              (o.y.offset + o.y.size / 2) * UNIT_SCALE - ROOM_HEIGHT * UNIT_SCALE / 2,
              0,
            ] as const;

            return (
              <Subtraction key={o.id} position={cutoutCenter}>
                <boxGeometry args={cutoutSize} />
              </Subtraction>
            );
          })}
        </Geometry>
        <meshStandardMaterial color="#f2f2f0" roughness={0.9} />
      </mesh>
    </>
  );
}

function SceneObject({ object }: { object: DslObject }) {
  const width = object.x.size * UNIT_SCALE;
  const height = object.y.size * UNIT_SCALE;
  const depth = object.z.size * UNIT_SCALE;
  const center = [
    (object.x.offset + object.x.size / 2) * UNIT_SCALE,
    (object.y.offset + object.y.size / 2) * UNIT_SCALE,
    (object.z.offset + object.z.size / 2) * UNIT_SCALE,
  ] as const;

  const geometry = useMemo(() => buildObjectGeometry([width, height, depth], object.radius), [width, height, depth, object.radius]);
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(geometry), [geometry]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      edgesGeometry.dispose();
    };
  }, [geometry, edgesGeometry]);

  return (
    <group>
      <mesh castShadow receiveShadow position={center} geometry={geometry}>
        <meshStandardMaterial color={object.color} roughness={0.6} metalness={0.05} />
      </mesh>
      {object.border && (
        <lineSegments position={center} geometry={edgesGeometry}>
          <lineBasicMaterial color="black" />
        </lineSegments>
      )}
    </group>
  );
}

function DslObjects() {
  const objects = useSceneStore((s) => s.objects);
  const acceptedObjects = objects.filter((o) => o.status === 'accepted');

  return (
    <>
      {acceptedObjects.map((o) => {
        if (isCutoutObject(o)) return null;

        return <SceneObject key={o.id} object={o} />;
      })}
    </>
  );
}

export default function App() {
  const [open, setOpen] = useState(true);
  const [dsl, setDsl] = useState('+2+4/+0+6/+1+3');
  const [style, setStyle] = useState('color: red;');

  const addObject = useSceneStore((s) => s.addObject);
  const removeObject = useSceneStore((s) => s.removeObject);
  const objects = useSceneStore((s) => s.objects);

  const seededDefaultsRef = useRef(false);

  useEffect(() => {
    if (seededDefaultsRef.current) return;
    if (objects.length > 0) {
      seededDefaultsRef.current = true;
      return;
    }

    DEFAULT_INPUTS.forEach((row) => addObject(row.dsl, row.style));
    seededDefaultsRef.current = true;
  }, [addObject, objects.length]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    addObject(dsl, style);
  };

  return (
    <div className="app-root">
      <Canvas shadows="basic" camera={{ position: [5, 4, 10], fov: 40 }}>
        <color attach="background" args={['#e6e7ea']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[8, 10, 8]} intensity={1} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <Environment preset="apartment" />
        <DefaultRoom />
        <DslObjects />
        <ContactShadows position={[ROOM_WIDTH * UNIT_SCALE / 2, 0.01, ROOM_DEPTH * UNIT_SCALE / 2]} scale={10} blur={2} opacity={0.45} />
        <OrbitControls target={[ROOM_WIDTH * UNIT_SCALE / 2, ROOM_HEIGHT * UNIT_SCALE / 3, 0]} minDistance={3} maxDistance={20} maxPolarAngle={Math.PI / 2.05} />
      </Canvas>

      <aside className={`drawer ${open ? 'open' : ''}`}>
        <button className="toggle" onClick={() => setOpen((v) => !v)}>{open ? 'Close' : 'Open'} DSL</button>
        {open && (
          <>
            <h2>DSL Input</h2>
            <form onSubmit={onSubmit}>
              <label>Object string</label>
              <input value={dsl} onChange={(e) => setDsl(e.target.value)} />
              <label>Style string</label>
              <input value={style} onChange={(e) => setStyle(e.target.value)} />
              <button type="submit">Add Object</button>
            </form>
            <div className="list">
              {objects.map((o) => (
                <div key={o.id} className={`item ${o.status}`}>
                  <code>{o.raw}</code>
                  <small>{o.styleRaw}</small>
                  <p>{o.status === 'accepted' ? 'Accepted' : `Rejected: ${o.reason}`}</p>
                  <button onClick={() => removeObject(o.id)}>Remove</button>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
