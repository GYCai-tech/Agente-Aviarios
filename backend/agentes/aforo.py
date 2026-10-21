"""Aforo trazable a partir de mediciones, independiente del dibujo y de la IA.

RD 3/2002, anexo IV: sistemas alternativos suelo/campero; régimen ecológico
según los reglamentos UE 2018/848 y 2020/464. Este cálculo
cuantitativo no sustituye las comprobaciones de accesibilidad y construcción.
Las medidas deben ser útiles y accesibles, no dimensiones exteriores.
"""
from decimal import Decimal, ROUND_FLOOR
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Medida = Annotated[float, Field(ge=0, allow_inf_nan=False)]


class EquipamientoMedido(BaseModel):
    model_config = ConfigDict(extra="forbid")
    perchas_m: Medida | None = None
    nidal_util_m2: Medida | None = None
    comedero_lineal_accesible_m: Medida | None = None
    bebederos_pezon_copa: Annotated[int, Field(ge=0)] | None = None
    salidas_ancho_util_m: Medida | None = None


class AforoRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sistema: Literal["suelo", "campero", "ecologico"] = "suelo"
    superficie_util_m2: Medida
    superficie_suelo_m2: Medida | None = None
    yacija_m2: Medida | None = None
    pasto_m2: Medida | None = None
    anexo_util_validado_m2: Medida = 0
    referencia_anexo: str = ""
    equipamiento: EquipamientoMedido = Field(default_factory=EquipamientoMedido)

    @model_validator(mode="after")
    def validar_anexo(self):
        if self.anexo_util_validado_m2 and not self.referencia_anexo.strip():
            raise ValueError("El anexo computable requiere referencia de su validación técnica")
        if (self.yacija_m2 is not None and self.superficie_suelo_m2 is not None
                and self.yacija_m2 > self.superficie_suelo_m2):
            raise ValueError("La yacija no puede superar la superficie de suelo declarada")
        return self


class LimiteAforo(BaseModel):
    criterio: str
    gallinas: int
    formula: str
    fuente: str


class AforoResultado(BaseModel):
    gallinas_max: int
    limitantes: list[str]
    limites: list[LimiteAforo]
    pendientes: list[str]
    cumple_yacija_suelo: bool | None = None
    mediciones_completas: bool


def cociente_entero(valor: float, divisor: float) -> int:
    """Redondeo conservador sin perder un ave en límites decimales exactos."""
    return int((Decimal(str(valor)) / Decimal(str(divisor))).to_integral_value(rounding=ROUND_FLOOR))


def calcular_aforo(req: AforoRequest) -> AforoResultado:
    limites: list[LimiteAforo] = []
    pendientes: list[str] = []

    def agregar(criterio, valor, divisor, fuente="RD 3/2002, anexo IV"):
        if valor is None:
            pendientes.append(criterio)
        else:
            limites.append(LimiteAforo(criterio=criterio,
                gallinas=cociente_entero(valor, divisor),
                formula=f"{valor:g} / {divisor:g}", fuente=fuente))

    superficie = Decimal(str(req.superficie_util_m2)) + Decimal(str(req.anexo_util_validado_m2))
    densidad_max = 6 if req.sistema == "ecologico" else 9
    limites.append(LimiteAforo(criterio="densidad", gallinas=int(superficie * densidad_max),
        formula=f"{superficie} × {densidad_max}",
        fuente="Reglamento de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3" if req.sistema == "ecologico"
        else "RD 3/2002, anexo IV.4"))
    e = req.equipamiento
    perch_cm = 0.18 if req.sistema == "ecologico" else 0.15
    agregar("perchas", e.perchas_m, perch_cm,
            "Reglamento de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3" if req.sistema == "ecologico"
            else "RD 3/2002, anexo IV")
    # Nidal colectivo: 1 m²/120 aves (RD). En ecológico, 120 cm²/ave
    # (Reglamento 2020/464), requisito más estricto que el estándar general.
    if e.nidal_util_m2 is None:
        pendientes.append("nidales")
    else:
        divisor_nidal = Decimal("0.012") if req.sistema == "ecologico" else None
        gallinas_nidal = (int(Decimal(str(e.nidal_util_m2)) / divisor_nidal)
                          if divisor_nidal else int(Decimal(str(e.nidal_util_m2)) * 120))
        limites.append(LimiteAforo(criterio="nidales", gallinas=gallinas_nidal,
            formula=(f"{e.nidal_util_m2:g} / 0,012" if divisor_nidal else f"{e.nidal_util_m2:g} × 120"),
            fuente=("Reglamento de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3" if divisor_nidal else "RD 3/2002, anexo IV.1.c")))
    agregar("comederos_lineales", e.comedero_lineal_accesible_m, 0.10)
    agregar("bebederos", e.bebederos_pezon_copa, 0.1)
    agregar("yacija_por_ave", req.yacija_m2, 0.025)
    if req.sistema in ("campero", "ecologico"):
        agregar("pasto", req.pasto_m2, 4,
                "Reglamento de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3" if req.sistema == "ecologico"
                else "Reglamento Delegado (UE) 2023/2465, anexo II, punto 1.c")
    if req.sistema == "campero":
        agregar("salidas", e.salidas_ancho_util_m, 0.002)
    if req.sistema == "ecologico":
        # 4 m de trampilla por 100 m² de superficie cubierta mínima (6 gallinas/m²) = 150 gallinas/m
        if e.salidas_ancho_util_m is None:
            pendientes.append("salidas")
        else:
            limites.append(LimiteAforo(criterio="salidas",
                gallinas=int(Decimal(str(e.salidas_ancho_util_m)) * 150),
                formula=f"{e.salidas_ancho_util_m:g} × 150",
                fuente="Reglamento de Ejecución (UE) 2020/464, art. 15.1.d"))
        limites.append(LimiteAforo(criterio="tope_gallinas_por_gallinero", gallinas=3000,
            formula="3000 gallinas como máximo por gallinero",
            fuente="Reglamento (UE) 2018/848, anexo II, parte II, 1.9.4.4(n)"))
    cumple = None
    if req.yacija_m2 is not None and req.superficie_suelo_m2 is not None:
        cumple = Decimal(str(req.yacija_m2)) * 3 >= Decimal(str(req.superficie_suelo_m2))
        if not cumple:
            limites.append(LimiteAforo(criterio="yacija_suelo", gallinas=0,
                formula="yacija < suelo / 3: requiere modificar la instalación",
                fuente="RD 3/2002, anexo IV.1.e"))
    else:
        pendientes.append("yacija_suelo")
    minimo = min(l.gallinas for l in limites)
    return AforoResultado(gallinas_max=minimo,
        limitantes=[l.criterio for l in limites if l.gallinas == minimo],
        limites=limites, pendientes=pendientes, cumple_yacija_suelo=cumple,
        mediciones_completas=not pendientes)
