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
  type Reparto,
  type EquipamientoMedido,
  type Sistema,
  type TipoZona,
} from "./actions";
import {
  ART, BACK, BLOCK, BLOCK_NOTE, BTN_GHOST, BTN_PRIMARY, DETALLE, ERR, EYEBROW, FIELD, FORM_GRID,
  H1, HINT, INPUT, INPUT_IN, INPUT_UNIT, LABEL, MAIN, PANEL, PANEL_BODY, PANEL_TITLE, PARAM, SEG, SEG_BTN,
  SIDE, SIDE_TITLE, SUB, TABLE, TAG, THEAD, UNIT,
} from "./clases";
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
  "Ficha técnica": "badge-primary",
  "Medido": "badge-success",
  "Pendiente de medir": "badge-warning",
  "Datos de la nave": "badge-neutral",
  "Normativa": "badge-neutral",
};

// Cifras de los indicadores (stat de daisyUI)
const KPI_TITLE = "stat-title font-display text-xs font-semibold uppercase tracking-wide text-base-content/70 print:text-[6pt]";
const KPI_VAL = "stat-value font-display font-semibold tracking-tight text-primary tabular-nums print:text-[16pt]";
const KPI_UNIT = "ml-1 font-sans text-[0.9rem] font-medium tracking-normal text-base-content/70 print:text-[7pt]";
// Documento: encabezado de sección numerado y tabla sin sombra dentro de la hoja
const DOC_H =
  "mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-base-300 pb-2 font-display text-xl " +
  "font-semibold tracking-tight text-primary break-after-avoid print:mb-2 print:pb-1 print:text-[12pt]";
const DOC_TABLE_WRAP = "overflow-x-auto rounded-field border border-base-300 print:overflow-visible";

function Seccion({ n, titulo, nota, className = "", children }: {
  n: string; titulo: string; nota?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <section data-reveal className={`${BLOCK} ${className}`}>
      <h2 className={DOC_H}>
        <span className="text-sm tabular-nums text-success print:text-[8pt]">{n}</span>
        {titulo}
        {nota && <span className={BLOCK_NOTE}>{nota}</span>}
      </h2>
      {children}
    </section>
  );
}

const KPI_DESC = "stat-desc mt-1 whitespace-normal text-[0.85rem] text-base-content/70 print:text-[7pt]";

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
// Cifra principal del informe: con punto de miles también en 4 cifras (3.000, no 3000)
const miles = (v: number) => new Intl.NumberFormat("es-ES", { useGrouping: "always" }).format(v);

interface DatosInforme {
  cliente: string;
  proyecto: string;
  ref: string;        // nº de estudio; vacío = referencia automática
  explotacion: string;
  autor: string;
}
const INFORME_VACIO: DatosInforme = { cliente: "", proyecto: "", ref: "", explotacion: "", autor: "" };

// Abre el diálogo de impresión con otro título: Chrome lo propone como nombre del PDF
function imprimirComo(titulo: string) {
  const anterior = document.title;
  document.title = titulo;
  window.print();
  document.title = anterior;
}

// Pie de página del PDF. Va en los márgenes de página (@bottom-*) y no en un
// elemento fixed: con hojas verticales y apaisadas mezcladas, Chrome coloca mal
// los fixed. El texto se inyecta aquí porque depende del cliente y la referencia.
const cssTexto = (s: string) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\s+/g, " ")}"`;
function piePagina(izquierda: string, derecha: string): string {
  const caja = "font-family: 'Work Sans', sans-serif; font-size: 7pt; color: #475569; vertical-align: top; padding-top: 3mm;";
  return `@media print { @page {
    @bottom-left { content: ${cssTexto(izquierda)}; ${caja} padding-left: 12mm; }
    @bottom-right { content: ${cssTexto(derecha)} " · Página " counter(page) " de " counter(pages); ${caja} padding-right: 12mm; }
  } }`;
}

// Referencia del informe a partir de la hora del cálculo: EN-AAMMDD-HHMM
function refInforme(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `EN-${dos(d.getFullYear() % 100)}${dos(d.getMonth() + 1)}${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}`;
}

