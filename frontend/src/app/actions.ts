"use server";

export type Sistema = "suelo" | "campero" | "ecologico" | "jaulas";
export type TipoZona = "nidal_colectivo" | "aviario";

export interface RequisitoCalculado {
  nombre: string;
  valor_minimo: number;
  unidad: string;
  formula: string;
  articulo: string;
}

// ── Estudio técnico de nave ──────────────────────────────────────────────────

export interface EquipamientoMedido {
  perchas_m?: number;
  nidal_util_m2?: number;
  comedero_lineal_accesible_m?: number;
  bebederos_pezon_copa?: number;
  salidas_ancho_util_m?: number;
}

export interface AforoResultado {
  gallinas_max: number;
  limitantes: string[];
  limites: { criterio: string; gallinas: number; formula: string; fuente: string }[];
  pendientes: string[];
  mediciones_completas: boolean;
}

export interface EstudioRequest {
  equipamiento?: EquipamientoMedido;
  tipo_zona: TipoZona;
  sistema: Sistema;
  ancho_nave_m: number;
  largo_nave_m: number;
  altura_nave_cm: number;
  /** Anexo informativo: no aumenta capacidad sin validación específica. */
  sup_parque_m2?: number;
  /** Zona de pasto (campero/ecologico): solo se verifica contra 4 m2/gallina */
  sup_pasto_m2?: number;
  slot_izq_m?: number;
  slot_der_m?: number;
  /** Paso libre exigido entre el borde del slat y cada pared (m). 0 = pegado a la pared */
  paso_izq_m?: number;
  paso_der_m?: number;
  niveles?: number | null;
  num_modulos?: number | null;
  num_filas?: number | null;
}

export interface VerificacionEstudio {
  parametro: string;
  valor_real: number;
  valor_limite: number;
  unidad: string;
  tipo_limite: "minimo" | "maximo";
  cumple: boolean;
  articulo: string;
  detalle: string;
}

export interface EscenarioEstudio {
  num_modulos: number;
  num_filas: number;
  gallinas: number;
  densidad: number;
  sup_yacija_m2: number;
  yacija_pct: number;
  cumple_yacija: boolean;
  cumple: boolean;
  limitante: string;
  es_optimo: boolean;
}

export interface EstudioResponse {
  geometria_nidal?: { paso_lateral_m: number } | null;
  aforo?: AforoResultado | null;
  calculo_provisional: boolean;
  tipo_zona: string;
  sistema: string;
  ancho_nave_m: number;
  largo_nave_m: number;
  altura_nave_cm: number;
  superficie_nave_m2: number;
  sup_parque_m2: number;
  sup_pasto_m2: number;
  viable: boolean;
  motivo: string;
  num_modulos: number;
  num_filas: number;
  mods_por_fila: number;
  gallinas_max: number;
  densidad_real: number;
  densidad_max: number;
  limitante: string;
  sup_disponible_m2: number;
  sup_total_m2: number;
  sup_yacija_m2: number;
  yacija_min_m2: number;
  yacija_pct: number;
  huella_modulos_m2: number;
  slot_izq_m: number;
  slot_der_m: number;
  prof_total_m: number;
  paso_izq_m: number;
  paso_der_m: number;
  holgura_m: number;
  ancho_nave_minimo_m: number;
  niveles: number;
  descripcion_layout: string;
  max_modulos_fisicos: number;
  verificaciones: VerificacionEstudio[];
  requisitos: RequisitoCalculado[];
  escenarios: EscenarioEstudio[];
  notas: string[];
}

export async function pedirEstudio(req: EstudioRequest): Promise<EstudioResponse> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  const res = await fetch(`${backendUrl}/estudio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Backend error: ${res.status}`);
  return res.json();
}
