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
  ancho_nave_m?: number;
  largo_nave_m?: number;
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
  sup_minima_nidal?: number;
  gallinas_max_nidal?: number;
  sup_minima_avi?: number;
  gallinas_max_avi?: number;
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

export interface PuntoPareto {
  num_modulos: number;
  max_gallinas: number;
  sup_yacija_m2: number;
  yacija_pct: number;
  perdida_gallinas: number;
}

export interface LayoutAviario {
  orientacion: string;
  mods_por_fila: number;
  num_filas: number;
  descripcion: string;
}

export interface OpcionCapacidad {
  sistema: string;
  label: string;
  max_gallinas: number;
  num_modulos: number;
  densidad_real: number;
  densidad_max: number;
  viable: boolean;
  sup_disponible_m2?: number;
  sup_yacija_m2?: number;
  yacija_pct?: number;
  yacija_min_m2?: number;
  pareto?: PuntoPareto[];
  layout?: LayoutAviario;
}

export interface ResultadoCapacidad {
  opciones: OpcionCapacidad[];
  densidad_max: number;
}

export async function pedirCapacidad(datos: Omit<DatosRecomendacion, "num_gallinas"> & { num_gallinas: number }): Promise<ResultadoCapacidad> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${backendUrl}/capacidad`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datos }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
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

export interface Objecion {
  pregunta: string;
  respuesta: string;
}

export interface IntakeResponse {
  informe: InformeIntake;
  analisis_legal: string;
  argumentario_ventas: string;
  argumentos_producto: string[];
  objeciones: Objecion[];
}

// ── Layout nidal ─────────────────────────────────────────────────────────────

export interface FilaLayout {
  num_modulos: number;
  slot_izq: number;
  slot_der: number;
  pegada_pared_izq: boolean;
  pegada_pared_der: boolean;
}

export interface ResultadoLayoutNidal {
  viable: boolean;
  filas: FilaLayout[];
  total_modulos: number;
  max_gallinas: number;
  yacija_interior_m2: number;
  yacija_exterior_m2: number;
  cumple_normativa: boolean;
  necesita_exterior: boolean;
  deficit_yacija_m2: number;
  explicacion: string;
  error?: string | null;
}

export async function pedirLayoutNidal(params: {
  nave_m2: number;
  ancho_nave_m: number;
  largo_nave_m: number;
  gallinas: number;
  sistema: string;
  exterior_m2?: number;
}): Promise<ResultadoLayoutNidal> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8002";
  const res = await fetch(`${backendUrl}/layout-nidal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...params, exterior_m2: params.exterior_m2 ?? 0 }),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
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
