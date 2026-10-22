"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, ArrowRight, Check, Download, Layers, Minus, Plus, Printer, Rows3, X } from "lucide-react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  pedirEstudio,
  obtenerFicha,
  type FichaTecnica,
  type EstudioResponse,
  type EstudioRequest,
  type EquipamientoMedido,
  type Sistema,
  type TipoZona,
} from "./actions";
import { ESTUDIO_CSS } from "./estudio-styles";
import Cabecera from "./Cabecera";

type Paso = "modulo" | "nave" | "estudio";
// Versión del estudio: la del cliente resume capacidad, cumplimiento, plano y
// equipamiento; la técnica añade límites, escenarios y parámetros de cálculo.
type Version = "cliente" | "tecnica";

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
  localDentro: boolean;
  libreFondo: string;
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
  localDentro: false,
  libreFondo: "",
  niveles: "auto",
};

const ICON_SM = 16;     // icono en línea con texto
const ICON_LG = 24;     // icono destacado
const ICON_STROKE = 1.75;

const PASO_PARED_DEF = 1.0;   // m — paso libre por defecto entre el slat y cada pared

// Nombres legibles de los criterios que devuelve el backend como `limitante`
const LIMITANTES: Record<string, string> = {
  densidad:                    "Densidad máxima",
  modulos_instalados:          "Capacidad de los módulos",
  capacidad_modulos:           "Capacidad de los módulos",
  perchas:                     "Metros de percha",
  nidales:                     "Superficie de nidal",
  comederos_lineales:          "Comedero lineal",
  bebederos:                   "Bebederos",
  yacija_por_ave:              "Yacija por ave",
  yacija_suelo:                "Yacija ≥ 1/3 del suelo",
  pasto:                       "Superficie de pasto",
  salidas:                     "Salidas / trampillas al exterior",
  tope_gallinas_por_gallinero: "Tope ecológico por compartimento",
  limite_ecologico:            "Tope ecológico por compartimento",
};

// Color de la etiqueta de origen en "Parámetros de cálculo"
const ORIGEN_TAG: Record<string, string> = {
  "Ficha técnica": "is-info",
  "Medido": "is-ok",
  "Pendiente de medir": "is-warn",
  "Datos de la nave": "is-neutral",
  "Normativa": "is-neutral",
};

function nombreLimitante(codigo: string): string {
  return codigo
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => LIMITANTES[c] ?? c.replaceAll("_", " "))
    .join(" + ");
}

interface FilaCumplimiento {
  nombre: string;
  detalle?: string;
  pie: string;
  valor: string;
  limite: string;
  cumple: boolean;
}

const num = (v: number) => v.toLocaleString("es-ES", { maximumFractionDigits: 2 });

// Tabla de cumplimiento: la técnica muestra todas las verificaciones; la del
// cliente se queda en yacija, densidad, módulos y el equipamiento de la instalación.
function filasCumplimiento(r: EstudioResponse, cliente: boolean): FilaCumplimiento[] {
  const verif = (cliente
    ? r.verificaciones.filter((v) => v.parametro === "Superficie de yacija" || v.parametro === "Densidad de alojamiento")
    : r.verificaciones
  ).map((v) => ({
    nombre: v.parametro,
    detalle: cliente ? undefined : v.detalle,
    pie: v.articulo,
    valor: `${num(v.valor_real)} ${v.unidad}`,
    limite: `${v.tipo_limite === "maximo" ? "≤ " : "≥ "}${num(v.valor_limite)} ${v.unidad}`,
    cumple: v.cumple,
  }));
  if (!cliente) return verif;
  const modulos: FilaCumplimiento[] = r.max_modulos_fisicos > 0 ? [{
    nombre: "Módulos instalados",
    pie: r.tipo_zona === "aviario" ? "Aviario industrial" : "Nidal colectivo A-Nida",
    valor: `${r.num_modulos} módulos`,
    limite: "",
    cumple: r.num_modulos <= r.max_modulos_fisicos,
  }] : [];
  const equipo = r.equipamiento.map((e) => ({
    nombre: e.nombre,
    pie: e.origen,
    valor: `${num(e.previsto)} ${e.unidad}`,
    limite: `≥ ${num(e.minimo)} ${e.unidad}`,
    cumple: e.cumple,
  }));
  return [...verif, ...modulos, ...equipo];
}

