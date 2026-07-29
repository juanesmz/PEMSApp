import React from 'react';
import Header from '../components/Header';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Sparkles, BrainCircuit, Activity, Heart, ShieldAlert } from 'lucide-react';

const AnalysisView = () => {
  // Chebyshev analytical chewing pattern metrics (mock data)
  const classificationChewing = [
    { name: 'Contracciones/Min', USR1: 82, USR2: 70, average: 75 },
    { name: 'Fatiga Muscular (%)', USR1: 45, USR2: 30, average: 37 },
    { name: 'Velocidad Masticación', USR1: 65, USR2: 80, average: 72 },
    { name: 'Esfuerzo de Mordida', USR1: 90, USR2: 55, average: 72 }
  ];

  // Radar sensory characterization
  const sensoryProfile = [
    { subject: 'Textura Inicial', A: 120, B: 110, fullMark: 150 },
    { subject: 'Frecuencia de Mordida', A: 98, B: 130, fullMark: 150 },
    { subject: 'Actividad EMG Masetero', A: 86, B: 130, fullMark: 150 },
    { subject: 'Tasa Respiración (Gas)', A: 99, B: 100, fullMark: 150 },
    { subject: 'Duración Degustación', A: 85, B: 90, fullMark: 150 }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 select-none">
      <Header title="Análisis de características sensoriales" />

      {/* Main Container */}
      <main className="flex-1 w-full px-8 py-6 space-y-6">
        
        {/* Intro Banner */}
        <div className="bg-gradient-to-r from-[#1A365D] to-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-lg flex flex-col md:flex-row items-center gap-6 justify-between select-none">
          <div className="space-y-1">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-capsab-green" />
              Clasificación y extracción de características
            </h3>
            <p className="text-xs text-slate-400 font-medium max-w-xl">
              Procese las señales electromiográficas (EMG) combinadas con curvas olfativas (gases) y grabaciones acústicas para identificar patrones de masticación y texturas del alimento.
            </p>
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-capsab-green hover:bg-capsab-green-hover active:bg-capsab-green-dark text-white font-bold rounded-xl transition duration-150 shadow-md hover:shadow-lg cursor-pointer text-xs">
            <BrainCircuit className="w-4 h-4" />
            Calcular características
          </button>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Chart 1: Chewing pattern BarChart */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <div className="mb-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-capsab-green" />
                Patrones chewing de masticación
              </h4>
              <p className="text-xs text-slate-400 font-medium">Comparativa de frecuencia y fatiga entre los participantes y el promedio</p>
            </div>

            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classificationChewing}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="USR1" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="USR2" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="average" fill="#4CAF50" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Sensory Profile RadarChart */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col justify-between">
            <div className="mb-4">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-capsab-green" />
                Perfil dinámico sensorial
              </h4>
              <p className="text-xs text-slate-400 font-medium">Mapeo multidimensional de la textura e intensidad olfativa</p>
            </div>

            <div className="h-[280px] w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" radius="70%" data={sensoryProfile}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis />
                  <Radar name="Participante A" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                  <Radar name="Participante B" dataKey="B" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

      </main>
    </div>
  );
};

export default AnalysisView;
