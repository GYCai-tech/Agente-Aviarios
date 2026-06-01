from pydantic import BaseModel
from agentes.validador_legal import DatosGranja, InformeConformidad, DatosCalculadora, InformeCalculadora
from agentes.intake import (
    DatosIntake, InformeIntake, DatosRecomendacion, DatosBasicos,
    Recomendacion, ResultadoFactibilidad, Pregunta,
    DatosRecomendacionConRespuestas, consulta_ventas,
)


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str


class ValidarRequest(BaseModel):
    datos: DatosGranja


class ValidarResponse(BaseModel):
    informe: InformeConformidad
    analisis_legal: str


class CalcularRequest(BaseModel):
    datos: DatosCalculadora


class CalcularResponse(BaseModel):
    informe: InformeCalculadora
    analisis_legal: str


class FactibilidadRequest(BaseModel):
    datos: DatosBasicos

class FactibilidadResponse(BaseModel):
    factibilidad: ResultadoFactibilidad
    preguntas: list[Pregunta]

class RecomendacionRequest(BaseModel):
    datos: DatosRecomendacion

class RecomendacionConRespuestasRequest(BaseModel):
    datos: DatosBasicos
    respuestas: dict[str, str]


class IntakeRequest(BaseModel):
    datos: DatosIntake


class Objecion(BaseModel):
    pregunta: str
    respuesta: str


class IntakeResponse(BaseModel):
    informe: InformeIntake
    analisis_legal: str
    argumentario_ventas: str
    argumentos_producto: list[str]
    objeciones: list[Objecion]
