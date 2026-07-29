from fastapi import APIRouter
from api.routers import experiment, gas, cleaning, emg, microphones, cameras

api_router = APIRouter()

# Registrar los routers de cada módulo
api_router.include_router(experiment.router)
api_router.include_router(gas.router)
api_router.include_router(cleaning.router)
api_router.include_router(emg.router)
api_router.include_router(microphones.router)
api_router.include_router(cameras.router)
