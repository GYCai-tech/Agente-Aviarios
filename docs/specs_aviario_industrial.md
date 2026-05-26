# Especificaciones Técnicas — Aviario Industrial (cód. 10007)

Documento de referencia para el agente de disposición. Contiene dimensiones exactas,
clearances de instalación y reglas de layout.

---

## Dimensiones del módulo

| Parámetro | Valor |
|---|---|
| Ancho | 1,20 m |
| Largo base (planta baja) | 3,73 m |
| Largo 1ª planta | 3,38 m |
| Largo 2ª planta | 3,00 m |
| Alto total (2 niveles) | 2,816 m |
| Alto total (3 niveles) | pendiente de confirmar |
| Peso | 532,6 kg |
| Huella en planta | 1,20 × 3,73 = 4,476 m² |

La estructura se estrecha en altura: cada planta superior es más corta que la inferior.
Solo la planta baja (3,73 m) cuenta como huella a efectos de layout.

---

## Capacidad

- **144 gallinas por módulo**, independientemente del número de niveles.
- Niveles disponibles: 2 o 3 plantas.
- El número de niveles lo determina la altura libre de la nave:
  - 300–399 cm → 2 niveles
  - ≥ 400 cm → 3 niveles

---

## Orientación en nave

El lado de **1,20 m va siempre paralelo al eje largo de la nave**.
El lado de **3,73 m cruza el ancho de la nave**.

```
←————————— ANCHO DE NAVE —————————→
[——3,73 m——][——3,73 m——][——3,73 m——]
|  1,20 m  ||  1,20 m  ||  1,20 m  |   ← profundidad a lo largo
```

---

## Encadenamiento en columna

Los módulos se encadenan **sin separación** a lo largo de la nave formando columnas continuas.
No hay espacio mínimo entre módulos contiguos de la misma columna.

```
[módulo 1]   ← sin hueco
[módulo 2]   ← sin hueco
[módulo 3]
   ...
```

---

## Clearances de instalación

### Paredes laterales

| Situación | Clearance lateral |
|---|---|
| Columna única en la nave | **1 m** a cada pared lateral |
| Dos o más columnas | **4 m** desde cada pared lateral hasta la columna exterior |

El clearance lateral en columna única constituye el pasillo de acceso trasero.
En el caso de múltiples columnas, los 4 m son el pasillo principal de trabajo.

### Entre columnas espaldadas

Cuando dos columnas se colocan espalda con espalda, el espacio entre sus partes
traseras es de **1 m**. Este metro es compartido por ambas columnas y sirve de
pasillo de acceso trasero para las dos.

```
│ 4 m │←— columna A —→│ 1 m │←— columna B —→│ 4 m │
                        ↑
              acceso trasero compartido (1 m)
```

### Paredes frontales (cabeceras de nave)

Los módulos **pueden estar pegados a la pared de cabecera** sin clearance mínimo.

### Resumen de espacio por unidad de par espaldado

```
4 m (pared) + 3,73 m (col A) + 1 m (trasero) + 3,73 m (col B) + 4 m (pared) = 16,46 m mínimo
```

Para naves con ancho < 16,46 m solo cabe una columna (con 1 m a cada lateral).

---

## Superficie por módulo (para cálculo de densidad normativa)

Fuente: diseñador del producto.

| Configuración | Sup. total | Sup. disponible (excluye zona de puesta) |
|---|---|---|
| 2 plantas | 15,270 m² | 13,180 m² |
| 3 plantas | 19,328 m² | 16,194 m² |

La **superficie disponible** es la que computa para densidad normativa.
La zona de puesta no cuenta para densidad.

---

## Superficie de yacija

La yacija es el suelo bajo los módulos (huella en planta × número de módulos):

```
sup_yacija = num_modulos × 4,476 m²
```

---

## Datos pendientes de confirmar

- [ ] Altura total del módulo con **3 niveles**
