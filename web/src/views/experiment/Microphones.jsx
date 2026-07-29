import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Plus, Trash2, Volume2, Mic, RefreshCw } from 'lucide-react';

const Microphones = () => {
  const { micList, setMicList } = useAppContext();
  const [availableMics, setAvailableMics] = useState([]);
  const [selectedMicIndex, setSelectedMicIndex] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);

  const websocketRef = useRef(null);
  const latestSamplesRef = useRef(null);

  // Fetch actual microphones from the FastAPI backend
  const fetchMicrophones = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/microphones/');
      if (!response.ok) throw new Error("Error fetching microphones");
      const mics = await response.json();

      if (mics && mics.length > 0) {
        setAvailableMics(mics);
      } else {
        setAvailableMics([]);
      }
    } catch (e) {
      console.warn("Error fetching mics from backend:", e);
      setAvailableMics([]);
    }
  };

  useEffect(() => {
    fetchMicrophones();
  }, []);

  const handleAddMicrophone = () => {
    if (availableMics.length === 0) return;
    const selected = availableMics[selectedMicIndex];
    if (!selected) return;

    // Check duplicates
    const isDuplicate = micList.some(
      m => m.name === selected.name
    );
    if (isDuplicate) return;

    setMicList([...micList, selected]);
  };

  const handleRemoveMicrophone = (nameToRemove) => {
    setMicList(micList.filter(m => m.name !== nameToRemove));
  };

  // Start/Stop live audio monitoring
  const toggleMonitoring = async () => {
    if (isMonitoring) {
      stopAudioMonitoring();
    } else {
      await startAudioMonitoring();
    }
  };

  const startAudioMonitoring = async () => {
    setIsMonitoring(true);
    const selected = availableMics[selectedMicIndex];
    if (!selected) return;

    try {
      const ws = new WebSocket(`ws://127.0.0.1:8000/api/v1/microphones/${selected.index}/stream?channel=${selected.channel}`);
      websocketRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.samples) {
          latestSamplesRef.current = data.samples;
        }
      };

      ws.onerror = (err) => {
        console.error("Microphone WebSocket Error", err);
      };
      
      ws.onclose = () => {
        setIsMonitoring(false);
      };
    } catch (err) {
      console.error('Error starting WS:', err);
    }
  };

  const stopAudioMonitoring = () => {
    setIsMonitoring(false);
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    latestSamplesRef.current = null;
  };

  // Cleanup audio contexts on unmount
  useEffect(() => {
    return () => {
      stopAudioMonitoring();
    };
  }, []);

  // Drawing audio visualizer wave
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const bufferLength = analyserRef.current ? analyserRef.current.frequencyBinCount : 256;
    const dataArray = new Uint8Array(bufferLength);
    let drawIndex = 0;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        width = canvas.width = entry.contentRect.width;
        height = canvas.height = entry.contentRect.height;
      }
    });
    resizeObserver.observe(canvas);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw background grid lines
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (isMonitoring) {
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 2.5;
        ctx.beginPath();

        if (latestSamplesRef.current) {
          // Actual mic waveform from WebSocket
          const samples = latestSamplesRef.current;
          const sliceWidth = width / samples.length;
          let x = 0;
          for (let i = 0; i < samples.length; i++) {
            // Samples are typically float32 -1.0 to 1.0. Scale to canvas height
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
          // Simulated waiting state while connecting
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
        ctx.font = '11px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Captura de audio inactiva. Pulse "Visualizar señal" para monitorear.', width / 2, height / 2 - 12);
      }

      drawIndex += 1;
      animationRef.current = requestAnimationFrame(draw);
    };

    const amplitudeAdjust = (x, w) => {
      // Gaussian window to taper edges of simulated waveform
      const midpoint = w / 2;
      const sigma = w / 5;
      return Math.exp(-Math.pow(x - midpoint, 2) / (2 * Math.pow(sigma, 2)));
    };

    draw();

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [isMonitoring]);

  return (
    <div className="flex flex-col gap-5 h-full select-none min-h-0">
      
      {/* Row 1: Audio Waveform Graph (occupies full width) */}
      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col">
        <h4 className="text-xs font-bold text-slate-700 mb-2 border-b border-slate-100 pb-1 flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-capsab-green" />
          Waveform monitor - amplitud de señal
        </h4>
        <div className="flex-1 bg-slate-950/5 rounded-xl border border-slate-200 overflow-hidden relative">
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>
      </div>

      {/* Row 2: Config and Table side by side (occupies remaining height) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-5">
        
        {/* Left Column in Row 2: Device Configuration */}
        <div className="w-full lg:w-[320px] flex flex-col justify-between bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-full overflow-hidden">
          <div className="space-y-4">
            <div>
              <h3 className="text-md font-bold text-slate-800 mb-1">
                Configuración de micrófonos
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Conecte y asigne canales de audio individuales para cada participante.
              </p>
            </div>

            {/* Select dropdown */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 tracking-wider block">
                Dispositivo disponible:
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedMicIndex}
                  onChange={(e) => setSelectedMicIndex(parseInt(e.target.value))}
                  disabled={isMonitoring}
                  className="capsab-input text-xs flex-1 cursor-pointer"
                >
                  {availableMics.map((mic, idx) => (
                    <option key={idx} value={idx}>
                      {mic.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={fetchMicrophones}
                  disabled={isMonitoring}
                  className="p-2 border border-slate-300 rounded-md text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition duration-150 cursor-pointer shadow-sm"
                  title="Escanear micrófonos"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Monitor and Add buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={toggleMonitoring}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isMonitoring
                    ? 'bg-capsab-red text-white border-capsab-red-dark hover:bg-capsab-red-hover'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-sm'
                }`}
              >
                <Volume2 className="w-4 h-4" />
                {isMonitoring ? 'Detener' : 'Visualizar'}
              </button>
              <button
                type="button"
                onClick={handleAddMicrophone}
                disabled={isMonitoring || availableMics.length === 0}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-capsab-green hover:bg-capsab-green-hover disabled:bg-green-200 disabled:text-emerald-50 text-white font-bold rounded-lg transition duration-150 cursor-pointer shadow-sm text-xs"
              >
                <Plus className="w-4 h-4" />
                Añadir
              </button>
            </div>
          </div>

          {/* Counter Info */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-3 bg-slate-50 border border-slate-200/50 rounded-xl p-2.5 text-xs text-slate-600 font-medium">
            <Mic className="w-4 h-4 text-capsab-green flex-shrink-0" />
            <span>
              Micrófonos agregados:{' '}
              <strong className="text-capsab-green-dark">{micList.length}</strong>
            </span>
          </div>
        </div>

        {/* Right Column in Row 2: Added mics list table */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">
          {/* Header */}
          <div className="bg-capsab-green text-white text-xs font-bold flex px-5 py-2.5 justify-between items-center select-none">
            <span>Nombre de dispositivo de audio</span>
            <span className="w-12 text-center">Eliminar</span>
          </div>
          {/* Rows */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {micList.length === 0 ? (
              <p className="text-xs text-slate-400 font-medium p-4 text-center">
                Sin micrófonos configurados para la sesión
              </p>
            ) : (
              micList.map((mic, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-5 py-2 text-xs font-semibold ${
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  }`}
                >
                  <span className="text-slate-700 truncate mr-4">{mic.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMicrophone(mic.name)}
                    className="text-slate-400 hover:text-capsab-red transition duration-150 p-1.5 cursor-pointer flex-shrink-0"
                    title="Eliminar micrófono"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};

export default Microphones;
