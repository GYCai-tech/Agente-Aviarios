# Handoff: Propuesta Comercial — Aviario Industrial

## Overview
Rediseño de la vista de propuesta comercial que genera la aplicación de Gómez y Crespo (Agente Aviario). La propuesta se muestra al cliente final (granjero) y resume el sistema avícola recomendado, su viabilidad normativa y los datos de su instalación.

## About the Design Files
Los archivos en este bundle son **prototipos de referencia creados en HTML** — muestran el aspecto y la estructura deseados, no son código de producción. La tarea es **recrear estos diseños en el entorno existente de la aplicación** (React, Next.js, Vue, etc.) usando sus patrones y librerías ya establecidos.

## Fidelity
**Alta fidelidad (hifi)**: colores, tipografía, espaciado e interacciones finales. Recrear pixel-perfect usando las librerías de UI existentes del proyecto.

---

## Estructura de la página

La propuesta es un **documento centrado** de ancho máximo `820px`, con fondo de página `#ebedf2` y sombra `0 4px 40px rgba(0,0,0,.12)`. Se compone de las siguientes secciones en orden:

```
1. Topbar (nav de progreso)
2. Hero
3. Beneficios clave
4. Características del sistema
5. Verificación normativa
6. Instalación (datos + plano)
7. Equipamiento normativo
8. Por qué GYC (dark)
9. CTA
10. Footer
```

---

## Design Tokens

### Colores
```css
--navy:      #000823   /* fondo oscuro, texto de títulos */
--green:     #3d6b3a   /* color principal de marca */
--green-dk:  #1e3d1b   /* verde oscuro (rara vez) */
--green-lt:  #eef6ed   /* fondos verdes suaves, bg de iconos */
--green-mid: #4f764d   /* verde medio (hero badge, topbar) */
--body:      #3d4354   /* texto de cuerpo */
--muted:     #7b8197   /* texto secundario */
--faint:     #b0b5c5   /* texto muy suave, separadores */
--border:    #e2e4ec   /* bordes y líneas */
--bg:        #ffffff
--bg-alt:    #f7f8fb   /* fondo de secciones alternas */
--ok:        #1d6b22   /* verde de estado "cumple" */
--ok-bg:     #e8f5e8   /* fondo de badge "cumple" */
```

### Tipografía
```
Display:  'Montserrat'      — pesos 400 500 600 700 800
Body:     'Source Sans 3'   — pesos 400 600; italic 400
Mono:     'JetBrains Mono'  — pesos 400 700
```
Google Fonts import:
```
Montserrat:wght@400;500;600;700;800
Source+Sans+3:ital,wght@0,400;0,600;1,400
JetBrains+Mono:wght@400;700
```

### Espaciado
- Padding horizontal de secciones: `2.5rem`
- Padding vertical de secciones: `2.75rem`
- Gap entre cards: `1.25rem`
- Gap entre grid items: `1px` (con `background: var(--border)` en el contenedor → efecto de línea divisoria)

### Bordes y radios
- Cards principales: `border-radius: 6px`, `border: 1.5px solid var(--border)`
- Pills/badges: `border-radius: 3px` o `30px`
- Botones: `border-radius: 4px`

### Sombras
- Documento: `box-shadow: 0 4px 40px rgba(0,0,0,.12)`

---

## Secciones

### 1. Topbar
- Fondo: `#000823`, altura `48px`, `position: sticky; top: 0; z-index: 100`
- Izquierda: logotipo "GYC" en Montserrat 800 blanco
- Centro: barra de progreso de 6 pasos (Proyecto → Análisis → Sistema → Informe → **Propuesta** → Plano)
  - Paso completado: círculo verde `#4f764d` con checkmark SVG; label `rgba(255,255,255,.45)`
  - Paso activo: círculo blanco con número negro; label blanco
  - Paso pendiente: círculo outline `rgba(255,255,255,.15)`; label `rgba(255,255,255,.2)`
  - Entre pasos: línea `1px rgba(255,255,255,.1)` de 20px de ancho
- Derecha: botón "Exportar PDF" → llama a `window.print()`. Fondo `rgba(255,255,255,.1)`, borde `rgba(255,255,255,.15)`, border-radius 4px

### 2. Hero
- Fondo: `#000823`
- Decoración: dot grid con `radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)` cada 28px
- Decoración: blob radial verde `rgba(61,107,58,.35)` abajo-derecha, 380px, `border-radius: 50%`
- Layout: 2 columnas (`1fr auto`), gap `2rem`

**Columna izquierda:**
- Eyebrow: badge de código `COD. 10007 · MULTINIVEL` + fecha + badge "Instalación viable"
  - Badge código: borde `rgba(79,118,77,.35)`, texto `#4f764d`, border-radius 3px
  - Badge viable: fondo `rgba(61,107,58,.25)`, color `#8fd68f`, borde `rgba(61,107,58,.35)`
