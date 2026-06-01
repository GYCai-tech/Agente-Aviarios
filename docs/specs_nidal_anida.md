# Especificaciones Técnicas — Nidal Colectivo A-Nida

Documento de referencia para el agente de disposición.

---

## Dimensiones del módulo

| Parámetro | Valor |
|---|---|
| Largo (a lo largo de nave) | 1,20 m |
| Ancho (cruza el ancho de nave) | 1,40 m |
| Huella cuerpo | 1,20 × 1,40 = 1,68 m² |
| Alto | no determinante para el layout |
| Capacidad | 144 gallinas / módulo |

---

## Orientación en nave

El lado de **1,20 m va siempre paralelo al eje largo de la nave**.
Los módulos se encadenan sin separación en esta dirección.

El lado de **1,40 m cruza el ancho de la nave** (profundidad del cuerpo).
Los slats salen de las caras de **1,20 m** (las que miran a lo largo de nave,
perpendiculares a las paredes laterales) y se extienden hacia dichas paredes.

```
←————————————— LARGO NAVE ——————————→

    ↑ PARED LATERAL
    │
    │  slat (1,20 m ancho × N m largo, hacia pared lateral)
    ├──────┬──────┬──────┬──────┐
    │  M1  │  M2  │  M3  │  M4  │  ← cuerpo: 1,40 m cruza ancho nave
    ├──────┴──────┴──────┴──────┘
    │  slat (1,20 m ancho × N m largo, hacia pared lateral)
    │
    ↓ PARED LATERAL

    ←1,20→←1,20→←1,20→←1,20→  (módulos encadenados sin hueco a lo largo)
```

---

## Slats

Los slats son las rampas de acceso acopladas al cuerpo. Las gallinas entran y
salen del nidal a través de ellos.

**Los slats salen siempre de las caras de 1,20 m** del cuerpo (las caras
perpendiculares a las paredes laterales), extendiéndose hacia dichas paredes.

| Parámetro | Valor |
|---|---|
| Ancho | 1,20 m (igual que la cara del cuerpo de la que salen) |
| Largo disponible | 1 m, 2 m o 3 m |
| Preferencia | **3 m siempre que sea posible** |
| Lados | uno o dos (ver reglas de disposición) |

**Los slats no computan como superficie de yacija.**
Tampoco computa el cuerpo del módulo.
Todo el resto de suelo de la nave sí es yacija.

```
sup_yacija = S_nave − num_modulos × (1,68 + 1,20 × (slat_izq + slat_der))
# 1,68 = cuerpo (1,20 × 1,40); 1,20 = ancho del slat (cara de la que sale)
```

---

## Disposición en nave

### Salidas

El módulo tiene **salida por ambos lados** (izquierdo y derecho, hacia ambas
paredes laterales). En condiciones normales lleva slat en los dos lados.

```
PARED LATERAL izq  ←slat→  [——cuerpo 1,40 m——]  ←slat→  PARED LATERAL der
                   ← N m →  ←————1,40 m————→   ← N m →
                             ←—1,20 m—→ (encadenamiento)
```

### Contra pared

El módulo **puede colocarse pegado a una pared lateral** suprimiendo el slat
de ese lado. No hay clearance mínimo a la pared cuando no hay slat.

```
PARED │  [——cuerpo——]  [slat 3 m]
```

### No van espalda con espalda

Los nidales **nunca se colocan espalda con espalda**. Al tener salida en ambos
lados siempre necesitan espacio accesible a cada cara del cuerpo.

### Encadenamiento

Los módulos se encadenan **sin separación** a lo largo de la nave formando
una fila continua. No hay espacio mínimo entre módulos contiguos de la misma fila.

---

## Reglas de selección de slat (cascade)

Preferencia de mayor a menor. Se usa la primera configuración que cumpla:
1. La profundidad total cabe en el ancho de la nave (`1,20 + slat_izq + slat_der ≤ ancho_nave`)
2. La superficie de yacija resultante cumple normativa (≥ S/3)

| Prioridad | Slat izq | Slat der | Prof. total (cruza ancho nave) |
|---|---|---|---|
| 1 | 3 m | 3 m | 7,40 m |
| 2 | 3 m | 2 m | 6,40 m |
| 3 | 2 m | 2 m | 5,40 m |
| 4 | 3 m | 1 m | 5,40 m |
| 5 | 2 m | 1 m | 4,40 m |
| 6 | 1 m | 1 m | 3,40 m |
| 7 | 3 m | 0 m | 4,40 m |
| 8 | 2 m | 0 m | 3,40 m |
| 9 | 1 m | 0 m | 2,40 m |

Slat = 0 m solo cuando el módulo va pegado a una pared (sin acceso por ese lado).

La profundidad total que cruza el ancho de nave es el cuerpo (1,40 m) más los slats:
```
prof_total = 1,40 + slat_izq + slat_der  ≤ ancho_nave
```

---

## Cálculo de superficie efectiva (densidad normativa)

El cuerpo físico descuenta la densidad; los slats no:

```
sup_efectiva  = S_nave − num_modulos × 1,68
densidad_real = num_gallinas / sup_efectiva
```

---

## Datos pendientes de confirmar

- [ ] Clearances entre filas de nidales paralelas (si se colocan en paralelo)
- [ ] ¿Hay separación mínima entre módulos contiguos de la misma fila?
