import React from 'react';
import { useAppContext } from '../context/AppContext';
import Header from '../components/Header';
import { LogOut } from 'lucide-react';

const MainMenuView = () => {
  const { goTo } = useAppContext();

  const menuItems = [
    {
      id: 'btnExperiment',
      label: 'Módulo de experimentación',
      img: '/assets/ExpModule.png',
      route: 'experiment',
      desc: 'Configuración y captura de sensores en tiempo real'
    },
    {
      id: 'btnVisualization',
      label: 'Visualización de datos',
      img: '/assets/VerData.png',
      route: 'visualization',
      desc: 'Visualización y reproducción de capturas guardadas'
    },
    {
      id: 'btnAnalysis',
      label: 'Análisis de datos',
      img: '/assets/DataAnali.png',
      route: 'analysis',
      desc: 'Cálculo de características y análisis estadístico'
    },
    {
      id: 'btnSettings',
      label: 'Configuración de dispositivos',
      img: '/assets/settings.png',
      route: 'settings',
      desc: 'Ajustes de puertos COM y contraseñas de sesión'
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 select-none">
      <Header title="Menú principal" />

      {/* Main Container */}
      <main className="flex-1 w-full px-8 py-8 flex flex-col justify-center">
        
        {/* Module Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 xl:gap-8">
          {menuItems.map((item) => (
            <div
              key={item.id}
              onClick={() => goTo(item.route)}
              className="bg-white rounded-3xl p-6 shadow-md hover:shadow-xl border border-slate-200/80 hover:border-capsab-green/30 flex flex-col items-center justify-center text-center cursor-pointer group transition-all duration-300 hover:scale-[1.02]"
            >
              {/* Circular Gray Button matching Qt QToolButton */}
              <div className="w-[180px] h-[180px] sm:w-[220px] sm:h-[220px] bg-[#949494] hover:bg-[#bdbdbd] group-hover:bg-[#bdbdbd] active:bg-[#a6a6a6] rounded-[50px] flex items-center justify-center p-4 transition-all duration-300 shadow-inner group-hover:rotate-1">
                <img
                  src={item.img}
                  alt={item.label}
                  className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
              </div>

              {/* Title & Desc */}
              <h3 className="mt-6 text-lg font-bold text-slate-800 group-hover:text-capsab-green transition-colors duration-200">
                {item.label}
              </h3>
              <p className="mt-2 text-sm text-slate-500 max-w-xs font-medium">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom Actions */}
        <div className="mt-12 flex justify-center">
          <button
            onClick={() => goTo('login')}
            className="flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-700 active:bg-slate-800 text-white font-bold rounded-xl transition duration-150 shadow-md hover:shadow-lg cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Cerrar sesión
          </button>
        </div>
      </main>
    </div>
  );
};

export default MainMenuView;
