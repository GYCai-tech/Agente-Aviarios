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

export interface ParametroCalculo {
  grupo: string;
  nombre: string;
  valor: string;
  origen: string;
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
  /** Nidal: local técnico (motor + mesa de recogida) dentro de la nave */
  local_dentro?: boolean;
  /** Nidal: largo libre mínimo al fondo, tensor incluido; null = largo del tensor */
  libre_fondo_m?: number | null;
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
  local_dentro: boolean;
  sup_local_m2: number;
  libre_fondo_m: number;
  niveles: number;
  descripcion_layout: string;
  max_modulos_fisicos: number;
  verificaciones: VerificacionEstudio[];
  requisitos: RequisitoCalculado[];
  escenarios: EscenarioEstudio[];
  notas: string[];
  parametros: ParametroCalculo[];
  equipamiento: EquipoPrevisto[];
  condiciones: Condicion[];
}

/** Requisito del régimen de producción que no se deduce de las medidas de la nave. */
export interface Condicion {
  nombre: string;
  detalle: string;
  fuente: string;
}

/** Equipamiento de la instalación frente al mínimo normativo (versión cliente). */
export interface EquipoPrevisto {
  nombre: string;
  unidad: string;
  previsto: number;
  minimo: number;
  origen: string;
  cumple: boolean;
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

// ── Ficha técnica (medidas y equipamiento por módulo) ───────────────────────

export interface NivelAviario {
  altura_min_cm: number;
  sup_total_m2: number;
  sup_disponible_m2: number;
  perchas_m: number | null;
  nidal_util_m2: number | null;
  comedero_lineal_m: number | null;
  bebederos: number | null;
}

export interface FichaTecnica {
  aviario: {
    largo_modulo_m: number;
    fondo_modulo_m: number;
    capacidad_gallinas: number;
    pasillo_m: number;
    zona_equipos_frontal_m: number;
    zona_equipos_fondo_m: number;
    nivel_2: NivelAviario;
    nivel_3: NivelAviario;
  };
  nidal: {
    largo_modulo_m: number;
    fondo_cuerpo_m: number;
    capacidad_gallinas: number;
    nidal_util_m2: number;
    tensor_m: number;
    local_tecnico_m: number;
  };
  actualizado?: string | null;
}

export interface FichaRespuesta {
  ficha: FichaTecnica;
  por_defecto: FichaTecnica;
  personalizada: boolean;
  normativa: { criterio: string; valor: string; fuente: string }[];
}

export type ResultadoFicha = { ok: true; data: FichaRespuesta } | { ok: false; error: string };

// Devuelve el error como dato: Next.js oculta en producción el mensaje de los
// errores lanzados desde una server action, y aquí el motivo importa al usuario.
async function llamarFicha(ruta: string, init?: RequestInit): Promise<ResultadoFicha> {
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${backendUrl}${ruta}`, { cache: "no-store", ...init });
    if (!res.ok) {
      const detalle = await res.json().catch(() => null);
      const error = Array.isArray(detalle?.detail)
        ? detalle.detail
            .map((d: { loc?: (string | number)[]; msg: string }) =>
              `${(d.loc ?? []).slice(1).join(" › ")}: ${d.msg.replace(/^Value error, /, "")}`)
            .join(" · ")
        : `Error del servidor (${res.status})`;
      return { ok: false, error };
    }
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor de cálculo." };
  }
}

export async function obtenerFicha(): Promise<ResultadoFicha> {
  return llamarFicha("/ficha");
}

export async function guardarFicha(ficha: FichaTecnica): Promise<ResultadoFicha> {
  return llamarFicha("/ficha", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ficha),
  });
}

export async function restablecerFicha(): Promise<ResultadoFicha> {
  return llamarFicha("/ficha/restablecer", { method: "POST" });
}
