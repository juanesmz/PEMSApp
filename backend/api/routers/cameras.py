from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.hardware.camera_service import CameraService
import cv2
import asyncio
import base64

router = APIRouter(prefix="/cameras", tags=["Cameras Module"])

@router.get("/")
def get_cameras():
    return CameraService.list_cameras()

@router.websocket("/{index}/stream")
async def camera_stream(websocket: WebSocket, index: int):
    """
    Emite frames codificados en Base64 JPEG.
    En el frontend usar: <img src={`data:image/jpeg;base64,${base64String}`} />
    """
    await websocket.accept()
    
    cap = cv2.VideoCapture(index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        cap = cv2.VideoCapture(index)
    
    if not cap.isOpened():
        await websocket.close(reason="Cámara no disponible")
        return

    try:
        print(f"Camara {index} iniciada. Enviando stream...")
        frames_sent = 0
        loop = asyncio.get_event_loop()
        while True:
            ret, frame = await loop.run_in_executor(None, cap.read)
            if ret:
                # Comprimir a JPEG con 60% calidad para fluidez en red local
                success, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 60])
                if success:
                    b64_str = base64.b64encode(buffer).decode('utf-8')
                    await websocket.send_text(b64_str)
                    frames_sent += 1
                    if frames_sent % 30 == 0:
                        print(f"Camara {index}: Enviados {frames_sent} frames")
            else:
                print(f"Camara {index}: cap.read() devolvió False. Reintentando...")
            await asyncio.sleep(0.033) # Limitar a ~30 fps
    except WebSocketDisconnect:
        print("Frontend cerró el visualizador de la cámara")
    except Exception as e:
        print(f"Camera Stream error: {e}")
    finally:
        cap.release()
        print(f"Camara {index} liberada.")
