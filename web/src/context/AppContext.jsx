import React, { createContext, useContext, useState, useEffect } from 'react';

const AppContext = createContext();

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  // --- Navigation & Routing ---
  const [currentRoute, setCurrentRoute] = useState('login');
  const [routeHistory, setRouteHistory] = useState([]);

  // --- Custom Modal Dialog System ---
  const [modalConfig, setModalConfig] = useState(null);

  const showAlert = (title, message) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'alert',
        title,
        message,
        resolve
      });
    });
  };

  const showConfirm = (title, message) => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'confirm',
        title,
        message,
        resolve
      });
    });
  };

  const showPrompt = (title, message, defaultValue = '') => {
    return new Promise((resolve) => {
      setModalConfig({
        type: 'prompt',
        title,
        message,
        defaultValue,
        resolve
      });
    });
  };

  const goTo = (route) => {
    setRouteHistory((prev) => [...prev, currentRoute]);
    setCurrentRoute(route);
  };

  const goBack = () => {
    if (routeHistory.length > 0) {
      const prev = routeHistory[routeHistory.length - 1];
      setRouteHistory((prevList) => prevList.slice(0, -1));
      setCurrentRoute(prev);
    } else {
      setCurrentRoute('main_menu');
    }
  };

  // --- Session Credentials & Settings (loaded from localstorage or env) ---
  const [sessionUser, setSessionUser] = useState(() => localStorage.getItem('SESSION_USER') || 'admin');
  const [sessionPassword, setSessionPassword] = useState(() => localStorage.getItem('SESSION_PASSWORD') || 'admin');
  const [labjackSerial, setLabjackSerial] = useState(() => localStorage.getItem('LABJACK_SERIAL') || 'LJ-123456');
  const [arduinoPort, setArduinoPort] = useState(() => localStorage.getItem('ARDUINO_COM_PORT') || 'COM6');

  const saveSettings = (newLabjack, newPort, newPassword) => {
    setLabjackSerial(newLabjack);
    setArduinoPort(newPort);
    setSessionPassword(newPassword);
    localStorage.setItem('LABJACK_SERIAL', newLabjack);
    localStorage.setItem('ARDUINO_COM_PORT', newPort);
    localStorage.setItem('SESSION_PASSWORD', newPassword);
  };

  // --- Available Ports / Cameras Mock List ---
  const mockPorts = ['COM3 (USB Serial Port)', 'COM6 (Arduino Uno)', 'COM7 (Bluetooth Port)'];
  const mockCameras = [
    { name: 'Cámara Integrada HP Wide Vision', index: 0 },
    { name: 'Logitech USB Webcam C920', index: 1 },
    { name: 'OBS Virtual Camera', index: 2 }
  ];

  // --- Experiment Setup State ---
  const [cabinCleaningCompleted, setCabinCleaningCompleted] = useState(false);
  const [gasReferences, setGasReferences] = useState(['Oxígeno', 'Dióxido de Carbono', 'Etanol']);
  
  // SG_1 to SG_13 mapping. Init with N/A
  const [gasConfig, setGasConfig] = useState(() => {
    const config = [];
    for (let i = 1; i <= 13; i++) {
      config.push({ sensorId: `SG_${i}`, ref: 'N/A' });
    }
    return config;
  });

  const updateGasConfigRow = (sensorId, ref) => {
    setGasConfig(prev => prev.map(row => row.sensorId === sensorId ? { ...row, ref } : row));
  };

  // EMG selected channel indices (0-5 correspond to sensor channels 1-6)
  const [emgSelectedSensors, setEmgSelectedSensors] = useState([]);
  // Dynamic table of active sensors (names of the channels added)
  const [emgSensorNames, setEmgSensorNames] = useState([]);

  // Microphone configurations (one for each participant, list length matching number of emg/mic count)
  const [micList, setMicList] = useState([]);

  // Camera settings
  const [selectedCameraIndex, setSelectedCameraIndex] = useState(null);
  const [roi, setRoi] = useState({ p1: null, p2: null });

  // Configuration (Base save directory & users table data)
  const [baseSavePath, setBaseSavePath] = useState('C:/SensoTaster/Experiments');
  const [usersData, setUsersData] = useState([]);

  // Sidebar modules: Limpieza(0), Gas(1), EMG(2), Mics(3), Cámaras(4), Config(5)
  const [modulesStatus, setModulesStatus] = useState([false, false, false, false, false, false]);
  const [omittedModules, setOmittedModules] = useState([false, false, false, false, false, false]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const resetExperimentSetup = () => {
    setCabinCleaningCompleted(false);
    setGasConfig(Array.from({ length: 13 }, (_, i) => ({ sensorId: `SG_${i + 1}`, ref: 'N/A' })));
    setEmgSelectedSensors([]);
    setEmgSensorNames([]);
    setMicList([]);
    setRoi({ p1: null, p2: null });
    setUsersData([]);
    setModulesStatus([false, false, false, false, false, false]);
    setOmittedModules([false, false, false, false, false, false]);
    setCurrentStepIndex(0);
  };

  // --- Running Experiment Live Data ---
  const [isCapturing, setIsCapturing] = useState(false);
  const [runningStep, setRunningStep] = useState('idle'); // idle, capturing, complete
  const [userCaptureActive, setUserCaptureActive] = useState([true, true, true, true, true, true]); // for up to 6 users
  const [countdownSeconds, setCountdownSeconds] = useState(60);
  const [latestSessionPath, setLatestSessionPath] = useState('');
  const [sessionId, setSessionId] = useState('');

  // Mock database for visualized experiments
  const [mockSessions, setMockSessions] = useState([
    {
      directory: 'C:/SensoTaster/Experiments/20260529_120000',
      timestamp: '20260529_120000',
      hasGas: true,
      hasEmg: true,
      hasAudio: true,
      hasImaging: true,
      users: [
        { id: 'USR_001', age: 24, gender: 'M' },
        { id: 'USR_002', age: 22, gender: 'F' }
      ]
    }
  ]);

  return (
    <AppContext.Provider value={{
      // Navigation
      currentRoute,
      goTo,
      goBack,

      // Settings
      sessionUser,
      sessionPassword,
      labjackSerial,
      arduinoPort,
      setArduinoPort,
      mockPorts,
      mockCameras,
      saveSettings,

      // Experiment States
      cabinCleaningCompleted,
      setCabinCleaningCompleted,
      gasReferences,
      setGasReferences,
      gasConfig,
      setGasConfig,
      updateGasConfigRow,
      emgSelectedSensors,
      setEmgSelectedSensors,
      emgSensorNames,
      setEmgSensorNames,
      micList,
      setMicList,
      selectedCameraIndex,
      setSelectedCameraIndex,
      roi,
      setRoi,
      baseSavePath,
      setBaseSavePath,
      usersData,
      setUsersData,
      modulesStatus,
      setModulesStatus,
      omittedModules,
      setOmittedModules,
      currentStepIndex,
      setCurrentStepIndex,
      resetExperimentSetup,

      // Running session
      isCapturing,
      setIsCapturing,
      runningStep,
      setRunningStep,
      userCaptureActive,
      setUserCaptureActive,
      countdownSeconds,
      setCountdownSeconds,
      latestSessionPath,
      setLatestSessionPath,
      sessionId,
      setSessionId,
      mockSessions,
      setMockSessions,

      // Custom dialog system
      modalConfig,
      setModalConfig,
      showAlert,
      showConfirm,
      showPrompt
    }}>
      {children}
    </AppContext.Provider>
  );
};
