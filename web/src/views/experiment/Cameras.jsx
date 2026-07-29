import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Camera, RefreshCw, Maximize2, Trash2 } from 'lucide-react';

const Cameras = () => {
  const {
    mockCameras, // No lo usaremos, usaremos state local
    selectedCameraIndex,
    setSelectedCameraIndex,
    roi,
    setRoi
  } = useAppContext();

  const [availableCameras, setAvailableCameras] = useState([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [activePointSelector, setActivePointSelector] = useState(null); // 'p1' or 'p2'

  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const wsRef = useRef(null);
  const frameRef = useRef(new Image());

  // Precise spinbox coordinate values
  const [p1X, setP1X] = useState(roi.p1 ? roi.p1.x : 0);
  const [p1Y, setP1Y] = useState(roi.p1 ? roi.p1.y : 0);
  const [p2X, setP2X] = useState(roi.p2 ? roi.p2.x : 0);
  const [p2Y, setP2Y] = useState(roi.p2 ? roi.p2.y : 0);

  // Sync state to context when inputs change
  useEffect(() => {
    if (p1X === 0 && p1Y === 0 && p2X === 0 && p2Y === 0) {
      setRoi({ p1: null, p2: null });
    } else {
      setRoi({
        p1: { x: p1X, y: p1Y },
        p2: { x: p2X, y: p2Y }
      });
    }
  }, [p1X, p1Y, p2X, p2Y]);

  // Fetch cameras from backend
  const fetchCameras = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/cameras/');
      if (!response.ok) throw new Error("Error fetching cameras");
      const cams = await response.json();
      
      if (cams && cams.length > 0) {
        setAvailableCameras(cams);
        if (selectedCameraIndex === null || selectedCameraIndex === undefined) {
          setSelectedCameraIndex(cams[0].index);
        }
      } else {
        setAvailableCameras([]);
        setSelectedCameraIndex(null);
      }
    } catch (e) {
      console.warn("Error fetching cameras from backend:", e);
      setAvailableCameras([]);
      setSelectedCameraIndex(null);
    }
  };

  useEffect(() => {
    fetchCameras();
  }, []);

  // Handle webcam stream start/stop
  const toggleCamera = async () => {
    if (isCameraActive) {
      stopCameraStream();
    } else {
      startCameraStream();
    }
  };

  const startCameraStream = () => {
    if (availableCameras.length === 0) return;
    setIsCameraActive(true);
    
    try {
      const wsUrl = `ws://127.0.0.1:8000/api/v1/cameras/${selectedCameraIndex}/stream`;
      console.log('Connecting to Camera WS:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        // Recibe base64 string
        frameRef.current.src = `data:image/jpeg;base64,${event.data}`;
      };

      ws.onerror = (err) => {
        console.error('Camera WebSocket Error:', err);
      };

      ws.onclose = () => {
        console.log('Camera WebSocket cerrado');
        setIsCameraActive(false);
      };
    } catch (e) {
      console.error('Error starting camera WS:', e);
    }
  };

  const stopCameraStream = () => {
    setIsCameraActive(false);
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    // Clear frame
    frameRef.current.src = '';
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Frame processing and drawing ROI
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width = canvas.width = 640;
    let height = canvas.height = 480;

    let testPlateAngle = 0;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      if (isCameraActive) {
        if (frameRef.current && frameRef.current.src) {
          // Intentar dibujar el frame. Si no está listo (aún decodificando), drawImage lanza una excepción silenciosa o simplemente no hace nada,
          // pero evitamos caer en el 'else' que dibuja el mockup y causa parpadeos.
          try {
            ctx.drawImage(frameRef.current, 0, 0, width, height);
          } catch (e) {
            // Ignorar errores de canvas si la imagen aún no está fully loaded
          }
        } else {
          // Draw high-fidelity simulator canvas (e.g. food plate spinning on grid)
          ctx.fillStyle = '#0f172a'; // Dark space
          ctx.fillRect(0, 0, width, height);

          // Grid lines
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1;
          for (let x = 0; x < width; x += 40) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
          }
          for (let y = 0; y < height; y += 40) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
          }

          // Rotating Plate Mockup
          ctx.save();
          ctx.translate(width / 2, height / 2);
          ctx.rotate(testPlateAngle);

          // Plate rim
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(0, 0, 110, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.fillStyle = '#f8fafc';
          ctx.beginPath();
          ctx.arc(0, 0, 105, 0, Math.PI * 2);
          ctx.fill();

          // Sensory sample (Mock cracker)
          ctx.fillStyle = '#eab308';
          ctx.beginPath();
          ctx.arc(-30, -20, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ca8a04';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('Cracker', -53, -16);

          ctx.restore();
          
          testPlateAngle += 0.005;

          // Overlay simulated feed label
          ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
          ctx.fillRect(15, 15, 140, 26);
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 10px "Segoe UI", sans-serif';
          ctx.fillText('● Feed de simulación', 25, 31);
        }

        // Draw selection helper instructions
        if (activePointSelector) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
          ctx.fillRect(width / 2 - 120, 15, 240, 30);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(
            `Haga clic en la imagen para fijar ${activePointSelector.toUpperCase()}`,
            width / 2,
            34
          );
          ctx.textAlign = 'left'; // Reset
        }

        // --- Draw ROI points and rectangle ---
        const drawP1 = (p1X > 0 || p1Y > 0);
        const drawP2 = (p2X > 0 || p2Y > 0);

        if (drawP1 && drawP2) {
          // Bounding rectangle
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2.5;
          ctx.setLineDash([6, 4]);
          
          const rx1 = Math.min(p1X, p2X);
          const ry1 = Math.min(p1Y, p2Y);
          const rw = Math.abs(p2X - p1X);
          const rh = Math.abs(p2Y - p1Y);
          
          ctx.strokeRect(rx1, ry1, rw, rh);
          ctx.setLineDash([]); // Reset
        }

        if (drawP1) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(p1X, p1Y, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = '#ef4444';
          ctx.fillText('P1', p1X - 22, p1Y - 8);
        }

        if (drawP2) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(p2X, p2Y, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 12px sans-serif';
          ctx.fillStyle = '#ef4444';
          ctx.fillText('P2', p2X + 10, p2Y + 15);
        }
      } else {
        // Draw inactive camera background
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          'Alimentación de cámara apagada. Conecte un dispositivo.',
          width / 2,
          height / 2
        );
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isCameraActive, activePointSelector, p1X, p1Y, p2X, p2Y]);

  // Click on stream mapping coordinates
  const handleCanvasClick = (e) => {
    if (!isCameraActive || !activePointSelector) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Exact mapped coordinates based on scaling
    const scaleX = 640 / rect.width;
    const scaleY = 480 / rect.height;
    
    const clickX = Math.round((e.clientX - rect.left) * scaleX);
    const clickY = Math.round((e.clientY - rect.top) * scaleY);

    if (activePointSelector === 'p1') {
      setP1X(clickX);
      setP1Y(clickY);
    } else if (activePointSelector === 'p2') {
      setP2X(clickX);
      setP2Y(clickY);
    }

    setActivePointSelector(null); // Reset select mode
  };

  const handleClearRoi = () => {
    setP1X(0);
    setP1Y(0);
    setP2X(0);
    setP2Y(0);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full select-none">
      
      {/* Left Panel: Camera Config & ROI Coordinates */}
      <div className="w-full lg:w-[280px] xl:w-[320px] flex flex-col justify-between bg-white border border-slate-200 rounded-2xl p-5 shadow-sm h-full">
        <div className="space-y-6">
          <div>
            <h3 className="text-md font-bold text-slate-800 mb-2">
              Sensores de imagen (cámaras)
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Configure la cámara de captura de ráfagas e indique la región de interés (ROI).
            </p>
          </div>

          {/* Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 tracking-wider block">
              Cámara de entrada:
            </label>
            <select
              value={selectedCameraIndex}
              onChange={(e) => setSelectedCameraIndex(parseInt(e.target.value))}
              disabled={isCameraActive}
              className="capsab-input text-xs cursor-pointer"
            >
              {availableCameras.map((cam) => (
                <option key={cam.index} value={cam.index}>
                  {cam.name}
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Connect Button */}
          <button
            type="button"
            onClick={toggleCamera}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg border font-bold text-xs transition-all duration-200 cursor-pointer shadow-sm ${
              isCameraActive
                ? 'bg-capsab-red text-white border-capsab-red-dark hover:bg-capsab-red-hover'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            <Camera className="w-4 h-4" />
            {isCameraActive ? 'Detener cámara' : 'Conectar / iniciar'}
          </button>

          {/* Coordinate Point Adjustments (Spinboxes) */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Región de interés (ROI)</span>
              <button
                type="button"
                onClick={handleClearRoi}
                className="text-[10px] text-slate-400 hover:text-capsab-red font-bold flex items-center gap-1 cursor-pointer"
                title="Limpiar coordenadas"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Limpiar
              </button>
            </div>

            {/* Point 1 */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Punto 1 (P1):</span>
                <button
                  type="button"
                  onClick={() => setActivePointSelector('p1')}
                  disabled={!isCameraActive}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                    activePointSelector === 'p1'
                      ? 'bg-capsab-green text-white border-capsab-green'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50'
                  }`}
                >
                  Fijar en pantalla
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-semibold">X:</span>
                  <input
                    type="number"
                    min={0}
                    max={640}
                    value={p1X}
                    onChange={(e) => setP1X(Math.max(0, Math.min(640, parseInt(e.target.value) || 0)))}
                    disabled={!isCameraActive}
                    className="capsab-input py-1 px-2 text-xs font-bold text-center"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-semibold">Y:</span>
                  <input
                    type="number"
                    min={0}
                    max={480}
                    value={p1Y}
                    onChange={(e) => setP1Y(Math.max(0, Math.min(480, parseInt(e.target.value) || 0)))}
                    disabled={!isCameraActive}
                    className="capsab-input py-1 px-2 text-xs font-bold text-center"
                  />
                </div>
              </div>
            </div>

            {/* Point 2 */}
            <div className="space-y-2 pt-2 border-t border-slate-50">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500">Punto 2 (P2):</span>
                <button
                  type="button"
                  onClick={() => setActivePointSelector('p2')}
                  disabled={!isCameraActive}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                    activePointSelector === 'p2'
                      ? 'bg-capsab-green text-white border-capsab-green'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50'
                  }`}
                >
                  Fijar en pantalla
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-semibold">X:</span>
                  <input
                    type="number"
                    min={0}
                    max={640}
                    value={p2X}
                    onChange={(e) => setP2X(Math.max(0, Math.min(640, parseInt(e.target.value) || 0)))}
                    disabled={!isCameraActive}
                    className="capsab-input py-1 px-2 text-xs font-bold text-center"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 font-semibold">Y:</span>
                  <input
                    type="number"
                    min={0}
                    max={480}
                    value={p2Y}
                    onChange={(e) => setP2Y(Math.max(0, Math.min(480, parseInt(e.target.value) || 0)))}
                    disabled={!isCameraActive}
                    className="capsab-input py-1 px-2 text-xs font-bold text-center"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-3 bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-xs text-slate-500 font-medium">
          <Maximize2 className="w-4 h-4 text-capsab-green flex-shrink-0" />
          <span>
            {roi.p1 && roi.p2 ? 'ROI Configurado correctamente' : 'Sin ROI configurado. Captura completa.'}
          </span>
        </div>
      </div>

      {/* Right Column: Live Stream Canvas */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col h-full">
        <h4 className="text-xs font-bold text-slate-700 mb-3 border-b border-slate-100 pb-1.5 flex items-center gap-1.5 select-none">
          <Camera className="w-4 h-4 text-capsab-green" />
          Previsualización de cámara
        </h4>

        {/* We no longer need the hidden video tag since we draw directly from an Image object */}

        {/* Canvas displaying stream & ROI */}
        <div className="flex-1 w-full bg-slate-900 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center relative cursor-crosshair">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="max-w-full max-h-full block object-contain"
          />
        </div>
      </div>

    </div>
  );
};

export default Cameras;
