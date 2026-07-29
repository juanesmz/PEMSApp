from fastapi import APIRouter, HTTPException, status, WebSocket, WebSocketDisconnect
from typing import List
import time
import asyncio
import random
from schemas.gas import PCBPreset, GasReferenceCreate
from services.gas_config_service import GasConfigService

router = APIRouter(
    prefix="/gas",
    tags=["Gas Config and Streaming"]
)

@router.get("/presets", response_model=List[PCBPreset])
def get_presets():
    """Retorna todas las configuraciones de PCB guardadas"""
    return GasConfigService.get_all_presets()

@router.post("/presets", response_model=PCBPreset, status_code=status.HTTP_201_CREATED)
def create_preset(preset: PCBPreset):
    """Guarda una nueva configuración de PCB (Nueva PCB)"""
    return GasConfigService.save_preset(preset)

@router.put("/presets/{name}", response_model=PCBPreset)
def update_preset(name: str, preset: PCBPreset):
    """Actualiza una configuración de PCB existente (Editar PCB)"""
    if preset.name != name:
        raise HTTPException(status_code=400, detail="El nombre en la URL no coincide con el cuerpo de la petición")
    return GasConfigService.save_preset(preset)

@router.get("/references", response_model=List[str])
def get_references():
    """Lista todos los gases de referencia disponibles (ej. Oxígeno)"""
    return GasConfigService.get_sensor_references()

@router.post("/references", status_code=status.HTTP_201_CREATED)
def add_reference(ref: GasReferenceCreate):
    """Añade un nuevo gas de referencia a la base de datos"""
    success = GasConfigService.add_sensor_reference(ref.name)
    if not success:
        raise HTTPException(status_code=400, detail="El gas de referencia ya existe")
    return {"message": "Referencia añadida con éxito"}

@router.websocket("/stream")
async def gas_stream(websocket: WebSocket, channels: str = ""):
    """
    Endpoint de WebSocket para el streaming en tiempo real a 50Hz.
    Pasa los canales físicos esperados en la query, ej: ?channels=AIN0,AIN2
    """
    await websocket.accept()
    
    channel_list = [c.strip() for c in channels.split(",") if c.strip()]
    
    # Asegurar conexión centralizada a LabJack
    from services.hardware.labjack_service import labjack_service
    labjack_service.connect()

    try:
        start_time = time.time()
        loop = asyncio.get_event_loop()
        while True:
            curr_t = time.time() - start_time
            results = await loop.run_in_executor(None, labjack_service.read_channels, channel_list)
            
            data = {
                "timestamp": curr_t,
                "values": results
            }
            # Enviar los datos al Canvas del frontend
            await websocket.send_json(data)
            
            # Pausa de 20ms para simular 50Hz
            await asyncio.sleep(0.02) 
            
    except WebSocketDisconnect:
        print("Frontend WebSocket Client disconnected")
    except Exception as e:
        print(f"Error en WebSocket de Gases: {e}")
