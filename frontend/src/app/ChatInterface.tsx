"use client";

import { useState } from "react";
import {
  solicitarIntake,
  pedirRecomendacion,
  type DatosIntake,
  type IntakeResponse,
  type Recomendacion,
  type TipoZona,
  type Sistema,
} from "./actions";

type Step = "main" | "loading_rec" | "recomendacion" | "loading" | "result";

const SISTEMAS_LABEL = ["En suelo", "Campero", "Ecológico", "Jaulas enriquecidas"] as const;
type SistemaLabel = (typeof SISTEMAS_LABEL)[number];

const SISTEMA_MAP: Record<SistemaLabel, Sistema> = {
  "En suelo":           "suelo",
  "Campero":            "campero",
  "Ecológico":          "ecologico",
  "Jaulas enriquecidas":"jaulas",
};

const STEPS = [
  { key: "main",          label: "Proyecto" },
  { key: "recomendacion", label: "Sistema" },
  { key: "result",        label: "Informe" },
] as const;

const SECTION_LABELS: Record<string, string> = {
  VEREDICTO: "Veredicto",
  CAPACIDAD: "Capacidad",
  REQUISITOS: "Requisitos adicionales",
};

function renderMd(text: string): string {
  return text
    .replace(/##(\w+)##/g, (_, key) => {
      const label = SECTION_LABELS[key] ?? key;
      return `<span style="display:block;font-size:0.68rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4F764D;margin-top:1.4rem;margin-bottom:0.35rem;font-family:'Montserrat',sans-serif">${label}</span>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

export default function ChatInterface() {
  const [step, setStep]           = useState<Step>("main");
  const [mainV, setMain]          = useState<Record<string, string>>({});
  const [rec, setRec]             = useState<Recomendacion | null>(null);
  const [tipoZona, setTipoZona]   = useState<TipoZona | null>(null);
  const [resultado, setRes]       = useState<IntakeResponse | null>(null);
  const [animKey, setAnim]        = useState(0);

  const sistemaLabel = mainV.sistema as SistemaLabel | undefined;
  const sistemaApi   = sistemaLabel ? SISTEMA_MAP[sistemaLabel] : undefined;
  const esJaulas     = sistemaApi === "jaulas";

  function go(next: Step) { setAnim((k) => k + 1); setStep(next); }

  async function onMainSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (esJaulas) {
      go("loading");
      try {
        const datos: DatosIntake = {
          num_gallinas:       parseInt(mainV.gallinas),
          sistema:            sistemaApi!,
          superficie_nave_m2: parseFloat(mainV.superficie_nave_m2),
          altura_nave_cm:     parseFloat(mainV.altura_nave_cm),
          tipo_zona:          "nidal_colectivo",
        };
        setRes(await solicitarIntake(datos));
      } catch { setRes(null); }
      go("result");
      return;
    }
    go("loading_rec");
    try {
      const r = await pedirRecomendacion({
        num_gallinas:       parseInt(mainV.gallinas),
        sistema:            sistemaApi!,
        superficie_nave_m2: parseFloat(mainV.superficie_nave_m2),
        altura_nave_cm:     parseFloat(mainV.altura_nave_cm),
      });
      setRec(r);
      setTipoZona(r.tipo_zona);
    } catch { setRec(null); }
    go("recomendacion");
  }

  async function onConfirmar(zona: TipoZona) {
    go("loading");
    try {
      const datos: DatosIntake = {
        num_gallinas:       parseInt(mainV.gallinas),
        sistema:            sistemaApi!,
        superficie_nave_m2: parseFloat(mainV.superficie_nave_m2),
        altura_nave_cm:     parseFloat(mainV.altura_nave_cm),
        tipo_zona:          zona,
      };
      const res = await solicitarIntake(datos);
      setRes(res);
      if (typeof window !== "undefined") {
        localStorage.setItem("gc_propuesta", JSON.stringify({
          informe: res.informe,
          argumentario_ventas: res.argumentario_ventas,
          argumentos_producto: res.argumentos_producto ?? [],
          gallinas: mainV.gallinas,
          sistema: sistemaApi,
          superficie: mainV.superficie_nave_m2,
          altura: mainV.altura_nave_cm,
          tipo_zona: zona,
        }));
      }
    } catch { setRes(null); }
    go("result");
  }

  function reset() { setMain({}); setRec(null); setTipoZona(null); setRes(null); go("main"); }

  const stepIdx = { main: 0, loading_rec: 1, recomendacion: 1, loading: 2, result: 2 }[step];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&family=Source+Sans+3:wght@300;400;500;600&display=swap');

        /* ── GYC brand tokens ── */
        :root {
          --gyc-green:       #4F764D;
          --gyc-green-hover: #3d5e3b;
          --gyc-blue:        #0274BE;
          --gyc-text:        #808285;
          --gyc-dark:        #3a3a3a;
          --gyc-border:      #e7e7e7;
          --gyc-bg:          #ffffff;
          --gyc-bg-alt:      #f5f5f5;
        }

        .avi-root { font-family: 'Source Sans 3', 'Source Sans Pro', sans-serif; background: var(--gyc-bg); min-height: 100vh; color: var(--gyc-text); }
        .avi-header { padding: 2.5rem 2rem 0; max-width: 760px; margin: 0 auto; }
        .avi-eyebrow { font-size: 0.72rem; color: var(--gyc-green); margin-bottom: 0.4rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; }
        .avi-title { font-family: 'Montserrat', sans-serif; font-size: clamp(1.8rem, 4vw, 2.5rem); font-weight: 800; color: var(--gyc-dark); letter-spacing: -0.01em; line-height: 1em; }
        .avi-tagline { font-size: 1rem; color: var(--gyc-text); margin-top: 0.6rem; font-weight: 300; line-height: 1.65; }
        .avi-divider { height: 2px; background: var(--gyc-green); width: 48px; margin: 1.25rem 0 1.5rem; }
        .avi-main { max-width: 760px; margin: 0 auto; padding: 0 2rem 4rem; }

        @keyframes stepIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .avi-step { animation: stepIn 0.24s ease forwards; }

        .avi-progress { display: flex; align-items: center; margin-bottom: 2.5rem; }
        .avi-prog-item { display: flex; align-items: center; gap: 0.5rem; }
        .avi-prog-circle { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--gyc-border); background: #fff; font-size: 0.68rem; font-weight: 700; color: #bbb; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
        .avi-prog-circle.active { border-color: var(--gyc-dark); background: var(--gyc-dark); color: #fff; }
        .avi-prog-circle.done   { border-color: var(--gyc-green); background: var(--gyc-green); color: #fff; }
        .avi-prog-label { font-size: 0.7rem; color: #bbb; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600; }
        .avi-prog-label.active { color: var(--gyc-dark); }
        .avi-prog-line { flex: 1; height: 1px; background: var(--gyc-border); margin: 0 0.6rem; min-width: 16px; }

        .avi-form-title    { font-family: 'Montserrat', sans-serif; font-size: 1.3rem; font-weight: 800; color: var(--gyc-dark); margin-bottom: 0.3rem; line-height: 1em; }
        .avi-form-subtitle { font-size: 0.92rem; color: var(--gyc-text); margin-bottom: 1.75rem; font-weight: 300; line-height: 1.65; }
        .avi-field { margin-bottom: 1.1rem; }
        .avi-label { display: block; font-size: 0.72rem; font-weight: 700; color: var(--gyc-dark); margin-bottom: 0.4rem; letter-spacing: 0.08em; text-transform: uppercase; }
        .avi-input-wrap { position: relative; display: flex; align-items: center; }
        .avi-unit { position: absolute; right: 0.9rem; font-size: 0.82rem; color: #bbb; pointer-events: none; }
        .avi-select, .avi-input { width: 100%; background: #fff; border: 1px solid var(--gyc-border); border-radius: 2px; padding: 0.7rem 0.9rem; font-family: 'Source Sans 3', sans-serif; font-size: 0.95rem; color: var(--gyc-dark); outline: none; transition: border-color 0.15s, box-shadow 0.15s; box-sizing: border-box; }
        .avi-input.has-unit { padding-right: 3.5rem; }
        .avi-select { appearance: none; -webkit-appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23808285' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 0.9rem center; padding-right: 2.2rem; }
        .avi-select:focus, .avi-input:focus { border-color: var(--gyc-green); box-shadow: 0 0 0 3px rgba(79,118,77,0.1); }
        .avi-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 520px) { .avi-row { grid-template-columns: 1fr; } }
        .avi-sep { display: flex; align-items: center; gap: 0.75rem; margin: 1.5rem 0 1.1rem; }
        .avi-sep span { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #bbb; white-space: nowrap; }
        .avi-sep::before, .avi-sep::after { content: ""; flex: 1; height: 1px; background: var(--gyc-border); }

        .avi-btn-row { display: flex; align-items: center; gap: 1rem; margin-top: 2rem; flex-wrap: wrap; }
        .avi-btn-primary { background: var(--gyc-green); color: #fff; border: none; border-radius: 0; padding: 0.85rem 1.9rem; font-family: 'Source Sans 3', sans-serif; font-size: 0.9rem; font-weight: 600; cursor: pointer; letter-spacing: 0.05em; text-transform: uppercase; transition: background 0.15s; display: inline-flex; align-items: center; gap: 0.5rem; }
        .avi-btn-primary:hover { background: var(--gyc-green-hover); }
        .avi-btn-primary:disabled { opacity: 0.4; cursor: default; }
        .avi-btn-ghost { background: transparent; border: 1px solid var(--gyc-border); color: var(--gyc-text); border-radius: 0; padding: 0.85rem 1.4rem; font-family: 'Source Sans 3', sans-serif; font-size: 0.9rem; cursor: pointer; letter-spacing: 0.04em; transition: border-color 0.15s, color 0.15s; }
        .avi-btn-ghost:hover { border-color: var(--gyc-dark); color: var(--gyc-dark); }
        .avi-back { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.72rem; color: var(--gyc-text); cursor: pointer; border: none; background: none; padding: 0; margin-bottom: 1.75rem; transition: color 0.15s; font-family: 'Source Sans 3', sans-serif; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }
        .avi-back:hover { color: var(--gyc-green); }
        .avi-badge { display: inline-block; padding: 0.25rem 0.75rem; background: #edf3ec; color: var(--gyc-green); border-radius: 0; font-size: 0.75rem; font-weight: 600; margin-bottom: 1.5rem; letter-spacing: 0.04em; }

        @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
        .avi-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; gap: 1.5rem; }
        .avi-loading-dots { display: flex; gap: 10px; }
        .avi-loading-dots span { width: 10px; height: 10px; border-radius: 50%; background: var(--gyc-green); animation: pulse 1.3s ease infinite; }
        .avi-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .avi-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        .avi-loading-text { font-size: 0.88rem; color: var(--gyc-text); font-style: italic; }

        .avi-result-wrap { overflow: hidden; border: 1px solid var(--gyc-border); margin-bottom: 1.5rem; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }

        .avi-summary-bar { padding: 1.4rem 1.75rem; display: flex; align-items: center; gap: 1.25rem; }
        .avi-summary-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .avi-summary-text strong { font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; display: block; opacity: 0.7; margin-bottom: 0.2rem; font-family: 'Source Sans 3', sans-serif; }
        .avi-summary-text span { font-family: 'Montserrat', sans-serif; font-size: 1.1rem; font-weight: 700; line-height: 1.2; }
        .avi-meta-strip { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem 1.75rem; background: rgba(0,0,0,0.15); }
        .avi-meta-pill { font-size: 0.74rem; font-weight: 500; padding: 0.2rem 0.65rem; border-radius: 0; background: rgba(255,255,255,0.14); color: rgba(255,255,255,0.85); letter-spacing: 0.03em; }

        .avi-table-block { background: #fff; }
        .avi-table-head { padding: 0.8rem 1.75rem; background: var(--gyc-bg-alt); border-bottom: 1px solid var(--gyc-border); display: flex; align-items: center; justify-content: space-between; }
        .avi-table-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gyc-text); }
        .avi-stats { display: flex; gap: 0.6rem; }
        .avi-stat { font-size: 0.72rem; font-weight: 700; padding: 0.15rem 0.55rem; border-radius: 0; letter-spacing: 0.04em; }
        .avi-stat.ok   { background: #edf3ec; color: #2E6B35; }
        .avi-stat.fail { background: #fdecea; color: #C0392B; }

        .avi-check-row { display: flex; align-items: center; padding: 0.75rem 1.75rem; border-bottom: 1px solid var(--gyc-border); gap: 0.75rem; }
        .avi-check-row:last-child { border-bottom: none; }
        .avi-check-icon { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .avi-check-icon.ok   { background: #edf3ec; }
        .avi-check-icon.fail { background: #fdecea; }
        .avi-check-name { flex: 1; font-size: 0.9rem; color: var(--gyc-dark); font-weight: 400; }
        .avi-check-vals { display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; flex-shrink: 0; }
        .avi-check-vals .real { color: var(--gyc-dark); font-weight: 600; }
        .avi-check-vals .sep  { color: var(--gyc-border); }
        .avi-check-vals .ref  { color: var(--gyc-text); }
        .avi-diff { font-size: 0.72rem; font-weight: 700; padding: 0.13rem 0.5rem; border-radius: 0; flex-shrink: 0; white-space: nowrap; letter-spacing: 0.03em; }
        .avi-diff.ok   { background: #edf3ec; color: #2E6B35; }
        .avi-diff.fail { background: #fdecea; color: #C0392B; }

        .avi-req-row { display: flex; align-items: flex-start; padding: 0.75rem 1.75rem; border-bottom: 1px solid var(--gyc-border); gap: 0.75rem; }
        .avi-req-row:last-child { border-bottom: none; }
        .avi-req-icon { width: 22px; height: 22px; border-radius: 50%; background: var(--gyc-bg-alt); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .avi-req-body { flex: 1; min-width: 0; }
        .avi-req-name { font-size: 0.9rem; color: var(--gyc-dark); font-weight: 400; }
        .avi-req-formula { font-size: 0.78rem; color: #bbb; margin-top: 0.1rem; font-style: italic; }
        .avi-req-value { font-size: 0.9rem; font-weight: 700; color: var(--gyc-dark); flex-shrink: 0; white-space: nowrap; }

        .avi-warn-block { background: #fffdf0; border-top: 2px solid #f5e580; }
        .avi-warn-head { padding: 0.8rem 1.75rem; background: #fdf9d6; border-bottom: 1px solid #f0e070; }
        .avi-warn-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #7a6500; }
        .avi-warn-row { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.85rem 1.75rem; border-bottom: 1px solid #f0e070; }
        .avi-warn-row:last-child { border-bottom: none; }
        .avi-warn-text { font-size: 0.88rem; color: #5a4a00; line-height: 1.65; }

        .avi-analysis-block { background: #fff; border-top: 1px solid var(--gyc-border); }
        .avi-analysis-head { padding: 0.8rem 1.75rem; background: var(--gyc-bg-alt); border-bottom: 1px solid var(--gyc-border); }
        .avi-analysis-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gyc-text); }
        .avi-analysis-body { padding: 1.4rem 1.75rem; font-size: 0.95rem; line-height: 1.75; color: var(--gyc-text); }
        .avi-analysis-body strong { font-weight: 600; color: var(--gyc-dark); }
        .avi-analysis-body em { font-style: italic; }

        .avi-result-footer { font-size: 0.72rem; color: #bbb; font-style: italic; padding: 0.85rem 1.75rem; background: var(--gyc-bg-alt); border-top: 1px solid var(--gyc-border); }
        .avi-error { padding: 2rem; background: #fdecea; border: 1px solid #f5b8b8; color: #C0392B; font-size: 0.9rem; text-align: center; margin-bottom: 1.5rem; }
      `}</style>

      <div className="avi-root">
        <header className="avi-header">
          <img src="/gyc-logo.png" alt="Gómez y Crespo" style={{ maxWidth: 200, marginBottom: "1.75rem", display: "block" }} />
          <div className="avi-eyebrow">Granja avícola — Producción de huevo</div>
          <h1 className="avi-title">Agente Aviario</h1>
          <p className="avi-tagline">Introduce los datos de tu instalación y obtén los requisitos mínimos exigidos por la normativa.</p>
          <div className="avi-divider" />
        </header>

        <main className="avi-main">
          {/* Progress */}
          <div className="avi-progress">
            {STEPS.map(({ key, label }, i) => (
              <div key={key} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
                <div className="avi-prog-item">
                  <div className={`avi-prog-circle ${stepIdx > i ? "done" : stepIdx === i ? "active" : ""}`}>
                    {stepIdx > i
                      ? <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : i + 1}
                  </div>
                  <span className={`avi-prog-label ${stepIdx === i ? "active" : ""}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="avi-prog-line" />}
              </div>
            ))}
          </div>

          {/* Step 1: Proyecto */}
          {step === "main" && (
            <div key={`main-${animKey}`} className="avi-step">
              <div className="avi-form-title">Datos del proyecto</div>
              <p className="avi-form-subtitle">Introduce el sistema de alojamiento y las dimensiones de la nave.</p>
              <form onSubmit={onMainSubmit}>
                <div className="avi-row">
                  <div className="avi-field">
                    <label className="avi-label">Sistema de alojamiento</label>
                    <select className="avi-select" required value={mainV.sistema ?? ""}
                      onChange={(e) => setMain((v) => ({ ...v, sistema: e.target.value }))}>
                      <option value="" disabled>Selecciona sistema</option>
                      {SISTEMAS_LABEL.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="avi-field">
                    <label className="avi-label">Gallinas a alojar</label>
                    <div className="avi-input-wrap">
                      <input type="number" className="avi-input has-unit" placeholder="500" min={1} required
                        value={mainV.gallinas ?? ""}
                        onChange={(e) => setMain((v) => ({ ...v, gallinas: e.target.value }))} />
                      <span className="avi-unit">aves</span>
                    </div>
                  </div>
                </div>
                <div className="avi-row">
                  <div className="avi-field">
                    <label className="avi-label">Superficie útil de la nave</label>
                    <div className="avi-input-wrap">
                      <input type="number" className="avi-input has-unit" placeholder="200" min={1} step="0.1" required
                        value={mainV.superficie_nave_m2 ?? ""}
                        onChange={(e) => setMain((v) => ({ ...v, superficie_nave_m2: e.target.value }))} />
                      <span className="avi-unit">m²</span>
                    </div>
                  </div>
                  <div className="avi-field">
                    <label className="avi-label">Altura libre de la nave</label>
                    <div className="avi-input-wrap">
                      <input type="number" className="avi-input has-unit" placeholder="250" min={50} step="1" required
                        value={mainV.altura_nave_cm ?? ""}
                        onChange={(e) => setMain((v) => ({ ...v, altura_nave_cm: e.target.value }))} />
                      <span className="avi-unit">cm</span>
                    </div>
                  </div>
                </div>
                <div className="avi-btn-row">
                  <button type="submit" className="avi-btn-primary"
                    disabled={!mainV.gallinas || !mainV.sistema || !mainV.superficie_nave_m2 || !mainV.altura_nave_cm}>
                    Calcular
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Loading recomendación */}
          {step === "loading_rec" && (
            <div key={`loading_rec-${animKey}`} className="avi-step">
              <div className="avi-loading">
                <div className="avi-loading-dots"><span /><span /><span /></div>
                <p className="avi-loading-text">Analizando la nave...</p>
              </div>
            </div>
          )}

          {/* Step 2: Recomendación zona de puesta */}
          {step === "recomendacion" && rec && (
            <div key={`rec-${animKey}`} className="avi-step">
              <button className="avi-back" onClick={() => go("main")}>
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Volver
              </button>
              <div className="avi-badge">{sistemaLabel} · {mainV.gallinas} aves · {mainV.superficie_nave_m2} m²</div>
              <div className="avi-form-title">Sistema de puesta recomendado</div>
              <p className="avi-form-subtitle">Basado en la densidad y la altura disponible de la nave.</p>

              <div style={{ background: "#fff", border: "1px solid #e7e7e7", borderRadius: "0", padding: "1.5rem 1.75rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: rec.tipo_zona === "aviario" ? "#edf3ec" : "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {rec.tipo_zona === "aviario"
                      ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="3" rx="1" fill="#4A7C59"/><rect x="2" y="9" width="16" height="3" rx="1" fill="#4A7C59" opacity=".7"/><rect x="2" y="14" width="16" height="3" rx="1" fill="#4A7C59" opacity=".4"/></svg>
                      : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="7" width="14" height="8" rx="1" fill="#6B7060"/><path d="M7 7V5a3 3 0 016 0v2" stroke="#6B7060" strokeWidth="1.5" fill="none"/></svg>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "1.1rem", fontWeight: 800, marginBottom: "0.25rem", color: "#3a3a3a" }}>
                      {rec.tipo_zona === "aviario" ? `Aviario multinivel (${rec.niveles} niveles)` : "Nidal colectivo"}
                    </div>
                    <p style={{ fontSize: "0.9rem", color: "#808285", lineHeight: 1.65, margin: 0 }}>{rec.razon}</p>
                  </div>
                </div>
              </div>

              {/* Argumentación comparativa */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "1.5rem" }}>
                {[
                  {
                    tipo: "aviario" as TipoZona,
                    titulo: "Aviario multinivel",
                    puntos: [
                      "Multiplica la superficie útil por número de niveles",
                      "Permite mayor densidad de aves dentro del límite legal",
                      "Mejor bienestar: movimiento vertical y entorno más complejo",
                      "Mayor productividad por m² de suelo construido",
                    ],
                  },
                  {
                    tipo: "nidal_colectivo" as TipoZona,
                    titulo: "Nidal colectivo",
                    puntos: [
                      "Menor inversión inicial y menor complejidad técnica",
                      "Gestión y limpieza más sencillas",
                      "Idóneo para densidades bajas o naves de poca altura",
                      "Solución probada y de fácil mantenimiento",
                    ],
                  },
                ].map(({ tipo, titulo, puntos }) => {
                  const esRecomendado = rec.tipo_zona === tipo;
                  const alturaOk = Math.floor((parseFloat(mainV.altura_nave_cm) - 25) / 45) >= 2;
                  const disponible = tipo === "nidal_colectivo" || alturaOk;
                  return (
                    <div key={tipo} style={{
                      border: `1.5px solid ${esRecomendado ? "#4F764D" : "#e7e7e7"}`,
                      borderRadius: 0,
                      padding: "1rem 1.1rem",
                      background: esRecomendado ? "#edf3ec" : "#fafafa",
                      position: "relative",
                    }}>
                      {esRecomendado && (
                        <span style={{ position: "absolute", top: -10, left: 12, background: "#4F764D", color: "#fff", fontSize: "0.63rem", fontWeight: 700, letterSpacing: "0.1em", padding: "0.15rem 0.6rem", borderRadius: 0 }}>RECOMENDADO</span>
                      )}
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "0.92rem", fontWeight: 800, marginBottom: "0.6rem", color: "#3a3a3a" }}>{titulo}</div>
                      <ul style={{ margin: 0, padding: "0 0 0 1rem", listStyle: "none" }}>
                        {puntos.map((p) => (
                          <li key={p} style={{ fontSize: "0.82rem", color: "#808285", lineHeight: 1.6, marginBottom: "0.3rem", paddingLeft: "0.75rem", position: "relative" }}>
                            <span style={{ position: "absolute", left: 0, color: esRecomendado ? "#4F764D" : "#bbb" }}>›</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                      {!esRecomendado && disponible && (
                        <button style={{ marginTop: "0.75rem", background: "none", border: "1px solid #e7e7e7", borderRadius: 0, color: "#808285", fontSize: "0.78rem", padding: "0.35rem 0.75rem", cursor: "pointer", fontFamily: "inherit", width: "100%", letterSpacing: "0.04em" }}
                          onClick={() => onConfirmar(tipo)}>
                          Elegir esta opción
                        </button>
                      )}
                      {!esRecomendado && !disponible && (
                        <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#bbb", fontStyle: "italic", margin: "0.75rem 0 0" }}>No disponible: altura insuficiente</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="avi-btn-row">
                <button className="avi-btn-primary" onClick={() => onConfirmar(tipoZona ?? rec.tipo_zona)}>
                  Confirmar y calcular requisitos
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {step === "loading" && (
            <div key={`loading-${animKey}`} className="avi-step">
              <div className="avi-loading">
                <div className="avi-loading-dots"><span /><span /><span /></div>
                <p className="avi-loading-text">Calculando requisitos normativos...</p>
              </div>
            </div>
          )}

          {/* Result */}
          {step === "result" && (() => {
            if (!resultado) return (
              <div key={`result-${animKey}`} className="avi-step">
                <div className="avi-error">Error al conectar con el servidor. Inténtalo de nuevo.</div>
                <button className="avi-btn-primary" onClick={reset}>Nueva consulta</button>
              </div>
            );

            const { informe, analisis_legal } = resultado;
            const okCount   = informe.verificaciones_nave.filter((v) => v.cumple).length;
            const failCount = informe.verificaciones_nave.filter((v) => !v.cumple).length;
            const cumple    = informe.cumple_nave;
            const bg        = cumple ? "#1E4D2B" : "#4D1E1E";
            const accent    = cumple ? "#3A9B5C" : "#C0392B";
            const tint      = cumple ? "#A8F0BC" : "#F5B8B8";

            return (
              <div key={`result-${animKey}`} className="avi-step">
                <div className="avi-result-wrap">

                  {/* Banner */}
                  <div className="avi-summary-bar" style={{ background: bg }}>
                    <div className="avi-summary-icon" style={{ background: accent }}>
                      {cumple
                        ? <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11l5 5 9-9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 5l12 12M17 5L5 17" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      }
                    </div>
                    <div className="avi-summary-text" style={{ color: "#FFF" }}>
                      <strong style={{ color: tint }}>Verificación de la instalación</strong>
                      <span>{cumple ? "La nave cumple los parámetros básicos" : `${failCount} parámetro${failCount > 1 ? "s" : ""} no cumple${failCount > 1 ? "n" : ""}`}</span>
                    </div>
                  </div>
                  <div className="avi-meta-strip" style={{ background: `${bg}CC` }}>
                    {[`${informe.num_gallinas} gallinas`, informe.sistema, "RD 3/2002"].map((p) => (
                      <span key={p} className="avi-meta-pill">{p}</span>
                    ))}
                  </div>

                  {/* Verificaciones nave */}
                  <div className="avi-table-block">
                    <div className="avi-table-head">
                      <span className="avi-table-label">Verificación de la nave</span>
                      <div className="avi-stats">
                        <span className="avi-stat ok">{okCount} OK</span>
                        {failCount > 0 && <span className="avi-stat fail">{failCount} fallo{failCount > 1 ? "s" : ""}</span>}
                      </div>
                    </div>
                    {informe.verificaciones_nave.map((v) => {
                      const ok  = v.cumple;
                      const sym = v.tipo_limite === "minimo" ? "≥" : "≤";
                      const diff = ok
                        ? `+${Math.abs(v.valor_real - v.valor_limite).toLocaleString("es-ES", { maximumFractionDigits: 1 })} margen`
                        : v.tipo_limite === "minimo"
                          ? `−${Math.abs(v.valor_limite - v.valor_real).toLocaleString("es-ES", { maximumFractionDigits: 1 })} falta`
                          : `+${Math.abs(v.valor_real - v.valor_limite).toLocaleString("es-ES", { maximumFractionDigits: 1 })} exceso`;
                      return (
                        <div key={v.parametro} className="avi-check-row">
                          <div className={`avi-check-icon ${ok ? "ok" : "fail"}`}>
                            {ok
                              ? <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5 6.5-7" stroke="#2E7D4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="#C0392B" strokeWidth="2" strokeLinecap="round"/></svg>
                            }
                          </div>
                          <span className="avi-check-name">{v.parametro}</span>
                          <div className="avi-check-vals">
                            <span className="real">{v.valor_real.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</span>
                            <span className="sep">/</span>
                            <span className="ref">{sym} {v.valor_limite.toLocaleString("es-ES", { maximumFractionDigits: 1 })} {v.unidad}</span>
                          </div>
                          <span className={`avi-diff ${ok ? "ok" : "fail"}`}>{diff}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Requisitos calculados */}
                  <div className="avi-table-block" style={{ borderTop: "2px solid #EDE9DF" }}>
                    <div className="avi-table-head">
                      <span className="avi-table-label">Equipamiento mínimo requerido</span>
                    </div>
                    {informe.requisitos.map((r) => (
                      <div key={r.nombre} className="avi-req-row">
                        <div className="avi-req-icon">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="3" stroke="#6B7060" strokeWidth="1.5"/></svg>
                        </div>
                        <div className="avi-req-body">
                          <div className="avi-req-name">{r.nombre}</div>
                          <div className="avi-req-formula">{r.formula}</div>
                        </div>
                        <div className="avi-req-value">
                          {r.valor_minimo.toLocaleString("es-ES")} <span style={{ fontWeight: 400, fontSize: "0.78rem", color: "#6B7060" }}>{r.unidad}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Advertencias */}
                  {informe.advertencias.length > 0 && (
                    <div className="avi-warn-block">
                      <div className="avi-warn-head">
                        <span className="avi-warn-label">⚠ Requisitos adicionales</span>
                      </div>
                      {informe.advertencias.map((w, i) => (
                        <div key={i} className="avi-warn-row">
                          <span className="avi-warn-text">{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Análisis legal */}
                  <div className="avi-analysis-block">
                    <div className="avi-analysis-head">
                      <span className="avi-analysis-label">Análisis normativo</span>
                    </div>
                    <div className="avi-analysis-body" dangerouslySetInnerHTML={{ __html: renderMd(analisis_legal) }} />
                  </div>

                  <div className="avi-result-footer">
                    Basado en RD 3/2002 · Directiva 1999/74/CE · RD 637/2021 · Regl. UE 2018/848
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <a href="/propuesta" target="_blank"
                    style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", background: "#4F764D", color: "#fff", border: "none", borderRadius: "0", padding: "0.85rem 1.9rem", fontFamily: "'Source Sans 3', sans-serif", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", letterSpacing: "0.05em", textDecoration: "none", textTransform: "uppercase" }}>
                    Ver propuesta comercial
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </a>
                  <button className="avi-btn-ghost" onClick={reset}>Nueva consulta</button>
                </div>
              </div>
            );
          })()}
        </main>
      </div>
    </>
  );
}
