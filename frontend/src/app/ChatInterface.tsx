"use client";

import { useState } from "react";
import {
  solicitarIntake,
  pedirFactibilidad,
  pedirCapacidad,
  pedirRecomendacionConRespuestas,
  pedirLayoutNidal,
  type DatosIntake,
  type IntakeResponse,
  type Recomendacion,
  type FactibilidadResponse,
  type ResultadoCapacidad,
  type OpcionCapacidad,
  type PuntoPareto,
  type Pregunta,
  type TipoZona,
  type Sistema,
  type LayoutAviario,
  type ResultadoLayoutNidal,
} from "./actions";

type Step = "mode" | "main" | "loading_fact" | "factibilidad" | "loading_rec" | "recomendacion" | "loading" | "result" | "loading_cap" | "capacidad";

const SISTEMAS_LABEL = ["En suelo", "Campero", "Ecológico", "Jaulas enriquecidas"] as const;
type SistemaLabel = (typeof SISTEMAS_LABEL)[number];

const SISTEMA_MAP: Record<SistemaLabel, Sistema> = {
  "En suelo":            "suelo",
  "Campero":             "campero",
  "Ecológico":           "ecologico",
  "Jaulas enriquecidas": "jaulas",
};

const STEPS = [
  { key: "main",          label: "Proyecto" },
  { key: "factibilidad",  label: "Análisis" },
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
      return `<span class="md-section-label">${label}</span>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

export default function ChatInterface() {
  const [step, setStep]               = useState<Step>("mode");
  const [modo, setModo]               = useState<"compliance" | "capacidad">("compliance");
  const [mainV, setMain]              = useState<Record<string, string>>({});
  const [factResult, setFactResult]   = useState<FactibilidadResponse | null>(null);
  const [respuestas, setRespuestas]   = useState<Record<string, string>>({});
  const [preguntaIdx, setPreguntaIdx] = useState(0);
  const [rec, setRec]                 = useState<Recomendacion | null>(null);
  const [tipoZona, setTipoZona]       = useState<TipoZona | null>(null);
  const [resultado, setRes]           = useState<IntakeResponse | null>(null);
  const [capResult, setCapResult]     = useState<ResultadoCapacidad | null>(null);
  const [animKey, setAnim]            = useState(0);
  const [layoutGallinas, setLayoutGallinas] = useState<string>("");
  const [layoutExterior, setLayoutExterior] = useState<string>("");
  const [layoutLoading, setLayoutLoading]   = useState(false);
  const [layoutResult, setLayoutResult]     = useState<ResultadoLayoutNidal | null>(null);

  const sistemaLabel = mainV.sistema as SistemaLabel | undefined;
  const sistemaApi   = sistemaLabel ? SISTEMA_MAP[sistemaLabel] : undefined;
  const esJaulas     = sistemaApi === "jaulas";

  function go(next: Step) { setAnim((k) => k + 1); setStep(next); }

  function datosBásicos() {
    return {
      num_gallinas:       parseInt(mainV.gallinas),
      sistema:            sistemaApi!,
      superficie_nave_m2: parseFloat(mainV.superficie_nave_m2),
      altura_nave_cm:     parseFloat(mainV.altura_nave_cm),
    };
  }

  async function onCapacidadSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    go("loading_cap");
    try {
      const ancho = parseFloat(mainV.ancho_nave_m);
      const largo = parseFloat(mainV.largo_nave_m);
      const datos = {
        num_gallinas: 0,
        sistema: sistemaApi!,
        superficie_nave_m2: ancho * largo,
        altura_nave_cm: parseFloat(mainV.altura_nave_cm),
        ancho_nave_m: ancho,
        largo_nave_m: largo,
      };
      setCapResult(await pedirCapacidad(datos));
    } catch { setCapResult(null); }
    go("capacidad");
  }

  async function onMainSubmit(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (esJaulas) {
      go("loading");
      try {
        const datos: DatosIntake = { ...datosBásicos(), tipo_zona: "nidal_colectivo" };
        setRes(await solicitarIntake(datos));
      } catch { setRes(null); }
      go("result");
      return;
    }
    go("loading_fact");
    try {
      const fact = await pedirFactibilidad(datosBásicos());
      setFactResult(fact);
      setRespuestas({});
      setPreguntaIdx(0);
    } catch { setFactResult(null); }
    go("factibilidad");
  }

  async function onFactibilidadSubmit() {
    go("loading_rec");
    try {
      const r = await pedirRecomendacionConRespuestas(datosBásicos(), respuestas);
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
          objeciones: res.objeciones ?? [],
          gallinas: mainV.gallinas,
          sistema: sistemaApi,
          superficie: mainV.superficie_nave_m2,
          altura: mainV.altura_nave_cm,
          tipo_zona: zona,
          niveles: rec?.niveles ?? 1,
        }));
      }
    } catch { setRes(null); }
    go("result");
  }

  async function onLayoutSubmit(exteriorM2 = 0) {
    setLayoutLoading(true);
    setLayoutResult(null);
    try {
      const ancho = parseFloat(mainV.ancho_nave_m);
      const largo = parseFloat(mainV.largo_nave_m);
      const r = await pedirLayoutNidal({
        nave_m2: ancho * largo,
        ancho_nave_m: ancho,
        largo_nave_m: largo,
        gallinas: layoutGallinas ? parseInt(layoutGallinas) : 0,
        sistema: sistemaApi!,
        exterior_m2: exteriorM2,
      });
      setLayoutResult(r);
    } catch {
      setLayoutResult(null);
    }
    setLayoutLoading(false);
  }

  function reset() {
    setMain({}); setFactResult(null); setRespuestas({});
    setRec(null); setTipoZona(null); setRes(null); setCapResult(null);
    setLayoutResult(null); setLayoutGallinas(""); setLayoutExterior("");
    go("mode");
  }

  const stepIdx: number | undefined = step === "mode"
    ? undefined
    : ({ main: 0, loading_fact: 1, factibilidad: 1, loading_rec: 2, recomendacion: 2, loading: 3, result: 3, loading_cap: 1, capacidad: 1 } as Record<string, number>)[step];

  return (
    <>
      <style>{CHAT_CSS}</style>

      {/* ── HEADER ── */}
      <header className="chat-hdr">
        <div className="chat-hdr-inner">
          <img src="/gyc-logo.png" alt="Gómez y Crespo" className="chat-logo" />
          <a href="/propuesta" target="_blank" className="chat-hdr-link">
            Ver propuesta
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4h8M5 1l4 3-4 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      </header>

      <div className="chat-root">
        {/* ── Page intro ── */}
        <div className="chat-intro">
          <div className="chat-eyebrow">Granja avícola — Producción de huevo</div>
          <h1 className="chat-title">Agente Aviario</h1>
          <p className="chat-tagline">Introduce los datos de tu instalación y obtén los requisitos mínimos exigidos por la normativa.</p>
          <div className="chat-divider" />
        </div>

        <main className="chat-main">
          {/* ── Progress ── */}
          <div className="prog-bar">
            {STEPS.map(({ key, label }, i) => (
              <div key={key} className={`prog-step-outer${i < STEPS.length - 1 ? " prog-step-outer--flex" : ""}`}>
                <div className="prog-step">
                  <div className={`prog-circle${(stepIdx ?? -1) > i ? " is-done" : stepIdx === i ? " is-active" : ""}`}>
                    {(stepIdx ?? -1) > i
                      ? <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : i + 1}
                  </div>
                  <span className={`prog-label${stepIdx === i ? " is-active" : ""}`}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div className="prog-line" />}
              </div>
            ))}
          </div>

          {/* ── Step 0: Selector de modo ── */}
          {step === "mode" && (
            <div key={`mode-${animKey}`} className="step-anim">
              <div className="form-title">¿Cómo puedo ayudarte?</div>
              <p className="form-subtitle">Elige el tipo de cálculo que necesitas.</p>
              <div className="mode-grid">
                <button className="mode-card" onClick={() => { setModo("compliance"); go("main"); }}>
                  <div className="mode-card-icon">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <rect x="4" y="4" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M9 14l3.5 3.5 6.5-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="mode-card-body">
                    <div className="mode-card-title">Verificar instalación</div>
                    <p className="mode-card-desc">Tengo <strong>X gallinas</strong> y quiero saber si caben en mi nave y qué sistema de puesta instalar.</p>
                  </div>
                  <svg className="mode-card-arrow" width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M1 6h14M9 1l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                <button className="mode-card" onClick={() => { setModo("capacidad"); go("main"); }}>
                  <div className="mode-card-icon">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <rect x="3" y="8" width="22" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M9 8V6a5 5 0 0110 0v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      <path d="M10 15h8M14 12v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div className="mode-card-body">
                    <div className="mode-card-title">Calcular capacidad</div>
                    <p className="mode-card-desc">Tengo una <strong>nave de X m²</strong> y quiero saber cuántas gallinas puedo alojar con cada sistema.</p>
                  </div>
                  <svg className="mode-card-arrow" width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M1 6h14M9 1l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1: Proyecto ── */}
          {step === "main" && modo === "compliance" && (
            <div key={`main-${animKey}`} className="step-anim">
              <button className="btn-back" onClick={() => go("mode")}>
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Volver
              </button>
              <div className="form-title">Datos del proyecto</div>
              <p className="form-subtitle">Introduce el sistema de alojamiento y las dimensiones de la nave.</p>
              <form onSubmit={onMainSubmit}>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Sistema de alojamiento</label>
                    <select className="field-select" required value={mainV.sistema ?? ""}
                      onChange={(e) => setMain((v) => ({ ...v, sistema: e.target.value }))}>
                      <option value="" disabled>Selecciona sistema</option>
                      {SISTEMAS_LABEL.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Gallinas a alojar</label>
                    <div className="field-input-wrap">
                      <input type="number" className="field-input field-input--unit" placeholder="500" min={1} required
                        value={mainV.gallinas ?? ""}
                        onChange={(e) => setMain((v) => ({ ...v, gallinas: e.target.value }))} />
                      <span className="field-unit">aves</span>
                    </div>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Superficie útil de la nave</label>
                    <div className="field-input-wrap">
                      <input type="number" className="field-input field-input--unit" placeholder="200" min={1} step="0.1" required
                        value={mainV.superficie_nave_m2 ?? ""}
                        onChange={(e) => setMain((v) => ({ ...v, superficie_nave_m2: e.target.value }))} />
                      <span className="field-unit">m²</span>
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Altura libre de la nave</label>
                    <div className="field-input-wrap">
                      <input type="number" className="field-input field-input--unit" placeholder="250" min={50} step="1" required
                        value={mainV.altura_nave_cm ?? ""}
                        onChange={(e) => setMain((v) => ({ ...v, altura_nave_cm: e.target.value }))} />
                      <span className="field-unit">cm</span>
                    </div>
                  </div>
                </div>
                <div className="btn-row">
                  <button type="submit" className="btn-pill"
                    disabled={!mainV.gallinas || !mainV.sistema || !mainV.superficie_nave_m2 || !mainV.altura_nave_cm}>
                    Calcular
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Step 1 (Modo B): Capacidad ── */}
          {step === "main" && modo === "capacidad" && (
            <div key={`main-cap-${animKey}`} className="step-anim">
              <button className="btn-back" onClick={() => go("mode")}>
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Volver
              </button>
              <div className="form-title">Datos de la nave</div>
              <p className="form-subtitle">Introduce las dimensiones de tu nave y el sistema de producción.</p>
              <form onSubmit={onCapacidadSubmit}>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Sistema de alojamiento</label>
                    <select className="field-select" required value={mainV.sistema ?? ""}
                      onChange={(e) => setMain((v) => ({ ...v, sistema: e.target.value }))}>
                      <option value="" disabled>Selecciona sistema</option>
                      {SISTEMAS_LABEL.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Altura libre de la nave</label>
                    <div className="field-input-wrap">
                      <input type="number" className="field-input field-input--unit" placeholder="320" min={50} step="1" required
                        value={mainV.altura_nave_cm ?? ""}
                        onChange={(e) => setMain((v) => ({ ...v, altura_nave_cm: e.target.value }))} />
                      <span className="field-unit">cm</span>
                    </div>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label className="field-label">Ancho de la nave</label>
                    <div className="field-input-wrap">
                      <input type="number" className="field-input field-input--unit" placeholder="12" min={1} step="0.1" required
                        value={mainV.ancho_nave_m ?? ""}
                        onChange={(e) => setMain((v) => ({ ...v, ancho_nave_m: e.target.value }))} />
                      <span className="field-unit">m</span>
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Largo de la nave</label>
                    <div className="field-input-wrap">
                      <input type="number" className="field-input field-input--unit" placeholder="100" min={1} step="0.1" required
                        value={mainV.largo_nave_m ?? ""}
                        onChange={(e) => setMain((v) => ({ ...v, largo_nave_m: e.target.value }))} />
                      <span className="field-unit">m</span>
                    </div>
                  </div>
                </div>
                {mainV.ancho_nave_m && mainV.largo_nave_m && (
                  <p className="field-computed">
                    Superficie: {(parseFloat(mainV.ancho_nave_m) * parseFloat(mainV.largo_nave_m)).toLocaleString("es-ES", { maximumFractionDigits: 0 })} m²
                  </p>
                )}
                <div className="btn-row">
                  <button type="submit" className="btn-pill"
                    disabled={!mainV.sistema || !mainV.ancho_nave_m || !mainV.largo_nave_m || !mainV.altura_nave_cm}>
                    Calcular capacidad
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Loading capacidad ── */}
          {step === "loading_cap" && (
            <div key={`loading_cap-${animKey}`} className="step-anim">
              <div className="loading-wrap">
                <div className="loading-dots"><span /><span /><span /></div>
                <p className="loading-text">Calculando capacidad de la nave...</p>
              </div>
            </div>
          )}

          {/* ── Resultado capacidad ── */}
          {step === "capacidad" && (() => {
            if (!capResult) return (
              <div key={`capacidad-${animKey}`} className="step-anim">
                <div className="error-box">Error al conectar con el servidor. Inténtalo de nuevo.</div>
                <button className="btn-pill" onClick={reset}>Nueva consulta</button>
              </div>
            );
            return (
              <div key={`capacidad-${animKey}`} className="step-anim">
                <button className="btn-back" onClick={() => go("main")}>
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Volver
                </button>
                <div className="rec-badge">{mainV.sistema} · {mainV.ancho_nave_m} × {mainV.largo_nave_m} m · {mainV.altura_nave_cm} cm</div>
                <div className="form-title">Capacidad de la nave</div>
                <p className="form-subtitle">Gallinas que puedes alojar con cada sistema, dentro del límite normativo de <strong>{capResult.densidad_max} gal/m²</strong>.</p>
                <div className="cap-grid">
                  {capResult.opciones.map((op) => (
                    <div key={op.sistema} className={`cap-card${op.viable ? " is-viable" : " is-no"}`}>
                      <div className="cap-card-head">
                        <div className="cap-card-label">{op.label}</div>
                        <div className={`cap-card-badge${op.viable ? " is-viable" : " is-no"}`}>
                          {op.viable ? "Viable" : "No viable"}
                        </div>
                      </div>
                      {/* Gallinas + módulos — solo cuando no hay bifurcación parque */}
                      {op.viable && (op.parque_invierno_m2 ?? 0) === 0 && (
                        <>
                          <div className="cap-card-gallinas">
                            {op.max_gallinas.toLocaleString("es-ES")}
                            <span className="cap-card-unit"> aves</span>
                          </div>
                          <div className="cap-card-gallinas cap-card-modulos">
                            {op.num_modulos}
                            <span className="cap-card-unit"> módulo{op.num_modulos !== 1 ? "s" : ""}</span>
                          </div>
                        </>
                      )}
                      {!op.viable && (
                        <div className="cap-card-details"><span>Altura insuficiente para este sistema</span></div>
                      )}

                      {/* Stats grid */}
                      {op.viable && (
                        <div className="cap-stats-grid">
                          <div className="cap-stat">
                            <span className="cap-stat-label">Sup. normativa</span>
                            <span className="cap-stat-val">{(op.sup_disponible_m2 ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 0 })} m²</span>
                          </div>
                          <div className="cap-stat">
                            <span className="cap-stat-label">Densidad</span>
                            <span className="cap-stat-val">{op.densidad_real.toFixed(1)} / {op.densidad_max.toFixed(0)} gal/m²</span>
                          </div>
                          {op.sup_yacija_m2 != null && <>
                            <div className="cap-stat">
                              <span className="cap-stat-label">Yacija disponible</span>
                              <span className={`cap-stat-val${(op.sup_yacija_m2 ?? 0) < (op.yacija_min_m2 ?? 0) ? " is-warn" : ""}`}>
                                {op.sup_yacija_m2.toLocaleString("es-ES", { maximumFractionDigits: 0 })} m²
                              </span>
                            </div>
                            <div className="cap-stat">
                              <span className="cap-stat-label">Yacija requerida</span>
                              <span className="cap-stat-val">{(op.yacija_min_m2 ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 0 })} m²</span>
                            </div>
                          </>}
                        </div>
                      )}

                      {/* Layout */}
                      {op.viable && op.layout && (
                        <div className="cap-card-layout">
                          <span className="cap-layout-row">
                            <span className="cap-layout-label">En planta</span>
                            <span className="cap-layout-val">{op.layout.num_filas} filas × {op.layout.mods_por_fila} módulos</span>
                          </span>
                          <span className="cap-layout-row">
                            <span className="cap-layout-label">Pasillos</span>
                            <span className="cap-layout-val">1 m entre cada par de filas</span>
                          </span>
                        </div>
                      )}

                      {/* Bifurcación parque de invierno */}
                      {op.viable && (op.parque_invierno_m2 ?? 0) > 0 && (() => {
                        const supPorMod = op.num_modulos > 0 ? (op.sup_disponible_m2 ?? 0) / op.num_modulos : 0;
                        const supDispA  = (op.modulos_opcion_a ?? 0) * supPorMod;
                        const densA     = supDispA > 0 ? (op.gallinas_opcion_a ?? 0) / supDispA : 0;
                        return (
                          <div className="cap-card-parque">
                            <div className="cap-parque-title">Para cumplir la normativa de yacija</div>
                            <div className="cap-parque-grid">
                              <div className="cap-parque-opcion cap-parque-opcion--a">
                                <div className="cap-parque-opcion-head">Sin parque de invierno</div>
                                <div className="cap-parque-opcion-gallinas">
                                  {(op.gallinas_opcion_a ?? 0).toLocaleString("es-ES")}
                                  <span className="cap-card-unit"> aves</span>
                                </div>
                                <div className="cap-parque-opcion-row">
                                  <span className="cap-parque-opcion-key">Módulos</span>
                                  <span className="cap-parque-opcion-val">{op.modulos_opcion_a}</span>
                                </div>
                                <div className="cap-parque-opcion-row">
                                  <span className="cap-parque-opcion-key">Densidad</span>
                                  <span className="cap-parque-opcion-val">{densA.toFixed(1)} gal/m²</span>
                                </div>
                                <div className="cap-parque-opcion-tag cap-parque-opcion-tag--ok">✓ Yacija OK · nave sola</div>
                              </div>
                              <div className="cap-parque-opcion cap-parque-opcion--b">
                                <div className="cap-parque-opcion-head">Con parque de invierno</div>
                                <div className="cap-parque-opcion-gallinas">
                                  {op.max_gallinas.toLocaleString("es-ES")}
                                  <span className="cap-card-unit"> aves</span>
                                </div>
                                <div className="cap-parque-opcion-row">
                                  <span className="cap-parque-opcion-key">Módulos</span>
                                  <span className="cap-parque-opcion-val">{op.num_modulos}</span>
                                </div>
                                <div className="cap-parque-opcion-row">
                                  <span className="cap-parque-opcion-key">Densidad</span>
                                  <span className="cap-parque-opcion-val">{op.densidad_real.toFixed(1)} gal/m²</span>
                                </div>
                                <div className="cap-parque-opcion-tag cap-parque-opcion-tag--parque">+ {op.parque_invierno_m2} m² parque</div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                    </div>
                  ))}
                </div>
                <div className="btn-row">
                  <button className="btn-outline" onClick={reset}>Nueva consulta</button>
                </div>
              </div>
            );
          })()}

          {/* ── Loading factibilidad ── */}
          {step === "loading_fact" && (
            <div key={`loading_fact-${animKey}`} className="step-anim">
              <div className="loading-wrap">
                <div className="loading-dots"><span /><span /><span /></div>
                <p className="loading-text">Analizando la nave...</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Factibilidad ── */}
          {step === "factibilidad" && factResult && (
            <div key={`fact-${animKey}`} className="step-anim">
              <button className="btn-back" onClick={() => go("main")}>
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Volver
              </button>

              {/* Resultado factibilidad */}
              <div className={`fact-box ${factResult.factibilidad.factible ? "is-ok" : "is-fail"}`}>
                <div className="fact-box-inner">
                  <div className={`fact-icon ${factResult.factibilidad.factible ? "is-ok" : "is-fail"}`}>
                    {factResult.factibilidad.factible
                      ? <svg width="16" height="14" viewBox="0 0 16 14" fill="none"><path d="M1 7l5 5 9-9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                    }
                  </div>
                  <div className="fact-text">
                    <div className="fact-heading">
                      {factResult.factibilidad.factible ? "Instalación viable" : "Instalación no viable"}
                    </div>
                    <p className="fact-msg">{factResult.factibilidad.mensaje}</p>
                  </div>
                </div>

                {/* Densidades */}
                {(() => {
                  const f = factResult.factibilidad;
                  const aviarioViable = f.niveles_posibles >= 2;
                  const cards = [
                    { label: "Densidad con nidal",   value: f.densidad_actual.toFixed(1),       unit: "gal/m²", warn: f.densidad_actual > f.densidad_max, na: false },
                    aviarioViable
                      ? { label: "Densidad con aviario", value: f.densidad_min_aviario.toFixed(1), unit: "gal/m²", warn: f.densidad_min_aviario > f.densidad_max, na: false }
                      : { label: "Densidad con aviario", value: "N/A", unit: "altura insuficiente", warn: false, na: true },
                    { label: "Límite normativo",      value: f.densidad_max.toFixed(0),          unit: "gal/m²", warn: false, na: false },
                  ];
                  return (
                    <div className="density-grid">
                      {cards.map(s => (
                        <div key={s.label} className={`density-card${s.warn ? " is-warn" : ""}${s.na ? " is-na" : ""}`}>
                          <div className="density-label">{s.label}</div>
                          <div className={`density-val${s.warn ? " is-warn" : ""}${s.na ? " is-na" : ""}`}>{s.value}</div>
                          <div className="density-unit">{s.unit}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Recomendaciones de ajuste */}
              {(() => {
                const f = factResult.factibilidad;
                const nidal_excede = f.densidad_actual > f.densidad_max;
                const avi_excede = f.niveles_posibles >= 2 && f.densidad_min_aviario > f.densidad_max;
                const avi_no_cabe = f.niveles_posibles < 2;
                if (!nidal_excede && !avi_excede && !avi_no_cabe) return null;
                const gallinasInput = parseInt(mainV.gallinas ?? "0");
                const superficieInput = parseFloat(mainV.superficie_nave_m2 ?? "0");
                return (
                  <div className="adjust-box">
                    <div className="adjust-box-title">Para cumplir la normativa necesitarías:</div>
                    {nidal_excede && (
                      <div className="adjust-section">
                        <div className="adjust-section-label">Con nidal colectivo</div>
                        <div className="adjust-grid">
                          {f.sup_minima_nidal != null && (
                            <div className="adjust-card">
                              <div className="adjust-card-eyebrow">Ampliar la nave a</div>
                              <div className="adjust-card-val">{f.sup_minima_nidal.toLocaleString("es-ES", { maximumFractionDigits: 1 })}<span className="adjust-card-unit"> m²</span></div>
                              <div className="adjust-card-sub">+{(f.sup_minima_nidal - superficieInput).toLocaleString("es-ES", { maximumFractionDigits: 1 })} m² sobre los actuales</div>
                            </div>
                          )}
                          {f.gallinas_max_nidal != null && f.gallinas_max_nidal > 0 && (
                            <div className="adjust-card">
                              <div className="adjust-card-eyebrow">Reducir gallinas a</div>
                              <div className="adjust-card-val">{f.gallinas_max_nidal.toLocaleString("es-ES")}<span className="adjust-card-unit"> aves</span></div>
                              <div className="adjust-card-sub">−{(gallinasInput - f.gallinas_max_nidal).toLocaleString("es-ES")} respecto al plan</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {(avi_excede || avi_no_cabe) && (
                      <div className="adjust-section">
                        <div className="adjust-section-label">Con aviario</div>
                        {avi_no_cabe ? (
                          <p className="adjust-prose">
                            Para instalar un aviario de 2 niveles necesitas al menos <strong>300 cm</strong> de altura libre.
                            Tu nave tiene <strong>{parseFloat(mainV.altura_nave_cm ?? "0").toLocaleString("es-ES")} cm</strong> — te faltan <strong>{(300 - parseFloat(mainV.altura_nave_cm ?? "0")).toLocaleString("es-ES")} cm</strong>.
                          </p>
                        ) : (
                          <div className="adjust-grid">
                            {f.sup_minima_avi != null && (
                              <div className="adjust-card">
                                <div className="adjust-card-eyebrow">Ampliar la nave a</div>
                                <div className="adjust-card-val">{f.sup_minima_avi.toLocaleString("es-ES", { maximumFractionDigits: 1 })}<span className="adjust-card-unit"> m²</span></div>
                                <div className="adjust-card-sub">+{(f.sup_minima_avi - superficieInput).toLocaleString("es-ES", { maximumFractionDigits: 1 })} m² sobre los actuales</div>
                              </div>
                            )}
                            {f.gallinas_max_avi != null && f.gallinas_max_avi > 0 && (
                              <div className="adjust-card">
                                <div className="adjust-card-eyebrow">Reducir gallinas a</div>
                                <div className="adjust-card-val">{f.gallinas_max_avi.toLocaleString("es-ES")}<span className="adjust-card-unit"> aves</span></div>
                                <div className="adjust-card-sub">−{(gallinasInput - f.gallinas_max_avi).toLocaleString("es-ES")} respecto al plan</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Preguntas dinámicas */}
              {factResult.factibilidad.factible && factResult.preguntas.length > 0 && (
                <div className="questions-wrap">
                  {factResult.preguntas.map((p: Pregunta, i: number) => {
                    if (i > preguntaIdx) return null;
                    const answered = respuestas[p.id];
                    const isActive = i === preguntaIdx;

                    if (answered && !isActive) {
                      const opcionTexto = p.opciones.find(o => o.id === answered)?.texto ?? answered;
                      return (
                        <div key={p.id} className="q-answered">
                          <div className="q-answered-inner">
                            <svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d="M1 6l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span className="q-answered-text">{opcionTexto}</span>
                          </div>
                          <button className="q-change-btn"
                            onClick={() => {
                              const ids = factResult.preguntas.slice(i).map((q: Pregunta) => q.id);
                              setRespuestas(r => {
                                const next = { ...r };
                                ids.forEach((id: string) => delete next[id]);
                                return next;
                              });
                              setPreguntaIdx(i);
                            }}>
                            Cambiar
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div key={p.id} className="q-active step-anim">
                        <div className="q-active-label">
                          <span className="q-num">{i + 1}</span>
                          {p.texto}
                        </div>
                        <div className="q-options">
                          {p.opciones.map(op => (
                            <button key={op.id} type="button" className="q-option"
                              onClick={() => {
                                setRespuestas(r => ({ ...r, [p.id]: op.id }));
                                setPreguntaIdx(i + 1);
                              }}>
                              <span className="q-option-dot" />
                              <span className="q-option-text">{op.texto}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {factResult.factibilidad.factible ? (
                <div className="btn-row">
                  {!factResult.preguntas.some((p: Pregunta) => !respuestas[p.id]) && (
                    <button className="btn-pill step-anim" onClick={onFactibilidadSubmit}>
                      Ver recomendación
                      <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  )}
                </div>
              ) : (
                <div className="btn-row">
                  <button className="btn-pill" onClick={() => go("main")}>Modificar datos</button>
                </div>
              )}
            </div>
          )}

          {/* ── Loading recomendación ── */}
          {step === "loading_rec" && (
            <div key={`loading_rec-${animKey}`} className="step-anim">
              <div className="loading-wrap">
                <div className="loading-dots"><span /><span /><span /></div>
                <p className="loading-text">Calculando recomendación...</p>
              </div>
            </div>
          )}

          {/* ── Step 3: Recomendación ── */}
          {step === "recomendacion" && rec && (
            <div key={`rec-${animKey}`} className="step-anim">
              <button className="btn-back" onClick={() => go("main")}>
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Volver
              </button>
              <div className="rec-badge">{sistemaLabel} · {mainV.gallinas} aves · {mainV.superficie_nave_m2} m²</div>
              <div className="form-title">Sistema de puesta recomendado</div>
              <p className="form-subtitle">Basado en la densidad y la altura disponible de la nave.</p>

              <div className="rec-result-card">
                <div className={`rec-result-icon ${rec.tipo_zona === "aviario" ? "is-aviario" : "is-nidal"}`}>
                  {rec.tipo_zona === "aviario"
                    ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="4" width="16" height="3" rx="1" fill="currentColor"/><rect x="2" y="9" width="16" height="3" rx="1" fill="currentColor" opacity=".65"/><rect x="2" y="14" width="16" height="3" rx="1" fill="currentColor" opacity=".35"/></svg>
                    : <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="3" y="7" width="14" height="8" rx="1" fill="currentColor"/><path d="M7 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
                  }
                </div>
                <div className="rec-result-body">
                  <div className="rec-result-name">
                    {rec.tipo_zona === "aviario" ? `Aviario multinivel (${rec.niveles} niveles)` : "Nidal colectivo"}
                  </div>
                  <p className="rec-result-reason">{rec.razon}</p>
                </div>
              </div>

              {/* Comparativa */}
              <div className="rec-compare">
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
                    <div key={tipo} className={`rec-card ${esRecomendado ? "is-recommended" : ""}`}>
                      {esRecomendado && <span className="rec-card-badge">Recomendado</span>}
                      <div className="rec-card-title">{titulo}</div>
                      <ul className="rec-card-list">
                        {puntos.map((p) => (
                          <li key={p} className="rec-card-item">
                            <span className={`rec-card-bullet ${esRecomendado ? "is-primary" : ""}`}>›</span>
                            {p}
                          </li>
                        ))}
                      </ul>
                      {!esRecomendado && disponible && (
                        <button className="btn-outline rec-card-choose" onClick={() => onConfirmar(tipo)}>
                          Elegir esta opción
                        </button>
                      )}
                      {!esRecomendado && !disponible && (
                        <p className="rec-card-unavailable">No disponible: altura insuficiente</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="btn-row">
                <button className="btn-pill" onClick={() => onConfirmar(tipoZona ?? rec.tipo_zona)}>
                  Confirmar y calcular requisitos
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Loading final ── */}
          {step === "loading" && (
            <div key={`loading-${animKey}`} className="step-anim">
              <div className="loading-wrap">
                <div className="loading-dots"><span /><span /><span /></div>
                <p className="loading-text">Calculando requisitos normativos...</p>
              </div>
            </div>
          )}

          {/* ── Result ── */}
          {step === "result" && (() => {
            if (!resultado) return (
              <div key={`result-${animKey}`} className="step-anim">
                <div className="error-box">Error al conectar con el servidor. Inténtalo de nuevo.</div>
                <button className="btn-pill" onClick={reset}>Nueva consulta</button>
              </div>
            );

            const { informe, analisis_legal } = resultado;
            const okCount   = informe.verificaciones_nave.filter((v) => v.cumple).length;
            const failCount = informe.verificaciones_nave.filter((v) => !v.cumple).length;
            const cumple    = informe.cumple_nave;

            return (
              <div key={`result-${animKey}`} className="step-anim">
                <div className="result-wrap">

                  {/* Banner */}
                  <div className={`result-banner ${cumple ? "is-ok" : "is-fail"}`}>
                    <div className={`result-banner-icon ${cumple ? "is-ok" : "is-fail"}`}>
                      {cumple
                        ? <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4 11l5 5 9-9" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M5 5l12 12M17 5L5 17" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
                      }
                    </div>
                    <div className="result-banner-text">
                      <strong className="result-banner-supra">Verificación de la instalación</strong>
                      <span className="result-banner-main">
                        {cumple ? "La nave cumple los parámetros básicos" : `${failCount} parámetro${failCount > 1 ? "s" : ""} no cumple${failCount > 1 ? "n" : ""}`}
                      </span>
                    </div>
                  </div>
                  <div className={`result-meta-strip ${cumple ? "is-ok" : "is-fail"}`}>
                    {[`${informe.num_gallinas} gallinas`, informe.sistema, "RD 3/2002"].map((p) => (
                      <span key={p} className="result-meta-pill">{p}</span>
                    ))}
                  </div>

                  {/* Verificaciones nave */}
                  <div className="result-block">
                    <div className="result-block-head">
                      <span className="result-block-label">Verificación de la nave</span>
                      <div className="result-stats">
                        <span className="result-stat is-ok">{okCount} OK</span>
                        {failCount > 0 && <span className="result-stat is-fail">{failCount} fallo{failCount > 1 ? "s" : ""}</span>}
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
                        <div key={v.parametro} className="check-row">
                          <div className={`check-icon ${ok ? "is-ok" : "is-fail"}`}>
                            {ok
                              ? <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                            }
                          </div>
                          <span className="check-name">{v.parametro}</span>
                          <div className="check-vals">
                            <span className="check-real">{v.valor_real.toLocaleString("es-ES", { maximumFractionDigits: 2 })}</span>
                            <span className="check-sep">/</span>
                            <span className="check-ref">{sym} {v.valor_limite.toLocaleString("es-ES", { maximumFractionDigits: 1 })} {v.unidad}</span>
                          </div>
                          <span className={`check-diff ${ok ? "is-ok" : "is-fail"}`}>{diff}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Requisitos calculados */}
                  <div className="result-block result-block--sep">
                    <div className="result-block-head">
                      <span className="result-block-label">Equipamiento mínimo requerido</span>
                    </div>
                    {informe.requisitos.map((r) => (
                      <div key={r.nombre} className="req-row">
                        <div className="req-icon">
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="3" stroke="currentColor" strokeWidth="1.5"/></svg>
                        </div>
                        <div className="req-body">
                          <div className="req-name">{r.nombre}</div>
                          <div className="req-formula">{r.formula}</div>
                        </div>
                        <div className="req-value">
                          {r.valor_minimo.toLocaleString("es-ES")} <span className="req-unit">{r.unidad}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Advertencias */}
                  {informe.advertencias.length > 0 && (
                    <div className="warn-block">
                      <div className="warn-head">
                        <span className="warn-label">⚠ Requisitos adicionales</span>
                      </div>
                      {informe.advertencias.map((w, i) => (
                        <div key={i} className="warn-row">
                          <span className="warn-text">{w}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Análisis legal */}
                  <div className="analysis-block">
                    <div className="analysis-head">
                      <span className="analysis-label">Análisis normativo</span>
                    </div>
                    <div className="analysis-body" dangerouslySetInnerHTML={{ __html: renderMd(analisis_legal) }} />
                  </div>

                  <div className="result-footer">
                    Basado en RD 3/2002 · Directiva 1999/74/CE · RD 637/2021 · Regl. UE 2018/848
                  </div>
                </div>

                <div className="btn-row">
                  <a href="/propuesta" target="_blank" className="btn-pill">
                    Ver propuesta comercial
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </a>
                  <button className="btn-outline" onClick={reset}>Nueva consulta</button>
                </div>
              </div>
            );
          })()}
        </main>
      </div>
    </>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CHAT_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@300;400;600;700&family=Montserrat:wght@700;800&family=JetBrains+Mono:wght@400;700&display=swap');

  :root {
    --c-primary:    #4f764d;
    --c-primary-dk: #234926;
    --c-title:      #000823;
    --c-body:       #484e62;
    --c-bg-alt:     #F6F7F8;
    --c-bg:         #ffffff;
    --c-border:     #dddddd;
    --c-ok-bg:      #eaf5ea;
    --c-ok-text:    #1d6b22;
    --c-ok-icon:    #2E7D4F;
    --c-fail-bg:    #fdecea;
    --c-fail-text:  #b5261e;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Source Sans Pro', sans-serif;
    font-size: 1rem; line-height: 1.65;
    background: var(--c-bg); color: var(--c-body);
    -webkit-font-smoothing: antialiased;
  }

  /* ── HEADER ── */
  .chat-hdr {
    background: var(--c-title);
    position: sticky; top: 0; z-index: 100;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .chat-hdr-inner {
    max-width: 760px; margin: 0 auto; padding: 0 2rem;
    height: 54px; display: flex; align-items: center; gap: 0.75rem;
  }
  .chat-logo {
    height: 30px; width: auto; display: block;
    filter: brightness(0) invert(1); flex-shrink: 0;
  }
  .chat-hdr-brand { display: flex; flex-direction: column; gap: 2px; flex: 1; }
  .chat-hdr-name { font-family: 'Montserrat', sans-serif; font-size: 0.65rem; font-weight: 700; color: rgba(255,255,255,0.85); letter-spacing: 0.14em; text-transform: uppercase; line-height: 1; }
  .chat-hdr-sub  { font-size: 0.58rem; color: rgba(255,255,255,0.35); letter-spacing: 0.1em; text-transform: uppercase; }
  .chat-hdr-link {
    display: inline-flex; align-items: center; gap: 0.4rem;
    font-family: 'Montserrat', sans-serif; font-size: 0.65rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; text-decoration: none;
    color: rgba(255,255,255,0.45); transition: color 0.15s; white-space: nowrap;
  }
  .chat-hdr-link:hover { color: rgba(255,255,255,0.85); }

  /* ── ROOT ── */
  .chat-root { max-width: 760px; margin: 0 auto; }

  /* ── INTRO ── */
  .chat-intro { padding: 2.5rem 2rem 0; }
  .chat-eyebrow { font-size: 0.72rem; color: var(--c-primary); margin-bottom: 0.4rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; font-family: 'Montserrat', sans-serif; }
  .chat-title { font-family: 'Montserrat', sans-serif; font-size: clamp(1.8rem, 4vw, 2.82rem); font-weight: 800; color: var(--c-title); letter-spacing: -0.02em; line-height: 1; }
  .chat-tagline { font-size: 1rem; color: var(--c-body); margin-top: 0.6rem; font-weight: 300; line-height: 1.65; }
  .chat-divider { height: 3px; background: var(--c-primary); width: 48px; margin: 1.25rem 0 1.5rem; border-radius: 2px; }

  /* ── MAIN ── */
  .chat-main { padding: 0 2rem 4rem; }

  /* ── PROGRESS ── */
  .prog-bar { display: flex; align-items: center; margin-bottom: 2.5rem; }
  .prog-step-outer { display: flex; align-items: center; }
  .prog-step-outer--flex { flex: 1; }
  .prog-step { display: flex; align-items: center; gap: 0.5rem; }
  .prog-circle {
    width: 28px; height: 28px; border-radius: 50%;
    border: 2px solid var(--c-border); background: var(--c-bg);
    font-family: 'Montserrat', sans-serif; font-size: 0.65rem; font-weight: 700; color: #bbb;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s;
  }
  .prog-circle.is-active { border-color: var(--c-title); background: var(--c-title); color: #fff; }
  .prog-circle.is-done   { border-color: var(--c-primary); background: var(--c-primary); color: #fff; }
  .prog-label { font-family: 'Montserrat', sans-serif; font-size: 0.68rem; color: #bbb; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
  .prog-label.is-active  { color: var(--c-title); }
  .prog-line { flex: 1; height: 1px; background: var(--c-border); margin: 0 0.6rem; min-width: 12px; }

  @keyframes stepIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .step-anim { animation: stepIn 0.22s ease forwards; }

  /* ── FORM ── */
  .form-title    { font-family: 'Montserrat', sans-serif; font-size: 1.52rem; font-weight: 800; color: var(--c-title); margin-bottom: 0.3rem; line-height: 1.1; }
  .form-subtitle { font-size: 0.95rem; color: var(--c-body); margin-bottom: 1.75rem; font-weight: 300; line-height: 1.65; }
  .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .field { margin-bottom: 1.1rem; }
  .field-label { display: block; font-family: 'Montserrat', sans-serif; font-size: 0.68rem; font-weight: 700; color: var(--c-title); margin-bottom: 0.4rem; letter-spacing: 0.08em; text-transform: uppercase; }
  .field-input-wrap { position: relative; display: flex; align-items: center; }
  .field-unit { position: absolute; right: 0.9rem; font-size: 0.82rem; color: #bbb; pointer-events: none; }
  .field-select, .field-input {
    width: 100%; background: var(--c-bg); border: 1px solid var(--c-border);
    border-radius: 2px; padding: 0.7rem 0.9rem;
    font-family: 'Source Sans Pro', sans-serif; font-size: 0.95rem;
    color: var(--c-title); outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .field-input--unit { padding-right: 3.5rem; }
  .field-select {
    appearance: none; -webkit-appearance: none; cursor: pointer;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23484e62' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 0.9rem center; padding-right: 2.2rem;
  }
  .field-select:focus, .field-input:focus { border-color: var(--c-primary); box-shadow: 0 0 0 3px rgba(79,118,77,0.1); }

  /* ── BUTTONS ── */
  .btn-row { display: flex; align-items: center; gap: 1rem; margin-top: 2rem; flex-wrap: wrap; }
  .btn-pill {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: var(--c-primary); color: #ffffff;
    border: none; border-radius: 30px;
    padding: 0.75rem 1.75rem; font-family: 'Source Sans Pro', sans-serif;
    font-size: 0.9rem; font-weight: 700; cursor: pointer;
    letter-spacing: 0.05em; text-transform: uppercase; text-decoration: none;
    transition: background 0.15s;
  }
  .btn-pill:hover  { background: var(--c-primary-dk); }
  .btn-pill:disabled { opacity: 0.4; cursor: default; }
  .btn-outline {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: transparent; color: var(--c-primary);
    border: 2px solid var(--c-primary); border-radius: 30px;
    padding: 0.7rem 1.5rem; font-family: 'Source Sans Pro', sans-serif;
    font-size: 0.9rem; font-weight: 600; cursor: pointer;
    letter-spacing: 0.04em; text-decoration: none;
    transition: background 0.15s, color 0.15s;
  }
  .btn-outline:hover { background: var(--c-primary); color: #ffffff; }
  .btn-back {
    display: inline-flex; align-items: center; gap: 0.45rem;
    font-family: 'Montserrat', sans-serif; font-size: 0.68rem; font-weight: 700;
    color: var(--c-body); cursor: pointer; border: none; background: none;
    padding: 0; margin-bottom: 1.75rem; letter-spacing: 0.08em; text-transform: uppercase;
    transition: color 0.15s;
  }
  .btn-back:hover { color: var(--c-primary); }

  /* ── LOADING ── */
  @keyframes pulse { 0%,100%{opacity:.3} 50%{opacity:1} }
  .loading-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5rem 2rem; gap: 1.5rem; }
  .loading-dots { display: flex; gap: 10px; }
  .loading-dots span { width: 10px; height: 10px; border-radius: 50%; background: var(--c-primary); animation: pulse 1.3s ease infinite; }
  .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
  .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
  .loading-text { font-size: 0.9rem; color: var(--c-body); font-style: italic; }

  /* ── FACTIBILIDAD ── */
  .fact-box {
    border: 2px solid; border-radius: 2px;
    padding: 1.25rem 1.5rem; margin-bottom: 1.5rem;
  }
  .fact-box.is-ok   { border-color: var(--c-primary); background: var(--c-ok-bg); }
  .fact-box.is-fail { border-color: var(--c-fail-text); background: var(--c-fail-bg); }
  .fact-box-inner { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; }
  .fact-icon {
    width: 38px; height: 38px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .fact-icon.is-ok   { background: var(--c-primary); }
  .fact-icon.is-fail { background: var(--c-fail-text); }
  .fact-heading { font-family: 'Montserrat', sans-serif; font-weight: 800; font-size: 1rem; color: var(--c-title); margin-bottom: 0.35rem; }
  .fact-msg { font-size: 0.9rem; color: var(--c-body); line-height: 1.65; margin: 0; }
  .density-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-top: 0.25rem; }
  .density-card { background: var(--c-bg); padding: 0.75rem 1rem; border: 1px solid var(--c-border); }
  .density-card.is-warn { border-color: #f5b8b8; }
  .density-label { font-family: 'Montserrat', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--c-body); margin-bottom: 0.3rem; }
  .density-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 1.4rem; color: var(--c-title); line-height: 1; }
  .density-val.is-warn { color: var(--c-fail-text); }
  .density-val.is-na { font-size: 1rem; color: var(--c-body); }
  .density-card.is-na { opacity: 0.5; }
  .density-unit { font-size: 0.72rem; color: var(--c-body); margin-top: 0.15rem; }

  /* ── AJUSTE RECOMENDADO ── */
  .adjust-box {
    margin-bottom: 1.5rem; padding: 1.1rem 1.25rem;
    background: #fffbeb; border: 1px solid #f5d87a; border-left: 3px solid #d4a017;
  }
  .adjust-box-title {
    font-family: 'Montserrat', sans-serif; font-size: 0.65rem; font-weight: 700;
    letter-spacing: 0.1em; text-transform: uppercase; color: #7a5c00; margin-bottom: 0.9rem;
  }
  .adjust-section { margin-bottom: 0.85rem; }
  .adjust-section:last-child { margin-bottom: 0; }
  .adjust-section-label {
    font-family: 'Montserrat', sans-serif; font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; color: #9a7200;
    margin-bottom: 0.5rem; padding-bottom: 0.3rem; border-bottom: 1px solid #f0d080;
  }
  .adjust-section-note {
    font-family: 'Montserrat', sans-serif; font-size: 0.6rem; font-weight: 400;
    letter-spacing: 0; text-transform: none; color: #b08000;
  }
  .adjust-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .adjust-grid--single { grid-template-columns: 1fr; max-width: 50%; }
  .adjust-card { background: #fff; border: 1px solid #f0d080; padding: 0.75rem 0.9rem; }
  .adjust-card-eyebrow {
    font-family: 'Montserrat', sans-serif; font-size: 0.55rem; font-weight: 700;
    letter-spacing: 0.08em; text-transform: uppercase; color: #7a5c00; margin-bottom: 0.3rem;
  }
  .adjust-card-val {
    font-family: 'JetBrains Mono', monospace; font-size: 1.25rem; font-weight: 700;
    color: var(--c-title); line-height: 1;
  }
  .adjust-card-unit { font-size: 0.75rem; font-weight: 400; color: var(--c-body); }
  .adjust-card-sub { font-size: 0.68rem; color: var(--c-body); margin-top: 0.3rem; }
  .adjust-prose { font-size: 0.9rem; color: var(--c-body); line-height: 1.65; margin: 0; }

  /* ── PREGUNTAS ── */
  .questions-wrap { margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
  .q-answered {
    display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
    padding: 0.75rem 1rem;
    border: 2px solid var(--c-primary); background: var(--c-ok-bg);
  }
  .q-answered-inner { display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 0; color: var(--c-primary); }
  .q-answered-text { font-size: 0.85rem; color: var(--c-primary); font-weight: 700; letter-spacing: 0.04em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .q-change-btn { background: none; border: none; color: var(--c-primary); font-size: 0.72rem; cursor: pointer; font-family: 'Montserrat', sans-serif; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 700; padding: 0.2rem 0.4rem; flex-shrink: 0; }
  .q-change-btn:hover { text-decoration: underline; }
  .q-active { }
  .q-active-label { font-family: 'Montserrat', sans-serif; font-size: 0.72rem; font-weight: 700; color: var(--c-title); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.5rem; }
  .q-num { background: var(--c-title); color: #fff; border-radius: 50%; width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; flex-shrink: 0; }
  .q-options { display: flex; flex-direction: column; gap: 0.45rem; }
  .q-option {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.8rem 1rem; text-align: left;
    border: 2px solid var(--c-border); background: var(--c-bg);
    border-radius: 2px; cursor: pointer; transition: border-color 0.15s, background 0.15s;
    font-family: 'Source Sans Pro', sans-serif; width: 100%;
  }
  .q-option:hover { border-color: var(--c-primary); background: var(--c-ok-bg); }
  .q-option-dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--c-border); flex-shrink: 0; }
  .q-option:hover .q-option-dot { border-color: var(--c-primary); }
  .q-option-text { font-size: 0.92rem; color: var(--c-title); }

  /* ── RECOMENDACIÓN ── */
  .rec-badge { display: inline-block; padding: 0.25rem 0.85rem; background: var(--c-ok-bg); color: var(--c-primary); border-radius: 30px; font-size: 0.75rem; font-weight: 700; margin-bottom: 1.25rem; letter-spacing: 0.04em; font-family: 'Montserrat', sans-serif; }
  .rec-result-card { background: var(--c-bg); border: 1px solid var(--c-border); padding: 1.5rem 1.75rem; margin-bottom: 1.25rem; display: flex; align-items: flex-start; gap: 1rem; }
  .rec-result-icon { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .rec-result-icon.is-aviario { background: var(--c-ok-bg); color: var(--c-primary); }
  .rec-result-icon.is-nidal   { background: var(--c-bg-alt); color: var(--c-body); }
  .rec-result-name { font-family: 'Montserrat', sans-serif; font-size: 1.17rem; font-weight: 800; margin-bottom: 0.25rem; color: var(--c-title); }
  .rec-result-reason { font-size: 0.92rem; color: var(--c-body); line-height: 1.65; margin: 0; }
  .rec-compare { display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem; margin-bottom: 1.5rem; }
  .rec-card {
    border: 2px solid var(--c-border); padding: 1rem 1.1rem;
    background: var(--c-bg-alt); position: relative;
  }
  .rec-card.is-recommended { border-color: var(--c-primary); background: var(--c-ok-bg); }
  .rec-card-badge {
    position: absolute; top: -11px; left: 12px;
    background: var(--c-primary); color: #fff;
    font-family: 'Montserrat', sans-serif; font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.12em; text-transform: uppercase;
    padding: 0.15rem 0.7rem; border-radius: 30px;
  }
  .rec-card-title { font-family: 'Montserrat', sans-serif; font-size: 0.92rem; font-weight: 800; margin-bottom: 0.65rem; color: var(--c-title); }
  .rec-card-list { margin: 0; padding: 0; list-style: none; }
  .rec-card-item { font-size: 0.82rem; color: var(--c-body); line-height: 1.6; margin-bottom: 0.3rem; padding-left: 1rem; position: relative; }
  .rec-card-bullet { position: absolute; left: 0; color: var(--c-border); }
  .rec-card-bullet.is-primary { color: var(--c-primary); }
  .rec-card-choose {
    margin-top: 0.85rem; background: none; border: 1px solid var(--c-border);
    border-radius: 30px; color: var(--c-body); font-size: 0.78rem; padding: 0.35rem 0.85rem;
    cursor: pointer; font-family: 'Source Sans Pro', sans-serif; width: 100%;
    transition: border-color 0.15s, color 0.15s;
  }
  .rec-card-choose:hover { border-color: var(--c-primary); color: var(--c-primary); }
  .rec-card-unavailable { margin-top: 0.75rem; font-size: 0.75rem; color: #bbb; font-style: italic; }

  /* ── RESULT ── */
  .result-wrap { border: 1px solid var(--c-border); margin-bottom: 1.5rem; overflow: hidden; box-shadow: 0 2px 16px rgba(0,0,0,0.07); }
  .result-banner { padding: 1.4rem 1.75rem; display: flex; align-items: center; gap: 1.25rem; }
  .result-banner.is-ok   { background: #1E4D2B; }
  .result-banner.is-fail { background: #4D1E1E; }
  .result-banner-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .result-banner.is-ok   .result-banner-icon { background: #2E7D4F; }
  .result-banner.is-fail .result-banner-icon { background: #C0392B; }
  .result-banner-text { color: #fff; display: flex; flex-direction: column; gap: 0.2rem; }
  .result-banner-supra { font-family: 'Montserrat', sans-serif; font-size: 0.65rem; letter-spacing: 0.12em; text-transform: uppercase; display: block; font-weight: 700; }
  .result-banner.is-ok   .result-banner-supra { color: #A8F0BC; }
  .result-banner.is-fail .result-banner-supra { color: #F5B8B8; }
  .result-banner-main { font-family: 'Montserrat', sans-serif; font-size: 1.1rem; font-weight: 700; line-height: 1.2; }
  .result-meta-strip { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem 1.75rem; }
  .result-meta-strip.is-ok   { background: rgba(30,77,43,0.85); }
  .result-meta-strip.is-fail { background: rgba(77,30,30,0.85); }
  .result-meta-pill { font-size: 0.74rem; font-weight: 500; padding: 0.2rem 0.65rem; background: rgba(255,255,255,0.14); color: rgba(255,255,255,0.85); letter-spacing: 0.03em; border-radius: 30px; }

  .result-block { background: var(--c-bg); }
  .result-block--sep { border-top: 2px solid var(--c-bg-alt); }
  .result-block-head { padding: 0.8rem 1.75rem; background: var(--c-bg-alt); border-bottom: 1px solid var(--c-border); display: flex; align-items: center; justify-content: space-between; }
  .result-block-label { font-family: 'Montserrat', sans-serif; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-body); }
  .result-stats { display: flex; gap: 0.5rem; }
  .result-stat { font-family: 'Montserrat', sans-serif; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.6rem; border-radius: 30px; letter-spacing: 0.04em; }
  .result-stat.is-ok   { background: var(--c-ok-bg);   color: var(--c-ok-text); }
  .result-stat.is-fail { background: var(--c-fail-bg);  color: var(--c-fail-text); }

  .check-row { display: flex; align-items: center; padding: 0.75rem 1.75rem; border-bottom: 1px solid var(--c-border); gap: 0.75rem; }
  .check-row:last-child { border-bottom: none; }
  .check-icon { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .check-icon.is-ok   { background: var(--c-ok-bg);   color: var(--c-ok-icon); }
  .check-icon.is-fail { background: var(--c-fail-bg);  color: var(--c-fail-text); }
  .check-name { flex: 1; font-size: 0.9rem; color: var(--c-title); font-weight: 400; }
  .check-vals { display: flex; align-items: center; gap: 0.35rem; font-size: 0.82rem; flex-shrink: 0; }
  .check-real { color: var(--c-title); font-weight: 600; }
  .check-sep  { color: var(--c-border); }
  .check-ref  { color: var(--c-body); }
  .check-diff { font-family: 'Montserrat', sans-serif; font-size: 0.7rem; font-weight: 700; padding: 0.13rem 0.55rem; border-radius: 30px; flex-shrink: 0; white-space: nowrap; }
  .check-diff.is-ok   { background: var(--c-ok-bg);   color: var(--c-ok-text); }
  .check-diff.is-fail { background: var(--c-fail-bg);  color: var(--c-fail-text); }

  .req-row { display: flex; align-items: flex-start; padding: 0.75rem 1.75rem; border-bottom: 1px solid var(--c-border); gap: 0.75rem; }
  .req-row:last-child { border-bottom: none; }
  .req-icon { width: 22px; height: 22px; border-radius: 50%; background: var(--c-bg-alt); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; color: var(--c-body); }
  .req-body { flex: 1; min-width: 0; }
  .req-name { font-size: 0.9rem; color: var(--c-title); font-weight: 400; }
  .req-formula { font-size: 0.78rem; color: #bbb; margin-top: 0.1rem; font-style: italic; }
  .req-value { font-family: 'JetBrains Mono', monospace; font-size: 0.95rem; font-weight: 700; color: var(--c-title); flex-shrink: 0; white-space: nowrap; }
  .req-unit { font-weight: 400; font-size: 0.78rem; color: var(--c-body); }

  .warn-block { background: #fffdf0; border-top: 2px solid #f5e580; }
  .warn-head  { padding: 0.8rem 1.75rem; background: #fdf9d6; border-bottom: 1px solid #f0e070; }
  .warn-label { font-family: 'Montserrat', sans-serif; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #7a6500; }
  .warn-row   { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.85rem 1.75rem; border-bottom: 1px solid #f0e070; }
  .warn-row:last-child { border-bottom: none; }
  .warn-text  { font-size: 0.88rem; color: #5a4a00; line-height: 1.65; }

  .analysis-block { background: var(--c-bg); border-top: 1px solid var(--c-border); }
  .analysis-head  { padding: 0.8rem 1.75rem; background: var(--c-bg-alt); border-bottom: 1px solid var(--c-border); }
  .analysis-label { font-family: 'Montserrat', sans-serif; font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--c-body); }
  .analysis-body  { padding: 1.4rem 1.75rem; font-size: 0.95rem; line-height: 1.75; color: var(--c-body); }
  .analysis-body strong { font-weight: 700; color: var(--c-title); }
  .analysis-body em { font-style: italic; }
  .md-section-label {
    display: block; font-family: 'Montserrat', sans-serif;
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em;
    text-transform: uppercase; color: var(--c-primary);
    margin-top: 1.4rem; margin-bottom: 0.35rem;
  }

  .result-footer { font-size: 0.72rem; color: #bbb; font-style: italic; padding: 0.85rem 1.75rem; background: var(--c-bg-alt); border-top: 1px solid var(--c-border); }
  .error-box { padding: 1.5rem; background: var(--c-fail-bg); border: 1px solid #f5b8b8; color: var(--c-fail-text); font-size: 0.9rem; text-align: center; margin-bottom: 1.5rem; border-radius: 2px; }

  /* ── MODE SELECTOR ── */
  .mode-grid { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 0.5rem; }
  .mode-card {
    display: flex; align-items: center; gap: 1.1rem;
    padding: 1.25rem 1.5rem; text-align: left; width: 100%;
    border: 2px solid var(--c-border); background: var(--c-bg);
    cursor: pointer; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
    font-family: inherit;
  }
  .mode-card:hover { border-color: var(--c-primary); background: var(--c-ok-bg); box-shadow: 0 2px 12px rgba(79,118,77,0.1); }
  .mode-card-icon {
    width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
    background: var(--c-bg-alt); color: var(--c-primary);
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .mode-card:hover .mode-card-icon { background: rgba(79,118,77,0.18); }
  .mode-card-body { flex: 1; min-width: 0; }
  .mode-card-title { font-family: 'Montserrat', sans-serif; font-size: 1rem; font-weight: 800; color: var(--c-title); margin-bottom: 0.3rem; }
  .mode-card-desc { font-size: 0.88rem; color: var(--c-body); line-height: 1.55; margin: 0; }
  .mode-card-arrow { color: var(--c-border); flex-shrink: 0; transition: color 0.15s, transform 0.15s; }
  .mode-card:hover .mode-card-arrow { color: var(--c-primary); transform: translateX(3px); }

  /* ── CAPACIDAD ── */
  .cap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.75rem; }
  .cap-card { border: 2px solid var(--c-border); padding: 1.1rem 1.25rem; background: var(--c-bg-alt); }
  .cap-card.is-viable { border-color: var(--c-primary); background: var(--c-ok-bg); }
  .cap-card.is-no { opacity: 0.55; }
  .cap-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.65rem; }
  .cap-card-label { font-family: 'Montserrat', sans-serif; font-size: 0.72rem; font-weight: 700; color: var(--c-title); letter-spacing: 0.06em; text-transform: uppercase; }
  .cap-card-badge { font-family: 'Montserrat', sans-serif; font-size: 0.58rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.15rem 0.55rem; border-radius: 30px; }
  .cap-card-badge.is-viable { background: var(--c-ok-bg); color: var(--c-ok-text); border: 1px solid var(--c-primary); }
  .cap-card-badge.is-no     { background: var(--c-bg-alt); color: #bbb; border: 1px solid var(--c-border); }
  .cap-card-gallinas { font-family: 'JetBrains Mono', monospace; font-size: 2rem; font-weight: 700; color: var(--c-title); line-height: 1; margin-bottom: 0.45rem; }
  .cap-card-modulos { font-size: 1.4rem; margin-top: 0; margin-bottom: 0.35rem; color: var(--c-primary); }
  .cap-card-unit { font-size: 0.85rem; font-weight: 400; color: var(--c-body); }
  .cap-card-details { font-size: 0.78rem; color: var(--c-body); display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  .cap-detail-sep { color: var(--c-border); }

  .field-computed { font-size: 0.78rem; color: var(--c-primary); font-weight: 600; margin-top: -0.5rem; margin-bottom: 0.5rem; }

  .cap-card-layout { margin-top: 0.65rem; padding-top: 0.55rem; border-top: 1px solid rgba(0,0,0,0.07); display: flex; flex-direction: column; gap: 0.2rem; }
  .cap-layout-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 0.74rem; }
  .cap-layout-label { color: var(--c-body); }
  .cap-layout-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--c-title); font-size: 0.76rem; }

  .cap-card-yacija { margin-top: 0.65rem; padding-top: 0.55rem; border-top: 1px solid rgba(0,0,0,0.07); display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.76rem; }
  .cap-yacija-label { color: var(--c-body); flex-shrink: 0; }
  .cap-yacija-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--c-title); font-size: 0.8rem; }
  .cap-yacija-pct { font-weight: 400; color: var(--c-body); }
  .cap-yacija-pct.is-warn { color: var(--c-fail-text); font-weight: 700; }

  /* ── STATS GRID ── */
  .cap-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem 0.75rem; margin-top: 0.75rem; padding-top: 0.6rem; border-top: 1px solid rgba(0,0,0,0.07); }
  .cap-stat { display: flex; flex-direction: column; gap: 0.08rem; }
  .cap-stat-label { font-family: 'Montserrat', sans-serif; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--c-body); }
  .cap-stat-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 0.8rem; color: var(--c-title); }
  .cap-stat-val.is-warn { color: var(--c-fail-text); }

  /* ── PARQUE DE INVIERNO ── */
  .cap-card-parque { margin-top: 0.75rem; padding-top: 0.65rem; border-top: 1px solid rgba(0,0,0,0.07); }
  .cap-parque-title { font-family: 'Montserrat', sans-serif; font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-body); margin-bottom: 0.5rem; }
  .cap-parque-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
  .cap-parque-opcion { border-radius: 2px; padding: 0.6rem 0.7rem; border: 1px solid var(--c-border); }
  .cap-parque-opcion--a { background: var(--c-bg-alt); }
  .cap-parque-opcion--b { background: var(--c-ok-bg); border-color: rgba(45,125,50,0.35); }
  .cap-parque-opcion-head { font-family: 'Montserrat', sans-serif; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 0.3rem; }
  .cap-parque-opcion--a .cap-parque-opcion-head { color: var(--c-body); }
  .cap-parque-opcion--b .cap-parque-opcion-head { color: var(--c-ok-text); }
  .cap-parque-opcion-gallinas { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 1.05rem; color: var(--c-title); margin-bottom: 0.35rem; }
  .cap-parque-opcion-row { display: flex; justify-content: space-between; align-items: center; margin-top: 0.2rem; }
  .cap-parque-opcion-key { font-size: 0.69rem; color: var(--c-body); }
  .cap-parque-opcion-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 0.72rem; color: var(--c-title); }
  .cap-parque-opcion-tag { display: inline-block; margin-top: 0.45rem; font-family: 'Montserrat', sans-serif; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; padding: 0.18rem 0.45rem; border-radius: 20px; }
  .cap-parque-opcion-tag--ok { background: var(--c-ok-bg); color: var(--c-ok-text); }
  .cap-parque-opcion-tag--parque { background: rgba(79,118,77,0.12); color: var(--c-primary-dk); }

  /* ── PARETO ── */
  .cap-card-pareto {
    margin-top: 0.75rem; padding-top: 0.65rem;
    border-top: 1px solid rgba(0,0,0,0.07);
  }
  .cap-pareto-head {
    display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.35rem;
  }
  .cap-pareto-title {
    font-family: 'Montserrat', sans-serif; font-size: 0.6rem; font-weight: 700;
    letter-spacing: 0.09em; text-transform: uppercase; color: var(--c-body);
  }
  .cap-pareto-sub { font-size: 0.6rem; color: #bbb; }
  .cap-pareto-cols {
    display: grid; grid-template-columns: 38px 1fr 56px 40px 52px;
    gap: 4px; padding: 0 4px; margin-bottom: 3px;
    font-family: 'Montserrat', sans-serif; font-size: 0.55rem;
    font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #bbb;
  }
  .cap-pareto-table { display: flex; flex-direction: column; gap: 2px; }
  .cap-pareto-row {
    display: grid; grid-template-columns: 38px 1fr 56px 40px 52px;
    align-items: center; gap: 4px; padding: 3px 4px; border-radius: 2px;
  }
  .cap-pareto-row.is-opt { background: rgba(79,118,77,0.12); }
  .cap-pareto-row.is-min { background: rgba(212,160,23,0.1); }
  .cap-pareto-m {
    font-family: 'JetBrains Mono', monospace; font-size: 0.65rem;
    color: var(--c-body); white-space: nowrap;
  }
  .cap-pareto-n {
    font-family: 'JetBrains Mono', monospace; font-size: 0.7rem;
    font-weight: 700; color: var(--c-title); text-align: right;
  }
  .cap-pareto-ybar-wrap {
    position: relative; height: 4px; background: var(--c-border);
    border-radius: 2px; overflow: visible;
  }
  .cap-pareto-ybar { height: 100%; background: var(--c-primary); border-radius: 2px; opacity: 0.65; }
  .cap-pareto-ybar-ref {
    position: absolute; top: -2px; bottom: -2px; left: 33.3%;
    width: 1.5px; background: #d4a017; transform: translateX(-50%);
  }
  .cap-pareto-pct {
    font-family: 'JetBrains Mono', monospace; font-size: 0.65rem;
    color: var(--c-body); text-align: right;
  }
  .cap-pareto-pct.is-warn { color: var(--c-fail-text); }
  .cap-pareto-tag {
    font-family: 'Montserrat', sans-serif; font-size: 0.52rem; font-weight: 700;
    letter-spacing: 0.05em; text-transform: uppercase;
    padding: 0.1rem 0.32rem; border-radius: 30px; white-space: nowrap; text-align: center;
  }
  .cap-pareto-tag.is-opt { background: var(--c-ok-bg); color: var(--c-ok-text); }
  .cap-pareto-tag.is-min { background: rgba(212,160,23,0.18); color: #7a5c00; }
  .cap-pareto-loss {
    font-family: 'JetBrains Mono', monospace; font-size: 0.62rem;
    color: #bbb; text-align: center;
  }
  .cap-pareto-legend {
    display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;
    font-size: 0.6rem; color: #bbb; margin-top: 0.4rem;
  }
  .cap-pareto-legend-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 3px;
  }
  .cap-pareto-legend-dot.is-opt { background: var(--c-primary); opacity: 0.6; }
  .cap-pareto-legend-dot.is-min { background: #d4a017; opacity: 0.6; }

  /* ── LAYOUT NIDAL ── */
  .layout-section { margin-top: 1rem; }
  .layout-divider { border: none; border-top: 1px dashed rgba(0,0,0,0.1); margin-bottom: 0.75rem; }
  .layout-title { font-family: 'Montserrat', sans-serif; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--c-body); margin-bottom: 0.55rem; }
  .layout-form { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .layout-hint { font-size: 0.72rem; color: var(--c-body); opacity: 0.65; width: 100%; margin-top: -0.15rem; }
  .btn-pill--sm { padding: 0.4rem 0.9rem; font-size: 0.75rem; }
  .layout-loading { display: flex; align-items: center; gap: 0.5rem; color: var(--c-body); font-size: 0.78rem; padding: 0.5rem 0; }
  .loading-dots--sm span { width: 5px; height: 5px; }
  .layout-result { margin-top: 0.5rem; }
  .layout-reset { background: none; border: none; cursor: pointer; font-size: 0.73rem; color: var(--c-body); padding: 0 0 0.5rem; text-decoration: underline; }
  .layout-error { background: rgba(220,38,38,0.07); border: 1px solid rgba(220,38,38,0.2); border-radius: 6px; padding: 0.6rem 0.8rem; font-size: 0.76rem; color: #dc2626; margin-bottom: 0.5rem; }
  .layout-filas { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.65rem; }
  .layout-fila-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; background: rgba(0,0,0,0.03); border-radius: 5px; padding: 0.35rem 0.55rem; }
  .layout-fila-num { font-weight: 700; color: var(--c-title); min-width: 40px; }
  .layout-fila-detail { flex: 1; color: var(--c-body); }
  .layout-fila-slot { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; color: var(--c-primary); font-weight: 600; }
  .layout-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; margin-bottom: 0.65rem; }
  .layout-stat { background: rgba(0,0,0,0.03); border-radius: 6px; padding: 0.4rem 0.55rem; }
  .layout-stat--norm { grid-column: span 2; }
  .layout-stat--norm.is-ok { background: rgba(22,163,74,0.08); }
  .layout-stat--norm.is-fail { background: rgba(220,38,38,0.07); }
  .layout-stat-label { display: block; font-size: 0.62rem; color: var(--c-body); margin-bottom: 0.15rem; text-transform: uppercase; letter-spacing: 0.05em; }
  .layout-stat-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 0.82rem; color: var(--c-title); }
  .layout-stat-val.is-warn { color: var(--c-fail-text); }
  .layout-stat--norm.is-ok .layout-stat-val { color: #16a34a; }
  .layout-stat--norm.is-fail .layout-stat-val { color: #dc2626; }
  .layout-explicacion { font-size: 0.75rem; color: var(--c-body); line-height: 1.5; margin: 0 0 0.5rem; }
  .layout-exterior-ask { background: rgba(234,179,8,0.07); border: 1px solid rgba(234,179,8,0.3); border-radius: 8px; padding: 0.7rem 0.8rem; margin-top: 0.65rem; }
  .layout-exterior-msg { font-size: 0.76rem; color: #92400e; margin: 0 0 0.55rem; line-height: 1.4; }

  /* ── RESPONSIVE ── */
  @media (max-width: 520px) {
    .chat-intro, .chat-main { padding-left: 1.25rem; padding-right: 1.25rem; }
    .field-row { grid-template-columns: 1fr; }
    .rec-compare { grid-template-columns: 1fr; }
    .density-grid { grid-template-columns: 1fr 1fr; }
    .check-row { flex-wrap: wrap; }
    .check-vals, .check-diff { font-size: 0.75rem; }
    .chat-hdr-link { display: none; }
  }
`;
