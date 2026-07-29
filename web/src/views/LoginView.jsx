import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { KeyRound, User } from 'lucide-react';

const LoginView = () => {
  const { sessionUser, sessionPassword, goTo } = useAppContext();
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (usernameInput === sessionUser && passwordInput === sessionPassword) {
      setErrorMsg('');
      goTo('main_menu');
    } else {
      setErrorMsg('Usuario o contraseña incorrectos.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#001f5b] p-4 select-none">
      
      {/* Outer wrapper to place logos left and card right on md+ screens */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-16 max-w-5xl w-full py-8">
        
        {/* Left Side: Logos Container */}
        <div className="flex flex-col items-center max-w-md w-full">
          {/* EUSab Logo centered */}
          <div className="mb-6">
            <img
              src="/assets/EUSab.png"
              alt="EUSab Logo"
              className="h-28 md:h-32 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/assets/EUSab2.png';
              }}
            />
          </div>

          {/* CAPSAB | LINEA BLANCA | GAGPS row */}
          <div className="flex items-center justify-center gap-6 w-full px-4">
            <img
              src="/assets/logo_capsab2.png"
              alt="CAPSAB Logo"
              className="h-24 md:h-28 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/assets/logo_capsab.png';
              }}
            />
            
            <div className="w-[2px] h-20 bg-white opacity-80 self-center"></div>
            
            <img
              src="/assets/GAGPS_logo.png"
              alt="GAGPS Logo"
              className="h-24 md:h-28 object-contain"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/assets/GAGPS_logo2.png';
              }}
            />
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl transition-all duration-300 hover:border-white/20">
          <h2 className="text-2xl font-bold text-center text-white mb-8 tracking-wide">
            SensoTaster Sensory Platform
          </h2>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* User field */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <User className="w-4 h-4 text-capsab-green" />
                Usuario
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="Ingrese su usuario"
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-capsab-green focus:border-transparent transition-all duration-200"
                  required
                />
              </div>
            </div>

            {/* Password field */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-capsab-green" />
                Contraseña
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Ingrese su contraseña"
                  className="w-full bg-slate-900/60 border border-slate-700/60 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-capsab-green focus:border-transparent transition-all duration-200"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <p className="text-sm font-semibold text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-4 py-2.5 text-center">
                {errorMsg}
              </p>
            )}

            {/* Login Button */}
            <button
              type="submit"
              className="w-full bg-capsab-green hover:bg-capsab-green-hover active:bg-capsab-green-dark text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-green-950/20 hover:scale-[1.01] transition-all duration-200 cursor-pointer"
            >
              Acceder
            </button>
          </form>
        </div>

      </div>

      {/* Footer info */}
      <p className="mt-8 text-xs text-slate-500 font-medium tracking-wide">
        © 2026 SensoTaster Platform. Todos los derechos reservados.
      </p>
    </div>
  );
};

export default LoginView;
