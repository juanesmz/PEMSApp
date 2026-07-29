from pydantic import BaseModel, Field
from typing import List, Optional, Tuple, Dict

class MicConfig(BaseModel):
    device_index: int
    channel: int = 0
    num_channels: int = 1

class UserExperimentInfo(BaseModel):
    id: str = Field(..., description="ID único del participante")
    gender: str = Field(..., max_length=1)
    age: int = Field(..., ge=0, le=120)
    emg_index: Optional[int] = None
    mic_config: Optional[MicConfig] = None

class GasConfig(BaseModel):
    sensor_id: str
    reference: str

class StartSessionRequest(BaseModel):
    base_path: str = Field(..., description="Ruta base donde se guardará el experimento")
    emg_port: Optional[str] = Field(None, description="Puerto COM del Arduino de EMG")
    active_modules: Dict[str, bool] = Field(
        default={"gas": False, "emg": False, "mic": False, "camera": False},
        description="Módulos que efectivamente se utilizarán en esta sesión"
    )
    users: List[UserExperimentInfo] = []
    camera_index: Optional[int] = 0
    roi: Optional[Tuple[Tuple[int, int], Tuple[int, int]]] = None
    mic_list: List[MicConfig] = []
    emg_indices: List[int] = []
    gas_config: List[GasConfig] = []

class StartSessionResponse(BaseModel):
    message: str
    session_id: str
    session_dir: str

class StopResponse(BaseModel):
    message: str
