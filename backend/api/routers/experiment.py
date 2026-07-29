from fastapi import APIRouter, HTTPException, status, Path
from schemas.experiment import StartSessionRequest, StartSessionResponse, StopResponse
from services.experiment_service import ExperimentService

router = APIRouter(
    prefix="/experiments",
    tags=["Experiments"]
)

@router.get("/browse")
def browse_directory():
    """
    Abre un diálogo nativo de Windows (estilo Explorador de Archivos) utilizando PySide6
    para seleccionar una carpeta, y devuelve la ruta seleccionada.
    """
    import subprocess
    import sys

    # Ejecutar QFileDialog en un subproceso de Python para evitar conflictos de hilos GUI
    python_cmd = (
        "import sys; "
        "from PySide6.QtWidgets import QApplication, QFileDialog; "
        "app = QApplication.instance() or QApplication(sys.argv); "
        "path = QFileDialog.getExistingDirectory(None, 'Seleccione la carpeta de almacenamiento', '', QFileDialog.Option.ShowDirsOnly); "
        "print(path)"
    )

    try:
        proc = subprocess.run(
            [sys.executable, "-c", python_cmd],
            capture_output=True,
            text=True,
            creationflags=0x08000000, # CREATE_NO_WINDOW
            timeout=180 # Time out after 3 minutes if the user leaves it open
        )
        selected_path = proc.stdout.strip()
        # Normalizar barras para que sean consistentes en el frontend
        if selected_path:
            selected_path = selected_path.replace("\\", "/")
        return {"path": selected_path if selected_path else None}
    except subprocess.TimeoutExpired:
        return {"path": None}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al abrir el explorador de archivos: {str(e)}"
        )

@router.get("/sessions")
def get_sessions(directory: str):
    """
    Escanea el directorio seleccionado y valida que cumpla con la estructura correcta:
    subcarpetas con nombres en formato datetime (YYYYMMDD_HHMMSS).
    """
    import os
    import re

    if not directory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Se requiere el parámetro 'directory'"
        )

    # Normalizar barras
    directory = directory.replace("\\", "/")

    if not os.path.exists(directory):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El directorio especificado no existe: {directory}"
        )

    if not os.path.isdir(directory):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La ruta especificada no es un directorio válido."
        )

    try:
        entries = os.listdir(directory)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al leer el directorio: {str(e)}"
        )

    # Filtrar solo subdirectorios, ignorando ocultos
    subdirs = []
    for entry in entries:
        if entry.startswith('.'):
            continue
        full_path = os.path.join(directory, entry)
        if os.path.isdir(full_path):
            subdirs.append(entry)

    from datetime import datetime
    datetime_pattern_1 = re.compile(r"^\d{8}_\d{6}$")
    datetime_pattern_2 = re.compile(r"^\d{4}-\d{2}-\d{2} \d{2}_\d{2}_\d{2}$")

    valid_subdirs = []
    for d in subdirs:
        if datetime_pattern_1.match(d) or datetime_pattern_2.match(d):
            valid_subdirs.append(d)

    if not valid_subdirs:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El directorio seleccionado no contiene ninguna carpeta de sesión válida con el formato de fecha y hora requerido (AAAAMMDD_HHMMSS o AAAA-MM-DD HH_MM_SS)."
        )

    sessions = []
    
    # Escanear cada sesión
    for session_name in valid_subdirs:
        session_path = os.path.join(directory, session_name).replace("\\", "/")
        
        has_gas = False
        has_imaging = False
        has_emg = False
        has_audio = False
        users = []

        # 1. Validar gas
        gas_dir = os.path.join(session_path, "Sensores de Gases")
        if os.path.exists(os.path.join(session_path, "gases.csv")) or (os.path.isdir(gas_dir) and os.path.exists(os.path.join(gas_dir, "gases.csv"))):
            has_gas = True

        # 2. Validar cámara/imagenes
        img_dir = os.path.join(session_path, "Imagenes")
        if os.path.isdir(img_dir):
            has_imaging = True

        user_pattern = re.compile(r"^(.+)_([MFmf])_(\d+)$")
        
        try:
            session_entries = os.listdir(session_path)
        except Exception:
            session_entries = []

        for item in session_entries:
            item_path = os.path.join(session_path, item)
            if os.path.isdir(item_path):
                match = user_pattern.match(item)
                if match:
                    user_id = match.group(1)
                    gender = match.group(2).upper()
                    age = int(match.group(3))
                    
                    user_has_emg = False
                    user_has_audio = False
                    
                    try:
                        user_files = os.listdir(item_path)
                    except Exception:
                        user_files = []

                    for f in user_files:
                        f_lower = f.lower()
                        if f_lower.startswith("emg_user") and f_lower.endswith(".csv"):
                            user_has_emg = True
                            has_emg = True
                        if f_lower.startswith("audio_user") and f_lower.endswith(".wav"):
                            user_has_audio = True
                            has_audio = True

                    users.append({
                        "id": user_id,
                        "gender": gender,
                        "age": age,
                        "folder": item,
                        "hasEmg": user_has_emg,
                        "hasAudio": user_has_audio
                    })

        sessions.append({
            "directory": session_path,
            "timestamp": session_name,
            "hasGas": has_gas,
            "hasImaging": has_imaging,
            "hasEmg": has_emg,
            "hasAudio": has_audio,
            "users": users
        })

    # Ordenar por fecha decreciente (más recientes primero)
    def parse_session_time(s):
        ts = s["timestamp"]
        try:
            return datetime.strptime(ts, "%Y%m%d_%H%M%S")
        except ValueError:
            pass
        try:
            return datetime.strptime(ts, "%Y-%m-%d %H_%M_%S")
        except ValueError:
            pass
        return datetime.min

    sessions.sort(key=parse_session_time, reverse=True)

    return sessions