- Título: Montserrat 800, `clamp(2.4rem, 6vw, 4rem)`, blanco, `letter-spacing: -.03em`, `line-height: .92`
  - Palabra "Industrial" en color `#4f764d`
- Subtítulo: 0.9rem, `rgba(255,255,255,.58)`, max-width 400px

**Columna derecha — caja de stats:**
- Fondo `rgba(255,255,255,.05)`, borde `rgba(255,255,255,.1)`, border-radius 6px, padding `1.25rem 1.5rem`
- 3 stats separados por `border-bottom: 1px solid rgba(255,255,255,.08)`:
  1. `5.000` — Gallinas ponedoras (barra fill 80%)
  2. `9` — Módulos · 2 niveles (barra fill 45%)
  3. `7.2/9` — gal/m² normativa (barra fill 80%)
- Valor: JetBrains Mono 700, 1.6rem, blanco
- Label: Montserrat 600, 0.52rem, uppercase, `rgba(255,255,255,.42)`
- Barra: 3px altura, fondo `rgba(255,255,255,.08)`, fill `#4f764d`, border-radius 2px

### 3. Beneficios clave (sección tint)
- Fondo: `var(--bg-alt)` = `#f7f8fb`
- Tag: `Por qué este sistema`
- Grid: 3 columnas iguales, gap 1.25rem

**Card de beneficio:**
- Fondo blanco, borde `1.5px solid var(--border)`, border-radius 6px, padding `1.4rem 1.25rem`
- Franja top: 3px, color `var(--green)`
- Número grande: JetBrains Mono 700, 2.2rem, color `var(--green)` sobre fondo `var(--green-lt)`
- Título: Montserrat 700, 0.82rem, `var(--navy)`
- Descripción: 0.8rem, `var(--muted)`

Contenido:
1. `+79%` / Más aves, misma nave
2. `<1%` / Huevo sucio
3. `20+` / Años de vida útil

### 4. Características del sistema
- Fondo blanco
- Grid **2 columnas**, gap 1px, borde externo `1.5px solid var(--border)`, border-radius 6px, `overflow: hidden`
- Fondo del grid: `var(--border)` → los gaps de 1px actúan como líneas divisorias
- **8 items** (4 filas × 2 col)

**Item de característica:**
- Fondo blanco, padding `1.1rem 1.25rem`, flex row, gap `0.85rem`
- Icono: cuadrado 32×32px, border-radius 7px, fondo `var(--green-lt)`, color `var(--green)`, icono SVG 16×16
- Nombre: Montserrat 700, 0.78rem, `var(--navy)`
- Descripción: 0.75rem, `var(--muted)`, line-height 1.6

Características (en orden):
1. Modular y escalable — icono: 4 cuadrados 2×2
2. Gallinas con bienestar — icono: gota/corazón
3. Recolección automática — icono: target/rueda
4. Suministros adaptados — icono: sol/dial
5. Sin plagas — icono: escudo con check
6. Nidos confort AstroTurf — icono: nido/arco
7. Manejo sencillo — icono: grid X
8. Llave en mano — icono: casa

### 5. Verificación normativa (sección tint)
- Fondo `#f7f8fb`
- Layout: 2 columnas (`200px 1fr`), gap `1.5rem`

**Columna izquierda — 3 KPI cards:**
- Fondo `var(--bg-alt)`, borde `1.5px solid var(--border)`, border-radius 5px, padding `0.85rem 1rem`
- Label: Montserrat 700, 0.52rem, uppercase, `var(--muted)`
- Valor: JetBrains Mono 700, 1.3rem, `var(--navy)`
- Subtexto: 0.68rem, `var(--muted)`
- Tercera card: fondo `var(--ok-bg)` = `#e8f5e8`, borde `#b8ddb8`, label y valor en `var(--ok)` = `#1d6b22`

KPIs: `7.2/9 gal/m²` · `5/5 parámetros OK` · `Instalación viable`

**Columna derecha — lista de verificaciones:**
- Borde `1.5px solid var(--border)`, border-radius 6px, overflow hidden
- Cada fila: grid `20px 1fr auto`, gap `0.75rem`, padding `0.75rem 1rem`, borde inferior entre items
- Dot: 8×8px, border-radius 50%, fondo `var(--ok)` = `#1d6b22`
- Nombre: Montserrat 700, 0.73rem, `var(--navy)`
- Detalle: 0.68rem, `var(--muted)`, valores clave en JetBrains Mono
- Badge "Cumple": Montserrat 700, 0.5rem, uppercase, fondo `var(--ok-bg)`, color `var(--ok)`, border-radius 30px

5 filas: Densidad máxima · Nidos colectivos · Comederos lineales · Bebederos nipple · Altura libre

