# Codebase — Agente Aviario (Gómez y Crespo)

Sistema conversacional de ventas para dos productos de avicultura:
- **Nidal Colectivo A-Nida** — sistemas de nidales para producción en suelo/campero/ecológico
- **Aviario Industrial** — sistema multicuerpo para producción intensiva en altura

**Stack:** Next.js 14 (App Router, TypeScript) · FastAPI (Python) · Google Gemini · Qdrant

---

## FLUJO DE LA APLICACIÓN

```
1. Usuario introduce: gallinas, superficie nave, altura nave, sistema (suelo/campero/ecológico/jaulas)
2. POST /factibilidad  → verifica si la densidad es legal, calcula módulos que caben
3. Preguntas dinámicas → mantenimiento, gestión estiércol, objetivo (solo si ambas opciones son viables)
4. POST /recomendar-con-respuestas → recomienda Nidal Colectivo o Aviario Industrial
5. POST /intake → dimensionamiento completo + análisis normativo (RAG) + argumentario (Gemini)
6. Propuesta comercial → página imprimible con requisitos + argumentario
```

---

## FRONTEND

### `frontend/src/app/actions.ts`
Server actions y tipos TypeScript. Define todos los tipos de datos e interfaces con el backend.

```typescript
"use server";

export type Sistema = "suelo" | "campero" | "ecologico" | "jaulas";
export type TipoNidal = "individual" | "colectivo" | "aviario";

export interface DatosCalculadora {
  num_gallinas: number;
  sistema: Sistema;
  superficie_nave_m2: number;
  altura_libre_cm: number;
  tipo_nidal: TipoNidal;
  num_nidales?: number;
  superficie_nidales_m2?: number;
  superficie_exterior_m2?: number;
  ancho_total_salidas_cm?: number;
}

export interface Verificacion {
  parametro: string;
  valor_real: number;
  valor_referencia: number;
  unidad: string;
  tipo_limite: "minimo" | "maximo";
  cumple: boolean;
  diferencia: number;
  articulo: string;
}

export interface RequisitoEquipamiento {
  nombre: string;
  valor_minimo: number;
  unidad: string;
  formula: string;
  articulo: string;
}

export interface InformeCalculadora {
  sistema: string;
  num_gallinas: number;
  verificaciones: Verificacion[];
  requisitos: RequisitoEquipamiento[];
  cumple_nave: boolean;
  num_fallos: number;
  consulta_rag: string;
}

export interface CalcularResponse {
  informe: InformeCalculadora;
  analisis_legal: string;
}

export async function calcularGranja(datos: DatosCalculadora): Promise<CalcularResponse> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${backendUrl}/calcular`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datos }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
}

// ── Intake ──────────────────────────────────────────────────────────────────

export type TipoZona = "nidal_colectivo" | "aviario";

export interface DatosRecomendacion {
  num_gallinas: number;
  sistema: Sistema;
  superficie_nave_m2: number;
  altura_nave_cm: number;
}

export interface Recomendacion {
  tipo_zona: TipoZona;
  niveles: number;
  razon: string;
}

// ── Factibilidad ─────────────────────────────────────────────────────────────

export interface ResultadoFactibilidad {
  factible: boolean;
  densidad_actual: number;
  densidad_max: number;
  densidad_min_aviario: number;
  niveles_posibles: number;
  modulos_caben: number;
  mensaje: string;
}

export interface Opcion {
  id: string;
  texto: string;
}

export interface Pregunta {
  id: string;
  texto: string;
  tipo: "opcion_unica" | "booleano";
  opciones: Opcion[];
}

export interface FactibilidadResponse {
  factibilidad: ResultadoFactibilidad;
  preguntas: Pregunta[];
}

