# CLAUDE.md — Estudio de nave (Gómez y Crespo)

## Propósito del Proyecto

Herramienta **interna** de Gómez y Crespo para preparar propuestas comerciales. El comercial
introduce los datos de la nave del cliente y obtiene **cálculos de capacidad y cumplimiento
normativo + plano** de la instalación. No hay IA, RAG ni chat: todo es cálculo determinista.

| Producto | Descripción |
|---|---|
| **Nidal Colectivo (A-Nida)** | Sistema de nidales colectivos para alojamiento en suelo/campero/ecológico |
| **Aviario Industrial** | Sistema de aviario multicuerpo para producción intensiva en altura |

---

## Flujo

```
1. MÓDULO   → el comercial elige Nidal A-Nida o Aviario
2. NAVE     → sistema, ancho, largo, altura, parque/pasto, slots, niveles, equipamiento medido
3. ESTUDIO  → capacidad, densidad, yacija, verificaciones normativas, escenarios
4. PLANO    → SVG en pantalla · DXF editable (nidal) · exportación a PDF (imprimir)
```

---

## Dimensionamiento

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
Módulo 2 niveles :      7.638 m²      5.5452 m²
Módulo 3 niveles :      11.216 m²     9.1232 m²
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

## Stack Técnico

| Capa | Tecnología | Función |
|---|---|---|
| Frontend | Next.js 16 (App Router, TypeScript) | Formulario por pasos + resultado del estudio + plano |
| Backend | FastAPI (Python) | Cálculo de capacidad, aforo, plano SVG y DXF |

### Endpoints

| Endpoint | Método | Descripción |
|---|---|---|
| `/estudio` | POST | Estudio técnico de la nave con el módulo elegido |
| `/aforo-medido` | POST | Aforo a partir de equipamiento medido |
| `/plano-config` | POST | Plano SVG + métricas a partir de una configuración |
| `/plano-nidal-dxf` | POST | DXF editable del nidal centrado |
| `/health` | GET | Health check |

---

## Estructura de Archivos Relevantes

```
frontend/src/app/
├── page.tsx                  # Estudio de nave (única pantalla)
├── estudio-styles.ts         # CSS de la pantalla (incluye estilos de impresión/PDF)
├── actions.ts                # Server action pedirEstudio + tipos
└── api/
    ├── plano-config/         # Proxy a /plano-config
    └── plano-nidal-dxf/      # Proxy a /plano-nidal-dxf

backend/
├── main.py                   # Endpoints FastAPI
└── agentes/
    ├── estudio.py            # Fuente de verdad: constantes físicas, límites normativos, capacidad
    ├── aforo.py              # Aforo por equipamiento medido
    ├── plano_agent.py        # Generación del plano SVG
    └── dxf_nidal.py          # Exportación DXF del nidal

test_calculos_capacidad.py    # Regresión de aforo y coherencia estudio ↔ plano
test_nidal_calculo_modelo.py  # Modelo de cálculo del nidal
```

Tests: `python -m pytest test_calculos_capacidad.py test_nidal_calculo_modelo.py`

---

## Reglas de Desarrollo

- **Los cálculos de dimensionamiento son fuente de verdad** — no redondear dimensiones de módulos.
  Las constantes viven en `backend/agentes/estudio.py`; el resto de módulos las importan de ahí.
- **Estudio y plano deben coincidir** — módulos, gallinas, yacija y densidad del `/estudio`
  tienen que ser idénticos a las métricas de `/plano-config` (lo comprueban los tests).
- **El estudio es un documento exportable** — la pantalla debe poder imprimirse / exportarse a PDF.
- **Sin dependencias de IA** — no reintroducir Gemini, Qdrant ni LangChain en esta rama.
