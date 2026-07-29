import React, { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { Folder, Users, AlertCircle } from 'lucide-react';

const Configuration = () => {
  const {
    baseSavePath,
    setBaseSavePath,
    emgSelectedSensors,
    micList,
    usersData,
    setUsersData,
    modulesStatus,
    omittedModules
  } = useAppContext();

  // Determine active state of EMG and Mic modules
  const emgActive = modulesStatus[2] && !omittedModules[2];
  const micActive = modulesStatus[3] && !omittedModules[3];
  const canEdit = emgActive || micActive;

  const participantCount = canEdit
    ? Math.max(emgSelectedSensors.length, micList.length)
    : 0;

  // Initialize or adjust users data rows
  useEffect(() => {
    if (!canEdit) {
      setUsersData([]);
      return;
    }

    setUsersData(prev => {
      let adjusted = [...prev];
      if (adjusted.length < participantCount) {
        // Add new default rows
        for (let i = adjusted.length; i < participantCount; i++) {
          adjusted.push({
            num: i + 1,
            id: `USR_00${i + 1}`,
            age: i % 2 === 0 ? 25 : 20,
            gender: 'M', // Default male
            emg_index: emgSelectedSensors[i] !== undefined ? emgSelectedSensors[i] : (emgSelectedSensors[0] !== undefined ? emgSelectedSensors[0] : null),
            mic_config: micList[i] !== undefined ? micList[i] : (micList[0] !== undefined ? micList[0] : null)
          });
        }
      } else if (adjusted.length > participantCount) {
        // Truncate excess rows
        adjusted = adjusted.slice(0, participantCount);
      }

      // Sync existing user assignments with currently available EMG sensors and Mic list
      return adjusted.map((u, i) => {
        let emg_index = u.emg_index;
        if (emg_index === undefined || (emg_index !== null && !emgSelectedSensors.includes(emg_index))) {
          emg_index = emgSelectedSensors[i] !== undefined ? emgSelectedSensors[i] : (emgSelectedSensors[0] !== undefined ? emgSelectedSensors[0] : null);
        }

        let mic_config = u.mic_config;
        const micStillExists = mic_config && micList.some(m => m.name === mic_config.name);
        if (mic_config === undefined || (mic_config !== null && !micStillExists)) {
          mic_config = micList[i] !== undefined ? micList[i] : (micList[0] !== undefined ? micList[0] : null);
        }

        return { ...u, emg_index, mic_config };
      });
    });
  }, [participantCount, canEdit, emgSelectedSensors, micList]);

  const handleAgeChange = (index, val) => {
    const ageVal = Math.max(0, Math.min(120, parseInt(val) || 0));
    setUsersData(prev => prev.map((u, i) => i === index ? { ...u, age: ageVal } : u));
  };

  const handleGenderChange = (index, gender) => {
    setUsersData(prev => prev.map((u, i) => i === index ? { ...u, gender } : u));
  };

  const handleIdChange = (index, idText) => {
    setUsersData(prev => prev.map((u, i) => i === index ? { ...u, id: idText } : u));
  };

  const handleMicChange = (index, micName) => {
    const micObj = micList.find(m => m.name === micName) || null;
    setUsersData(prev => prev.map((u, i) => i === index ? { ...u, mic_config: micObj } : u));
  };

  const handleEmgChange = (index, emgVal) => {
    const emgIdx = emgVal === "" ? null : parseInt(emgVal);
    setUsersData(prev => prev.map((u, i) => i === index ? { ...u, emg_index: emgIdx } : u));
  };

  const handleBrowseDirectory = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/experiments/browse');
      if (response.ok) {
        const data = await response.json();
        if (data.path) {
          setBaseSavePath(data.path);
        }
      }
    } catch (e) {
      console.error("Error browsing directory:", e);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full select-none">
      
      {/* Top Section: Save Path Configuration */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Folder className="w-4 h-4 text-capsab-green" />
          Ruta de almacenamiento local
        </h3>
        <p className="text-xs text-slate-400 font-medium">
          Seleccione la carpeta raíz en el disco local donde se guardarán los archivos capturados de esta sesión.
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={baseSavePath}
            onChange={(e) => setBaseSavePath(e.target.value)}
            placeholder="C:/SensoTaster/Experiments"
            className="capsab-input flex-1 font-semibold text-xs"
          />
          <button
            type="button"
            onClick={handleBrowseDirectory}
            className="flex items-center gap-2 px-5 border border-slate-300 rounded-md text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 transition duration-150 cursor-pointer shadow-sm text-xs font-bold"
          >
            Examinar...
          </button>
        </div>
      </div>

      {/* Bottom Section: Participant Demographics Grid */}
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">
        {/* Title / Status info */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-capsab-green" />
            Configuración de participantes ({participantCount})
          </span>
          {!canEdit && (
            <span className="text-[10px] text-capsab-orange-dark bg-capsab-orange-light/50 px-3 py-1 rounded-full font-bold">
              Módulos EMG/Mic inactivos
            </span>
          )}
        </div>

        {/* Content */}
        {!canEdit ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-400">
            <AlertCircle className="w-10 h-10 mb-2 text-slate-300" />
            <p className="text-xs font-bold max-w-sm">
              No hay participantes por configurar. Habilite el módulo de **Sensores EMG** o de **Micrófonos** en los pasos anteriores.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-capsab-green text-white text-xs font-bold select-none">
                  <th className="py-3 px-6 text-center w-[80px]">Fila</th>
                  <th className="py-3 px-6 text-center w-[120px]">Edad</th>
                  <th className="py-3 px-6 text-center w-[280px]">Género</th>
                  <th className="py-3 px-6 text-center">Identificador (ID)</th>
                  <th className="py-3 px-6 text-center w-[240px]">Micrófono</th>
                  <th className="py-3 px-6 text-center w-[200px]">Sensor EMG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usersData.map((user, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    {/* Participant index */}
                    <td className="py-3 px-6 text-center font-bold text-slate-600 text-sm select-none">
                      {user.num}
                    </td>

                    {/* Age Input (Spinbox mimicking) */}
                    <td className="py-3 px-6 flex justify-center">
                      <input
                        type="number"
                        min="0"
                        max="120"
                        value={user.age}
                        onChange={(e) => handleAgeChange(idx, e.target.value)}
                        className="w-20 px-2 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-capsab-green text-center text-xs font-bold"
                      />
                    </td>

                    {/* Gender buttons */}
                    <td className="py-3 px-6">
                      <div className="flex justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleGenderChange(idx, 'M')}
                          className={`w-[110px] py-2 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer ${
                            user.gender === 'M'
                              ? 'bg-capsab-green border-capsab-green-dark text-white font-bold'
                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/50'
                          }`}
                        >
                          Masculino
                        </button>
                        <button
                          type="button"
                          onClick={() => handleGenderChange(idx, 'F')}
                          className={`w-[110px] py-2 text-xs font-bold rounded-lg border transition-all duration-150 cursor-pointer ${
                            user.gender === 'F'
                              ? 'bg-capsab-green border-capsab-green-dark text-white font-bold'
                              : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200/50'
                          }`}
                        >
                          Femenino
                        </button>
                      </div>
                    </td>

                    {/* User ID LineEdit */}
                    <td className="py-3 px-6">
                      <input
                        type="text"
                        value={user.id}
                        onChange={(e) => handleIdChange(idx, e.target.value)}
                        placeholder="USR_001"
                        className="w-full max-w-[200px] mx-auto block px-3 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-capsab-green text-xs font-bold text-center bg-slate-100/60"
                      />
                    </td>

                    {/* Microphone Selection */}
                    <td className="py-3 px-6">
                      <div className="flex justify-center">
                        {micActive ? (
                          <select
                            value={user.mic_config?.name || ""}
                            onChange={(e) => handleMicChange(idx, e.target.value)}
                            className="w-full max-w-[220px] px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-capsab-green text-[11px] font-bold bg-white cursor-pointer"
                          >
                            {micList.length === 0 ? (
                              <option value="">Sin micrófonos</option>
                            ) : (
                              micList.map((mic, mIdx) => (
                                <option key={mIdx} value={mic.name}>
                                  {mic.name}
                                </option>
                              ))
                            )}
                          </select>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-3 py-1 rounded-full uppercase">
                            N/A
                          </span>
                        )}
                      </div>
                    </td>

                    {/* EMG Sensor Selection */}
                    <td className="py-3 px-6">
                      <div className="flex justify-center">
                        {emgActive ? (
                          <select
                            value={user.emg_index !== null && user.emg_index !== undefined ? user.emg_index : ""}
                            onChange={(e) => handleEmgChange(idx, e.target.value)}
                            className="w-full max-w-[180px] px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-capsab-green text-[11px] font-bold bg-white cursor-pointer"
                          >
                            {emgSelectedSensors.length === 0 ? (
                              <option value="">Sin sensores</option>
                            ) : (
                              emgSelectedSensors.map((sensorId) => (
                                <option key={sensorId} value={sensorId}>
                                  Sensor EMG #{sensorId + 1}
                                </option>
                              ))
                            )}
                          </select>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-3 py-1 rounded-full uppercase">
                            N/A
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default Configuration;
