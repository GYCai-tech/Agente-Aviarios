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
import { ESTUDIO_CSS } from "../estudio-styles";
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
  { k: "comedero_lineal_m", label: "Comedero lineal por módulo", unidad: "m", cero: true, opcional: true },
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
      <div className="est-field" key={k}>
        <label className="est-label" htmlFor={id}>
          {c.label}
          {modificado && <span className="ft-mod" title="Distinto del valor de fábrica">modificado</span>}
        </label>
        <div className="est-input-wrap">
          <input
            id={id}
            className={`est-input est-input--unit${err ? " is-err" : ""}`}
            type="text"
            inputMode={c.entero ? "numeric" : "decimal"}
            value={v}
            placeholder={c.opcional ? "Sin dato" : undefined}
            aria-invalid={!!err}
            aria-describedby={`${id}-ayuda`}
            onChange={(e) => set(k, e.target.value)}
          />
          <span className="est-unit">{c.unidad}</span>
        </div>
        <span id={`${id}-ayuda`} className={err ? "ft-err" : "est-hint"}>
          {err ?? (modificado
            ? `Fábrica: ${fabrica[k] || "sin dato"}${c.ayuda ? ` · ${c.ayuda}` : ""}`
            : c.ayuda ?? (c.opcional && !v ? "Vacío = pendiente de medir en cada estudio" : ""))}
        </span>
      </div>
    );
  }

  return (
    <>
      <style>{ESTUDIO_CSS + FICHA_CSS}</style>
      <Cabecera activa="ficha" />

      <main className="est-main">
        <div className="est-anim">
          <div className="est-eyebrow">Configuración</div>
          <h1 className="est-h">Ficha técnica</h1>
          <p className="est-sub">
            Medidas y equipamiento por módulo que usa el cálculo de capacidad y el plano,
            y el margen de incertidumbre del informe.
            Los cambios se aplican a todos los estudios nuevos. Si en un estudio se introduce
            un equipamiento medido, ese valor prevalece sobre la ficha.
          </p>

          {errorCarga && <div className="est-err" role="alert">{errorCarga}</div>}

          {datos && (
            <>
              <div className="ft-status">
                {datos.personalizada ? (
                  <span className="est-tag is-warn">Ficha personalizada · {fechaLarga(datos.ficha.actualizado)}</span>
                ) : (
                  <span className="est-tag is-ok">Valores de fábrica</span>
                )}
              </div>

              <section className="est-panel">
                <div className="est-panel-title">Aviario industrial</div>
                <p className="est-hint">Geometría común a 2 y 3 niveles.</p>
                <div className="est-form-grid">{AVIARIO.map((c) => campo(c))}</div>
              </section>

              <section className="est-panel">
                <div className="est-panel-title">Aviario por niveles</div>
                <p className="est-hint">
                  Superficies y equipamiento integrado de cada módulo. El equipamiento vacío queda
                  pendiente de medir en cada estudio.
                </p>
                <div className="ft-niveles">
                  {NIVELES.map((n) => (
                    <div key={n} className="est-side">
                      <div className="est-side-title">{n === "nivel_2" ? "2 niveles" : "3 niveles"}</div>
                      <div className="ft-col">{NIVEL.map((c) => campo(c, `aviario.${n}.${c.k}`))}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="est-panel">
                <div className="est-panel-title">Nidal colectivo A-Nida</div>
                <p className="est-hint">Los slots y el paso a pared se eligen en cada estudio.</p>
                <div className="est-form-grid">{NIDAL.map((c) => campo(c))}</div>
              </section>

              <section className="est-panel">
                <div className="est-panel-title">Capacidad del informe</div>
                <p className="est-hint">
                  El informe da la capacidad como intervalo: el mínimo se calcula con la superficie de
                  la nave reducida en este margen y el máximo con la superficie completa. Las
                  verificaciones se hacen siempre con la máxima. 0 = sin intervalo.
                </p>
                <div className="est-form-grid">{CALCULO.map((c) => campo(c))}</div>
              </section>

              <section className="est-block">
                <h2 className="est-block-h">
                  Normativa aplicada
                  <span>solo lectura · fijada por la legislación</span>
                </h2>
                <div className="est-table-wrap">
                  <table className="est-table">
                    <thead><tr><th>Criterio</th><th>Límite</th><th>Fuente</th></tr></thead>
                    <tbody>
                      {datos.normativa.map((r) => (
                        <tr key={r.criterio}>
                          <td className="est-param">{r.criterio}</td>
                          <td>{r.valor}</td>
                          <td className="est-art">{r.fuente}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="ft-bar" role="region" aria-label="Guardar ficha">
                <div className="ft-bar-msg" aria-live="polite">
                  {errorGuardar ? (
                    <span className="ft-err"><AlertTriangle size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" /> {errorGuardar}</span>
                  ) : aviso ? (
                    <span className="ft-ok"><Check size={ICON_SM} strokeWidth={2.25} aria-hidden="true" /> {aviso}</span>
                  ) : hayErrores ? (
                    <span className="ft-err">Corrige los campos marcados para guardar.</span>
                  ) : cambios ? (
                    <span>{cambios} {cambios === 1 ? "cambio sin guardar" : "cambios sin guardar"}</span>
                  ) : (
                    <span className="est-hint">Sin cambios. <Link href="/">Volver al estudio</Link></span>
                  )}
                </div>
                <button type="button" className="est-btn est-btn--ghost" onClick={restablecer}
                  disabled={ocupado || !datos.personalizada}>
                  <RotateCcw size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  <span className="ft-largo">Valores de fábrica</span><span className="ft-corto">Fábrica</span>
                </button>
                <button type="button" className="est-btn est-btn--ghost" onClick={() => cargar(datos)}
                  disabled={ocupado || !cambios}>
                  <Undo2 size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  Descartar
                </button>
                <button type="button" className="est-btn est-btn--primary" onClick={guardar}
                  disabled={ocupado || !cambios || hayErrores}>
                  <Save size={ICON_SM} strokeWidth={ICON_STROKE} aria-hidden="true" />
                  {ocupado ? "Guardando…" : <><span className="ft-largo">Guardar cambios</span><span className="ft-corto">Guardar</span></>}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}

const FICHA_CSS = `
  .ft-status { margin: calc(-1 * var(--space-md)) 0 var(--space-md); }
  .ft-niveles { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
  @media (max-width: 700px) { .ft-niveles { grid-template-columns: 1fr; } }
  .ft-col { display: flex; flex-direction: column; gap: var(--space-md); }
  .ft-mod {
    margin-left: var(--space-sm); font-family: var(--font-body); font-size: 0.7rem; font-weight: 600;
    color: var(--color-warn-text); background: var(--color-warn-bg); border-radius: 999px; padding: 1px 8px;
  }
  .est-input.is-err { border-color: var(--color-fail-text); }
  .est-input.is-err:focus { box-shadow: 0 0 0 3px #B91C1C20; }
  .ft-err { display: inline-flex; align-items: center; gap: var(--space-xs); font-size: 0.85rem; color: var(--color-fail-text); }
  .ft-ok  { display: inline-flex; align-items: center; gap: var(--space-xs); color: var(--color-ok-text); }
  .ft-bar {
    position: sticky; bottom: 0; z-index: 5; display: flex; flex-wrap: wrap; align-items: center;
    gap: var(--space-md); margin-top: var(--space-2xl); padding: var(--space-md) 0;
    background: var(--color-background); border-top: 1px solid var(--color-border);
  }
  .ft-bar-msg { flex: 1 1 260px; font-size: 0.9rem; color: var(--color-foreground); }
  .ft-bar-msg a { color: var(--color-secondary); }
  .ft-corto { display: none; }
  @media (max-width: 640px) {
    .ft-bar { gap: var(--space-sm); padding: var(--space-sm) 0; }
    .ft-bar-msg { flex-basis: 100%; font-size: 0.85rem; }
    .ft-bar .est-btn { flex: 1 1 0; padding: 8px 10px; font-size: 0.9rem; min-height: 44px; }
    .ft-largo { display: none; }
    .ft-corto { display: inline; }
  }
`;
