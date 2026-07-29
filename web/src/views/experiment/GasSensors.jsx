import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Plus, Trash2, Info, Cpu, Play, Pause, Eye, EyeOff } from 'lucide-react';

const GasSensors = () => {
  const {
    gasReferences,
    setGasReferences,
    gasConfig,
    updateGasConfigRow,
    showPrompt
  } = useAppContext();

  const [newRef, setNewRef] = useState('');
  const [rightTab, setRightTab] = useState('list'); // 'list' or 'chart'
  const [hiddenSensors, setHiddenSensors] = useState([]);
  const [isVisualizing, setIsVisualizing] = useState(false);
  const [selectedPCBIndex, setSelectedPCBIndex] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const gasCanvasRef = useRef(null);
  const gasAnimationRef = useRef(null);

  const wsRef = useRef(null);
  const latestDataRef = useRef([]);
  const dataPointsRef = useRef([]);

  const convertPresetFromBackend = (preset) => {
    const mappings = {};
    for (let i = 1; i <= 13; i++) {
      mappings[`SG_${i}`] = 'N/A';
    }
    if (preset && preset.config) {
      preset.config.forEach(item => {
        mappings[item.sensor_id] = item.reference;
      });
    }
    return {
      name: preset.name,
      mappings: mappings
    };
  };

  const convertPresetToBackend = (name, mappings) => {
    const config = Object.entries(mappings).map(([sensor_id, reference]) => ({
      sensor_id,
      reference
    }));
    return {
      name,
      config
    };
  };

  const fetchPresetsAndReferences = async () => {
    try {
      const refRes = await fetch('http://127.0.0.1:8000/api/v1/gas/references');
      if (refRes.ok) {
        const refs = await refRes.json();
        setGasReferences(refs);
      }
      
      const presetRes = await fetch('http://127.0.0.1:8000/api/v1/gas/presets');
      if (presetRes.ok) {
        const presets = await presetRes.json();
        let formatted = [];
        if (presets && presets.length > 0) {
          formatted = presets.map(convertPresetFromBackend);
        } else {
          // Fallback if no presets exist
          formatted = [
            {
              name: "PCB Placa Principal #1",
              mappings: {
                "SG_1": "MQ-2", "SG_2": "MQ-3", "SG_3": "MQ-4", "SG_4": "MQ-5",
                "SG_5": "MQ-6", "SG_6": "MQ-7", "SG_7": "MQ-8", "SG_8": "MQ-9",
                "SG_9": "MQ-131", "SG_10": "MQ-135", "SG_11": "MQ-136", "SG_12": "MQ-137", "SG_13": "MQ-138"
              }
            }
          ];
        }
        // Append empty preset at the end
        formatted.push({
          name: "PCB configuración vacía",
          mappings: {
            "SG_1": "N/A", "SG_2": "N/A", "SG_3": "N/A", "SG_4": "N/A",
            "SG_5": "N/A", "SG_6": "N/A", "SG_7": "N/A", "SG_8": "N/A",
            "SG_9": "N/A", "SG_10": "N/A", "SG_11": "N/A", "SG_12": "N/A",
            "SG_13": "N/A"
          }
        });
        setPcbPresets(formatted);
      }
    } catch (e) {
      console.error("Error fetching gas presets/references:", e);
    }
  };

  // Connect to WebSocket when showing visualization
  useEffect(() => {
    if (rightTab !== 'chart' || !isVisualizing) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      latestDataRef.current = [];
      return;
    }

    const activeMappers = gasConfig.filter(row => row.ref !== 'N/A');
    if (activeMappers.length === 0) return;

    // Map SG_N -> AIN(N-1)
    const channelsStr = activeMappers.map(row => {
      const num = parseInt(row.sensorId.split('_')[1]);
      return `AIN${num - 1}`;
    }).join(',');

    const wsUrl = `ws://127.0.0.1:8000/api/v1/gas/stream?channels=${channelsStr}`;
    console.log("Connecting to Gas WebSocket:", wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.values) {
          latestDataRef.current = data.values;
        }
      } catch (e) {
        console.error("Error parsing gas WS data:", e);
      }
    };

    ws.onerror = (err) => {
      console.error("Gas WebSocket Error:", err);
    };

    ws.onclose = () => {
      console.log("Gas WebSocket closed");
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [rightTab, isVisualizing, gasConfig]);

  // Initial fetch and unmount cleanup
  useEffect(() => {
    fetchPresetsAndReferences();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Reset visualization state and clear graph history when switching tabs
  useEffect(() => {
    if (rightTab === 'chart') {
      setIsVisualizing(false);
      dataPointsRef.current = [];
    }
  }, [rightTab]);

  // Real-time canvas gas sensor waveform rendering
  useEffect(() => {
    const canvas = gasCanvasRef.current;
    if (!canvas || rightTab !== 'chart') return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = canvas.offsetWidth;
    let height = canvas.height = canvas.offsetHeight;

    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const activeMappers = gasConfig.filter(row => row.ref !== 'N/A');
    const mappersCount = activeMappers.length > 0 ? activeMappers.length : 1;
    const bufferSize = width;
    
    // Initialize points to the Y position corresponding to a baseline of 0V
    const initialPlotHeight = height - paddingTop - paddingBottom;
    const initialY = paddingTop + initialPlotHeight * (1 - 0 / 10);
    
    // If the dataPointsRef is empty, or size changes, initialize it while preserving history
    if (dataPointsRef.current.length !== mappersCount || dataPointsRef.current[0]?.length !== bufferSize) {
      dataPointsRef.current = Array.from({ length: mappersCount }, (_, index) => {
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

      // Draw horizontal grid lines and Y-axis scale (0V to 10V with jumps of 2V)
      const volts = [0, 2, 4, 6, 8, 10];
      ctx.strokeStyle = '#e2e8f0'; // slate-200
      ctx.lineWidth = 1;
      ctx.fillStyle = '#64748b'; // slate-500
      ctx.font = '10px "Segoe UI", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      volts.forEach(v => {
        const y = paddingTop + plotHeight * (1 - v / 10);
        
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

        // Y-axis label
        ctx.fillText(`${v} V`, paddingLeft - 8, y);
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
        ctx.strokeStyle = '#94a3b8'; // slate-400
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

      // Draw gas signal lines
      activeMappers.forEach((row, chIndex) => {
        const colorPalette = ['#3cb44b', '#4363d8', '#f58231', '#e6194b', '#911eb4', '#46f0f0'];
        const strokeColor = colorPalette[chIndex % colorPalette.length];
        
        // Get the latest voltage value from the WebSocket data
        let voltage = null;
        if (latestDataRef.current && latestDataRef.current[chIndex] !== undefined) {
          voltage = latestDataRef.current[chIndex];
        }

        const isSimulating = voltage === null || voltage === undefined;
        let currentV = 0;

        if (isSimulating) {
          const baseVolts = 1.5 + (chIndex * 0.8) % 6;
          const drift = Math.sin(timeIndex * 0.02 + chIndex) * 0.6;
          const noise = (Math.random() - 0.5) * 0.1;
          currentV = Math.max(0, Math.min(10, baseVolts + drift + noise));
        } else {
          currentV = Math.max(0, Math.min(10, voltage));
        }

        const yVal = paddingTop + plotHeight * (1 - currentV / 10);
        
        const channelPoints = dataPoints[chIndex] || Array(bufferSize).fill(initialY);
        if (isVisualizing) {
          channelPoints.shift();
          channelPoints.push(yVal);
        }
        dataPoints[chIndex] = channelPoints;

        // Skip drawing if the sensor is filtered out (hidden)
        if (hiddenSensors.includes(row.sensorId)) return;

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
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

      const shownCount = activeMappers.filter(row => !hiddenSensors.includes(row.sensorId)).length;
      if (activeMappers.length === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Sin mapeos de sensores de gas activos.', paddingLeft + plotWidth / 2, paddingTop + plotHeight / 2);
      } else if (shownCount === 0) {
        ctx.fillStyle = '#64748b';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Todos los sensores activos están filtrados (ocultos).', paddingLeft + plotWidth / 2, paddingTop + plotHeight / 2);
      }

      if (isVisualizing) {
        timeIndex += 1;
      }
      gasAnimationRef.current = requestAnimationFrame(drawSignal);
    };

    drawSignal();

    return () => {
      cancelAnimationFrame(gasAnimationRef.current);
      resizeObserver.disconnect();
    };
  }, [gasConfig, rightTab, isVisualizing, hiddenSensors]);

  // Predefined PCB presets mapping sensors to reference gases
  const [pcbPresets, setPcbPresets] = useState([
    {
      name: "PCB Placa Principal #1",
      mappings: {
        "SG_1": "Oxígeno",
        "SG_2": "Dióxido de Carbono",
        "SG_3": "Etanol",
        "SG_4": "TGS-262",
        "SG_5": "Oxígeno",
        "SG_6": "N/A",
        "SG_7": "N/A",
        "SG_8": "N/A",
        "SG_9": "N/A",
        "SG_10": "N/A",
        "SG_11": "N/A",
        "SG_12": "N/A",
        "SG_13": "N/A"
      }
    },
    {
      name: "PCB Placa Secundaria #2",
      mappings: {
        "SG_1": "Etanol",
        "SG_2": "Etanol",
        "SG_3": "TGS-262",
        "SG_4": "Oxígeno",
        "SG_5": "N/A",
        "SG_6": "N/A",
        "SG_7": "N/A",
        "SG_8": "N/A",
        "SG_9": "N/A",
        "SG_10": "N/A",
        "SG_11": "N/A",
        "SG_12": "N/A",
        "SG_13": "N/A"
      }
    },
    {
      name: "PCB configuración vacía",
      mappings: {
        "SG_1": "N/A",
        "SG_2": "N/A",
        "SG_3": "N/A",
        "SG_4": "N/A",
        "SG_5": "N/A",
        "SG_6": "N/A",
        "SG_7": "N/A",
        "SG_8": "N/A",
        "SG_9": "N/A",
        "SG_10": "N/A",
        "SG_11": "N/A",
        "SG_12": "N/A",
        "SG_13": "N/A"
      }
    }
  ]);

  const handleSelectPCB = (pcb, index) => {
    // Collect all needed gases that are not N/A
    const neededGases = Object.values(pcb.mappings).filter(ref => ref !== 'N/A');
    // Find missing ones in active references list
    const missingGases = neededGases.filter(ref => !gasReferences.includes(ref));
    
    // Add missing gases dynamically
    if (missingGases.length > 0) {
      setGasReferences([...gasReferences, ...missingGases]);
    }

    // Diligenciar los datos de la lista en el contenedor de la derecha
    Object.entries(pcb.mappings).forEach(([sensorId, ref]) => {
      updateGasConfigRow(sensorId, ref);
    });

    setSelectedPCBIndex(index.toString());
    setIsEditing(false);
  };

  const handleAddReference = async (e) => {
    e.preventDefault();
    const cleanRef = newRef.trim();
    if (!cleanRef) return;
    if (gasReferences.includes(cleanRef)) return;
    
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/gas/references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanRef })
      });
      if (response.ok) {
        setGasReferences([...gasReferences, cleanRef]);
        setNewRef('');
      } else {
        console.error("Error adding reference to backend");
      }
    } catch (e) {
      console.error("Error adding reference:", e);
    }
  };

  const handleDeleteReference = (refToDelete) => {
    // Delete reference locally (delete not implemented in backend)
    setGasReferences(gasReferences.filter(r => r !== refToDelete));
    
    // Reset mapped SG_N configs that used this reference to N/A
    gasConfig.forEach(row => {
      if (row.ref === refToDelete) {
        updateGasConfigRow(row.sensorId, 'N/A');
      }
    });
  };

  const activeSensorsCount = gasConfig.filter(row => row.ref !== 'N/A').length;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full select-none">
      
      {/* Left Column: Reference & PCB Management */}
      <div className="w-full lg:w-[280px] xl:w-[320px] flex flex-col gap-5 h-full overflow-y-auto min-h-0">
        
        {/* Card 1: PCB References Dropdown Selector */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-2 flex-shrink-0">
          <h3 className="text-md font-bold text-slate-800 mb-1 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-sky-500" />
            Referencias de PCB
          </h3>
          <p className="text-xs text-slate-400 font-medium mb-2">
            Seleccione una placa para cargar su configuración predefinida.
          </p>
          <select
            onChange={(e) => {
              const selectedIndex = parseInt(e.target.value);
              if (!isNaN(selectedIndex) && selectedIndex >= 0) {
                handleSelectPCB(pcbPresets[selectedIndex], selectedIndex);
              }
            }}
            value={selectedPCBIndex}
            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:border-capsab-green text-xs font-semibold cursor-pointer bg-white"
          >
            <option value="" disabled>-- Seleccionar PCB --</option>
            {pcbPresets.map((pcb, index) => (
              <option key={pcb.name} value={index}>
                {pcb.name}
              </option>
            ))}
          </select>
 
          {/* PCB Action Button */}
          {selectedPCBIndex !== "" && (
            <button
              type="button"
              onClick={async () => {
                const isVacía = parseInt(selectedPCBIndex) === pcbPresets.length - 1;
                if (isVacía) {
                  // Guardar configuración de PCB
                  const name = await showPrompt("Guardar Placa", "Ingrese el nombre de la nueva configuración de PCB:", "Mi PCB Personalizada");
                  if (name && name.trim()) {
                    const newMappings = {};
                    gasConfig.forEach(row => {
                      newMappings[row.sensorId] = row.ref;
                    });
                    
                    const backendPreset = convertPresetToBackend(name.trim(), newMappings);
                    try {
                      const response = await fetch('http://127.0.0.1:8000/api/v1/gas/presets', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(backendPreset)
                      });
                      if (response.ok) {
                        await fetchPresetsAndReferences();
                        setIsEditing(false);
                      }
                    } catch (e) {
                      console.error("Error saving preset to backend:", e);
                    }
                  }
                } else {
                  // Edit or Save changes to the selected preset
                  if (isEditing) {
                    // Save changes to current preset mappings
                    const idx = parseInt(selectedPCBIndex);
                    const presetToUpdate = pcbPresets[idx];
                    const newMappings = {};
                    gasConfig.forEach(row => {
                      newMappings[row.sensorId] = row.ref;
                    });
                    
                    const backendPreset = convertPresetToBackend(presetToUpdate.name, newMappings);
                    try {
                      const response = await fetch(`http://127.0.0.1:8000/api/v1/gas/presets/${encodeURIComponent(presetToUpdate.name)}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(backendPreset)
                      });
                      if (response.ok) {
                        setIsEditing(false);
                        await fetchPresetsAndReferences();
                      }
                    } catch (e) {
                      console.error("Error updating preset on backend:", e);
                    }
                  } else {
                    // Start editing
                    setIsEditing(true);
                  }
                }
              }}
              className={`w-full mt-2 py-2 px-4 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm border ${
                parseInt(selectedPCBIndex) === pcbPresets.length - 1
                  ? 'bg-capsab-green hover:bg-capsab-green-hover border-capsab-green text-white'
                  : isEditing
                    ? 'bg-sky-500 hover:bg-sky-600 border-sky-600 text-white'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              {parseInt(selectedPCBIndex) === pcbPresets.length - 1 ? (
                "Guardar Configuración de PCB"
              ) : isEditing ? (
                "Guardar Cambios"
              ) : (
                "Editar PCB Seleccionada"
              )}
            </button>
          )}
        </div>

        {/* Card 2: Gas References List Management or Chart Filters */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col min-h-[320px] overflow-hidden">
          {rightTab === 'list' ? (
            // Existing List Management UI
            <>
              <div className="flex-1 flex flex-col min-h-0">
                <h3 className="text-md font-bold text-slate-800 mb-2">
                  Referencias de gas
                </h3>
                <p className="text-xs text-slate-400 font-medium mb-4">
                  Gestione la lista de gases de referencia para su mapeo físico.
                </p>

                {/* Add input */}
                <form onSubmit={handleAddReference} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newRef}
                    onChange={(e) => setNewRef(e.target.value)}
                    placeholder="Ej. Nitrógeno"
                    className="capsab-input text-xs"
                  />
                  <button
                    type="submit"
                    className="p-2.5 bg-capsab-green hover:bg-capsab-green-hover text-white rounded-md transition duration-150 cursor-pointer flex-shrink-0"
                    title="Añadir"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </form>

                {/* Reference List Box (Scrollable) */}
                <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-y-auto bg-slate-50">
                  {gasReferences.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium p-4 text-center">
                      Sin gases registrados
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {gasReferences.map((ref, idx) => (
                        <div
                          key={ref}
                          className={`flex items-center justify-between px-3 py-2 text-xs font-bold ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          }`}
                        >
                          <span className="text-slate-700 truncate mr-2">{ref}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteReference(ref)}
                            className="text-slate-400 hover:text-capsab-red transition duration-150 p-1 cursor-pointer"
                            title={`Eliminar ${ref}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Counter Info */}
              <div className="mt-4 flex items-center gap-3 bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-xs text-slate-600 font-medium flex-shrink-0">
                <Info className="w-4 h-4 text-capsab-green flex-shrink-0" />
                <span>
                  Canales mapeados activos:{' '}
                  <strong className="text-capsab-green-dark">{activeSensorsCount} / 13</strong>
                </span>
              </div>
            </>
          ) : (
            // New Chart Filtering and Controls UI
            <div className="flex-1 flex flex-col min-h-0 justify-between">
              <div className="flex-1 flex flex-col min-h-0">
                <h3 className="text-md font-bold text-slate-800 mb-2">
                  Filtro de sensores
                </h3>
                <p className="text-xs text-slate-400 font-medium mb-4">
                  Seleccione qué canales visualizar en el gráfico.
                </p>

                {/* Scrollable list of active sensor checkboxes */}
                <div className="flex-1 min-h-0 border border-slate-200 rounded-xl overflow-y-auto bg-slate-50 p-3">
                  {gasConfig.filter(row => row.ref !== 'N/A').length === 0 ? (
                    <p className="text-xs text-slate-400 italic font-medium p-4 text-center">
                      No hay sensores activos mapeados. Configura canales en la pestaña de asignación.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {gasConfig
                        .filter(row => row.ref !== 'N/A')
                        .map((row, chIndex) => {
                          const isHidden = hiddenSensors.includes(row.sensorId);
                          const colors = ['#3cb44b', '#4363d8', '#f58231', '#e6194b', '#911eb4', '#46f0f0'];
                          const sensorColor = colors[chIndex % colors.length];

                          return (
                            <button
                              key={row.sensorId}
                              type="button"
                              onClick={() => {
                                if (isHidden) {
                                  setHiddenSensors(hiddenSensors.filter(id => id !== row.sensorId));
                                } else {
                                  setHiddenSensors([...hiddenSensors, row.sensorId]);
                                }
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold rounded-xl border transition-all duration-150 select-none cursor-pointer ${
                                !isHidden
                                  ? 'bg-white text-slate-700 shadow-sm border-slate-200'
                                  : 'bg-slate-100 border-slate-200 text-slate-400 hover:bg-slate-200/50'
                              }`}
                              style={{
                                borderColor: !isHidden ? sensorColor : undefined,
                                borderWidth: '1.5px'
                              }}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor: !isHidden ? sensorColor : '#94a3b8',
                                    opacity: !isHidden ? 1 : 0.4
                                  }}
                                />
                                <span className="truncate">
                                  {row.sensorId}: <span className={!isHidden ? 'text-slate-900' : 'text-slate-400'}>{row.ref}</span>
                                </span>
                              </div>
                              {!isHidden ? (
                                <Eye className="w-4 h-4 text-slate-500 flex-shrink-0" />
                              ) : (
                                <EyeOff className="w-4 h-4 text-slate-300 flex-shrink-0" />
                              )}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* Start / Stop button at the bottom of the card */}
              <button
                type="button"
                onClick={() => setIsVisualizing(!isVisualizing)}
                className={`w-full mt-4 py-3 px-4 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 shadow-sm border ${
                  isVisualizing
                    ? 'bg-red-500 hover:bg-red-600 border-red-600 text-white'
                    : 'bg-capsab-green hover:bg-capsab-green-hover border-capsab-green text-white'
                }`}
              >
                {isVisualizing ? (
                  <>
                    <Pause className="w-4 h-4" />
                    Pausar Señal
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white" />
                    Reanudar Señal
                  </>
                )}
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Right Column: Physical Sensor Mappings (SG_1 to SG_13 table) or Realtime Chart */}
      <div className="flex-1 flex flex-col h-full min-h-0">
        {/* Menu Tab Toggle */}
        <div className="flex bg-slate-200 p-1 rounded-xl self-start mb-4">
          <button
            type="button"
            onClick={() => setRightTab('list')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              rightTab === 'list' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lista de asignación
          </button>
          <button
            type="button"
            onClick={() => setRightTab('chart')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
              rightTab === 'chart' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Gráfico en tiempo real
          </button>
        </div>

        {/* Content Card */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">

          {rightTab === 'list' ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Table Header */}
              <div className="bg-capsab-green text-white text-sm font-bold flex px-6 py-3 select-none flex-shrink-0">
                <div className="w-[120px] text-center">Sensor</div>
                <div className="flex-1 text-center">Referencia de gas</div>
              </div>

              {/* Table Rows (Scrollable Container) */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {gasConfig.map((row, idx) => (
                  <div
                    key={row.sensorId}
                    className={`flex items-center px-6 py-2.5 ${
                      idx % 2 !== 0 ? 'bg-white' : 'bg-[#F5F5F5]/60'
                    }`}
                  >
                    {/* Sensor Channel label */}
                    <div className="w-[120px] text-center font-bold text-capsab-green text-sm select-none">
                      {row.sensorId}
                    </div>

                    {/* Combo dropdown Mapping */}
                    <div className="flex-1 px-4 md:px-12 flex justify-center">
                      <select
                        value={row.ref}
                        disabled={selectedPCBIndex === "" || (!isEditing && parseInt(selectedPCBIndex) !== pcbPresets.length - 1)}
                        onChange={(e) => updateGasConfigRow(row.sensorId, e.target.value)}
                        className="w-full max-w-[240px] px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-capsab-green text-xs font-semibold cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed bg-white"
                      >
                        <option value="N/A">N/A</option>
                        {gasReferences.map((ref) => (
                          <option key={ref} value={ref}>
                            {ref}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">
              {/* Canvas Plot Container styled like EMG */}
              <div className="flex-1 p-4 min-h-0 flex flex-col">
                <div className="flex-1 w-full bg-slate-950/5 rounded-xl border border-slate-200 overflow-hidden relative">
                  <canvas ref={gasCanvasRef} className="w-full h-full block" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GasSensors;
