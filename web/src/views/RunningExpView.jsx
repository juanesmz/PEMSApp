import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import Header from '../components/Header';
import { Activity, Clock, ShieldAlert, Check, Camera, User, Trash2 } from 'lucide-react';

const RunningExpView = () => {
  const {
    goTo,
    usersData,
    modulesStatus,
    omittedModules,
    gasConfig,
    emgSelectedSensors,
    micList,
    roi,
    latestSessionPath,
    countdownSeconds,
    setCountdownSeconds,
    userCaptureActive,
    setUserCaptureActive,
    mockSessions,
    setMockSessions,
    showConfirm,
    sessionId,
    showAlert
  } = useAppContext();

  // Active status of modules
  const gasActive = modulesStatus[1] && !omittedModules[1];
  const emgActive = modulesStatus[2] && !omittedModules[2];
  const micActive = modulesStatus[3] && !omittedModules[3];
  const camActive = modulesStatus[4] && !omittedModules[4];

  // Live countdown timer for gas sensors
  const [timerString, setTimerString] = useState('01:00');
  const [gasDone, setGasDone] = useState(false);

  // Live photo burst capture state
  const [photoCount, setPhotoCount] = useState(0);
  const [camStatusText, setCamStatusText] = useState('Listo');

  // Canvas drawing references for real-time visualizers (one for each participant)
  const audioCanvasRefs = useRef([]);
  const emgCanvasRefs = useRef([]);
  const animationRef = useRef(null);

  // WebSocket connections and rolling buffers for real sensor data
  const micWebSocketsRef = useRef(Array(6).fill(null));
  const emgWebSocketRef = useRef(null);
  const latestAudioSamplesRef = useRef(Array(6).fill(null));
  const emgDataBuffersRef = useRef(Array.from({ length: 6 }, () => Array(200).fill(512)));

  // Gas timer countdown effect
  useEffect(() => {
    if (!gasActive) return;

    const timer = setInterval(() => {
      setCountdownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setGasDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gasActive]);

  // Sync countdown seconds to visual time string
  useEffect(() => {
    const mins = Math.floor(countdownSeconds / 60);
    const secs = countdownSeconds % 60;
    setTimerString(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
  }, [countdownSeconds]);

  // Camera Photo Burst Mocking
  useEffect(() => {
    if (!camActive) return;

    setCamStatusText('Cámara conectada, calentando auto-exposición...');
    
    // Brief warming delay
    const startTimeout = setTimeout(() => {
      setCamStatusText('Tomando ráfaga de fotos...');
      let count = 0;
      const interval = setInterval(() => {
        count += 1;
        setPhotoCount(count);
        if (count >= 10) {
          clearInterval(interval);
          setCamStatusText('✓ Ráfaga de 10 fotos completada y guardada.');
        }
      }, 300);
      return () => clearInterval(interval);
    }, 1500);

    return () => clearTimeout(startTimeout);
  }, [camActive]);

  // Establish WebSocket connections to read live data from microphones and EMG
  useEffect(() => {
    // 1. Connect to live EMG WebSocket (broadcasts values from active serial reading)
    if (emgActive) {
      const emgUrl = 'ws://127.0.0.1:8000/api/v1/emg/live';
      console.log('Connecting to Live EMG WS:', emgUrl);
      const ws = new WebSocket(emgUrl);
      emgWebSocketRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.values) {
            usersData.forEach((user, index) => {
              const isActive = userCaptureActive[index];
              if (isActive && user.emg_index !== null && user.emg_index !== undefined) {
                const val = data.values[user.emg_index];
                if (val !== undefined) {
                  const buffer = emgDataBuffersRef.current[index];
                  buffer.push(val);
                  if (buffer.length > 200) {
                    buffer.shift();
                  }
                }
              }
            });
          }
        } catch (e) {
          console.error('Error parsing live EMG WS data:', e);
        }
      };

      ws.onerror = (err) => {
        console.error('Live EMG WS Error:', err);
      };

      ws.onclose = () => {
        console.log('Live EMG WS closed');
      };
    }

    // 2. Connect to Microphones WebSockets
    if (micActive) {
      usersData.forEach((user, index) => {
        const isActive = userCaptureActive[index];
        if (isActive && user.mic_config) {
          const devIdx = user.mic_config.device_index;
          const channel = user.mic_config.channel;
          const micUrl = `ws://127.0.0.1:8000/api/v1/microphones/${devIdx}/stream?channel=${channel}`;
          console.log(`Connecting to Mic WS for User ${index + 1}:`, micUrl);

          const ws = new WebSocket(micUrl);
          micWebSocketsRef.current[index] = ws;

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              if (data.samples) {
                latestAudioSamplesRef.current[index] = data.samples;
              }
            } catch (e) {
              console.error(`Error parsing mic WS data for User ${index + 1}:`, e);
            }
          };

          ws.onerror = (err) => {
            console.error(`Mic WS Error for User ${index + 1}:`, err);
          };

          ws.onclose = () => {
            console.log(`Mic WS closed for User ${index + 1}`);
          };
        }
      });
    }

    // Cleanup WebSockets on unmount or status changes
    return () => {
      if (emgWebSocketRef.current) {
        emgWebSocketRef.current.close();
        emgWebSocketRef.current = null;
      }
      micWebSocketsRef.current.forEach((ws, idx) => {
        if (ws) {
          ws.close();
          micWebSocketsRef.current[idx] = null;
        }
      });
    };
  }, [usersData, emgActive, micActive, userCaptureActive]);

  // Real-time EMG/Audio waveforms simulation for active participants
  useEffect(() => {
    const drawTick = () => {
      for (let index = 0; index < 6; index++) {
        const isConfigured = index < usersData.length;
        const isActive = isConfigured && userCaptureActive[index];
        const audioCanvas = audioCanvasRefs.current[index];
        const emgCanvas = emgCanvasRefs.current[index];

        // Draw Audio Canvas
        if (audioCanvas) {
          const ctx = audioCanvas.getContext('2d');
          const width = audioCanvas.width = audioCanvas.offsetWidth;
          const height = audioCanvas.height = audioCanvas.offsetHeight;

          ctx.clearRect(0, 0, width, height);

          // Draw grid
          ctx.strokeStyle = '#f1f5f9';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }

          if (isActive) {
            ctx.strokeStyle = '#10b981'; // Green for active audio capturing
            ctx.lineWidth = 1.8;
            ctx.beginPath();

            const samples = latestAudioSamplesRef.current[index];
            if (samples && samples.length > 0) {
              const sliceWidth = width / samples.length;
              let x = 0;
              for (let i = 0; i < samples.length; i++) {
                // Scale float32 -1.0 to 1.0 to canvas height
                const v = samples[i] * 2.0;
                const y = (height / 2) - (v * height / 2);
                if (i === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
                x += sliceWidth;
              }
            } else {
              // Waiting for audio data or flat line
              ctx.moveTo(0, height / 2);
              ctx.lineTo(width, height / 2);
            }
            ctx.stroke();
          } else {
            // Draw flat line
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();

            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            const text = isConfigured ? 'Audio Finalizado' : 'Audio Inactivo';
            ctx.fillText(text, width / 2, height / 2 - 4);
          }
        }

        // Draw EMG Canvas
        if (emgCanvas) {
          const ctx = emgCanvas.getContext('2d');
          const width = emgCanvas.width = emgCanvas.offsetWidth;
          const height = emgCanvas.height = emgCanvas.offsetHeight;

          ctx.clearRect(0, 0, width, height);

          // Draw grid
          ctx.strokeStyle = '#f1f5f9';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }

          if (isActive) {
            ctx.strokeStyle = '#3b82f6'; // Blue for active emg capturing
            ctx.lineWidth = 1.8;
            ctx.beginPath();

            const buffer = emgDataBuffersRef.current[index];
            if (buffer && buffer.length > 0) {
              const sliceWidth = width / buffer.length;
              let x = 0;
              for (let i = 0; i < buffer.length; i++) {
                // Scale EMG (0-1023) to canvas height. Invert Y axis
                const v = buffer[i] / 1023;
                const y = height - v * height;
                if (i === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
                x += sliceWidth;
              }
            } else {
              ctx.moveTo(0, height / 2);
              ctx.lineTo(width, height / 2);
            }
            ctx.stroke();
          } else {
            // Draw flat line
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, height / 2);
            ctx.lineTo(width, height / 2);
            ctx.stroke();

            ctx.fillStyle = '#94a3b8';
            ctx.font = 'bold 10px sans-serif';
            ctx.textAlign = 'center';
            const text = isConfigured ? 'EMG Finalizado' : 'EMG Inactivo';
            ctx.fillText(text, width / 2, height / 2 - 4);
          }
        }
      }

      animationRef.current = requestAnimationFrame(drawTick);
    };

    drawTick();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [usersData, userCaptureActive, emgActive, micActive]);

  // Stop capture for individual user
  const handleStopUser = async (index) => {
    const userIdStr = (index + 1).toString();
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/experiments/${sessionId}/users/${userIdStr}/stop`, {
        method: 'POST'
      });
      if (response.ok) {
        setUserCaptureActive(prev => {
          const copy = [...prev];
          copy[index] = false;
          return copy;
        });
      } else {
        const errorData = await response.json();
        console.error("Error stopping user capture:", errorData.detail);
        await showAlert("Error", `No se pudo detener la captura del participante: ${errorData.detail}`);
      }
    } catch (e) {
      console.error("Error network stopping user:", e);
      await showAlert("Error", "Error de red al intentar detener la captura del participante.");
    }
  };

  // Finish Experiment Confirmation
  const handleFinishExperiment = async () => {
    const confirmFinish = await showConfirm(
      'Finalizar Experimentación',
      '¿Está seguro de que desea finalizar la experimentación y volver al menú principal?'
    );

    if (confirmFinish) {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/v1/experiments/${sessionId}/stop`, {
          method: 'POST'
        });
        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error stopping experiment:", errorData.detail);
        }
      } catch (e) {
        console.error("Error network stopping experiment:", e);
      }

      cancelAnimationFrame(animationRef.current);

      // Save this completed session to the mock visualized sessions database
      const newSession = {
        directory: latestSessionPath,
        timestamp: new Date().toISOString().replace(/[-T]/g, '_').split('.')[0],
        hasGas: gasActive,
        hasEmg: emgActive,
        hasAudio: micActive,
        hasImaging: camActive,
        users: usersData.map(u => ({ id: u.id, age: u.age, gender: u.gender }))
      };

      setMockSessions([newSession, ...mockSessions]);
      goTo('main_menu');
    }
  };

  const isAllUsersFinished = usersData.every((_, i) => !userCaptureActive[i]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 select-none">
      <Header title="Captura del experimento en tiempo real" />

      {/* Main Container */}
      <main className="flex-1 w-full px-8 py-6 flex flex-col gap-6">
        
        {/* Save folder indicator bar */}
        <div className="bg-white border border-slate-200 rounded-2xl px-6 py-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2 select-text">
          <div className="text-xs font-bold text-slate-500">
            Carpeta de la sesión:
            <span className="ml-1 text-slate-800 font-bold block sm:inline">{latestSessionPath}</span>
          </div>
          <span className="self-start text-[10px] font-bold text-capsab-green-dark bg-capsab-green-light border border-capsab-green/20 px-3 py-1 rounded-full animate-pulse">
            ● Capturando datos telemétricos
          </span>
        </div>

        {/* Top telemetry panel: Gas sensors & Camera photo burst */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Gas capture card */}
          {gasActive ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-capsab-green animate-pulse" />
                    Sensores de gases (LabJack)
                  </span>
                  
                  {/* Visual timer clock */}
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className={`text-md font-black font-mono tracking-wider ${
                      gasDone ? 'text-capsab-green' : 'text-capsab-orange-dark'
                    }`}>
                      {timerString}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 font-medium mb-4">
                  Capturando datos de voltaje de los canales mapeados:
                  <span className="ml-1 text-slate-700 font-bold">
                    {gasConfig.filter(row => row.ref !== 'N/A').map(r => r.ref).join(', ') || 'Ninguno'}
                  </span>
                </p>
              </div>

              {/* Status bar */}
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold ${
                gasDone
                  ? 'bg-capsab-green-light border-capsab-green/30 text-capsab-green-dark'
                  : 'bg-capsab-orange-light border-capsab-orange/20 text-capsab-orange-dark'
              }`}>
                {gasDone ? (
                  <>
                    <Check className="w-4 h-4 flex-shrink-0" />
                    Captura de gases de 1 minuto completada y guardada en gases.csv
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-capsab-orange animate-ping flex-shrink-0" />
                    Escribiendo telemetría en gases.csv...
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-center text-center text-slate-400">
              <div className="space-y-1">
                <ShieldAlert className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">Módulo de Gases inactivo para este experimento.</p>
              </div>
            </div>
          )}

          {/* Camera photo burst card */}
          {camActive ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-capsab-green" />
                    Captura de imagen (cámaras)
                  </span>
                  
                  {/* Photo counter */}
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-full">
                    Ráfaga: {photoCount} / 10 fotos
                  </span>
                </div>

                <p className="text-xs text-slate-400 font-medium mb-4">
                  {roi.p1 && roi.p2 
                    ? `Guardando ráfaga con recortes ROI en P1(${roi.p1.x},${roi.p1.y}) y P2(${roi.p2.x},${roi.p2.y})`
                    : 'Guardando ráfaga completa de la cámara seleccionada.'}
                </p>
              </div>

              {/* Status indicator bar */}
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold ${
                photoCount >= 10
                  ? 'bg-capsab-green-light border-capsab-green/30 text-capsab-green-dark'
                  : 'bg-blue-50 border-blue-200 text-blue-700'
              }`}>
                {photoCount >= 10 ? (
                  <>
                    <Check className="w-4 h-4 flex-shrink-0" />
                    Ráfaga de fotos completada correctamente en /Imagenes
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping flex-shrink-0" />
                    <span>{camStatusText}</span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-center text-center text-slate-400">
              <div className="space-y-1">
                <ShieldAlert className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-bold">Módulo de Cámaras inactivo para este experimento.</p>
              </div>
            </div>
          )}

        </div>

        {/* Participant capturing cards (Grid) */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-slate-400 tracking-wider mb-2 select-none">
            Monitoreo de participantes
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            {Array.from({ length: 6 }).map((_, index) => {
              const isConfigured = index < usersData.length;
              const user = isConfigured ? usersData[index] : null;
              const isActive = isConfigured && userCaptureActive[index];

              return (
                <div
                  key={index}
                  className={`bg-white border rounded-3xl p-5 shadow-sm flex flex-col justify-between transition duration-150 ${
                    isActive
                      ? 'border-slate-200'
                      : 'border-slate-200/60 bg-slate-50/50 opacity-70'
                  }`}
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-xs font-bold text-slate-400 block">Usuario {index + 1}</span>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                        <User className={`w-4 h-4 ${isActive ? 'text-capsab-green' : 'text-slate-400'}`} />
                        {isConfigured ? (
                          <span>{user.id} ({user.gender === 'M' ? 'M' : 'F'}, {user.age} años)</span>
                        ) : (
                          <span className="text-slate-400 font-semibold italic">Sin configurar</span>
                        )}
                      </h4>
                    </div>
                    
                    {/* Pulse active dot */}
                    {isActive ? (
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-capsab-green bg-capsab-green-light px-2 py-0.5 rounded-full border border-capsab-green/20 animate-pulse">
                        Capturando
                      </div>
                    ) : isConfigured ? (
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        Finalizado
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                        Inactivo
                      </div>
                    )}
                  </div>

                  {/* Visualizadores de Señales (Audio y EMG por separado) */}
                  <div className="space-y-3 mb-4">
                    {/* Audio Canvas */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5 select-none">Monitor de audio</span>
                      <div className="w-full h-[65px] bg-slate-950/5 rounded-xl border border-slate-200/80 overflow-hidden">
                        <canvas
                          ref={(el) => (audioCanvasRefs.current[index] = el)}
                          className="w-full h-full block"
                        />
                      </div>
                    </div>

                    {/* EMG Canvas */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-0.5 select-none">Monitor EMG</span>
                      <div className="w-full h-[65px] bg-slate-950/5 rounded-xl border border-slate-200/80 overflow-hidden">
                        <canvas
                          ref={(el) => (emgCanvasRefs.current[index] = el)}
                          className="w-full h-full block"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stop button */}
                  <button
                    type="button"
                    onClick={() => handleStopUser(index)}
                    disabled={!isActive}
                    className={`w-full py-2.5 rounded-xl font-bold text-xs shadow-sm transition duration-150 cursor-pointer ${
                      isActive
                        ? 'bg-capsab-red hover:bg-capsab-red-hover text-white border border-capsab-red-dark'
                        : isConfigured
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none border border-slate-300/40'
                          : 'bg-slate-100 text-slate-350 cursor-not-allowed shadow-none border border-slate-200/40'
                    }`}
                  >
                    {isActive 
                      ? 'Detener captura' 
                      : isConfigured 
                        ? 'Captura finalizada' 
                        : 'No habilitado'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 select-none">
          <p className="text-xs text-slate-400 font-semibold max-w-md">
            Nota: Al finalizar la experimentación, se guardarán los archivos emg_user_X.csv, audio_user_X.wav, gases.csv e Imagenes correspondientes.
          </p>
          <button
            type="button"
            onClick={handleFinishExperiment}
            className={`px-8 py-3.5 font-bold rounded-xl shadow-md hover:shadow-lg transition duration-150 cursor-pointer text-sm flex items-center justify-center gap-2 ${
              isAllUsersFinished
                ? 'bg-capsab-green text-white hover:bg-capsab-green-hover'
                : 'bg-slate-600 hover:bg-slate-700 text-white'
            }`}
          >
            {isAllUsersFinished ? '✓ Guardar y terminar sesión' : 'Finalizar experimentación'}
          </button>
        </div>

      </main>
    </div>
  );
};

export default RunningExpView;
