import math
from typing import Optional, Literal
from pydantic import BaseModel


Sistema = Literal["suelo", "campero", "ecologico"]
TipoNidal = Literal["individual", "colectivo", "aviario"]
TipoComedero = Literal["lineal", "circular"]
TipoBebedero = Literal["canal", "pezon"]


class DatosGranja(BaseModel):
    num_gallinas: int
    sistema: Sistema

    # Nave
    superficie_nave_m2: float
    altura_libre_cm: float

    # Nidales
    tipo_nidal: TipoNidal
    num_nidales: Optional[int] = None          # si individual
    superficie_nidales_m2: Optional[float] = None  # si colectivo

    # Equipamiento
    longitud_perchas_cm: float
    tipo_comedero: TipoComedero
    longitud_comederos_cm: Optional[float] = None    # si lineal
    perimetro_comederos_cm: Optional[float] = None   # si circular
    tipo_bebedero: TipoBebedero
    longitud_bebedero_canal_cm: Optional[float] = None
    num_bebederos_pezon: Optional[int] = None

    # Exterior — obligatorio en campero/ecológico
    superficie_exterior_m2: Optional[float] = None
    ancho_total_salidas_cm: Optional[float] = None


class Verificacion(BaseModel):
    parametro: str
    valor_real: float
    valor_referencia: float
    unidad: str
    tipo_limite: Literal["minimo", "maximo"]
    cumple: bool
    diferencia: float   # positivo = margen OK, negativo = cuánto falta/sobra
    articulo: str


class InformeConformidad(BaseModel):
    sistema: str
    num_gallinas: int
    verificaciones: list[Verificacion]
    cumple_todo: bool
    num_fallos: int
    consulta_rag: str


def _check_min(parametro: str, real: float, minimo: float, unidad: str, articulo: str) -> Verificacion:
    return Verificacion(
        parametro=parametro,
        valor_real=round(real, 2),
        valor_referencia=round(minimo, 2),
        unidad=unidad,
        tipo_limite="minimo",
        cumple=real >= minimo,
        diferencia=round(real - minimo, 2),
        articulo=articulo,
    )


def _check_max(parametro: str, real: float, maximo: float, unidad: str, articulo: str) -> Verificacion:
    return Verificacion(
        parametro=parametro,
        valor_real=round(real, 2),
        valor_referencia=round(maximo, 2),
        unidad=unidad,
        tipo_limite="maximo",
        cumple=real <= maximo,
        diferencia=round(maximo - real, 2),
        articulo=articulo,
    )


def validar_conformidad(datos: DatosGranja) -> InformeConformidad:
    n = datos.num_gallinas
    checks: list[Verificacion] = []

    # --- DENSIDAD (gallinas/m²) ---
    densidad_max = 6.0 if datos.sistema == "ecologico" else 9.0
    densidad_real = n / datos.superficie_nave_m2
    checks.append(_check_max(
        "Densidad interior", densidad_real, densidad_max, "gallinas/m²",
        "RD 3/2002 Anexo II" + (" + Regl. UE 2018/848" if datos.sistema == "ecologico" else "")
    ))

    # --- ALTURA LIBRE ---
    checks.append(_check_min(
        "Altura libre sobre el suelo", datos.altura_libre_cm, 45.0, "cm",
        "RD 3/2002 Anexo II"
    ))

    # --- PERCHAS ---
    checks.append(_check_min(
        "Perchas", datos.longitud_perchas_cm, n * 15.0, "cm lineales",
        "RD 3/2002 Anexo II"
    ))

    # --- NIDALES ---
    if datos.tipo_nidal == "individual":
        nidales_min = math.ceil(n / 7)
        checks.append(_check_min(
            "Nidales individuales", float(datos.num_nidales or 0), float(nidales_min), "unidades",
            "RD 3/2002 Anexo II"
        ))
    elif datos.tipo_nidal == "aviario":
        sup_min = n / 120.0
        checks.append(_check_min(
            "Superficie zona de puesta (aviario)", datos.superficie_nidales_m2 or 0.0, sup_min, "m²",
            "RD 3/2002 Anexo II"
        ))
    else:
        sup_min = n / 120.0
        checks.append(_check_min(
            "Superficie nidales colectivos", datos.superficie_nidales_m2 or 0.0, sup_min, "m²",
            "RD 3/2002 Anexo II"
        ))

    # --- COMEDEROS ---
    if datos.tipo_comedero == "lineal":
        checks.append(_check_min(
            "Comederos lineales", datos.longitud_comederos_cm or 0.0, n * 10.0, "cm lineales",
            "RD 3/2002 Anexo II"
        ))
    else:
        checks.append(_check_min(
            "Comederos circulares (perímetro)", datos.perimetro_comederos_cm or 0.0, n * 4.0, "cm de perímetro",
            "RD 3/2002 Anexo II"
        ))

    # --- BEBEDEROS ---
    if datos.tipo_bebedero == "canal":
        checks.append(_check_min(
            "Bebedero de canal", datos.longitud_bebedero_canal_cm or 0.0, n * 2.5, "cm de canal",
            "RD 3/2002 Anexo II"
        ))
    else:
        checks.append(_check_min(
            "Bebederos pezón/copa", float(datos.num_bebederos_pezon or 0), float(math.ceil(n / 10)), "unidades",
            "RD 3/2002 Anexo II"
        ))

    # --- EXTERIOR (campero y ecológico) ---
    if datos.sistema in ("campero", "ecologico"):
        checks.append(_check_min(
            "Superficie exterior", datos.superficie_exterior_m2 or 0.0, n * 4.0, "m²",
            "Regl. CE 589/2008 Anexo II"
        ))
        # 2 m de apertura por cada 100 m² de nave interior
        salidas_min = (datos.superficie_nave_m2 / 100.0) * 200.0
        checks.append(_check_min(
            "Ancho total salidas al exterior", datos.ancho_total_salidas_cm or 0.0, salidas_min, "cm de apertura",
            "Regl. CE 589/2008 Anexo II"
        ))

    # --- TAMAÑO MÁXIMO DE MANADA (ecológico) ---
    if datos.sistema == "ecologico":
        checks.append(_check_max(
            "Tamaño de manada (ecológico)", float(n), 3000.0, "gallinas por unidad",
            "Regl. UE 2018/848"
        ))

    fallos = [c for c in checks if not c.cumple]
    cumple_todo = len(fallos) == 0

    return InformeConformidad(
        sistema=datos.sistema,
        num_gallinas=n,
        verificaciones=checks,
        cumple_todo=cumple_todo,
        num_fallos=len(fallos),
        consulta_rag=_construir_consulta_rag(datos, fallos),
    )