export async function pedirFactibilidad(datos: DatosRecomendacion): Promise<FactibilidadResponse> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${backendUrl}/factibilidad`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datos }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
}

export async function pedirRecomendacionConRespuestas(
  datos: DatosRecomendacion,
  respuestas: Record<string, string>,
): Promise<Recomendacion> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${backendUrl}/recomendar-con-respuestas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datos, respuestas }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
}

export interface DatosIntake {
  num_gallinas: number;
  sistema: Sistema;
  superficie_nave_m2: number;
  altura_nave_cm: number;
  tipo_zona: TipoZona;
}

export async function pedirRecomendacion(datos: DatosRecomendacion): Promise<Recomendacion> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${backendUrl}/recomendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datos }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
}

export interface VerificacionNave {
  parametro: string;
  cumple: boolean;
  valor_real: number;
  valor_limite: number;
  unidad: string;
  tipo_limite: "minimo" | "maximo";
  articulo: string;
}

export interface RequisitoCalculado {
  nombre: string;
  valor_minimo: number;
  unidad: string;
  formula: string;
  articulo: string;
}

export interface InformeIntake {
  sistema: string;
  num_gallinas: number;
  verificaciones_nave: VerificacionNave[];
  requisitos: RequisitoCalculado[];
  cumple_nave: boolean;
  advertencias: string[];
  consulta_rag: string;
}

export interface IntakeResponse {
  informe: InformeIntake;
  analisis_legal: string;
  argumentario_ventas: string;
  argumentos_producto: string[];
}

export async function solicitarIntake(datos: DatosIntake): Promise<IntakeResponse> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${backendUrl}/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datos }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
}
```

---

### `frontend/src/app/ChatInterface.tsx`
Componente principal del flujo conversacional. 4 pasos: Proyecto → Análisis → Sistema → Informe.

