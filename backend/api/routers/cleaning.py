from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
import asyncio
from services.hardware.labjack_service import labjack_service

router = APIRouter(prefix="/cleaning", tags=["Cleaning Module"])

class CleanRequest(BaseModel):
    duration_seconds: int

# Control de cancelación global para evitar encendidos si se detuvo
_cleaning_task_id = 0

async def _cleaning_task(task_id: int, duration_seconds: int):
    labjack_service.connect()
    labjack_service.set_fio("FIO0", 1)
    labjack_service.set_fio("FIO1", 1)
    
    # Esperar el tiempo especificado (verificando cancelación cada segundo)
    for _ in range(duration_seconds):
        if _cleaning_task_id != task_id:
            return # Tarea cancelada o reemplazada
        await asyncio.sleep(1)
        
    if _cleaning_task_id == task_id:
        labjack_service.set_fio("FIO0", 0)
        labjack_service.set_fio("FIO1", 0)

@router.post("/start")
def start_cleaning(req: CleanRequest, background_tasks: BackgroundTasks):
    global _cleaning_task_id
    _cleaning_task_id += 1
    background_tasks.add_task(_cleaning_task, _cleaning_task_id, req.duration_seconds)
    return {"message": f"Ciclo de limpieza iniciado por {req.duration_seconds} segundos"}

@router.post("/stop")
def stop_cleaning():
    global _cleaning_task_id
    _cleaning_task_id += 1 # Invalida cualquier tarea corriendo
    labjack_service.connect()
    labjack_service.set_fio("FIO0", 0)
    labjack_service.set_fio("FIO1", 0)
    return {"message": "Limpieza detenida manualmente"}
