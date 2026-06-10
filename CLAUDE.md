# CLAUDE.md — Agente de Ventas Aviario

## Propósito del Proyecto

Sistema conversacional de ventas para dos productos de avicultura de **Gómez y Crespo**, ambos orientados a la producción de huevos:

| Producto | Descripción |
|---|---|
| **Nidal Colectivo (A-Nida)** | Sistema de nidales colectivos para alojamiento en suelo/campero/ecológico |
| **Aviario Industrial** | Sistema de aviario multicuerpo para producción intensiva en altura |

El sistema guía al cliente a través de un cuestionario de intake, determina qué producto es óptimo para su explotación y genera una **propuesta comercial personalizada** con argumentario de ventas.

---

## Flujo del Algoritmo de Ventas

```
1. INTAKE (preguntas al cliente)
        ↓
2. DECISIÓN (Nidal vs Aviario + niveles + módulos)
        ↓
3. DIMENSIONAMIENTO (capacidad, superficie, densidad)
        ↓
4. ARGUMENTARIO + PROPUESTA COMERCIAL
```

---

## Fase 1 — Preguntas de Intake

El sistema recoge estos datos del cliente en orden lógico:

| # | Variable | Tipo | Por qué se necesita |
|---|---|---|---|
| 1 | Número de gallinas | Número | Base de todo el dimensionamiento |
| 2 | Sistema de producción | Enum: `suelo`, `campero`, `ecologico`, `jaulas` | Determina normativa aplicable y tipo de producto |
| 3 | Superficie de nave (m²) | Número | Calcula densidad y número de módulos que caben |
| 4 | Altura libre de nave (cm) | Número | Decide si el aviario es viable (requiere altura mínima) |
| 5 | ¿Tiene zona exterior? | Booleano | Relevante para campero/ecológico |
| 6 | Superficie exterior (m²) | Número (opcional) | Solo si tiene exterior |

---

## Fase 2 — Lógica de Decisión: Nidal vs Aviario

### Criterios para recomendar **Aviario**

- Sistema `suelo`, `campero` o `ecologico`
- Altura libre ≥ **300 cm** (mínimo para instalar 2 niveles)
- Densidad requerida > umbral sin aviario (más gallinas por m² de suelo)
- Cuando el cliente necesita maximizar capacidad sin ampliar nave

### Criterios para recomendar **Nidal Colectivo**

- Sistema `suelo`, `campero` o `ecologico`
- Altura libre < 290 cm (no cabe el aviario)
- Granja de tamaño medio donde la prioridad es el bienestar y acceso al nidal
- Como complemento al aviario cuando la nave ya tiene aviarios instalados

### Criterios de exclusión de Jaulas

- Sistema `jaulas` → aplicar normativa específica; los productos actuales no aplican directamente.

---

## Fase 3 — Dimensionamiento

### Nidal Colectivo A-Nida

| Parámetro | Valor |
|---|---|
| Capacidad | 144 gallinas / módulo |
| Huella cuerpo (planta) | 1.20 × 1.40 m = 1.68 m² |
| Huella slot acoplado | 1.20 × 3.00 m = 3.60 m² |
| Huella total por módulo | 5.28 m² |

**Cálculo de módulos necesarios:**
```
módulos = ceil(num_gallinas / 144)

# Densidad: solo descuenta el cuerpo físico del módulo (el slot es superficie habitable)
sup_cuerpo    = módulos × 1.68 m²   (1.20 × 1.40 m)
sup_efectiva  = superficie_nave − sup_cuerpo
densidad_real = num_gallinas / sup_efectiva

# Yacija: descuenta cuerpo + slot (el slot no computa como zona de yacija)
sup_slot         = módulos × 3.60 m²   (1.20 × 3.00 m)
sup_yacija_disp  = superficie_nave − sup_cuerpo − sup_slot
```

### Aviario Industrial (código 10007)

| Parámetro | Valor |
|---|---|
| Largo | 3.735 m |
| Ancho | 1.200 m |
| Huella | 4.482 m² |
| Altura total | 2.861 m |
| Pisos | 2 |
| Peso | 532 kg |
| Material | Acero galvanizado + polímeros |

**Número de niveles** se determina por la altura libre disponible:

| Altura libre | Niveles recomendados |
|---|---|
| 300–399 cm | 2 niveles |
| ≥ 400 cm | 3 niveles |