```typescript
"use client";

import { useState } from "react";
import {
  solicitarIntake,
  pedirFactibilidad,
  pedirRecomendacionConRespuestas,
  type DatosIntake,
  type IntakeResponse,
  type Recomendacion,
  type FactibilidadResponse,
  type Pregunta,
  type TipoZona,
  type Sistema,
} from "./actions";

type Step = "main" | "loading_fact" | "factibilidad" | "loading_rec" | "recomendacion" | "loading" | "result";

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
      return `<span style="display:block;font-size:0.68rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#4F764D;margin-top:1.4rem;margin-bottom:0.35rem;font-family:'Montserrat',sans-serif">${label}</span>`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n/g, "<br/>");
}

export default function ChatInterface() {
  const [step, setStep]               = useState<Step>("main");
  const [mainV, setMain]              = useState<Record<string, string>>({});
  const [factResult, setFactResult]   = useState<FactibilidadResponse | null>(null);
  const [respuestas, setRespuestas]   = useState<Record<string, string>>({});
  const [preguntaIdx, setPreguntaIdx] = useState(0);
  const [rec, setRec]                 = useState<Recomendacion | null>(null);
  const [tipoZona, setTipoZona]       = useState<TipoZona | null>(null);
  const [resultado, setRes]           = useState<IntakeResponse | null>(null);
  const [animKey, setAnim]            = useState(0);

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

  function reset() { setMain({}); setFactResult(null); setRespuestas({}); setRec(null); setTipoZona(null); setRes(null); go("main"); }

  const stepIdx = { main: 0, loading_fact: 1, factibilidad: 1, loading_rec: 2, recomendacion: 2, loading: 3, result: 3 }[step];

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

          {/* PASO 1: Datos del proyecto */}
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

          {/* Loading factibilidad */}
          {step === "loading_fact" && (
            <div key={`loading_fact-${animKey}`} className="avi-step">
              <div className="avi-loading">
                <div className="avi-loading-dots"><span /><span /><span /></div>
                <p className="avi-loading-text">Analizando la nave...</p>
              </div>
            </div>
          )}

          {/* PASO 2: Factibilidad + preguntas dinámicas secuenciales */}
          {step === "factibilidad" && factResult && (
            <div key={`fact-${animKey}`} className="avi-step">
              <button className="avi-back" onClick={() => go("main")}>
                <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M5 1L1 5m0 0l4 4M1 5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Volver
              </button>

              {/* Resultado factibilidad */}
              <div style={{
                border: `1.5px solid ${factResult.factibilidad.factible ? "#4F764D" : "#BE1622"}`,
                borderRadius: 0, padding: "1.25rem 1.5rem", marginBottom: "1.5rem",
                background: factResult.factibilidad.factible ? "#edf3ec" : "#fdecea",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: factResult.factibilidad.factible ? "#4F764D" : "#BE1622",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {factResult.factibilidad.factible
                      ? <svg width="16" height="14" viewBox="0 0 16 14" fill="none"><path d="M1 7l5 5 9-9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 2l10 10M12 2L2 12" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                    }
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "1rem", color: "#3a3a3a", marginBottom: "0.4rem" }}>
                      {factResult.factibilidad.factible ? "Instalación viable" : "Instalación no viable"}
                    </div>
                    <p style={{ fontSize: "0.88rem", color: "#808285", lineHeight: 1.65, margin: 0 }}>
                      {factResult.factibilidad.mensaje}
                    </p>
                  </div>
                </div>

                {/* Densidades */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem", marginTop: "1rem" }}>
                  {[
                    { label: "Densidad con nidal", value: factResult.factibilidad.densidad_actual.toFixed(1), unit: "gal/m²", warn: factResult.factibilidad.densidad_actual > factResult.factibilidad.densidad_max },
                    { label: "Densidad con aviario", value: factResult.factibilidad.densidad_min_aviario.toFixed(1), unit: "gal/m²", warn: factResult.factibilidad.densidad_min_aviario > factResult.factibilidad.densidad_max },
                    { label: "Límite normativo", value: factResult.factibilidad.densidad_max.toFixed(0), unit: "gal/m²", warn: false },
                  ].map(s => (
                    <div key={s.label} style={{ background: "#fff", padding: "0.75rem 1rem", border: `1px solid ${s.warn ? "#f5b8b8" : "#e7e7e7"}` }}>
                      <div style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#bbb", marginBottom: "0.3rem" }}>{s.label}</div>
                      <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 800, fontSize: "1.4rem", color: s.warn ? "#BE1622" : "#3a3a3a", lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: "0.72rem", color: "#bbb", marginTop: "0.15rem" }}>{s.unit}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preguntas dinámicas — secuencial (una a una, auto-avance al seleccionar) */}
              {factResult.factibilidad.factible && factResult.preguntas.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  {factResult.preguntas.map((p: Pregunta, i: number) => {
                    if (i > preguntaIdx) return null;
                    const answered = respuestas[p.id];
                    const isActive = i === preguntaIdx;

                    // Pregunta respondida — estado compacto con botón "Cambiar"
                    if (answered && !isActive) {
                      const opcionTexto = p.opciones.find(o => o.id === answered)?.texto ?? answered;
                      return (
                        <div key={p.id} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          gap: "0.75rem", padding: "0.7rem 1rem", marginBottom: "0.5rem",
                          border: "1.5px solid #4F764D", background: "#edf3ec",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, minWidth: 0 }}>
                            <svg width="14" height="12" viewBox="0 0 14 12" fill="none"><path d="M1 6l4 4 8-8" stroke="#4F764D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            <span style={{ fontSize: "0.78rem", color: "#4F764D", fontWeight: 700, letterSpacing: "0.04em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opcionTexto}</span>
                          </div>
                          <button
                            onClick={() => {
                              const ids = factResult.preguntas.slice(i).map((q: Pregunta) => q.id);
                              setRespuestas(r => {
                                const next = { ...r };
                                ids.forEach((id: string) => delete next[id]);
                                return next;
                              });
                              setPreguntaIdx(i);
                            }}
                            style={{ background: "none", border: "none", color: "#4F764D", fontSize: "0.72rem", cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, padding: "0.2rem 0.4rem", flexShrink: 0 }}>
                            Cambiar
                          </button>
                        </div>
                      );
                    }

                    // Pregunta activa — opciones clickables (click = seleccionar + avanzar)
                    return (
                      <div key={p.id} className="avi-step" style={{ marginBottom: "0.5rem" }}>
                        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#3a3a3a", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.6rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ background: "#3a3a3a", color: "#fff", borderRadius: "50%", width: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", flexShrink: 0 }}>{i + 1}</span>
                          {p.texto}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                          {p.opciones.map(op => (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => {
                                setRespuestas(r => ({ ...r, [p.id]: op.id }));
                                setPreguntaIdx(i + 1);
                              }}
                              style={{
                                display: "flex", alignItems: "center", gap: "0.75rem",
                                padding: "0.8rem 1rem", textAlign: "left",
                                border: "1.5px solid #e7e7e7", background: "#fff",
                                cursor: "pointer", transition: "border-color 0.15s, background 0.15s",
                                fontFamily: "inherit", width: "100%",
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#4F764D"; (e.currentTarget as HTMLButtonElement).style.background = "#f5f9f5"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#e7e7e7"; (e.currentTarget as HTMLButtonElement).style.background = "#fff"; }}
                            >
                              <span style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #ccc", flexShrink: 0, display: "inline-block" }} />
                              <span style={{ fontSize: "0.9rem", color: "#3a3a3a" }}>{op.texto}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {factResult.factibilidad.factible ? (
                <div className="avi-btn-row">
                  {!factResult.preguntas.some((p: Pregunta) => !respuestas[p.id]) && (
                    <button className="avi-btn-primary avi-step" onClick={onFactibilidadSubmit}>
                      Ver recomendación
                      <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  )}
                </div>
              ) : (
                <div className="avi-btn-row">
                  <button className="avi-btn-primary" onClick={() => go("main")}>Modificar datos</button>
                </div>
              )}
            </div>
          )}

          {/* Loading recomendación */}
          {step === "loading_rec" && (
            <div key={`loading_rec-${animKey}`} className="avi-step">
              <div className="avi-loading">
                <div className="avi-loading-dots"><span /><span /><span /></div>
                <p className="avi-loading-text">Calculando recomendación...</p>
              </div>
            </div>
          )}

          {/* PASO 3: Recomendación zona de puesta */}
          {step === "recomendacion" && rec && (
            <div key={`rec-${animKey}`} className="avi-step">
              <button className="avi-back" onClick={() => go("main")}>← Volver</button>
              <div className="avi-badge">{sistemaLabel} · {mainV.gallinas} aves · {mainV.superficie_nave_m2} m²</div>
              <div className="avi-form-title">Sistema de puesta recomendado</div>
              <p className="avi-form-subtitle">Basado en la densidad y la altura disponible de la nave.</p>

              {/* Recomendación principal */}
              <div style={{ background: "#fff", border: "1px solid #e7e7e7", padding: "1.5rem 1.75rem", marginBottom: "1.5rem" }}>
                <div style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "1.1rem", fontWeight: 800, marginBottom: "0.25rem" }}>
                  {rec.tipo_zona === "aviario" ? `Aviario multinivel (${rec.niveles} niveles)` : "Nidal colectivo"}
                </div>
                <p style={{ fontSize: "0.9rem", color: "#808285", lineHeight: 1.65, margin: 0 }}>{rec.razon}</p>
              </div>

              {/* Comparativa Aviario vs Nidal */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.85rem", marginBottom: "1.5rem" }}>
                {/* ... tarjetas comparativas ... */}
              </div>

              <div className="avi-btn-row">
                <button className="avi-btn-primary" onClick={() => onConfirmar(tipoZona ?? rec.tipo_zona)}>
                  Confirmar y calcular requisitos
                </button>
              </div>
            </div>
          )}

          {/* PASO 4: Informe normativo */}
          {step === "result" && resultado && (
            <div key={`result-${animKey}`} className="avi-step">
              {/* Verificaciones, requisitos, advertencias, análisis legal */}
              {/* Botón "Ver propuesta comercial" → /propuesta (datos en localStorage) */}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
```

