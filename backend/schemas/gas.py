from pydantic import BaseModel, Field
from typing import List

class SensorConfig(BaseModel):
    sensor_id: str = Field(..., description="ID Físico del sensor, e.g. SG_1")
    reference: str = Field(..., description="Nombre de referencia del gas, e.g. Oxígeno o N/A")

class PCBPreset(BaseModel):
    name: str = Field(..., description="Nombre del preset de la PCB, e.g. DEFAULT_PCB")
    config: List[SensorConfig]

class GasReferenceCreate(BaseModel):
    name: str = Field(..., description="Nombre del nuevo gas a añadir a la base de datos de referencias")
