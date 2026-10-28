# Documentación técnica — Estudio de nave

Documento de relevo para quien vaya a mantener la herramienta. Explica la arquitectura, el
modelo de cálculo, el despliegue y las trampas conocidas. Para incidencias del día a día
(qué hacer si algo deja de funcionar, comandos del servidor) ver
[GUIA_SOPORTE.md](GUIA_SOPORTE.md).

Otros documentos del repositorio:

| Archivo | Contenido |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | Reglas de desarrollo y resumen del dimensionamiento (lo leen también los asistentes de IA) |
| [`specs_nidal_anida.md`](specs_nidal_anida.md) | Especificación del nidal A-Nida (geometría, zona de puesta) |
| [`specs_aviario_industrial.md`](specs_aviario_industrial.md) | Especificación del aviario |
| [`referencia_instalacion_medida.md`](referencia_instalacion_medida.md) | Caso de regresión: acta de inspección de Galicia (8.688 gallinas) |
| `design-system/estudio-de-nave/MASTER.md` | Sistema de diseño (paleta, tipografías, componentes) |
| `PRODUCT.md`, `DESIGN.md` | Contexto de producto y de diseño |
| `planos/` | Planos reales de G&C usados como referencia de estilo del plano SVG |

---

## 1. Qué hace y qué no hace

Herramienta **interna** para el equipo comercial. A partir de los datos de una nave
(sistema de producción, ancho, largo, altura, slots, niveles, pasto, equipamiento medido)
calcula, para Nidal Colectivo A-Nida o Aviario Industrial:

- número de módulos y filas, gallinas máximas y un intervalo (mínimo con margen de incertidumbre),
- densidad, yacija y el resto de verificaciones normativas (RD 3/2002, Directiva 1999/74/CE,
  reglamentos UE de producción ecológica),
- una tabla de escenarios (cada número de módulos o de filas posible) con el óptimo marcado,
- el plano en planta (SVG en pantalla, DXF editable para el nidal, PDF vía impresión).

**No** tiene usuarios, autenticación, base de datos ni histórico de estudios: cada estudio
vive en el navegador hasta que se exporta a PDF. El único estado persistente es la ficha
técnica (`backend/datos/ficha_tecnica.json`).

**Historia.** Hasta 2026-10 `master` era una app con IA (Gemini, Qdrant, LangChain, chat).
Se sustituyó por esta herramienta determinista; la versión anterior está en la etiqueta
`app-ia-legacy`. Las ramas `feat/ai-floor-plan-svg`, `feature/intake-conversacional`,
`fix/*` son de esa etapa. Hay comentarios en el código que aún mencionan módulos de entonces
(`intake.py`, `nidal_layout.py`, `/capacidad`): ya no existen.

## 2. Arquitectura

