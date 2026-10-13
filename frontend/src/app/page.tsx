"use client";

import { useState } from "react";
import {
  pedirEstudio,
  type EstudioResponse,
  type EstudioRequest,
  type EquipamientoMedido,
  type Sistema,
  type TipoZona,
} from "./actions";
import { ESTUDIO_CSS } from "./estudio-styles";

type Paso = "modulo" | "nave" | "estudio";

const SISTEMAS: { value: Sistema; label: string }[] = [
  { value: "suelo",     label: "Suelo (indoor)" },
  { value: "campero",   label: "Campero" },
  { value: "ecologico", label: "Ecológico" },
];

const SLOTS = [0, 1, 2, 3];

interface FormState {
  sistema: Sistema;
  ancho: string;
  largo: string;
  altura: string;
  parque: string;
  pasto: string;
  slotIzq: number;
  slotDer: number;
  pasoIzq: string;
  pasoDer: string;
  niveles: "auto" | "2" | "3";
}

const FORM_INICIAL: FormState = {
  sistema: "suelo",
  ancho: "",
  largo: "",
  altura: "",
  parque: "",
  pasto: "",
  slotIzq: 3,
  slotDer: 3,
  pasoIzq: "1",
  pasoDer: "1",
  niveles: "auto",
};

const CUERPO_PROF = 1.4;   // m — profundidad del cuerpo del módulo A-Nida
const PASO_PARED_DEF = 1.0;   // m — paso libre por defecto entre el slat y cada pared

