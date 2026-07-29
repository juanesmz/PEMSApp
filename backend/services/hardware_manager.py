import os
import csv
import threading
from typing import Dict, Any
from datetime import datetime
from services.hardware_workers import AudioRecorderWorker, GasRecorderWorker, PhotoCaptureWorker, SerialRecorderWorker

class HardwareTaskManager:
    """
    Singleton que mantiene las referencias a los hilos activos de hardware y
    sus archivos abiertos (CSVs) durante la sesión.
    """
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(HardwareTaskManager, cls).__new__(cls)
            cls._instance._sessions = {}
            cls._instance._emg_broadcasters = set()
        return cls._instance

    def register_emg_broadcaster(self, callback):
        self._emg_broadcasters.add(callback)

    def unregister_emg_broadcaster(self, callback):
        self._emg_broadcasters.discard(callback)

    def init_session(self, session_id: str):
        if session_id not in self._sessions:
            self._sessions[session_id] = {
                "audio_recorders": {}, # user_id_str -> thread
                "emg_files": {},       # user_id_str -> (writer, sensor_idx)
                "emg_handles": {},     # user_id_str -> file_handle
                "emg_worker": None,
                "emg_lock": threading.Lock(),  # Lock para sincronizar escritura/cierre de archivos EMG
                "gas_worker": None,
                "photo_worker": None
            }

    def start_gas_capture(self, session_id: str, csv_path: str, gas_config: list):
        self.init_session(session_id)
        worker = GasRecorderWorker(csv_path, gas_config)
        self._sessions[session_id]["gas_worker"] = worker
        worker.start()

    def start_photo_capture(self, session_id: str, img_dir: str, camera_index: int, roi: tuple):
        self.init_session(session_id)
        worker = PhotoCaptureWorker(img_dir, camera_index, roi)
        self._sessions[session_id]["photo_worker"] = worker
        worker.start()

    def start_audio_record(self, session_id: str, user_id_str: str, audio_file: str, mic_config: dict):
        self.init_session(session_id)
        worker = AudioRecorderWorker(
            device_index=mic_config.get("device_index"),
            filename=audio_file,
            channel=mic_config.get("channel", 0),
            num_channels=mic_config.get("num_channels", 1)
        )
        self._sessions[session_id]["audio_recorders"][user_id_str] = worker
        worker.start()

    def setup_emg_file(self, session_id: str, user_id_str: str, emg_csv: str, sensor_idx: int):
        self.init_session(session_id)
        print(f"[EMG DEBUG] setup_emg_file: session={session_id}, user={user_id_str}, csv={emg_csv}, sensor_idx={sensor_idx}")
        f = open(emg_csv, 'w', newline='')
        writer = csv.writer(f)
        writer.writerow(["Timestamp", "EMG_Value", "Physical_Channel"])
        f.flush()
        self._sessions[session_id]["emg_handles"][user_id_str] = f
        self._sessions[session_id]["emg_files"][user_id_str] = (writer, sensor_idx)
        print(f"[EMG DEBUG] emg_files keys after setup: {list(self._sessions[session_id]['emg_files'].keys())}")

    def start_emg_serial_stream(self, session_id: str, port: str):
        self.init_session(session_id)
        print(f"[EMG DEBUG] start_emg_serial_stream: session={session_id}, port={port}")
        print(f"[EMG DEBUG] emg_files at stream start: {list(self._sessions[session_id]['emg_files'].keys())}")
        
        _data_count = [0]  # mutable counter for closure
        
        def on_data(values):
            session = self._sessions.get(session_id)
            if not session:
                if _data_count[0] == 0:
                    print(f"[EMG DEBUG] on_data: session not found for {session_id}")
                return
            lock = session.get("emg_lock")
            if not lock:
                if _data_count[0] == 0:
                    print(f"[EMG DEBUG] on_data: lock not found")
                return
            
            ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
            with lock:
                # Tomar snapshot del diccionario bajo el lock para evitar
                # RuntimeError si el diccionario cambia durante la iteración
                emg_items = list(session["emg_files"].items())
            
            if _data_count[0] == 0:
                print(f"[EMG DEBUG] on_data first call: values={values}, emg_items count={len(emg_items)}")
                for u_id, (writer, sensor_idx) in emg_items:
                    print(f"[EMG DEBUG]   user={u_id}, sensor_idx={sensor_idx}, sensor_idx < len(values)={sensor_idx < len(values)}")
            
            for u_id, (writer, sensor_idx) in emg_items:
                if sensor_idx < len(values):
                    try:
                        with lock:
                            writer.writerow([ts, values[sensor_idx], sensor_idx])
                            # Flush inmediato para que los datos se escriban al disco
                            f = session["emg_handles"].get(u_id)
                            if f:
                                f.flush()
                    except (ValueError, OSError) as e:
                        # El archivo ya fue cerrado por otro hilo, ignorar
                        if _data_count[0] < 3:
                            print(f"[EMG DEBUG] write error for user {u_id}: {e}")
                        pass
            
            # Broadcast to active live websockets
            for cb in list(self._emg_broadcasters):
                try:
                    cb(values)
                except Exception:
                    pass

            _data_count[0] += 1
                    
        def on_error(msg):
            print(f"[EMG Error]: {msg}")

        worker = SerialRecorderWorker(port, on_data=on_data, on_error=on_error)
        self._sessions[session_id]["emg_worker"] = worker
        worker.start()

    def stop_user_capture(self, session_id: str, user_id_str: str) -> bool:
        """Detiene audio y emg de un usuario específico."""
        session = self._sessions.get(session_id)
        if not session: return False
        lock = session.get("emg_lock")

        if user_id_str in session["audio_recorders"]:
            session["audio_recorders"][user_id_str].stop()
            del session["audio_recorders"][user_id_str]

        if user_id_str in session["emg_files"]:
            # Verificar si es el último usuario con EMG activo
            remaining_emg_users = [uid for uid in session["emg_files"] if uid != user_id_str]
            is_last_emg_user = len(remaining_emg_users) == 0

            # Si es el último usuario, detener el worker serial ANTES de cerrar el archivo
            # para evitar que on_data escriba en un archivo cerrado
            if is_last_emg_user and not session["audio_recorders"]:
                if session.get("emg_worker"):
                    session["emg_worker"].stop()
                    session["emg_worker"].join(timeout=2)  # Esperar a que el hilo termine
                    session["emg_worker"] = None

            # Cerrar archivo bajo el lock para sincronizar con on_data
            if lock:
                with lock:
                    f = session["emg_handles"].get(user_id_str)
                    if f:
                        try:
                            f.flush()
                            f.close()
                        except (ValueError, OSError):
                            pass
                        del session["emg_handles"][user_id_str]
                    del session["emg_files"][user_id_str]
            else:
                f = session["emg_handles"].get(user_id_str)
                if f:
                    try:
                        f.flush()
                        f.close()
                    except (ValueError, OSError):
                        pass
                    del session["emg_handles"][user_id_str]
                del session["emg_files"][user_id_str]

        return True

    def finish_experiment(self, session_id: str) -> bool:
        """Detiene absolutamente todos los hilos y cierra archivos del experimento."""
        session = self._sessions.get(session_id)
        if not session: return False
        lock = session.get("emg_lock")

        # IMPORTANTE: Detener el worker serial PRIMERO y esperar a que termine,
        # para que on_data no intente escribir en archivos cerrados
        if session.get("emg_worker"):
            session["emg_worker"].stop()
            session["emg_worker"].join(timeout=3)  # Esperar a que el hilo termine
            session["emg_worker"] = None
            
        if session.get("gas_worker"):
            session["gas_worker"].stop()
            session["gas_worker"] = None

        # Detener grabadores restantes
        for u_id in list(session["audio_recorders"].keys()):
            session["audio_recorders"][u_id].stop()

        # Cerrar archivos EMG restantes bajo el lock
        if lock:
            with lock:
                for u_id in list(session["emg_handles"].keys()):
                    try:
                        session["emg_handles"][u_id].flush()
                        session["emg_handles"][u_id].close()
                    except (ValueError, OSError):
                        pass
        else:
            for u_id in list(session["emg_handles"].keys()):
                try:
                    session["emg_handles"][u_id].flush()
                    session["emg_handles"][u_id].close()
                except (ValueError, OSError):
                    pass

        # Limpiar memoria
        del self._sessions[session_id]
        return True

hardware_manager = HardwareTaskManager()
