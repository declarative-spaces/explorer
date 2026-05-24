'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import WireframeViewport from './components/WireframeViewport';

const DEFAULT_DSL = `+2+4/+0+6/+1+3 | A small dark wood side table with curved legs and a couple drawers
+1+5/+7+6/+0+01 | A framed mirror
+7+6/+0+15/+0+05 | A metal door`;

export default function HomePage() {
  const [dslInput, setDslInput] = useState(DEFAULT_DSL);
  const [cameraX, setCameraX] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [mode, setMode] = useState('wireframe');
  const abortRef = useRef(null);

  const entries = useMemo(() => dslInput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [spec, ...descParts] = line.split('|');
      return [spec.trim(), descParts.join('|').trim() || 'Unnamed object'];
    }), [dslInput]);

  async function renderScene(cameraValue = cameraX) {
    if (mode !== 'generated') return;

    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('Rendering generated image...');
    try {
      const response = await fetch('/api/scene/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries, cameraX: cameraValue }),
        signal: controller.signal
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'render failed');

      setImageUrl(data.image.url);
      setStatus(`${data.visible.length} visible object(s)\n${data.rejected.length} rejected due to collision\n\nPrompt:\n${data.prompt}`);
    } catch (error) {
      if (error.name !== 'AbortError') setStatus(`Error: ${error.message}`);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => {
      renderScene(cameraX);
    }, 350);

    return () => clearTimeout(timeout);
  }, [cameraX, dslInput, mode]);

  return (
    <main style={{ width: '100vw', height: '100vh', background: '#111', color: '#eee', overflow: 'hidden', position: 'relative' }}>
      {mode === 'wireframe' ? (
        <WireframeViewport entries={entries} cameraX={cameraX} />
      ) : (
        imageUrl && <img src={imageUrl} alt="Generated wall slice" style={{ width: '100vw', height: '100vh', objectFit: 'cover' }} />
      )}

      <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 10, alignItems: 'center', background: '#0008', padding: 8, borderRadius: 8 }}>
        <button onClick={() => setDrawerOpen((v) => !v)}>DSL</button>
        <button onClick={() => setMode((m) => (m === 'wireframe' ? 'generated' : 'wireframe'))}>
          Mode: {mode}
        </button>
        <label>
          cameraX
          <input
            type="range"
            min="0"
            max="30"
            value={cameraX}
            step="0.1"
            onChange={(e) => setCameraX(Number(e.target.value))}
          />
        </label>
        <span>{cameraX.toFixed(1)}</span>
        {mode === 'generated' && <button onClick={() => renderScene(cameraX)}>Render</button>}
      </div>

      {drawerOpen && (
        <section style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#1c1c1c', maxHeight: '45vh', padding: 12, borderTop: '1px solid #444' }}>
          <h2>DSL Entries</h2>
          <textarea
            value={dslInput}
            onChange={(e) => setDslInput(e.target.value)}
            style={{ width: '100%', minHeight: 130, background: '#111', color: '#ddd' }}
          />
          <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 130, overflow: 'auto' }}>{status || 'Wireframe mode renders locally with Three.js. Switch to generated mode for OpenAI output.'}</pre>
        </section>
      )}
    </main>
  );
}
