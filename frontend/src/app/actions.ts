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
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8003";
  const res = await fetch(`${backendUrl}/calcular`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datos }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
}

// ── Intake ──────────────────────────────────────────────────────────────────

export interface DatosIntake {
  num_gallinas: number;
  sistema: Sistema;
  superficie_nave_m2: number;
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
}

export async function solicitarIntake(datos: DatosIntake): Promise<IntakeResponse> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8003";
  const res = await fetch(`${backendUrl}/intake`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datos }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
}
