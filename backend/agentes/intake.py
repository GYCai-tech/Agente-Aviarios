import math
from typing import Literal, Optional
from pydantic import BaseModel


Sistema = Literal["suelo", "campero", "ecologico", "jaulas"]
TipoNidal = Literal["individual", "colectivo"]
TipoZona = Literal["nidal_colectivo", "aviario"]


class DatosRecomendacion(BaseModel):
    num_gallinas: int
    sistema: Sistema
    superficie_nave_m2: float
    altura_nave_cm: float


class Recomendacion(BaseModel):
    tipo_zona: TipoZona
    niveles: int
    razon: str


def _niveles_aviario(altura_cm: float) -> int:
    """Niveles del módulo A-Nida Plus según altura libre de nave."""
    if altura_cm >= 400:
        return 3
    if altura_cm >= 300:
        return 2
    return 1


def recomendar_zona(datos: DatosRecomendacion) -> Recomendacion:
    niveles_posibles = _niveles_aviario(datos.altura_nave_cm)
    densidad_bruta = datos.num_gallinas / datos.superficie_nave_m2
    densidad_max = 6.0 if datos.sistema == "ecologico" else 9.0

    # Densidad efectiva con nidal colectivo: descontar huella real de módulos
    num_modulos = math.ceil(datos.num_gallinas / 144)
    sup_modulos = round(num_modulos * 1.20 * 1.40, 2)
    sup_efectiva_nidal = datos.superficie_nave_m2 - sup_modulos
    densidad_nidal = (
        datos.num_gallinas / sup_efectiva_nidal if sup_efectiva_nidal > 0 else float("inf")
    )

    if niveles_posibles < 2:
        return Recomendacion(
            tipo_zona="nidal_colectivo",
            niveles=1,
            razon=f"Con {datos.altura_nave_cm:.0f} cm de altura libre solo cabe 1 nivel. "
                  "Se necesitan ≥ 300 cm para instalar un aviario de 2 niveles.",
        )

    densidad_con_aviario = densidad_bruta / niveles_posibles

    # Aviario necesario si la densidad bruta supera el límite O si la densidad
    # efectiva con nidal (descontando módulos) excede el límite legal.
    if densidad_bruta > densidad_max or densidad_nidal > densidad_max:
        return Recomendacion(
            tipo_zona="aviario",
            niveles=niveles_posibles,
            razon=(
                f"La densidad efectiva con nidal colectivo sería {densidad_nidal:.1f} gal/m² "
                f"(superficie real {sup_efectiva_nidal:.1f} m² tras descontar {sup_modulos:.1f} m² "
                f"de {num_modulos} módulo{'s' if num_modulos > 1 else ''}), "
                f"superando el límite de {densidad_max:.0f} gal/m² para sistema {datos.sistema}. "
                f"Un aviario de {niveles_posibles} niveles reduce la densidad efectiva a "
                f"{densidad_con_aviario:.1f} gal/m² computando todos los niveles como superficie útil "
                "(Directiva 1999/74/CE Art. 4.3.a)."
            ),
        )

    return Recomendacion(
        tipo_zona="nidal_colectivo",
        niveles=1,
        razon=(
            f"La densidad efectiva con nidal colectivo es {densidad_nidal:.1f} gal/m² "
            f"(descontados {sup_modulos:.1f} m² de {num_modulos} módulo{'s' if num_modulos > 1 else ''}), "
            f"dentro del límite de {densidad_max:.0f} gal/m² para sistema {datos.sistema}. "
            f"Con un aviario de {niveles_posibles} niveles la densidad bajaría a "
            f"{densidad_con_aviario:.1f} gal/m², pero no es necesario."
        ),
    )


class DatosIntake(BaseModel):
    num_gallinas: int
    sistema: Sistema
    superficie_nave_m2: float
    altura_nave_cm: float
    tipo_zona: TipoZona


class RequisitoCalculado(BaseModel):
    nombre: str
    valor_minimo: float
    unidad: str
    formula: str
    articulo: str


