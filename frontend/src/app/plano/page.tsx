"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import JourneyHeader from "../JourneyHeader";

interface LayoutConfig {
  ancho_nave_m: number;
  largo_nave_m: number;
  tipo_zona: "aviario" | "nidal_colectivo";
  sistema: string;
  num_filas: number;
  mods_por_fila: number;
  clearance_pared_m: number;
  pasillo_m: number;
  clearance_lateral_m: number;
  nombre_cliente?: string;
  gallinas: number;
  niveles?: number;
  ancho_alero_m: number;
}

interface Metricas {
  num_filas: number;
  mods_por_fila: number;
  total_modulos: number;
  gallinas_max: number;
  huella_m2: number;
  yacija_m2: number;
  densidad: number;
  espacio_libre_y_m: number;
  clearance_pared_m: number;
  pasillo_m: number;
  clearance_lateral_m: number;
}

// Dimensiones internas del SVG generado por el backend
const SVG_W = 1100;
const SVG_H = 720;
const PAD = 32; // margen interior del canvas

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f4f2;color:#1a1a1a}
.layout{display:flex;flex-direction:column;height:100vh;overflow:hidden}

.body{flex:1 1 0;display:grid;grid-template-columns:1fr 300px;min-height:0}
.canvas-area{background:#e8e8e5;overflow:hidden;position:relative;cursor:grab;min-height:0}
.canvas-area:active{cursor:grabbing}

.loading-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(232,232,229,.7);font-size:13px;color:#555;z-index:10;pointer-events:none}
.error-box{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#c00;font-size:13px;background:#fff;padding:16px;border-radius:4px;z-index:10}
.zoom-controls{position:absolute;bottom:16px;left:16px;display:flex;gap:4px;z-index:10}
.zoom-btn{width:30px;height:30px;background:#fff;border:1px solid #ccc;border-radius:4px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#333;box-shadow:0 1px 4px rgba(0,0,0,.12)}
.zoom-btn:hover{background:#f0f0ee;border-color:#999}
.zoom-label{height:30px;padding:0 8px;background:#fff;border:1px solid #ccc;border-radius:4px;font-size:11px;font-family:monospace;color:#555;display:flex;align-items:center;min-width:44px;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.12)}
.panel{background:#fff;border-left:1px solid #ddd;display:flex;flex-direction:column;overflow-y:auto}
.panel-section{padding:16px;border-bottom:1px solid #eee}
.panel-section:last-child{border-bottom:none}
.section-title{font-size:10px;font-weight:700;letter-spacing:1px;color:#888;text-transform:uppercase;margin-bottom:12px}
.field{margin-bottom:12px}
.field label{display:block;font-size:11px;color:#555;margin-bottom:4px;font-weight:500}
.field input[type=number]{width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px;font-family:monospace;background:#fafafa}
.field input[type=number]:focus{outline:none;border-color:#000823;background:#fff}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.slider-wrap{display:flex;align-items:center;gap:8px}
.slider-wrap input[type=range]{flex:1;accent-color:#000823}
.slider-val{font-size:12px;font-family:monospace;color:#333;min-width:40px;text-align:right}

.btn-primary{width:100%;padding:9px;background:#000823;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.5px;margin-bottom:8px}
.btn-primary:hover{background:#1e2840}
.btn-secondary{width:100%;padding:9px;background:#fff;color:#000823;border:2px solid #000823;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.5px}
.btn-secondary:hover{background:#f0f0ee}
.metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.metric-card{background:#f7f7f5;border-radius:4px;padding:8px 10px;border:1px solid #eee}
.metric-val{font-size:18px;font-weight:700;font-family:monospace;color:#000823;line-height:1.1}
.metric-val.ok{color:#234926}
.metric-val.warn{color:#b05000}
.metric-lbl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.metric-wide{grid-column:1/-1}
.warn-box{background:#fff8e8;border:1px solid #e0c050;border-radius:4px;padding:8px 10px;font-size:11px;color:#7a5800;margin-top:8px}
.dims-row{display:flex;gap:6px;align-items:center;padding:10px 16px;background:#f7f7f5;border-bottom:1px solid #eee}
.dims-badge{font-size:12px;font-family:monospace;color:#000823;font-weight:600}
.dims-sep{color:#bbb;font-size:11px}
`;

export default function PlanoPage() {
  const [cfg, setCfg] = useState<LayoutConfig>({
    ancho_nave_m: 14,
    largo_nave_m: 33,
    tipo_zona: "aviario",
    sistema: "suelo",
    num_filas: 0,
    mods_por_fila: 0,
    clearance_pared_m: 0.85,
    pasillo_m: 1.20,
    clearance_lateral_m: 4.00,
    gallinas: 0,
    niveles: 2,
    ancho_alero_m: 0,
  });

  const [svg, setSvg]           = useState<string>("");
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [scale, setScale]           = useState(0.8);
  const [pan, setPan]               = useState({ x: 0, y: 0 });

  const canvasRef  = useRef<HTMLDivElement>(null);
  const debounce   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging   = useRef(false);
  const dragStart  = useRef({ mx: 0, my: 0, px: 0, py: 0 });

  // Escala inicial calculada según el tamaño real del canvas
  function fitScale() {
    const el = canvasRef.current;
    if (!el) return 0.8;
    const { width, height } = el.getBoundingClientRect();
    return Math.min((width - PAD * 2) / SVG_W, (height - PAD * 2) / SVG_H, 1);
  }

  function fitToCanvas() {
    setScale(fitScale());
    setPan({ x: 0, y: 0 });
  }

  // Medir canvas tras montaje y ajustar escala
  useLayoutEffect(() => {
    setScale(fitScale());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ajustar escala cuando llega el primer SVG
  const svgLoaded = useRef(false);
  useEffect(() => {
    if (svg && !svgLoaded.current) {
      svgLoaded.current = true;
      setScale(fitScale());
      setPan({ x: 0, y: 0 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svg]);

  // Leer dims desde localStorage (propuesta previa)
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gc_propuesta");
      if (!raw) return;
      const data = JSON.parse(raw);
      setCfg(prev => ({
        ...prev,
        ancho_nave_m:  parseFloat(data.ancho_nave) || prev.ancho_nave_m,
        largo_nave_m:  parseFloat(data.largo_nave) || prev.largo_nave_m,
        tipo_zona:     data.tipo_zona ?? prev.tipo_zona,
        sistema:       data.sistema   ?? prev.sistema,
        nombre_cliente: data.nombre_cliente ?? prev.nombre_cliente,
        gallinas:      parseInt(data.gallinas) || prev.gallinas,
        niveles:       parseInt(data.niveles) || 2,
      }));
    } catch { /* noop */ }
  }, []);

  // Zoom con rueda
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      setScale(s => Math.min(8, Math.max(0.05, s * f)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging.current) return;
    setPan({
      x: dragStart.current.px + (e.clientX - dragStart.current.mx),
      y: dragStart.current.py + (e.clientY - dragStart.current.my),
    });
  }
  function onMouseUp() { dragging.current = false; }

  // Fetch plano
  const fetchPlano = useCallback(async (config: LayoutConfig) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plano-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSvg(data.svg ?? "");
      if (data.metricas) setMetricas(data.metricas);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al generar plano");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => fetchPlano(cfg), 400);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [cfg, fetchPlano]);

  function set<K extends keyof LayoutConfig>(key: K, val: LayoutConfig[K]) {
    setCfg(prev => ({ ...prev, [key]: val }));
  }

  function exportSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "plano-layout.svg"; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const cliente = cfg.nombre_cliente ?? "Plano layout";
    const tipo    = cfg.tipo_zona === "aviario" ? "Aviario Industrial" : "A-Nida Plus";
    const titulo  = `${cliente} — ${tipo} ${cfg.ancho_nave_m}×${cfg.largo_nave_m} m`;
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${titulo}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #fff; }
    h1 { font-size: 11pt; font-weight: 600; color: #000823; margin-bottom: 6px; }
    svg { width: 100%; height: auto; display: block; }
    @media screen { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>${titulo}</h1>
  ${svg}
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const nFil = metricas?.num_filas      ?? cfg.num_filas;
  const nMod = metricas?.mods_por_fila  ?? cfg.mods_por_fila;

  return (
    <>
      <style>{CSS}</style>
      <div className="layout">

        <JourneyHeader activeStep={5} />

        <div className="body">

          {/* ── Canvas ─────────────────────────────────────────────────── */}
          <div className="canvas-area" ref={canvasRef}
            onMouseDown={onMouseDown} onMouseMove={onMouseMove}
            onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          >
            {loading && (
              <div className="loading-overlay">Generando plano…</div>
            )}

            {error && !loading && (
              <div className="error-box">Error: {error}</div>
            )}

            {/* SVG centrado con transform zoom/pan */}
            {svg && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: SVG_W,
                  height: SVG_H,
                  marginLeft: -(SVG_W / 2),
                  marginTop: -(SVG_H / 2),
                  transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`,
                  transformOrigin: "center center",
                  boxShadow: "0 2px 20px rgba(0,0,0,.18)",
                  borderRadius: 3,
                  overflow: "hidden",
                  lineHeight: 0,
                }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}

            <div className="zoom-controls">
              <button className="zoom-btn" title="Acercar"
                onClick={() => setScale(s => Math.min(8, s * 1.25))}>+</button>
              <button className="zoom-btn" title="Alejar"
                onClick={() => setScale(s => Math.max(0.05, s / 1.25))}>−</button>
              <button className="zoom-btn" title="Ajustar vista" style={{ fontSize: 11 }}
                onClick={fitToCanvas}>⊙</button>
              <span className="zoom-label">{Math.round(scale * 100)}%</span>
            </div>
          </div>

          {/* ── Panel ──────────────────────────────────────────────────── */}
          <aside className="panel">

            <div className="dims-row">
              <span className="dims-badge">{cfg.ancho_nave_m} m</span>
              <span className="dims-sep">×</span>
              <span className="dims-badge">{cfg.largo_nave_m} m</span>
            </div>

            <div className="panel-section">
              <div className="section-title">Dimensiones nave</div>
              <div className="field-row">
                <div className="field">
                  <label>Ancho (m)</label>
                  <input type="number" min={6} max={30} step={0.5}
                    value={cfg.ancho_nave_m}
                    onChange={e => set("ancho_nave_m", parseFloat(e.target.value) || cfg.ancho_nave_m)} />
                </div>
                <div className="field">
                  <label>Largo (m)</label>
                  <input type="number" min={10} max={200} step={1}
                    value={cfg.largo_nave_m}
                    onChange={e => set("largo_nave_m", parseFloat(e.target.value) || cfg.largo_nave_m)} />
                </div>
              </div>
            </div>

            <div className="panel-section">
              <div className="section-title">Tipo de instalación</div>
              <div className="field-row">
                {(["aviario", "nidal_colectivo"] as const).map(t => (
                  <button key={t}
                    onClick={() => set("tipo_zona", t)}
                    style={{
                      padding: "6px 0", fontSize: 11, cursor: "pointer", borderRadius: 4,
                      fontWeight: 600, letterSpacing: ".3px",
                      background: cfg.tipo_zona === t ? "#000823" : "#f0f0ee",
                      color: cfg.tipo_zona === t ? "#fff" : "#555",
                      border: cfg.tipo_zona === t ? "none" : "1px solid #ddd",
                    }}>
                    {t === "aviario" ? "Aviario" : "A-Nida"}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel-section">
              <div className="section-title">Layout</div>
              {cfg.tipo_zona === "nidal_colectivo" ? (
                <>
                  <div className="field">
                    <label>Número de módulos (0 = Auto)</label>
                    <input type="number" min={0} max={80} step={1}
                      value={nMod || ""} placeholder="Auto (máx. físico)"
                      onChange={e => set("mods_por_fila", parseInt(e.target.value) || 0)} />
                  </div>
                </>
              ) : (
                <div className="field-row">
                  <div className="field">
                    <label>Nº filas</label>
                    <input type="number" min={1} max={8} step={1}
                      value={nFil || ""} placeholder="Auto"
                      onChange={e => set("num_filas", parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="field">
                    <label>Mód./fila</label>
                    <input type="number" min={1} max={80} step={1}
                      value={nMod || ""} placeholder="Auto"
                      onChange={e => set("mods_por_fila", parseInt(e.target.value) || 0)} />
                  </div>
                </div>
              )}
              <div className="field">
                <label>Gallinas</label>
                <input type="number" min={0} max={999999} step={100}
                  value={cfg.gallinas || ""} placeholder="0"
                  onChange={e => set("gallinas", parseInt(e.target.value) || 0)} />
              </div>
              <div className="field">
                <label>Zona exterior — ancho (m)</label>
                <input type="number" min={0} max={50} step={0.5}
                  value={cfg.ancho_alero_m || ""} placeholder="0 = sin exterior"
                  onChange={e => set("ancho_alero_m", parseFloat(e.target.value) || 0)} />
              </div>
            </div>

            {cfg.tipo_zona === "aviario" && (
            <div className="panel-section">
              <div className="section-title">Clearances</div>
              <div className="field">
                <label>Zona equipos lateral — mín. 4 m</label>
                <div className="slider-wrap">
                  <input type="range" min={4.0} max={8.0} step={0.25}
                    value={cfg.clearance_lateral_m}
                    onChange={e => set("clearance_lateral_m", parseFloat(e.target.value))} />
                  <span className="slider-val">{cfg.clearance_lateral_m.toFixed(2)}</span>
                </div>
              </div>
              <div className="field">
                <label>Clearance paredes long. (m)</label>
                <div className="slider-wrap">
                  <input type="range" min={0.3} max={2.5} step={0.05}
                    value={cfg.clearance_pared_m}
                    onChange={e => set("clearance_pared_m", parseFloat(e.target.value))} />
                  <span className="slider-val">{cfg.clearance_pared_m.toFixed(2)}</span>
                </div>
              </div>
              <div className="field">
                <label>Pasillo entre filas (m)</label>
                <div className="slider-wrap">
                  <input type="range" min={0.5} max={3.0} step={0.05}
                    value={cfg.pasillo_m}
                    onChange={e => set("pasillo_m", parseFloat(e.target.value))} />
                  <span className="slider-val">{cfg.pasillo_m.toFixed(2)}</span>
                </div>
              </div>
            </div>
            )}

            {metricas && (
              <div className="panel-section">
                <div className="section-title">Métricas</div>
                <div className="metrics">
                  <div className="metric-card">
                    <div className="metric-val">{metricas.total_modulos}</div>
                    <div className="metric-lbl">Módulos</div>
                  </div>
                  <div className="metric-card">
                    <div className={`metric-val ${metricas.densidad <= 9 ? "ok" : "warn"}`}>
                      {metricas.densidad.toFixed(1)}
                    </div>
                    <div className="metric-lbl">gal/m² (lím. 9)</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-val">{metricas.gallinas_max.toLocaleString("es-ES")}</div>
                    <div className="metric-lbl">Aves máx.</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-val">{metricas.yacija_m2.toFixed(0)}</div>
                    <div className="metric-lbl">m² yacija</div>
                  </div>
                  {metricas.espacio_libre_y_m > 0.1 && (
                    <div className="metric-card metric-wide">
                      <div className="warn-box">
                        Espacio libre: <strong>{metricas.espacio_libre_y_m.toFixed(2)} m</strong> en ancho.
                        Caben {Math.floor((metricas.espacio_libre_y_m + metricas.pasillo_m) / (3.30 + metricas.pasillo_m))} fila(s) más.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="panel-section">
              <button className="btn-primary"
                onClick={() => { set("num_filas", 0); set("mods_por_fila", 0); }}>
                ⟳ Optimizar layout
              </button>
              <button className="btn-secondary"
                onClick={exportPdf}
                disabled={!svg}>
                ↓ Exportar PDF
              </button>
              <button className="btn-secondary"
                onClick={exportSvg}
                disabled={!svg}
                style={{ marginTop: 6 }}>
                ↓ Exportar SVG
              </button>
            </div>

          </aside>
        </div>
      </div>
    </>
  );
}
