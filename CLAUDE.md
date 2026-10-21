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
| `/ficha` | GET / PUT | Ficha técnica (medidas y equipamiento por módulo) + normativa en solo lectura |
| `/ficha/restablecer` | POST | Vuelve a los valores de fábrica |
| `/health` | GET | Health check |

---

## Estructura de Archivos Relevantes

```
frontend/src/app/
├── page.tsx                  # Estudio de nave
├── ficha/page.tsx            # Ficha técnica editable
├── Cabecera.tsx              # Cabecera con pestañas Estudio / Ficha técnica
├── estudio-styles.ts         # CSS de la pantalla (incluye estilos de impresión/PDF)
├── actions.ts                # Server action pedirEstudio + tipos
└── api/
    ├── plano-config/         # Proxy a /plano-config
    └── plano-nidal-dxf/      # Proxy a /plano-nidal-dxf

backend/
├── main.py                   # Endpoints FastAPI
└── agentes/
    ├── estudio.py            # Motor de cálculo; constantes de producto = valores de fábrica de la ficha
    ├── ficha.py              # Ficha técnica: carga/guarda backend/datos/ficha_tecnica.json y la aplica
    ├── aforo.py              # Aforo por equipamiento medido
    ├── plano_agent.py        # Generación del plano SVG
    └── dxf_nidal.py          # Exportación DXF del nidal

test_calculos_capacidad.py    # Regresión de aforo y coherencia estudio ↔ plano
test_nidal_calculo_modelo.py  # Modelo de cálculo del nidal
test_ficha_tecnica.py         # La ficha editada gobierna estudio y plano
```

Tests: `python -m pytest test_calculos_capacidad.py test_nidal_calculo_modelo.py test_ficha_tecnica.py`

### Despliegue

Esta rama (`feat/herramienta-interna`) **convive** en el servidor con la app con IA de `master`;
no se fusiona en `master` (eso sustituiría la app anterior).

- Un push a `feat/herramienta-interna` lanza `.github/workflows/deploy-herramienta.yml`: tests y
  build en GitHub y, si pasan, el runner self-hosted actualiza su propia copia del repo en
  `<padre de DEPLOY_PATH>/herramienta-interna` y hace `docker compose up -d --build`.
- `docker-compose.yml` usa proyecto `herramienta-interna` y contenedores `*_herramienta`; el
  frontend se publica en `HERRAMIENTA_PORT` (por defecto 3001) y el backend no publica puerto.
- No usar los puertos de la app de master (3000, 8082, 6333-6334) ni el 8080 (code-server).

---

## Reglas de Desarrollo

- **Los cálculos de dimensionamiento son fuente de verdad** — no redondear dimensiones de módulos.
  Los valores de fábrica viven en `backend/agentes/estudio.py`; la ficha técnica editada
  (`/ficha`, guardada en `backend/datos/`) los sobrescribe en tiempo de ejecución. Por eso
  plano y DXF leen `agentes.estudio.X` en tiempo de llamada: nunca copiar esas constantes al
  importar ni usarlas como valor por defecto de un argumento o campo Pydantic.
- **Nada de medidas escritas a mano en el frontend** — lo que dependa del módulo se lee de la ficha.
- **Estudio y plano deben coincidir** — módulos, gallinas, yacija y densidad del `/estudio`
  tienen que ser idénticos a las métricas de `/plano-config` (lo comprueban los tests).
- **El estudio es un documento exportable** — la pantalla debe poder imprimirse / exportarse a PDF.
- **Sin dependencias de IA** — no reintroducir Gemini, Qdrant ni LangChain en esta rama.
- **Diseño** — sigue `design-system/estudio-de-nave/MASTER.md` (generado con el plugin ui-ux-pro-max):
  paleta navy + emerald, Outfit / Work Sans, iconos Lucide. Los tokens viven en `estudio-styles.ts`.

---

## Estética del frontend

Estas pautas **complementan** la regla de diseño anterior: el sistema de
`design-system/estudio-de-nave/MASTER.md` (paleta, tipografías, tokens, iconos Lucide,
contraste ≥ 4,5:1) sigue siendo la base y manda en caso de conflicto. Las pautas de abajo
se aplican en lo que el sistema no fija: fondos con atmósfera y profundidad, una carga de
página bien orquestada, micro-interacciones y evitar patrones genéricos. Toda animación
respeta `prefers-reduced-motion` y nada decorativo debe salir en la exportación a PDF.

<frontend_aesthetics>
You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!
</frontend_aesthetics>