class VerificacionNave(BaseModel):
    parametro: str
    cumple: bool
    valor_real: float
    valor_limite: float
    unidad: str
    tipo_limite: Literal["minimo", "maximo"]
    articulo: str


class InformeIntake(BaseModel):
    sistema: str
    num_gallinas: int
    verificaciones_nave: list[VerificacionNave]
    requisitos: list[RequisitoCalculado]
    cumple_nave: bool
    advertencias: list[str]
    consulta_rag: str


def generar_informe(datos: DatosIntake) -> InformeIntake:
    n = datos.num_gallinas
    verificaciones: list[VerificacionNave] = []
    requisitos: list[RequisitoCalculado] = []
    advertencias: list[str] = []

    if datos.sistema == "jaulas":
        _informe_jaulas(n, datos, verificaciones, requisitos, advertencias)
    else:
        _informe_alternativo(n, datos, datos.tipo_zona, verificaciones, requisitos, advertencias)

    fallos = [v for v in verificaciones if not v.cumple]

    return InformeIntake(
        sistema=datos.sistema,
        num_gallinas=n,
        verificaciones_nave=verificaciones,
        requisitos=requisitos,
        cumple_nave=len(fallos) == 0,
        advertencias=advertencias,
        consulta_rag=_consulta_rag(datos, fallos),
    )


def _informe_jaulas(n, datos, verificaciones, requisitos, advertencias):
    sup_util_cm2 = datos.superficie_nave_m2 * 10_000
    real_cm2_por_gallina = sup_util_cm2 / n

    verificaciones.append(VerificacionNave(
        parametro="Superficie útil por gallina (jaula enriquecida)",
        cumple=real_cm2_por_gallina >= 750,
        valor_real=round(real_cm2_por_gallina, 1),
        valor_limite=750,
        unidad="cm²/gallina",
        tipo_limite="minimo",
        articulo="RD 3/2002 Anexo III",
    ))

    requisitos.append(RequisitoCalculado(
        nombre="Superficie total mínima de jaulas",
        valor_minimo=round(n * 750 / 10_000, 2),
        unidad="m²",
        formula=f"{n} gallinas × 750 cm²/gallina ÷ 10.000",
        articulo="RD 3/2002 Anexo III",
    ))
    requisitos.append(RequisitoCalculado(
        nombre="Comederos lineales",
        valor_minimo=round(n * 12.0 / 100, 2),
        unidad="m lineales",
        formula=f"{n} gallinas × 12 cm/gallina",
        articulo="RD 3/2002 Anexo III",
    ))
    requisitos.append(RequisitoCalculado(
        nombre="Perchas",
        valor_minimo=round(n * 15.0 / 100, 2),
        unidad="m lineales",
        formula=f"{n} gallinas × 15 cm/gallina",
        articulo="RD 3/2002 Anexo III",
    ))

    advertencias.append(
        "Cada jaula debe incluir: nido individual, zona de yacija para picotear/escarbar "
        "y dispositivo de recorte de uñas (RD 3/2002 Anexo III)."
    )
    if n > 40_000:
        advertencias.append(
            f"Explotación de {n} gallinas supera las 40.000 ponedoras: "
            "obligación de aplicar Mejores Técnicas Disponibles (MTDs) para emisiones de amoniaco "
            "(RD 637/2021 Art. 12)."
        )


