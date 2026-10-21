"""
Ficha técnica: medidas y equipamiento de los módulos que entran en el cálculo.

Los valores por defecto son las constantes de `agentes.estudio`. La ficha
editada se guarda en JSON (FICHA_TECNICA_PATH, por defecto
backend/datos/ficha_tecnica.json) y `aplicar_ficha` la vuelca sobre esas
constantes, que estudio, plano y DXF leen en tiempo de llamada.

Los límites normativos no forman parte de la ficha: vienen de la ley y se
exponen en solo lectura con `normativa()`.
"""
from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, model_validator

import agentes.estudio as E

_RUTA = Path(os.getenv("FICHA_TECNICA_PATH",
                       Path(__file__).resolve().parent.parent / "datos" / "ficha_tecnica.json"))
_lock = threading.Lock()

Positivo = Annotated[float, Field(gt=0, allow_inf_nan=False)]


class NivelAviario(BaseModel):
    """Datos de un módulo de aviario según su número de niveles."""
    model_config = ConfigDict(extra="forbid")
    altura_min_cm: Positivo
    sup_total_m2: Positivo
    sup_disponible_m2: Positivo
    # Equipamiento integrado por módulo; None = sin dato (queda pendiente de medir)
    perchas_m: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    nidal_util_m2: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    comedero_lineal_m: float | None = Field(default=None, ge=0, allow_inf_nan=False)
    bebederos: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _superficies(self):
        if self.sup_disponible_m2 > self.sup_total_m2:
            raise ValueError("La superficie disponible no puede superar la superficie total del módulo")
        return self


class FichaAviario(BaseModel):
    model_config = ConfigDict(extra="forbid")
    largo_modulo_m: Positivo        # a lo largo de la nave
    fondo_modulo_m: Positivo        # a lo ancho de la nave
    capacidad_gallinas: int = Field(gt=0)
    pasillo_m: float = Field(ge=0, allow_inf_nan=False)
    zona_equipos_frontal_m: float = Field(ge=0, allow_inf_nan=False)
    zona_equipos_fondo_m: float = Field(ge=0, allow_inf_nan=False)
    nivel_2: NivelAviario
    nivel_3: NivelAviario

    @model_validator(mode="after")
    def _alturas(self):
        if self.nivel_3.altura_min_cm < self.nivel_2.altura_min_cm:
            raise ValueError("La altura mínima de 3 niveles no puede ser menor que la de 2 niveles")
        return self


class FichaNidal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    largo_modulo_m: Positivo        # a lo largo de la cadena
    fondo_cuerpo_m: Positivo        # profundidad del cuerpo
    capacidad_gallinas: int = Field(gt=0)
    nidal_util_m2: Positivo         # superficie de nidal útil por módulo
    tensor_m: float = Field(ge=0, allow_inf_nan=False)
    local_tecnico_m: float = Field(ge=0, allow_inf_nan=False)


class FichaTecnica(BaseModel):
    model_config = ConfigDict(extra="forbid")
    aviario: FichaAviario
    nidal: FichaNidal
    actualizado: str | None = None


class ReglaNormativa(BaseModel):
    criterio: str
    valor: str
    fuente: str


class FichaRespuesta(BaseModel):
    ficha: FichaTecnica
    por_defecto: FichaTecnica
    personalizada: bool
    normativa: list[ReglaNormativa]


def _nivel_desde_estudio(n: int) -> NivelAviario:
    eq = E.AVI_EQUIPO_POR_MODULO.get(n, {})
    return NivelAviario(
        altura_min_cm=E.AVI_ALTURA_MIN[n], sup_total_m2=E.AVI_SUP_TOTAL[n], sup_disponible_m2=E.AVI_SUP_DISP[n],
        perchas_m=eq.get("perchas_m"), nidal_util_m2=eq.get("nidal_util_m2"),
        comedero_lineal_m=eq.get("comedero_lineal_accesible_m"),
        bebederos=int(eq["bebederos_pezon_copa"]) if "bebederos_pezon_copa" in eq else None,
    )


def _ficha_desde_estudio() -> FichaTecnica:
    return FichaTecnica(
        aviario=FichaAviario(
            largo_modulo_m=E.AVI_MOD_A, fondo_modulo_m=E.AVI_MOD_B, capacidad_gallinas=E.AVI_CAP,
            pasillo_m=E.AVI_PASILLO, zona_equipos_frontal_m=E.AVI_CLEARANCE,
            zona_equipos_fondo_m=E.AVI_CLEARANCE_FONDO,
            nivel_2=_nivel_desde_estudio(2), nivel_3=_nivel_desde_estudio(3)),
        nidal=FichaNidal(
            largo_modulo_m=E.NIDAL_LARGO, fondo_cuerpo_m=E.NIDAL_ANCHO, capacidad_gallinas=E.NIDAL_CAP,
            nidal_util_m2=E.NIDAL_UTIL_M2, tensor_m=E.NIDAL_TENSOR, local_tecnico_m=E.NIDAL_EQUIP),
    )


# Capturada al importar, antes de aplicar ninguna ficha guardada
_POR_DEFECTO = _ficha_desde_estudio()


def ficha_por_defecto() -> FichaTecnica:
    return _POR_DEFECTO.model_copy(deep=True)


def cargar_ficha() -> FichaTecnica:
    if _RUTA.exists():
        return FichaTecnica.model_validate_json(_RUTA.read_text(encoding="utf-8"))
    return ficha_por_defecto()