export default function EstudioPage() {
  const [paso, setPaso]       = useState<Paso>("modulo");
  const [zona, setZona]       = useState<TipoZona | null>(null);
  const [form, setForm]       = useState<FormState>(FORM_INICIAL);
  const [res, setRes]         = useState<EstudioResponse | null>(null);
  const [ficha, setFicha]     = useState<FichaTecnica | null>(null);
  const [svg, setSvg]         = useState<string>("");
  const [descargandoDxf, setDescargandoDxf] = useState(false);
  const [cargando, setCarga]  = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [version, setVersion] = useState<Version>("cliente");
  const esCliente = version === "cliente";
  const resultadoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    obtenerFicha().then((r) => { if (r.ok) setFicha(r.data.ficha); });
  }, []);

  // Motion del design system: scroll reveal sutil (opacity 0 → 1, y 12 px, 350 ms, power1.out).
  // Con prefers-reduced-motion no se anima y el contenido aparece en su estado final.
  useEffect(() => {
    const raiz = resultadoRef.current;
    if (!raiz || cargando) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      raiz.querySelectorAll<HTMLElement>(".est-kpis, .est-limit, .est-block, .est-panel, .est-footer-bar").forEach((el) => {
        gsap.from(el, {
          opacity: 0, y: 12, duration: 0.35, ease: "power1.out",
          scrollTrigger: { trigger: el, start: "top 90%", toggleActions: "play none none reverse" },
        });
      });
    });
    return () => mm.revert();
  }, [cargando]);
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

  const cuerpoProf = ficha?.nidal.fondo_cuerpo_m ?? 1.4;   // m — fondo del cuerpo A-Nida (ficha técnica)
  const profTotal = cuerpoProf + form.slotIzq + form.slotDer;
  // Paso libre mínimo en cada lado; la distribución mantiene el nidal centrado.
  const leerPaso = (v: string) => (v === "" ? PASO_PARED_DEF : Math.max(0, parseFloat(v) || 0));
  const pasoIzqM    = leerPaso(form.pasoIzq);
  const pasoDerM    = leerPaso(form.pasoDer);
  const pasoMinimo = Math.max(pasoIzqM, pasoDerM);
  const anchoMinimo = profTotal + 2 * pasoMinimo;
  const slotsInvalidos = esNidal && form.slotIzq + form.slotDer === 0;

  // Reparto a lo largo: [local técnico si va dentro] + módulos + libre al fondo (tensor incluido)
  const moduloLargo = ficha?.nidal.largo_modulo_m ?? 1.2;
  const localLargo  = ficha?.nidal.local_tecnico_m ?? 4;
  const tensorLargo = ficha?.nidal.tensor_m ?? 3;
  const libreFondoM = form.libreFondo === "" ? tensorLargo : Math.max(0, parseFloat(form.libreFondo) || 0);
  const libreCorto  = esNidal && libreFondoM < tensorLargo - 1e-6;
  const largoCadena = largo - (form.localDentro ? localLargo : 0) - libreFondoM;
  const modulosLargo = largo > 0 && largoCadena >= moduloLargo - 1e-9
    ? Math.floor(largoCadena / moduloLargo + 1e-9) : 0;
  const sobranteLargo = largo > 0 ? largoCadena - modulosLargo * moduloLargo : 0;
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
    { k: "cu", cls: "is-cuerpo", m: cuerpoProf, label: "nidal" },
    ...(form.slotDer > 0 ? [{ k: "sd", cls: "is-slot", m: form.slotDer, label: "slot" }] : []),
    ...(pasoGraf > 0 ? [{ k: "pd", cls: "is-paso", m: pasoGraf, label: "paso" }] : []),
  ];

  const formListo =
    ancho > 0 && largo > 0 && altura > 0 && !slotsInvalidos && !profExcedida && !libreCorto;

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
      local_dentro: esNidal && form.localDentro,
      libre_fondo_m: esNidal && form.libreFondo !== "" ? libreFondoM : null,
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
      local_dentro: r.local_dentro,
      libre_fondo_m: r.tipo_zona === "nidal_colectivo" ? r.libre_fondo_m : null,
      pasillo_m: 1.0,
      clearance_lateral_m: 4,
      gallinas: r.gallinas_max,
      niveles: r.niveles || 2,
      ancho_alero_m: r.sup_parque_m2 > 0 && r.largo_nave_m > 0
        ? r.sup_parque_m2 / r.largo_nave_m
        : 0,
      slot_izq_m: r.slot_izq_m,
      slot_der_m: r.slot_der_m,
      nombre_cliente: "Estudio de nave",
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

  // Recalcula el informe con otro número de módulos (filas en el aviario)
  // sin salir de la ficha: el resultado anterior sigue a la vista mientras tanto.
  async function elegirConfiguracion(valor: number) {
    if (!res || recalculando || valor === configActual) return;
    setRecalculando(true);
    setError(null);
    try {
      const r = await pedirEstudio(construirRequest(esAviarioRes ? { num_filas: valor } : { num_modulos: valor }));
      setRes(r);
      await cargarPlano(r);
    } catch {
      setError("No se pudo recalcular el estudio. Inténtalo de nuevo.");
    }
    setRecalculando(false);
  }

  function confirmarConfiguracion(input: HTMLInputElement) {
    const v = Math.round(Number(input.value));
    if (input.value === "" || !Number.isFinite(v)) { input.value = String(configActual || ""); return; }
    const n = Math.min(configMax, Math.max(configMin, v));
    input.value = String(n);
    elegirConfiguracion(n);
  }

  function reiniciar() {
    setZona(null); setForm(FORM_INICIAL); setRes(null); setSvg("");
    setError(null); setPaso("modulo");
  }

  const pasoIdx = paso === "modulo" ? 0 : paso === "nave" ? 1 : 2;

  // Se renderiza la versión pedida antes de abrir el diálogo de impresión
  function exportar(v: Version) {
    flushSync(() => setVersion(v));
    window.print();
  }

  const filas = res ? filasCumplimiento(res, esCliente) : [];
  const codigosLimitante = (res?.limitante ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const limitesOrdenados = [...(res?.aforo?.limites ?? [])].sort((a, b) => a.gallinas - b.gallinas);
  const limitesActivos = limitesOrdenados.filter((l) => codigosLimitante.includes(l.criterio));
  const siguienteLimite = limitesOrdenados.find((l) => res && l.gallinas > res.gallinas_max);

  // Capacidad como intervalo: el mínimo es la capacidad con la superficie de la
  // nave reducida en el margen de incertidumbre
  const conIntervalo = !!res && res.margen_incertidumbre_pct > 0 && res.gallinas_min > 0 && res.gallinas_min < res.gallinas_max;

  // Configuración del informe: módulos en el nidal, filas en el aviario
  const esAviarioRes = res?.tipo_zona === "aviario";
  const opcionesConfig = (res?.escenarios ?? []).map((e) => (esAviarioRes ? e.num_filas : e.num_modulos));
  const configMin = opcionesConfig.length ? Math.min(...opcionesConfig) : 0;
  const configMax = opcionesConfig.length ? Math.max(...opcionesConfig) : 0;
  const configActual = res ? (esAviarioRes ? res.num_filas : res.num_modulos) : 0;
  const escenarioOptimo = res?.escenarios.find((e) => e.es_optimo);
  const configOptima = escenarioOptimo ? (esAviarioRes ? escenarioOptimo.num_filas : escenarioOptimo.num_modulos) : null;

  return (
    <>
      <style>{ESTUDIO_CSS}</style>

      <Cabecera activa="estudio">
          <nav className="est-steps" aria-label="Progreso del estudio">
            {["Módulo", "Nave", "Estudio"].map((label, i) => {
              const clicable = i < pasoIdx;
              const cls = i < pasoIdx ? "is-done is-link" : i === pasoIdx ? "is-active" : "";
              return (
                <span key={label} className="est-step-item">
                  {i > 0 && <span className="est-step-sep" aria-hidden="true" />}
                  <button
                    className={`est-step ${cls}`}
                    disabled={!clicable}
                    onClick={() => clicable && setPaso(i === 0 ? "modulo" : "nave")}
                    aria-current={i === pasoIdx ? "step" : undefined}
                  >
                    <span className="est-step-num">
                      {i < pasoIdx ? (
                        <Check size={12} strokeWidth={2.25} aria-hidden="true" />
                      ) : i + 1}
                    </span>
                    <span className="est-step-label">{label}</span>
                  </button>
                </span>
              );
            })}
          </nav>
      </Cabecera>

      <main className="est-main">
        {/* ── Paso 1 — elección de módulo ── */}
        {paso === "modulo" && (
          <div className="est-anim">
            <div className="est-eyebrow">Paso 1 de 3</div>
            <h1 className="est-h">¿Qué módulo quieres estudiar?</h1>
            <p className="est-sub">
              El estudio parte del producto ya elegido y calcula qué da de sí la nave:
              módulos, capacidad, densidad, yacija y cumplimiento normativo.
            </p>
            <div className="est-mod-grid">
              <button className="est-mod-card" onClick={() => { setZona("aviario"); setPaso("nave"); }}>
                <span className="est-mod-icon">
                  <Layers size={ICON_LG} strokeWidth={ICON_STROKE} aria-hidden="true" />
                </span>
                <span className="est-mod-title">Aviario industrial</span>
                <span className="est-mod-desc">
                  Multinivel en altura. Maximiza capacidad por m² de nave; requiere altura libre.
                </span>
                <span className="est-mod-specs">
                  {ficha && <>
                    <span className="est-chip">{fmtM(ficha.aviario.largo_modulo_m)} × {fmtM(ficha.aviario.fondo_modulo_m)} m</span>
                    <span className="est-chip">{ficha.aviario.capacidad_gallinas} gallinas/módulo</span>
                    <span className="est-chip">≥ {ficha.aviario.nivel_2.altura_min_cm} cm altura</span>
                  </>}
                </span>
              </button>

              <button className="est-mod-card" onClick={() => { setZona("nidal_colectivo"); setPaso("nave"); }}>
                <span className="est-mod-icon">
                  <Rows3 size={ICON_LG} strokeWidth={ICON_STROKE} aria-hidden="true" />
                </span>
                <span className="est-mod-title">Nidal colectivo A-Nida</span>
                <span className="est-mod-desc">
                  Cadena de módulos en una fila con slots laterales configurables. Sin requisito de altura.
                </span>
                <span className="est-mod-specs">
                  {ficha && <>
                    <span className="est-chip">cuerpo {fmtM(ficha.nidal.largo_modulo_m)} × {fmtM(ficha.nidal.fondo_cuerpo_m)} m</span>
                    <span className="est-chip">{ficha.nidal.capacidad_gallinas} gallinas/módulo</span>
                  </>}
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
              <ArrowLeft size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
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
                    Define la densidad máxima legal ({form.sistema === "ecologico" ? "6" : "9"} gallinas/m²).
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
                  <p className="est-hint">
                    {esNidal
                      ? "Cada módulo A-Nida integra perchas, comedero, bebederos y nidal dimensionados para su capacidad. Rellena solo si la instalación real difiere; cero significa que no existe."
                      : "Introduce cantidades útiles y accesibles totales de la nave. Vacío significa pendiente de medir; cero significa que no existe."}
                  </p>
                  <div className="est-form-grid">
                    {([
                      ["perchas_m", "Perchas útiles (m)"],
                      ["nidal_util_m2", "Interior útil de nidales (m²)"],
                      ["comedero_lineal_accesible_m", "Comedero lineal accesible (m)"],
                      ["bebederos_pezon_copa", "Bebederos de pezón o copa (unidades)"],
                      ...(form.sistema === "campero" ? [["salidas_ancho_util_m", "Anchura útil total de salidas (m)"]]
                        : form.sistema === "ecologico" ? [["salidas_ancho_util_m", "Longitud total de trampillas al exterior (m)"]]
                        : []),
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
                          <Check size={ICON_SM} strokeWidth={2.25} />
                        ) : encaje === "no" ? (
                          <X size={ICON_SM} strokeWidth={2.25} />
                        ) : (
                          <Minus size={ICON_SM} strokeWidth={2.25} />
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

              {/* ── Distribución a lo largo (solo nidal) ── */}
              {esNidal && (
                <div className="est-panel">
                  <div className="est-panel-title">Distribución a lo largo</div>
                  <div className="est-form-grid">
                    <div className="est-field">
                      <span className="est-label">Local técnico (motor y mesa de recogida)</span>
                      <div className="est-seg" role="group" aria-label="Posición del local técnico">
                        {([[false, "Anexo exterior"], [true, "Dentro de la nave"]] as const).map(([v, label]) => (
                          <button key={label} type="button" aria-pressed={form.localDentro === v}
                            className={`est-seg-btn${form.localDentro === v ? " is-on" : ""}`}
                            onClick={() => set("localDentro", v)}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <span className="est-hint">
                        {form.localDentro
                          ? `Ocupa los primeros ${fmtM(localLargo)} m de la nave de pared a pared; ese suelo no cuenta para densidad ni yacija.`
                          : "Habitación adosada fuera de la nave: no resta largo."}
                      </span>
                    </div>
                    <div className="est-field">
                      <label className="est-label" htmlFor="e-libre-fondo">Espacio libre al fondo</label>
                      <div className="est-input-wrap">
                        <input id="e-libre-fondo" type="number" className="est-input est-input--unit"
                          min={tensorLargo} step="0.1" placeholder={fmtM(tensorLargo)}
                          value={form.libreFondo} onChange={(e) => set("libreFondo", e.target.value)} />
                        <span className="est-unit">m</span>
                      </div>
                      <span className="est-hint">
                        {libreCorto
                          ? `El tensor necesita al menos ${fmtM(tensorLargo)} m tras el último módulo.`
                          : `Desde el último módulo hasta la pared, tensor incluido (mínimo ${fmtM(tensorLargo)} m).`}
                      </span>
                    </div>
                  </div>
                  {largo > 0 && !libreCorto && (
                    <p className="est-hint">
                      {modulosLargo > 0
                        ? <>Caben <strong>{modulosLargo} módulos</strong>:{" "}
                            {form.localDentro && `${fmtM(localLargo)} m de local + `}
                            {modulosLargo} × {fmtM(moduloLargo)} m + {fmtM(libreFondoM + sobranteLargo)} m libres
                            = {fmtM(largo)} m.</>
                        : `No cabe ningún módulo en ${fmtM(largo)} m de largo con este reparto.`}
                    </p>
                  )}
                </div>
              )}

              <div className="est-actions">
                <button type="submit" className="est-btn est-btn--primary" disabled={!formListo}>
                  Calcular estudio
                  <ArrowRight size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
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
          <div className="est-anim" ref={resultadoRef}>
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
                  <ArrowLeft size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  Ajustar parámetros
                </button>

                <div className="est-version">
                  <div className="est-seg" role="group" aria-label="Versión del estudio">
                    {([["cliente", "Versión cliente"], ["tecnica", "Versión técnica"]] as const).map(([v, label]) => (
                      <button key={v} type="button" aria-pressed={version === v}
                        className={`est-seg-btn${version === v ? " is-on" : ""}`}
                        onClick={() => setVersion(v)}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <span className="est-hint">
                    {esCliente
                      ? "Resumen para adjuntar a la propuesta: capacidad, cumplimiento, plano y equipamiento."
                      : "Detalle de cálculo para uso interno: límites, escenarios y parámetros."}
                  </span>
                </div>

                <div className="est-print-head">
                  <img src="/gyc-logo-recortado.png" alt="Gómez y Crespo"
                    className={`est-print-logo${esCliente ? " est-print-logo--cliente" : ""}`} />
                  <div className="est-print-meta">
                    <strong>Estudio de nave</strong>
                    {res.ancho_nave_m} × {res.largo_nave_m} m · {res.superficie_nave_m2.toLocaleString("es-ES")} m²<br />
                    {res.tipo_zona === "aviario" ? "Aviario industrial" : "Nidal colectivo A-Nida"} · {SISTEMAS.find((s) => s.value === res.sistema)?.label ?? res.sistema}<br />
                    {new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" })}
                    {esCliente ? " · Estudio de capacidad" : " · Documento interno"}
                  </div>
                </div>

                <div className="est-badge-row">
                  <span className="est-badge">
                    {res.tipo_zona === "aviario" ? "Aviario industrial" : "Nidal A-Nida"}
                  </span>
                  <span className="est-badge">{SISTEMAS.find((s) => s.value === res.sistema)?.label ?? res.sistema}</span>
                  <span className="est-badge">
                    {res.ancho_nave_m} × {res.largo_nave_m} m · {res.superficie_nave_m2.toLocaleString("es-ES")} m²
                  </span>
                  <span className="est-badge">{res.altura_nave_cm} cm de altura</span>
                  {res.tipo_zona === "aviario"
                    ? <span className="est-badge">{res.niveles} niveles</span>
                    : !esCliente && <>
                        <span className="est-badge">slots {res.slot_izq_m} + {res.slot_der_m} m</span>
                        <span className="est-badge">
                          paso real {fmtM(res.geometria_nidal?.paso_lateral_m ?? pasoReal)} m a cada lado
                        </span>
                        {res.holgura_m > 0 && (
                          <span className="est-badge">holgura {res.holgura_m} m</span>
                        )}
                      </>}
                </div>

                <h1 className="est-h">{esCliente ? "Estudio de capacidad de la nave" : "Estudio de la nave"}</h1>
                <p className="est-sub">{res.descripcion_layout || "Sin distribución viable"}</p>

                {/* ── Módulos del informe (solo en pantalla) ── */}
                {opcionesConfig.length > 1 && (
                  <div className={`est-config est-solo-pantalla${recalculando ? " is-busy" : ""}`} aria-busy={recalculando}>
                    <div className="est-config-txt">
                      <label className="est-config-lbl" htmlFor="est-config-num">
                        {esAviarioRes ? "Filas del informe" : "Módulos del informe"}
                      </label>
                      <p className="est-hint">
                        {esAviarioRes
                          ? `De ${configMin} a ${configMax} filas de ${res.mods_por_fila} módulos.`
                          : `De ${configMin} a ${configMax} módulos, los que caben en la nave.`}
                        {" "}Estudio, plano y PDF se recalculan con el valor elegido.
                      </p>
                    </div>
                    <div className="est-stepper">
                      <button type="button" className="est-stepper-btn"
                        aria-label={esAviarioRes ? "Una fila menos" : "Un módulo menos"}
                        disabled={recalculando || configActual <= configMin}
                        onClick={() => elegirConfiguracion(configActual - 1)}>
                        <Minus size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                      </button>
                      <input id="est-config-num" key={configActual} type="number" inputMode="numeric"
                        className="est-input est-stepper-input" min={configMin} max={configMax}
                        defaultValue={configActual || ""} disabled={recalculando}
                        onBlur={(ev) => confirmarConfiguracion(ev.currentTarget)}
                        onKeyDown={(ev) => { if (ev.key === "Enter") ev.currentTarget.blur(); }} />
                      <button type="button" className="est-stepper-btn"
                        aria-label={esAviarioRes ? "Una fila más" : "Un módulo más"}
                        disabled={recalculando || configActual >= configMax}
                        onClick={() => elegirConfiguracion(Math.max(configMin, configActual + 1))}>
                        <Plus size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                      </button>
                    </div>
                    {escenarioOptimo && configOptima !== null && (configActual === configOptima
                      ? <span className="est-tag is-ok">Óptimo</span>
                      : <button type="button" className="est-config-opt" disabled={recalculando}
                          onClick={() => elegirConfiguracion(configOptima)}>
                          Volver al óptimo: {configOptima} {esAviarioRes ? "filas" : "módulos"} ·{" "}
                          {escenarioOptimo.gallinas.toLocaleString("es-ES")} aves
                        </button>)}
                  </div>
                )}

                {/* La versión cliente no lleva frase de veredicto: los indicadores lo resumen */}
                {!(res.viable && esCliente) && (
                <div className={`est-verdict${res.viable ? " is-ok" : " is-no"}`}>
                  {res.viable
                    ? <Check size={ICON_SM + 2} strokeWidth={2.25} aria-hidden="true" className="est-verdict-icon" />
                    : <X size={ICON_SM + 2} strokeWidth={2.25} aria-hidden="true" className="est-verdict-icon" />}
                  <span>
                    {res.viable ? (
                      <>
                        <strong>Configuración conforme.</strong>{" "}
                        La nave admite {conIntervalo
                          ? <>entre {res.gallinas_min.toLocaleString("es-ES")} y {res.gallinas_max.toLocaleString("es-ES")}</>
                          : res.gallinas_max.toLocaleString("es-ES")} gallinas con{" "}
                        {res.num_modulos} módulos cumpliendo densidad y yacija.
                        {res.limitante && <> Factor limitante: <strong>{nombreLimitante(res.limitante)}</strong>.</>}
                      </>
                    ) : (
                      <>
                        <strong>Configuración no viable.</strong> {res.motivo}
                      </>
                    )}
                  </span>
                </div>
                )}

                {res.viable && (
                  <div className="est-kpis">
                    <div className="est-kpi">
                      <div className={`est-kpi-val${conIntervalo ? " est-kpi-val--rango" : ""}`}>
                        {conIntervalo && <>{res.gallinas_min.toLocaleString("es-ES")}<span className="est-kpi-sep">–</span></>}
                        {res.gallinas_max.toLocaleString("es-ES")}<span className="est-kpi-unit">aves</span>
                      </div>
                      <div className="est-kpi-lbl">Capacidad estimada</div>
                    </div>
                    <div className="est-kpi">
                      <div className="est-kpi-val">
                        {res.num_modulos}<span className="est-kpi-unit">módulos</span>
                      </div>
                      <div className="est-kpi-lbl">Módulos instalados</div>
                    </div>
                    <div className="est-kpi">
                      <div className="est-kpi-val">
                        {res.densidad_real.toFixed(1)}
                        <span className="est-kpi-unit">/ {res.densidad_max.toFixed(0)} gallinas/m²</span>
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

                {!esCliente && res.viable && res.limitante && (
                  <div className="est-limit">
                    <div className="est-limit-main">
                      <div className="est-kpi-lbl">Factor limitante</div>
                      <div className="est-limit-name">{nombreLimitante(res.limitante)}</div>
                      {limitesActivos.map((l) => (
                        <div key={l.criterio} className="est-limit-calc">
                          {l.formula} = {l.gallinas.toLocaleString("es-ES")} gallinas
                          <span className="est-art"> · {l.fuente}</span>
                        </div>
                      ))}
                    </div>
                    {siguienteLimite && (
                      <div className="est-limit-next">
                        <div className="est-kpi-lbl">Siguiente límite</div>
                        <div className="est-limit-next-name">{nombreLimitante(siguienteLimite.criterio)}</div>
                        <div className="est-kpi-sub">
                          {siguienteLimite.gallinas.toLocaleString("es-ES")} gallinas
                          {" "}(+{(siguienteLimite.gallinas - res.gallinas_max).toLocaleString("es-ES")} si se resuelve el limitante)
                        </div>
                      </div>
                    )}
                    {res.aforo && res.aforo.pendientes.length > 0 && (
                      <p className="est-hint est-limit-pend">
                        Sin medir: {res.aforo.pendientes.map(nombreLimitante).join(", ")}.
                        Pueden resultar más restrictivos que el limitante actual.
                      </p>
                    )}
                  </div>
                )}

                {/* ── Verificaciones ── */}
                {filas.length > 0 && (
                  <section className="est-block">
                    <h2 className="est-block-h">
                      {esCliente ? "Cumplimiento normativo" : "Verificación normativa"}
                      <span>{filas.filter((f) => f.cumple).length} de {filas.length} cumplen</span>
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
                          {filas.map((f) => (
                            <tr key={f.nombre}>
                              <td>
                                <div className="est-param">{f.nombre}</div>
                                {f.detalle && <div className="est-detalle">{f.detalle}</div>}
                                <div className="est-art">{f.pie}</div>
                              </td>
                              <td className="num">{f.valor}</td>
                              <td className="num">{f.limite}</td>
                              <td>
                                <span className={`est-tag${f.cumple ? " is-ok" : " is-no"}`}>
                                  {f.cumple ? "Cumple" : "No cumple"}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* ── Escenarios (en el PDF técnico sale la tabla completa) ── */}
                {!esCliente && res.escenarios.length > 1 && (
                  <section className="est-block est-escenarios">
                    <h2 className="est-block-h">
                      Comparativa de escenarios
                      <span className="est-solo-pantalla">pulsa una fila para recalcular el estudio con esa configuración</span>
                      <span className="est-solo-papel">configuración del estudio resaltada</span>
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
                            <th>Limitante</th>
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
                                onClick={() => elegirConfiguracion(esAviarioRes ? e.num_filas : e.num_modulos)}>
                                <td className="num est-param">
                                  {res.tipo_zona === "aviario" ? e.num_filas : e.num_modulos}
                                  {e.es_optimo && <span className="est-tag is-ok" style={{ marginLeft: 8 }}>Óptimo</span>}
                                  {sel && !e.es_optimo && <span className="est-tag is-warn" style={{ marginLeft: 8 }}>Actual</span>}
                                </td>
                                {res.tipo_zona === "aviario" && <td className="num">{e.num_modulos}</td>}
                                <td className="num">{e.gallinas.toLocaleString("es-ES")}</td>
                                <td className="num">{e.densidad.toFixed(1)} gallinas/m²</td>
                                <td className="num">
                                  {e.sup_yacija_m2.toLocaleString("es-ES", { maximumFractionDigits: 0 })} m² ({e.yacija_pct}%)
                                </td>
                                <td>{nombreLimitante(e.limitante)}</td>
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

                {/* ── Condiciones del régimen ecológico (ambas versiones) ── */}
                {res.condiciones.length > 0 && (
                  <section className="est-block">
                    <h2 className="est-block-h">
                      Requisitos de la producción ecológica
                      <span>a cumplir en la explotación</span>
                    </h2>
                    <div className="est-table-wrap">
                      <table className="est-table">
                        <thead>
                          <tr><th>Requisito</th><th>Condición</th></tr>
                        </thead>
                        <tbody>
                          {res.condiciones.map((c) => (
                            <tr key={c.nombre}>
                              <td>
                                <div className="est-param">{c.nombre}</div>
                                <div className="est-art">{c.fuente}</div>
                              </td>
                              <td>{c.detalle}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                {/* ── Requisitos de equipamiento ── */}
                {!esCliente && res.requisitos.length > 0 && (
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

                {/* ── Límites por medición ── */}
                {!esCliente && res.aforo && (
                  <div className="est-panel">
                    <div className="est-panel-title">Límites por medición</div>
                    <p className="est-hint">Cada criterio fija un máximo de gallinas; la capacidad es el menor de todos.</p>
                    <div className="est-table-wrap">
                      <table className="est-table">
                        <thead><tr><th>Criterio</th><th>Cálculo</th><th>Gallinas</th><th></th></tr></thead>
                        <tbody>{limitesOrdenados.map((l) => (
                          <tr key={l.criterio} className={codigosLimitante.includes(l.criterio) ? "is-limit" : undefined}>
                            <td className="est-param">{nombreLimitante(l.criterio)}</td>
                            <td className="num">{l.formula}</td>
                            <td className="num">{l.gallinas.toLocaleString("es-ES")}</td>
                            <td>{codigosLimitante.includes(l.criterio) && <span className="est-tag is-warn">Limitante</span>}</td>
                          </tr>
                        ))}</tbody>
                      </table>
                    </div>
                    {res.aforo.pendientes.length > 0 && <p className="est-hint">Pendiente de medir: {res.aforo.pendientes.map(nombreLimitante).join(", ")}. El resultado es provisional.</p>}
                  </div>
                )}

                {!esCliente && res.parametros.length > 0 && (
                  <section className="est-block">
                    <h2 className="est-block-h">
                      Parámetros de cálculo
                      <span>valores aplicados y su origen<span className="est-solo-pantalla"> · <Link href="/ficha" className="est-link">editar ficha técnica</Link></span></span>
                    </h2>
                    <div className="est-table-wrap">
                      <table className="est-table">
                        <thead><tr><th>Grupo</th><th>Parámetro</th><th>Valor</th><th>Origen</th></tr></thead>
                        <tbody>
                          {res.parametros.map((p, i) => (
                            <tr key={`${p.grupo}-${p.nombre}`}>
                              <td className="est-art">{i === 0 || res.parametros[i - 1].grupo !== p.grupo ? p.grupo : ""}</td>
                              <td className="est-param">{p.nombre}</td>
                              <td className="num">{p.valor}</td>
                              <td><span className={`est-tag ${ORIGEN_TAG[p.origen] ?? ""}`}>{p.origen}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

                <div className="est-footer-bar">
                  <p className="est-footer-note">
                    La versión cliente es la que se adjunta a la propuesta comercial; la técnica
                    queda como documento interno de trabajo.
                  </p>
                  <button className="est-btn est-btn--ghost" onClick={() => setPaso("nave")}>
                    Ajustar parámetros
                  </button>
                  <button className="est-btn est-btn--ghost" onClick={() => exportar("tecnica")}>
                    <Printer size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    PDF técnico
                  </button>
                  <button className="est-btn est-btn--primary" onClick={() => exportar("cliente")}>
                    <Printer size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    PDF cliente
                  </button>
                  {res.tipo_zona === "nidal_colectivo" && (
                    <button className="est-btn est-btn--ghost" onClick={descargarDxf}
                      disabled={!res.viable || descargandoDxf}>
                      <Download size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
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
