import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import Header from '../components/Header';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FolderOpen, AlertCircle, Image as ImageIcon, Volume2, Activity, Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';

const VisualizationView = () => {
  const { showAlert } = useAppContext();

  // Selected Directory scan state
  const [selectedDirName, setSelectedDirName] = useState('');
  const [scannedSessions, setScannedSessions] = useState([]);
  const [scanResult, setScanResult] = useState(null); // { gas: bool, img: bool, audio: bool, emg: bool }
  const [activeTab, setActiveTab] = useState(null); // 'gas', 'img', 'audio', 'emg'
  const [loadedSessionData, setLoadedSessionData] = useState(null);

  // Date range filters state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Mapped telemetry data for chart visualizations
  const [gasChartData, setGasChartData] = useState([]);
  const [emgChartData, setEmgChartData] = useState([]);
  
  // Audio state
  const [selectedUserAudio, setSelectedUserAudio] = useState(0);
  
  // Original audio player state
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [durationOriginal, setDurationOriginal] = useState(0);
  const [currentTimeOriginal, setCurrentTimeOriginal] = useState(0);
  const audioRefOriginal = useRef(null);

  // Processed audio player state
  const [isPlayingProcessed, setIsPlayingProcessed] = useState(false);
  const [durationProcessed, setDurationProcessed] = useState(0);
  const [currentTimeProcessed, setCurrentTimeProcessed] = useState(0);
  const audioRefProcessed = useRef(null);
  
  // Audio filter state
  const [audioFilter, setAudioFilter] = useState('original'); // 'original', 'hpss', 'reduce_noise'
  const [noiseStart, setNoiseStart] = useState(0.0);
  const [noiseEnd, setNoiseEnd] = useState(1.0);

  // Image carousel state
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [sessionImages, setSessionImages] = useState([]);
  const [imgFilter, setImgFilter] = useState('original'); // 'original', 'edges', 'shapes'
  const [kernelSize, setKernelSize] = useState(5);
  const [cannyLow, setCannyLow] = useState(50);
  const [cannyHigh, setCannyHigh] = useState(150);
  const [approxTolerance, setApproxTolerance] = useState(0.04);
  const [minArea, setMinArea] = useState(100);
  const [maxArea, setMaxArea] = useState(1000);
  const [circularityThreshold, setCircularityThreshold] = useState(0.80);

  const handlePrevPhoto = () => {
    if (sessionImages.length === 0) return;
    setCarouselIndex((prev) => (prev - 1 + sessionImages.length) % sessionImages.length);
  };

  const handleNextPhoto = () => {
    if (sessionImages.length === 0) return;
    setCarouselIndex((prev) => (prev + 1) % sessionImages.length);
  };

  const toggleAudioOriginal = () => {
    if (!audioRefOriginal.current) return;
    if (isPlayingOriginal) {
      audioRefOriginal.current.pause();
      setIsPlayingOriginal(false);
    } else {
      if (isPlayingProcessed && audioRefProcessed.current) {
        audioRefProcessed.current.pause();
        setIsPlayingProcessed(false);
      }
      audioRefOriginal.current.play()
        .then(() => setIsPlayingOriginal(true))
        .catch(err => console.error("Error playing original audio:", err));
    }
  };

  const toggleAudioProcessed = () => {
    if (!audioRefProcessed.current) return;
    if (isPlayingProcessed) {
      audioRefProcessed.current.pause();
      setIsPlayingProcessed(false);
    } else {
      if (isPlayingOriginal && audioRefOriginal.current) {
        audioRefOriginal.current.pause();
        setIsPlayingOriginal(false);
      }
      audioRefProcessed.current.play()
        .then(() => setIsPlayingProcessed(true))
        .catch(err => console.error("Error playing processed audio:", err));
    }
  };

  const formatTime = (time) => {
    if (time === null || time === undefined || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const fetchEmgData = async (sessionDir, userFolder) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/experiments/sessions/data/emg?session_dir=${encodeURIComponent(sessionDir)}&user_folder=${encodeURIComponent(userFolder)}`);
      if (res.ok) {
        const data = await res.json();
        setEmgChartData(data);
      } else {
        setEmgChartData([]);
      }
    } catch (err) {
      console.error("Error fetching EMG data:", err);
      setEmgChartData([]);
    }
  };

  // Handle local folder selection simulation/scanned loading
  const handleSessionClick = async (session) => {
    setSelectedDirName(session.directory);
    setLoadedSessionData(session);
    setImgFilter('original');
    setKernelSize(5);
    setCannyLow(50);
    setCannyHigh(150);
    setApproxTolerance(0.04);
    setMinArea(100);
    setMaxArea(1000);
    setCircularityThreshold(0.80);
    
    setAudioFilter('original');
    setNoiseStart(0.0);
    setNoiseEnd(1.0);
    
    const result = {
      gas: session.hasGas,
      img: session.hasImaging,
      audio: session.hasAudio,
      emg: session.hasEmg
    };
    
    setScanResult(result);
    setCarouselIndex(0);
    setSelectedUserAudio(0);
    setIsPlayingOriginal(false);
    setIsPlayingProcessed(false);
    setCurrentTimeOriginal(0);
    setCurrentTimeProcessed(0);
    setDurationOriginal(0);
    setDurationProcessed(0);

    // Switch to first active tab
    let defaultTab = null;
    if (result.gas) defaultTab = 'gas';
    else if (result.img) defaultTab = 'img';
    else if (result.audio) defaultTab = 'audio';
    else if (result.emg) defaultTab = 'emg';
    setActiveTab(defaultTab);

    // Fetch Gas data
    if (result.gas) {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/experiments/sessions/data/gas?session_dir=${encodeURIComponent(session.directory)}`);
        if (res.ok) {
          const data = await res.json();
          setGasChartData(data);
        } else {
          setGasChartData([]);
        }
      } catch (err) {
        console.error("Error fetching gas data:", err);
        setGasChartData([]);
      }
    } else {
      setGasChartData([]);
    }

    // Fetch Images list
    if (result.img) {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/experiments/sessions/data/images?session_dir=${encodeURIComponent(session.directory)}`);
        if (res.ok) {
          const data = await res.json();
          setSessionImages(data);
        } else {
          setSessionImages([]);
        }
      } catch (err) {
        console.error("Error fetching images list:", err);
        setSessionImages([]);
      }
    } else {
      setSessionImages([]);
    }

    // Fetch EMG data for the first user
    if (result.emg && session.users && session.users.length > 0) {
      await fetchEmgData(session.directory, session.users[0].folder);
    } else {
      setEmgChartData([]);
    }
  };

  // Sync EMG/Audio switching
  useEffect(() => {
    if (loadedSessionData && scanResult?.emg && loadedSessionData.users && loadedSessionData.users[selectedUserAudio]) {
      fetchEmgData(loadedSessionData.directory, loadedSessionData.users[selectedUserAudio].folder);
    }
    // Also reset audio state
    setIsPlayingOriginal(false);
    setIsPlayingProcessed(false);
    setCurrentTimeOriginal(0);
    setCurrentTimeProcessed(0);
    if (audioRefOriginal.current) {
      audioRefOriginal.current.pause();
      audioRefOriginal.current.load();
    }
    if (audioRefProcessed.current) {
      audioRefProcessed.current.pause();
      audioRefProcessed.current.load();
    }
  }, [selectedUserAudio, loadedSessionData]);

  const loadAndValidateSessions = async (dirPath) => {
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/experiments/sessions?directory=${encodeURIComponent(dirPath)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Estructura de directorio inválida.');
      }
      const sessions = await response.json();
      setSelectedDirName(dirPath);
      setScannedSessions(sessions);
      setStartDate('');
      setEndDate('');
      setLoadedSessionData(null);
      setScanResult(null);
      setActiveTab(null);
    } catch (err) {
      console.error(err);
      showAlert('Error de Validación', err.message || 'El directorio seleccionado no cumple con la estructura requerida.');
      setSelectedDirName('');
      setScannedSessions([]);
      setStartDate('');
      setEndDate('');
      setLoadedSessionData(null);
      setScanResult(null);
      setActiveTab(null);
    }
  };

  const handleBrowseDirectory = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/experiments/browse');
      if (!response.ok) {
        throw new Error('Error al abrir el explorador de archivos');
      }
      const data = await response.json();
      if (data.path) {
        await loadAndValidateSessions(data.path);
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', err.message || 'No se pudo abrir el explorador de archivos');
    }
  };

  const getSessionDateString = (timestamp) => {
    if (!timestamp) return '';
    if (timestamp.includes('-')) {
      return timestamp.split(' ')[0];
    }
    if (timestamp.length >= 8 && /^\d+$/.test(timestamp.substring(0, 8))) {
      const y = timestamp.substring(0, 4);
      const m = timestamp.substring(4, 6);
      const d = timestamp.substring(6, 8);
      return `${y}-${m}-${d}`;
    }
    return timestamp;
  };

  const sessionsToFilter = scannedSessions;

  const uniqueDates = [...new Set(sessionsToFilter.map(s => getSessionDateString(s.timestamp)))]
    .filter(Boolean)
    .sort();

  const filteredSessions = sessionsToFilter.filter(session => {
    const sessionDate = getSessionDateString(session.timestamp);
    if (!sessionDate) return true;
    if (startDate && sessionDate < startDate) return false;
    if (endDate && sessionDate > endDate) return false;
    return true;
  });

  return (
    <div className="h-screen flex flex-col bg-slate-100 select-none overflow-hidden">
      <Header title="Visualización de datos de experimentación" />

      {/* Main Container */}
      <main className="flex-1 w-full px-8 py-6 flex flex-col gap-6 min-h-0 overflow-hidden">
        
        {/* Top bar: Directory upload selector */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-capsab-green" />
                Selección de carpeta de experimentación
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Seleccione el directorio de la sesión para analizar y graficar la telemetría grabada.
              </p>
            </div>

            {/* Folder selection buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleBrowseDirectory}
                className="flex items-center gap-2 px-5 py-3 border border-slate-300 rounded-xl text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 transition duration-150 cursor-pointer shadow-sm text-xs font-bold"
              >
                Examinar carpeta...
              </button>
            </div>
          </div>

          {/* Directory path text indicator */}
          {selectedDirName && (
            <div className="text-xs bg-slate-50 border border-slate-200/60 rounded-xl px-4 py-2 font-bold text-slate-700 select-text">
              Directorio cargado: <span className="text-capsab-green-dark">{selectedDirName}</span>
            </div>
          )}
        </div>

        {/* Second Row: Split Layout */}
        <div className="flex-1 flex flex-col lg:flex-row gap-6 items-stretch min-h-0">
          
          {/* Left panel: Session Selector (30% width) */}
          <div className="w-full lg:w-[30%] bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col gap-4 min-h-0">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-capsab-green" />
                Sesiones disponibles
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Seleccione una sesión para visualizar.
              </p>
            </div>

            {/* Date range filters */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 space-y-2">
              <span className="text-[10px] tracking-wider text-slate-400 font-bold block">
                Rango de fechas
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="startDateSelect" className="text-[9px] text-slate-500 font-bold block mb-0.5">
                    Inicio
                  </label>
                  <select
                    id="startDateSelect"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-1.5 py-1 text-[11px] text-slate-700 font-semibold focus:outline-none focus:border-capsab-green cursor-pointer"
                  >
                    <option value="">Todas</option>
                    {uniqueDates.map(date => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="endDateSelect" className="text-[9px] text-slate-500 font-bold block mb-0.5">
                    Fin
                  </label>
                  <select
                    id="endDateSelect"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-1.5 py-1 text-[11px] text-slate-700 font-semibold focus:outline-none focus:border-capsab-green cursor-pointer"
                  >
                    <option value="">Todas</option>
                    {uniqueDates.map(date => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="w-full text-center text-[10px] text-red-500 hover:text-red-600 font-bold mt-1 block hover:underline transition duration-150 cursor-pointer"
                >
                  Limpiar filtros
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5">
              {filteredSessions.length > 0 ? (
                filteredSessions.map((session, idx) => {
                  const isSelected = loadedSessionData?.directory === session.directory;
                  const isMock = scannedSessions.length === 0;
                  const title = isMock 
                    ? `Ejemplo: ${session.directory.split('/').pop()}` 
                    : session.timestamp;
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => handleSessionClick(session)}
                      className="group cursor-pointer transition duration-150"
                    >
                      <div className={`p-3 rounded-2xl border text-xs text-left font-semibold flex items-center justify-between gap-3 ${
                        isSelected 
                          ? 'bg-capsab-green-light/40 border-capsab-green/30 text-capsab-green-dark shadow-sm'
                          : 'bg-slate-50/50 hover:bg-slate-50 border-slate-200 text-slate-700'
                      }`}>
                        <div className="truncate flex-1">
                          <span className="font-bold text-sm block text-slate-800">{title}</span>
                          <span className="text-[10px] text-slate-400 block mt-1 truncate">
                            {session.directory}
                          </span>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {session.hasGas && <span className="px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600 text-[8px] font-bold">Gas</span>}
                            {session.hasImaging && <span className="px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600 text-[8px] font-bold">Cámara</span>}
                            {session.hasEmg && <span className="px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600 text-[8px] font-bold">EMG</span>}
                            {session.hasAudio && <span className="px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-600 text-[8px] font-bold">Audio</span>}
                          </div>
                        </div>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                          isSelected
                            ? 'bg-capsab-green text-white'
                            : 'bg-slate-200 text-slate-600 group-hover:bg-capsab-green group-hover:text-white transition duration-150'
                        }`}>
                          {isSelected ? 'Activa' : 'Cargar'}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                  {scannedSessions.length > 0 
                    ? "No hay sesiones en el rango seleccionado."
                    : "No se han encontrado sesiones. Seleccione un directorio arriba."}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: Visualization Content or Placeholder (70% width) */}
          <div className="flex-1 w-full lg:w-[70%] flex flex-col gap-6 min-h-0">
            {scanResult ? (
              <>
                {/* Visualizer Tab Navigation Headers */}
                <div className="flex bg-slate-200 p-1.5 rounded-2xl self-start gap-1 select-none shadow-inner">
                  <button
                    disabled={!scanResult.gas}
                    onClick={() => setActiveTab('gas')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition duration-150 cursor-pointer ${
                      activeTab === 'gas'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed'
                    }`}
                  >
                    <Activity className="w-4 h-4 text-capsab-green" />
                    Sensores de Gas
                  </button>

                  <button
                    disabled={!scanResult.img}
                    onClick={() => setActiveTab('img')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition duration-150 cursor-pointer ${
                      activeTab === 'img'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4 text-capsab-green" />
                    Imagen
                  </button>

                  <button
                    disabled={!scanResult.audio}
                    onClick={() => setActiveTab('audio')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition duration-150 cursor-pointer ${
                      activeTab === 'audio'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed'
                    }`}
                  >
                    <Volume2 className="w-4 h-4 text-capsab-green" />
                    Audio
                  </button>

                  <button
                    disabled={!scanResult.emg}
                    onClick={() => setActiveTab('emg')}
                    className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition duration-150 cursor-pointer ${
                      activeTab === 'emg'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed'
                    }`}
                  >
                    <Activity className="w-4 h-4 text-capsab-green" />
                    Electromiografía
                  </button>
                </div>

                {/* Tab Body contents */}
                <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm min-h-0 flex flex-col">
                  
                  {/* Tab 1: Gases Line Chart */}
                  {activeTab === 'gas' && (
                    <div className="flex-1 flex flex-col justify-between space-y-4 min-h-0">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">Muestras de telemetría de gases</h4>
                        <p className="text-xs text-slate-400 font-medium">Voltajes registrados en gases.csv durante la sesión (60 segundos)</p>
                      </div>

                      <div className="flex-1 min-h-0 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={gasChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="time" label={{ value: 'Tiempo (s)', position: 'insideBottomRight', offset: -5 }} />
                            <YAxis label={{ value: 'Voltaje (V)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            {Object.keys(gasChartData[0] || {}).filter(k => k !== 'time').map((key, i) => {
                              const colors = ['#4CAF50', '#3b82f6', '#f58231', '#9c27b0', '#e91e63', '#ffeb3b', '#00bcd4'];
                              const strokeColor = colors[i % colors.length];
                              return (
                                <Line
                                  key={key}
                                  type="monotone"
                                  dataKey={key}
                                  stroke={strokeColor}
                                  strokeWidth={2.5}
                                  activeDot={i === 0 ? { r: 8 } : undefined}
                                />
                              );
                            })}
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Photos Carousel */}
                  {activeTab === 'img' && (
                    <div className="flex-1 flex flex-col min-h-0">
                      {/* Title block */}
                      <div className="mb-4 flex-shrink-0">
                        <h4 className="text-sm font-bold text-slate-800">Galería de imagen (cámara - ráfaga)</h4>
                        <p className="text-xs text-slate-400 font-medium">Imágenes reales procesadas de la Región de Interés</p>
                      </div>

                      {/* Split layout: Left column and Right column */}
                      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0 overflow-hidden">
                        
                        {/* Left Column: Sliders/Dropdowns/Información */}
                        <div className="w-full md:w-[35%] flex flex-col gap-4 overflow-y-auto pr-1">
                          
                          {/* Filter selector */}
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm flex-shrink-0">
                            <span className="text-[10px] tracking-wider text-slate-400 font-bold block">
                              Filtro de visualización
                            </span>
                            <div className="grid grid-cols-3 bg-slate-200/60 p-1 rounded-xl gap-1 border border-slate-200/50">
                              <button
                                onClick={() => setImgFilter('original')}
                                className={`py-1.5 text-xs font-bold rounded-lg transition duration-150 cursor-pointer text-center ${
                                  imgFilter === 'original'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                Sin filtro
                              </button>
                              <button
                                onClick={() => setImgFilter('edges')}
                                className={`py-1.5 text-xs font-bold rounded-lg transition duration-150 cursor-pointer text-center ${
                                  imgFilter === 'edges'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                Bordes
                              </button>
                              <button
                                onClick={() => setImgFilter('shapes')}
                                className={`py-1.5 text-xs font-bold rounded-lg transition duration-150 cursor-pointer text-center ${
                                  imgFilter === 'shapes'
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-800'
                                }`}
                              >
                                Formas
                              </button>
                            </div>
                          </div>

                          {/* Edge Filter sliders */}
                          {imgFilter === 'edges' && (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm flex-shrink-0">
                              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                                Parámetros de bordes
                              </span>
                              
                              <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-slate-600 flex justify-between">
                                  <span>Tamaño del kernel (suavizado)</span>
                                  <span className="text-capsab-green">{kernelSize}x{kernelSize}</span>
                                </label>
                                <select
                                  value={kernelSize}
                                  onChange={(e) => setKernelSize(Number(e.target.value))}
                                  className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 font-semibold focus:outline-none focus:border-capsab-green cursor-pointer shadow-sm w-full"
                                >
                                  {[1, 3, 5, 7, 9, 11, 15].map((k) => (
                                    <option key={k} value={k}>{k}x{k} {k === 1 ? '(Sin suavizado)' : ''}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="flex flex-col gap-1.5">
                                <label className="text-[11px] font-bold text-slate-600 flex justify-between">
                                  <span>Umbrales Canny (bajo - alto)</span>
                                  <span className="text-capsab-green font-bold">{cannyLow} - {cannyHigh}</span>
                                </label>
                                <div className="relative w-full h-8 flex items-center px-1">
                                  <div className="absolute left-1 right-1 h-2 bg-slate-200 rounded-full" />
                                  <div 
                                    className="absolute h-2 bg-capsab-green rounded-full"
                                    style={{
                                      left: `${(cannyLow / 255) * 100}%`,
                                      width: `${((cannyHigh - cannyLow) / 255) * 100}%`
                                    }}
                                  />
                                  <input
                                    type="range"
                                    min="0"
                                    max="255"
                                    value={cannyLow}
                                    onChange={(e) => {
                                      const val = Math.min(Number(e.target.value), cannyHigh - 1);
                                      setCannyLow(val);
                                    }}
                                    className="absolute left-0 w-full h-2 appearance-none bg-transparent pointer-events-none focus:outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-capsab-green-dark [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-capsab-green-dark [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:shadow-md"
                                  />
                                  <input
                                    type="range"
                                    min="0"
                                    max="255"
                                    value={cannyHigh}
                                    onChange={(e) => {
                                      const val = Math.max(Number(e.target.value), cannyLow + 1);
                                      setCannyHigh(val);
                                    }}
                                    className="absolute left-0 w-full h-2 appearance-none bg-transparent pointer-events-none focus:outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-capsab-green-dark [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-capsab-green-dark [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:shadow-md"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Shapes Filter sliders & Legend */}
                          {imgFilter === 'shapes' && (
                            <div className="flex flex-col gap-4 flex-shrink-0">
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
                                <span className="text-[10px] tracking-wider text-slate-400 font-bold block">
                                  Parámetros de formas
                                </span>

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[11px] font-bold text-slate-600 flex justify-between">
                                    <span>Tolerancia de aproximación</span>
                                    <span className="text-capsab-green">{approxTolerance}</span>
                                  </label>
                                  <input
                                    type="range"
                                    min="0.01"
                                    max="0.15"
                                    step="0.01"
                                    value={approxTolerance}
                                    onChange={(e) => setApproxTolerance(Number(e.target.value))}
                                    className="w-full accent-capsab-green cursor-pointer"
                                  />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[11px] font-bold text-slate-600 flex justify-between">
                                    <span>Umbral de circularidad</span>
                                    <span className="text-capsab-green">{circularityThreshold}</span>
                                  </label>
                                  <input
                                    type="range"
                                    min="0.50"
                                    max="1.00"
                                    step="0.05"
                                    value={circularityThreshold}
                                    onChange={(e) => setCircularityThreshold(Number(e.target.value))}
                                    className="w-full accent-capsab-green cursor-pointer"
                                  />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[11px] font-bold text-slate-600 flex justify-between">
                                    <span>Rango de área filtrada</span>
                                    <span className="text-capsab-green font-bold">{minArea} - {maxArea}</span>
                                  </label>
                                  <div className="relative w-full h-8 flex items-center px-1">
                                    <div className="absolute left-1 right-1 h-2 bg-slate-200 rounded-full" />
                                    <div 
                                      className="absolute h-2 bg-capsab-green rounded-full"
                                      style={{
                                        left: `${(minArea / 1000) * 100}%`,
                                        width: `${((maxArea - minArea) / 1000) * 100}%`
                                      }}
                                    />
                                    <input
                                      type="range"
                                      min="0"
                                      max="1000"
                                      step="20"
                                      value={minArea}
                                      onChange={(e) => {
                                        const val = Math.min(Number(e.target.value), maxArea - 20);
                                        setMinArea(val);
                                      }}
                                      className="absolute left-0 w-full h-2 appearance-none bg-transparent pointer-events-none focus:outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-capsab-green-dark [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-capsab-green-dark [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:shadow-md"
                                    />
                                    <input
                                      type="range"
                                      min="0"
                                      max="1000"
                                      step="20"
                                      value={maxArea}
                                      onChange={(e) => {
                                        const val = Math.max(Number(e.target.value), minArea + 20);
                                        setMaxArea(val);
                                      }}
                                      className="absolute left-0 w-full h-2 appearance-none bg-transparent pointer-events-none focus:outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-capsab-green-dark [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-capsab-green-dark [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:shadow-md"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Legend Container */}
                              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm">
                                <span className="text-[10px] tracking-wider text-slate-400 font-bold block">
                                  Leyenda de detección de formas
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                  {[
                                    { name: 'Círculo', color: 'rgb(255, 0, 0)' },
                                    { name: 'Triángulo', color: 'rgb(0, 0, 255)' },
                                    { name: 'Cuadrado', color: 'rgb(0, 255, 0)' },
                                    { name: 'Rectángulo', color: 'rgb(255, 255, 0)' },
                                    { name: 'Pentágono', color: 'rgb(255, 0, 255)' },
                                    { name: 'Hexágono', color: 'rgb(0, 255, 255)' },
                                    { name: 'Polígono', color: 'rgb(255, 165, 0)' }
                                  ].map((item) => (
                                    <div key={item.name} className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                                      <span 
                                        className="w-3 h-3 rounded-full border border-slate-350 shadow-sm flex-shrink-0"
                                        style={{ backgroundColor: item.color }}
                                      />
                                      <span>{item.name}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Original Filter: Information */}
                          {imgFilter === 'original' && (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col gap-2 shadow-sm text-xs font-semibold text-slate-500 flex-shrink-0">
                              <span className="text-[10px] tracking-wider text-slate-400 font-bold block mb-1">
                                Información de imagen
                              </span>
                              <p>Se está visualizando la ráfaga de imágenes en su estado original sin filtros de procesamiento digital aplicados.</p>
                              <p className="mt-1">Use los botones de navegación a la derecha para ver los distintos fotogramas de la ráfaga.</p>
                            </div>
                          )}

                        </div>

                        {/* Right Column: Top Image, Bottom Navigation */}
                        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
                          
                          {/* Top: Image container */}
                          <div className="flex-1 bg-slate-900 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center relative p-2 select-none shadow-md min-h-0">
                            {sessionImages && sessionImages.length > 0 ? (
                              <img 
                                src={`http://127.0.0.1:8000/api/v1/experiments/sessions/files/image?session_dir=${encodeURIComponent(loadedSessionData.directory)}&filename=${sessionImages[carouselIndex]}&filter_type=${imgFilter}&kernel_size=${kernelSize}&canny_low=${cannyLow}&canny_high=${cannyHigh}&approx_tolerance=${approxTolerance}&min_area=${minArea}&max_area=${maxArea}&circularity_threshold=${circularityThreshold}`}
                                alt={`Foto ${carouselIndex + 1}`}
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <div className="w-[120px] h-[120px] rounded-full border-4 border-slate-500 bg-slate-100/10 flex items-center justify-center text-[10px] text-slate-400 font-bold text-center">
                                Sin imágenes
                              </div>
                            )}
                          </div>

                          {/* Bottom: Previous btn / Img index indicador / Next btn */}
                          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-4 shadow-sm flex-shrink-0">
                            <button
                              onClick={handlePrevPhoto}
                              className="px-4 py-2 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 transition duration-150 shadow-sm cursor-pointer text-xs font-bold text-slate-700 flex items-center gap-1.5"
                            >
                              <ChevronLeft className="w-4 h-4" />
                              Anterior
                            </button>

                            {/* Indicators / Index text */}
                            <div className="flex flex-col items-center gap-1.5">
                              <span className="text-[10px] text-slate-400 font-bold">
                                Índice de imagen
                              </span>
                              <div className="flex items-center gap-2">
                                <div className="flex gap-1.5">
                                  {sessionImages.map((_, idx) => (
                                    <div
                                      key={idx}
                                      className={`w-2.5 h-2.5 rounded-full transition-all duration-150 ${
                                        idx === carouselIndex ? 'bg-capsab-green w-6' : 'bg-slate-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="text-xs font-bold text-slate-600 ml-1">
                                  ({carouselIndex + 1} de {sessionImages.length})
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={handleNextPhoto}
                              className="px-4 py-2 border border-slate-300 rounded-xl bg-white hover:bg-slate-50 active:bg-slate-100 transition duration-150 shadow-sm cursor-pointer text-xs font-bold text-slate-700 flex items-center gap-1.5"
                            >
                              Siguiente
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>

                        </div>

                      </div>
                    </div>
                  )}

                  {/* Tab 3: Audio Players */}
                  {activeTab === 'audio' && (
                    <div className="flex-1 flex flex-col justify-between space-y-4 min-h-0">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">Grabaciones de audio (micrófonos)</h4>
                        <p className="text-xs text-slate-400 font-medium">Escuche las muestras de audio individuales guardadas en .wav con o sin cancelación de ruido</p>
                      </div>

                      <div className="flex-grow overflow-y-auto pr-2 pb-2 flex flex-col gap-6 min-h-0">
                        {/* Row 1: Users (Left) & Original Player (Right) */}
                        <div className="flex flex-col md:flex-row gap-6 items-stretch flex-shrink-0">
                          {/* Left Column: List of users */}
                          <div className="w-full md:w-1/3 border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden shadow-inner flex flex-col min-h-0">
                            <div className="p-3 bg-slate-200 text-slate-700 text-xs font-bold tracking-wider flex-shrink-0">
                              Participantes de audio
                            </div>
                            <div className="divide-y divide-slate-100 overflow-y-auto flex-1 max-h-[220px] md:max-h-none">
                              {loadedSessionData?.users?.map((user, idx) => (
                                <div
                                  key={idx}
                                  onClick={() => {
                                    setSelectedUserAudio(idx);
                                    setCurrentTimeOriginal(0);
                                    setCurrentTimeProcessed(0);
                                  }}
                                  className={`px-4 py-3 text-xs font-bold cursor-pointer transition-colors duration-150 ${
                                    idx === selectedUserAudio
                                      ? 'bg-capsab-green-light/60 text-capsab-green-dark border-l-4 border-capsab-green'
                                      : 'bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  {`audio_user_${idx + 1}.wav (${user.id})`}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Right Column: Original Audio Container */}
                          <div className="flex-1 bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm flex flex-col relative w-full min-h-0 justify-between">
                            <div className="flex items-center gap-4 mb-6">
                              <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center flex-shrink-0">
                                <Volume2 className="w-6 h-6 text-green-600" />
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-slate-400 tracking-wider">
                                  Reproductor de audio original
                                </span>
                                <h4 className="text-sm font-bold text-slate-800">
                                  {loadedSessionData?.users[selectedUserAudio] ? `audio_user_${selectedUserAudio + 1}.wav` : 'audio_user_1.wav'}
                                </h4>
                              </div>
                            </div>

                            {/* Play Progress bar */}
                            <div className="space-y-1.5 mb-6">
                              <input
                                type="range"
                                min="0"
                                max={durationOriginal || 1}
                                step="0.05"
                                value={currentTimeOriginal}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (audioRefOriginal.current) {
                                    audioRefOriginal.current.currentTime = val;
                                  }
                                  setCurrentTimeOriginal(val);
                                }}
                                className="w-full h-1 bg-slate-100 hover:bg-slate-200 rounded-lg appearance-none cursor-pointer accent-capsab-green"
                              />
                              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                                <span>{formatTime(currentTimeOriginal)}</span>
                                <span>{formatTime(durationOriginal)}</span>
                              </div>
                            </div>

                            {/* Button */}
                            <button
                              onClick={toggleAudioOriginal}
                              disabled={!loadedSessionData?.users[selectedUserAudio]?.hasAudio}
                              className="mx-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-capsab-green hover:bg-capsab-green-hover text-white font-bold rounded-xl transition duration-150 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isPlayingOriginal ? (
                                <>
                                  <Pause className="w-4 h-4 fill-current" />
                                  Pausar muestra
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 fill-current" />
                                  Reproducir muestra
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Filter Settings (Left) & Processed Player (Right) */}
                        <div className="flex flex-col md:flex-row gap-6 items-stretch flex-shrink-0">
                          {/* Left Column: Filter Configuration */}
                          <div className="w-full md:w-1/3 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 shadow-sm min-h-0 justify-between">
                            <div>
                              <h5 className="text-[11px] tracking-wider text-slate-400 font-bold block border-b border-slate-100 pb-2 mb-1">
                                Filtro de cancelación de ruido
                              </h5>
                              
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => setAudioFilter('original')}
                                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 text-left ${
                                    audioFilter === 'original'
                                      ? 'bg-slate-800 text-white shadow-md'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  Audio original
                                </button>
                                <button
                                  onClick={() => setAudioFilter('hpss')}
                                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 text-left ${
                                    audioFilter === 'hpss'
                                      ? 'bg-slate-800 text-white shadow-md'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  Separación armónica (HPSS)
                                </button>
                                <button
                                  onClick={() => setAudioFilter('reduce_noise')}
                                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 text-left ${
                                    audioFilter === 'reduce_noise'
                                      ? 'bg-slate-800 text-white shadow-md'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                  }`}
                                >
                                  Reducción de ruido activa
                                </button>
                              </div>

                              {/* HPSS Info */}
                              {audioFilter === 'hpss' && (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-2 text-xs font-semibold text-slate-500">
                                  <p>Este filtro separa las componentes armónicas y elimina la porción percusiva del audio.</p>
                                </div>
                              )}
                            </div>

                            {/* Controls for Reduce Noise parameters */}
                            {audioFilter === 'reduce_noise' && (
                              <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mt-2">
                                <h5 className="text-[10px] font-bold text-slate-500 mb-3">Muestra de ruido (perfil)</h5>
                                
                                <div className="space-y-4">
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                      <label className="text-[10px] font-bold text-slate-500">Inicio de ruido (segundos)</label>
                                      <span className="text-xs font-bold text-capsab-green-dark bg-capsab-green-light/50 px-2 py-0.5 rounded-md">
                                        {noiseStart.toFixed(1)} s
                                      </span>
                                    </div>
                                    <input 
                                      type="range"
                                      min="0"
                                      max={Math.max(durationOriginal - 0.5, 0)}
                                      step="0.1"
                                      value={noiseStart}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setNoiseStart(val);
                                        if (val >= noiseEnd) setNoiseEnd(val + 0.5);
                                      }}
                                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-capsab-green"
                                    />
                                  </div>
                                  
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between items-center">
                                      <label className="text-[10px] font-bold text-slate-500">Fin de ruido (segundos)</label>
                                      <span className="text-xs font-bold text-capsab-green-dark bg-capsab-green-light/50 px-2 py-0.5 rounded-md">
                                        {noiseEnd.toFixed(1)} s
                                      </span>
                                    </div>
                                    <input 
                                      type="range"
                                      min="0.5"
                                      max={durationOriginal || 60}
                                      step="0.1"
                                      value={noiseEnd}
                                      onChange={(e) => {
                                        const val = Math.max(Number(e.target.value), noiseStart + 0.5);
                                        setNoiseEnd(val);
                                      }}
                                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-capsab-green"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right Column: Processed Audio Container */}
                          <div className={`flex-1 bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm flex flex-col relative transition-all duration-300 min-h-0 justify-between ${audioFilter !== 'original' ? '' : 'opacity-60'}`}>
                            <div className="flex items-center gap-4 mb-6">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${audioFilter !== 'original' ? 'bg-green-50' : 'bg-slate-100'}`}>
                                <Volume2 className={`w-6 h-6 ${audioFilter !== 'original' ? 'text-green-600' : 'text-slate-400'}`} />
                              </div>
                              <div className="flex flex-col">
                                <span className={`text-[10px] font-bold tracking-wider ${audioFilter !== 'original' ? 'text-green-600' : 'text-slate-400'}`}>
                                  Reproductor de audio procesado
                                </span>
                                <h4 className="text-sm font-bold text-slate-800">
                                  {loadedSessionData?.users[selectedUserAudio] ? `audio_user_${selectedUserAudio + 1}.wav` : 'audio_user_1.wav'}
                                  <span className="text-xs text-slate-400 font-semibold ml-2">
                                    {audioFilter === 'hpss' ? '(HPSS)' : audioFilter === 'reduce_noise' ? '(Reducción Activa)' : '(Sin Filtro)'}
                                  </span>
                                </h4>
                              </div>
                            </div>

                            {/* Play Progress bar */}
                            <div className="space-y-1.5 mb-6">
                              <input
                                type="range"
                                min="0"
                                max={durationProcessed || 1}
                                step="0.05"
                                value={currentTimeProcessed}
                                disabled={audioFilter === 'original'}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  if (audioRefProcessed.current) {
                                    audioRefProcessed.current.currentTime = val;
                                  }
                                  setCurrentTimeProcessed(val);
                                }}
                                className="w-full h-1 bg-slate-100 hover:bg-slate-200 rounded-lg appearance-none cursor-pointer accent-capsab-green disabled:cursor-not-allowed"
                              />
                              <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                                <span>{formatTime(currentTimeProcessed)}</span>
                                <span>{formatTime(durationProcessed)}</span>
                              </div>
                            </div>

                            {/* Button */}
                            <button
                              onClick={toggleAudioProcessed}
                              disabled={!loadedSessionData?.users[selectedUserAudio]?.hasAudio || audioFilter === 'original'}
                              className="mx-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-capsab-green hover:bg-capsab-green-hover text-white font-bold rounded-xl transition duration-150 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isPlayingProcessed ? (
                                <>
                                  <Pause className="w-4 h-4 fill-current" />
                                  Pausar muestra
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 fill-current" />
                                  Reproducir muestra
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      {/* Hidden Audio Elements */}
                      {loadedSessionData && scanResult?.audio && loadedSessionData.users[selectedUserAudio] && (
                        <>
                          <audio
                            ref={audioRefOriginal}
                            src={`http://127.0.0.1:8000/api/v1/experiments/sessions/files/audio?session_dir=${encodeURIComponent(loadedSessionData.directory)}&user_folder=${encodeURIComponent(loadedSessionData.users[selectedUserAudio].folder)}&filter_type=original`}
                            onTimeUpdate={() => {
                              if (audioRefOriginal.current) setCurrentTimeOriginal(audioRefOriginal.current.currentTime);
                            }}
                            onDurationChange={() => {
                              if (audioRefOriginal.current) setDurationOriginal(audioRefOriginal.current.duration);
                            }}
                            onEnded={() => {
                              setIsPlayingOriginal(false);
                            }}
                          />
                          <audio
                            ref={audioRefProcessed}
                            src={`http://127.0.0.1:8000/api/v1/experiments/sessions/files/audio?session_dir=${encodeURIComponent(loadedSessionData.directory)}&user_folder=${encodeURIComponent(loadedSessionData.users[selectedUserAudio].folder)}&filter_type=${audioFilter}&noise_start=${noiseStart}&noise_end=${noiseEnd}`}
                            onTimeUpdate={() => {
                              if (audioRefProcessed.current) setCurrentTimeProcessed(audioRefProcessed.current.currentTime);
                            }}
                            onDurationChange={() => {
                              if (audioRefProcessed.current) setDurationProcessed(audioRefProcessed.current.duration);
                            }}
                            onEnded={() => {
                              setIsPlayingProcessed(false);
                            }}
                          />
                        </>
                      )}
                    </div>
                  )}

                  {/* Tab 4: EMG chart activations */}
                  {activeTab === 'emg' && (
                    <div className="flex-1 flex flex-col justify-between space-y-6 min-h-0">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">Análisis EMG por participante</h4>
                        <p className="text-xs text-slate-400 font-medium">Revisión de las señales musculares de masticación registradas en emg_user_X.csv</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Left list of user CSVs */}
                        <div className="border border-slate-200 rounded-2xl bg-slate-50 overflow-hidden shadow-inner max-h-[220px] overflow-y-auto">
                          <div className="p-3 bg-slate-200 text-slate-700 text-xs font-bold tracking-wider">
                            Participantes EMG (.csv)
                          </div>
                          <div className="divide-y divide-slate-100">
                            {loadedSessionData?.users?.map((user, idx) => (
                              <div
                                key={idx}
                                onClick={() => setSelectedUserAudio(idx)}
                                className={`px-4 py-3 text-xs font-bold cursor-pointer transition-colors duration-150 ${
                                  idx === selectedUserAudio
                                    ? 'bg-capsab-green-light/60 text-capsab-green-dark border-l-4 border-capsab-green'
                                    : 'bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {`emg_user_${idx + 1}.csv (${user.id})`}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Right charts panel */}
                        <div className="md:col-span-2 border border-slate-200 rounded-2xl p-4 min-h-0 bg-white shadow-sm flex flex-col justify-between">
                          <div className="flex items-center gap-2 mb-4">
                            <Activity className="w-5 h-5 text-capsab-green flex-shrink-0" />
                            <h4 className="text-xs font-bold text-slate-700">
                              Respuesta de contracción - {loadedSessionData?.users[selectedUserAudio] ? `emg_user_${selectedUserAudio + 1}.csv` : 'No hay datos'}
                            </h4>
                          </div>

                          <div className="flex-1 w-full min-h-[160px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={emgChartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="time" label={{ value: 'Tiempo (s)', position: 'insideBottomRight', offset: -5 }} />
                                <YAxis label={{ value: 'Amplitud EMG (uV)', angle: -90, position: 'insideLeft' }} />
                                <Tooltip />
                                <Line type="monotone" dataKey="emg" stroke="#3b82f6" strokeWidth={2.5} activeDot={{ r: 6 }} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </>
            ) : (
              <div className="flex-1 bg-white border border-slate-200 rounded-3xl p-10 shadow-sm flex flex-col items-center justify-center text-center select-none min-h-0">
                <AlertCircle className="w-12 h-12 mb-3 text-slate-300" />
                <h3 className="text-md font-bold text-slate-800">
                  Visualización desactivada
                </h3>
                <p className="text-xs text-slate-400 font-semibold max-w-sm mt-1">
                  Seleccione una sesión del listado a la izquierda para analizar y graficar su telemetría.
                </p>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
};

export default VisualizationView;
