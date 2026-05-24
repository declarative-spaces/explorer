'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const VIEWPORT_W = 9;
const VIEWPORT_H = 16;

function clipObjects(entries, cameraX) {
  return entries.map(([spec, description], idx) => {
    const parts = spec.split('/');
    const parsePair = (segment) => {
      const m = segment.match(/^\+(\d+)\+(\d+)$/);
      if (!m) return null;
      const parseNum = (raw) => (raw.length > 1 && raw.startsWith('0') ? Number(`0.${raw.slice(1)}`) : Number(raw));
      return [parseNum(m[1]), parseNum(m[2])];
    };
    const p1 = parsePair(parts[0] || '');
    const p2 = parsePair(parts[1] || '');
    const p3 = parsePair(parts[2] || '');
    if (!p1 || !p2 || !p3) return null;
    const [x, width] = p1;
    const [y, height] = p2;
    const [z, depth] = p3;

    const visibleStart = Math.max(x, cameraX);
    const visibleEnd = Math.min(x + width, cameraX + VIEWPORT_W);
    const visibleWidth = visibleEnd - visibleStart;
    if (visibleWidth <= 0) return null;

    return {
      id: `obj_${idx + 1}`,
      description,
      x,
      y,
      z,
      width,
      height,
      depth,
      screenX: visibleStart - cameraX,
      visibleWidth
    };
  }).filter(Boolean);
}

export default function WireframeViewport({ entries, cameraX }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const container = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#101317');

    const camera = new THREE.OrthographicCamera(0, VIEWPORT_W, VIEWPORT_H, 0, -100, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const frameMat = new THREE.LineBasicMaterial({ color: 0x5f6b7a });
    const frameGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(VIEWPORT_W, 0, 0),
      new THREE.Vector3(VIEWPORT_W, VIEWPORT_H, 0),
      new THREE.Vector3(0, VIEWPORT_H, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    scene.add(new THREE.Line(frameGeom, frameMat));

    const visibleObjects = clipObjects(entries, cameraX);
    visibleObjects.forEach((obj, index) => {
      const depth = Math.max(obj.depth, 0.02);
      const geometry = new THREE.BoxGeometry(obj.visibleWidth, obj.height, depth);
      const edges = new THREE.EdgesGeometry(geometry);
      const color = new THREE.Color(`hsl(${(index * 57) % 360}, 65%, 62%)`);
      const material = new THREE.LineBasicMaterial({ color });
      const line = new THREE.LineSegments(edges, material);

      line.position.set(
        obj.screenX + obj.visibleWidth / 2,
        VIEWPORT_H - (obj.y + obj.height / 2),
        -obj.z - depth / 2
      );
      scene.add(line);
    });

    const onResize = () => {
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.render(scene, camera);
    };

    window.addEventListener('resize', onResize);
    renderer.render(scene, camera);

    return () => {
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    };
  }, [entries, cameraX]);

  return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />;
}