@router.post("/start", response_model=StartSessionResponse, status_code=status.HTTP_201_CREATED)
def start_experiment_session(payload: StartSessionRequest):
    """
    Inicia una nueva sesión de experimentación. 
    Arranca hilos persistentes de hardware para captura de bioseñales.
    """
    try:
        return ExperimentService.start_new_session(payload)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.post("/{session_id}/users/{user_id}/stop", response_model=StopResponse)
def stop_user_capture(
    session_id: str = Path(..., description="ID de la sesión de experimentación activa"),
    user_id: str = Path(..., description="ID interno (número) del usuario a detener, ej: '1'")
):
    """
    Detiene la captura (cierra archivos EMG y corta grabación de Audio) para un usuario específico.
    """
    try:
        return ExperimentService.stop_user_capture(session_id, user_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )

@router.post("/{session_id}/stop", response_model=StopResponse)
def finish_experiment(session_id: str = Path(..., description="ID de la sesión a finalizar")):
    """
    Finaliza el experimento entero. Mata todos los hilos activos (Sensores, Gas, Audio)
    y cierra cualquier archivo que haya quedado abierto.
    """
    try:
        return ExperimentService.finish_experiment(session_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )


@router.get("/sessions/data/gas")
def get_session_gas_data(session_dir: str):
    """
    Lee y procesa el archivo gases.csv de una sesión.
    Retorna los datos de telemetría estructurados para graficar.
    """
    import os
    import csv
    from datetime import datetime

    if not session_dir:
        raise HTTPException(status_code=400, detail="Se requiere 'session_dir'")

    # Buscar gases.csv
    gas_file = os.path.join(session_dir, "gases.csv")
    if not os.path.exists(gas_file):
        gas_file = os.path.join(session_dir, "Sensores de Gases", "gases.csv")

    if not os.path.exists(gas_file):
        raise HTTPException(status_code=404, detail="No se encontró el archivo de gases para esta sesión.")

    data = []
    try:
        with open(gas_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader)
            if not header or len(header) < 2:
                return []
            
            # Formato esperado: [Timestamp, GasRef1, GasRef2, ...]
            # Guardamos el primer timestamp para calcular tiempo relativo en segundos
            first_time = None
            
            for row in reader:
                if not row or len(row) < len(header):
                    continue
                
                ts_str = row[0]
                try:
                    # Intentar parsear el timestamp
                    parsed_ts = None
                    for fmt in ("%H:%M:%S.%f", "%H:%M:%S"):
                        try:
                            parsed_ts = datetime.strptime(ts_str, fmt)
                            break
                        except ValueError:
                            pass
                    
                    if parsed_ts is None:
                        continue
                    
                    if first_time is None:
                        first_time = parsed_ts
                    
                    elapsed = (parsed_ts - first_time).total_seconds()
                    
                    record = {
                        "time": round(elapsed, 1)
                    }
                    
                    for i in range(1, len(header)):
                        val_str = row[i]
                        try:
                            record[header[i]] = float(val_str)
                        except ValueError:
                            record[header[i]] = 0.0
                            
                    data.append(record)
                except Exception:
                    continue
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer el archivo de gases: {str(e)}")

    # Downsampling opcional para agilizar renderizado si hay demasiados puntos
    if len(data) > 300:
        step = len(data) // 150
        data = data[::step]

    return data


