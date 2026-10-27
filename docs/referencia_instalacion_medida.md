# Referencia de aforo: instalación inspeccionada en Galicia

Caso de regresión basado en el anexo oficial aportado en `doc03347920260916095719.pdf`. Los valores se guardan sin datos identificativos en [`inspeccion_galicia_ponedoras.json`](../backend/referencias/inspeccion_galicia_ponedoras.json).

## Geometría y superficies que declara el acta

- Suelo de nave: **28,96 × 13,80 = 399,648 m²**.
- Superficie útil total de los niveles de aviario declarada: **1.065,148 m²**.
- Distribución de superficie: nivel 0, 399,648 m²; nivel 1, 221,544 m²; nivel 2, 187,66 m²; nivel 3, 256,296 m². Los niveles elevados se calculan con 3 módulos en cada sección.
- Preparque declarado: **1,212 × 33,092 = 40,107504 m²**, que se redondea a 40,1075 m².
- Pasto: **39.817 m²**.

El informe agrupa 24 posiciones, 2 niveles y 3 módulos por posición: **144 módulos**. No da la altura libre total de la nave ni la yacija medida; esos datos no se deducen de la tabla.

## Equipamiento medido

- 144 superficies interiores de nidal de 1,19 × 0,495 m: **84,8232 m²** en total.
- **1.303,2 m de perchas**.
- **1.038,24 m** de comedero lineal accesible.
- **1.512** bebederos de pezón o copa.
- **21,5 m** de anchura útil de salidas.

## Comprobación de aforo

El cálculo carga 1.065,148 m² útiles por niveles más los 40,1075 m² de preparque computados en esta acta. Con los requisitos de suelo/campero, cada límite queda así:

| Criterio | Capacidad calculada |
|---|---:|
| Densidad, 9 gallinas/m² | 9.947 |
| Nidales, 1 m²/120 gallinas | 10.178 |
| Perchas, 15 cm/gallina | **8.688** |
| Comedero lineal, 10 cm/gallina | 10.382 |
| Bebederos, 1 por 10 gallinas | 15.120 |
| Pasto, 4 m²/gallina | 9.954 |
| Salidas, 2 m por cada 1.000 gallinas | 10.750 |

El aforo resultado es **8.688 gallinas, limitado por las perchas**, igual que en el acta. La yacija permanece pendiente de medición porque el acta no la cuantifica. El ensayo está automatizado en `test_calculos_capacidad.py` y ejecuta el mismo motor que el endpoint `/aforo-medido`.

Esta referencia valida una instalación existente. Sus superficies por niveles y el inventario de 144 módulos no sustituyen las dimensiones de diseño de cada modelo ni se extrapolan a otras naves. Para validar una distribución nueva se requieren las dimensiones certificadas del producto y la altura libre de la nave.