export default function EstudioPage() {
  const [paso, setPaso]       = useState<Paso>("modulo");
  const [zona, setZona]       = useState<TipoZona | null>(null);
  const [form, setForm]       = useState<FormState>(FORM_INICIAL);
  const [res, setRes]         = useState<EstudioResponse | null>(null);
  const [svg, setSvg]         = useState<string>("");
  const [descargandoDxf, setDescargandoDxf] = useState(false);
  const [cargando, setCarga]  = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [mediciones, setMediciones] = useState<Record<string, string>>({});
  const equipamiento: EquipamientoMedido = form.sistema === "ecologico" ? {} : Object.fromEntries(
    Object.entries(mediciones).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])
  );

  const esNidal = zona === "nidal_colectivo";
  const ancho   = parseFloat(form.ancho);
  const largo   = parseFloat(form.largo);
  const altura  = parseFloat(form.altura);
  const superficie = ancho > 0 && largo > 0 ? ancho * largo : 0;

  const profTotal = CUERPO_PROF + form.slotIzq + form.slotDer;
  // Paso libre mínimo en cada lado; la distribución mantiene el nidal centrado.
  const leerPaso = (v: string) => (v === "" ? PASO_PARED_DEF : Math.max(0, parseFloat(v) || 0));
  const pasoIzqM    = leerPaso(form.pasoIzq);
  const pasoDerM    = leerPaso(form.pasoDer);
  const pasoMinimo = Math.max(pasoIzqM, pasoDerM);
  const anchoMinimo = profTotal + 2 * pasoMinimo;
  const slotsInvalidos = esNidal && form.slotIzq + form.slotDer === 0;
  const profExcedida   = esNidal && ancho > 0 && anchoMinimo > ancho;

  // Esquema de sección: el dibujo se escala sobre el mayor entre el ancho de nave
  // y el ancho que el módulo necesita, para que el sobreancho quede visible.
  const anchoDefinido = ancho > 0;
  const escalaAncho   = Math.max(anchoDefinido ? ancho : 0, anchoMinimo);
  const pct           = (m: number) => (escalaAncho > 0 ? (m / escalaAncho) * 100 : 0);
  const holgura       = anchoDefinido ? ancho - anchoMinimo : 0;
  const pasoReal      = ancho > 0 && ancho > profTotal ? (ancho - profTotal) / 2 : pasoMinimo;
  const pasoGraf      = anchoDefinido && anchoMinimo > ancho ? pasoMinimo : pasoReal;
  const encaje: "ok" | "no" | "pendiente" =
    !anchoDefinido || slotsInvalidos ? "pendiente" : profExcedida ? "no" : "ok";

  const fmtM = (n: number) => n.toFixed(2).replace(".", ",");
  const descPasos = `${fmtM(pasoReal)} m de paso real a cada lado`;
  const segmentos: { k: string; cls: string; m: number; label: string }[] = [
    ...(pasoGraf > 0 ? [{ k: "pi", cls: "is-paso", m: pasoGraf, label: "paso" }] : []),
    ...(form.slotIzq > 0 ? [{ k: "si", cls: "is-slot", m: form.slotIzq, label: "slot" }] : []),
    { k: "cu", cls: "is-cuerpo", m: CUERPO_PROF, label: "nidal" },
    ...(form.slotDer > 0 ? [{ k: "sd", cls: "is-slot", m: form.slotDer, label: "slot" }] : []),
    ...(pasoGraf > 0 ? [{ k: "pd", cls: "is-paso", m: pasoGraf, label: "paso" }] : []),
  ];

  const formListo =
    ancho > 0 && largo > 0 && altura > 0 && !slotsInvalidos && !profExcedida;

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function construirRequest(overrides: Partial<EstudioRequest> = {}): EstudioRequest {
    return {
      tipo_zona: zona!,
      sistema: form.sistema,
      ancho_nave_m: ancho,
      largo_nave_m: largo,
      altura_nave_cm: altura,
      sup_parque_m2: form.parque ? parseFloat(form.parque) : 0,
      sup_pasto_m2: form.pasto !== "" ? parseFloat(form.pasto) : undefined,
      equipamiento,
      slot_izq_m: form.slotIzq,
      slot_der_m: form.slotDer,
      paso_izq_m: pasoIzqM,
      paso_der_m: pasoDerM,
      niveles: !esNidal && form.niveles !== "auto" ? parseInt(form.niveles) : null,
      ...overrides,
    };
  }

  function configPlano(r: EstudioResponse) {
    return {
      ancho_nave_m: r.ancho_nave_m,
      largo_nave_m: r.largo_nave_m,
      tipo_zona: r.tipo_zona,
      sistema: r.sistema,
      num_filas: r.tipo_zona === "aviario" ? r.num_filas : 0,
      mods_por_fila: r.tipo_zona === "aviario" ? r.mods_por_fila : r.num_modulos,
      clearance_pared_m: 0,
      clearance_fondo_m: 3,
      equipamiento,
      sup_pasto_m2: form.pasto !== "" ? Number(form.pasto) : undefined,
      paso_izq_m: r.paso_izq_m,
      paso_der_m: r.paso_der_m,
      pasillo_m: 1.0,
      clearance_lateral_m: 4,
      gallinas: r.gallinas_max,
      niveles: r.niveles || 2,
      ancho_alero_m: r.sup_parque_m2 > 0 && r.largo_nave_m > 0
        ? r.sup_parque_m2 / r.largo_nave_m
        : 0,
      slot_izq_m: r.slot_izq_m,
      slot_der_m: r.slot_der_m,
      nombre_cliente: "Estudio de nave — uso interno",
    };
  }

  async function cargarPlano(r: EstudioResponse) {
    if (!r.viable || r.num_modulos === 0) { setSvg(""); return; }
    try {
      const body = configPlano(r);
      const resp = await fetch("/api/plano-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json();
      setSvg(json.svg ?? "");
    } catch {
      setSvg("");
    }
  }

  async function descargarDxf() {
    if (!res || !res.viable || res.tipo_zona !== "nidal_colectivo" || descargandoDxf) return;
    setDescargandoDxf(true);
    setError(null);
    try {
      const respuesta = await fetch("/api/plano-nidal-dxf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configPlano(res)),
      });
      if (!respuesta.ok) {
        const detalle = await respuesta.json().catch(() => null);
        throw new Error(detalle?.detail ?? "No se pudo generar el DXF del nidal.");
      }
      const blob = await respuesta.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = `nidal_centrado_${res.largo_nave_m.toFixed(2)}x${res.ancho_nave_m.toFixed(2)}m.dxf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo descargar el DXF.");
    } finally {
      setDescargandoDxf(false);
    }
  }

  async function calcular(overrides: Partial<EstudioRequest> = {}) {
    setCarga(true);
    setError(null);
    setPaso("estudio");
    try {
      const r = await pedirEstudio(construirRequest(overrides));
      setRes(r);
      await cargarPlano(r);
    } catch {
      setRes(null);
      setError("No se pudo conectar con el servidor de cálculo. Inténtalo de nuevo.");
    }
    setCarga(false);
  }

  function reiniciar() {
    setZona(null); setForm(FORM_INICIAL); setRes(null); setSvg("");
    setError(null); setPaso("modulo");
  }

  const pasoIdx = paso === "modulo" ? 0 : paso === "nave" ? 1 : 2;

  return (
    <>
      <style>{ESTUDIO_CSS}</style>

      <header className="est-top">
        <div className="est-top-inner">
          <img src="/gyc-logo.png" alt="Gómez y Crespo" className="est-logo" />
          <span className="est-top-tag">Uso interno</span>
          <span className="est-top-title">Estudio de nave</span>
        </div>
      </header>

      <nav className="est-steps" aria-label="Progreso del estudio">
        {["Módulo", "Nave", "Estudio"].map((label, i) => {
          const clicable = i < pasoIdx;
          const cls = i < pasoIdx ? "is-done is-link" : i === pasoIdx ? "is-active" : "";
          return (
            <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
              {i > 0 && <span className="est-step-sep">/</span>}
              <button
                className={`est-step ${cls}`}
                disabled={!clicable}
                onClick={() => clicable && setPaso(i === 0 ? "modulo" : "nave")}
                aria-current={i === pasoIdx ? "step" : undefined}
              >
                <span className="est-step-num">{i + 1}</span>
                {label}
              </button>
            </span>
          );
        })}
      </nav>

      <main className="est-main">
        {/* ── Paso 1 — elección de módulo ── */}
        {paso === "modulo" && (
          <div className="est-anim">
            <div className="est-eyebrow">Paso 1 de 3</div>
            <h1 className="est-h">¿Qué módulo quieres estudiar?</h1>
            <p className="est-sub">
              El estudio parte del producto ya elegido y calcula qué da de sí la nave:
              módulos, capacidad, densidad, yacija y cumplimiento normativo. Sin argumentario de venta.
            </p>
            <div className="est-mod-grid">
              <button className="est-mod-card" onClick={() => { setZona("aviario"); setPaso("nave"); }}>
                <span className="est-mod-icon">
                  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                    <rect x="4" y="5" width="22" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
                    <rect x="4" y="13" width="22" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
                    <rect x="4" y="21" width="22" height="6" rx="1" stroke="currentColor" strokeWidth="1.7" />
                  </svg>
                </span>
                <span className="est-mod-title">Aviario industrial</span>
                <span className="est-mod-desc">
                  Multinivel en altura. Maximiza capacidad por m² de nave; requiere altura libre.
                </span>
                <span className="est-mod-specs">
                  <span className="est-chip">1,20 × 3,30 m</span>
                  <span className="est-chip">144 gal/módulo</span>
                  <span className="est-chip">≥ 300 cm altura</span>
                </span>
              </button>

              <button className="est-mod-card" onClick={() => { setZona("nidal_colectivo"); setPaso("nave"); }}>
                <span className="est-mod-icon">
                  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
                    <rect x="3" y="5" width="24" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                    <rect x="3" y="12" width="24" height="6" rx="1" stroke="currentColor" strokeWidth="1.9" />
                    <rect x="3" y="20" width="24" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
                  </svg>
                </span>
                <span className="est-mod-title">Nidal colectivo A-Nida</span>
                <span className="est-mod-desc">
                  Cadena de módulos en una fila con slots laterales configurables. Sin requisito de altura.
                </span>
                <span className="est-mod-specs">
                  <span className="est-chip">cuerpo 1,20 × 1,40 m</span>
                  <span className="est-chip">144 gal/módulo</span>
                  <span className="est-chip">slot 0–3 m/lado</span>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 2 — datos de nave ── */}
        {paso === "nave" && (
          <div className="est-anim">
            <button className="est-back" onClick={() => setPaso("modulo")}>
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                <path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Cambiar módulo
            </button>
            <div className="est-eyebrow">
              Paso 2 de 3 · {esNidal ? "Nidal colectivo A-Nida" : "Aviario industrial"}
            </div>
            <h1 className="est-h">Dimensiones de la nave</h1>
            <p className="est-sub">
              Todo el cálculo parte de la geometría real: el ancho limita la profundidad del módulo
              y el largo limita cuántos módulos entran en la fila.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); calcular(); }}>
              <div className="est-form-grid">
                <div className="est-field">
                  <label className="est-label" htmlFor="e-sistema">Sistema de producción</label>
                  <select id="e-sistema" className="est-select" value={form.sistema}
                    onChange={(e) => set("sistema", e.target.value as Sistema)}>
                    {SISTEMAS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <span className="est-hint">
                    Define la densidad máxima legal ({form.sistema === "ecologico" ? "6" : "9"} gal/m²).
                  </span>
                </div>

                <div className="est-field">
                  <label className="est-label" htmlFor="e-ancho">Ancho de nave</label>
                  <div className="est-input-wrap">
                    <input id="e-ancho" type="number" className="est-input est-input--unit"
                      min={1} step="0.1" placeholder="12" value={form.ancho}
                      onChange={(e) => set("ancho", e.target.value)} required />
                    <span className="est-unit">m</span>
                  </div>
                </div>

                <div className="est-field">
                  <label className="est-label" htmlFor="e-largo">Largo de nave</label>
                  <div className="est-input-wrap">
                    <input id="e-largo" type="number" className="est-input est-input--unit"
                      min={1} step="0.1" placeholder="60" value={form.largo}
                      onChange={(e) => set("largo", e.target.value)} required />
                    <span className="est-unit">m</span>
                  </div>
                </div>

                <div className="est-field">
                  <label className="est-label" htmlFor="e-altura">Altura libre</label>
                  <div className="est-input-wrap">
                    <input id="e-altura" type="number" className="est-input est-input--unit"
                      min={50} step="1" placeholder={esNidal ? "280" : "400"} value={form.altura}
                      onChange={(e) => set("altura", e.target.value)} required />
                    <span className="est-unit">cm</span>
                  </div>
                  {!esNidal && (
                    <span className="est-hint">≥ 300 cm para 2 niveles · ≥ 400 cm para 3 niveles.</span>
                  )}
                </div>

                <div className="est-field">
                  <label className="est-label" htmlFor="e-parque">Parque de invierno</label>
                  <div className="est-input-wrap">
                    <input id="e-parque" type="number" className="est-input est-input--unit"
                      min={0} step="1" placeholder="0" value={form.parque}
                      onChange={(e) => set("parque", e.target.value)} />
                    <span className="est-unit">m²</span>
                  </div>
                  <span className="est-hint">Alero o patio cubierto anexo. No aumenta el aforo sin validación técnica de su uso.</span>
                </div>

                {(form.sistema === "campero" || form.sistema === "ecologico") && (
                  <div className="est-field">
                    <label className="est-label" htmlFor="e-pasto">Zona de pasto</label>
                    <div className="est-input-wrap">
                      <input id="e-pasto" type="number" className="est-input est-input--unit"
                        min={0} step="1" placeholder="0" value={form.pasto}
                        onChange={(e) => set("pasto", e.target.value)} />
                      <span className="est-unit">m²</span>
                    </div>
                    <span className="est-hint">Limita el aforo campero a 1 gallina por cada 4 m² disponibles. Vacío = pendiente de medir.</span>
                  </div>
                )}

                {!esNidal && (
                  <div className="est-field">
                    <label className="est-label" htmlFor="e-niveles">Niveles del aviario</label>
                    <select id="e-niveles" className="est-select" value={form.niveles}
                      onChange={(e) => set("niveles", e.target.value as FormState["niveles"])}>
                      <option value="auto">Máximo que permita la altura</option>
                      <option value="2">2 niveles</option>
                      <option value="3">3 niveles</option>
                    </select>
                  </div>
                )}
              </div>

              {superficie > 0 && (
                <p className="est-hint" style={{ marginTop: "0.4rem" }}>
                  Superficie de nave: <strong>{superficie.toLocaleString("es-ES", { maximumFractionDigits: 1 })} m²</strong>
                </p>
              )}

              <div className="est-panel">
                  <div className="est-panel-title">Equipamiento instalado o previsto</div>
                  <p className="est-hint">Introduce cantidades útiles y accesibles totales de la nave. Vacío significa pendiente de medir; cero significa que no existe.</p>
                  <div className="est-form-grid">
                    {([
                      ["perchas_m", "Perchas útiles (m)"],
                      ["nidal_util_m2", "Interior útil de nidales (m²)"],
                      ["comedero_lineal_accesible_m", "Comedero lineal accesible (m)"],
                      ["bebederos_pezon_copa", "Bebederos de pezón o copa (unidades)"],
                      ...(form.sistema === "campero" ? [["salidas_ancho_util_m", "Anchura útil total de salidas (m)"]] : []),
                    ]).map(([key, label]) => (
                      <div className="est-field" key={key}>
                        <label className="est-label" htmlFor={`med-${key}`}>{label}</label>
                        <input id={`med-${key}`} className="est-input" type="number" min={0}
                          step={key === "bebederos_pezon_copa" ? "1" : "any"}
                          placeholder="Sin medir" value={mediciones[key] ?? ""}
                          onChange={(e) => setMediciones((v) => ({ ...v, [key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
              </div>

              {/* ── Configuración de slots (solo nidal) ── */}
              {esNidal && (
                <div className="est-panel">
                  <div className="est-panel-title">Configuración de slots</div>

                  <div className="est-slot-grid">
                    {([
                      { lado: "izq", titulo: "Lado izquierdo", slot: form.slotIzq, kSlot: "slotIzq",
                        paso: form.pasoIzq, kPaso: "pasoIzq" },
                      { lado: "der", titulo: "Lado derecho", slot: form.slotDer, kSlot: "slotDer",
                        paso: form.pasoDer, kPaso: "pasoDer" },
                    ] as const).map((c) => (
                      <div key={c.lado} className="est-side">
                        <div className="est-side-title">{c.titulo}</div>

                        <div className="est-field">
                          <span className="est-label">Profundidad del slot</span>
                          <div className="est-seg" role="group" aria-label={`Profundidad del slot ${c.lado === "izq" ? "izquierdo" : "derecho"}`}>
                            {SLOTS.map((s) => (
                              <button key={s} type="button"
                                className={`est-seg-btn${c.slot === s ? " is-on" : ""}`}
                                onClick={() => set(c.kSlot, s)}>
                                {s === 0 ? "Sin slot" : `${s} m`}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="est-field est-side-paso">
                          <label className="est-label" htmlFor={`e-paso-${c.lado}`}>Paso mínimo de manejo</label>
                          <div className="est-paso-row">
                            <div className="est-input-wrap">
                              <input id={`e-paso-${c.lado}`} type="number"
                                className="est-input est-input--unit"
                                min={0} step="0.1" placeholder="1"
                                value={c.paso}
                                onChange={(e) => set(c.kPaso, e.target.value)} />
                              <span className="est-unit">m</span>
                            </div>
                          </div>
                          <span className="est-hint">El conjunto queda centrado y aplica el mayor de los dos mínimos a ambos lados.</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={`est-fit is-${encaje}`}>
                    <div className="est-fit-head" role="status">
                      <span className="est-fit-mark" aria-hidden="true">
                        {encaje === "ok" ? (
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" strokeWidth="2.2"
                              strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : encaje === "no" ? (
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.2"
                              strokeLinecap="round" />
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                            <path d="M4 8h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>

                      <div className="est-fit-copy">
                        <strong className="est-fit-title">
                          {encaje === "ok" && "El nidal entra en el ancho"}
                          {encaje === "no" && "El nidal no entra en el ancho"}
                          {encaje === "pendiente" && (slotsInvalidos
                            ? "Hace falta slot en al menos un lado"
                            : "Indica el ancho de nave")}
                        </strong>
                        <span className="est-fit-sub">
                          {encaje === "ok" && (
                            holgura < 0.005
                              ? `Encaje exacto con ${descPasos}`
                              : `Sobran ${fmtM(holgura)} m dejando ${descPasos}`
                          )}
                          {encaje === "no" && (profTotal > ancho
                            ? `El módulo por sí solo excede el ancho de nave en ${fmtM(profTotal - ancho)} m`
                            : `Faltan ${fmtM(anchoMinimo - ancho)} m — configuración actual: ${descPasos}`)}
                          {encaje === "pendiente" && !slotsInvalidos &&
                            `Con esta configuración el módulo necesita ${fmtM(anchoMinimo)} m de ancho`}
                        </span>
                      </div>

                      <div className="est-fit-nums" aria-hidden="true">
                        <div className="est-fit-ratio">
                          <span className="est-fit-need">{fmtM(anchoMinimo)}</span>
                          <span className="est-fit-slash">/</span>
                          <span className="est-fit-have">{anchoDefinido ? fmtM(ancho) : "—"}</span>
                        </div>
                        <span className="est-fit-cap">necesario / disponible (m)</span>
                      </div>
                    </div>

                    <div className="est-fit-bar" aria-hidden="true">
                      {segmentos.map((s) => (
                        <div key={s.k} className={`est-fit-seg ${s.cls}`}
                          style={{ width: `${pct(s.m)}%` }}
                          title={`${s.label} ${fmtM(s.m)} m`}>
                          <span className="est-fit-seg-in">
                            {pct(s.m) >= 7 && <em className="est-fit-seg-name">{s.label}</em>}
                            <b className="est-fit-seg-val">{fmtM(s.m)}</b>
                          </span>
                        </div>
                      ))}
                      {encaje === "no" && (
                        <div className="est-fit-over" style={{ left: `${pct(ancho)}%` }}>
                          {/* Si la franja sobrante es estrecha, la etiqueta se saca a la izquierda */}
                          <span className={`est-fit-over-tag${pct(ancho) > 72 ? " is-outside" : ""}`}>
                            fuera de la nave
                          </span>
                        </div>
                      )}
                    </div>

                    {anchoDefinido && (
                      <div className="est-fit-axis" aria-hidden="true">
                        <div className="est-fit-axis-span" style={{ width: `${pct(ancho)}%` }}>
                          <span className="est-fit-axis-label">ancho de nave {fmtM(ancho)} m</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="est-actions">
                <button type="submit" className="est-btn est-btn--primary" disabled={!formListo}>
                  Calcular estudio
                  <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
                    <path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button type="button" className="est-btn est-btn--ghost" onClick={reiniciar}>
                  Empezar de nuevo
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Paso 3 — ficha del estudio ── */}
        {paso === "estudio" && (
          <div className="est-anim">
            {cargando && (
              <div className="est-loading" role="status" aria-live="polite">
                <div className="est-dots"><span /><span /><span /></div>
                <p className="est-hint">Calculando capacidad y verificaciones…</p>
              </div>
            )}

            {!cargando && error && <div className="est-err">{error}</div>}

            {!cargando && res && (
              <>
                <button className="est-back" onClick={() => setPaso("nave")}>
                  <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                    <path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Ajustar parámetros
                </button>

                <div className="est-print-head">
                  <img src="/gyc-logo.png" alt="Gómez y Crespo" className="est-print-logo" />
                  <div className="est-print-meta">
                    <strong>Estudio de nave</strong>
                    {res.ancho_nave_m} × {res.largo_nave_m} m · {res.superficie_nave_m2.toLocaleString("es-ES")} m²<br />
                    {res.tipo_zona === "aviario" ? "Aviario industrial" : "Nidal colectivo A-Nida"} · {res.sistema}<br />
                    {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })} · Documento interno
                  </div>
                </div>

                <div className="est-badge-row">
                  <span className="est-badge">
                    {res.tipo_zona === "aviario" ? "Aviario industrial" : "Nidal A-Nida"}
                  </span>
                  <span className="est-badge">{res.sistema}</span>
                  <span className="est-badge">
                    {res.ancho_nave_m} × {res.largo_nave_m} m · {res.superficie_nave_m2.toLocaleString("es-ES")} m²
                  </span>
                  <span className="est-badge">{res.altura_nave_cm} cm de altura</span>
                  {res.tipo_zona === "aviario"
                    ? <span className="est-badge">{res.niveles} niveles</span>
                    : <>
                        <span className="est-badge">slots {res.slot_izq_m} + {res.slot_der_m} m</span>
                        <span className="est-badge">
                          paso real {fmtM(res.geometria_nidal?.paso_lateral_m ?? pasoReal)} m a cada lado
                        </span>
                        {res.holgura_m > 0 && (
                          <span className="est-badge">holgura {res.holgura_m} m</span>
                        )}
                      </>}
                </div>

                <h1 className="est-h">Estudio de la nave</h1>
                <p className="est-sub">{res.descripcion_layout || "Sin distribución viable"}</p>

                <div className={`est-verdict${res.viable ? " is-ok" : " is-no"}`}>
                  <span aria-hidden="true">{res.viable ? "✓" : "✕"}</span>
                  <span>
                    {res.viable ? (
                      <>
                        <strong>Configuración conforme.</strong>{" "}
                        La nave admite {res.gallinas_max.toLocaleString("es-ES")} gallinas con{" "}
                        {res.num_modulos} módulos cumpliendo densidad y yacija.
                        {res.limitante === "densidad" && " El límite lo marca la densidad legal, no los módulos."}
                        {res.limitante === "capacidad_modulos" && " El límite lo marcan los módulos que caben, no la densidad."}
                        {res.limitante === "limite_ecologico" && " El límite lo marca el tope de 3.000 gallinas por gallinero ecológico."}
                      </>
                    ) : (
                      <>
                        <strong>Configuración no viable.</strong> {res.motivo}
                      </>
                    )}
                  </span>
                </div>

                {res.viable && (
                  <div className="est-kpis">
                    <div className="est-kpi">
                      <div className="est-kpi-val">
                        {res.gallinas_max.toLocaleString("es-ES")}<span className="est-kpi-unit">aves</span>
                      </div>
                      <div className="est-kpi-lbl">Capacidad estimada</div>
                    </div>
                    <div className="est-kpi">
                      <div className="est-kpi-val">
                        {res.num_modulos}<span className="est-kpi-unit">módulos</span>
                      </div>
                      <div className="est-kpi-lbl">Módulos instalados</div>
                      <div className="est-kpi-sub">
                        {res.max_modulos_fisicos > 0 && `${res.max_modulos_fisicos} caben físicamente`}
                      </div>
                    </div>
                    <div className="est-kpi">
                      <div className="est-kpi-val">
                        {res.densidad_real.toFixed(1)}
                        <span className="est-kpi-unit">/ {res.densidad_max.toFixed(0)} gal/m²</span>
                      </div>
                      <div className="est-kpi-lbl">Densidad</div>
                      <div className="est-bar">
                        <div
                          className={`est-bar-fill${res.densidad_real >= res.densidad_max ? " is-full" : ""}`}
                          style={{ width: `${Math.min(100, (res.densidad_real / res.densidad_max) * 100)}%` }}
                        />
                      </div>
                      <div className="est-kpi-sub">
                        sobre {res.sup_disponible_m2.toLocaleString("es-ES", { maximumFractionDigits: 0 })} m² útiles
                      </div>
                    </div>
                    <div className="est-kpi">
                      <div className="est-kpi-val">
                        {res.sup_yacija_m2.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                        <span className="est-kpi-unit">m²</span>
                      </div>
                      <div className="est-kpi-lbl">Yacija disponible</div>
                      <div className="est-kpi-sub">
                        mínimo {res.yacija_min_m2.toLocaleString("es-ES", { maximumFractionDigits: 0 })} m² · {res.yacija_pct}% de la superficie
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Verificaciones ── */}
                {res.verificaciones.length > 0 && (
                  <section className="est-block">
                    <h2 className="est-block-h">
                      Verificación normativa
                      <span>{res.verificaciones.filter((v) => v.cumple).length} de {res.verificaciones.length} cumplen</span>
                    </h2>
                    <div className="est-table-wrap">
                      <table className="est-table">
                        <thead>
                          <tr>
                            <th>Parámetro</th>
                            <th>Valor</th>
                            <th>Límite</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {res.verificaciones.map((v) => (
                            <tr key={v.parametro}>
                              <td>
                                <div className="est-param">{v.parametro}</div>
                                {v.detalle && <div className="est-detalle">{v.detalle}</div>}
                                <div className="est-art">{v.articulo}</div>
                              </td>
                              <td className="num">
                                {v.valor_real.toLocaleString("es-ES", { maximumFractionDigits: 2 })} {v.unidad}
                              </td>
                              <td className="num">
                                {v.tipo_limite === "maximo" ? "≤ " : "≥ "}
                                {v.valor_limite.toLocaleString("es-ES", { maximumFractionDigits: 2 })} {v.unidad}
                              </td>
                              <td>
                                <span className={`est-tag${v.cumple ? " is-ok" : " is-no"}`}>
                                  {v.cumple ? "Cumple" : "No cumple"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* ── Escenarios ── */}
                {res.escenarios.length > 1 && (
                  <section className="est-block">
                    <h2 className="est-block-h">
                      Comparativa de escenarios
                      <span>pulsa una fila para recalcular el estudio con esa configuración</span>
                    </h2>
                    <div className={`est-table-wrap${res.escenarios.length > 12 ? " is-tall" : ""}`}>
                      <table className="est-table">
                        <thead>
                          <tr>
                            <th>{res.tipo_zona === "aviario" ? "Filas" : "Módulos"}</th>
                            {res.tipo_zona === "aviario" && <th>Módulos</th>}
                            <th>Gallinas</th>
                            <th>Densidad</th>
                            <th>Yacija</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {res.escenarios.map((e) => {
                            const sel = res.tipo_zona === "aviario"
                              ? e.num_filas === res.num_filas
                              : e.num_modulos === res.num_modulos;
                            return (
                              <tr key={`${e.num_filas}-${e.num_modulos}`}
                                className={`est-row-btn${sel ? " est-row-sel" : ""}`}
                                onClick={() => calcular(res.tipo_zona === "aviario"
                                  ? { num_filas: e.num_filas }
                                  : { num_modulos: e.num_modulos })}>
                                <td className="num est-param">
                                  {res.tipo_zona === "aviario" ? e.num_filas : e.num_modulos}
                                  {e.es_optimo && <span className="est-tag is-ok" style={{ marginLeft: 8 }}>Óptimo</span>}
                                  {sel && !e.es_optimo && <span className="est-tag is-warn" style={{ marginLeft: 8 }}>Actual</span>}
                                </td>
                                {res.tipo_zona === "aviario" && <td className="num">{e.num_modulos}</td>}
                                <td className="num">{e.gallinas.toLocaleString("es-ES")}</td>
                                <td className="num">{e.densidad.toFixed(1)} gal/m²</td>
                                <td className="num">
                                  {e.sup_yacija_m2.toLocaleString("es-ES", { maximumFractionDigits: 0 })} m² ({e.yacija_pct}%)
                                </td>
                                <td>
                                  <span className={`est-tag${e.cumple ? " is-ok" : " is-no"}`}>
                                    {e.cumple ? "Conforme" : "Yacija insuficiente"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* ── Plano ── */}
                {svg && (
                  <section className="est-block">
                    <h2 className="est-block-h">
                      Distribución en planta
                      <span>{res.descripcion_layout}</span>
                    </h2>
                    <div className="est-plano" dangerouslySetInnerHTML={{ __html: svg }} />
                  </section>
                )}

                {/* ── Requisitos de equipamiento ── */}
                {res.requisitos.length > 0 && (
                  <section className="est-block">
                    <h2 className="est-block-h">
                      Equipamiento mínimo
                      <span>para {res.gallinas_max.toLocaleString("es-ES")} gallinas</span>
                    </h2>
                    <div className="est-table-wrap">
                      <table className="est-table">
                        <thead>
                          <tr><th>Elemento</th><th>Mínimo</th><th>Cálculo</th><th>Referencia</th></tr>
                        </thead>
                        <tbody>
                          {res.requisitos.map((r) => (
                            <tr key={r.nombre}>
                              <td className="est-param">{r.nombre}</td>
                              <td className="num">
                                {r.valor_minimo.toLocaleString("es-ES", { maximumFractionDigits: 2 })} {r.unidad}
                              </td>
                              <td className="num">{r.formula}</td>
                              <td className="est-art">{r.articulo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* ── Notas ── */}
                {res.aforo && (
                  <div className="est-panel">
                    <div className="est-panel-title">Límites por medición</div>
                    <p className="est-hint">Factor limitante del cálculo: {res.limitante}. La capacidad también está limitada por los módulos instalados.</p>
                    <table><thead><tr><th>Criterio</th><th>Cálculo</th><th>Gallinas</th></tr></thead>
                      <tbody>{res.aforo.limites.map((l) => (
                        <tr key={l.criterio}><td>{l.criterio.replaceAll("_", " ")}</td><td>{l.formula}</td><td>{l.gallinas.toLocaleString("es-ES")}</td></tr>
                      ))}</tbody>
                    </table>
                    {res.aforo.pendientes.length > 0 && <p className="est-hint">Pendiente de medir: {res.aforo.pendientes.join(", ")}. El resultado es provisional.</p>}
                  </div>
                )}

                {res.notas.length > 0 && (
                  <section className="est-block">
                    <h2 className="est-block-h">Notas de cálculo</h2>
                    <ul className="est-notas">
                      {res.notas.map((n) => <li key={n}>{n}</li>)}
                    </ul>
                  </section>
                )}

                <div className="est-footer-bar">
                  <p className="est-footer-note">
                    Documento técnico de trabajo. Exporta el PDF para adjuntarlo a la propuesta
                    comercial del cliente.
                  </p>
                  <button className="est-btn est-btn--ghost" onClick={() => setPaso("nave")}>
                    Ajustar parámetros
                  </button>
                  <button className="est-btn est-btn--primary" onClick={() => window.print()}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                      <path d="M3.5 5V1.5h6V5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      <rect x="1.5" y="5" width="10" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.2" />
                      <path d="M3.5 8.5h6v3h-6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                    Exportar PDF
                  </button>
                  {res.tipo_zona === "nidal_colectivo" && (
                    <button className="est-btn est-btn--ghost" onClick={descargarDxf}
                      disabled={!res.viable || descargandoDxf}>
                      {descargandoDxf ? "Preparando DXF…" : "Descargar DXF"}
                    </button>
                  )}
                </div>
              </>
            )}

            {!cargando && !res && !error && (
              <div className="est-err">No hay resultados. Vuelve a introducir los datos de la nave.</div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