**Superficies reales por módulo (fuente: diseñador):**
```
Huella para encaje en nave : 3.735 × 1.20 = 4.482 m²

                        Sup. total    Sup. disponible (sin zona de puesta)
Módulo 2 plantas :      11.216 m²     9.1232 m²
Módulo 3 plantas :      19.328 m²     16.194 m²
```
La **superficie disponible** es la que computa para el cálculo de densidad normativa.
La **superficie total** incluye la zona de puesta (no cuenta para densidad).

**Cálculo de módulos y superficie útil:**
```
num_modulos_caben  = floor(superficie_nave / 4.482)
modulos_necesarios = ceil(num_gallinas / (densidad_max × sup_disp_por_modulo))
sup_disp_total     = num_modulos_caben × sup_disp_por_modulo
densidad_real      = num_gallinas / sup_disp_total
```

---

## Fase 4 — Argumentario y Propuesta Comercial

La propuesta generada incluye:

1. **Resumen ejecutivo** — situación del cliente en 2-3 líneas
2. **Producto recomendado** — con justificación basada en los datos del intake
3. **Dimensionamiento detallado** — número de módulos, superficie ocupada, densidad resultante
4. **Cumplimiento normativo** — verificación de densidades según bienestar animal (RD 3/2023 o aplicable)
5. **Argumentos de venta personalizados** — basados en las restricciones específicas del cliente (altura, superficie, sistema)
6. **Posibles objeciones y respuestas** — anticipadas según el perfil del cliente

### Argumentos clave por producto

**Nidal A-Nida:**
- Máximo bienestar animal → cumplimiento normativo asegurado
- Instalación modular → escalable sin obras
- Fácil mantenimiento y limpieza
- Reducción de huevos sucios/rotos en suelo

**Aviario Industrial:**
- Triplicar/cuadruplicar capacidad sin ampliar la nave
- Retorno de inversión rápido por densidad
- Cumple normativas de producción libre de jaulas (campero/ecológico)
- Estructura de acero galvanizado → vida útil > 20 años

---

## Stack Técnico

| Capa | Tecnología | Función |
|---|---|---|
| Frontend | Next.js 14+ (App Router, TypeScript) | Chat conversacional + visualización de propuesta |
| Backend | FastAPI (Python) | Lógica de negocio: intake, decisión, dimensionamiento |
| IA | Google Gemini (AI Studio) | Generación del argumentario y propuesta comercial |
| Vector DB | Qdrant | RAG sobre normativa (bienestar animal, densidades) |

### Endpoints principales

| Endpoint | Método | Descripción |
|---|---|---|
| `/recomendar` | POST | Recibe datos básicos → devuelve Nidal o Aviario + niveles |
| `/intake` | POST | Dimensionamiento completo + argumentario |
| `/calcular` | POST | Verificación normativa de la nave |

---

## Estructura de Archivos Relevantes

```
frontend/src/app/
├── page.tsx              # Página principal con chat de intake
├── propuesta/page.tsx    # Visualización de la propuesta comercial
├── actions.ts            # Server actions: calcularGranja, solicitarIntake, pedirRecomendacion
└── ChatInterface.tsx     # Componente conversacional

backend/
├── main.py               # Endpoints FastAPI
├── agentes/              # Lógica de agentes LangGraph
└── schemas/              # Modelos Pydantic

ingesta_datos/
├── cargar_leyes.py       # Carga normativa en Qdrant
└── ingestar_brief_aviario.py  # Carga brief de productos
```

---

## Variables de Entorno

Archivo `.env` en `backend/`:

```env
GOOGLE_API_KEY=tu_clave_google_ai_studio
QDRANT_URL=http://localhost:6333
COLLECTION_NAME=aviario_docs
```

---

## Reglas de Desarrollo

- **Los cálculos de dimensionamiento son fuente de verdad** — no redondear dimensiones de módulos. Usar los valores exactos de la sección de dimensionamiento arriba.
- **El argumentario lo genera Gemini** — no hardcodear textos de venta en el frontend.
- **El intake es conversacional** — el frontend no muestra un formulario plano; guía al usuario pregunta a pregunta.
- **La propuesta es un documento exportable** — el componente de propuesta debe poder imprimirse / exportarse a PDF.
