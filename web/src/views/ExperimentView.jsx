import React from 'react';
import { useAppContext } from '../context/AppContext';
import Header from '../components/Header';
import CabinCleaning from './experiment/CabinCleaning';
import GasSensors from './experiment/GasSensors';
import EMGSensors from './experiment/EMGSensors';
import Microphones from './experiment/Microphones';
import Cameras from './experiment/Cameras';
import Configuration from './experiment/Configuration';
import { Check, X, ArrowLeft, ArrowRight, SkipForward, Play } from 'lucide-react';

const ExperimentView = () => {
  const {
    goTo,
    cabinCleaningCompleted,
    gasConfig,
    emgSelectedSensors,
    micList,
    usersData,
    baseSavePath,
    selectedCameraIndex,
    roi,
    modulesStatus,
    setModulesStatus,
    omittedModules,
    setOmittedModules,
    currentStepIndex,
    setCurrentStepIndex,
    setRunningStep,
    setIsCapturing,
    setUserCaptureActive,
    setCountdownSeconds,
    setLatestSessionPath,
    sessionId,
    setSessionId,
    showAlert,
    showConfirm,
    arduinoPort
  } = useAppContext();

  const SIDEBAR_SECTIONS = [
    'Limpieza de cabina',
    'Sensores de gas',
    'Sensores EMG',
    'Micrófonos',
    'Cámaras',
    'Configuración',
  ];

  // Render subpage based on active index
  const renderStepContent = () => {
    switch (currentStepIndex) {
      case 0:
        return <CabinCleaning />;
      case 1:
        return <GasSensors />;
      case 2:
        return <EMGSensors />;
      case 3:
        return <Microphones />;
      case 4:
        return <Cameras />;
      case 5:
        return <Configuration />;
      default:
        return <CabinCleaning />;
    }
  };

  // --- Step Navigation Controls ---

  // Next section handler
  const handleNext = async () => {
    const total = SIDEBAR_SECTIONS.length;
    if (currentStepIndex >= total - 1) return;

    // Validate current step before advancing
    if (currentStepIndex === 0) {
      // Leaving Cabin Cleaning
      if (!cabinCleaningCompleted) {
        const confirmSkipGas = await showConfirm(
          'Limpieza no realizada',
          'Avanzar sin realizar limpieza hará que el uso de sensores de gases no sea permitido.\n¿Desea continuar de todos modos (saltando Sensores de Gas)?'
        );
        if (confirmSkipGas) {
          // Set cleaning and gas as omitted (red)
          const newOmitted = [...omittedModules];
          newOmitted[0] = true;
          newOmitted[1] = true;
          setOmittedModules(newOmitted);

          const newStatus = [...modulesStatus];
          newStatus[0] = true;
          newStatus[1] = true;
          setModulesStatus(newStatus);

          setCurrentStepIndex(2); // Jump directly to EMG
        }
        return;
      }
    }

    if (currentStepIndex === 1) {
      // Leaving Gas Sensors
      const activeGasCount = gasConfig.filter(row => row.ref !== 'N/A').length;
      if (activeGasCount === 0) {
        await showAlert(
          'Módulo de Gas inactivo',
          'No se ha seleccionado una configuración de referencias para los canales de gas. El módulo de gases no se activará para este experimento.'
        );
        const newOmitted = [...omittedModules];
        newOmitted[1] = true;
        setOmittedModules(newOmitted);

        const newStatus = [...modulesStatus];
        newStatus[1] = true;
        setModulesStatus(newStatus);

        setCurrentStepIndex(2); // Jump to EMG
        return;
      }
    }

    if (currentStepIndex === 2) {
      // Leaving EMG
      if (emgSelectedSensors.length === 0) {
        const confirmSkipEmg = await showConfirm(
          'Sin sensores EMG',
          'No ha seleccionado sensores de EMG. El módulo de electromiografía no se activará para este experimento.\n¿Desea continuar a la configuración de micrófonos?'
        );
        if (confirmSkipEmg) {
          const newOmitted = [...omittedModules];
          newOmitted[2] = true;
          setOmittedModules(newOmitted);

          const newStatus = [...modulesStatus];
          newStatus[2] = true;
          setModulesStatus(newStatus);

          setCurrentStepIndex(3); // Jump to Mics
        }
        return;
      }
    }

    if (currentStepIndex === 3) {
      // Leaving Microphones
      const numEmg = emgSelectedSensors.length;
      const numMic = micList.length;

      if (numMic === 0) {
        const confirmSkipMics = await showConfirm(
          'Sin micrófonos',
          'No ha seleccionado micrófonos. El módulo de audio no se activará para este experimento.\n¿Desea continuar?'
        );
        if (confirmSkipMics) {
          const newOmitted = [...omittedModules];
          newOmitted[3] = true;
          setOmittedModules(newOmitted);

          const newStatus = [...modulesStatus];
          newStatus[3] = true;
          setModulesStatus(newStatus);

          setCurrentStepIndex(4); // Jump to Cameras
        }
        return;
      }
    }

    if (currentStepIndex === 4) {
      // Leaving Cameras (Going to Configuration)
      let isOmitted = false;

      if (selectedCameraIndex === null || selectedCameraIndex === undefined) {
        const confirmSkipCam = await showConfirm(
          'Sin cámara',
          'No ha seleccionado ninguna cámara. El módulo de cámara no se activará para este experimento.\n¿Desea continuar?'
        );
        if (!confirmSkipCam) return;
        isOmitted = true;
      } else if (!roi.p1 || !roi.p2) {
        const confirmSkipRoi = await showConfirm(
          'Sin región de interés (ROI)',
          'No ha seleccionado una Región de Interés (ROI). El módulo de cámara no se activará para este experimento.\n¿Desea continuar?'
        );
        if (!confirmSkipRoi) return;
        isOmitted = true;
      }

      // Check if at least one sensor/module in index 0..4 is active (checked and not omitted)
      const nextChecked = [...modulesStatus];
      nextChecked[4] = true; // camera complete

      const nextOmitted = [...omittedModules];
      if (isOmitted) {
        nextOmitted[4] = true;
      }

      const anyActive = Array.from({ length: 5 }).some(
        (_, idx) => nextChecked[idx] && !nextOmitted[idx]
      );

      if (!anyActive) {
        await showAlert(
          'Acceso denegado',
          'Debe activar al menos una sección para ingresar a la Configuración del experimento.'
        );
        return; // Block
      }

      // Commit changes and advance
      setOmittedModules(nextOmitted);
      setModulesStatus(nextChecked);
      setCurrentStepIndex(5);
      return;
    }

    // Standard Advance
    const newStatus = [...modulesStatus];
    newStatus[currentStepIndex] = true;
    setModulesStatus(newStatus);

    setCurrentStepIndex(currentStepIndex + 1);
  };

  // Skip section handler
  const handleSkip = async () => {
    // If we are in Configuration (step 5), this button starts the live capturing experiment
    if (currentStepIndex === 5) {
      handleStartLiveExperiment();
      return;
    }

    if (currentStepIndex === 0) {
      // Skipping Cabin Cleaning
      const confirmSkipGas = await showConfirm(
        'Limpieza no realizada',
        'Avanzar sin realizar limpieza hará que el uso de sensores de gases no sea permitido.\n¿Desea continuar de todos modos (saltando Sensores de Gas)?'
      );
      if (confirmSkipGas) {
        // Set cleaning and gas as omitted (red)
        const newOmitted = [...omittedModules];
        newOmitted[0] = true;
        newOmitted[1] = true;
        setOmittedModules(newOmitted);

        const newStatus = [...modulesStatus];
        newStatus[0] = true;
        newStatus[1] = true;
        setModulesStatus(newStatus);

        setCurrentStepIndex(2); // Jump directly to EMG
      }
      return;
    }

    // Mark current section as omitted (Red) and checked
    const newOmitted = [...omittedModules];
    newOmitted[currentStepIndex] = true;
    setOmittedModules(newOmitted);

    const newStatus = [...modulesStatus];
    newStatus[currentStepIndex] = true;
    setModulesStatus(newStatus);

    // Leaving Cameras (Going to Config) checking active
    if (currentStepIndex === 4) {
      const anyActive = Array.from({ length: 5 }).some(
        (_, idx) => newStatus[idx] && !newOmitted[idx]
      );
      if (!anyActive) {
        await showAlert(
          'Acceso denegado',
          'Debe activar al menos una sección para ingresar a la Configuración del experimento.'
        );
        return;
      }
    }

    setCurrentStepIndex(currentStepIndex + 1);
  };

  // Prev section handler
  const handlePrev = () => {
    if (currentStepIndex <= 0) return;

    if (currentStepIndex === 2) {
      // Back from EMG
      if (omittedModules[0] && omittedModules[1]) {
        // Reset steps 0 & 1 states
        const newStatus = [...modulesStatus];
        newStatus[0] = false;
        newStatus[1] = false;
        setModulesStatus(newStatus);

        const newOmitted = [...omittedModules];
        newOmitted[0] = false;
        newOmitted[1] = false;
        setOmittedModules(newOmitted);

        setCurrentStepIndex(0); // Jump back to Cleaning
        return;
      }
    }

    if (currentStepIndex === 4) {
      // Back from Cameras
      if (omittedModules[3]) {
        const newStatus = [...modulesStatus];
        newStatus[3] = false;
        setModulesStatus(newStatus);

        const newOmitted = [...omittedModules];
        newOmitted[3] = false;
        setOmittedModules(newOmitted);

        setCurrentStepIndex(3); // Jump to Mics
        return;
      }
    }

    if (currentStepIndex === 3) {
      // Back from Mics
      if (omittedModules[2]) {
        const newStatus = [...modulesStatus];
        newStatus[2] = false;
        setModulesStatus(newStatus);

        const newOmitted = [...omittedModules];
        newOmitted[2] = false;
        setOmittedModules(newOmitted);

        setCurrentStepIndex(2); // Jump to EMG
        return;
      }
    }

    // Standard Go Back
    const newStatus = [...modulesStatus];
    newStatus[currentStepIndex - 1] = false;
    setModulesStatus(newStatus);

    const newOmitted = [...omittedModules];
    newOmitted[currentStepIndex - 1] = false;
    setOmittedModules(newOmitted);

    setCurrentStepIndex(currentStepIndex - 1);
  };

  const handleStartLiveExperiment = async () => {
    // Prepare the payload for start session
    const payload = {
      base_path: baseSavePath,
      emg_port: arduinoPort,
      active_modules: {
        gas: modulesStatus[1] && !omittedModules[1],
        emg: modulesStatus[2] && !omittedModules[2],
        mic: modulesStatus[3] && !omittedModules[3],
        camera: modulesStatus[4] && !omittedModules[4]
      },
      users: usersData.map(u => ({
        id: u.id,
        gender: u.gender,
        age: u.age,
        emg_index: u.emg_index,
        mic_config: u.mic_config ? {
          device_index: u.mic_config.index,
          channel: u.mic_config.channel || 0,
          num_channels: u.mic_config.num_channels || 1
        } : null
      })),
      camera_index: selectedCameraIndex !== null ? selectedCameraIndex : 0,
      roi: roi.p1 && roi.p2 ? [[roi.p1.x || 0, roi.p1.y || 0], [roi.p2.x || 0, roi.p2.y || 0]] : null,
      mic_list: micList.map(mic => ({
        device_index: mic.index,
        channel: mic.channel || 0,
        num_channels: mic.num_channels || 1
      })),
      emg_indices: emgSelectedSensors, // indices chosen
      gas_config: gasConfig
        .filter(row => row.ref !== 'N/A')
        .map(row => ({
          sensor_id: row.sensorId,
          reference: row.ref
        }))
    };

    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/experiments/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Error al iniciar la sesión de experimentación en el backend");
      }

      const result = await response.json();
      
      // Set the path returned by the backend
      setLatestSessionPath(result.session_dir.replace(/\\/g, '/'));
      setSessionId(result.session_id);
      
      // Reset live simulation metrics
      setCountdownSeconds(60);
      setRunningStep('capturing');
      setIsCapturing(true);
      
      // Set first N users active matching configured length
      const initialUsersActive = Array(6).fill(false);
      for (let i = 0; i < usersData.length; i++) {
        initialUsersActive[i] = true;
      }
      setUserCaptureActive(initialUsersActive);

      goTo('running_exp');
    } catch (error) {
      console.error("Error al iniciar el experimento:", error);
      await showAlert("Error", `No se pudo iniciar el experimento: ${error.message}`);
    }
  };

  // Sidebar styling helper
  const getSidebarItemStyles = (idx) => {
    const isActive = idx === currentStepIndex;
    const isDone = modulesStatus[idx];
    const isRed = omittedModules[idx];

    let indicatorColor = 'bg-capsab-gray-check'; // Gray
    if (isRed) {
      indicatorColor = 'bg-capsab-red'; // Red
    } else if (isDone) {
      indicatorColor = 'bg-capsab-green'; // Green
    }

    let bgStyle = 'bg-transparent';
    if (isActive) {
      bgStyle = 'bg-capsab-gray-active';
    }

    let textWeight = 'font-normal';
    if (isActive) {
      textWeight = 'font-bold';
    }

    // Config block logic (step 5)
    let isBlock = false;
    if (idx === 5) {
      const anyActive = Array.from({ length: 5 }).some(
        (_, j) => modulesStatus[j] && !omittedModules[j]
      );
      isBlock = !anyActive;
    }

    return { indicatorColor, bgStyle, textWeight, isBlock };
  };

  return (
    <div className="h-screen flex flex-col bg-slate-100 select-none overflow-hidden">
      <Header title="Módulo de experimentación" />

      {/* Main Container */}
      <div className="flex-1 w-full px-8 py-6 flex flex-col lg:flex-row gap-6 overflow-hidden">
        
        {/* Left Sidebar Menu */}
        <aside className="w-full lg:w-[260px] bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col select-none">
          <h3 className="text-xs font-bold text-slate-400 tracking-wider mb-4 px-3">
            Pasos de captura
          </h3>

          <nav className="space-y-1">
            {SIDEBAR_SECTIONS.map((name, idx) => {
              const { indicatorColor, bgStyle, textWeight, isBlock } = getSidebarItemStyles(idx);
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-xl transition duration-150 ${bgStyle} ${
                    isBlock ? 'opacity-40 pointer-events-none' : ''
                  }`}
                >
                  {/* Status Circle Indicator */}
                  <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white ${indicatorColor}`}>
                    {modulesStatus[idx] && !omittedModules[idx] ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : omittedModules[idx] ? (
                      <X className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-350"></div>
                    )}
                  </div>

                  {/* Section Label */}
                  <span className={`text-slate-800 text-sm tracking-wide ${textWeight}`}>
                    {name}
                  </span>
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Center Panel (Step Component & Lower Nav Buttons) */}
        <div className="flex-1 flex flex-col gap-6 min-h-0">
          
          {/* Subpage content */}
          <div className="flex-1 min-h-0">
            {renderStepContent()}
          </div>

          {/* Lower Nav Buttons */}
          <div className="flex items-center gap-3 select-none">
            {/* Prev Button */}
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-white text-slate-700 border border-slate-300 font-bold rounded-xl hover:bg-slate-50 active:bg-slate-100 transition duration-150 shadow-sm cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </button>
            )}

            {/* Next Button */}
            {currentStepIndex < SIDEBAR_SECTIONS.length - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                className={`flex-1 flex items-center justify-center gap-2 py-3 bg-capsab-green hover:bg-capsab-green-hover text-white font-bold rounded-xl transition duration-150 shadow-md hover:shadow-lg cursor-pointer ${
                  currentStepIndex === 0 ? 'ml-0' : ''
                }`}
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : null}

            {/* Skip / Iniciar Button */}
            <button
              type="button"
              onClick={handleSkip}
              className={`flex items-center justify-center gap-2 py-3 font-bold rounded-xl transition duration-150 shadow-md hover:shadow-lg cursor-pointer ${
                currentStepIndex === 5
                  ? 'flex-1 bg-capsab-green hover:bg-capsab-green-hover text-white'
                  : 'bg-capsab-orange hover:bg-capsab-orange-hover text-white min-w-[150px]'
              }`}
            >
              {currentStepIndex === 5 ? (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Iniciar experimentación
                </>
              ) : (
                <>
                  Omitir sección
                  <SkipForward className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};

export default ExperimentView;
