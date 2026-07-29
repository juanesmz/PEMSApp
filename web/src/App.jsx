import React from 'react';
import { useAppContext } from './context/AppContext';
import LoginView from './views/LoginView';
import MainMenuView from './views/MainMenuView';
import SettingsView from './views/SettingsView';
import ExperimentView from './views/ExperimentView';
import RunningExpView from './views/RunningExpView';
import VisualizationView from './views/VisualizationView';
import AnalysisView from './views/AnalysisView';
import CustomModal from './components/CustomModal';

function App() {
  const { currentRoute, modalConfig, setModalConfig } = useAppContext();

  // Route router switcher
  const renderRoute = () => {
    switch (currentRoute) {
      case 'login':
        return <LoginView />;
      case 'main_menu':
        return <MainMenuView />;
      case 'settings':
        return <SettingsView />;
      case 'experiment':
        return <ExperimentView />;
      case 'running_exp':
        return <RunningExpView />;
      case 'visualization':
        return <VisualizationView />;
      case 'analysis':
        return <AnalysisView />;
      default:
        return <LoginView />;
    }
  };

  return (
    <div className="font-sans antialiased text-slate-800 bg-slate-100 min-h-screen">
      {renderRoute()}

      {modalConfig && (
        <CustomModal
          config={modalConfig}
          onClose={(value) => {
            modalConfig.resolve(value);
            setModalConfig(null);
          }}
        />
      )}
    </div>
  );
}

export default App;
