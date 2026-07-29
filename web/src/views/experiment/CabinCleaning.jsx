import React, { useState, useEffect, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Play, Pause, RotateCcw, Clock, Info, Bell, ChevronUp, ChevronDown, Check } from 'lucide-react';

const CabinCleaning = () => {
  const { setCabinCleaningCompleted } = useAppContext();

  // Timer states
  const [totalSeconds, setTotalSeconds] = useState(1200); // 20 minutes default
  const [remainingSeconds, setRemainingSeconds] = useState(1200);
  const [isRunning, setIsRunning] = useState(false);
  const [targetEndTime, setTargetEndTime] = useState('');
  const [showTooltip, setShowTooltip] = useState(false);

  const timerRef = useRef(null);
  const touchStartMinsY = useRef(0);
  const touchStartSecsY = useRef(0);

  // Helper: Format seconds to MM:SS or HH:MM:SS
  const formatSeconds = (totalSec) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };



  // Calculate target end time wall-clock string
  const calculateTargetEndTime = (secs) => {
    const targetDate = new Date(Date.now() + secs * 1000);
    let hours = targetDate.getHours();
    const minutes = targetDate.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const formattedHours = hours.toString().padStart(2, '0');
    return `${formattedHours}:${minutes} ${ampm}`;
  };

  // Update target end time periodically
  useEffect(() => {
    setTargetEndTime(calculateTargetEndTime(remainingSeconds));
    
    let timeUpdateInterval;
    if (!isRunning) {
      timeUpdateInterval = setInterval(() => {
        setTargetEndTime(calculateTargetEndTime(remainingSeconds));
      }, 10000);
    }
    return () => clearInterval(timeUpdateInterval);
  }, [remainingSeconds, isRunning]);

  // Countdown timer effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            setCabinCleaningCompleted(true);
            // Sync with backend to ensure FIO0 and FIO1 are set to LOW
            fetch('http://127.0.0.1:8000/api/v1/cleaning/stop', { method: 'POST' })
              .catch(err => console.error("Error stopping cleaning on timer finish:", err));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, setCabinCleaningCompleted]);

  // Handle Play / Pause
  const handleTogglePlay = async () => {
    const nextRunningState = !isRunning;
    setIsRunning(nextRunningState);

    try {
      if (nextRunningState) {
        // Start cleaning
        const response = await fetch('http://127.0.0.1:8000/api/v1/cleaning/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration_seconds: remainingSeconds })
        });
        if (!response.ok) {
          console.error("Error starting cleaning cycle on backend");
        }
      } else {
        // Pause/Stop cleaning
        const response = await fetch('http://127.0.0.1:8000/api/v1/cleaning/stop', {
          method: 'POST'
        });
        if (!response.ok) {
          console.error("Error stopping cleaning cycle on backend");
        }
      }
    } catch (e) {
      console.error("Error communicating with cleaning API:", e);
    }
  };

  // Handle Reset
  const handleReset = async () => {
    setIsRunning(false);
    setRemainingSeconds(totalSeconds);

    try {
      await fetch('http://127.0.0.1:8000/api/v1/cleaning/stop', {
        method: 'POST'
      });
    } catch (e) {
      console.error("Error sending stop signal on reset:", e);
    }
  };

  const displayMins = Math.floor(remainingSeconds / 60);
  const displaySecs = remainingSeconds % 60;

  const handleMinsChange = (newMins) => {
    if (isRunning) return;
    const secs = (newMins * 60) + displaySecs;
    if (secs >= 0) {
      setTotalSeconds(secs);
      setRemainingSeconds(secs);
    }
  };

  const handleSecsChange = (newSecs) => {
    if (isRunning) return;
    const secs = (displayMins * 60) + newSecs;
    if (secs >= 0) {
      setTotalSeconds(secs);
      setRemainingSeconds(secs);
    }
  };

  const handleTouchStartMins = (e) => {
    if (isRunning) return;
    touchStartMinsY.current = e.touches[0].clientY;
  };

  const handleTouchMoveMins = (e) => {
    if (isRunning) return;
    const currentY = e.touches[0].clientY;
    const diffY = touchStartMinsY.current - currentY;
    const threshold = 15;
    if (Math.abs(diffY) >= threshold) {
      if (diffY > 0) {
        handleMinsChange((displayMins + 1) % 60);
      } else {
        handleMinsChange((displayMins - 1 + 60) % 60);
      }
      touchStartMinsY.current = currentY;
    }
  };

  const handleTouchStartSecs = (e) => {
    if (isRunning) return;
    touchStartSecsY.current = e.touches[0].clientY;
  };

  const handleTouchMoveSecs = (e) => {
    if (isRunning) return;
    const currentY = e.touches[0].clientY;
    const diffY = touchStartSecsY.current - currentY;
    const threshold = 15;
    if (Math.abs(diffY) >= threshold) {
      if (diffY > 0) {
        handleSecsChange((displaySecs + 1) % 60);
      } else {
        handleSecsChange((displaySecs - 1 + 60) % 60);
      }
      touchStartSecsY.current = currentY;
    }
  };

  // Circular progress calculations - larger radius (74) and stroke (10) for thicker look
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = totalSeconds > 0 
    ? circumference - (remainingSeconds / totalSeconds) * circumference 
    : 0;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full select-none">
      {/* Left panel: Timer (light themed card, now positioned on the left) */}
      <div className="w-full lg:w-[40%] bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex flex-col justify-between items-center relative h-full text-slate-800">
        
        {/* Info icon with tooltip in top-right */}
        <div className="absolute top-4 right-4 z-10">
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-slate-400 hover:text-sky-500 transition-colors p-1.5 rounded-full hover:bg-slate-100 focus:outline-none"
              aria-label="Información de limpieza"
            >
              <Info className="w-5 h-5" />
            </button>
            {showTooltip && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-800 text-white text-xs rounded-xl p-3 shadow-lg z-20 border border-slate-700 transition-all duration-200">
                <div className="font-semibold mb-1">Recomendación</div>
                El tiempo recomendado de limpieza es de 15 minutos.
              </div>
            )}
          </div>
        </div>

        <div className="w-full flex-1 flex flex-col justify-between items-center py-1">
          <div className="text-center">
            <span className="text-[11px] font-bold text-slate-400 tracking-widest flex items-center justify-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-500" />
              Ciclo de limpieza de gas
            </span>
          </div>

          {/* Circular Timer Display - occupies 70% of the container width */}
          <div className="relative my-2 w-[70%] aspect-square flex items-center justify-center">
            <svg viewBox="0 0 160 160" className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-slate-100"
                strokeWidth="7"
                fill="transparent"
              />
              <circle
                cx="80"
                cy="80"
                r={radius}
                className="stroke-sky-500 transition-all duration-300"
                strokeWidth="7"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>

            {/* Time Numbers / Inputs in the center - always visible */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <div className="flex flex-col items-center gap-0.5 mt-[-10px]">
                {/* Dedicated Labels Header row matching columns gap and alignment */}
                <div className={`flex items-center justify-center gap-3 text-[10px] font-bold text-slate-400 tracking-wider mb-2 ${isRunning ? 'invisible' : ''}`}>
                  <span className="w-12 text-center">Minutos</span>
                  <span className="w-3 text-center"></span> {/* Spacer corresponding to the colon */}
                  <span className="w-12 text-center">Segundos</span>
                </div>

                <div className="flex items-center justify-center gap-3 text-slate-800">
                  {/* Minutes Column */}
                  <div 
                    className={`flex flex-col items-center ${isRunning ? '' : 'cursor-ns-resize'}`}
                    onWheel={(e) => {
                      if (isRunning) return;
                      if (e.deltaY < 0) {
                        handleMinsChange((displayMins + 1) % 60);
                      } else {
                        handleMinsChange((displayMins - 1 + 60) % 60);
                      }
                    }}
                    onTouchStart={handleTouchStartMins}
                    onTouchMove={handleTouchMoveMins}
                  >
                    {/* Previous Minute */}
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => handleMinsChange((displayMins - 1 + 60) % 60)}
                      className={`text-sm font-semibold text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-50 ${isRunning ? 'invisible' : ''}`}
                    >
                      {((displayMins - 1 + 60) % 60).toString().padStart(2, '0')}
                    </button>

                    <div className={`w-10 border-t border-slate-200 my-1 ${isRunning ? 'invisible' : ''}`}></div>

                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={displayMins.toString().padStart(2, '0')}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/\D/g, '');
                        const val = parseInt(cleanVal, 10);
                        handleMinsChange(isNaN(val) ? 0 : Math.max(0, Math.min(59, val)));
                      }}
                      disabled={isRunning}
                      className="w-12 text-3xl lg:text-4xl font-extrabold text-sky-500 text-center bg-transparent border-none outline-none focus:ring-0 disabled:text-sky-500"
                    />

                    <div className={`w-10 border-t border-slate-200 my-1 ${isRunning ? 'invisible' : ''}`}></div>

                    {/* Next Minute */}
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => handleMinsChange((displayMins + 1) % 60)}
                      className={`text-sm font-semibold text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-50 ${isRunning ? 'invisible' : ''}`}
                    >
                      {((displayMins + 1) % 60).toString().padStart(2, '0')}
                    </button>
                  </div>

                  {/* Centered Colon */}
                  <span className="text-3xl lg:text-4xl font-extrabold text-sky-500 self-center pb-1 lg:pb-1.5">:</span>

                  {/* Seconds Column */}
                  <div 
                    className={`flex flex-col items-center ${isRunning ? '' : 'cursor-ns-resize'}`}
                    onWheel={(e) => {
                      if (isRunning) return;
                      if (e.deltaY < 0) {
                        handleSecsChange((displaySecs + 1) % 60);
                      } else {
                        handleSecsChange((displaySecs - 1 + 60) % 60);
                      }
                    }}
                    onTouchStart={handleTouchStartSecs}
                    onTouchMove={handleTouchMoveSecs}
                  >
                    {/* Previous Second */}
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => handleSecsChange((displaySecs - 1 + 60) % 60)}
                      className={`text-sm font-semibold text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-50 ${isRunning ? 'invisible' : ''}`}
                    >
                      {((displaySecs - 1 + 60) % 60).toString().padStart(2, '0')}
                    </button>

                    <div className={`w-10 border-t border-slate-200 my-1 ${isRunning ? 'invisible' : ''}`}></div>

                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={displaySecs.toString().padStart(2, '0')}
                      onChange={(e) => {
                        const cleanVal = e.target.value.replace(/\D/g, '');
                        const val = parseInt(cleanVal, 10);
                        handleSecsChange(isNaN(val) ? 0 : Math.max(0, Math.min(59, val)));
                      }}
                      disabled={isRunning}
                      className="w-12 text-3xl lg:text-4xl font-extrabold text-sky-500 text-center bg-transparent border-none outline-none focus:ring-0 disabled:text-sky-500"
                    />

                    <div className={`w-10 border-t border-slate-200 my-1 ${isRunning ? 'invisible' : ''}`}></div>

                    {/* Next Second */}
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => handleSecsChange((displaySecs + 1) % 60)}
                      className={`text-sm font-semibold text-slate-300 hover:text-slate-500 transition-colors disabled:opacity-50 ${isRunning ? 'invisible' : ''}`}
                    >
                      {((displaySecs + 1) % 60).toString().padStart(2, '0')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center w-full px-4 mt-1">
            {remainingSeconds === 0 ? (
              <button
                type="button"
                onClick={handleReset}
                className="w-[80%] py-3 px-6 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:scale-102 active:scale-98 text-sm"
              >
                Limpieza finalizada
              </button>
            ) : isRunning ? (
              <button
                type="button"
                onClick={handleTogglePlay}
                className="w-[80%] py-3 px-6 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:scale-102 active:scale-98 text-sm"
              >
                <Pause className="w-4 h-4 fill-current text-white" />
                Detener limpieza
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTogglePlay}
                className="w-[80%] py-3 px-6 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-bold rounded-xl shadow-md transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 hover:scale-102 active:scale-98 text-sm"
              >
                <Play className="w-4 h-4 fill-current ml-0.5 text-white" />
                Iniciar limpieza
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right panel: Reference Image (always visible, positioned on the right) */}
      <div className="w-full lg:w-[60%] bg-white border border-slate-200 rounded-3xl p-2 shadow-sm flex items-center justify-center h-full">
        <img
          src="/assets/cleanCabin.png"
          alt="Cabin Cleaning Reference"
          className="w-full h-full max-h-[95%] object-contain rounded-2xl"
        />
      </div>
    </div>
  );
};

export default CabinCleaning;
