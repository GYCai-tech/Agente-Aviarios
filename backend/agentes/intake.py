import math
from typing import Literal, Optional
from pydantic import BaseModel


Sistema = Literal["suelo", "campero", "ecologico", "jaulas"]
TipoNidal = Literal["individual", "colectivo"]


class DatosIntake(BaseModel):
    num_gallinas: int
    sistema: Sistema
    superficie_nave_m2: float
    tipo_nidal: Optional[TipoNidal] = None  # solo sistemas alternativos


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
        _informe_alternativo(n, datos, verificaciones, requisitos, advertencias)

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


def _informe_alternativo(n, datos, verificaciones, requisitos, advertencias):
    densidad_max = 6.0 if datos.sistema == "ecologico" else 9.0
    densidad_real = n / datos.superficie_nave_m2

    verificaciones.append(VerificacionNave(
        parametro="Densidad interior",
        cumple=densidad_real <= densidad_max,
        valor_real=round(densidad_real, 2),
        valor_limite=densidad_max,
        unidad="gallinas/m²",
        tipo_limite="maximo",
        articulo="RD 3/2002 Anexo IV" + (" + Regl. UE 2018/848" if datos.sistema == "ecologico" else ""),
    ))

    # Yacija
    yacija_min_m2 = round(n * 250 / 10_000, 2)
    yacija_minima_tercio = round(datos.superficie_nave_m2 / 3, 2)
    yacija_real_min = max(yacija_min_m2, yacija_minima_tercio)

    requisitos.append(RequisitoCalculado(
        nombre="Zona de yacija (área de escarbar)",
        valor_minimo=yacija_real_min,
        unidad="m²",
        formula=(
            f"máx({n} × 250 cm² = {yacija_min_m2} m²  |  "
            f"1/3 de nave = {yacija_minima_tercio} m²)"
        ),
        articulo="RD 3/2002 Anexo IV",
    ))

    # Nidales
    if datos.tipo_nidal == "individual":
        nidales_min = math.ceil(n / 7)
        requisitos.append(RequisitoCalculado(
            nombre="Nidales individuales",
            valor_minimo=float(nidales_min),
            unidad="unidades",
            formula=f"⌈{n} / 7⌉ = {nidales_min}",
            articulo="RD 3/2002 Anexo IV",
        ))
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