---

### `frontend/src/app/propuesta/page.tsx`
Página de propuesta comercial imprimible. Lee datos de `localStorage["gc_propuesta"]`.

```typescript
"use client";

import { useEffect, useState } from "react";

// Secciones: Header GYC · Status bar · Hero con stats · Equipamiento mínimo ·
//            Argumentos de producto · Argumentario de ventas (Gemini) · CTA · Footer

interface ProposalData {
  informe: InformeIntake;
  argumentario_ventas: string;   // generado por Gemini
  argumentos_producto: string[]; // extraídos del brief de Qdrant
  gallinas: string;
  sistema: string;               // "suelo" | "campero" | "ecologico" | "jaulas"
  superficie: string;
  altura: string;
  tipo_zona: "nidal_colectivo" | "aviario";
  niveles?: number;
}

// Tokens de color:
// --green-dark: #234926  (header, footer, títulos)
// --green-mid:  #4F764D  (acentos, tags)
// --gray-dark:  #575756
// --gray-mid:   #B2B2B2
// --gray-light: #F4F4F4

// Layout: max-width 1140px, tipografía Open Sans
// Secciones numeradas 01, 02 con tag verde oscuro

export default function PropuestaPage() { /* ... */ }
```

---

## BACKEND

### `backend/main.py`
Endpoints FastAPI.

