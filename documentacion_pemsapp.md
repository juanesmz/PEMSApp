# PEMSApp - Documentación Detallada del Proyecto

**PEMSApp** es la evolución web y distribuida de la plataforma de evaluación sensorial. A diferencia de su predecesor (PEMSA Qt), este proyecto adopta una arquitectura cliente-servidor moderna que separa completamente el backend (control de hardware y lógica) del frontend (interfaz de usuario web).

---

## 1. Arquitectura del Proyecto

El proyecto se divide en dos grandes subdirectorios y dominios:

- **Backend (`backend/`)**: Desarrollado en Python con el framework **FastAPI**. Es stateless en su capa de red y se encarga de exponer una API RESTful para la gestión de experimentos, y de comunicarse directamente con el hardware de los sensores (LabJack, Arduino, Micrófono, Cámara).
- **Frontend (`web/`)**: Desarrollado como una Single Page Application (SPA) utilizando **React 19** y empaquetado con **Vite**. Se encarga de toda la capa de presentación.

---

## 2. Backend (FastAPI)

El backend expone endpoints bajo el prefijo `/api/v1` y maneja CORS para permitir solicitudes desde el frontend.

### 2.1. Estructura de Directorios del Backend
- **`main.py`**: Punto de entrada de la aplicación. Configura la instancia de FastAPI, los middlewares (CORS) y registra el enrutador principal (`api_router`).
- **`api/`**: Capa de presentación y red RESTful.
  - `api_router.py`: Orquesta y agrupa todos los sub-routers.
  - `routers/`: Contiene los controladores de los endpoints organizados por dominio: `experiment.py`, `gas.py`, `cleaning.py`, `emg.py`, `microphones.py`, y `cameras.py`.
- **`schemas/`**: Define los modelos de datos usando Pydantic (`experiment.py`, `gas.py`), lo que garantiza la validación de los payloads (entradas y salidas) de la API y auto-genera la documentación OpenAPI.
- **`services/`**: Capa de lógica de negocio y gestión de hardware.
  - Lógica general: `experiment_service.py`, `gas_config_service.py`.
  - Orquestación de Hardware: `hardware_manager.py` (administra el ciclo de vida de las conexiones) y `hardware_workers.py` (maneja la concurrencia y recolección de datos asíncrona de los sensores).
  - **`hardware/`**: Controladores de bajo nivel para comunicación directa con dispositivos: `labjack_service.py` (Gas), `serial_service.py` (EMG), `audio_service.py` (Micrófono) y `camera_service.py` (Webcam).

---

## 3. Frontend (React + Vite)

El frontend está alojado en la carpeta `web/` y está diseñado para consumir la API de FastAPI.

### 3.1. Versionamiento y Dependencias (`web/package.json`)
El entorno está gestionado por npm/Node.js, usando **Vite 8** como bundler para una recarga rápida y empaquetado optimizado.

**Dependencias Clave:**
- `react` y `react-dom` (^19.2.6): Librerías base para la interfaz reactiva.
- `tailwindcss` (^4.3.0) y `@tailwindcss/postcss`: Framework CSS de utilidades para un estilizado rápido y consistente sin archivos CSS pesados.
- `recharts` (^3.8.1): Utilizado para las gráficas y visualización de señales (gas, emg) en tiempo real o histórico.
- `lucide-react`: Colección de íconos vectoriales modernos utilizados a lo largo de la UI.

### 3.2. Estructura del Frontend (`web/src/`)
- **`main.jsx` & `App.jsx`**: Raíz de la aplicación, configuración de contextos globales y enrutamiento (presumiblemente con React Router o renderizado condicional).
- **`views/`**: Representan las "páginas" completas o pantallas de la aplicación.
  - `LoginView.jsx`: Acceso al sistema.
  - `MainMenuView.jsx`: Navegación principal.
  - `SettingsView.jsx`: Configuración global.
  - `ExperimentView.jsx`: Vista para configurar y preparar los sensores de una prueba.
  - `RunningExpView.jsx`: Dashboard del experimento en tiempo real (maneja llamadas a los workers del backend y grafica con Recharts).
  - `VisualizationView.jsx` y `AnalysisView.jsx`: Vistas pesadas para el post-procesamiento visual e histórico de datos.
  - `experiment/`: Sub-vistas o componentes específicos para los pasos de configuración de los sensores antes de arrancar.
- **`components/`**: Componentes reutilizables a lo largo del sistema.
  - `Header.jsx`: Barra superior (branding, controles de navegación globales).
  - `CustomModal.jsx`: Sistema base para ventanas emergentes, diálogos de confirmación o de error.
- **`context/`**: Manejo de estado global de la aplicación (ej. datos del usuario autenticado, estado de conexión de sensores, configuración activa de un experimento en curso).

---

## 4. Flujo de Comunicación (Hardware - Backend - Frontend)

1. **Configuración**: El usuario en el frontend (`ExperimentView.jsx`) envía los parámetros de configuración. El backend lo valida usando Pydantic en `schemas/` y `routers/experiment.py`, y delega al `experiment_service.py`.
2. **Conexión a Sensores**: A través de HTTP/REST (o WebSockets si está implementado para tiempo real), el `RunningExpView.jsx` solicita iniciar el muestreo.
3. **Muestreo Asíncrono**: `hardware_manager.py` levanta `hardware_workers.py`, los cuales iteran sobre las clases en `services/hardware/` obteniendo datos crudos (ej. desde el serial port del EMG o los pines del LabJack).
4. **Visualización en Vivo**: El frontend realiza *polling* de los datos o los recibe de manera fluida, inyectándolos en el estado de React. `recharts` se actualiza inmediatamente mostrando las gráficas de respuesta fisiológica o gaseosa en pantalla.
5. **Finalización**: Se detienen los workers del backend, se persisten los datos (CSV/BD) y el frontend permite redirigirse a `AnalysisView.jsx` para revisar el resultado.
