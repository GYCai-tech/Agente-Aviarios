"use client";

import { useState } from "react";
import {
  solicitarIntake,
  type DatosIntake,
  type IntakeResponse,
  type Sistema,
} from "./actions";

type Step = "main" | "instalacion" | "loading" | "result";

const SISTEMAS_LABEL = ["En suelo", "Campero", "Ecológico", "Jaulas enriquecidas"] as const;
type SistemaLabel = (typeof SISTEMAS_LABEL)[number];

const SISTEMA_MAP: Record<SistemaLabel, Sistema> = {
  "En suelo":           "suelo",
  "Campero":            "campero",
  "Ecológico":          "ecologico",
  "Jaulas enriquecidas":"jaulas",
};

const STEPS = [
  { key: "main",        label: "Proyecto" },
  { key: "instalacion", label: "Instalación" },
  { key: "result",      label: "Informe" },
] as const;

function renderMd(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

export default function ChatInterface() {
  const [step, setStep]     = useState<Step>("main");
  const [mainV, setMain]    = useState<Record<string, string>>({});
  const [instV, setInst]    = useState<Record<string, string>>({});
  const [resultado, setRes] = useState<IntakeResponse | null>(null);
  const [animKey, setAnim]  = useState(0);

  const sistemaLabel = mainV.sistema as SistemaLabel | undefined;
  const sistemaApi   = sistemaLabel ? SISTEMA_MAP[sistemaLabel] : undefined;
  const esJaulas     = sistemaApi === "jaulas";

  function go(next: Step) { setAnim((k) => k + 1); setStep(next); }

  async function onInstSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    go("loading");
    try {
      const datos: DatosIntake = {
        num_gallinas:       parseInt(mainV.gallinas),
        sistema:            sistemaApi!,
        superficie_nave_m2: parseFloat(instV.superficie_nave_m2),
      };
      setRes(await solicitarIntake(datos));
    } catch {
      setRes(null);
    }
    go("result");
  }

  function reset() { setMain({}); setInst({}); setRes(null); go("main"); }

  const stepIdx = { main: 0, instalacion: 1, loading: 2, result: 2 }[step];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Source+Sans+3:wght@300;400;500;600&display=swap');

        .avi-root { font-family: 'Source Sans 3', sans-serif; background: #F5F1E8; min-height: 100vh; color: #1C2418; }
        .avi-header { padding: 2.5rem 2rem 0; max-width: 760px; margin: 0 auto; }
        .avi-eyebrow { font-size: 0.75rem; color: #6B7060; margin-bottom: 0.3rem; font-weight: 500; letter-spacing: 0.1em; text-transform: uppercase; }
        .avi-title { font-family: 'Playfair Display', serif; font-size: clamp(1.75rem, 4vw, 2.4rem); font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
        .avi-tagline { font-size: 0.9rem; color: #7A7566; margin-top: 0.5rem; font-weight: 300; }
        .avi-divider { height: 1px; background: linear-gradient(90deg, #C8C2B0 0%, transparent 100%); margin: 1.5rem 0; }
        .avi-main { max-width: 760px; margin: 0 auto; padding: 0 2rem 4rem; }

        @keyframes stepIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .avi-step { animation: stepIn 0.26s ease forwards; }

        .avi-progress { display: flex; align-items: center; margin-bottom: 2.5rem; }
        .avi-prog-item { display: flex; align-items: center; gap: 0.5rem; }
        .avi-prog-circle { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid #C8C2B0; background: #F5F1E8; font-size: 0.68rem; font-weight: 600; color: #9A9486; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
        .avi-prog-circle.active { border-color: #1C2418; background: #1C2418; color: #F5F1E8; }
        .avi-prog-circle.done   { border-color: #4A7C59; background: #4A7C59; color: #F5F1E8; }
        .avi-prog-label { font-size: 0.72rem; color: #9A9486; letter-spacing: 0.04em; text-transform: uppercase; }
        .avi-prog-label.active { color: #1C2418; font-weight: 600; }
        .avi-prog-line { flex: 1; height: 1px; background: #DDD8CC; margin: 0 0.6rem; min-width: 16px; }

        .avi-form-title    { font-family: 'Playfair Display', serif; font-size: 1.35rem; font-weight: 600; margin-bottom: 0.35rem; }
        .avi-form-subtitle { font-size: 0.85rem; color: #7A7566; margin-bottom: 1.75rem; font-weight: 300; }
        .avi-field { margin-bottom: 1.1rem; }
        .avi-label { display: block; font-size: 0.74rem; font-weight: 700; color: #4A4A3E; margin-bottom: 0.4rem; letter-spacing: 0.06em; text-transform: uppercase; }
        .avi-input-wrap { position: relative; display: flex; align-items: center; }
        .avi-unit { position: absolute; right: 0.9rem; font-size: 0.82rem; color: #9A9486; pointer-events: none; }
        .avi-select, .avi-input { width: 100%; background: #FFFFFF; border: 1px solid #DDD8CC; border-radius: 4px; padding: 0.68rem 0.9rem; font-family: 'Source Sans 3', sans-serif; font-size: 0.95rem; color: #1C2418; outline: none; transition: border-color 0.15s, box-shadow 0.15s; box-sizing: border-box; }
        .avi-input.has-unit { padding-right: 3.5rem; }
        .avi-select { appearance: none; -webkit-appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7060' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 0.9rem center; padding-right: 2.2rem; }
        .avi-select:focus, .avi-input:focus { border-color: #4A7C59; box-shadow: 0 0 0 3px rgba(74,124,89,0.12); }
        .avi-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 520px) { .avi-row { grid-template-columns: 1fr; } }
        .avi-sep { display: flex; align-items: center; gap: 0.75rem; margin: 1.5rem 0 1.1rem; }
        .avi-sep span { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #9A9486; white-space: nowrap; }
        .avi-sep::before, .avi-sep::after { content: ""; flex: 1; height: 1px; background: #DDD8CC; }

        .avi-btn-row { display: flex; align-items: center; gap: 1rem; margin-top: 2rem; flex-wrap: wrap; }
        .avi-btn-primary { background: #1C2418; color: #F5F1E8; border: none; border-radius: 4px; padding: 0.78rem 1.75rem; font-family: 'Source Sans 3', sans-serif; font-size: 0.9rem; font-weight: 500; cursor: pointer; letter-spacing: 0.04em; transition: background 0.15s, transform 0.1s; display: inline-flex; align-items: center; gap: 0.5rem; }
        .avi-btn-primary:hover { background: #2E3D28; transform: translateY(-1px); }
        .avi-btn-primary:disabled { opacity: 0.45; cursor: default; transform: none; }
        .avi-btn-ghost { background: transparent; border: 1px solid #C8C2B0; color: #6B7060; border-radius: 4px; padding: 0.78rem 1.25rem; font-family: 'Source Sans 3', sans-serif; font-size: 0.9rem; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
        .avi-btn-ghost:hover { border-color: #1C2418; color: #1C2418; }
        .avi-back { display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.74rem; color: #7A7566; cursor: pointer; border: none; background: none; padding: 0; margin-bottom: 1.75rem; transition: color 0.15s; font-family: 'Source Sans 3', sans-serif; letter-spacing: 0.07em; text-transform: uppercase; }
        .avi-back:hover { color: #1C2418; }
        .avi-badge { display: inline-block; padding: 0.25rem 0.75rem; background: #E8F0E3; color: #3A6B45; border-radius: 20px; font-size: 0.78rem; font-weight: 600; margin-bottom: 1.5rem; }

        @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
        .avi-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; gap: 1.5rem; }
        .avi-loading-dots { display: flex; gap: 10px; }
        .avi-loading-dots span { width: 10px; height: 10px; border-radius: 50%; background: #4A7C59; animation: pulse 1.3s ease infinite; }
        .avi-loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .avi-loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        .avi-loading-text { font-size: 0.88rem; color: #7A7566; font-style: italic; }

        .avi-result-wrap { border-radius: 8px; overflow: hidden; border: 1px solid #C8C2B0; margin-bottom: 1.5rem; box-shadow: 0 4px 24px rgba(28,36,24,0.08); }

        .avi-summary-bar { padding: 1.4rem 1.75rem; display: flex; align-items: center; gap: 1.25rem; }
        .avi-summary-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .avi-summary-text strong { font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; display: block; opacity: 0.65; margin-bottom: 0.2rem; }
        .avi-summary-text span { font-family: 'Playfair Display', serif; font-size: 1.2rem; font-weight: 700; line-height: 1.2; }
        .avi-meta-strip { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem 1.75rem; background: rgba(0,0,0,0.15); }
        .avi-meta-pill { font-size: 0.74rem; font-weight: 500; padding: 0.2rem 0.65rem; border-radius: 20px; background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); }

        .avi-table-block { background: #FFFFFF; }
        .avi-table-head { padding: 0.8rem 1.75rem; background: #F5F1E8; border-bottom: 1px solid #EDE9DF; display: flex; align-items: center; justify-content: space-between; }
        .avi-table-label { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6B7060; }
        .avi-stats { display: flex; gap: 0.6rem; }
        .avi-stat { font-size: 0.74rem; font-weight: 600; padding: 0.15rem 0.55rem; border-radius: 20px; }
        .avi-stat.ok   { background: #E8F5EC; color: #2E7D4F; }
        .avi-stat.fail { background: #FBE9E7; color: #C0392B; }

        .avi-check-row { display: flex; align-items: center; padding: 0.75rem 1.75rem; border-bottom: 1px solid #F0EDE5; gap: 0.75rem; }
        .avi-check-row:last-child { border-bottom: none; }
        .avi-check-icon { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .avi-check-icon.ok   { background: #E8F5EC; }
        .avi-check-icon.fail { background: #FBE9E7; }
        .avi-check-name { flex: 1; font-size: 0.88rem; color: #1C2418; font-weight: 500; }
        .avi-check-vals { display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; flex-shrink: 0; }
        .avi-check-vals .real { color: #1C2418; font-weight: 600; }
        .avi-check-vals .sep  { color: #C8C2B0; }
        .avi-check-vals .ref  { color: #6B7060; }
        .avi-diff { font-size: 0.74rem; font-weight: 700; padding: 0.13rem 0.5rem; border-radius: 20px; flex-shrink: 0; white-space: nowrap; }
        .avi-diff.ok   { background: #E8F5EC; color: #2E7D4F; }
        .avi-diff.fail { background: #FBE9E7; color: #C0392B; }

        .avi-req-row { display: flex; align-items: flex-start; padding: 0.75rem 1.75rem; border-bottom: 1px solid #F0EDE5; gap: 0.75rem; }
        .avi-req-row:last-child { border-bottom: none; }
        .avi-req-icon { width: 22px; height: 22px; border-radius: 50%; background: #EAE6DB; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .avi-req-body { flex: 1; min-width: 0; }
        .avi-req-name { font-size: 0.88rem; color: #1C2418; font-weight: 500; }
        .avi-req-formula { font-size: 0.78rem; color: #9A9486; margin-top: 0.1rem; font-style: italic; }
        .avi-req-value { font-size: 0.88rem; font-weight: 700; color: #1C2418; flex-shrink: 0; white-space: nowrap; }

        .avi-warn-block { background: #FFFBF0; border-top: 2px solid #F0E0A0; }
        .avi-warn-head { padding: 0.8rem 1.75rem; background: #FDF6DC; border-bottom: 1px solid #F0E0A0; }
        .avi-warn-label { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #8A6A00; }
        .avi-warn-row { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.85rem 1.75rem; border-bottom: 1px solid #F0E0A0; }
        .avi-warn-row:last-child { border-bottom: none; }
        .avi-warn-text { font-size: 0.87rem; color: #5A4A00; line-height: 1.6; }

        .avi-analysis-block { background: #FFFFFF; border-top: 2px solid #EDE9DF; }
        .avi-analysis-head { padding: 0.8rem 1.75rem; background: #F5F1E8; border-bottom: 1px solid #EDE9DF; }
        .avi-analysis-label { font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #6B7060; }
        .avi-analysis-body { padding: 1.4rem 1.75rem; font-size: 0.93rem; line-height: 1.85; color: #2C2C24; }
        .avi-analysis-body strong { font-weight: 600; color: #1C2418; }
        .avi-analysis-body em { font-style: italic; color: #4A4A3E; }

        .avi-result-footer { font-size: 0.73rem; color: #9A9486; font-style: italic; padding: 0.85rem 1.75rem; background: #FAF8F3; border-top: 1px solid #EDE9DF; }
        .avi-error { padding: 2rem; background: #FBE9E7; border: 1px solid #F5C6C2; border-radius: 8px; color: #C0392B; font-size: 0.9rem; text-align: center; margin-bottom: 1.5rem; }
      `}</style>

      <div className="avi-root">
        <header className="avi-header">
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
              <p className="avi-form-subtitle">Define el número de gallinas y el sistema de alojamiento.</p>
              <form onSubmit={(e) => { e.preventDefault(); setInst({}); go("instalacion"); }}>
                <div className="avi-row">
                  <div className="avi-field">
                    <label className="avi-label">Gallinas a alojar</label>
                    <div className="avi-input-wrap">
                      <input type="number" className="avi-input has-unit" placeholder="500" min={1} required
                        value={mainV.gallinas ?? ""}
                        onChange={(e) => setMain((v) => ({ ...v, gallinas: e.target.value }))} />
                      <span className="avi-unit">aves</span>
                    </div>
                  </div>
                  <div className="avi-field">
                    <label className="avi-label">Sistema de alojamiento</label>
                    <select className="avi-select" required value={mainV.sistema ?? ""}
                      onChange={(e) => setMain((v) => ({ ...v, sistema: e.target.value }))}>
                      <option value="" disabled>Selecciona sistema</option>
                      {SISTEMAS_LABEL.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="avi-btn-row">
                  <button type="submit" className="avi-btn-primary" disabled={!mainV.gallinas || !mainV.sistema}>
                    Siguiente
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 2: Instalación */}
          {step === "instalacion" && (
            <div key={`inst-${animKey}`} className="avi-step">
              <button className="avi-back" onClick={() => go("main")}>
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Volver
              </button>
              <div className="avi-badge">{sistemaLabel} · {mainV.gallinas} aves</div>
              <div className="avi-form-title">Dimensiones de la instalación</div>
              <p className="avi-form-subtitle">
                {esJaulas
                  ? "Introduce la superficie útil total de jaulas. El sistema calculará los requisitos de equipamiento."
                  : "Introduce la superficie útil y el tipo de zona de puesta. El sistema calculará todo lo demás."}
              </p>
              <form onSubmit={onInstSubmit}>
                <div className="avi-field">
                  <label className="avi-label">Superficie útil de la nave</label>
                  <div className="avi-input-wrap">
                    <input type="number" className="avi-input has-unit" placeholder="60" min={1} step="0.1" required
                      value={instV.superficie_nave_m2 ?? ""}
                      onChange={(e) => setInst((v) => ({ ...v, superficie_nave_m2: e.target.value }))} />
                    <span className="avi-unit">m²</span>
                  </div>
                </div>


                <div className="avi-btn-row">
                  <button type="submit" className="avi-btn-primary"
                    disabled={!instV.superficie_nave_m2}>
                    Calcular requisitos
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <button type="button" className="avi-btn-ghost" onClick={() => go("main")}>Cancelar</button>
                </div>
              </form>
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

                <button className="avi-btn-primary" onClick={reset}>Nueva consulta</button>
              </div>
            );
          })()}
        </main>
      </div>
    </>
  );
}
