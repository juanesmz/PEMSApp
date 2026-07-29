import os
import csv
from typing import List, Optional
from schemas.gas import PCBPreset, SensorConfig

class GasConfigService:
    # Ajustamos la ruta para apuntar a la base del proyecto original PEMSA Qt (para compatibilidad)
    # o a una carpeta interna en PEMSApp si decidimos independizarlo.
    # Por ahora mantenemos la ruta original basada en la estructura legacy:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    LEGACY_DIR = os.path.join(BASE_DIR, "PEMSA Qt")
    PCB_DIR = os.path.join(LEGACY_DIR, "resources", "data", "pcb")
    SENSORS_PATH = os.path.join(LEGACY_DIR, "resources", "data", "sensors.csv")

    @classmethod
    def _ensure_dirs(cls):
        os.makedirs(cls.PCB_DIR, exist_ok=True)
        # Si no existe sensors.csv, lo creamos vacío
        if not os.path.exists(cls.SENSORS_PATH):
            os.makedirs(os.path.dirname(cls.SENSORS_PATH), exist_ok=True)
            open(cls.SENSORS_PATH, 'a').close()

    @classmethod
    def get_all_presets(cls) -> List[PCBPreset]:
        cls._ensure_dirs()
        presets = []
        if os.path.isdir(cls.PCB_DIR):
            for fname in sorted(os.listdir(cls.PCB_DIR)):
                if fname.lower().endswith(".csv"):
                    name = fname[:-4]
                    config = cls.get_preset(name)
                    if config:
                        presets.append(config)
        return presets

    @classmethod
    def get_preset(cls, name: str) -> Optional[PCBPreset]:
        cls._ensure_dirs()
        path = os.path.join(cls.PCB_DIR, f"{name}.csv")
        if not os.path.exists(path):
            return None
        
        sensors = []
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) >= 2:
                    sensors.append(SensorConfig(sensor_id=row[0].strip(), reference=row[1].strip()))
        return PCBPreset(name=name, config=sensors)

    @classmethod
    def save_preset(cls, preset: PCBPreset) -> PCBPreset:
        cls._ensure_dirs()
        path = os.path.join(cls.PCB_DIR, f"{preset.name}.csv")
        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            for sensor in preset.config:
                writer.writerow([sensor.sensor_id, sensor.reference])
        return preset

    @classmethod
    def delete_preset(cls, name: str) -> bool:
        cls._ensure_dirs()
        path = os.path.join(cls.PCB_DIR, f"{name}.csv")
        if os.path.exists(path):
            os.remove(path)
            return True
        return False

    @classmethod
    def get_sensor_references(cls) -> List[str]:
        cls._ensure_dirs()
        sensors = []
        with open(cls.SENSORS_PATH, "r", encoding="utf-8") as f:
            for line in f:
                name = line.strip()
                if name:
                    sensors.append(name)
        return sensors

    @classmethod
    def add_sensor_reference(cls, name: str) -> bool:
        cls._ensure_dirs()
        sensors = cls.get_sensor_references()
        if name in sensors:
            return False # Ya existe
        with open(cls.SENSORS_PATH, "a", encoding="utf-8") as f:
            f.write(f"{name}\n")
        return True