def _informe_alternativo(n, datos, tipo_zona, verificaciones, requisitos, advertencias):
    densidad_max = 6.0 if datos.sistema == "ecologico" else 9.0

    if tipo_zona == "aviario":
        niveles = _niveles_aviario(datos.altura_nave_cm)
        sup_efectiva = datos.superficie_nave_m2 * niveles
        densidad_real = n / sup_efectiva
        parametro_label = f"Densidad interior (aviario {niveles} niveles — sup. efectiva {sup_efectiva:.0f} m²)"
        articulo_densidad = "Directiva 1999/74/CE Art. 4.3.a + RD 3/2002 Anexo IV"
    else:
        niveles = 1
        num_modulos = math.ceil(n / 144)
        sup_modulos = round(num_modulos * 1.20 * 1.40, 2)  # 1,68 m² por módulo (planta 1,2×1,4)
        sup_efectiva = round(datos.superficie_nave_m2 - sup_modulos, 2)
        densidad_real = n / sup_efectiva if sup_efectiva > 0 else float("inf")
        parametro_label = (
            f"Densidad interior (sup. real {sup_efectiva:.1f} m² — "
            f"descontados {sup_modulos:.1f} m² de {num_modulos} módulos)"
        )
        articulo_densidad = "RD 3/2002 Anexo IV" + (" + Regl. UE 2018/848" if datos.sistema == "ecologico" else "")

    verificaciones.append(VerificacionNave(
        parametro=parametro_label,
        cumple=densidad_real <= densidad_max,
        valor_real=round(densidad_real, 2),
        valor_limite=densidad_max,
        unidad="gallinas/m²",
        tipo_limite="maximo",
        articulo=articulo_densidad,
    ))

    # Módulos de nidal (solo nidal_colectivo)
    if tipo_zona == "nidal_colectivo":
        requisitos.append(RequisitoCalculado(
            nombre="Número de módulos de nidal",
            valor_minimo=float(num_modulos),
            unidad="módulos",
            formula=f"⌈{n} / 144⌉ = {num_modulos} módulo(s) × 1,20 m × 1,40 m = {sup_modulos} m² ocupados",
            articulo="Diseño A-Nida Plus (Gómez y Crespo)",
        ))
        requisitos.append(RequisitoCalculado(
            nombre="Superficie disponible (descontados módulos)",
            valor_minimo=sup_efectiva,
            unidad="m²",
            formula=f"{datos.superficie_nave_m2} m² nave − {num_modulos} × 1,68 m² = {sup_efectiva} m²",
            articulo="Cálculo interno",
        ))

    # Yacija
    yacija_min_m2 = round(n * 250 / 10_000, 2)
    yacija_minima_tercio = round(datos.superficie_nave_m2 / 3, 2)
    yacija_requerida = max(yacija_min_m2, yacija_minima_tercio)

    if tipo_zona == "nidal_colectivo":
        # Slot acoplado al módulo: 1,20 m × 3 m adicionales por módulo
        sup_slot = round(num_modulos * 1.20 * 3, 2)
        sup_yacija_disponible = round(datos.superficie_nave_m2 - sup_modulos - sup_slot, 2)
        verificaciones.append(VerificacionNave(
            parametro=(
                f"Superficie yacija real ({sup_yacija_disponible:.1f} m² — "
                f"descontados {sup_modulos} m² módulos + {sup_slot} m² slots)"
            ),
            cumple=sup_yacija_disponible >= yacija_requerida,
            valor_real=sup_yacija_disponible,
            valor_limite=yacija_requerida,
            unidad="m²",
            tipo_limite="minimo",
            articulo="RD 3/2002 Anexo IV",
        ))
        requisitos.append(RequisitoCalculado(
            nombre="Zona de yacija mínima requerida",
            valor_minimo=yacija_requerida,
            unidad="m²",
            formula=(
                f"máx({n} × 250 cm² = {yacija_min_m2} m²  |  "
                f"1/3 nave = {yacija_minima_tercio} m²)"
            ),
            articulo="RD 3/2002 Anexo IV",
        ))
        requisitos.append(RequisitoCalculado(
            nombre="Superficie yacija disponible",
            valor_minimo=sup_yacija_disponible,
            unidad="m²",
            formula=(
                f"{datos.superficie_nave_m2} m² nave "
                f"− {sup_modulos} m² módulos ({num_modulos} × 1,68 m²) "
                f"− {sup_slot} m² slots ({num_modulos} × 3,6 m²) "
                f"= {sup_yacija_disponible} m²"
            ),
            articulo="Cálculo interno",
        ))
    else:
        # Aviario: todo el suelo es yacija
        requisitos.append(RequisitoCalculado(
            nombre="Zona de yacija (área de escarbar)",
            valor_minimo=yacija_requerida,
            unidad="m²",
            formula=(
                f"máx({n} × 250 cm² = {yacija_min_m2} m²  |  "
                f"1/3 de nave = {yacija_minima_tercio} m²)"
            ),
            articulo="RD 3/2002 Anexo IV",
        ))

    # Zona de puesta
    if tipo_zona == "aviario":
        sup_nidal_min = round(n / 120, 2)
        requisitos.append(RequisitoCalculado(
            nombre=f"Aviario multinivel — niveles recomendados",
            valor_minimo=float(niveles),
            unidad="niveles",
            formula=f"{'≥400 cm → 3' if datos.altura_nave_cm >= 400 else '≥300 cm → 2' if datos.altura_nave_cm >= 300 else '<300 cm → 1'} (altura nave: {datos.altura_nave_cm:.0f} cm)",
            articulo="Directiva 1999/74/CE Art. 4.3.a",
        ))
        requisitos.append(RequisitoCalculado(
            nombre="Superficie zona de puesta por nivel",
            valor_minimo=sup_nidal_min,
            unidad="m²",
            formula=f"{n} gallinas / 120 = {sup_nidal_min} m²",
            articulo="RD 3/2002 Anexo IV",
        ))
        advertencias.append(
            f"Aviario multinivel: altura libre entre niveles ≥ 45 cm, "
            "comederos y bebederos distribuidos en cada nivel, "
            "sistema que impida caída de excrementos sobre niveles inferiores "
            "(Directiva 1999/74/CE Art. 4.3.a)."
        )
    else:
        sup_nidal_min = round(n / 120, 2)
        requisitos.append(RequisitoCalculado(
            nombre="Superficie zona de puesta colectiva",
            valor_minimo=sup_nidal_min,
            unidad="m²",
            formula=f"{n} gallinas / 120 = {sup_nidal_min} m²",
            articulo="RD 3/2002 Anexo IV",
        ))

    # Perchas
    requisitos.append(RequisitoCalculado(
        nombre="Perchas",
        valor_minimo=round(n * 15 / 100, 2),
        unidad="m lineales",
        formula=f"{n} gallinas × 15 cm/gallina",
        articulo="RD 3/2002 Anexo IV",
    ))

    # Comederos
    requisitos.append(RequisitoCalculado(
        nombre="Comederos lineales",
        valor_minimo=round(n * 10 / 100, 2),
        unidad="m lineales",
        formula=f"{n} gallinas × 10 cm/gallina",
        articulo="RD 3/2002 Anexo IV",
    ))
    requisitos.append(RequisitoCalculado(
        nombre="Comederos circulares (alternativa)",
        valor_minimo=round(n * 4 / 100, 2),
        unidad="m de perímetro",
        formula=f"{n} gallinas × 4 cm/gallina",
        articulo="RD 3/2002 Anexo IV",
    ))

    # Bebederos
    requisitos.append(RequisitoCalculado(
        nombre="Bebedero de canal",
        valor_minimo=round(n * 2.5 / 100, 2),
        unidad="m lineales",
        formula=f"{n} gallinas × 2,5 cm/gallina",
        articulo="RD 3/2002 Anexo IV",
    ))
    requisitos.append(RequisitoCalculado(
        nombre="Bebederos pezón/copa (alternativa)",
        valor_minimo=float(math.ceil(n / 10)),
        unidad="unidades",
        formula=f"⌈{n} / 10⌉ = {math.ceil(n / 10)}",
        articulo="RD 3/2002 Anexo IV",
    ))

    # Extras campero / ecológico
    if datos.sistema in ("campero", "ecologico"):
        sup_exterior_min = round(n * 4, 2)
        requisitos.append(RequisitoCalculado(
            nombre="Superficie exterior",
            valor_minimo=sup_exterior_min,
            unidad="m²",
            formula=f"{n} gallinas × 4 m²/gallina",
            articulo="Regl. CE 589/2008 Anexo II",
        ))
        trampillas_min = round(n / 1000 * 200, 1)
        requisitos.append(RequisitoCalculado(
            nombre="Apertura total de trampillas al exterior",
            valor_minimo=trampillas_min,
            unidad="cm de ancho total",
            formula=f"{n} gallinas / 1.000 × 200 cm = {trampillas_min} cm",
            articulo="RD 3/2002 Anexo IV",
        ))

    if datos.sistema == "ecologico" and n > 3000:
        advertencias.append(
            f"El sistema ecológico tiene un máximo de 3.000 gallinas por unidad de producción. "
            f"Con {n} gallinas necesitarás {math.ceil(n / 3000)} unidades separadas "
            "(Regl. UE 2018/848)."
        )

    if n > 40_000:
        advertencias.append(
            f"Explotación de {n} gallinas supera las 40.000 ponedoras: "
            "obligación de aplicar Mejores Técnicas Disponibles (MTDs) para emisiones de amoniaco "
            "(RD 637/2021 Art. 12)."
        )

    advertencias.append(
        "Requisitos fijos independientemente del tamaño: registro en REGA, "
        "Sistema Integral de Gestión (SIGE), plan sanitario, veterinario de explotación "
        "y vallado perimetral (RD 637/2021)."
    )


