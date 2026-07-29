import cv2
from typing import List, Dict, Any

class CameraService:
    @staticmethod
    def list_cameras() -> List[Dict[str, Any]]:
        """Busca y devuelve las cámaras conectadas usando OpenCV."""
        found = []
        for idx in range(10):
            cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(idx)
                
            if cap.isOpened():
                found.append({"name": f"Cámara {idx}", "index": idx})
                cap.release()
        return found
