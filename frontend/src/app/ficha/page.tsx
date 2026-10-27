"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, RotateCcw, Save, Undo2 } from "lucide-react";
import {
  obtenerFicha,
  guardarFicha,
  restablecerFicha,
  type FichaRespuesta,
  type FichaTecnica,
} from "../actions";
import {
  ART, BLOCK, BLOCK_H, BLOCK_NOTE, BTN_GHOST, BTN_PRIMARY, ERR, EYEBROW, FIELD, FORM_GRID, H1, HINT,
  INPUT_IN, INPUT_UNIT, LABEL, MAIN, PANEL, PANEL_BODY, PANEL_TITLE, PARAM, SIDE, SIDE_TITLE, SUB,
  TABLE, TABLE_WRAP, TAG, THEAD, UNIT,
} from "../clases";
import Cabecera from "../Cabecera";

const ICON_SM = 16;
const ICON_STROKE = 1.75;

// ── Descripción de los campos ────────────────────────────────────────────────

interface Campo {
  k: string;          // ruta dentro de la ficha, p. ej. "aviario.nivel_3.perchas_m"
  label: string;
  unidad: string;
  ayuda?: string;
  entero?: boolean;
  cero?: boolean;     // admite 0
  opcional?: boolean; // vacío = sin dato
  menorQue?: number;  // límite superior excluido
}

const AVIARIO: Campo[] = [
  { k: "aviario.largo_modulo_m", label: "Largo del módulo", unidad: "m", ayuda: "A lo largo de la nave" },
  { k: "aviario.fondo_modulo_m", label: "Fondo del módulo", unidad: "m", ayuda: "A lo ancho de la nave (una fila)" },
  { k: "aviario.capacidad_gallinas", label: "Capacidad por módulo", unidad: "gal", entero: true },
  { k: "aviario.pasillo_m", label: "Pasillo entre filas", unidad: "m", cero: true },
  { k: "aviario.zona_equipos_frontal_m", label: "Zona de equipos frontal", unidad: "m", cero: true, ayuda: "Extremo con noria y comida" },
  { k: "aviario.zona_equipos_fondo_m", label: "Zona de equipos al fondo", unidad: "m", cero: true },
];

const NIVEL: Campo[] = [
  { k: "altura_min_cm", label: "Altura libre mínima de nave", unidad: "cm" },
  { k: "sup_total_m2", label: "Superficie total por módulo", unidad: "m²", ayuda: "Incluye la zona de puesta" },
  { k: "sup_disponible_m2", label: "Superficie disponible por módulo", unidad: "m²", ayuda: "La que computa para densidad" },
  { k: "perchas_m", label: "Perchas por módulo", unidad: "m", cero: true, opcional: true },
  { k: "nidal_util_m2", label: "Nidal útil por módulo", unidad: "m²", cero: true, opcional: true },
  { k: "comedero_lineal_m", label: "Comedero lineal accesible por módulo", unidad: "m", cero: true, opcional: true, ayuda: "Si se come por los dos lados, el doble del largo" },
  { k: "bebederos", label: "Bebederos por módulo", unidad: "uds", cero: true, opcional: true, entero: true },
];

const NIDAL: Campo[] = [
  { k: "nidal.largo_modulo_m", label: "Largo del módulo", unidad: "m", ayuda: "A lo largo de la cadena" },
  { k: "nidal.fondo_cuerpo_m", label: "Fondo del cuerpo", unidad: "m", ayuda: "Sin contar los slots" },
  { k: "nidal.capacidad_gallinas", label: "Capacidad por módulo", unidad: "gal", entero: true },
  { k: "nidal.nidal_util_m2", label: "Alfombrillas de puesta por módulo", unidad: "m²" },
  { k: "nidal.tensor_m", label: "Módulo tensor", unidad: "m", cero: true, ayuda: "Dentro de la nave, al final de la cadena" },
  { k: "nidal.local_tecnico_m", label: "Local técnico", unidad: "m", cero: true, ayuda: "Anexo exterior; no resta largo" },
];

const CALCULO: Campo[] = [
  { k: "calculo.margen_incertidumbre_pct", label: "Margen de incertidumbre", unidad: "%", cero: true, menorQue: 100,
    ayuda: "Se resta a la superficie de la nave para calcular la capacidad mínima" },
];

const NIVELES = ["nivel_2", "nivel_3"] as const;
const TODOS: Campo[] = [
  ...AVIARIO,
  ...NIVELES.flatMap((n) => NIVEL.map((c) => ({ ...c, k: `aviario.${n}.${c.k}` }))),
  ...NIDAL,
  ...CALCULO,
];

// ── Conversión ficha ⇄ formulario ────────────────────────────────────────────

type Valores = Record<string, string>;

function leer(obj: unknown, ruta: string): unknown {
  return ruta.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | null)?.[k], obj);
}

const fmt = (v: unknown) =>
  v === null || v === undefined ? "" : String(v).replace(".", ",");

function aValores(f: FichaTecnica): Valores {
  return Object.fromEntries(TODOS.map((c) => [c.k, fmt(leer(f, c.k))]));
}

