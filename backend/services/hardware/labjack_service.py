import os
import random

class LabjackManager:
    """
    Singleton para manejar una única conexión a LabJack y evitar colisiones entre el módulo
    de gases (AINs) y limpieza (FIOs).
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LabjackManager, cls).__new__(cls)
            cls._instance._handle = None
            cls._instance._simulated = False
        return cls._instance

    def connect(self):
        if self._handle is not None:
            return True # Ya conectado
            
        try:
            from labjack import ljm
            serial_num = os.getenv("LABJACK_SERIAL", "470026166")
            self._handle = ljm.openS("T7", "USB", str(serial_num))
            self._simulated = False
            return True
        except Exception as e:
            print(f"[LabjackManager] Error conectando a LabJack real, usando simulador: {e}")
            self._handle = None
            self._simulated = True
            return False

    def read_channels(self, channels: list[str]) -> list[float]:
        num_sensors = len(channels)
        if self._simulated or not self._handle:
            # Simulador: 0.5 a 2.5V
            return [round(random.uniform(0.5, 2.5), 3) for _ in range(num_sensors)]
            
        try:
            from labjack import ljm
            return ljm.eReadNames(self._handle, num_sensors, channels)
        except Exception as e:
            print(f"[LabjackManager] Error leyendo canales: {e}")
            return [0.0] * num_sensors

    def set_fio(self, pin_name: str, state: int):
        if self._simulated or not self._handle:
            print(f"[LabjackManager Simulado] Escribiendo {state} en {pin_name}")
            return
            
        try:
            from labjack import ljm
            ljm.eWriteName(self._handle, pin_name, state)
        except Exception as e:
            print(f"[LabjackManager] Error escribiendo en {pin_name}: {e}")

    def close(self):
        if self._handle is not None:
            try:
                from labjack import ljm
                ljm.close(self._handle)
            except Exception:
                pass
            self._handle = None

labjack_service = LabjackManager()
