from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.hardware.audio_service import AudioService
import sounddevice as sd
import asyncio

router = APIRouter(prefix="/microphones", tags=["Microphones Module"])

@router.get("/")
def get_microphones():
    return AudioService.list_microphones()

@router.websocket("/{device_index}/stream")
async def mic_stream(websocket: WebSocket, device_index: int, channel: int = 0):
    """
    Inicia la captura desde el índice del dispositivo y envía 
    arrays de floats al frontend cada ~46ms.
    """
    await websocket.accept()
    
    loop = asyncio.get_event_loop()
    queue = asyncio.Queue()

    def audio_callback(indata, frames, time, status):
        # Insertar en la cola sin bloquear el hilo de PortAudio
        if status:
            print(status)
        loop.call_soon_threadsafe(queue.put_nowait, indata[:, channel].copy())

    try:
        stream = sd.InputStream(
            device=device_index,
            channels=channel+1, # Abrir stream garantizando tener al menos ese canal
            samplerate=44100,
            blocksize=2048,
            dtype="float32",
            callback=audio_callback
        )
        with stream:
            while True:
                data = await queue.get()
                # Para evitar JSON enormes o parseo lento, se pueden reducir (decimate)
                # o enviar completos. Enviamos completos para graficar waveform real.
                await websocket.send_json({"samples": data.tolist()})
                
    except WebSocketDisconnect:
        print("Micrófono desconectado del socket")
    except Exception as e:
        print(f"Error de stream de micrófono: {e}")
        try:
            await websocket.close()
        except: pass