const aNumero = (v: string) => Number(v.trim().replace(",", "."));

function validar(c: Campo, v: string): string | null {
  if (v.trim() === "") return c.opcional ? null : "Obligatorio";
  const n = aNumero(v);
  if (!Number.isFinite(n)) return "Número no válido";
  if (c.entero && !Number.isInteger(n)) return "Debe ser un número entero";
  if (c.cero ? n < 0 : n <= 0) return c.cero ? "No puede ser negativo" : "Debe ser mayor que 0";
  if (c.menorQue !== undefined && n >= c.menorQue) return `Debe ser menor que ${c.menorQue}`;
  return null;
}

function aFicha(v: Valores): FichaTecnica {
  const raiz: Record<string, unknown> = {};
  for (const c of TODOS) {
    const partes = c.k.split(".");
    let nodo = raiz;
    for (const p of partes.slice(0, -1)) nodo = (nodo[p] ??= {}) as Record<string, unknown>;
    const s = v[c.k].trim();
    nodo[partes[partes.length - 1]] = s === "" ? null : aNumero(s);
  }
  return raiz as unknown as FichaTecnica;
}

function fechaLarga(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-ES", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Página ───────────────────────────────────────────────────────────────────

export default function FichaPage() {
  const [datos, setDatos] = useState<FichaRespuesta | null>(null);
  const [valores, setValores] = useState<Valores>({});
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function cargar(r: FichaRespuesta) {
    setDatos(r);
    setValores(aValores(r.ficha));
  }

  useEffect(() => {
    obtenerFicha().then((r) => (r.ok ? cargar(r.data) : setErrorCarga(r.error)));
  }, []);

  const guardados = useMemo(() => (datos ? aValores(datos.ficha) : {}), [datos]);
  const fabrica = useMemo(() => (datos ? aValores(datos.por_defecto) : {}), [datos]);
  const errores = useMemo(
    () => Object.fromEntries(TODOS.map((c) => [c.k, validar(c, valores[c.k] ?? "")])),
    [valores],
  );
  const hayErrores = Object.values(errores).some(Boolean);
  const cambios = TODOS.filter((c) => (valores[c.k] ?? "") !== (guardados[c.k] ?? "")).length;

  function set(k: string, v: string) {
    setValores((prev) => ({ ...prev, [k]: v }));
    setAviso(null);
    setErrorGuardar(null);
  }

  async function guardar() {
    if (hayErrores || !cambios) return;
    setOcupado(true);
    const r = await guardarFicha(aFicha(valores));
    setOcupado(false);
    if (r.ok) {
      cargar(r.data);
      setAviso("Ficha guardada. Los próximos estudios usan estos valores.");
    } else {
      setErrorGuardar(r.error);
    }
  }

  async function restablecer() {
    if (!window.confirm("¿Restablecer todos los valores de fábrica? Se perderán los cambios guardados.")) return;
    setOcupado(true);
    const r = await restablecerFicha();
    setOcupado(false);
    if (r.ok) {
      cargar(r.data);
      setAviso("Ficha restablecida a los valores de fábrica.");
    } else {
      setErrorGuardar(r.error);
    }
  }

  function campo(c: Campo, k = c.k) {
    const v = valores[k] ?? "";
    const err = errores[k];
    const modificado = v !== (fabrica[k] ?? "");
    const id = `f-${k.replaceAll(".", "-")}`;
    return (
      <div className={FIELD} key={k}>
        <label className={LABEL} htmlFor={id}>
          {c.label}
          {modificado && <span className={`${TAG} badge-warning ml-2 font-sans`} title="Distinto del valor de fábrica">modificado</span>}
        </label>
        <div className={`${INPUT_UNIT}${err ? " input-error" : ""}`}>
          <input
            id={id}
            className={INPUT_IN}
            type="text"
            inputMode={c.entero ? "numeric" : "decimal"}
            value={v}
            placeholder={c.opcional ? "Sin dato" : undefined}
            aria-invalid={!!err}
            aria-describedby={`${id}-ayuda`}
            onChange={(e) => set(k, e.target.value)}
          />
          <span className={UNIT}>{c.unidad}</span>
        </div>
        <span id={`${id}-ayuda`} className={err ? "text-sm text-error" : HINT}>
          {err ?? (modificado
            ? `Fábrica: ${fabrica[k] || "sin dato"}${c.ayuda ? ` · ${c.ayuda}` : ""}`
            : c.ayuda ?? (c.opcional && !v ? "Vacío = pendiente de medir en cada estudio" : ""))}
        </span>
      </div>
    );
  }

  return (
    <>
      <Cabecera activa="ficha" />

      <main className={MAIN}>
        <div className="est-anim">
          <div className={EYEBROW}>Configuración</div>
          <h1 className={H1}>Ficha técnica</h1>
          <p className={SUB}>
            Medidas y equipamiento por módulo que usa el cálculo de capacidad y el plano,
            y el margen de incertidumbre del informe.
            Los cambios se aplican a todos los estudios nuevos. Si en un estudio se introduce
            un equipamiento medido, ese valor prevalece sobre la ficha.
          </p>

          {errorCarga && <div className={ERR} role="alert">{errorCarga}</div>}

          {datos && (
            <>
              <div className="-mt-4 mb-4">
                {datos.personalizada ? (
                  <span className={`${TAG} badge-warning`}>Ficha personalizada · {fechaLarga(datos.ficha.actualizado)}</span>
                ) : (
                  <span className={`${TAG} badge-success`}>Valores de fábrica</span>
                )}
              </div>

              <section className={PANEL}><div className={PANEL_BODY}>
                <div className={PANEL_TITLE}>Aviario industrial</div>
                <p className={`${HINT} mb-6`}>Geometría común a 2 y 3 niveles.</p>
                <div className={FORM_GRID}>{AVIARIO.map((c) => campo(c))}</div>
              </div></section>

              <section className={PANEL}><div className={PANEL_BODY}>
                <div className={PANEL_TITLE}>Aviario por niveles</div>
                <p className={`${HINT} mb-6`}>
                  Superficies y equipamiento integrado de cada módulo. El equipamiento vacío queda
                  pendiente de medir en cada estudio.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {NIVELES.map((n) => (
                    <div key={n} className={SIDE}>
                      <div className={SIDE_TITLE}>{n === "nivel_2" ? "2 niveles" : "3 niveles"}</div>
                      <div className="flex flex-col gap-4">{NIVEL.map((c) => campo(c, `aviario.${n}.${c.k}`))}</div>
                    </div>
                  ))}
                </div>
              </div></section>

              <section className={PANEL}><div className={PANEL_BODY}>
                <div className={PANEL_TITLE}>Nidal colectivo A-Nida</div>
                <p className={`${HINT} mb-6`}>Los slots y el paso a pared se eligen en cada estudio.</p>
                <div className={FORM_GRID}>{NIDAL.map((c) => campo(c))}</div>
              </div></section>

              <section className={PANEL}><div className={PANEL_BODY}>
                <div className={PANEL_TITLE}>Capacidad del informe</div>
                <p className={`${HINT} mb-6`}>
                  El informe da la capacidad como intervalo: el mínimo se calcula con la superficie de
                  la nave reducida en este margen y el máximo con la superficie completa. Las
                  verificaciones se hacen siempre con la máxima. 0 = sin intervalo.
                </p>
                <div className={FORM_GRID}>{CALCULO.map((c) => campo(c))}</div>
              </div></section>

              <section className={BLOCK}>
                <h2 className={BLOCK_H}>
                  Normativa aplicada
                  <span className={BLOCK_NOTE}>solo lectura · fijada por la legislación</span>
                </h2>
                <div className={TABLE_WRAP}>
                  <table className={TABLE}>
                    <thead className={THEAD}><tr><th>Criterio</th><th>Límite</th><th>Fuente</th></tr></thead>
                    <tbody>
                      {datos.normativa.map((r) => (
                        <tr key={r.criterio}>
                          <td className={PARAM}>{r.criterio}</td>
                          <td>{r.valor}</td>
                          <td className={ART}>{r.fuente}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="sticky bottom-0 z-[5] mt-12 flex flex-wrap items-center gap-2 border-t border-base-300 bg-base-200 py-2 sm:gap-4 sm:py-4" role="region" aria-label="Guardar ficha">
                <div className="flex-[1_1_100%] text-sm sm:flex-[1_1_260px] sm:text-[0.9rem]" aria-live="polite">
                  {errorGuardar ? (
                    <span className="inline-flex items-center gap-1 text-error"><AlertTriangle size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" /> {errorGuardar}</span>
                  ) : aviso ? (
                    <span className="inline-flex items-center gap-1 text-success"><Check size={ICON_SM} strokeWidth={2.25} aria-hidden="true" /> {aviso}</span>
                  ) : hayErrores ? (
                    <span className="text-error">Corrige los campos marcados para guardar.</span>
                  ) : cambios ? (
                    <span>{cambios} {cambios === 1 ? "cambio sin guardar" : "cambios sin guardar"}</span>
                  ) : (
                    <span className={HINT}>Sin cambios. <Link href="/" className="link link-secondary">Volver al estudio</Link></span>
                  )}
                </div>
                <button type="button" className={`${BTN_GHOST} max-sm:flex-1`} onClick={restablecer}
                  disabled={ocupado || !datos.personalizada}>
                  <RotateCcw size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  <span className="hidden sm:inline">Valores de fábrica</span><span className="sm:hidden">Fábrica</span>
                </button>
                <button type="button" className={`${BTN_GHOST} max-sm:flex-1`} onClick={() => cargar(datos)}
                  disabled={ocupado || !cambios}>
                  <Undo2 size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  Descartar
                </button>
                <button type="button" className={`${BTN_PRIMARY} max-sm:flex-1`} onClick={guardar}
                  disabled={ocupado || !cambios || hayErrores}>
                  <Save size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  {ocupado ? "Guardando…" : <><span className="hidden sm:inline">Guardar cambios</span><span className="sm:hidden">Guardar</span></>}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
