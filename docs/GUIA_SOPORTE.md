# Guía de soporte — Estudio de nave

Esta guía es para quien tenga que **atender incidencias** de la herramienta sin ser
programador: comerciales, sistemas o cualquier persona del equipo con acceso al servidor.
Explica qué es la herramienta, dónde está, cómo saber si funciona y qué hacer ante los
problemas más habituales.

Si eres quien va a mantener o modificar el código, lee también
[DOCUMENTACION_TECNICA.md](DOCUMENTACION_TECNICA.md).

---

## 1. Qué es

Una web interna de Gómez y Crespo para preparar propuestas comerciales. El comercial
introduce las medidas de la nave del cliente y la herramienta calcula:

- cuántos módulos caben (Nidal Colectivo A-Nida o Aviario Industrial),
- cuántas gallinas se pueden alojar legalmente,
- si la instalación cumple la normativa (densidad, yacija, perchas, nidales, pasto…),
- y dibuja el plano de la instalación.

El resultado se puede **imprimir o guardar como PDF** (versión cliente o versión técnica) y,
en el nidal, descargar el plano en **DXF** para abrirlo en AutoCAD.

No usa inteligencia artificial ni internet: todo son cálculos fijos. Con los mismos datos de
entrada, el resultado es siempre el mismo.

## 2. Dónde está

| Qué | Dónde |
|---|---|
| Dirección web | `http://<servidor>:3001` (el servidor es `SRV-DOCKER-aviario`) |
| Carpeta en el servidor | `/home/goyco/herramienta-interna` |
| Código fuente | GitHub: `GYCai-tech/Agente-Aviarios`, rama `master` |
| Único dato que se guarda | `/home/goyco/herramienta-interna/backend/datos/ficha_tecnica.json` |

La herramienta funciona como **dos piezas** dentro del servidor (en Docker):

| Pieza | Nombre del contenedor | Para qué sirve |
|---|---|---|
| Frontend (la web) | `frontend_herramienta` | Lo que ve el usuario en el navegador |
| Backend (el motor de cálculo) | `backend_herramienta` | Hace los cálculos y dibuja el plano |

Si el frontend funciona pero el backend no, la página se abre pero los cálculos fallan.

> **No confundir con otras apps del mismo servidor:** el puerto 3000 es de otra aplicación
> (`documentacion-escandallo`) y el 8080 es code-server. La herramienta está en el **3001**.

## 3. Cómo funciona por dentro (lo justo para entender los fallos)

```
Navegador del comercial
        │  http://servidor:3001
        ▼
 frontend_herramienta  ──(red interna de Docker)──►  backend_herramienta
   (pantallas, PDF)                                   (cálculos, plano, DXF)
                                                           │
                                                           ▼
                                             backend/datos/ficha_tecnica.json
                                             (medidas de los módulos editadas)
```

- El navegador **solo habla con el frontend**. El backend no es accesible desde fuera.
- La **ficha técnica** (pestaña «Ficha técnica») guarda las medidas y el equipamiento de los
  módulos. Si alguien la cambia, **cambian los cálculos de todo el mundo**. Es el único dato
  que la herramienta guarda; no hay base de datos ni usuarios.
- Los estudios **no se guardan** en ningún sitio: si se cierra la pestaña, se pierden. Para
  conservarlos hay que exportar el PDF.

## 4. Cómo comprobar si funciona

1. Abre `http://<servidor>:3001`. Debe aparecer la pantalla «Estudio» con el logo.
2. Elige Nidal, mete una nave de prueba (por ejemplo **12 m de ancho × 60 m de largo × 300 cm
   de altura**, sistema suelo) y pulsa calcular. Debe salir viable, con 42 módulos y 5.844
   gallinas (con la ficha de fábrica), y un plano.
3. Abre la pestaña «Ficha técnica»: deben cargarse las medidas de los módulos.

Si los tres pasos funcionan, la herramienta está bien.

## 5. Problemas habituales