```python
from fastapi import FastAPI
from agentes.intake import generar_informe, recomendar_zona, consulta_ventas, calcular_factibilidad, preguntas_dinamicas
from agentes.grafo import app as grafo  # LangGraph (RAG + Gemini)

@app.post("/factibilidad")
def factibilidad(request: FactibilidadRequest):
    fact = calcular_factibilidad(request.datos)
    preguntas = preguntas_dinamicas(fact)
    return FactibilidadResponse(factibilidad=fact, preguntas=preguntas)

@app.post("/recomendar")
def recomendar(request: RecomendacionRequest):
    return recomendar_zona(request.datos)

@app.post("/recomendar-con-respuestas")
def recomendar_con_respuestas(request: RecomendacionConRespuestasRequest):
    return recomendar_zona(request.datos, respuestas=request.respuestas)

@app.post("/intake")
def intake(request: IntakeRequest):
    informe = generar_informe(request.datos)
    resultado_rag   = grafo.invoke({"query": informe.consulta_rag})           # análisis normativo
    resultado_ventas = grafo.invoke({"query": consulta_ventas(...)})          # argumentario
    argumentos       = _argumentos_brief()                                    # brief de Qdrant
    return IntakeResponse(informe=informe, analisis_legal=..., argumentario_ventas=..., argumentos_producto=...)
```

---

### `backend/agentes/intake.py`
Núcleo de toda la lógica de negocio: dimensionamiento, factibilidad, recomendación, informe normativo.

