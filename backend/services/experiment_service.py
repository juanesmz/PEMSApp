import os
from datetime import datetime
from schemas.experiment import StartSessionRequest, StartSessionResponse, StopResponse
from services.hardware_manager import hardware_manager

class ExperimentService:
    @staticmethod
    def start_new_session(payload: StartSessionRequest) -> StartSessionResponse:
        """
        Orquesta la inicialización de un nuevo experimento creando la estructura
        de directorios e invocando los workers correspondientes en memoria de manera asíncrona.
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_id = f"exp_{timestamp}"
        session_dir = os.path.join(payload.base_path, timestamp)

        try:
            os.makedirs(session_dir, exist_ok=True)
            
            # Inicializamos el gestor para este session_id
            hardware_manager.init_session(session_id)

            if payload.active_modules.get("gas"):
                gas_dir = os.path.join(session_dir, "Sensores de Gases")
                os.makedirs(gas_dir, exist_ok=True)
                csv_path = os.path.join(gas_dir, "gases.csv")
                hardware_manager.start_gas_capture(session_id, csv_path, [gc.dict() for gc in payload.gas_config])

            if payload.active_modules.get("camera"):
                img_dir = os.path.join(session_dir, "Imagenes")
                os.makedirs(img_dir, exist_ok=True)
                hardware_manager.start_photo_capture(session_id, img_dir, payload.camera_index, payload.roi)

            if payload.active_modules.get("emg") or payload.active_modules.get("mic"):
                print(f"[EXP DEBUG] Users count: {len(payload.users)}")
                print(f"[EXP DEBUG] emg_indices (positional fallback): {payload.emg_indices}")
                print(f"[EXP DEBUG] mic_list (positional fallback) count: {len(payload.mic_list)}")
                for i, user in enumerate(payload.users):
                    print(f"[EXP DEBUG] User {i}: id={user.id}, emg_index={user.emg_index}, mic_config={user.mic_config}")
                    user_folder_name = f"{user.id}_{user.gender}_{user.age}"
                    user_path = os.path.join(session_dir, user_folder_name)
                    os.makedirs(user_path, exist_ok=True)
                    user_id_str = str(i + 1) # Índice de usuario 1-based

                    # Determine mic configuration for this user
                    mic_conf = user.mic_config
                    if mic_conf is None and i < len(payload.mic_list):
                        mic_conf = payload.mic_list[i]

                    if payload.active_modules.get("mic") and mic_conf is not None:
                        audio_file = os.path.join(user_path, f"audio_user_{user_id_str}.wav")
                        hardware_manager.start_audio_record(session_id, user_id_str, audio_file, mic_conf.dict())

                    # Determine EMG sensor index for this user
                    emg_idx = user.emg_index
                    if emg_idx is None and i < len(payload.emg_indices):
                        emg_idx = payload.emg_indices[i]

                    print(f"[EXP DEBUG] User {i}: resolved emg_idx={emg_idx}, resolved mic_conf={mic_conf}")
                    if payload.active_modules.get("emg") and emg_idx is not None:
                        emg_csv = os.path.join(user_path, f"emg_user_{user_id_str}.csv")
                        hardware_manager.setup_emg_file(session_id, user_id_str, emg_csv, emg_idx)
                
                if payload.active_modules.get("emg"):
                    port = payload.emg_port or os.getenv("ARDUINO_COM_PORT", "COM6")
                    hardware_manager.start_emg_serial_stream(session_id, port)

            return StartSessionResponse(
                message="Sesión de experimentación iniciada correctamente.",
                session_id=session_id,
                session_dir=session_dir
            )

        except PermissionError:
            raise RuntimeError(f"Sin permisos para escribir en el directorio base: {payload.base_path}")
        except Exception as e:
            raise RuntimeError(f"Error interno al preparar la sesión: {str(e)}")

    @staticmethod
    def stop_user_capture(session_id: str, user_id: str) -> StopResponse:
        """Detiene la captura de datos (audio, emg individual) para un usuario dado."""
        success = hardware_manager.stop_user_capture(session_id, user_id)
        if not success:
            raise ValueError(f"No se pudo detener. Sesión '{session_id}' o usuario '{user_id}' no activos.")
        return StopResponse(message=f"Captura detenida exitosamente para el usuario {user_id}.")

    @staticmethod
    def finish_experiment(session_id: str) -> StopResponse:
        """Detiene y limpia completamente la memoria de una sesión."""
        success = hardware_manager.finish_experiment(session_id)
        if not success:
            raise ValueError(f"No se encontró una sesión activa con ID: {session_id}")
        return StopResponse(message="Experimentación finalizada completamente.")
