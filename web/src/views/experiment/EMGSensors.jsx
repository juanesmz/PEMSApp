import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Check, Info, Trash2, Activity, RefreshCw } from 'lucide-react';

const EMGSensors = () => {
  const {
    emgSelectedSensors,
    setEmgSelectedSensors,
    emgSensorNames,
    setEmgSensorNames,
    arduinoPort,
    setArduinoPort
  } = useAppContext();

  const [activeTab, setActiveTab] = useState('instructions'); // config, instructions
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  const [availablePorts, setAvailablePorts] = useState(['COM7']);
  const [selectedPort, setSelectedPort] = useState(arduinoPort || 'COM7');
  const [isStreaming, setIsStreaming] = useState(false);

  // Sync selected port to context
  useEffect(() => {
    if (selectedPort) {
      setArduinoPort(selectedPort);
    }
  }, [selectedPort, setArduinoPort]);
  
  const wsRef = useRef(null);
  const latestDataRef = useRef([]);
  const dataPointsRef = useRef([]);

  const fetchPorts = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/emg/ports');
      if (response.ok) {
        const ports = await response.json();
        if (ports && ports.length > 0) {
          setAvailablePorts(ports);
          if (!ports.includes(selectedPort)) {
            setSelectedPort(ports[0]);
          }
        }
      }
    } catch (e) {
      console.warn("Error fetching COM ports:", e);
    }
  };

  const toggleStreaming = () => {
    if (isStreaming) {
      stopStreaming();
    } else {
      startStreaming();
    }
  };

  const startStreaming = () => {
    setIsStreaming(true);
    dataPointsRef.current = []; // Clear graph history on connect
    try {
      const wsUrl = `ws://127.0.0.1:8000/api/v1/emg/stream?port=${selectedPort}`;
      console.log("Connecting to EMG WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.values) {
            latestDataRef.current = data.values;
          }
        } catch (e) {
          console.error("Error parsing EMG WS data:", e);
        }
      };

      ws.onerror = (err) => {
        console.error("EMG WebSocket Error:", err);
      };

      ws.onclose = () => {
        console.log("EMG WebSocket closed");
        setIsStreaming(false);
        dataPointsRef.current = []; // Clear graph history on close
      };
    } catch (e) {
      console.error("Error starting EMG WebSocket:", e);
      setIsStreaming(false);
      dataPointsRef.current = []; // Clear history on error
    }
  };

  const stopStreaming = () => {
    setIsStreaming(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    latestDataRef.current = [];
    dataPointsRef.current = []; // Clear graph history on disconnect
  };

  useEffect(() => {
    fetchPorts();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Reset history when switching to config visualizer tab
  useEffect(() => {
    if (activeTab === 'config') {
      dataPointsRef.current = [];
    }
  }, [activeTab]);

  // Available physical channels
  const emgChannels = [
    { id: 0, label: 'EMG canal 1' },
    { id: 1, label: 'EMG canal 2' },
    { id: 2, label: 'EMG canal 3' },
    { id: 3, label: 'EMG canal 4' },
    { id: 4, label: 'EMG canal 5' },
    { id: 5, label: 'EMG canal 6' }
  ];

  const handleCheckboxToggle = (channelId) => {
    let newSelected;
    if (emgSelectedSensors.includes(channelId)) {
      newSelected = emgSelectedSensors.filter(id => id !== channelId);
    } else {
      newSelected = [...emgSelectedSensors, channelId].sort((a, b) => a - b);
    }
    setEmgSelectedSensors(newSelected);
    setEmgSensorNames(newSelected.map(id => `Sensor EMG #${id + 1}`));
  };

  const handleRemoveSensor = (channelId) => {
    handleCheckboxToggle(channelId);
  };

  // Canvas Realtime EMG Pulse Drawing
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || activeTab !== 'config') return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    // Buffer of points to draw
    const bufferSize = width;
    const channelsCount = emgSelectedSensors.length > 0 ? emgSelectedSensors.length : 1;
    
    // Initialize points to 0 coordinate baseline
    const initialPlotHeight = height - paddingTop - paddingBottom;
    const initialY = paddingTop + initialPlotHeight * (1 - 0 / 1023);
    
    // If the dataPointsRef is empty, or size changes, initialize it while preserving history
    if (dataPointsRef.current.length !== channelsCount || dataPointsRef.current[0]?.length !== bufferSize) {
      dataPointsRef.current = Array.from({ length: channelsCount }, (_, index) => {
        return dataPointsRef.current[index] && dataPointsRef.current[index].length === bufferSize
          ? dataPointsRef.current[index]
          : Array(bufferSize).fill(initialY);
      });
    }
    const dataPoints = dataPointsRef.current;
    let timeIndex = 0;

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        width = canvas.width = entry.contentRect.width;
        height = canvas.height = entry.contentRect.height;
      }
    });
    resizeObserver.observe(canvas);

    const drawSignal = () => {
      const plotWidth = width - paddingLeft - paddingRight;
      const plotHeight = height - paddingTop - paddingBottom;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw plot area background
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(paddingLeft, paddingTop, plotWidth, plotHeight);

      // Draw horizontal grid lines and Y-axis scale (0 to 1023)
      const ticks = [0, 200, 400, 600, 800, 1023];
      ctx.strokeStyle = '#e2e8f0'; // slate-200
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b'; // slate-500
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      ticks.forEach(v => {
        const y = paddingTop + plotHeight * (1 - v / 1023);
        
        // Grid line
        ctx.beginPath();
        ctx.moveTo(paddingLeft, y);
        ctx.lineTo(width - paddingRight, y);
        ctx.stroke();

        // Tick mark on Y-axis
        ctx.strokeStyle = '#94a3b8'; // slate-400
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(paddingLeft - 4, y);
        ctx.lineTo(paddingLeft, y);
        ctx.stroke();

        // Y-axis label (no units)
        ctx.fillText(v.toString(), paddingLeft - 8, y);
      });

      // Draw vertical grid lines and X-axis ticks
      for (let x = paddingLeft + 40; x < width - paddingRight; x += 40) {
        // Vertical grid line
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, paddingTop);
        ctx.lineTo(x, height - paddingBottom);
        ctx.stroke();

        // Tick mark on X-axis
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, height - paddingBottom);
        ctx.lineTo(x, height - paddingBottom + 4);
        ctx.stroke();
      }

      // Draw X-axis labels
      ctx.fillStyle = '#64748b';
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.textBaseline = 'top';

      // Left label
      ctx.textAlign = 'left';
      ctx.fillText('-3 s', paddingLeft, height - paddingBottom + 8);

      // Middle label
      ctx.textAlign = 'center';
      ctx.fillText('-1.5 s', paddingLeft + plotWidth / 2, height - paddingBottom + 8);

      // Right label
      ctx.textAlign = 'right';
      ctx.fillText('0 s', width - paddingRight, height - paddingBottom + 8);

      // Draw the main axis boundaries
      ctx.strokeStyle = '#94a3b8'; // slate-400
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, paddingTop);
      ctx.lineTo(paddingLeft, height - paddingBottom);
      ctx.lineTo(width - paddingRight, height - paddingBottom);
      ctx.stroke();

      // Clip curves to plot area
      ctx.save();
      ctx.beginPath();
      ctx.rect(paddingLeft, paddingTop, plotWidth, plotHeight);
      ctx.clip();

      // Draw active EMG channels
      emgSelectedSensors.forEach((sensorId, chIndex) => {
        const colorPalette = ['#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0'];
        const strokeColor = colorPalette[sensorId % colorPalette.length];

        // Read real EMG value (0-1023) from the backend
        let currentVal = 0;
        if (isStreaming && latestDataRef.current && latestDataRef.current[sensorId] !== undefined) {
          currentVal = Math.max(0, Math.min(1023, latestDataRef.current[sensorId]));
        }

        const yVal = paddingTop + plotHeight * (1 - currentVal / 1023);
        
        // Push new point into buffer, shift old points
        const channelPoints = dataPoints[chIndex] || Array(bufferSize).fill(initialY);
        if (isStreaming) {
          channelPoints.shift();
          channelPoints.push(yVal);
        }
        dataPoints[chIndex] = channelPoints;

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const L = channelPoints.length;
        for (let i = 0; i < L; i++) {
          const x = paddingLeft + (i / (L - 1)) * plotWidth;
          if (i === 0) {
            ctx.moveTo(x, channelPoints[i]);
          } else {
            ctx.lineTo(x, channelPoints[i]);
          }
        }
        ctx.stroke();
      });

      ctx.restore(); // Restore clip region

      // Overlay label if no channels selected
      if (emgSelectedSensors.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Sin canales EMG seleccionados. Señal inactiva.', paddingLeft + plotWidth / 2, paddingTop + plotHeight / 2);
      }

      if (isStreaming) {
        timeIndex += 1;
      }
      animationRef.current = requestAnimationFrame(drawSignal);
    };

    drawSignal();

    return () => {
      cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [emgSelectedSensors, activeTab, isStreaming]);

  return (
    <div className="flex flex-col gap-5 h-full select-none">
      
      {/* Visual Mode Tabs */}
      <div className="flex bg-slate-200 p-1 rounded-xl self-start">
        <button
          onClick={() => setActiveTab('instructions')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
            activeTab === 'instructions' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Guía de colocación (instrucciones)
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
            activeTab === 'config' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Configuración y visualizador
        </button>
      </div>

      {/* Tab contents */}
      {activeTab === 'instructions' ? (
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center p-6 h-full shadow-sm relative">
          <img
            src="/assets/EMG_img.png"
            alt="EMG Sensor Placement"
            className="max-h-[95%] w-auto object-contain rounded-xl"
            onError={(e) => {
              e.target.onerror = null;
              e.target.style.display = 'none';
            }}
          />
        </div>
      ) : (
        <div className="flex-1 flex flex-row gap-5 min-h-0">
          {/* Left panel: Checkboxes selection (flex-20) */}
          <div style={{ flex: '20 20 0%' }} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col h-full overflow-hidden">
            <h3 className="text-xs font-bold text-slate-800 mb-1">
              Canales EMG
            </h3>
            <p className="text-[10px] text-slate-400 font-medium mb-3">
              {!isStreaming
                ? "Conecta el puerto serial para activar la selección de canales."
                : "Active los puertos físicos de la placa."}
            </p>

            {/* Puerto COM Selector */}
            <div className="space-y-1.5 mb-4 border-b border-slate-100 pb-3 flex-shrink-0">
              <label className="text-[10px] font-bold text-slate-500 tracking-wider block">
                Puerto serial (EMG)
              </label>
              <div className="flex gap-1.5">
                <select
                  value={selectedPort}
                  onChange={(e) => setSelectedPort(e.target.value)}
                  disabled={isStreaming}
                  className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:border-capsab-green text-[11px] font-semibold bg-white"
                >
                  {availablePorts.map((port) => (
                    <option key={port} value={port}>
                      {port}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={fetchPorts}
                  disabled={isStreaming}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg text-slate-600 transition disabled:opacity-50 flex items-center justify-center cursor-pointer"
                  title="Actualizar puertos"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <button
                type="button"
                onClick={toggleStreaming}
                className={`w-full mt-2 py-2 px-3 rounded-lg text-xs font-bold transition duration-150 cursor-pointer shadow-sm border ${
                  isStreaming
                    ? 'bg-red-500 hover:bg-red-600 border-red-600 text-white'
                    : 'bg-capsab-green hover:bg-capsab-green-hover border-capsab-green text-white'
                }`}
              >
                {isStreaming ? "Desconectar" : "Conectar EMG"}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {emgChannels.map((ch) => {
                const isChecked = emgSelectedSensors.includes(ch.id);
                return (
                  <button
                    key={ch.id}
                    type="button"
                    disabled={!isStreaming}
                    onClick={() => handleCheckboxToggle(ch.id)}
                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl border text-left font-bold transition-all duration-150 ${
                      !isStreaming
                        ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
                        : isChecked
                          ? 'border-capsab-green bg-capsab-green-light/40 text-capsab-green-dark cursor-pointer'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center flex-shrink-0 ${
                      isChecked ? 'bg-capsab-green border-capsab-green-dark text-white' : 'border-slate-300 bg-slate-50'
                    }`}>
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-[11px]">{ch.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
 
          {/* Middle Panel: Live wave simulation (flex-80) */}
          <div style={{ flex: '80 80 0%' }} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2 select-none">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-capsab-green animate-pulse-fast" />
                {isStreaming ? `Gráfico EMG (Puerto: ${selectedPort})` : 'Gráfico EMG (Simulado)'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full">
                {emgSelectedSensors.length} canales activos
              </span>
            </div>
            <div className="flex-1 w-full bg-slate-950/5 rounded-xl border border-slate-200 overflow-hidden relative">
              <canvas ref={canvasRef} className="w-full h-full block" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EMGSensors;