### 6. Instalación
- Fondo blanco
- Grid `260px 1fr`, gap 1px, borde `1.5px solid var(--border)`, border-radius 6px

**Panel A — Datos:**
- Cabecera: fondo `var(--bg-alt)`, badge circular `#000823` con letra blanca "A"
- 7 filas key/value: label 0.75rem `var(--muted)` | valor JetBrains Mono 0.78rem `var(--navy)`

**Panel B — Plano SVG:**
- Fondo `#f9fafb`, padding `1.25rem`
- SVG viewBox `0 0 460 210`
- Zonas (de arriba a abajo):
  - Yacija Norte: rect fill `#eef6ed`, label `#3d6b3a` Montserrat 700 8px
  - Pasillo: rect fill `#f3f4f7`, label `#a0a5b8`
  - 9 módulos: rects fill `#000823`, labels M1–M9 en JetBrains Mono 7px `rgba(255,255,255,.6)`
  - Pasillo: ídem
  - Yacija Sur: ídem yacija norte
- Leyenda: Módulos (cuadrado navy) · Yacija (cuadrado verde claro) · Pasillo (cuadrado gris)
- Contorno nave: dashed `#d0d3dc`, border-radius 3

### 7. Equipamiento normativo (sección tint)
- Grid **3 columnas**, gap 1px, borde `1.5px solid var(--border)`, border-radius 6px

**Card de equipamiento:**
- Fondo blanco, padding `1.1rem`
- Nombre: Montserrat 700, 0.58rem, uppercase, `var(--muted)`
- Valor: JetBrains Mono 700, 1.85rem, color `var(--green)`, `letter-spacing: -.04em`
- Unidad: inline, 0.72rem, `var(--muted)`
- Fórmula: 0.72rem, `var(--muted)`, line-height 1.5
- Referencia normativa: Montserrat 700, 0.5rem, uppercase, `var(--green)`, margin-top 0.5rem

6 cards: 9 nidos · 50 m comedero · 10 bebederos · 580 m² yacija · 694 m² sup. normativa · 500 m perchas

### 8. Por qué GYC (dark)
- Fondo `var(--navy)` = `#000823`
- Grid 2 columnas `1fr 1fr`, gap `3rem`

**Columna izquierda:**
- Overline: 0.52rem, Montserrat 700, uppercase, `var(--green-mid)`, letter-spacing .2em
- Título: Montserrat 800, 2rem, blanco, `letter-spacing: -.03em`, `line-height: 1`
- Subtexto: 0.8rem, `rgba(255,255,255,.42)`, line-height 1.75

**Columna derecha — 4 puntos:**
- Cada punto: `padding-left: 1rem`, `border-left: 2px solid rgba(61,107,58,.5)`
- Texto: 0.82rem, `rgba(255,255,255,.62)`, line-height 1.75
- `<strong>` → blanco; `<em>` → `#8fd68f`

### 9. CTA
- Fondo `var(--green)` = `#3d6b3a`
- Layout flex, `justify-content: space-between`, `align-items: center`
- Título: Montserrat 800, 1.2rem, blanco
- Subtexto: 0.82rem, `rgba(255,255,255,.72)`
- Botón principal: fondo blanco, color `var(--green)`, border-radius 4px, padding `0.65rem 1.4rem`
- Botón secundario: ghost, borde `rgba(255,255,255,.45)`, color blanco

### 10. Footer
- Fondo `#000823`, padding `1rem 2.5rem`
- Flex row, `justify-content: space-between`
- Brand: Montserrat 600, 0.58rem, uppercase, `rgba(255,255,255,.38)`
- Norms: 0.6rem, `rgba(255,255,255,.28)`
- Link "Calculadora": Montserrat 700, 0.58rem, `rgba(255,255,255,.5)` + icono flecha ←

---

## Interacciones y comportamiento

- **Botón "Exportar PDF"**: `window.print()` — la página tiene `@media print` con estilos de impresión
- **Topbar**: `position: sticky; top: 0` para que el progreso sea visible al hacer scroll
- **Print styles**: eliminar sombra, forzar colores en secciones oscuras con `-webkit-print-color-adjust: exact`
- No hay interacciones complejas en esta vista (es un documento de solo lectura)

---

## Responsive

- `< 720px`: hero single column, verificación normativa single column, instalación single column, beneficios single column, equipamiento 2 columnas, labels del topbar ocultos
- El documento tiene max-width 820px centrado con `margin: 0 auto`

---

## Assets / Iconos
Todos los iconos son SVG inline de 16×16px con `stroke="currentColor"` y `stroke-width="1.4"`. No se requieren assets externos. Ver el archivo HTML de referencia para los paths exactos de cada icono.

---

## Archivos en este bundle
- `Propuesta Comercial - Rediseño.html` — Prototipo hi-fi completo de referencia