```
Navegador
   │  http://SRV-DOCKER-aviario:3001
   ▼
┌───────────────────────────── docker compose (proyecto herramienta-interna) ─┐
│                                                                             │
│  frontend_herramienta  (Next.js 16, node server.js, :3000 interno)          │
│   ├─ Server actions (actions.ts) ──► POST /estudio, GET/PUT /ficha, ...     │
│   └─ API routes (proxy)          ──► POST /plano-config, /plano-nidal-dxf   │
│                │                                                            │
│                │ http://backend:8000  (BACKEND_URL)                         │
│                ▼                                                            │
│  backend_herramienta   (FastAPI + uvicorn, 1 proceso, sin puerto publicado) │
│   └─ volumen ./backend/datos ──► ficha_tecnica.json                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

- El navegador nunca llama al backend directamente: todo pasa por el servidor de Next.js
  (server actions o rutas `/api/*` que hacen de proxy). Por eso el backend no publica puerto
  y el CORS configurado en `main.py` en la práctica solo importa en desarrollo.
- No hay autenticación. La seguridad depende de que el puerto 3001 solo sea accesible desde
  la red interna. **No exponer a internet** sin añadir antes autenticación: cualquiera podría
  cambiar la ficha técnica.

### Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 (App Router, `output: "standalone"`), React 19, TypeScript, Tailwind CSS 4, daisyUI 5, lucide-react, GSAP |
| Backend | Python 3.12, FastAPI, Pydantic 2, uvicorn, ezdxf (DXF) |
| Tests | pytest (solo backend) |
| Infra | Docker Compose, GitHub Actions con runner self-hosted |

> **Next.js 16 tiene cambios incompatibles con versiones anteriores** (ver
> `frontend/AGENTS.md`). Antes de tocar rutas, server actions o configuración, consulta la
> documentación incluida en `frontend/node_modules/next/dist/docs/`.

## 3. Estructura del repositorio

```
backend/
├── main.py                 Endpoints FastAPI. Al arrancar aplica la ficha guardada
├── agentes/
│   ├── estudio.py          Motor de cálculo + constantes de producto (valores de fábrica)
│   ├── aforo.py            Aforo por criterios normativos (densidad, perchas, nidal, ...)
│   ├── ficha.py            Ficha técnica: modelo, carga/guardado JSON, aplicación a estudio.py
│   ├── plano_agent.py      Plano SVG (nidal y aviario) + métricas del plano
│   └── dxf_nidal.py        Exportación DXF del nidal (unidades en metros, capas)
├── referencias/            Datos del acta de inspección de referencia (tests)
├── datos/                  (ignorado en git) ficha_tecnica.json editada en runtime
├── requirements.txt
└── Dockerfile

frontend/src/app/
├── page.tsx                Estudio: flujo módulo → nave → estudio, informe y plano
├── ficha/page.tsx          Ficha técnica editable
├── Cabecera.tsx            Cabecera con pestañas
├── actions.ts              Server actions (pedirEstudio, obtenerFicha, guardarFicha, ...) y tipos
├── api/plano-config/       Proxy a /plano-config
├── api/plano-nidal-dxf/    Proxy a /plano-nidal-dxf
├── clases.ts               Clases Tailwind/daisyUI compartidas
├── globals.css             Tema daisyUI "gyc", reglas de impresión (@page A4)
└── layout.tsx              Fuentes (Outfit, Work Sans) y tema

test_calculos_capacidad.py  Aforo, regresión del acta, coherencia estudio ↔ plano
test_nidal_calculo_modelo.py Modelo del nidal, plano centrado, ecológico
test_ficha_tecnica.py       La ficha editada gobierna estudio y plano
.github/workflows/docker-ci.yml  CI/CD
docker-compose.yml
```

## 4. Entorno de desarrollo

Requisitos: Python 3.12, Node 20, Git. Docker opcional.

```bash
# Backend (terminal 1)
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000                 # docs interactivas: http://localhost:8000/docs

# Frontend (terminal 2)
cd frontend
npm install
BACKEND_URL=http://localhost:8000 npm run dev         # http://localhost:3000
# PowerShell:  $env:BACKEND_URL="http://localhost:8000"; npm run dev
```

**Define siempre `BACKEND_URL`.** Si falta, las server actions usan `http://localhost:8000`
pero los proxies `/api/*` usan `http://localhost:8005`: el estudio funcionaría y el plano no.

Tests (desde la raíz del repo, ~1 s):

```bash
python -m pytest test_calculos_capacidad.py test_nidal_calculo_modelo.py test_ficha_tecnica.py
```

Los tests usan una ficha temporal (no tocan `backend/datos/`). Lint del frontend:
`cd frontend && npm run lint`. Comprobar que compila: `npm run build`.

Con Docker en local: `docker compose up -d --build` → http://localhost:3001.

## 5. Backend

### 5.1 Endpoints

| Endpoint | Entrada | Salida | Uso |
|---|---|---|---|
| `POST /estudio` | `EstudioRequest` | `EstudioResponse` | Estudio completo (pantalla principal) |
| `POST /aforo-medido` | `AforoRequest` | `AforoResultado` | Aforo de una instalación medida (no lo usa el frontend actual) |
| `POST /plano-config` | `LayoutConfig` | `{svg, metricas, error}` | Plano SVG. **Devuelve 200 con `error` relleno y `svg` vacío si falla** |
| `POST /plano-nidal-dxf` | `LayoutConfig` | archivo `.dxf` | DXF del nidal; 422 si la configuración no es dibujable |
| `GET /ficha` | — | `FichaRespuesta` | Ficha vigente, la de fábrica, si está personalizada y la normativa |
| `PUT /ficha` | `FichaTecnica` | `FichaRespuesta` | Guarda y aplica la ficha |
| `POST /ficha/restablecer` | — | `FichaRespuesta` | Borra el JSON y vuelve a fábrica |
| `GET /health` | — | `{"status": "ok"}` | Health check |

Con el backend en marcha, `http://localhost:8000/docs` muestra todos los modelos y permite
probar los endpoints. Ejemplo mínimo:

```bash
curl -s -X POST localhost:8000/estudio -H 'Content-Type: application/json' \
  -d '{"tipo_zona":"nidal_colectivo","sistema":"suelo","ancho_nave_m":12,"largo_nave_m":60,"altura_nave_cm":300}'
# → viable: true, num_modulos: 42, gallinas_max: 5844, limitante: "densidad" (ficha de fábrica)
```

### 5.2 La ficha técnica y las constantes de producto

Es el punto más delicado del diseño:

1. Los **valores de fábrica** son constantes de módulo en `agentes/estudio.py`
   (`NIDAL_LARGO`, `AVI_MOD_A`, `AVI_SUP_DISP`, `AVI_EQUIPO_POR_MODULO`, `MARGEN_INCERTIDUMBRE_PCT`…).
2. `agentes/ficha.py` captura esos valores al importarse (`_POR_DEFECTO`) y, al arrancar
   (`main.py`) y cada vez que se guarda la ficha, **sobrescribe las variables globales de
   `agentes.estudio`** con `aplicar_ficha()`.
3. Por eso `estudio.py`, `plano_agent.py` y `dxf_nidal.py` leen siempre `agentes.estudio.X`
   **en el momento de la llamada**.

Reglas que se derivan:

- No hagas `from agentes.estudio import AVI_MOD_A` ni uses esas constantes como valor por
  defecto de un argumento o de un campo Pydantic: se quedaría congelado el valor de fábrica.
  Usa `import agentes.estudio as _E` y `_E.AVI_MOD_A`, o `Field(default_factory=lambda: _E.X)`.
  (Las funciones de `estudio.py` que tienen defaults como `slot_izq=NIDAL_SLOT_DEFAULT` usan
  constantes que **no** están en la ficha; mantenlo así.)
- El estado es **global del proceso**. El backend corre con un solo proceso uvicorn
  (Dockerfile). Si algún día se arranca con `--workers N`, guardar la ficha solo afectaría a
  uno de los procesos hasta reiniciar.
- La ficha se guarda de forma atómica (escribe `.tmp` y renombra). Si el JSON está corrupto o
  no valida, **el backend no arranca** (`cargar_ficha()` lanza la excepción al importar `main`).
- La normativa (densidades, cm de percha, etc.) **no** está en la ficha: es ley, va en código
  y la ficha solo la muestra en solo lectura (`ficha.normativa()`).
- Ruta del JSON configurable con la variable `FICHA_TECNICA_PATH`.

### 5.3 Flujo del estudio (`estudiar_nave`)

```
estudiar_nave(req)
 ├─ _estudiar(req)
 │   ├─ motor geométrico: _estudio_nidal  o  _estudio_aviario
 │   │     → cuántos módulos caben, escenarios 1..N, densidad/yacija por escenario,
 │   │       verificaciones dimensionales, óptimo geométrico
 │   ├─ para cada escenario: calcular_aforo()  (aforo.py)
 │   │     → densidad, perchas, nidal, comedero, bebederos, yacija/ave, pasto, salidas,
 │   │       tope ecológico; manda el mínimo. Equipamiento no medido = el integrado del módulo
 │   ├─ óptimo real = escenario válido con más gallinas (a igualdad, menos módulos);
 │   │     en aviario "por filas" solo cuentan filas completas
 │   ├─ si no se forzó un escenario, se recalcula el motor con el óptimo
 │   └─ verificaciones finales, equipamiento previsto, notas, condiciones ecológicas
 ├─ intervalo: se repite el cálculo con la superficie reducida un MARGEN_INCERTIDUMBRE_PCT
 │     (mismo nº de módulos/filas) → gallinas_min
 └─ parametros: tabla de trazabilidad (qué valor salió de dónde) para el informe técnico
```

**Nidal A-Nida** (`_estudio_nidal`, una única fila centrada):

- La cadena va a lo largo de la nave. Largo para módulos = largo − local técnico (si está
  dentro) − libre al fondo (por defecto, el tensor, 3 m).
- El ancho necesario = cuerpo (1,40) + slot izquierdo + slot derecho + paso a cada pared.
  El conjunto se centra; los pasos pedidos son mínimos.
- Densidad: se descuenta solo el cuerpo (el slot es superficie habitable).
  Yacija: se descuentan cuerpo y slots. Yacija mínima = 1/3 del suelo.
- Capacidad por módulo 144; la zona de puesta (2 alfombrillas, 1,1781 m²) limita según
  régimen: m² × 120 en suelo/campero, cm² / 120 en ecológico.

**Aviario** (`_estudio_aviario`):

- Niveles por altura: ≥ 300 cm → 2, ≥ 400 cm → 3 (editables en la ficha). En ecológico
  máximo 2 niveles (3 contando el suelo).
- Largo útil = largo − zona de equipos frontal (4 m) − fondo (3 m). Módulos por fila =
  `floor(largo_útil / largo_módulo)`. Filas = cuántas caben en el ancho con pasillos de 1 m.
- Superficie útil = nº módulos × superficie disponible por módulo + **todo el suelo** entre
  zonas de equipos (también el que queda bajo los módulos: las gallinas andan por debajo).
  La zona de puesta no computa para densidad.
- Dos modos (`reparto`): **por filas** (escenarios de filas completas) o **por módulos**
  (cualquier total, repartido en el mínimo de filas equilibradas: 200 en filas de 77 →
  67 + 67 + 66, `reparto_filas`). La tabla también muestra, como informativos, escenarios
  que no caben y cuánto largo falta.

**Aforo** (`aforo.py`): independiente del dibujo; redondea siempre hacia abajo con `Decimal`
para no perder ni ganar un ave en límites exactos. «No medido» (`None`) y «0» son cosas
distintas: `None` queda como pendiente, `0` limita a 0 gallinas.

### 5.4 Plano y DXF

- `plano_agent.generar_desde_config(LayoutConfig)` genera el SVG. **No calcula por su cuenta**:
  llama a `estudiar_nave` con los mismos datos para obtener módulos, gallinas, yacija y
  densidad (las «métricas»), de modo que el plano y el informe coinciden. Los tests lo
  comprueban.
- El frontend construye el `LayoutConfig` a partir de la respuesta del estudio
  (`configPlano` en `page.tsx`) y lo manda a `/api/plano-config`.
- El nidal solo admite una fila; el aviario dibuja `filas_modulos` tal como lo repartió el estudio.
- `dxf_nidal.generar_dxf_nidal` dibuja el nidal en metros, con capas `NAVE`, `NIDAL`,
  `SLAT_IZQ`, `SLAT_DER`, `TENSOR`, `LOCAL_PROPUESTO`, `COTAS`, `ROTULOS`.
- El estilo imita los planos reales de G&C de `planos/` (nave negra, módulos rojos, tensor amarillo).

## 6. Frontend

- **`page.tsx`** es un único componente cliente con tres pasos (`paso`: `modulo` → `nave` →
  `estudio`). Al calcular llama a la server action `pedirEstudio` y después a
  `/api/plano-config`. Cambiar el número de módulos/filas o un escenario de la tabla
  recalcula con `num_modulos` / `num_filas` forzados.
- Lee la ficha (`obtenerFicha`) al cargar para mostrar medidas y validar encajes: **no hay
  medidas de producto escritas a mano en el frontend**, y no debe haberlas.
- **Informe**: lo que se ve en pantalla es lo que sale en el PDF. Dos versiones:
  `cliente` (yacija, densidad y equipamiento) y `tecnica` (todas las verificaciones,
  parámetros y escenarios). «PDF cliente» / «PDF técnico» cambian la versión y llaman a
  `window.print()` con un título que Chrome propone como nombre de archivo. La referencia
  automática tiene el formato `EN-AAMMDD-HHMM`.
- **Impresión**: reglas en `globals.css` (`@page` A4 vertical y página `plano` A4 apaisada,
  pie de página con `@bottom-left/right` inyectado desde `piePagina()`). Los tamaños de
  impresión se ponen con la variante `print:` de Tailwind. Probado en Chrome/Edge; Firefox y
  Safari no soportan bien los márgenes de página CSS.
- **`ficha/page.tsx`**: formulario de la ficha; muestra errores de validación del backend
  (las server actions devuelven el error como dato porque Next.js oculta en producción los
  mensajes de excepciones de server actions).
- **Diseño**: tema daisyUI `gyc` en `globals.css` (navy + emerald), fuentes Outfit/Work Sans,
  iconos Lucide. Reglas en `design-system/estudio-de-nave/MASTER.md` y en `CLAUDE.md`.
  Nada decorativo debe salir en el PDF y las animaciones respetan `prefers-reduced-motion`.

## 7. Normativa aplicada

Resumen (la lista completa, con fuentes, está en `ficha.normativa()` y se ve en la pestaña
Ficha técnica):

| Criterio | Suelo / campero | Ecológico |
|---|---|---|
| Densidad máxima | 9 gallinas/m² | 6 gallinas/m² |
| Perchas | 15 cm/gallina | 18 cm/gallina |
| Nidal colectivo | 1 m² / 120 gallinas | 120 cm² / gallina |
| Comedero lineal | 10 cm/gallina | 10 cm/gallina |
| Bebederos pezón/copa | 1 / 10 gallinas | 1 / 10 gallinas |
| Yacija | ≥ 1/3 del suelo y ≥ 250 cm²/gallina | igual |
| Pasto | 4 m²/gallina (campero) | 4 m²/gallina |
| Salidas / trampillas | 2 m / 1.000 gallinas (campero) | 4 m / 100 m² de superficie cubierta mínima |
| Tope por compartimento | — | 3.000 gallinas |
| Niveles | máx. 4 | máx. 3 incluido el suelo |

Si cambia la normativa: los límites están en `estudio.py` (`DENSIDAD_MAX`,
`MAX_GALLINAS_ECOLOGICO`, `FRACCION_YACIJA`…), en `aforo.py` (divisores de cada criterio) y
su texto en `ficha.normativa()`. Hay que cambiar los tres y ajustar los tests.

## 8. Tests

52 tests, todos en la raíz del repo. Se ejecutan en CI antes de cada despliegue: **si
fallan, no se despliega**.

| Archivo | Qué protege |
|---|---|
| `test_calculos_capacidad.py` | Regresión del acta de Galicia (8.688 gallinas, limitan las perchas); `None` ≠ 0; validaciones; estudio ↔ plano idénticos; reparto de filas; ecológico (18 cm, tope 3.000); pasto |
| `test_nidal_calculo_modelo.py` | Geometría del nidal, plano centrado con cotas reales, local dentro / libre al fondo, equipamiento medido vs integrado, ecológico |
| `test_ficha_tecnica.py` | Guardar la ficha cambia estudio y plano; restablecer vuelve a fábrica; validaciones; margen de incertidumbre |

Un test que falla tras un cambio de cálculo **no se arregla cambiando el número esperado**
sin entender por qué: muchos reproducen casos reales (el acta) o la regla «estudio y plano
deben coincidir».

## 9. Despliegue

### 9.1 Flujo

`master` es la rama oficial. Un push a `master` (o *Run workflow* manual) ejecuta
`.github/workflows/docker-ci.yml`:

1. **build-and-test** (máquina de GitHub): instala dependencias, pasa los tests, `docker compose build`.
2. **deploy** (runner self-hosted en `SRV-DOCKER-aviario`): en la carpeta de la variable
   `HERRAMIENTA_PATH` clona el repo si no existe, hace `git checkout -f -B master origin/master`
   y `docker compose up -d --build`.

`backend/datos/` está en `.gitignore`, así que el checkout forzado **no** borra la ficha.

### 9.2 Configuración

| Dónde | Qué | Valor actual |
|---|---|---|
| GitHub → Settings → Secrets and variables → Actions → *Variables* | `HERRAMIENTA_PATH` | `/home/goyco/herramienta-interna` |
| `.env` junto a `docker-compose.yml` en el servidor (opcional) | `HERRAMIENTA_PORT` | 3001 por defecto |
| `docker-compose.yml` | `BACKEND_URL` (frontend), `FRONTEND_URL` (backend, CORS) | `http://backend:8000`, `http://frontend:3000` |
| Entorno del backend (opcional) | `FICHA_TECNICA_PATH` | `backend/datos/ficha_tecnica.json` |

No hay secretos: la app no usa claves ni credenciales.

### 9.3 Servidor

- Proyecto compose `herramienta-interna`, contenedores `frontend_herramienta` y `backend_herramienta`.
- Puertos ocupados por otras apps: **3000** (`documentacion-escandallo`) y **8080** (code-server).
- La copia de desarrollo `/home/goyco/apps/calculadora-capacidad` tiene el **mismo nombre de
  proyecto compose**: un `docker compose up` desde ella **reemplaza la producción**. Trabaja ahí
  con `docker compose -p otro-nombre ...` o no levantes compose desde esa carpeta.
- Runner de GitHub Actions: aparece en GitHub → Settings → Actions → Runners. Si está
  *Offline*, los despliegues se quedan en cola. Se gestiona como servicio desde su carpeta de
  instalación (`sudo ./svc.sh status|start|stop`). *(Completar: ruta de instalación del runner
  y usuario/acceso SSH al servidor.)*

### 9.4 Volver a una versión anterior

```bash
git revert <commit>      # en local, luego push a master → despliega la versión corregida
```

Si es urgente, en el servidor: `git checkout -f <commit-bueno>` y `docker compose up -d --build`
(el siguiente push a `master` lo sobrescribe).

## 10. Recetas de cambios habituales

**Cambiar una medida o el equipamiento de un módulo**
- Si es un dato de un cliente o de una revisión puntual: desde la pestaña Ficha técnica.
- Si cambia el producto de fábrica: cambia la constante en `estudio.py` (y el comentario de
  su fuente), revisa `CLAUDE.md`/`docs/specs_*.md` y pasa los tests. Ojo: si el servidor tiene
  una ficha personalizada, esta **sigue mandando** sobre el nuevo valor de fábrica.

**Añadir un campo a la ficha técnica**
1. Modelo en `ficha.py` (`FichaAviario`, `FichaNidal` o `FichaCalculo`). Si es obligatorio,
   dale un default para que las fichas ya guardadas sigan validando (ver `calculo`).
2. `_ficha_desde_estudio()` (valor de fábrica) y `aplicar_ficha()` (volcarlo a `estudio.py`).
3. Tipos `FichaTecnica` en `frontend/src/app/actions.ts` y el formulario en `ficha/page.tsx`.
4. Un test en `test_ficha_tecnica.py`.

**Añadir un dato de entrada al estudio**
1. Campo en `EstudioRequest` (`estudio.py`) y uso en el motor.
2. Si afecta al plano, también en `LayoutConfig` (`plano_agent.py`) y en `configPlano` (`page.tsx`).
3. Tipo `EstudioRequest` en `actions.ts` y el input en `page.tsx`.
4. Test de que estudio y plano siguen coincidiendo.

**Añadir un endpoint**
Función en `main.py`; en el frontend, una server action en `actions.ts` (respuestas JSON) o
una ruta proxy en `src/app/api/<nombre>/route.ts` (descargas o llamadas desde el cliente).

## 11. Trampas conocidas y deuda técnica

| Tema | Detalle |
|---|---|
| **Medidas del aviario discrepantes** | El código y la ficha de fábrica usan un módulo de **1,20 × 3,30 m** (`AVI_MOD_A`, `AVI_MOD_B`; huella 3,96 m²). `CLAUDE.md` dice 3,735 × 1,20 (4,482 m²) y `docs/specs_aviario_industrial.md` 3,73 × 1,20. Pendiente de confirmar con producto cuál es la medida buena y unificar |
| URL del backend por defecto | `actions.ts` usa `localhost:8000` y las rutas `/api/*` `localhost:8005`. En Docker da igual (`BACKEND_URL` siempre está definida); en local hay que definirla |
| `/plano-config` responde 200 aunque falle | El error va en el campo `error` y el frontend simplemente no muestra plano. Buscar `[plano_agent]` en los logs del backend |
| Estado global mutable | La ficha se aplica sobre variables de módulo. Correcto con un proceso; no escalar con `--workers` sin rediseñarlo |
| Ficha corrupta = backend caído | Validar el JSON al editarlo a mano; mejor editar siempre desde la web |
| Sin autenticación | Cualquiera con acceso a la red interna puede cambiar la ficha. No exponer fuera |
| Sistema `jaulas` | Existe en los tipos por herencia pero la herramienta está pensada para suelo, campero y ecológico |
| `/aforo-medido` | Endpoint sin uso en el frontend actual; lo usan los tests indirectamente (mismo motor) |
| Comentarios antiguos | Docstrings de `estudio.py` citan módulos de la app con IA que ya no existen |
| Copia de desarrollo en el servidor | Comparte nombre de proyecto compose con producción (ver 9.3) |
| PDF | Depende de las reglas de impresión de Chrome/Edge (`@page` con márgenes nombrados) |

## 12. Checklist de relevo

- [ ] Acceso al repositorio GitHub `GYCai-tech/Agente-Aviarios` con permisos de escritura y a *Settings → Actions*.
- [ ] Acceso SSH al servidor `SRV-DOCKER-aviario` (usuario `goyco` o uno con permisos de Docker).
- [ ] Saber dónde está instalado el runner self-hosted y cómo reiniciarlo.
- [ ] Copia de `backend/datos/ficha_tecnica.json` de producción.
- [ ] Contacto en producto/diseño que valida las medidas de los módulos (y la discrepancia del aviario).
- [ ] Ejecutar los tests en local y levantar la app una vez antes de hacer cambios.