# ── CALCULADORA ──────────────────────────────────────────────────────────────

class DatosCalculadora(BaseModel):
    num_gallinas: int
    sistema: Sistema
    superficie_nave_m2: float
    altura_libre_cm: float
    tipo_nidal: TipoNidal
    num_nidales: Optional[int] = None
    superficie_nidales_m2: Optional[float] = None
    superficie_exterior_m2: Optional[float] = None
    ancho_total_salidas_cm: Optional[float] = None


class RequisitoEquipamiento(BaseModel):
    nombre: str
    valor_minimo: float
    unidad: str
    formula: str
    articulo: str


class InformeCalculadora(BaseModel):
    sistema: str
    num_gallinas: int
    verificaciones: list[Verificacion]
    requisitos: list[RequisitoEquipamiento]
    cumple_nave: bool
    num_fallos: int
    consulta_rag: str


def calcular_granja(datos: DatosCalculadora) -> InformeCalculadora:
    n = datos.num_gallinas
    checks: list[Verificacion] = []
    req: list[RequisitoEquipamiento] = []

    # --- Verificaciones de nave ---
    densidad_max = 6.0 if datos.sistema == "ecologico" else 9.0
    densidad_real = n / datos.superficie_nave_m2
    checks.append(_check_max(
        "Densidad interior", densidad_real, densidad_max, "gallinas/m²",
        "RD 3/2002 Anexo II" + (" + Regl. UE 2018/848" if datos.sistema == "ecologico" else "")
    ))
    checks.append(_check_min(
        "Altura libre sobre el suelo", datos.altura_libre_cm, 45.0, "cm",
        "RD 3/2002 Anexo II"
    ))

    # --- Verificaciones de nidales ---
    if datos.tipo_nidal == "individual":
        nidales_min = math.ceil(n / 7)
        checks.append(_check_min(
            "Nidales individuales", float(datos.num_nidales or 0), float(nidales_min), "unidades",
            "RD 3/2002 Anexo II"
        ))
    elif datos.tipo_nidal == "aviario":
        sup_min = round(n / 120.0, 2)
        checks.append(_check_min(
            "Superficie zona de puesta (aviario)", datos.superficie_nidales_m2 or 0.0, sup_min, "m²",
            "RD 3/2002 Anexo II"
        ))
    else:
        sup_min = round(n / 120.0, 2)
        checks.append(_check_min(
            "Superficie nidales colectivos", datos.superficie_nidales_m2 or 0.0, sup_min, "m²",
            "RD 3/2002 Anexo II"
        ))

    # --- Verificaciones de exterior ---
    if datos.sistema in ("campero", "ecologico"):
        checks.append(_check_min(
            "Superficie exterior", datos.superficie_exterior_m2 or 0.0, n * 4.0, "m²",
            "Regl. CE 589/2008 Anexo II"
        ))
        salidas_min = (datos.superficie_nave_m2 / 100.0) * 200.0
        checks.append(_check_min(
            "Ancho total salidas al exterior", datos.ancho_total_salidas_cm or 0.0, salidas_min, "cm de apertura",
            "Regl. CE 589/2008 Anexo II"
        ))

    if datos.sistema == "ecologico":
        checks.append(_check_max(
            "Tamaño de manada", float(n), 3000.0, "gallinas por unidad",
            "Regl. UE 2018/848"
        ))

    # --- Requisitos de equipamiento calculados ---
    req.append(RequisitoEquipamiento(
        nombre="Perchas",
        valor_minimo=round(n * 15.0, 0),
        unidad="cm lineales",
        formula=f"{n} gallinas × 15 cm/gallina",
        articulo="RD 3/2002 Anexo II"
    ))
    req.append(RequisitoEquipamiento(
        nombre="Comederos lineales",
        valor_minimo=round(n * 10.0, 0),
        unidad="cm lineales",
        formula=f"{n} gallinas × 10 cm/gallina",
        articulo="RD 3/2002 Anexo II"
    ))
    req.append(RequisitoEquipamiento(
        nombre="Comederos circulares (perímetro)",
        valor_minimo=round(n * 4.0, 0),
        unidad="cm de perímetro",
        formula=f"{n} gallinas × 4 cm/gallina",
        articulo="RD 3/2002 Anexo II"
    ))
    req.append(RequisitoEquipamiento(
        nombre="Bebederos pezón/copa",
        valor_minimo=float(math.ceil(n / 10)),
        unidad="unidades",
        formula=f"⌈{n} / 10⌉ = {math.ceil(n / 10)}",
        articulo="RD 3/2002 Anexo II"
    ))
    req.append(RequisitoEquipamiento(
        nombre="Bebedero de canal",
        valor_minimo=round(n * 2.5, 0),
        unidad="cm de canal",
        formula=f"{n} gallinas × 2,5 cm/gallina",
        articulo="RD 3/2002 Anexo II"
    ))

    fallos = [c for c in checks if not c.cumple]

    return InformeCalculadora(
        sistema=datos.sistema,
        num_gallinas=n,
        verificaciones=checks,
        requisitos=req,
        cumple_nave=len(fallos) == 0,
        num_fallos=len(fallos),
        consulta_rag=_construir_consulta_rag_calc(datos, fallos),
    )