```python
import math
from typing import Literal, Optional
from pydantic import BaseModel

Sistema = Literal["suelo", "campero", "ecologico", "jaulas"]
TipoZona = Literal["nidal_colectivo", "aviario"]

# ── Constantes físicas ────────────────────────────────────────────────────────

# Nidal colectivo A-Nida
# Cuerpo:     1.20 × 1.40 m = 1.68 m²  (descuenta de densidad y yacija)
# Slot:       1.20 × 3.00 m = 3.60 m²  (cuenta como habitable pero NO como yacija)
# Capacidad:  144 gallinas / módulo

# Aviario Industrial cod 10007
_AVI_HUELLA_M2 = round(3.735 * 1.20, 4)   # 4.482 m² — huella para encaje en nave
_AVI_SUP_TOTAL = {2: 15.270, 3: 19.328}   # m² superficie total por módulo
_AVI_SUP_DISP  = {2: 13.180, 3: 16.194}   # m² superficie disponible (excluye zona de puesta)

def _niveles_aviario(altura_cm: float) -> int:
    if altura_cm >= 400: return 3
    if altura_cm >= 300: return 2
    return 1  # aviario no viable

def _sup_util_aviario(nave_m2: float, niveles: int) -> tuple[int, float, float]:
    """Devuelve (num_modulos_caben, sup_disponible_total, sup_total_total)."""
    num_modulos = math.floor(nave_m2 / _AVI_HUELLA_M2)
    sup_disp  = round(num_modulos * _AVI_SUP_DISP[niveles], 2)
    sup_total = round(num_modulos * _AVI_SUP_TOTAL[niveles], 2)
    return num_modulos, sup_disp, sup_total

# ── Modelos Pydantic ──────────────────────────────────────────────────────────

class DatosBasicos(BaseModel):
    num_gallinas: int
    sistema: Sistema
    superficie_nave_m2: float
    altura_nave_cm: float

DatosRecomendacion = DatosBasicos  # alias

class DatosIntake(BaseModel):
    num_gallinas: int
    sistema: Sistema
    superficie_nave_m2: float
    altura_nave_cm: float
    tipo_zona: TipoZona

class Recomendacion(BaseModel):
    tipo_zona: TipoZona
    niveles: int
    razon: str

class ResultadoFactibilidad(BaseModel):
    factible: bool
    densidad_actual: float        # densidad con nidal
    densidad_max: float           # límite legal
    densidad_min_aviario: float   # densidad con máximo aviario posible
    niveles_posibles: int
    modulos_caben: int
    mensaje: str

class Opcion(BaseModel):
    id: str
    texto: str

class Pregunta(BaseModel):
    id: str
    texto: str
    tipo: Literal["opcion_unica", "booleano"]
    opciones: list[Opcion]

# ── Factibilidad ──────────────────────────────────────────────────────────────

def calcular_factibilidad(datos: DatosBasicos) -> ResultadoFactibilidad:
    densidad_max = 6.0 if datos.sistema == "ecologico" else 9.0
    niveles = _niveles_aviario(datos.altura_nave_cm)

    num_mod_nidal = math.ceil(datos.num_gallinas / 144)
    sup_cuerpo = round(num_mod_nidal * 1.20 * 1.40, 2)
    sup_nidal = max(datos.superficie_nave_m2 - sup_cuerpo, 0.01)
    densidad_nidal = round(datos.num_gallinas / sup_nidal, 2)

    if niveles >= 2:
        num_mod_avi, sup_disp, _ = _sup_util_aviario(datos.superficie_nave_m2, niveles)
        densidad_avi = round(datos.num_gallinas / sup_disp, 2) if sup_disp > 0 else float("inf")
    else:
        num_mod_avi = 0
        densidad_avi = densidad_nidal

    factible = densidad_avi <= densidad_max
    # mensaje descriptivo según caso...
    return ResultadoFactibilidad(...)

# ── Preguntas dinámicas ───────────────────────────────────────────────────────
# Solo se generan cuando AMBAS opciones son técnicamente viables.

def preguntas_dinamicas(factibilidad: ResultadoFactibilidad) -> list[Pregunta]:
    nidal_viable   = factibilidad.densidad_actual <= factibilidad.densidad_max
    aviario_viable = (factibilidad.niveles_posibles >= 2
                      and factibilidad.densidad_min_aviario <= factibilidad.densidad_max)

    if not (nidal_viable and aviario_viable):
        return []  # solo una opción → recomendación directa

    return [
        Pregunta(
            id="gestion_estiercol",
            texto="El aviario exige retirar el estiércol cada 2-3 días. ¿Dispone de sistema o personal?",
            tipo="booleano",
            opciones=[
                Opcion(id="si", texto="Sí, tenemos capacidad para gestionarlo"),
                Opcion(id="no", texto="No, preferimos una limpieza menos frecuente"),
            ],
        ),
        Pregunta(
            id="mantenimiento",
            texto="¿Cómo valora la carga de mantenimiento y limpieza de la instalación?",
            tipo="opcion_unica",
            opciones=[
                Opcion(id="minima",  texto="Priorizo un mantenimiento sencillo y poco frecuente"),
                Opcion(id="acepto",  texto="Acepto mayor dedicación si mejora la rentabilidad"),
            ],
        ),
        Pregunta(
            id="objetivo",
            texto="¿Cuál es su prioridad principal para esta instalación?",
            tipo="opcion_unica",
            opciones=[
                Opcion(id="maximizar_produccion", texto="Maximizar el número de gallinas por m²"),
                Opcion(id="bienestar",            texto="Priorizar el bienestar animal y la calidad del huevo"),
                Opcion(id="minima_inversion",     texto="Minimizar la inversión inicial"),
            ],
        ),
    ]

# ── Recomendación ─────────────────────────────────────────────────────────────

def recomendar_zona(datos: DatosRecomendacion, respuestas: dict[str, str] | None = None) -> Recomendacion:
    respuestas = respuestas or {}
    # ...cálculos de densidad...

    if niveles_posibles < 2:
        return Recomendacion(tipo_zona="nidal_colectivo", niveles=1, razon="Altura insuficiente para aviario")

    if densidad_bruta > densidad_max or densidad_nidal > densidad_max:
        return Recomendacion(tipo_zona="aviario", niveles=niveles_posibles, razon="Densidad excede límite legal con nidal")

    # Ambas viables → tiebreaking por respuestas
    gestion  = respuestas.get("gestion_estiercol", "")
    mant     = respuestas.get("mantenimiento", "")
    objetivo = respuestas.get("objetivo", "")

    if gestion == "no":
        return Recomendacion(tipo_zona="nidal_colectivo", ...)  # bloqueo duro

    score = 0
    if objetivo == "maximizar_produccion": score += 2
    if objetivo in ("bienestar", "minima_inversion"): score -= 1
    if mant == "acepto": score += 1
    if mant == "minima": score -= 1

    return Recomendacion(tipo_zona="aviario" if score > 0 else "nidal_colectivo", ...)

# ── Informe normativo ─────────────────────────────────────────────────────────
# generar_informe() → InformeIntake con verificaciones, requisitos, advertencias
# Normativa: RD 3/2002, Directiva 1999/74/CE, RD 637/2021, Regl. UE 2018/848
# Densidades: 9 gal/m² suelo/campero · 6 gal/m² ecológico
```

