import serial.tools.list_ports
from typing import List

class SerialService:
    @staticmethod
    def list_ports() -> List[str]:
        """Devuelve una lista de los puertos COM disponibles en el sistema."""
        ports = serial.tools.list_ports.comports()
        return [port.device for port in ports]
