import sounddevice as sd
from typing import List, Dict, Any

class AudioService:
    @staticmethod
    def list_microphones() -> List[Dict[str, Any]]:
        """Enumera los dispositivos de audio reales filtrando loopbacks."""
        try:
            sd._terminate()
            sd._initialize()
        except Exception:
            pass

        try:
            default_hostapi_idx = sd.default.hostapi
        except Exception:
            default_hostapi_idx = 0

        virtual_keywords = [
            "stereo mix", "loopback", "what u hear", "wave out",
            "virtual", "voicemeter", "cable output", "asignador"
        ]

        devices = []
        for idx, dev in enumerate(sd.query_devices()):
            max_ch = dev.get("max_input_channels", 0)
            if max_ch <= 0:
                continue
            if dev.get("hostapi", -1) != default_hostapi_idx:
                continue
                
            name_lower = dev["name"].lower()
            if any(kw in name_lower for kw in virtual_keywords):
                continue

            if max_ch >= 2:
                for ch in range(max_ch):
                    label = f"{dev['name']} (Canal {ch + 1})"
                    devices.append({"name": label, "index": idx, "channel": ch, "num_channels": max_ch})
            else:
                label = dev["name"]
                devices.append({"name": label, "index": idx, "channel": 0, "num_channels": 1})
                
        return devices