Para los comandos de esta sección hay que entrar en el servidor (ver [apartado 6](#6-comandos-del-servidor)).

| Lo que se ve | Causa probable | Qué hacer |
|---|---|---|
| La página no abre (el navegador dice que no se puede conectar) | Los contenedores están parados o el servidor está apagado | Ver el estado (6.1). Si no están «Up», arrancarlos (6.3) |
| La página abre, pero al calcular sale **«No se pudo conectar con el servidor de cálculo»** | El backend está parado, reiniciándose o no arranca | Ver el estado (6.1) y los registros del backend (6.2). Si en los registros sale un error sobre `ficha_tecnica.json`, ver la fila de abajo |
| El backend se reinicia una y otra vez y en los registros aparece `ficha_tecnica.json` o `ValidationError` | El archivo de la ficha técnica está dañado o se ha editado a mano mal | Restaurar la copia de seguridad del archivo (apartado 7). Si no hay copia, renombrarlo (`mv ficha_tecnica.json ficha_tecnica.roto.json`) y reiniciar: la herramienta vuelve a los valores de fábrica |
| Sale el estudio pero **no sale el plano** | Lo normal: si la nave no es viable no se dibuja plano. Si es viable, el plano ha fallado | Si el estudio dice «No viable», no es un fallo (ver fila siguiente). Si dice viable, mirar los registros del backend y buscar `[plano_agent]` |
| El estudio dice **«No viable»** o «No cumple: …» | No es un fallo: la nave no admite la instalación con esos datos (poca altura, poco ancho, falta yacija…) | Leer el motivo que da la pantalla. Revisar que las medidas estén en metros y la altura en **centímetros** (3 m = 300 cm) |
| Los resultados **han cambiado** y nadie ha tocado el código | Alguien ha modificado la ficha técnica | Abrir «Ficha técnica»: si está modificada aparece la etiqueta «Ficha personalizada» con la fecha del último cambio. Si el cambio fue un error, corregir el valor o pulsar «Valores de fábrica» |
| Al guardar la ficha técnica sale un mensaje de error | Algún valor no es válido (negativo, vacío o incoherente, p. ej. superficie disponible mayor que la total) | El mensaje dice qué campo falla. Corregirlo y volver a guardar |
| El botón de **DXF** no aparece o no descarga | El DXF solo existe para el Nidal y solo si el estudio es viable | Comprobar que es un nidal viable. Si aun así falla, mirar registros del backend |
| El **PDF** sale cortado, sin colores o descolocado | Navegador o ajustes de impresión | Usar **Chrome o Edge**. En el diálogo de impresión: destino «Guardar como PDF», márgenes «Predeterminados», escala 100 %, y activar «Gráficos de fondo». Exportar con los botones «PDF cliente» o «PDF técnico» de la herramienta |
| Se ha subido un cambio a GitHub y **la web no se actualiza** | El despliegue automático ha fallado o el runner del servidor está apagado | En GitHub → pestaña *Actions*: ver si el último despliegue está en rojo (fallo en tests o build) o «en cola» (runner apagado). Ver el apartado 8 |
| De repente la web muestra **una versión antigua o distinta** | Alguien ha lanzado `docker compose up` desde la copia de desarrollo (`/home/goyco/apps/calculadora-capacidad`), que usa el mismo nombre y reemplaza a la de producción | Volver a desplegar la buena (6.4) |
| La herramienta va muy lenta o el servidor no responde | Falta de recursos del servidor (disco o memoria) | `df -h` (disco) y `free -h` (memoria). Si el disco está lleno, limpiar imágenes antiguas: `docker image prune -f` |

## 6. Comandos del servidor

Se entra por SSH al servidor `SRV-DOCKER-aviario` (o desde la terminal de code-server,
puerto 8080) y se va a la carpeta de la herramienta:

```bash
cd /home/goyco/herramienta-interna
```

Todos los comandos de abajo se ejecutan **desde esa carpeta**. Ninguno borra datos.

### 6.1 Ver si está funcionando

```bash
docker compose ps
```

Deben salir `backend_herramienta` y `frontend_herramienta` con estado `Up`. Si alguno pone
`Restarting` o `Exited`, hay un problema: mirar los registros.

### 6.2 Ver los registros (qué ha pasado)

```bash
docker compose logs --tail 100 backend     # motor de cálculo
docker compose logs --tail 100 frontend    # web
docker compose logs -f backend             # en directo (salir con Ctrl+C)
```

Las líneas con `ERROR` o `Traceback` son las importantes. Cópialas si hay que escalar.

### 6.3 Reiniciar

```bash
docker compose restart            # reinicia las dos piezas
docker compose up -d              # arranca lo que esté parado
```

Reiniciar no pierde nada: la ficha técnica está guardada en disco.

### 6.4 Volver a desplegar la versión oficial (master)

Lo hace solo GitHub al subir cambios, pero se puede forzar a mano:

```bash
git fetch origin master
git checkout -f -B master origin/master
docker compose up -d --build
docker compose ps
```

Tarda unos minutos (vuelve a construir la web). También se puede lanzar desde GitHub →
*Actions* → «Integración y Despliegue Continuo» → *Run workflow*.

> **Nunca** ejecutes `docker compose up` desde `/home/goyco/apps/calculadora-capacidad`
> (la copia de desarrollo): sustituye a la herramienta de producción.

## 7. Copia de seguridad

Lo único que hay que guardar es la ficha técnica, si se ha personalizado:

```bash
cp /home/goyco/herramienta-interna/backend/datos/ficha_tecnica.json ~/ficha_tecnica_$(date +%F).json
```

Para restaurarla, copiar el archivo de vuelta a `backend/datos/ficha_tecnica.json` y
ejecutar `docker compose restart backend`.

Haz una copia **antes** de cambios importantes en la ficha. El código está en GitHub, no
necesita copia.

## 8. El despliegue automático

Cada vez que se sube un cambio a la rama `master` de GitHub:

1. GitHub ejecuta las pruebas de cálculo y construye la aplicación.
2. Si todo pasa, el servidor (un programa llamado *runner*, instalado en
   `SRV-DOCKER-aviario`) descarga la versión nueva y reinicia los contenedores.

Si las pruebas fallan, **no se despliega nada** y la versión anterior sigue funcionando:
es una protección. Si el despliegue se queda «en cola» mucho tiempo, el runner está
apagado: en GitHub → *Settings* → *Actions* → *Runners* se ve si está *Online*. Para
encenderlo hace falta acceso de administrador al servidor (ver la documentación técnica).

## 9. Qué datos recoger antes de escalar

Si no se puede resolver, pasa a la persona técnica:

- Qué estaba haciendo el usuario y la **hora aproximada**.
- Los **datos introducidos** (módulo, sistema, ancho, largo, altura, slots, niveles…).
- **Captura de pantalla** del error.
- Salida de `docker compose ps` y de `docker compose logs --tail 200 backend`.
- Si la ficha técnica estaba personalizada (se ve en su pestaña).

## 10. Glosario

| Término | Significado |
|---|---|
| **Nave** | Edificio donde se alojan las gallinas. Se mide ancho, largo y altura libre |
| **Nidal colectivo A-Nida** | Producto de G&C: cadena de módulos de puesta en el centro de la nave |
| **Aviario** | Producto de G&C: estructura de 2 o 3 pisos donde viven las gallinas, en filas |
| **Módulo** | Unidad del producto. Ambos alojan 144 gallinas por módulo |
| **Slot / slat** | Emparrillado a los lados del nidal (0, 1, 2 o 3 m por lado). Cuenta para densidad, no para yacija |
| **Tensor** | Pieza al final de la cadena de nidales que la tensa |
| **Local técnico** | Zona del motor y la mesa de recogida de huevos; puede ir dentro o fuera de la nave |
| **Zona de equipos** | Espacio libre en los extremos de las filas de aviario; no cuenta para nada |
| **Densidad** | Gallinas por m² útil. Máximo 9 (6 en ecológico) |
| **Yacija** | Suelo con cama (paja, viruta). Debe ser al menos 1/3 del suelo y 250 cm² por gallina |
| **Régimen / sistema** | Suelo, campero o ecológico. Cambia los límites legales |
| **Pasto** | Terreno exterior (campero y ecológico): 4 m² por gallina |
| **Parque** | Zona exterior cubierta. Es informativa: no aumenta la capacidad |
| **Aforo** | Número máximo de gallinas que permite la normativa. Manda el criterio más restrictivo (el «limitante») |
| **Ficha técnica** | Medidas y equipamiento de los módulos que usa el cálculo. Editable desde la web |
| **Margen de incertidumbre** | % que se resta para dar un intervalo de capacidad (mínimo–máximo) en el informe |