@router.get("/sessions/data/emg")
def get_session_emg_data(session_dir: str, user_folder: str):
    """
    Lee y procesa el archivo emg_user_*.csv de un participante de la sesión.
    Retorna los datos de amplitud muscular estructurados para graficar.
    """
    import os
    import csv
    from datetime import datetime

    if not session_dir or not user_folder:
        raise HTTPException(status_code=400, detail="Se requieren 'session_dir' y 'user_folder'")

    user_path = os.path.join(session_dir, user_folder)
    if not os.path.exists(user_path) or not os.path.isdir(user_path):
        raise HTTPException(status_code=404, detail="No se encontró la carpeta del participante.")

    # Buscar emg_user_*.csv
    emg_file = None
    for f in os.listdir(user_path):
        if f.lower().startswith("emg_user") and f.lower().endswith(".csv"):
            emg_file = os.path.join(user_path, f)
            break

    if not emg_file or not os.path.exists(emg_file):
        raise HTTPException(status_code=404, detail="No se encontró el archivo EMG del participante.")

    data = []
    try:
        with open(emg_file, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader)
            # Formato esperado: Timestamp, EMG_Value, Physical_Channel
            
            first_time = None
            for row in reader:
                if not row or len(row) < 2:
                    continue
                ts_str = row[0]
                val_str = row[1]
                try:
                    parsed_ts = None
                    for fmt in ("%H:%M:%S.%f", "%H:%M:%S"):
                        try:
                            parsed_ts = datetime.strptime(ts_str, fmt)
                            break
                        except ValueError:
                            pass
                    
                    if parsed_ts is None:
                        continue
                        
                    if first_time is None:
                        first_time = parsed_ts
                        
                    elapsed = (parsed_ts - first_time).total_seconds()
                    
                    data.append({
                        "time": round(elapsed, 1),
                        "emg": int(val_str)
                    })
                except Exception:
                    continue
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer el archivo EMG: {str(e)}")

    # Downsampling para EMG (suele tener muchos datos a 50Hz)
    if len(data) > 500:
        step = len(data) // 200
        data = data[::step]

    return data


@router.get("/sessions/data/images")
def get_session_images_list(session_dir: str):
    """
    Retorna la lista de nombres de archivos de fotos de la ráfaga de imágenes en la sesión.
    """
    import os
    import re

    if not session_dir:
        raise HTTPException(status_code=400, detail="Se requiere 'session_dir'")

    img_dir = os.path.join(session_dir, "Imagenes")
    if not os.path.exists(img_dir) or not os.path.isdir(img_dir):
        return []

    try:
        files = os.listdir(img_dir)
        # Filtrar extensiones comunes de imagen y ordenar numéricamente
        image_files = [f for f in files if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        
        # Función helper para ordenar de forma natural (foto_1, foto_2, ..., foto_10)
        def natural_sort_key(s):
            return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]
        
        image_files.sort(key=natural_sort_key)
        return image_files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al listar las imágenes: {str(e)}")