def ficha_personalizada() -> bool:
    return _RUTA.exists()


def _equipo(nivel: NivelAviario) -> dict[str, float]:
    eq = {"perchas_m": nivel.perchas_m, "nidal_util_m2": nivel.nidal_util_m2,
          "comedero_lineal_accesible_m": nivel.comedero_lineal_m, "bebederos_pezon_copa": nivel.bebederos}
    return {k: v for k, v in eq.items() if v is not None}


def aplicar_ficha(f: FichaTecnica) -> None:
    """Vuelca la ficha sobre las constantes de `agentes.estudio`."""
    a, n = f.aviario, f.nidal
    with _lock:
        E.AVI_MOD_A, E.AVI_MOD_B = a.largo_modulo_m, a.fondo_modulo_m
        E.AVI_HUELLA_M2 = round(a.largo_modulo_m * a.fondo_modulo_m, 4)
        E.AVI_CAP = a.capacidad_gallinas
        E.AVI_PASILLO = a.pasillo_m
        E.AVI_CLEARANCE, E.AVI_CLEARANCE_FONDO = a.zona_equipos_frontal_m, a.zona_equipos_fondo_m
        E.AVI_SUP_TOTAL = {2: a.nivel_2.sup_total_m2, 3: a.nivel_3.sup_total_m2}
        E.AVI_SUP_DISP = {2: a.nivel_2.sup_disponible_m2, 3: a.nivel_3.sup_disponible_m2}
        E.AVI_ALTURA_MIN = {2: a.nivel_2.altura_min_cm, 3: a.nivel_3.altura_min_cm}
        E.AVI_EQUIPO_POR_MODULO = {2: _equipo(a.nivel_2), 3: _equipo(a.nivel_3)}
        E.NIDAL_LARGO, E.NIDAL_ANCHO = n.largo_modulo_m, n.fondo_cuerpo_m
        E.NIDAL_CUERPO = round(n.largo_modulo_m * n.fondo_cuerpo_m, 4)
        E.NIDAL_CAP = n.capacidad_gallinas
        E.NIDAL_UTIL_M2 = n.nidal_util_m2
        E.NIDAL_TENSOR, E.NIDAL_EQUIP = n.tensor_m, n.local_tecnico_m


def guardar_ficha(f: FichaTecnica) -> FichaTecnica:
    f = f.model_copy(update={"actualizado": datetime.now(timezone.utc).isoformat(timespec="seconds")})
    _RUTA.parent.mkdir(parents=True, exist_ok=True)
    tmp = _RUTA.with_suffix(".tmp")
    tmp.write_text(f.model_dump_json(indent=2), encoding="utf-8")
    os.replace(tmp, _RUTA)
    aplicar_ficha(f)
    return f


def restablecer_ficha() -> FichaTecnica:
    if _RUTA.exists():
        _RUTA.unlink()
    f = ficha_por_defecto()
    aplicar_ficha(f)
    return f


def normativa() -> list[ReglaNormativa]:
    """Límites legales que aplica el cálculo (solo lectura)."""
    return [
        ReglaNormativa(criterio="Densidad máxima", valor="9 gallinas/m² (ecológico: 6)",
                       fuente="RD 3/2002 anexo IV · Regl. de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3"),
        ReglaNormativa(criterio="Perchas", valor="15 cm por gallina (ecológico: 18)",
                       fuente="RD 3/2002 anexo IV · Regl. de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3"),
        ReglaNormativa(criterio="Nidal colectivo", valor="1 m² por cada 120 gallinas (ecológico: 120 cm²/ave)",
                       fuente="RD 3/2002 anexo IV · Regl. de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3"),
        ReglaNormativa(criterio="Comedero lineal", valor="10 cm por gallina", fuente="RD 3/2002 anexo IV"),
        ReglaNormativa(criterio="Bebederos de pezón o copa", valor="1 por cada 10 gallinas", fuente="RD 3/2002 anexo IV"),
        ReglaNormativa(criterio="Yacija", valor="≥ 1/3 de la superficie de suelo y ≥ 250 cm² por gallina",
                       fuente="RD 3/2002 anexo IV"),
        ReglaNormativa(criterio="Pasto (campero / ecológico)", valor="4 m² por gallina",
                       fuente="Regl. Delegado (UE) 2023/2465, anexo II, punto 1.c · ecológico: "
                              "Regl. de Ejecución (UE) 2020/464, anexo I, parte IV, punto 3"),
        ReglaNormativa(criterio="Salidas (campero)", valor="2 m de ancho por cada 1.000 gallinas", fuente="RD 3/2002 anexo IV"),
        ReglaNormativa(criterio="Trampillas (ecológico)", valor="4 m por cada 100 m² de superficie cubierta mínima",
                       fuente="Regl. de Ejecución (UE) 2020/464, art. 15.1.d"),
        ReglaNormativa(criterio="Tope por compartimento (ecológico)", valor="3.000 gallinas",
                       fuente="Regl. (UE) 2018/848, anexo II, parte II, 1.9.4.4.n"),
        ReglaNormativa(criterio="Niveles superpuestos", valor="máximo 4 (ecológico: 3 incluido el suelo)",
                       fuente="Directiva 1999/74/CE art. 4 · Regl. de Ejecución (UE) 2020/464, art. 15.4.b"),
    ]


def respuesta() -> FichaRespuesta:
    return FichaRespuesta(ficha=cargar_ficha(), por_defecto=ficha_por_defecto(),
                          personalizada=ficha_personalizada(), normativa=normativa())
