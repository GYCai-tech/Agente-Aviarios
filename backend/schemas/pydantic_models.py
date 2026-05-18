from pydantic import BaseModel
from agentes.validador_legal import DatosGranja, InformeConformidad, DatosCalculadora, InformeCalculadora


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
