from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.hardware.serial_service import SerialService
import serial
import asyncio
import time

router = APIRouter(prefix="/emg", tags=["EMG Module"])

@router.get("/ports")
def get_ports():
    return SerialService.list_ports()

@router.websocket("/stream")
async def emg_stream(websocket: WebSocket, port: str = "COM6", baudrate: int = 115200):
    await websocket.accept()
    
    try:
        ser = serial.Serial(port, baudrate, timeout=0.1)
        ser.reset_input_buffer()
    except Exception as e:
        print(f"[EMG] Error abriendo puerto: {e}")
        # Simulador si no hay puerto (para poder diseñar el frontend)
        try:
            start_time = time.time()
            import random
            while True:
                curr_t = time.time() - start_time
                vals = [random.randint(0, 1023) for _ in range(6)]
                await websocket.send_json({"timestamp": curr_t, "values": vals})
                await asyncio.sleep(0.02) # 50Hz
        except WebSocketDisconnect:
            pass
        return

    try:
        start_time = time.time()
        buffer = ""
        while True:
            if ser.in_waiting > 0:
                raw_data = ser.read(ser.in_waiting)
                if raw_data:
                    buffer += raw_data.decode('utf-8', errors='ignore')
                    if len(buffer) > 4096:
                        # Prevent memory leak/overflow if garbage data without newlines is received
                        buffer = ""
                    
                    lines = buffer.split('\n')
                    buffer = lines[-1]
                    
                    valid_values = None
                    for line in reversed(lines[:-1]):
                        line = line.strip()
                        if line:
                            parts = [p.strip() for p in line.split(',') if p.strip()]
                            if len(parts) == 6:
                                try:
                                    valid_values = [int(p) for p in parts]
                                    break
                                except ValueError:
                                    continue
                    
                    if valid_values is not None:
                        curr_t = time.time() - start_time
                        await websocket.send_json({"timestamp": curr_t, "values": valid_values})
            await asyncio.sleep(0.01)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[EMG] Error en streaming: {e}")
    finally:
        ser.close()

@router.websocket("/live")
async def emg_live_stream(websocket: WebSocket):
    await websocket.accept()
    
    loop = asyncio.get_event_loop()
    queue = asyncio.Queue()
    
    def emg_callback(values):
        loop.call_soon_threadsafe(queue.put_nowait, values)
        
    from services.hardware_manager import hardware_manager
    hardware_manager.register_emg_broadcaster(emg_callback)
    
    try:
        while True:
            values = await queue.get()
            await websocket.send_json({"values": values})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"[EMG Live] Error: {e}")
    finally:
        hardware_manager.unregister_emg_broadcaster(emg_callback)
