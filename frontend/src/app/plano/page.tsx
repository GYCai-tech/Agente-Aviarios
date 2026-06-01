"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ── Tipos ─────────────────────────────────────────────────────────────────────

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

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f4f4f2;color:#1a1a1a}
.layout{display:grid;grid-template-columns:1fr 300px;grid-template-rows:auto 1fr;height:100vh;overflow:hidden}
.hdr{grid-column:1/-1;display:flex;align-items:center;gap:12px;padding:12px 20px;background:#000823;color:#fff;border-bottom:1px solid #1e2840}
.hdr-title{font-size:14px;font-weight:600;letter-spacing:.5px}
.hdr-sub{font-size:11px;color:#8899bb;margin-left:auto}
.hdr-back{font-size:11px;color:#7ab;text-decoration:none;margin-right:8px}
.hdr-back:hover{color:#adf}
.canvas-area{background:#e8e8e5;display:flex;align-items:center;justify-content:center;overflow:auto;padding:20px;position:relative}
.svg-wrap{background:#fff;border-radius:4px;box-shadow:0 2px 16px rgba(0,0,0,.15);display:inline-block;max-width:100%;max-height:100%}
.svg-wrap svg{display:block;width:100%;height:auto}
.loading-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(232,232,229,.7);font-size:13px;color:#555}
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
.btn-optimize{width:100%;padding:9px;background:#000823;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.5px;margin-bottom:8px}
.btn-optimize:hover{background:#1e2840}
.btn-export{width:100%;padding:9px;background:#fff;color:#000823;border:2px solid #000823;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.5px}
.btn-export:hover{background:#f0f0ee}
.metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.metric-card{background:#f7f7f5;border-radius:4px;padding:8px 10px;border:1px solid #eee}
.metric-val{font-size:18px;font-weight:700;font-family:monospace;color:#000823;line-height:1.1}
.metric-val.is-ok{color:#234926}
.metric-val.is-warn{color:#b05000}
.metric-lbl{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-top:2px}
.metric-wide{grid-column:1/-1}
.warn-box{background:#fff8e8;border:1px solid #e0c050;border-radius:4px;padding:8px 10px;font-size:11px;color:#7a5800;margin-top:8px}
.dims-row{display:flex;gap:6px;align-items:center;padding:10px 16px;background:#f7f7f5;border-bottom:1px solid #eee}
.dims-badge{font-size:12px;font-family:monospace;color:#000823;font-weight:600}
.dims-sep{color:#bbb;font-size:11px}
`;

// ── Página ────────────────────────────────────────────────────────────────────

export default function PlanoPage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8005";

  const [cfg, setCfg] = useState<LayoutConfig>({
    ancho_nave_m: 14,
    largo_nave_m: 33,
    tipo_zona: "aviario",
    sistema: "suelo",
    num_filas: 0,
    mods_por_fila: 0,
    clearance_pared_m: 0.85,
    pasillo_m: 1.20,
    clearance_lateral_m: 0.30,
    gallinas: 0,
  });

  const [svg, setSvg]           = useState<string>("");
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga dims desde localStorage si vienen de la propuesta
  useEffect(() => {
    try {
      const raw = localStorage.getItem("gc_propuesta");
      if (raw) {
        const data = JSON.parse(raw);
        const ancho = data.ancho_nave ? parseFloat(data.ancho_nave) : 0;
        const largo = data.largo_nave ? parseFloat(data.largo_nave) : 0;
        const tipo  = data.tipo_zona ?? "aviario";
        const gal   = data.gallinas  ? parseInt(data.gallinas)  : 0;
        setCfg(prev => ({
          ...prev,
          ancho_nave_m: ancho || prev.ancho_nave_m,
          largo_nave_m: largo || prev.largo_nave_m,
          tipo_zona: tipo,
          sistema: data.sistema ?? prev.sistema,
          nombre_cliente: data.nombre_cliente ?? prev.nombre_cliente,
          gallinas: gal || prev.gallinas,
        }));
      }
    } catch { /* noop */ }
  }, []);

  const fetchPlano = useCallback(async (config: LayoutConfig) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${backendUrl}/plano-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSvg(data.svg);
      setMetricas(data.metricas);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al generar plano");
    } finally {
      setLoading(false);
    }
  }, [backendUrl]);

  // Refetch debounced on cfg change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPlano(cfg), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cfg, fetchPlano]);

  function set<K extends keyof LayoutConfig>(key: K, val: LayoutConfig[K]) {
    setCfg(prev => ({ ...prev, [key]: val }));
  }

  function optimize() {
    // Resetear a auto-optimize (0 = calcular óptimo)
    setCfg(prev => ({ ...prev, num_filas: 0, mods_por_fila: 0 }));
  }

  function exportSvg() {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "plano-aviario.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  const nFil = metricas?.num_filas  ?? cfg.num_filas;
  const nMod = metricas?.mods_por_fila ?? cfg.mods_por_fila;

  return (
    <>
      <style>{CSS}</style>
      <div className="layout">

        {/* Header */}
        <header className="hdr">
          <a href="/propuesta" className="hdr-back">← Propuesta</a>
          <span className="hdr-title">Editor de plano</span>
          <span className="hdr-sub">
            {cfg.ancho_nave_m} × {cfg.largo_nave_m} m &nbsp;·&nbsp;
            {cfg.tipo_zona === "aviario" ? "Aviario Industrial" : "A-Nida Plus"}
          </span>
        </header>

        {/* Canvas */}
        <main className="canvas-area">
          {loading && <div className="loading-overlay">Generando plano…</div>}
          {error && !loading && (
            <div style={{ color: "#c00", fontSize: 13, background: "#fff", padding: 16, borderRadius: 4 }}>
              Error: {error}
            </div>
          )}
          {svg && !error && (
            <div className="svg-wrap" dangerouslySetInnerHTML={{ __html: svg }} />
          )}
        </main>

        {/* Panel de control */}
        <aside className="panel">

          {/* Dimensiones de nave */}
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
            <div className="section-title">Layout de módulos</div>
            <div className="field-row">
              <div className="field">
                <label>Nº filas</label>
                <input type="number" min={1} max={6} step={1}
                  value={nFil || ""}
                  placeholder="Auto"
                  onChange={e => set("num_filas", parseInt(e.target.value) || 0)} />
              </div>
              <div className="field">
                <label>Módulos/fila</label>
                <input type="number" min={1} max={80} step={1}
                  value={nMod || ""}
                  placeholder="Auto"
                  onChange={e => set("mods_por_fila", parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          <div className="panel-section">
            <div className="section-title">Clearances (m)</div>
            <div className="field">
              <label>Clearance paredes superior/inferior</label>
              <div className="slider-wrap">
                <input type="range" min={0.3} max={2.5} step={0.05}
                  value={cfg.clearance_pared_m}
                  onChange={e => set("clearance_pared_m", parseFloat(e.target.value))} />
                <span className="slider-val">{cfg.clearance_pared_m.toFixed(2)}</span>
              </div>
            </div>
            <div className="field">
              <label>Pasillo entre filas</label>
              <div className="slider-wrap">
                <input type="range" min={0.5} max={3.0} step={0.05}
                  value={cfg.pasillo_m}
                  onChange={e => set("pasillo_m", parseFloat(e.target.value))} />
                <span className="slider-val">{cfg.pasillo_m.toFixed(2)}</span>
              </div>
            </div>
            <div className="field">
              <label>Clearance lateral (izq+der)</label>
              <div className="slider-wrap">
                <input type="range" min={0} max={3.0} step={0.05}
                  value={cfg.clearance_lateral_m}
                  onChange={e => set("clearance_lateral_m", parseFloat(e.target.value))} />
                <span className="slider-val">{cfg.clearance_lateral_m.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Métricas */}
          {metricas && (
            <div className="panel-section">
              <div className="section-title">Métricas</div>
              <div className="metrics">
                <div className="metric-card">
                  <div className="metric-val">{metricas.total_modulos}</div>
                  <div className="metric-lbl">Módulos</div>
                </div>
                <div className="metric-card">
                  <div className={`metric-val ${metricas.densidad <= 9 ? "is-ok" : "is-warn"}`}>
                    {metricas.densidad.toFixed(1)}
                  </div>
                  <div className="metric-lbl">gal/m² (lím. 9)</div>
                </div>
                <div className="metric-card">
                  <div className="metric-val">{metricas.gallinas_max.toLocaleString("es-ES")}</div>
                  <div className="metric-lbl">Aves (60/mód.)</div>
                </div>
                <div className="metric-card">
                  <div className="metric-val">{metricas.yacija_m2.toFixed(0)}</div>
                  <div className="metric-lbl">m² yacija</div>
                </div>
                {metricas.espacio_libre_y_m > 0.1 && (
                  <div className="metric-card metric-wide">
                    <div className="warn-box">
                      Espacio libre en Y: <strong>{metricas.espacio_libre_y_m.toFixed(2)} m</strong>.
                      Puedes añadir {Math.floor((metricas.espacio_libre_y_m + metricas.pasillo_m) / (3.30 + metricas.pasillo_m))} fila(s) más o reducir clearances.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Acciones */}
          <div className="panel-section">
            <button className="btn-optimize" onClick={optimize}>
              ⟳ Optimizar layout automáticamente
            </button>
            <button className="btn-export" onClick={exportSvg} disabled={!svg}>
              ↓ Exportar SVG
            </button>
          </div>

        </aside>
      </div>
    </>
  );
}
