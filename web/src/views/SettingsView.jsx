import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import Header from '../components/Header';
import { Save, RefreshCw, Eye, EyeOff, Check, X } from 'lucide-react';

const SettingsView = () => {
  const {
    sessionUser,
    sessionPassword,
    labjackSerial,
    arduinoPort,
    mockPorts,
    saveSettings,
    goTo
  } = useAppContext();

  const [labjackInput, setLabjackInput] = useState(labjackSerial);
  const [selectedPort, setSelectedPort] = useState(arduinoPort);
  const [passwordInput, setPasswordInput] = useState(sessionPassword);
  const [showPassword, setShowPassword] = useState(false);
  
  // Port refreshing simulator
  const [portsList, setPortsList] = useState(mockPorts);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({ show: false, message: '', isError: false });

  const triggerToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
  };

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast({ show: false, message: '', isError: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const handleRefreshPorts = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      // Simulate refreshing ports list
      const freshPorts = [
        'COM3 (USB Serial Port)',
        'COM6 (Arduino Uno)',
        'COM7 (Bluetooth Port)',
        `COM8 (Simulated hardware port at ${new Date().toLocaleTimeString()})`
      ];
      setPortsList(freshPorts);
      setIsRefreshing(false);
      triggerToast('✓ Lista de puertos COM actualizada.');
    }, 1000);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!labjackInput.trim() || !passwordInput.trim()) {
      triggerToast('Complete todos los campos requeridos.', true);
      return;
    }

    try {
      saveSettings(labjackInput.trim(), selectedPort, passwordInput.trim());
      triggerToast('✓ Configuración guardada correctamente.');
      
      // Auto redirect to main menu after 1.8s
      setTimeout(() => {
        goTo('main_menu');
      }, 1800);
    } catch (err) {
      triggerToast(`Error al guardar: ${err.message}`, true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 select-none relative">
      <Header title="Configuración - dispositivos y sesión" />

      {/* Main Settings Body */}
      <main className="flex-1 w-full px-8 py-6 flex flex-col justify-center">
        
        <form onSubmit={handleSave} className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hardware Configuration Group Box */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-md font-bold text-[#1A365D] border-b border-slate-100 pb-3 mb-6">
                  Dispositivos y hardware
                </h3>
                
                <div className="space-y-6">
                  {/* LabJack Serial */}
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                    <div className="md:w-1/3">
                      <label className="text-sm font-semibold text-slate-700 block">
                        Serial LabJack:
                      </label>
                      <span className="text-xs text-slate-400 block font-medium">
                        Ej. LJ-123456
                      </span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={labjackInput}
                        onChange={(e) => setLabjackInput(e.target.value)}
                        placeholder="LJ-123456"
                        className="capsab-input"
                      />
                    </div>
                  </div>

                  {/* Arduino COM Port */}
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                    <div className="md:w-1/3">
                      <label className="text-sm font-semibold text-slate-700 block">
                        Puerto Arduino:
                      </label>
                      <span className="text-xs text-slate-400 block font-medium">
                        Seleccione el puerto COM
                      </span>
                    </div>
                    <div className="flex-1 flex gap-3">
                      <select
                        value={selectedPort}
                        onChange={(e) => setSelectedPort(e.target.value)}
                        className="capsab-input flex-1 cursor-pointer"
                      >
                        {portsList.map((portOption) => (
                          <option key={portOption} value={portOption}>
                            {portOption}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleRefreshPorts}
                        disabled={isRefreshing}
                        className="flex items-center justify-center gap-2 px-4 border border-slate-300 rounded-md text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:bg-slate-50 transition duration-150 cursor-pointer shadow-sm min-h-[42px]"
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span className="text-xs font-bold hidden sm:inline">Actualizar</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Session Configuration Group Box */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-md font-bold text-[#1A365D] border-b border-slate-100 pb-3 mb-6">
                  Sesión y cuenta
                </h3>
                
                <div className="space-y-6">
                  {/* Username (read-only) */}
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                    <div className="md:w-1/3">
                      <label className="text-sm font-semibold text-slate-700 block">
                        Usuario de Sesión:
                      </label>
                      <span className="text-xs text-slate-400 block font-medium">
                        No editable (sesión activa)
                      </span>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={sessionUser}
                        disabled
                        className="capsab-input"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6">
                    <div className="md:w-1/3">
                      <label className="text-sm font-semibold text-slate-700 block">
                        Clave de Sesión:
                      </label>
                      <span className="text-xs text-slate-400 block font-medium">
                        Contraseña de sesión enmascarada
                      </span>
                    </div>
                    <div className="flex-1 flex gap-3 relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="••••••••"
                        className="capsab-input pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-[7px] p-1.5 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition duration-150 cursor-pointer"
                        title="Mostrar / ocultar contraseña"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Save Action */}
          <div className="flex justify-center pt-4">
            <button
              type="submit"
              className="flex items-center justify-center gap-2 px-8 py-3 bg-[#3182CE] hover:bg-[#2B6CB0] active:bg-[#2C5282] text-white font-bold rounded-xl transition duration-150 shadow-md hover:shadow-lg cursor-pointer min-w-[200px]"
            >
              <Save className="w-5 h-5" />
              Guardar cambios
            </button>
          </div>
        </form>
      </main>

      {/* Non-intrusive success/error Toast notification */}
      {toast.show && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3.5 rounded-lg shadow-xl text-white font-bold transition-all duration-300 z-50 ${
            toast.isError ? 'bg-[#C53030]' : 'bg-[#276749]'
          }`}
        >
          {toast.isError ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
          <span className="text-sm tracking-wide">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default SettingsView;