def _construir_consulta_rag_calc(datos: DatosCalculadora, fallos: list[Verificacion]) -> str:
    sistema_label = {"suelo": "en suelo", "campero": "campero", "ecologico": "ecológico"}[datos.sistema]
    partes = [
        f"Calcula los requisitos mínimos para una granja avícola de {datos.num_gallinas} gallinas "
        f"ponedoras en sistema {sistema_label}, nave de {datos.superficie_nave_m2} m²."
    ]
    if fallos:
        partes.append("Además, la nave tiene los siguientes incumplimientos:")
        for f in fallos:
            partes.append(f"- {f.parametro}: {f.valor_real} {f.unidad} (límite: {f.valor_referencia}). {f.articulo}.")
        partes.append("Indica qué debe corregirse y cuáles son los requisitos de equipamiento mínimo.")
    else:
        partes.append(
            "La nave cumple los parámetros básicos. Indica los requisitos mínimos de equipamiento "
            "(perchas, comederos, bebederos) y cualquier recomendación adicional."
        )
    return " ".join(partes)


def _construir_consulta_rag(datos: DatosGranja, fallos: list[Verificacion]) -> str:
    sistema_label = {"suelo": "en suelo", "campero": "campero", "ecologico": "ecológico"}[datos.sistema]
    partes = [
        f"Evalúa la conformidad de una granja avícola de {datos.num_gallinas} gallinas ponedoras "
        f"en sistema {sistema_label}."
    ]

    if fallos:
        partes.append("Los siguientes parámetros NO cumplen la normativa:")
        for f in fallos:
            if f.tipo_limite == "minimo":
                partes.append(
                    f"- {f.parametro}: tiene {f.valor_real} {f.unidad}, "
                    f"el mínimo es {f.valor_referencia} {f.unidad} "
                    f"(faltan {abs(f.diferencia):.2f} {f.unidad}). Normativa: {f.articulo}."
                )
            else:
                partes.append(
                    f"- {f.parametro}: tiene {f.valor_real} {f.unidad}, "
                    f"el máximo permitido es {f.valor_referencia} {f.unidad} "
                    f"(excede en {abs(f.diferencia):.2f} {f.unidad}). Normativa: {f.articulo}."
                )
        partes.append(
            "Explica qué artículos concretos se incumplen, las consecuencias legales "
            "y qué modificaciones son necesarias para cumplir."
        )
    else:
        partes.append(
            "Todos los parámetros cumplen la normativa vigente. "
            "Confirma la conformidad y menciona si hay requisitos adicionales "
            "o recomendaciones para este tipo de explotación."
        )

    return " ".join(partes)