@router.get("/sessions/files/image")
def get_session_image_file(
    session_dir: str, 
    filename: str, 
    filter_type: str = None,
    kernel_size: int = 5,
    canny_low: int = 50,
    canny_high: int = 150,
    approx_tolerance: float = 0.04,
    min_area: float = 100.0,
    max_area: float = 50000.0,
    circularity_threshold: float = 0.80
):
    """
    Retorna el archivo de imagen solicitado para su visualización, aplicando opcionalmente
    un filtro de detección de bordes o de formas.
    """
    import os
    from fastapi.responses import FileResponse, StreamingResponse
    import io
    
    if not session_dir or not filename:
        raise HTTPException(status_code=400, detail="Se requieren 'session_dir' y 'filename'")
    
    file_path = os.path.join(session_dir, "Imagenes", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="La imagen especificada no existe.")
        
    if not filter_type or filter_type == "original":
        return FileResponse(file_path)
        
    try:
        import cv2
        import numpy as np
    except ImportError:
        # En caso de no poder importar OpenCV, caemos en la imagen original
        return FileResponse(file_path)
        
    img = cv2.imread(file_path)
    if img is None:
        raise HTTPException(status_code=500, detail="No se pudo leer el archivo de imagen.")
        
    if filter_type == "edges":
        # Detección de bordes usando el algoritmo Canny con parámetros configurables
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Sanitizar tamaño de kernel (debe ser impar y positivo)
        k_size = max(1, int(kernel_size))
        if k_size % 2 == 0:
            k_size += 1
            
        blurred = cv2.GaussianBlur(gray, (k_size, k_size), 0)
        edges = cv2.Canny(blurred, canny_low, canny_high)
        
        _, encoded_img = cv2.imencode(".png", edges)
        return StreamingResponse(io.BytesIO(encoded_img.tobytes()), media_type="image/png")
        
    elif filter_type == "shapes":
        # Detección de formas básicas (contornos y clasificación) usando parámetros configurables
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Sanitizar tamaño de kernel (debe ser impar y positivo)
        k_size = max(1, int(kernel_size))
        if k_size % 2 == 0:
            k_size += 1
            
        blurred = cv2.GaussianBlur(gray, (k_size, k_size), 0)
        edged = cv2.Canny(blurred, canny_low, canny_high)
        
        COLOR_MAP = {
            "Circulo": (0, 0, 255),      # Rojo (BGR)
            "Triangulo": (255, 0, 0),    # Azul (BGR)
            "Cuadrado": (0, 255, 0),     # Verde (BGR)
            "Rectangulo": (0, 255, 255),  # Amarillo (BGR)
            "Pentagono": (255, 0, 255),  # Magenta (BGR)
            "Hexagono": (255, 255, 0),   # Cian (BGR)
            "Poligono": (0, 165, 255)    # Naranja (BGR)
        }

        contours, _ = cv2.findContours(edged.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        output_img = img.copy()
        
        for c in contours:
            area = cv2.contourArea(c)
            # Aplicar filtro de área mínimo y máximo
            if area < min_area or area > max_area:
                continue
                
            # Aproximar el contorno a un polígono
            peri = cv2.arcLength(c, True)
            approx = cv2.approxPolyDP(c, approx_tolerance * peri, True)
            
            # Calcular la circularidad: C = 4 * pi * Area / (Perimetro^2)
            circularity = 0.0
            if peri > 0:
                circularity = (4 * np.pi * area) / (peri ** 2)
                
            num_vertices = len(approx)
            
            # Clasificar forma
            if circularity >= circularity_threshold:
                shape = "Circulo"
            elif num_vertices == 3:
                shape = "Triangulo"
            elif num_vertices == 4:
                (x, y, w, h) = cv2.boundingRect(approx)
                ar = w / float(h)
                shape = "Cuadrado" if 0.95 <= ar <= 1.05 else "Rectangulo"
            elif num_vertices == 5:
                shape = "Pentagono"
            elif num_vertices == 6:
                shape = "Hexagono"
            else:
                shape = "Poligono"
                
            # Obtener el color correspondiente de COLOR_MAP
            color = COLOR_MAP.get(shape, (0, 255, 0))
            
            # Dibujar contorno detectado con su color específico (grosor 1 para líneas más delgadas)
            cv2.drawContours(output_img, [c], -1, color, 1)
                
        _, encoded_img = cv2.imencode(".png", output_img)
        return StreamingResponse(io.BytesIO(encoded_img.tobytes()), media_type="image/png")
        
    return FileResponse(file_path)


@router.get("/sessions/files/audio")
def get_session_audio_file(
    session_dir: str, 
    user_folder: str,
    filter_type: str = "original",
    noise_start: float = 0.0,
    noise_end: float = 1.0
):
    """
    Retorna el archivo de audio (.wav) del participante para su reproducción, con filtrado opcional.
    """
    import os
    import io
    from fastapi.responses import FileResponse, StreamingResponse
    
    if not session_dir or not user_folder:
        raise HTTPException(status_code=400, detail="Se requieren 'session_dir' y 'user_folder'")

    user_path = os.path.join(session_dir, user_folder)
    if not os.path.exists(user_path) or not os.path.isdir(user_path):
        raise HTTPException(status_code=404, detail="No se encontró la carpeta del participante.")

    # Buscar audio_user_*.wav
    audio_file = None
    for f in os.listdir(user_path):
        if f.lower().startswith("audio_user") and f.lower().endswith(".wav"):
            audio_file = os.path.join(user_path, f)
            break

    if not audio_file or not os.path.exists(audio_file):
        raise HTTPException(status_code=404, detail="No se encontró el archivo de audio del participante.")

    if not filter_type or filter_type == "original":
        return FileResponse(audio_file, media_type="audio/wav")
        
    try:
        import librosa
        import soundfile as sf
        import numpy as np
        
        y_audio, sr = librosa.load(audio_file, sr=None)
        
        if filter_type == "hpss":
            y_harmonic, _ = librosa.effects.hpss(y_audio)
            y_audio = y_harmonic
            
        elif filter_type == "reduce_noise":
            import noisereduce as nr
            # Ensure noise bounds are valid
            n_start = int(max(0, noise_start * sr))
            n_end = int(min(len(y_audio), noise_end * sr))
            if n_start >= n_end:
                # If bounds are invalid, fall back to a default segment (e.g. first second)
                n_start = 0
                n_end = min(len(y_audio), sr)
                
            y_noise = y_audio[n_start:n_end]
            y_audio = nr.reduce_noise(y=y_audio, y_noise=y_noise, sr=sr)
            
        # Write to memory buffer
        buf = io.BytesIO()
        sf.write(buf, y_audio, sr, format='WAV')
        buf.seek(0)
        return StreamingResponse(buf, media_type="audio/wav")
        
    except Exception as e:
        print(f"Error procesando audio: {e}")
        return FileResponse(audio_file, media_type="audio/wav")