---

### `backend/schemas/pydantic_models.py`

```python
from pydantic import BaseModel
from agentes.intake import DatosBasicos, DatosIntake, InformeIntake, Recomendacion, ResultadoFactibilidad, Pregunta

class FactibilidadRequest(BaseModel):
    datos: DatosBasicos

class FactibilidadResponse(BaseModel):
    factibilidad: ResultadoFactibilidad
    preguntas: list[Pregunta]

class RecomendacionConRespuestasRequest(BaseModel):
    datos: DatosBasicos
    respuestas: dict[str, str]

class IntakeRequest(BaseModel):
    datos: DatosIntake

class IntakeResponse(BaseModel):
    informe: InformeIntake
    analisis_legal: str
    argumentario_ventas: str
    argumentos_producto: list[str]
```

---

## BRAND & DISEÑO

**Colores GYC:**
- Verde oscuro: `#234926` / `#4F764D` (cabeceras, acentos)
- Gris texto: `#808285` / `#575756`
- Fondo: `#FFFFFF` / `#F5F5F5`
- Error/fallo: `#BE1622`

**Tipografías:**
- Títulos: `Montserrat 800` (chat) / `Open Sans 800` (propuesta)
- Cuerpo: `Source Sans 3 300/400/600` (chat) / `Open Sans 300/400/600` (propuesta)

**Patrones de UI (ChatInterface):**
- Bordes: `border-radius: 0` (estilo angular)
- Botón primario: fondo verde `#4F764D`, texto blanco, sin borde, sin radius
- Inputs: borde `#e7e7e7`, focus con sombra `rgba(79,118,77,0.1)`
- Progress bar: círculos numerados → done (verde) / active (oscuro) / pending (gris)
- Animación de entrada: `stepIn` → `translateY(8px)` + fade, 0.24s ease

**Patrones de UI (Propuesta):**
- Header: fondo `#234926`, logo blanco
- Status bar: verde o rojo según cumplimiento normativo
- Stats: grid 4 columnas con borde `#E0E0E0`, línea verde animada al hover
- Secciones numeradas: tag `#234926` + título uppercase
- Equipamiento: grid auto-fill `minmax(230px, 1fr)`, indicador lateral verde en hover
- Argumentario: fondo `#234926`, sidebar + cuerpo en 2 columnas
