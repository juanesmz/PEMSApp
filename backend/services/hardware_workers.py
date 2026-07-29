import os
import cv2
import time
import wave
import csv
import serial
import threading
import numpy as np
import sounddevice as sd
from datetime import datetime

class AudioRecorderWorker(threading.Thread):
    def __init__(self, device_index, filename, channel=0, num_channels=1, samplerate=44100):
        super().__init__(daemon=True)
        self.device_index = device_index
        self.filename = filename
        self.channel = channel
        self.num_channels = num_channels
        self.samplerate = samplerate
        self._running = False

    def run(self):
        self._running = True
        try:
            os.makedirs(os.path.dirname(self.filename), exist_ok=True)
            with wave.open(self.filename, 'wb') as wf:
                wf.setnchannels(1) 
                wf.setsampwidth(2) 
                wf.setframerate(self.samplerate)
                with sd.InputStream(device=self.device_index, channels=self.num_channels, 
                                    samplerate=self.samplerate, dtype='int16') as stream:
                    while self._running:
                        data, overflowed = stream.read(2048)
                        if self._running and not overflowed:
                            if self.num_channels > 1:
                                mono_data = data[:, self.channel].copy()
                            else:
                                mono_data = data.copy()
                            wf.writeframes(mono_data.tobytes())
        except Exception as e:
            print(f"[AudioRecorderWorker] Error: {e}")

    def stop(self):
        self._running = False

class SerialRecorderWorker(threading.Thread):
    def __init__(self, port, baudrate=115200, on_data=None, on_error=None):
        super().__init__(daemon=True)
        self.port = port
        self.baudrate = baudrate
        self._running = False
        self.on_data = on_data
        self.on_error = on_error

    def run(self):
        self._running = True
        try:
            with serial.Serial(self.port, self.baudrate, timeout=1) as ser:
                ser.reset_input_buffer()
                while self._running:
                    if ser.in_waiting > 0:
                        try:
                            line = ser.readline().decode('utf-8', errors='ignore').strip()
                            if not line: continue
                            parts = [p.strip() for p in line.split(',') if p.strip()]
                            if len(parts) != 6:
                                if self.on_error: self.on_error(f"Datos EMG inválidos: se recibieron {len(parts)} valores en lugar de 6.")
                                continue
                            try:
                                values = [int(p) for p in parts]
                                if self.on_data: self.on_data(values)
                            except ValueError:
                                if self.on_error: self.on_error("Datos EMG inválidos: los valores deben ser números enteros.")
                                continue
                        except Exception as e:
                            if self.on_error: self.on_error(f"Error de lectura serial: {str(e)}")
                            break
                    else:
                        time.sleep(0.005)
        except Exception as e:
            if self.on_error: self.on_error(f"No se pudo conectar al puerto {self.port}: {str(e)}")
            print(f"[SerialRecorderWorker] Error: {e}")

    def stop(self):
        self._running = False

class GasRecorderWorker(threading.Thread):
    def __init__(self, filename, sensors_config, duration=60):
        super().__init__(daemon=True)
        self.filename = filename
        self.config = sensors_config
        self.duration = duration
        self._running = False

    def run(self):
        self._running = True
        active_config = [c for c in self.config if c.get("reference") != "N/A"]
        if not active_config:
            print("[GasRecorderWorker] Sin sensores configurados.")
            self._running = False
            return

        names = []
        refs = []
        for c in active_config:
            try:
                sid = c.get("sensor_id")
                ref = c.get("reference")
                num = int(sid.split("_")[1])
                names.append(f"AIN{num-1}")
                refs.append(ref)
            except Exception:
                continue

        num_sensors = len(names)
        try:
            from services.hardware.labjack_service import labjack_service
            labjack_service.connect()

            os.makedirs(os.path.dirname(self.filename), exist_ok=True)
            with open(self.filename, 'w', newline='', encoding='utf-8') as f:
                writer = csv.writer(f)
                writer.writerow(["Timestamp"] + refs)
                start_time = time.time()
                while self._running and (time.time() - start_time < self.duration):
                    ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
                    results = labjack_service.read_channels(names)
                    writer.writerow([ts] + results)
                    time.sleep(0.5)
        except Exception as e:
            print(f"[GasRecorderWorker] Error: {e}")

    def stop(self):
        self._running = False

class PhotoCaptureWorker(threading.Thread):
    def __init__(self, directory, camera_index, roi=None):
        super().__init__(daemon=True)
        self.directory = directory
        self.camera_index = camera_index
        self.roi = roi

    def run(self):
        try:
            cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap = cv2.VideoCapture(self.camera_index)
            if not cap.isOpened():
                return
            for _ in range(5):
                cap.read()
                time.sleep(0.1)

            for i in range(1, 11):
                ret, frame = cap.read()
                if ret:
                    if self.roi:
                        try:
                            p1, p2 = self.roi
                            x1, y1 = int(p1[0]), int(p1[1])
                            x2, y2 = int(p2[0]), int(p2[1])
                            rx1, ry1 = min(x1, x2), min(y1, y2)
                            rx2, ry2 = max(x1, x2), max(y1, y2)
                            h, w = frame.shape[:2]
                            rx1, ry1 = max(0, rx1), max(0, ry1)
                            rx2, ry2 = min(w, rx2), min(h, ry2)
                            if rx2 > rx1 and ry2 > ry1:
                                frame = frame[ry1:ry2, rx1:rx2]
                        except: pass
                    cv2.imwrite(os.path.join(self.directory, f"foto_{i}.jpg"), frame)
                    time.sleep(0.2)
            cap.release()
        except Exception as e:
            print(f"[PhotoCaptureWorker] Error: {e}")
