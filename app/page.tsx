"use client";

import { useMemo, useState } from "react";

type Entry = { coord: string; label: string };

const starter: Entry[] = [
  { coord: "++X+++/Y+++/+Z+++", label: "A small dark wood side table with curved legs and a couple drawers" },
  { coord: "++X+++/++++++Y++++/Z", label: "A framed mirror" }
];

export default function Page() {
  const [entries, setEntries] = useState<Entry[]>(starter);
  const [imageB64, setImageB64] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const canRender = useMemo(() => entries.every((e) => e.coord.trim() && e.label.trim()), [entries]);

  const update = (i: number, key: keyof Entry, value: string) => {
    const next = [...entries];
    next[i] = { ...next[i], [key]: value };
    setEntries(next);
  };

  const addRow = () => setEntries((prev) => [...prev, { coord: "X/Y/Z", label: "" }]);
  const removeRow = (i: number) => setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const renderScene = async () => {
    setLoading(true);
    setWarnings([]);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Render failed");
      setWarnings(data.warnings || []);
      setImageB64(data.imageBase64);
    } catch (e) {
      setWarnings([e instanceof Error ? e.message : "Unknown error"]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 12 }}>
      <section style={{ width: "min(420px, 100vw)", aspectRatio: "9 / 16", position: "relative", borderRadius: 16, overflow: "hidden", background: "#1b1b1d" }}>
        {imageB64 ? (
          <img alt="generated interior" src={`data:image/png;base64,${imageB64}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "#999", padding: 16, textAlign: "center" }}>
            Empty wall section preview. Add DSL entries and render.
          </div>
        )}

        <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, background: "rgba(0,0,0,0.65)", borderRadius: 12, padding: 8, maxHeight: "52%", overflowY: "auto" }}>
          {entries.map((e, i) => (
            <div key={i} style={{ marginBottom: 8, borderBottom: "1px solid #333", paddingBottom: 8 }}>
              <input value={e.coord} onChange={(ev) => update(i, "coord", ev.target.value)} placeholder="coord" style={{ width: "100%", marginBottom: 6 }} />
              <textarea value={e.label} onChange={(ev) => update(i, "label", ev.target.value)} placeholder="object description" rows={2} style={{ width: "100%" }} />
              <button onClick={() => removeRow(i)}>Remove</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addRow}>Add</button>
            <button disabled={!canRender || loading} onClick={renderScene}>{loading ? "Rendering..." : "Render"}</button>
          </div>
          {!!warnings.length && <ul>{warnings.map((w, i) => <li key={i} style={{ color: "#ffd27f" }}>{w}</li>)}</ul>}
        </div>
      </section>
    </main>
  );
}