def consulta_ventas(datos: DatosIntake, requisitos: list[RequisitoCalculado]) -> str:
    sistema_label = {
        "suelo": "en suelo", "campero": "campero",
        "ecologico": "ecológico", "jaulas": "en jaulas enriquecidas"
    }[datos.sistema]
    zona_label = "aviario multinivel" if datos.tipo_zona == "aviario" else "nidal colectivo"
    reqs_txt = "; ".join(
        f"{r.nombre}: {r.valor_minimo} {r.unidad}" for r in requisitos
    )
    return (
        f"Eres asesor comercial de Gómez y Crespo, empresa especializada en equipamiento avícola. "
        f"Una granja de {datos.num_gallinas} gallinas ponedoras en sistema {sistema_label} "
        f"con zona de puesta tipo {zona_label} necesita el siguiente equipamiento mínimo: {reqs_txt}. "
        f"Redacta un argumentario de ventas en 3 párrafos cortos que justifique por qué Gómez y Crespo "
        f"es la mejor opción para cubrir estas necesidades. "
        f"Destaca: productos A-Nida Plus, calidad de materiales (acero galvanizado y polímeros de alta "
        f"resistencia, rejillas triple galvanizado tres veces más resistentes a la corrosión), "
        f"cumplimiento normativo garantizado, rentabilidad a largo plazo y servicio técnico especializado. "
        f"Tono profesional y persuasivo."
    )


def _consulta_rag(datos: DatosIntake, fallos: list[VerificacionNave]) -> str:
    sistema_label = {
        "suelo": "en suelo", "campero": "campero",
        "ecologico": "ecológico", "jaulas": "en jaulas enriquecidas"
    }[datos.sistema]

    partes = [
        f"Granja avícola de {datos.num_gallinas} gallinas ponedoras en sistema {sistema_label}, "
        f"nave de {datos.superficie_nave_m2} m²."
    ]
    if fallos:
        partes.append("La nave no cumple los siguientes parámetros:")
        for f in fallos:
            partes.append(
                f"- {f.parametro}: {f.valor_real} {f.unidad} "
                f"(límite {f.tipo_limite}: {f.valor_limite} {f.unidad})."
            )
        partes.append("¿Qué artículos se incumplen y qué debe corregirse?")
    else:
        partes.append(
            "La nave cumple los parámetros básicos. "
            "¿Qué requisitos adicionales y recomendaciones aplican a este tipo de explotación?"
        )
    return " ".join(partes)
