import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ArrowLeft } from 'lucide-react';

const Header = ({ title }) => {
  const { currentRoute, goBack } = useAppContext();

  // Don't show return button on login or main menu
  const showReturn = currentRoute !== 'login' && currentRoute !== 'main_menu';

  return (
    <header className="bg-[#001f5b] border-b border-blue-950 px-6 py-4 flex items-center justify-between shadow-md select-none">
      {/* Left side: Return Button & EUSab2 Logo */}
      <div className="flex items-center gap-4">
        {showReturn && (
          <button
            onClick={goBack}
            className="flex items-center justify-center p-2 rounded-full border border-white/20 text-white bg-white/10 hover:bg-white/20 active:bg-white/30 transition duration-150 cursor-pointer shadow-sm"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <img
          src="/assets/EUSab2.png"
          alt="EUSab2 Logo"
          className="h-[60px] md:h-[70px] w-auto object-contain"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
          }}
        />
      </div>

      {/* Center: Title */}
      <h1 className="hidden sm:block text-xl md:text-2xl font-bold text-white tracking-tight text-center flex-1 mx-4">
        {title || 'SensoTaster'}
      </h1>

      {/* Right side: CAPSAB logo and GAGPS logo */}
      <div className="flex items-center gap-4">
        <img
          src="/assets/logo_capsab.png"
          alt="CAPSAB Logo"
          className="h-[60px] md:h-[70px] w-auto object-contain"
          onError={(e) => {
            e.target.onerror = null;
            // Fallback to capsab2 if first is not loaded
            e.target.src = '/assets/logo_capsab2.png';
          }}
        />
        <div className="h-10 w-[2px] bg-white/30"></div>
        <img
          src="/assets/GAGPS_logo2.png"
          alt="GAGPS Logo"
          className="h-[50px] md:h-[60px] w-auto object-contain"
          onError={(e) => {
            e.target.onerror = null;
            e.target.style.display = 'none';
          }}
        />
      </div>
    </header>
  );
};

export default Header;