// Tabla de cumplimiento: la técnica muestra todas las verificaciones; la del
// cliente se queda en yacija, densidad y el equipamiento de la instalación.
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
  // Sin el origen del dato ("Integrado en el módulo"): al cliente no le aporta
  const equipo = r.equipamiento.map((e) => ({
    nombre: e.nombre,
    pie: "",
    valor: `${num(e.previsto)} ${e.unidad}`,
    limite: `≥ ${num(e.minimo)} ${e.unidad}`,
    cumple: e.cumple,
  }));
  return [...verif, ...equipo];
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
  // Aviario: el informe se configura por nº total de módulos (como el nidal) o por filas completas
  const [reparto, setReparto] = useState<Reparto>("modulos");
  // Datos del informe: no afectan al cálculo, solo a la portada, el pie y el cajetín del plano
  const [informe, setInforme] = useState<DatosInforme>(INFORME_VACIO);
  const [emitido, setEmitido] = useState<Date | null>(null);
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
      raiz.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
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
      reparto: esNidal ? "filas" : reparto,
      ...overrides,
    };
  }

  function configPlano(r: EstudioResponse) {
    return {
      ancho_nave_m: r.ancho_nave_m,
      largo_nave_m: r.largo_nave_m,
      tipo_zona: r.tipo_zona,
      sistema: r.sistema,
      // Aviario: el total de módulos; el plano lo reparte en filas igual que el estudio
      // (con filas completas da las mismas filas), así no depende del modo elegido
      num_filas: 0,
      mods_por_fila: r.tipo_zona === "aviario" ? 0 : r.num_modulos,
      num_modulos: r.tipo_zona === "aviario" ? r.num_modulos : 0,
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
      nombre_cliente: informe.cliente.trim() || "Estudio de nave",
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
      setEmitido(new Date());
      await cargarPlano(r);
    } catch {
      setRes(null);
      setError("No se pudo conectar con el servidor de cálculo. Inténtalo de nuevo.");
    }
    setCarga(false);
  }

  // Recalcula el informe con otra configuración sin salir de la ficha: el
  // resultado anterior sigue a la vista mientras tanto.
  async function recalcular(overrides: Partial<EstudioRequest>) {
    if (!res || recalculando) return;
    setRecalculando(true);
    setError(null);
    try {
      const r = await pedirEstudio(construirRequest(overrides));
      setRes(r);
      await cargarPlano(r);
    } catch {
      setError("No se pudo recalcular el estudio. Inténtalo de nuevo.");
    }
    setRecalculando(false);
  }

  // Otro número de módulos (nidal o aviario por módulos) o de filas (aviario por filas)
  function elegirConfiguracion(valor: number) {
    if (valor === configActual) return;
    recalcular(porFilas ? { num_filas: valor } : { num_modulos: valor });
  }

  // Fila de la comparativa: siempre un total de módulos; en el aviario pasa a configurarse por módulos
  function elegirEscenario(modulos: number) {
    if (!res || modulos === res.num_modulos) return;
    if (esAviarioRes && reparto !== "modulos") setReparto("modulos");
    recalcular({ ...(esAviarioRes ? { reparto: "modulos" as const } : {}), num_modulos: modulos });
  }

  // Al cambiar de modo se conserva la instalación: los mismos módulos o las mismas filas
  function cambiarReparto(r: Reparto) {
    if (!res || r === reparto || recalculando) return;
    setReparto(r);
    recalcular(r === "modulos" ? { reparto: r, num_modulos: res.num_modulos } : { reparto: r, num_filas: res.num_filas });
  }

  function confirmarConfiguracion(input: HTMLInputElement) {
    const v = Math.round(Number(input.value));
    if (input.value === "" || !Number.isFinite(v)) { input.value = String(configActual || ""); return; }
    const n = Math.min(configMax, Math.max(configMin, v));
    input.value = String(n);
    elegirConfiguracion(n);
  }

  function reiniciar() {
    setZona(null); setForm(FORM_INICIAL); setRes(null); setSvg(""); setInforme(INFORME_VACIO); setReparto("modulos");
    setError(null); setPaso("modulo");
  }

  const pasoIdx = paso === "modulo" ? 0 : paso === "nave" ? 1 : 2;

  // Se renderiza la versión pedida antes de abrir el diálogo de impresión
  // El título del documento es el nombre que Chrome propone para el PDF
  function exportar(v: Version) {
    flushSync(() => setVersion(v));
    imprimirComo(["Estudio de capacidad", informe.cliente.trim(), informe.proyecto.trim(), referencia]
      .filter(Boolean).join(" - "));
  }

  const referenciaAuto = emitido ? refInforme(emitido) : "";
  const referencia = informe.ref.trim() || referenciaAuto;
  const fechaInforme = (emitido ?? new Date()).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const filas = res ? filasCumplimiento(res, esCliente) : [];
  // Numeración de las secciones del documento en el orden en que se pintan
  let nSec = 0;
  const sec = () => String(++nSec).padStart(2, "0");
  const codigosLimitante = (res?.limitante ?? "").split(",").map((c) => c.trim()).filter(Boolean);
  const limitesOrdenados = [...(res?.aforo?.limites ?? [])].sort((a, b) => a.gallinas - b.gallinas);
  const limitesActivos = limitesOrdenados.filter((l) => codigosLimitante.includes(l.criterio));
  const siguienteLimite = limitesOrdenados.find((l) => res && l.gallinas > res.gallinas_max);

  // Capacidad como intervalo: el mínimo es la capacidad con la superficie de la
  // nave reducida en el margen de incertidumbre
  const conIntervalo = !!res && res.margen_incertidumbre_pct > 0 && res.gallinas_min > 0 && res.gallinas_min < res.gallinas_max;

  // Configuración del informe: módulos en el nidal; filas o módulos en el aviario
  const esAviarioRes = res?.tipo_zona === "aviario";
  const porFilas = esAviarioRes && reparto === "filas";
  // Solo lo que cabe: los escenarios que no caben se enseñan en la comparativa pero no se eligen
  const opcionesConfig = (res?.escenarios ?? []).filter((e) => e.cabe).map((e) => (porFilas ? e.num_filas : e.num_modulos));
  const configMin = opcionesConfig.length ? Math.min(...opcionesConfig) : 0;
  const configMax = opcionesConfig.length ? Math.max(...opcionesConfig) : 0;
  const configActual = res ? (porFilas ? res.num_filas : res.num_modulos) : 0;
  const escenarioOptimo = res?.escenarios.find((e) => e.es_optimo);
  const configOptima = escenarioOptimo ? (porFilas ? escenarioOptimo.num_filas : escenarioOptimo.num_modulos) : null;
  // Aviario por módulos: lo que cabe en una fila (el mayor escenario de una sola fila)
  const modsFilaMax = Math.max(0, ...(res?.escenarios ?? []).filter((e) => e.cabe && e.num_filas === 1).map((e) => e.num_modulos));
  // Con más de 100 escenarios, el PDF técnico solo lleva filas completas, el óptimo, el elegido y los que no caben
  const resumirEscenarios = esAviarioRes && (res?.escenarios.length ?? 0) > 100;

  return (
    <>
      <Cabecera activa="estudio">
          <ul className="steps w-full font-display text-xs md:ml-auto md:w-auto" aria-label="Progreso del estudio">
            {["Módulo", "Nave", "Estudio"].map((label, i) => {
              const clicable = i < pasoIdx;
              return (
                <li key={label}
                  className={`step min-w-20 ${i <= pasoIdx ? "step-primary" : ""}`}
                  data-content={i < pasoIdx ? "✓" : String(i + 1)}>
                  <button
                    className={`min-h-6 px-1 ${clicable ? "cursor-pointer hover:text-secondary" : "cursor-default"} ${i === pasoIdx ? "font-semibold text-primary" : "text-base-content/70"}`}
                    disabled={!clicable}
                    onClick={() => clicable && setPaso(i === 0 ? "modulo" : "nave")}
                    aria-current={i === pasoIdx ? "step" : undefined}
                  >
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
      </Cabecera>

      <main className={MAIN}>
        {/* ── Paso 1 — elección de módulo ── */}
        {paso === "modulo" && (
          <div className="est-anim">
            <div className={EYEBROW}>Paso 1 de 3</div>
            <h1 className={H1}>¿Qué módulo quieres estudiar?</h1>
            <p className={SUB}>
              El estudio parte del producto ya elegido y calcula qué da de sí la nave:
              módulos, capacidad, densidad, yacija y cumplimiento normativo.
            </p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
              {([
                {
                  z: "aviario" as const, Icono: Layers, titulo: "Aviario industrial",
                  desc: "Multinivel en altura. Maximiza capacidad por m² de nave; requiere altura libre.",
                  chips: ficha ? [
                    `${fmtM(ficha.aviario.largo_modulo_m)} × ${fmtM(ficha.aviario.fondo_modulo_m)} m`,
                    `${ficha.aviario.capacidad_gallinas} gallinas/módulo`,
                    `≥ ${ficha.aviario.nivel_2.altura_min_cm} cm altura`,
                  ] : [],
                },
                {
                  z: "nidal_colectivo" as const, Icono: Rows3, titulo: "Nidal colectivo A-Nida",
                  desc: "Cadena de módulos en una fila con slots laterales configurables. Sin requisito de altura.",
                  chips: [
                    ...(ficha ? [
                      `cuerpo ${fmtM(ficha.nidal.largo_modulo_m)} × ${fmtM(ficha.nidal.fondo_cuerpo_m)} m`,
                      `${ficha.nidal.capacidad_gallinas} gallinas/módulo`,
                    ] : []),
                    "slot 0–3 m/lado",
                  ],
                },
              ]).map(({ z, Icono, titulo, desc, chips }, i) => (
                <button key={z}
                  className="card card-border est-anim cursor-pointer bg-base-100 text-left shadow-md transition duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-lg"
                  style={{ animationDelay: `${80 + i * 70}ms` }}
                  onClick={() => { setZona(z); setPaso("nave"); }}>
                  <span className="card-body gap-2">
                    <span className="mb-2 inline-flex size-12 items-center justify-center rounded-field bg-primary/10 text-primary">
                      <Icono size={ICON_LG} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    </span>
                    <span className="card-title font-display text-xl font-semibold">{titulo}</span>
                    <span className="text-[0.95rem] leading-relaxed text-base-content/70">{desc}</span>
                    <span className="mt-2 flex flex-wrap gap-2">
                      {chips.map((c) => (
                        <span key={c} className="badge badge-soft badge-primary">{c}</span>
                      ))}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Paso 2 — datos de nave ── */}
        {paso === "nave" && (
          <div className="est-anim">
            <button className={BACK} onClick={() => setPaso("modulo")}>
              <ArrowLeft size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
              Cambiar módulo
            </button>
            <div className={EYEBROW}>
              Paso 2 de 3 · {esNidal ? "Nidal colectivo A-Nida" : "Aviario industrial"}
            </div>
            <h1 className={H1}>Dimensiones de la nave</h1>
            <p className={SUB}>
              Todo el cálculo parte de la geometría real: el ancho limita la profundidad del módulo
              y el largo limita cuántos módulos entran en la fila.
            </p>

            <form onSubmit={(e) => { e.preventDefault(); calcular(); }}>
              <div className={FORM_GRID}>
                <div className={FIELD}>
                  <label className={LABEL} htmlFor="e-sistema">Sistema de producción</label>
                  <select id="e-sistema" className="select w-full text-base" value={form.sistema}
                    onChange={(e) => set("sistema", e.target.value as Sistema)}>
                    {SISTEMAS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  <span className={HINT}>
                    Define la densidad máxima legal ({form.sistema === "ecologico" ? "6" : "9"} gallinas/m²).
                  </span>
                </div>

                <div className={FIELD}>
                  <label className={LABEL} htmlFor="e-ancho">Ancho de nave</label>
                  <div className={INPUT_UNIT}>
                    <input id="e-ancho" type="number" className={INPUT_IN}
                      min={1} step="0.1" placeholder="12" value={form.ancho}
                      onChange={(e) => set("ancho", e.target.value)} required />
                    <span className={UNIT}>m</span>
                  </div>
                </div>

                <div className={FIELD}>
                  <label className={LABEL} htmlFor="e-largo">Largo de nave</label>
                  <div className={INPUT_UNIT}>
                    <input id="e-largo" type="number" className={INPUT_IN}
                      min={1} step="0.1" placeholder="60" value={form.largo}
                      onChange={(e) => set("largo", e.target.value)} required />
                    <span className={UNIT}>m</span>
                  </div>
                </div>

                <div className={FIELD}>
                  <label className={LABEL} htmlFor="e-altura">Altura libre</label>
                  <div className={INPUT_UNIT}>
                    <input id="e-altura" type="number" className={INPUT_IN}
                      min={50} step="1" placeholder={esNidal ? "280" : "400"} value={form.altura}
                      onChange={(e) => set("altura", e.target.value)} required />
                    <span className={UNIT}>cm</span>
                  </div>
                  {!esNidal && (
                    <span className={HINT}>≥ 300 cm para 2 niveles · ≥ 400 cm para 3 niveles.</span>
                  )}
                </div>

                <div className={FIELD}>
                  <label className={LABEL} htmlFor="e-parque">Parque de invierno</label>
                  <div className={INPUT_UNIT}>
                    <input id="e-parque" type="number" className={INPUT_IN}
                      min={0} step="1" placeholder="0" value={form.parque}
                      onChange={(e) => set("parque", e.target.value)} />
                    <span className={UNIT}>m²</span>
                  </div>
                  <span className={HINT}>Alero o patio cubierto anexo. No aumenta el aforo sin validación técnica de su uso.</span>
                </div>

                {(form.sistema === "campero" || form.sistema === "ecologico") && (
                  <div className={FIELD}>
                    <label className={LABEL} htmlFor="e-pasto">Zona de pasto</label>
                    <div className={INPUT_UNIT}>
                      <input id="e-pasto" type="number" className={INPUT_IN}
                        min={0} step="1" placeholder="0" value={form.pasto}
                        onChange={(e) => set("pasto", e.target.value)} />
                      <span className={UNIT}>m²</span>
                    </div>
                    <span className={HINT}>Limita el aforo campero a 1 gallina por cada 4 m² disponibles. Vacío = pendiente de medir.</span>
                  </div>
                )}

                {!esNidal && (
                  <div className={FIELD}>
                    <label className={LABEL} htmlFor="e-niveles">Niveles del aviario</label>
                    <select id="e-niveles" className="select w-full text-base" value={form.niveles}
                      onChange={(e) => set("niveles", e.target.value as FormState["niveles"])}>
                      <option value="auto">Máximo que permita la altura</option>
                      <option value="2">2 niveles</option>
                      <option value="3">3 niveles</option>
                    </select>
                  </div>
                )}
              </div>

              {superficie > 0 && (
                <p className={`${HINT} mt-2`}>
                  Superficie de nave: <strong>{superficie.toLocaleString("es-ES", { maximumFractionDigits: 1 })} m²</strong>
                </p>
              )}

              {/* Opcional: si no se rellena, el estudio usa el equipamiento por módulo de la ficha técnica */}
              <details className="collapse collapse-arrow mt-8 border border-base-300 bg-base-100 shadow-sm">
                <summary className="collapse-title p-6 pe-12">
                  <span className={PANEL_TITLE}>Equipamiento distinto al de la ficha</span>
                  <span className={`${HINT} block`}>
                    Opcional
                    {Object.values(mediciones).some((v) => v !== "")
                      ? ` · ${Object.values(mediciones).filter((v) => v !== "").length} valor(es) introducido(s)`
                      : " · se usa la ficha técnica"}
                  </span>
                </summary>
                <div className="collapse-content px-6">
                  <p className={`${HINT} mb-6`}>
                    {esNidal
                      ? "Cada módulo A-Nida integra perchas, comedero, bebederos y nidal dimensionados para su capacidad."
                      : "El estudio toma el equipamiento por módulo de la ficha técnica y lo multiplica por los módulos."}
                    {" "}Rellena solo lo que difiera en la instalación real, con el total de la nave; cero significa que no existe.
                  </p>
                  <div className={FORM_GRID}>
                    {([
                      ["perchas_m", "Perchas útiles (m)"],
                      ["nidal_util_m2", "Interior útil de nidales (m²)"],
                      ["comedero_lineal_accesible_m", "Comedero lineal accesible (m)"],
                      ["bebederos_pezon_copa", "Bebederos de pezón o copa (unidades)"],
                      ...(form.sistema === "campero" ? [["salidas_ancho_util_m", "Anchura útil total de salidas (m)"]]
                        : form.sistema === "ecologico" ? [["salidas_ancho_util_m", "Longitud total de trampillas al exterior (m)"]]
                        : []),
                    ]).map(([key, label]) => (
                      <div className={FIELD} key={key}>
                        <label className={LABEL} htmlFor={`med-${key}`}>{label}</label>
                        <input id={`med-${key}`} className={INPUT} type="number" min={0}
                          step={key === "bebederos_pezon_copa" ? "1" : "any"}
                          placeholder="De la ficha" value={mediciones[key] ?? ""}
                          onChange={(e) => setMediciones((v) => ({ ...v, [key]: e.target.value }))} />
                      </div>
                    ))}
                  </div>
                </div>
              </details>

              {/* ── Configuración de slots (solo nidal) ── */}
              {esNidal && (
                <div className={PANEL}>
                  <div className={PANEL_BODY}>
                  <div className={PANEL_TITLE}>Configuración de slots</div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {([
                      { lado: "izq", titulo: "Lado izquierdo", slot: form.slotIzq, kSlot: "slotIzq",
                        paso: form.pasoIzq, kPaso: "pasoIzq" },
                      { lado: "der", titulo: "Lado derecho", slot: form.slotDer, kSlot: "slotDer",
                        paso: form.pasoDer, kPaso: "pasoDer" },
                    ] as const).map((c) => (
                      <div key={c.lado} className={SIDE}>
                        <div className={SIDE_TITLE}>{c.titulo}</div>

                        <div className={FIELD}>
                          <span className={LABEL}>Profundidad del slot</span>
                          <div className={SEG} role="group" aria-label={`Profundidad del slot ${c.lado === "izq" ? "izquierdo" : "derecho"}`}>
                            {SLOTS.map((s) => (
                              <button key={s} type="button" aria-pressed={c.slot === s}
                                className={`${SEG_BTN}${c.slot === s ? " tab-active font-semibold text-primary" : ""}`}
                                onClick={() => set(c.kSlot, s)}>
                                {s === 0 ? "Sin slot" : `${s} m`}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className={`${FIELD} mt-4`}>
                          <label className={LABEL} htmlFor={`e-paso-${c.lado}`}>Paso mínimo de manejo</label>
                          <div className={INPUT_UNIT}>
                            <input id={`e-paso-${c.lado}`} type="number" className={INPUT_IN}
                              min={0} step="0.1" placeholder="1"
                              value={c.paso}
                              onChange={(e) => set(c.kPaso, e.target.value)} />
                            <span className={UNIT}>m</span>
                          </div>
                          <span className={HINT}>El conjunto queda centrado y aplica el mayor de los dos mínimos a ambos lados.</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className={`mt-6 rounded-box border border-l-4 border-base-300 bg-base-100 px-6 pt-4 pb-6 ${
                    encaje === "ok" ? "border-l-success" : encaje === "no" ? "border-l-error" : ""}`}>
                    <div className="mb-4 flex flex-wrap items-start gap-4 sm:flex-nowrap" role="status">
                      <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full ${
                        encaje === "ok" ? "bg-success/10 text-success"
                          : encaje === "no" ? "bg-error/10 text-error"
                          : "bg-base-200 text-base-content/70"}`} aria-hidden="true">
                        {encaje === "ok" ? (
                          <Check size={ICON_SM} strokeWidth={2.25} />
                        ) : encaje === "no" ? (
                          <X size={ICON_SM} strokeWidth={2.25} />
                        ) : (
                          <Minus size={ICON_SM} strokeWidth={2.25} />
                        )}
                      </span>

                      <div className="min-w-0 flex-auto">
                        <strong className={`block font-display font-semibold leading-snug ${
                          encaje === "ok" ? "text-success" : encaje === "no" ? "text-error" : ""}`}>
                          {encaje === "ok" && "El nidal entra en el ancho"}
                          {encaje === "no" && "El nidal no entra en el ancho"}
                          {encaje === "pendiente" && (slotsInvalidos
                            ? "Hace falta slot en al menos un lado"
                            : "Indica el ancho de nave")}
                        </strong>
                        <span className={`${HINT} mt-0.5 block`}>
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

                      <div className="w-full shrink-0 pl-12 sm:w-auto sm:pl-0 sm:text-right" aria-hidden="true">
                        <div className="whitespace-nowrap font-display text-lg font-semibold tabular-nums">
                          <span className={encaje === "no" ? "text-error" : ""}>{fmtM(anchoMinimo)}</span>
                          <span className="mx-1 font-normal text-slate-400">/</span>
                          <span className="text-base-content/70">{anchoDefinido ? fmtM(ancho) : "—"}</span>
                        </div>
                        <span className="mt-0.5 block whitespace-nowrap text-[0.7rem] font-medium uppercase tracking-wider text-base-content/70">
                          necesario / disponible (m)
                        </span>
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
                      <div className="mt-2" aria-hidden="true">
                        <div className="est-fit-axis-span" style={{ width: `${pct(ancho)}%` }}>
                          <span className="est-fit-axis-label">ancho de nave {fmtM(ancho)} m</span>
                        </div>
                      </div>
                    )}
                  </div>
                  </div>
                </div>
              )}

              {/* ── Distribución a lo largo (solo nidal) ── */}
              {esNidal && (
                <div className={PANEL}>
                  <div className={PANEL_BODY}>
                  <div className={`${PANEL_TITLE} mb-4`}>Distribución a lo largo</div>
                  <div className={FORM_GRID}>
                    <div className={FIELD}>
                      <span className={LABEL}>Local técnico (motor y mesa de recogida)</span>
                      <div className={SEG} role="group" aria-label="Posición del local técnico">
                        {([[false, "Anexo exterior"], [true, "Dentro de la nave"]] as const).map(([v, label]) => (
                          <button key={label} type="button" aria-pressed={form.localDentro === v}
                            className={`${SEG_BTN}${form.localDentro === v ? " tab-active font-semibold text-primary" : ""}`}
                            onClick={() => set("localDentro", v)}>
                            {label}
                          </button>
                        ))}
                      </div>
                      <span className={HINT}>
                        {form.localDentro
                          ? `Ocupa los primeros ${fmtM(localLargo)} m de la nave de pared a pared; ese suelo no cuenta para densidad ni yacija.`
                          : "Habitación adosada fuera de la nave: no resta largo."}
                      </span>
                    </div>
                    <div className={FIELD}>
                      <label className={LABEL} htmlFor="e-libre-fondo">Espacio libre al fondo</label>
                      <div className={`${INPUT_UNIT}${libreCorto ? " input-error" : ""}`}>
                        <input id="e-libre-fondo" type="number" className={INPUT_IN}
                          min={tensorLargo} step="0.1" placeholder={fmtM(tensorLargo)}
                          value={form.libreFondo} onChange={(e) => set("libreFondo", e.target.value)} />
                        <span className={UNIT}>m</span>
                      </div>
                      <span className={libreCorto ? "text-sm text-error" : HINT}>
                        {libreCorto
                          ? `El tensor necesita al menos ${fmtM(tensorLargo)} m tras el último módulo.`
                          : `Desde el último módulo hasta la pared, tensor incluido (mínimo ${fmtM(tensorLargo)} m).`}
                      </span>
                    </div>
                  </div>
                  {largo > 0 && !libreCorto && (
                    <p className={`${HINT} mt-4`}>
                      {modulosLargo > 0
                        ? <>Caben <strong>{modulosLargo} módulos</strong>:{" "}
                            {form.localDentro && `${fmtM(localLargo)} m de local + `}
                            {modulosLargo} × {fmtM(moduloLargo)} m + {fmtM(libreFondoM + sobranteLargo)} m libres
                            = {fmtM(largo)} m.</>
                        : `No cabe ningún módulo en ${fmtM(largo)} m de largo con este reparto.`}
                    </p>
                  )}
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-4">
                <button type="submit" className={BTN_PRIMARY} disabled={!formListo}>
                  Calcular estudio
                  <ArrowRight size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                </button>
                <button type="button" className={BTN_GHOST} onClick={reiniciar}>
                  Empezar de nuevo
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Paso 3 — informe del estudio ── */}
        {paso === "estudio" && (
          <div className="est-anim" ref={resultadoRef}>
            {cargando && (
              <div className="flex flex-col items-center gap-4 py-16 text-base-content/70" role="status" aria-live="polite">
                <span className="loading loading-dots loading-lg text-primary" />
                <p className={HINT}>Calculando capacidad y verificaciones…</p>
              </div>
            )}

            {!cargando && error && <div role="alert" className={ERR}>{error}</div>}

            {!cargando && res && (
              <>
                {/* ── Controles del informe (solo en pantalla) ── */}
                <div className="print:hidden">
                  <button className={BACK} onClick={() => setPaso("nave")}>
                    <ArrowLeft size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                    Ajustar parámetros
                  </button>

                  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                    <div>
                      <div className={EYEBROW}>Paso 3 de 3</div>
                      <h2 className={`${H1} mb-1`}>Informe del estudio</h2>
                      <p className={`${HINT} max-w-prose`}>
                        Completa los datos del cliente y exporta. La hoja de abajo es el documento que se entrega.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {res.tipo_zona === "nidal_colectivo" && (
                        <button className={BTN_GHOST} onClick={descargarDxf} disabled={!res.viable || descargandoDxf}>
                          <Download size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                          {descargandoDxf ? "Preparando DXF…" : "DXF"}
                        </button>
                      )}
                      <button className={BTN_GHOST} onClick={() => exportar("tecnica")}>
                        <Printer size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                        PDF técnico
                      </button>
                      <button className={BTN_PRIMARY} onClick={() => exportar("cliente")}>
                        <Printer size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                        PDF cliente
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
                    {/* Datos del informe: solo portada, pie y cajetín del plano */}
                    <div className="card card-border bg-base-100 shadow-sm">
                      <div className="card-body gap-4 p-5">
                        <span className="font-display text-xs font-semibold uppercase tracking-wider text-primary">Datos del informe</span>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className={FIELD}>
                            <label className={LABEL} htmlFor="inf-cliente">Cliente</label>
                            <input id="inf-cliente" className={INPUT} placeholder="Nombre del cliente o de la empresa"
                              value={informe.cliente} autoComplete="organization"
                              onChange={(e) => setInforme((v) => ({ ...v, cliente: e.target.value }))}
                              onBlur={() => cargarPlano(res)} />
                          </div>
                          <div className={FIELD}>
                            <label className={LABEL} htmlFor="inf-proyecto">Proyecto</label>
                            <input id="inf-proyecto" className={INPUT} placeholder="Opcional · p. ej. Ampliación nave 2"
                              value={informe.proyecto}
                              onChange={(e) => setInforme((v) => ({ ...v, proyecto: e.target.value }))} />
                          </div>
                          <div className={FIELD}>
                            <label className={LABEL} htmlFor="inf-ref">Nº de estudio</label>
                            <input id="inf-ref" className={`${INPUT} font-medium`} placeholder={referenciaAuto}
                              value={informe.ref}
                              onChange={(e) => setInforme((v) => ({ ...v, ref: e.target.value }))} />
                            <span className={HINT}>Vacío = automática (<span className="whitespace-nowrap">{referenciaAuto}</span>)</span>
                          </div>
                          <div className={FIELD}>
                            <label className={LABEL} htmlFor="inf-autor">Preparado por</label>
                            <input id="inf-autor" className={INPUT} placeholder="Opcional" autoComplete="name"
                              value={informe.autor}
                              onChange={(e) => setInforme((v) => ({ ...v, autor: e.target.value }))} />
                          </div>
                          <div className={`${FIELD} sm:col-span-2`}>
                            <label className={LABEL} htmlFor="inf-explotacion">Explotación / ubicación</label>
                            <input id="inf-explotacion" className={INPUT} placeholder="Opcional"
                              value={informe.explotacion}
                              onChange={(e) => setInforme((v) => ({ ...v, explotacion: e.target.value }))} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card card-border bg-base-100 shadow-sm">
                      <div className="card-body gap-4 p-5">
                        <span className="font-display text-xs font-semibold uppercase tracking-wider text-primary">Versión</span>
                        <div className={SEG} role="group" aria-label="Versión del estudio">
                          {([["cliente", "Cliente"], ["tecnica", "Técnica"]] as const).map(([v, label]) => (
                            <button key={v} type="button" aria-pressed={version === v}
                              className={`${SEG_BTN}${version === v ? " tab-active font-semibold text-primary" : ""}`}
                              onClick={() => setVersion(v)}>
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className={HINT}>
                          {esCliente
                            ? "Se adjunta a la propuesta: capacidad, cumplimiento y plano."
                            : "Uso interno: añade límites, escenarios y parámetros de cálculo."}
                        </p>

                        {(esAviarioRes || opcionesConfig.length > 1) && (
                          <div className={`flex flex-col gap-3 border-t border-base-300 pt-4 transition-opacity${recalculando ? " opacity-60" : ""}`}
                            aria-busy={recalculando}>
                          {esAviarioRes && (
                            <div className="flex flex-wrap items-center gap-3">
                              <span className="flex-[1_1_8rem] font-display text-xs font-semibold uppercase tracking-wider text-primary">Configurar por</span>
                              <div className={`${SEG} w-auto`} role="group" aria-label="Configurar el aviario por filas o por módulos">
                                {([["filas", "Filas"], ["modulos", "Módulos"]] as const).map(([v, label]) => (
                                  <button key={v} type="button" aria-pressed={reparto === v} disabled={recalculando}
                                    className={`${SEG_BTN} min-h-9 px-4${reparto === v ? " tab-active font-semibold text-primary" : ""}`}
                                    onClick={() => cambiarReparto(v)}>
                                    {label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {opcionesConfig.length > 1 && (
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex-[1_1_8rem] font-display text-xs font-semibold uppercase tracking-wider text-primary" htmlFor="est-config-num">
                              {porFilas ? "Filas" : "Módulos"}
                              <span className="mt-0.5 block font-sans text-xs font-normal normal-case tracking-normal text-base-content/70">
                                de {configMin} a {configMax}
                                {porFilas ? ` · ${modsFilaMax} módulos por fila` : esAviarioRes ? ` · hasta ${modsFilaMax} por fila` : ""}
                              </span>
                            </label>
                            <div className="join">
                              <button type="button" className="btn btn-square join-item border-base-300 bg-base-200 text-primary"
                                aria-label={porFilas ? "Una fila menos" : "Un módulo menos"}
                                disabled={recalculando || configActual <= configMin}
                                onClick={() => elegirConfiguracion(configActual - 1)}>
                                <Minus size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                              </button>
                              <input id="est-config-num" key={configActual} type="number" inputMode="numeric"
                                className="input join-item w-20 text-center font-display text-lg font-semibold text-primary tabular-nums"
                                min={configMin} max={configMax}
                                defaultValue={configActual || ""} disabled={recalculando}
                                onBlur={(ev) => confirmarConfiguracion(ev.currentTarget)}
                                onKeyDown={(ev) => { if (ev.key === "Enter") ev.currentTarget.blur(); }} />
                              <button type="button" className="btn btn-square join-item border-base-300 bg-base-200 text-primary"
                                aria-label={porFilas ? "Una fila más" : "Un módulo más"}
                                disabled={recalculando || configActual >= configMax}
                                onClick={() => elegirConfiguracion(Math.max(configMin, configActual + 1))}>
                                <Plus size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                              </button>
                            </div>
                            {escenarioOptimo && configOptima !== null && (configActual === configOptima
                              ? <span className={`${TAG} badge-success`}>Óptimo</span>
                              : <button type="button" className="btn btn-soft btn-primary btn-sm" disabled={recalculando}
                                  onClick={() => elegirConfiguracion(configOptima)}>
                                  Óptimo: {configOptima} · {escenarioOptimo.gallinas.toLocaleString("es-ES")} aves
                                </button>)}
                          </div>
                          )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Documento: lo que se ve aquí es lo que sale en el PDF ── */}
                <article className="mx-auto mt-10 max-w-[920px] rounded-box bg-base-100 px-[clamp(1.25rem,5vw,3.5rem)] pt-10 pb-14 shadow-xl ring-1 ring-base-300 print:mt-0 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
                  <header className="flex items-start justify-between gap-6">
                    {/* gyc-logo-recortado.png es gyc-logo.png sin el margen transparente: la altura es la de la marca */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/gyc-logo-recortado.png" alt="Gómez y Crespo" className="h-11 w-auto sm:h-14 print:h-[15mm]" />
                    <div className="text-right text-sm leading-relaxed text-base-content/70 print:text-[8pt]">
                      {!esCliente && (
                        <div className="font-display text-[0.7rem] font-semibold uppercase tracking-[0.14em] print:text-[6.5pt]">
                          Documento interno
                        </div>
                      )}
                      <div className="font-display font-semibold text-primary tabular-nums">Ref. {referencia}</div>
                      <div>{fechaInforme}</div>
                      {informe.autor.trim() && <div>Elaborado por {informe.autor.trim()}</div>}
                    </div>
                  </header>

                  {/* Portada: título, proyecto y destinatario */}
                  <div className="mt-10 print:mt-7">
                    <h1 className="font-display text-[clamp(2rem,4.5vw,2.85rem)] font-semibold leading-[1.05] tracking-tight text-primary print:text-[24pt]">
                      {esCliente ? "Estudio de capacidad de la nave" : "Estudio técnico de la nave"}
                    </h1>
                    {informe.proyecto.trim() && (
                      <p className="mt-2 font-display text-xl font-medium text-base-content/80 print:mt-1 print:text-[13pt]">
                        {informe.proyecto.trim()}
                      </p>
                    )}
                    <p className="mt-4 text-lg print:mt-2 print:text-[11pt]">
                      {informe.cliente.trim()
                        ? <>Preparado para <strong className="font-semibold">{informe.cliente.trim()}</strong>
                            {informe.explotacion.trim() && <span className="text-base-content/70"> · {informe.explotacion.trim()}</span>}</>
                        : <span className="text-base text-base-content/50 italic print:hidden">Indica el cliente en «Datos del informe» para que figure en el documento.</span>}
                    </p>
                  </div>

                  {/* Resumen: datos de la nave y capacidad */}
                  <div className="mt-10 grid gap-8 md:grid-cols-[1fr_1.05fr] print:mt-6 print:grid-cols-[1fr_1.05fr] print:gap-6">
                    <div>
                      <div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-base-content/70 print:text-[6.5pt]">Datos de la nave</div>
                      <dl className="divide-y divide-base-300 border-y border-base-300 print:text-[8.5pt]">
                        {([
                          ["Dimensiones", `${fmtM(res.ancho_nave_m)} × ${fmtM(res.largo_nave_m)} m · ${miles(Math.round(res.superficie_nave_m2))} m²`],
                          ["Altura libre", `${res.altura_nave_cm} cm`],
                          ["Sistema de producción", SISTEMAS.find((s) => s.value === res.sistema)?.label ?? res.sistema],
                          ["Equipo", res.tipo_zona === "aviario" ? `Aviario industrial · ${res.niveles} niveles` : "Nidal colectivo A-Nida"],
                          ["Distribución", res.descripcion_layout || "Sin distribución viable"],
                          ...(res.sup_parque_m2 > 0 ? [["Parque de invierno", `${res.sup_parque_m2.toLocaleString("es-ES")} m²`]] : []),
                          ...(res.sup_pasto_m2 > 0 ? [["Zona de pasto", `${res.sup_pasto_m2.toLocaleString("es-ES")} m²`]] : []),
                          ...(res.tipo_zona === "nidal_colectivo" && !esCliente ? [
                            ["Slots", `${res.slot_izq_m} + ${res.slot_der_m} m`],
                            ["Paso real a cada lado", `${fmtM(res.geometria_nidal?.paso_lateral_m ?? pasoReal)} m`],
                          ] : []),
                        ] as [string, string][]).map(([k, v]) => (
                          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 print:py-1.5">
                            <dt className="text-base-content/70">{k}</dt>
                            <dd className="text-right font-medium tabular-nums">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>

                    {/* Cifra principal sobre azul marino con una rejilla de plano muy tenue */}
                    <div className={`relative flex flex-col justify-between overflow-hidden rounded-box p-7 print:p-5 ${res.viable ? "bg-primary text-primary-content" : "bg-error/10 text-error"}`}>
                      {res.viable && (
                        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" aria-hidden="true"
                          style={{
                            backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                            backgroundSize: "22px 22px",
                          }} />
                      )}
                      <div className="relative">
                        <div className="font-display text-xs font-semibold uppercase tracking-[0.12em] opacity-80 print:text-[6.5pt]">
                          Capacidad estimada
                        </div>
                        {res.viable ? (
                          <>
                            <div className="mt-3 font-display font-semibold leading-none tracking-tight tabular-nums">
                              {conIntervalo ? (
                                <span className="text-[clamp(2.2rem,5vw,3.1rem)] print:text-[26pt]">
                                  {miles(res.gallinas_min)}<span className="mx-2 opacity-60">–</span>{miles(res.gallinas_max)}
                                </span>
                              ) : (
                                <span className="text-[clamp(2.6rem,6vw,3.6rem)] print:text-[30pt]">{miles(res.gallinas_max)}</span>
                              )}
                            </div>
                            <div className="mt-2 text-base opacity-80 print:text-[9pt]">gallinas ponedoras</div>
                          </>
                        ) : (
                          <div className="mt-3 font-display text-3xl font-semibold print:text-[18pt]">No viable</div>
                        )}
                      </div>
                      <div className="relative mt-8 border-t border-current/20 pt-4 print:mt-5 print:pt-3">
                        {res.viable ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-content print:text-[8pt]">
                            <Check size={ICON_SM} strokeWidth={2.5} aria-hidden="true" />
                            {filas.every((f) => f.cumple) ? "Cumple la normativa de bienestar" : `${filas.filter((f) => f.cumple).length} de ${filas.length} requisitos cumplidos`}
                          </span>
                        ) : (
                          <p className="text-sm print:text-[8pt]">{res.motivo}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {res.viable && !esCliente && (
                    <div data-reveal className="stats stats-vertical mt-8 w-full break-inside-avoid border border-base-300 bg-base-100 sm:stats-horizontal print:mt-5 print:stats-horizontal">
                      <div className="stat print:px-3 print:py-2">
                        <div className={KPI_TITLE}>Módulos instalados</div>
                        <div className={KPI_VAL}>
                          {res.num_modulos}<span className={KPI_UNIT}>módulos</span>
                        </div>
                        <div className={KPI_DESC}>{res.descripcion_layout}</div>
                      </div>
                      <div className="stat print:px-3 print:py-2">
                        <div className={KPI_TITLE}>Densidad</div>
                        <div className={KPI_VAL}>
                          {res.densidad_real.toFixed(1)}
                          <span className={KPI_UNIT}>/ {res.densidad_max.toFixed(0)} gallinas/m²</span>
                        </div>
                        <progress
                          className={`progress mt-2 h-1.5 w-full ${res.densidad_real >= res.densidad_max ? "progress-warning" : "progress-secondary"}`}
                          value={Math.min(100, (res.densidad_real / res.densidad_max) * 100)} max={100}
                          aria-label="Densidad respecto al máximo legal" />
                        <div className={KPI_DESC}>
                          sobre {res.sup_disponible_m2.toLocaleString("es-ES", { maximumFractionDigits: 0 })} m² útiles
                        </div>
                      </div>
                      <div className="stat print:px-3 print:py-2">
                        <div className={KPI_TITLE}>Yacija disponible</div>
                        <div className={KPI_VAL}>
                          {res.sup_yacija_m2.toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                          <span className={KPI_UNIT}>m²</span>
                        </div>
                        <div className={KPI_DESC}>
                          mínimo {res.yacija_min_m2.toLocaleString("es-ES", { maximumFractionDigits: 0 })} m² · {res.yacija_pct}% de la superficie
                        </div>
                      </div>
                    </div>
                  )}

                  {!esCliente && res.viable && res.limitante && (
                    <div data-reveal className="mt-4 grid break-inside-avoid gap-x-8 gap-y-4 rounded-box border border-warning/30 bg-warning/5 p-6 sm:grid-cols-[1fr_auto] print:px-3 print:py-2">
                      <div>
                        <div className="font-display text-xs font-semibold uppercase tracking-wide text-warning print:text-[6pt]">Factor limitante</div>
                        <div className="mt-1 font-display text-2xl font-semibold print:text-[13pt]">{nombreLimitante(res.limitante)}</div>
                        {limitesActivos.map((l) => (
                          <div key={l.criterio} className="mt-2 text-[0.9rem] tabular-nums print:text-[7.5pt]">
                            {l.formula} = {l.gallinas.toLocaleString("es-ES")} gallinas
                            <span className={ART}> · {l.fuente}</span>
                          </div>
                        ))}
                      </div>
                      {siguienteLimite && (
                        <div className="border-t border-warning/30 pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6 sm:text-right">
                          <div className="font-display text-xs font-semibold uppercase tracking-wide text-warning print:text-[6pt]">Siguiente límite</div>
                          <div className="mt-1 font-display text-lg font-semibold print:text-[10pt]">{nombreLimitante(siguienteLimite.criterio)}</div>
                          <div className="mt-1 text-[0.85rem] text-base-content/70 print:text-[7.5pt]">
                            {siguienteLimite.gallinas.toLocaleString("es-ES")} gallinas
                            {" "}(+{(siguienteLimite.gallinas - res.gallinas_max).toLocaleString("es-ES")} si se resuelve el limitante)
                          </div>
                        </div>
                      )}
                      {res.aforo && res.aforo.pendientes.length > 0 && (
                        <p className="col-span-full text-sm text-warning print:text-[7.5pt]">
                          Sin medir: {res.aforo.pendientes.map(nombreLimitante).join(", ")}.
                          Pueden resultar más restrictivos que el limitante actual.
                        </p>
                      )}
                    </div>
                  )}

                  {/* ── Verificaciones ── */}
                  {filas.length > 0 && (
                    <Seccion n={sec()} titulo={esCliente ? "Cumplimiento normativo" : "Verificación normativa"}
                      nota={`${filas.filter((f) => f.cumple).length} de ${filas.length} cumplen`}>
                      <div className={DOC_TABLE_WRAP}>
                        <table className={TABLE}>
                          <thead className={THEAD}>
                            <tr>
                              <th>Parámetro</th>
                              <th>Valor</th>
                              <th>Límite</th>
                              <th className="text-right">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filas.map((f) => (
                              <tr key={f.nombre} className="align-top">
                                <td>
                                  <div className={PARAM}>{f.nombre}</div>
                                  {f.detalle && <div className={DETALLE}>{f.detalle}</div>}
                                  {f.pie && <div className={ART}>{f.pie}</div>}
                                </td>
                                <td className="whitespace-nowrap font-medium tabular-nums">{f.valor}</td>
                                <td className="whitespace-nowrap tabular-nums text-base-content/70">{f.limite}</td>
                                <td className="text-right">
                                  <span className={`${TAG} ${f.cumple ? "badge-success" : "badge-error"}`}>
                                    {f.cumple ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : <X size={12} strokeWidth={2.5} aria-hidden="true" />}
                                    {f.cumple ? "Cumple" : "No cumple"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Seccion>
                  )}

                  {/* ── Escenarios por nº de módulos (en el PDF técnico sale entera, salvo aviarios grandes) ── */}
                  {!esCliente && res.escenarios.length > 1 && (
                    <Seccion n={sec()} titulo="Comparativa de escenarios"
                      nota={<>
                        <span className="print:hidden">pulsa una fila para recalcular el estudio con esa configuración</span>
                        <span className="hidden print:inline">
                          {resumirEscenarios ? "filas completas, óptimo y configuración del estudio" : "configuración del estudio resaltada"}
                        </span>
                      </>}>
                      <div className={`${DOC_TABLE_WRAP}${res.escenarios.length > 12 ? " max-h-[460px] overflow-y-auto print:max-h-none" : ""}`}>
                        <table className={`${TABLE} table-pin-rows`}>
                          <thead className={THEAD}>
                            <tr className="bg-base-200">
                              <th>Módulos</th>
                              {esAviarioRes && <th>Filas</th>}
                              <th>Gallinas</th>
                              <th>Densidad</th>
                              <th>Yacija</th>
                              <th>Limitante</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {res.escenarios.map((e) => {
                              const sel = e.num_modulos === res.num_modulos;
                              const enPdf = !resumirEscenarios || sel || e.es_optimo || !e.cabe || e.num_modulos % modsFilaMax === 0;
                              return (
                                <tr key={`${e.num_filas}-${e.num_modulos}`}
                                  className={`transition-colors ${!e.cabe ? "text-base-content/50"
                                    : sel ? "cursor-pointer bg-secondary/10" : "cursor-pointer hover:bg-base-200"}${enPdf ? "" : " print:hidden"}`}
                                  title={e.cabe ? undefined : e.nota}
                                  onClick={() => e.cabe && elegirEscenario(e.num_modulos)}>
                                  <td className={`whitespace-nowrap tabular-nums ${PARAM}${sel ? " text-primary" : ""}`}>
                                    {e.num_modulos}
                                    {e.es_optimo && <span className={`${TAG} badge-success ml-2`}>Óptimo</span>}
                                    {sel && !e.es_optimo && <span className={`${TAG} badge-warning ml-2`}>Seleccionado</span>}
                                  </td>
                                  {esAviarioRes && <td className="tabular-nums">{e.num_filas}</td>}
                                  <td className="tabular-nums">{e.gallinas.toLocaleString("es-ES")}</td>
                                  <td className="whitespace-nowrap tabular-nums">{e.densidad.toFixed(1)} gallinas/m²</td>
                                  <td className="whitespace-nowrap tabular-nums">
                                    {e.sup_yacija_m2.toLocaleString("es-ES", { maximumFractionDigits: 0 })} m² ({e.yacija_pct}%)
                                  </td>
                                  <td className="whitespace-nowrap">{nombreLimitante(e.limitante)}</td>
                                  <td>
                                    {e.cabe ? (
                                      <span className={`${TAG} ${e.cumple ? "badge-success" : "badge-error"}`}>
                                        {e.cumple ? "Conforme" : "Yacija insuficiente"}
                                      </span>
                                    ) : (
                                      <>
                                        <span className={`${TAG} badge-ghost`}>No cabe</span>
                                        <div className={`${ART} mt-0.5 whitespace-nowrap`}>{e.nota}</div>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Seccion>
                  )}

                  {/* ── Condiciones del régimen ecológico (ambas versiones) ── */}
                  {res.condiciones.length > 0 && (
                    <Seccion n={sec()} titulo="Requisitos de la producción ecológica" nota="a cumplir en la explotación">
                      <div className={DOC_TABLE_WRAP}>
                        <table className={TABLE}>
                          <thead className={THEAD}>
                            <tr><th>Requisito</th><th>Condición</th></tr>
                          </thead>
                          <tbody>
                            {res.condiciones.map((c) => (
                              <tr key={c.nombre} className="align-top">
                                <td>
                                  <div className={PARAM}>{c.nombre}</div>
                                  <div className={ART}>{c.fuente}</div>
                                </td>
                                <td>{c.detalle}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Seccion>
                  )}

                  {/* ── Requisitos de equipamiento ── */}
                  {!esCliente && res.requisitos.length > 0 && (
                    <Seccion n={sec()} titulo="Equipamiento mínimo" nota={`para ${res.gallinas_max.toLocaleString("es-ES")} gallinas`}>
                      <div className={DOC_TABLE_WRAP}>
                        <table className={TABLE}>
                          <thead className={THEAD}>
                            <tr><th>Elemento</th><th>Mínimo</th><th>Cálculo</th><th>Referencia</th></tr>
                          </thead>
                          <tbody>
                            {res.requisitos.map((r) => (
                              <tr key={r.nombre} className="align-top">
                                <td className={PARAM}>{r.nombre}</td>
                                <td className="whitespace-nowrap tabular-nums">
                                  {r.valor_minimo.toLocaleString("es-ES", { maximumFractionDigits: 2 })} {r.unidad}
                                </td>
                                <td className="whitespace-nowrap tabular-nums">{r.formula}</td>
                                <td className={ART}>{r.articulo}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Seccion>
                  )}

                  {/* ── Límites por medición ── */}
                  {!esCliente && res.aforo && (
                    <Seccion n={sec()} titulo="Límites por medición" nota="la capacidad es el menor de todos">
                      <div className={DOC_TABLE_WRAP}>
                        <table className={TABLE}>
                          <thead className={THEAD}><tr><th>Criterio</th><th>Cálculo</th><th>Gallinas</th><th></th></tr></thead>
                          <tbody>{limitesOrdenados.map((l) => {
                            const activo = codigosLimitante.includes(l.criterio);
                            return (
                              <tr key={l.criterio} className={activo ? "bg-warning/10 text-warning" : undefined}>
                                <td className={PARAM}>{nombreLimitante(l.criterio)}</td>
                                <td className="whitespace-nowrap tabular-nums">{l.formula}</td>
                                <td className="tabular-nums">{l.gallinas.toLocaleString("es-ES")}</td>
                                <td>{activo && <span className={`${TAG} badge-warning`}>Limitante</span>}</td>
                              </tr>
                            );
                          })}</tbody>
                        </table>
                      </div>
                      {res.aforo.pendientes.length > 0 && <p className={`${HINT} mt-3`}>Pendiente de medir: {res.aforo.pendientes.map(nombreLimitante).join(", ")}. El resultado es provisional.</p>}
                    </Seccion>
                  )}

                  {!esCliente && res.parametros.length > 0 && (
                    <Seccion n={sec()} titulo="Parámetros de cálculo"
                      nota={<>valores aplicados y su origen<span className="print:hidden"> · <Link href="/ficha" className="link link-secondary underline-offset-2 hover:text-primary">editar ficha técnica</Link></span></>}>
                      <div className={DOC_TABLE_WRAP}>
                        <table className={TABLE}>
                          <thead className={THEAD}><tr><th>Grupo</th><th>Parámetro</th><th>Valor</th><th>Origen</th></tr></thead>
                          <tbody>
                            {res.parametros.map((p, i) => (
                              <tr key={`${p.grupo}-${p.nombre}`}>
                                <td className={ART}>{i === 0 || res.parametros[i - 1].grupo !== p.grupo ? p.grupo : ""}</td>
                                <td className={PARAM}>{p.nombre}</td>
                                <td className="whitespace-nowrap tabular-nums">{p.valor}</td>
                                <td><span className={`${TAG} ${ORIGEN_TAG[p.origen] ?? ""}`}>{p.origen}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Seccion>
                  )}

                  {/* ── Plano y consideraciones al final: en el PDF comparten una hoja A4 apaisada ── */}
                  <div className={svg ? "print:break-before-page print:[page:plano]" : ""}>
                      {svg && (
                      <Seccion n={sec()} titulo="Distribución en planta" nota={res.descripcion_layout} className="print:mt-0">
                        <div className="est-plano break-inside-avoid overflow-x-auto rounded-box border border-base-300 bg-base-100 p-2 print:rounded-none print:border-0 print:p-0"
                          dangerouslySetInnerHTML={{ __html: svg }} />
                      </Seccion>
                    )}

                    {/* ── Consideraciones: alcance del estudio ── */}
                    <Seccion n={sec()} titulo="Consideraciones" className="break-inside-avoid print:mt-6">
                      <ul className="grid gap-2 text-[0.95rem] leading-relaxed text-base-content/80 print:gap-1 print:text-[8.5pt]">
                        {[
                          "Estudio preliminar a partir de las dimensiones facilitadas por el cliente; la distribución y las medidas del equipo se confirmarán en el proyecto definitivo.",
                          `Las verificaciones aplican el RD 3/2002 y la Directiva 1999/74/CE${res.sistema === "ecologico" ? ", y el Reglamento (UE) 2018/848 con su Reglamento de Ejecución (UE) 2020/464 para la producción ecológica" : ""}.`,
                          ...(conIntervalo ? [`La capacidad se expresa como intervalo: el mínimo descuenta un ${num(res.margen_incertidumbre_pct)} % de la superficie de la nave como margen de medición.`] : []),
                          ].map((t) => (
                          <li key={t} className="flex gap-3">
                            <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </Seccion>
                  </div>
                </article>

                {/* Pie de cada hoja del PDF con número de página (márgenes de página CSS) */}
                <style>{piePagina(
                  ["Gómez y Crespo", informe.cliente.trim(), !esCliente && "uso interno"].filter(Boolean).join(" · "),
                  `Ref. ${referencia}`,
                )}</style>
              </>
            )}

            {!cargando && !res && !error && (
              <div role="alert" className={ERR}>No hay resultados. Vuelve a introducir los datos de la nave.</div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
